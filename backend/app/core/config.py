"""Typed application settings loaded from the backend environment."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Validated runtime configuration.

    Feature credentials remain optional at application boot and are validated
    only when their feature is enabled or requested.
    """

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    mongo_url: str
    db_name: str
    jwt_secret: SecretStr

    environment: Literal["development", "test", "staging", "production"] = "development"
    app_name: str | None = None
    cors_origins: str = "*"
    cookie_secure: bool = False
    public_app_url: str | None = None
    backup_dir: Path = BACKEND_DIR / "backups"

    admin_email: str = "admin@wisatasumut.id"
    admin_password: SecretStr = SecretStr("admin123")

    google_oauth_enabled: bool = False
    google_client_id: str = ""
    google_client_secret: SecretStr = SecretStr("")

    use_llm: bool = True
    llm_base_url: str = "http://localhost:20128/v1"
    llm_api_key: SecretStr = SecretStr("")
    llm_model_name: str = "dios-chat"
    llm_profile_encryption_key: SecretStr | None = None
    llm_allow_private_urls: bool | None = None
    llm_allowed_hosts: str = ""

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_starttls: bool = True
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_from: str = "noreply@wisatasumut.id"
    sms_webhook_url: str = ""
    sms_webhook_token: SecretStr = SecretStr("")

    integration_proxy_url: str = ""
    emergent_llm_key: SecretStr = SecretStr("")
    storage_dir: Path = BACKEND_DIR / "storage"

    midtrans_env: Literal["sandbox", "production"] = "sandbox"
    midtrans_merchant_id: str = ""
    midtrans_client_key: str = ""
    midtrans_server_key: SecretStr = SecretStr("")
    midtrans_merchant_id_production: str = ""
    midtrans_client_key_production: str = ""
    midtrans_server_key_production: SecretStr = SecretStr("")

    redis_url: SecretStr = SecretStr("")

    @model_validator(mode="after")
    def validate_enabled_features(self) -> "Settings":
        if self.google_oauth_enabled and not self.google_client_id.strip():
            raise ValueError(
                "GOOGLE_CLIENT_ID is required when Google OAuth is enabled"
            )
        if self.use_llm and (
            not self.llm_base_url.strip() or not self.llm_model_name.strip()
        ):
            raise ValueError(
                "LLM_BASE_URL and LLM_MODEL_NAME are required when LLM is enabled"
            )
        if self.smtp_username and not self.smtp_password.get_secret_value():
            raise ValueError(
                "SMTP_PASSWORD is required when SMTP_USERNAME is configured"
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]

    @property
    def llm_allowed_host_set(self) -> set[str]:
        return {
            host.strip().lower()
            for host in self.llm_allowed_hosts.split(",")
            if host.strip()
        }

    @property
    def allow_private_llm_urls(self) -> bool:
        if self.llm_allow_private_urls is not None:
            return self.llm_allow_private_urls
        return self.environment != "production"

    @property
    def site_name(self) -> str:
        return self.app_name or "Explore Wisata Sumut"

    @property
    def storage_app_name(self) -> str:
        return self.app_name or "explore-sumut"

    def midtrans_credentials(self) -> tuple[str, str, str]:
        if self.midtrans_env == "production":
            credentials = (
                self.midtrans_merchant_id_production,
                self.midtrans_client_key_production,
                self.midtrans_server_key_production.get_secret_value(),
            )
        else:
            credentials = (
                self.midtrans_merchant_id,
                self.midtrans_client_key,
                self.midtrans_server_key.get_secret_value(),
            )
        if not all(credentials):
            raise RuntimeError(
                f"Midtrans credentials are incomplete for {self.midtrans_env}"
            )
        return credentials


def load_settings() -> Settings:
    """Load a fresh snapshot from environment and the backend `.env` file."""

    return Settings()  # type: ignore[call-arg]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached process settings; clear the cache explicitly in tests."""

    return load_settings()
