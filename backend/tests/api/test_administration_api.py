"""HTTP boundary coverage for the modular Phase 7 router."""

from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.administration.dependencies import (
    get_admin_user_service,
    get_dashboard_service,
    get_email_template_service,
    get_governance_service,
    get_llm_profile_service,
    get_log_service,
    get_notification_service,
    get_settings_service,
)
from app.modules.administration.router import EXCEPTION_HANDLERS, router
from app.modules.administration.schemas import AdminUserOut, AdminUserPage
from app.modules.auth.dependencies import (
    get_current_user,
    get_optional_user,
    require_admin,
)


class FakeDashboard:
    async def read(self):
        return {"users": {"total": 1}}


class FakeUsers:
    async def list(self, **_kwargs):
        return AdminUserPage(
            items=[self.user()], total=1, page=1, page_size=25, pages=1
        )

    async def update(self, _identifier, payload, _actor):
        return self.user().model_copy(
            update={
                "role": payload.role or "admin",
                "account_active": (
                    payload.account_active
                    if payload.account_active is not None
                    else True
                ),
            }
        )

    @staticmethod
    def user():
        return AdminUserOut(
            id="user-1",
            email="admin@example.com",
            name="Admin",
            role="admin",
        )


class FakeLogs:
    async def list(self, _collection, **_kwargs):
        return {"items": [], "total": 0, "page": 1, "page_size": 25, "pages": 0}


class FakeSettings:
    async def read(self):
        return {"site_name": "Explore", "support_email": "help@example.com"}

    async def update(self, payload, _actor):
        return payload.model_dump(mode="json")

    async def features(self, _user):
        return {"mitra_onboarding": {"enabled": True, "reason": "full_rollout"}}

    async def integrations(self):
        return {"database": {"configured": True, "healthy": True}}


class FakeNotifications:
    async def list_mine(self, _user):
        return [{"id": "notification-1", "kind": "notice"}]

    async def mark_read(self, _identifier, _user):
        return {"ok": True}

    async def delivery_logs(self):
        return [{"id": "delivery-1", "channel": "email"}]


class FakeTemplates:
    async def list(self, **_kwargs):
        return {"items": [], "total": 0, "page": 1, "page_size": 25, "pages": 0}

    async def get(self, identifier):
        return {"id": identifier, "key": "welcome"}

    async def create(self, payload, _actor):
        return {"id": "template-1", **payload.model_dump()}

    async def update(self, identifier, payload, _actor):
        return {"id": identifier, **payload.model_dump()}

    async def delete(self, _identifier, _actor):
        return {"ok": True}


class FakeLlm:
    async def runtime_status(self):
        return {"source": "environment", "configured": True}

    async def list(self, _query):
        return []

    async def create(self, payload, _actor):
        return {"id": "profile-1", "name": payload.name, "api_key_configured": True}

    async def get(self, identifier):
        return {"id": identifier, "name": "Profile"}

    async def update(self, identifier, payload, _actor):
        return {"id": identifier, "name": payload.name}

    async def duplicate(self, _identifier, _actor):
        return {"id": "profile-copy", "name": "Profile copy"}

    async def test(self, _identifier, _actor):
        return {"success": True}

    async def activate(self, identifier, _actor):
        return {"id": identifier, "active": True}

    async def use_environment(self, _actor):
        return {"source": "environment"}

    async def delete(self, _identifier, _actor):
        return {"ok": True}


class FakeGovernance:
    async def destination_preview(self, identifier):
        return {"id": identifier, "name": "Destination"}

    async def partner_preview(self, identifier):
        return {"id": identifier, "business_name": "Partner"}

    async def overview(self):
        return {"summary": {"quality_queue": 0}, "quality_queue": []}

    async def update_workflow(self, _identifier, payload, _actor):
        return {"ok": True, "status": payload.status}

    async def create_report(self, _payload, _ip, _user):
        return {"id": "report-1", "status": "open"}

    async def reports(self, _status):
        return []

    async def moderate(self, _identifier, payload, _actor):
        return {"ok": True, "status": payload.status, "action": payload.action}

    async def notify_partner(self, _identifier, _actor):
        return {"deliveries": [{"channel": "email", "status": "sent"}]}

    async def analytics(self, days):
        return {"days": days, "exposure": []}


def make_client():
    application = create_app(
        api_routers=(router,), exception_handlers=EXCEPTION_HANDLERS
    )
    identity = {"id": "admin", "email": "admin@example.com", "role": "admin"}
    application.dependency_overrides.update(
        {
            get_current_user: lambda: identity,
            get_optional_user: lambda: identity,
            require_admin: lambda: identity,
            get_dashboard_service: FakeDashboard,
            get_admin_user_service: FakeUsers,
            get_log_service: FakeLogs,
            get_settings_service: FakeSettings,
            get_notification_service: FakeNotifications,
            get_email_template_service: FakeTemplates,
            get_llm_profile_service: FakeLlm,
            get_governance_service: FakeGovernance,
        }
    )
    return TestClient(application)


TEMPLATE = {
    "key": "welcome",
    "name": "Welcome",
    "subject_id": "Selamat datang",
    "subject_en": "Welcome",
    "body_id": "Halo",
    "body_en": "Hello",
}


def test_admin_dashboard_users_logs_settings_and_notifications_contracts():
    with make_client() as client:
        assert client.get("/api/admin/dashboard").json()["users"]["total"] == 1
        assert client.get("/api/admin/users").json()["total"] == 1
        assert (
            client.patch("/api/admin/users/user-1", json={"role": "partner"}).json()[
                "role"
            ]
            == "partner"
        )
        for endpoint in ("audit-logs", "ai-logs", "system-logs"):
            assert client.get(f"/api/admin/{endpoint}").json()["items"] == []
        assert client.get("/api/admin/settings").status_code == 200
        assert (
            client.put(
                "/api/admin/settings",
                json={"site_name": "Explore", "support_email": "help@example.com"},
            ).status_code
            == 200
        )
        assert client.get("/api/experience/features").status_code == 200
        assert client.get("/api/admin/settings/integrations").status_code == 200
        assert client.get("/api/notifications").json()[0]["kind"] == "notice"
        assert client.patch("/api/notifications/notification-1/read").json() == {
            "ok": True
        }
        assert client.get("/api/admin/governance/notifications").status_code == 200


def test_template_llm_and_governance_routes_keep_transport_contracts():
    with make_client() as client:
        assert (
            client.post("/api/admin/email-templates", json=TEMPLATE).status_code == 201
        )
        assert client.get("/api/admin/email-templates").status_code == 200
        llm = {
            "name": "Local",
            "base_url": "http://localhost:11434/v1",
            "model_name": "model",
            "api_key": "secret",
        }
        created = client.post("/api/admin/llm-profiles", json=llm)
        assert created.status_code == 201
        assert "secret" not in created.text
        assert client.get("/api/admin/llm-profiles/runtime").status_code == 200
        assert client.post("/api/admin/llm-profiles/profile-1/test").status_code == 200
        assert client.post("/api/admin/llm-profiles/use-environment").status_code == 200

        assert client.get("/api/admin/governance/overview").status_code == 200
        assert (
            client.patch(
                "/api/admin/governance/destinations/destination-1/workflow",
                json={"status": "published", "note": "reviewed"},
            ).status_code
            == 200
        )
        report = {
            "target_type": "review",
            "target_id": "review-1",
            "reason": "incorrect",
        }
        assert client.post("/api/reports", json=report).status_code == 201
        assert (
            client.patch(
                "/api/admin/governance/reports/report-1",
                json={"status": "resolved", "action": "hide"},
            ).status_code
            == 200
        )
        preview = client.get("/api/admin/governance/role-preview/partner")
        assert preview.json()["read_only"] is True
