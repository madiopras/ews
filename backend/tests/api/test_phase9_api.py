"""HTTP wiring tests for Phase 9 without MongoDB or external providers."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.backups.dependencies import get_backup_service
from app.modules.backups.router import EXCEPTION_HANDLERS as BACKUP_HANDLERS
from app.modules.backups.router import router as backup_router
from app.modules.billing.dependencies import get_payment_service, get_plan_service
from app.modules.billing.router import EXCEPTION_HANDLERS as BILLING_HANDLERS
from app.modules.billing.router import router as billing_router
from app.modules.billing.schemas import PlanOut
from app.modules.media.dependencies import get_media_service
from app.modules.media.router import EXCEPTION_HANDLERS as MEDIA_HANDLERS
from app.modules.media.router import router as media_router
from app.modules.sharing.dependencies import get_sharing_service
from app.modules.sharing.router import EXCEPTION_HANDLERS as SHARING_HANDLERS
from app.modules.sharing.router import router as sharing_router


class Plans:
    async def public(self):
        return [
            PlanOut(
                id="p1", code="1m", label_id="Satu", label_en="One", months=1, price=1
            )
        ]


class Payments:
    def public_config(self):
        return {
            "client_key": "client",
            "snap_js": "https://snap",
            "is_production": False,
        }

    async def notification(self, body):
        return {"ok": body["order_id"] == "o1"}

    async def history(self, partner_id, user):
        return {"premium_active": False, "premium_until": None, "orders": []}


class Media:
    async def upload(self, filename, data, admin):
        return {
            "path": f"app/uploads/{admin['id']}/{filename}",
            "url": f"/api/files/app/uploads/{admin['id']}/{filename}",
        }

    async def read_public(self, path):
        return b"image", "image/png"


class Sharing:
    async def image(self, slug):
        return b"png"

    async def preview(self, slug, headers):
        return f"<title>{slug}</title>", 200


class Backups:
    async def status(self):
        return {
            "directory_ready": True,
            "format": "mongodb-extended-json-lines-v1",
            "latest": None,
        }

    async def create(self, admin):
        return {
            "id": "job",
            "status": "pending",
            "created_by_email": admin["email"],
        }, "job"

    async def run(self, job_id):
        self.ran = job_id


def client() -> TestClient:
    app = FastAPI()
    for router in (backup_router, billing_router, media_router, sharing_router):
        app.include_router(router)
    for error, handler in {
        **BACKUP_HANDLERS,
        **BILLING_HANDLERS,
        **MEDIA_HANDLERS,
        **SHARING_HANDLERS,
    }.items():
        app.add_exception_handler(error, handler)
    actor = {"id": "admin", "email": "admin@example.com", "role": "admin"}
    app.dependency_overrides[get_current_user] = lambda: actor
    app.dependency_overrides[require_admin] = lambda: actor
    app.dependency_overrides[get_plan_service] = Plans
    app.dependency_overrides[get_payment_service] = Payments
    app.dependency_overrides[get_media_service] = Media
    app.dependency_overrides[get_sharing_service] = Sharing
    app.dependency_overrides[get_backup_service] = Backups
    return TestClient(app)


def test_phase9_read_and_callback_routes_use_injected_services():
    with client() as http:
        assert http.get("/api/premium/plans").json()[0]["code"] == "1m"
        assert http.get("/api/payments/config").json()["client_key"] == "client"
        assert http.post(
            "/api/payments/midtrans/notification", json={"order_id": "o1"}
        ).json() == {"ok": True}
        assert http.get("/api/mitra/partners/p1/payments").status_code == 200
        assert http.get("/api/admin/backups/status").json()["directory_ready"] is True


def test_phase9_media_share_and_background_backup_transport():
    with client() as http:
        upload = http.post(
            "/api/upload", files={"file": ("photo.png", b"png", "image/png")}
        )
        assert upload.status_code == 200 and upload.json()["path"].endswith("photo.png")
        assert http.get("/api/files/app/uploads/admin/photo.png").content == b"image"
        assert (
            http.get("/api/share/trip/image.png").headers["content-type"] == "image/png"
        )
        assert "trip" in http.get("/api/share/trip").text
        assert http.post("/api/admin/backups").status_code == 202
