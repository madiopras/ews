"""Unit coverage for planner quota and streaming orchestration."""

import asyncio

import pytest

from app.modules.planner.domain import build_planner_partner_recommendations
from app.modules.planner.exceptions import PlannerError
from app.modules.planner.schemas import TripPlanIn
from app.modules.planner.service import PlannerGenerationService, PlannerQuotaService
from app.modules.planner.sse import encode_sse_stream


class Identity:
    def identity_hash(self, value):
        return f"hash:{value}"

    def guest_identity(self, _token, _ttl):
        return "guest", "signed-cookie"


class AtomicQuotaRepository:
    def __init__(self):
        self.lock = asyncio.Lock()
        self.rows = {}

    async def reserve(self, key, limit, _ttl, _cooldown):
        async with self.lock:
            row = self.rows.setdefault(key, {"consumed_count": 0, "reservations": []})
            if limit and row["consumed_count"] + len(row["reservations"]) >= limit:
                return ""
            reservation = f"reservation-{len(row['reservations']) + 1}"
            row["reservations"].append(reservation)
            return reservation

    async def consume(self, key, reservation, _ttl):
        row = self.rows[key]
        if reservation in row["reservations"]:
            row["reservations"].remove(reservation)
            row["consumed_count"] += 1
            return True
        return False

    async def refund(self, key, reservation):
        row = self.rows[key]
        if reservation in row["reservations"]:
            row["reservations"].remove(reservation)
            return True
        return False

    async def usage(self, key):
        row = self.rows.get(key, {})
        return {
            "consumed_count": row.get("consumed_count", 0),
            "reservations": list(row.get("reservations", [])),
        }


def settings(**overrides):
    values = {
        "planner_enabled": True,
        "planner_authenticated_daily_limit": 1,
        "planner_guest_trial_enabled": True,
        "planner_guest_generation_limit": 1,
        "planner_guest_ip_daily_limit": 20,
        "planner_guest_identity_ttl_days": 180,
        "planner_generation_cooldown_seconds": 0,
    }
    values.update(overrides)
    return values


def test_atomic_reservation_allows_only_one_concurrent_tab_and_consumes_once():
    repository = AtomicQuotaRepository()
    service = PlannerQuotaService(repository, Identity())

    async def scenario():
        async def reserve():
            try:
                return await service.reserve(
                    {"id": "user-1"}, None, "127.0.0.1", settings()
                )
            except PlannerError as error:
                return error

        first, second = await asyncio.gather(reserve(), reserve())
        accepted = first if isinstance(first, dict) else second
        rejected = second if isinstance(first, dict) else first
        assert rejected.status_code == 429
        await service.consume(accepted)
        await service.consume(accepted)
        row = repository.rows[accepted["key"]]
        assert row["consumed_count"] == 1
        assert row["reservations"] == []

    asyncio.run(scenario())


def test_guest_network_rejection_refunds_primary_reservation():
    repository = AtomicQuotaRepository()
    service = PlannerQuotaService(repository, Identity())

    async def scenario():
        with pytest.raises(PlannerError) as error:
            await service.reserve(
                None,
                None,
                "127.0.0.1",
                settings(planner_guest_ip_daily_limit=-1),
            )
        assert error.value.detail["code"] == "guest_network_limit_reached"
        assert repository.rows["planner-guest:hash:guest"]["reservations"] == []

    asyncio.run(scenario())


class FakeSettings:
    async def read(self):
        return settings()

    async def feature(self, name, _user, _values):
        return {
            "enabled": name == "planner_structured_results",
            "rollout_percentage": 100,
            "reason": "test",
        }


class FakeCatalog:
    async def destinations(self):
        return [
            {
                "_id": "dest-1",
                "name": "Danau Toba",
                "name_en": "Lake Toba",
                "location": "Toba",
                "category": "nature",
                "images": [],
                "is_active": True,
            }
        ]

    async def partners(self, _culinary):
        return []

    async def offerings(self, _ids):
        return []


class FakeQuota:
    def __init__(self):
        self.consumed = 0
        self.refunded = 0

    async def reserve(self, *_args):
        return {"key": "key", "reservation_id": "one", "ttl_days": 2}

    async def consume(self, _quota):
        self.consumed += 1

    async def refund(self, _quota):
        self.refunded += 1


class FakeLogs:
    def __init__(self):
        self.started = None
        self.finished = None

    async def start(self, value):
        self.started = value
        return "log-1"

    async def finish(self, _identifier, value):
        self.finished = value


class FakeSystemLogs:
    def __init__(self):
        self.errors = []

    async def failure(self, *values):
        self.errors.append(values)


class Runtime:
    def __init__(self, llm):
        self.llm = llm

    async def runtime(self):
        return self.llm, {"enabled": True, "source": "fake", "model_name": "fake"}


class TimeoutLlm:
    async def stream(self, _messages):
        if False:
            yield ""
        raise asyncio.TimeoutError("provider secret timeout")


def test_timeout_before_first_chunk_refunds_and_emits_only_safe_error():
    quota, logs, system_logs = FakeQuota(), FakeLogs(), FakeSystemLogs()
    service = PlannerGenerationService(
        FakeSettings(), quota, FakeCatalog(), Runtime(TimeoutLlm()), logs, system_logs
    )

    async def scenario():
        prepared = await service.prepare(
            TripPlanIn(days=1, budget_style="budget"),
            {"id": "user-1", "role": "user"},
            None,
            "127.0.0.1",
        )
        chunks = []
        async for chunk in encode_sse_stream(prepared.events, prepared.metrics):
            chunks.append(chunk)
        return "".join(chunks)

    output = asyncio.run(scenario())
    assert "planner_timeout" in output
    assert "provider secret timeout" not in output
    assert quota.consumed == 0 and quota.refunded == 1
    assert logs.finished["status"] == "error"
    assert logs.finished["response_payload_bytes"] == len(output.encode())


class BlockingLlm:
    def __init__(self):
        self.started = asyncio.Event()

    async def stream(self, _messages):
        self.started.set()
        await asyncio.Event().wait()
        yield "unreachable"


def test_disconnect_before_first_chunk_cancels_log_and_refunds_reservation():
    async def scenario():
        llm, quota, logs = BlockingLlm(), FakeQuota(), FakeLogs()
        service = PlannerGenerationService(
            FakeSettings(),
            quota,
            FakeCatalog(),
            Runtime(llm),
            logs,
            FakeSystemLogs(),
        )
        prepared = await service.prepare(
            TripPlanIn(days=1, budget_style="budget"),
            {"id": "user-1", "role": "user"},
            None,
            "127.0.0.1",
        )
        assert (await prepared.events.__anext__())["progress"]["phase"] == "generating"
        task = asyncio.create_task(prepared.events.__anext__())
        await llm.started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert quota.refunded == 1 and quota.consumed == 0
        assert logs.finished["status"] == "cancelled"

    asyncio.run(scenario())


def test_partner_rotation_is_deterministic_and_premium_never_boosts_relevance():
    destination = {
        "_id": "dest-1",
        "name": "Danau Toba",
        "name_en": "Lake Toba",
    }
    common = {
        "business_name": "Pemandu",
        "type": "guide",
        "whatsapp": "628123456789",
        "city": "Toba",
        "description": "Pemandu lokal",
        "service_tags": ["keluarga"],
        "status": "approved",
        "is_active": True,
        "accepting_contacts": True,
    }
    partners = {
        "dest-1": [
            {**common, "id": "regular", "is_premium": False},
            {**common, "id": "featured", "is_premium": True},
        ]
    }
    args = (
        "Danau Toba",
        [destination],
        partners,
        [],
        "pemandu keluarga",
        "id",
    )
    first = build_planner_partner_recommendations(*args, rotation_day="2026-09-10")
    second = build_planner_partner_recommendations(*args, rotation_day="2026-09-10")
    assert first == second
    assert {row["relevance_score"] for row in first[1]} == {80}
    assert {row["placement"] for row in first[1]} == {"organic", "featured"}
