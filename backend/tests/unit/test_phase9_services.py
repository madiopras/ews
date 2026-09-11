"""Unit coverage for Phase 9 business and I/O boundaries."""

import asyncio
import hashlib
import threading
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.modules.backups.service import BackupService
from app.modules.billing.domain import (
    add_months,
    notification_without_secret,
    valid_notification_signature,
)
from app.modules.billing.exceptions import BillingError
from app.modules.billing.service import PaymentService
from app.modules.media.domain import image_type, safe_object_key
from app.modules.media.exceptions import MediaError
from app.modules.media.service import MediaService
from app.modules.sharing.service import SharingService, request_base_url


class Audit:
    def __init__(self):
        self.events = []

    async def audit(self, *values):
        self.events.append(values)

    async def system(self, *values):
        self.events.append(values)


def test_payment_signature_redaction_and_calendar_math():
    body = {"order_id": "ORDER-1", "status_code": "200", "gross_amount": "99000.00"}
    body["signature_key"] = hashlib.sha512(b"ORDER-120099000.00secret").hexdigest()
    assert valid_notification_signature(body, "secret") is True
    assert (
        valid_notification_signature({**body, "signature_key": "bad"}, "secret")
        is False
    )
    assert "signature_key" not in notification_without_secret(body)
    assert add_months(datetime(2024, 1, 31, tzinfo=timezone.utc), 1).day == 29


class PaymentRepo:
    def __init__(self):
        self.order_row = {
            "order_id": "ORDER-1",
            "partner_id": "p1",
            "months": 1,
            "status": "pending",
        }
        self.partner_row = {"_id": "p1"}
        self.claimed = False
        self.saved_provider = None

    async def order(self, order_id, partner_id=None):
        return self.order_row if order_id == "ORDER-1" else None

    async def record_result(self, _order_id, status, provider, _now):
        self.order_row["status"], self.saved_provider = status, provider

    async def claim_activation(self, _order_id, _now):
        if self.claimed:
            return False
        self.claimed = True
        return True

    async def partner(self, _partner_id):
        return self.partner_row

    async def set_premium_until(self, _partner_id, value):
        self.partner_row["premium_until"] = value


class Gateway:
    config = SimpleNamespace(
        server_key="secret", client_key="client", snap_js="snap", is_production=False
    )


def test_duplicate_payment_notification_activates_only_once_and_never_persists_signature():
    async def scenario():
        repo = PaymentRepo()
        service = PaymentService(None, repo, Gateway())
        body = {
            "order_id": "ORDER-1",
            "transaction_status": "settlement",
            "fraud_status": "accept",
            "signature_key": "must-not-persist",
        }
        await service.apply(body)
        first = repo.partner_row["premium_until"]
        await service.apply(body)
        assert repo.partner_row["premium_until"] == first
        assert "signature_key" not in repo.saved_provider

    asyncio.run(scenario())


def test_non_object_payment_notification_is_rejected():
    service = PaymentService(None, PaymentRepo(), Gateway())
    with pytest.raises(BillingError, match="Invalid notification"):
        asyncio.run(service.notification(None))


def test_media_rejects_traversal_extension_spoofing_and_oversize_payloads():
    with pytest.raises(MediaError):
        safe_object_key("../secret")
    with pytest.raises(MediaError):
        safe_object_key("safe\\..\\secret")
    with pytest.raises(MediaError):
        image_type("photo.png", b"not a png")
    assert image_type("photo.png", b"\x89PNG\r\n\x1a\nrest") == ("png", "image/png")

    service = MediaService(None, None, None, "app")
    with pytest.raises(MediaError, match="Max file size"):
        asyncio.run(
            service.upload("large.png", b"x" * (service.MAX_SIZE + 1), {"id": "admin"})
        )


class ShareRepo:
    async def public_itinerary(self, _slug):
        return {
            "title": "<Unsafe>",
            "days": 2,
            "lang": "id",
            "budget_style": "mid_range",
            "author_name": "Owner",
        }


def test_share_preview_escapes_html_and_sanitizes_forwarded_host():
    service = SharingService(ShareRepo(), None)
    page, status = asyncio.run(
        service.preview("slug", {"host": 'evil.example" onload="x'})
    )
    assert (
        status == 200
        and "&lt;Unsafe&gt;" in page
        and "https://localhost/trip/slug" in page
    )
    assert (
        request_base_url({"x-forwarded-proto": "javascript", "host": "safe.example"})
        == "https://safe.example"
    )


class BackupRepo:
    def __init__(self):
        self.row = {"_id": "job", "filename": "safe.gz"}
        self.changes = []

    async def get_by_oid(self, _job):
        return self.row

    async def set(self, _job, changes):
        self.changes.append(changes)

    async def retention_days(self):
        return 30

    async def expired(self, _cutoff):
        return []


class BackupFiles:
    def __init__(self):
        self.thread = None

    def write(self, _filename):
        self.thread = threading.get_ident()
        return {"size_bytes": 1, "document_count": 1, "collection_count": 1}


def test_backup_writer_runs_off_event_loop_thread():
    async def scenario():
        files, repository, audit = BackupFiles(), BackupRepo(), Audit()
        event_thread = threading.get_ident()
        await BackupService(repository, files, audit).run("job")
        assert files.thread != event_thread
        assert repository.changes[-1]["status"] == "completed"

    asyncio.run(scenario())
