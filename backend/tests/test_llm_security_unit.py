import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import load_settings
from app.modules.administration.exceptions import AdministrationError
from app.modules.administration.gateways import LlmProfileGateway


def test_api_key_encryption_round_trip_without_plaintext():
    secret = "unit-test-secret-value"
    gateway = LlmProfileGateway(load_settings())
    ciphertext, nonce = gateway.encrypt(secret)
    assert secret not in ciphertext
    assert secret not in nonce
    assert (
        gateway.decrypt(
            {
                "api_key_ciphertext": ciphertext,
                "api_key_nonce": nonce,
            }
        )
        == secret
    )


def test_production_ssrf_guard_rejects_private_hosts(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("LLM_ALLOW_PRIVATE_URLS", "false")
    monkeypatch.setenv("LLM_ALLOWED_HOSTS", "")
    with pytest.raises(AdministrationError) as error:
        asyncio.run(
            LlmProfileGateway(load_settings()).validate_base_url(
                "http://127.0.0.1:11434/v1"
            )
        )
    assert error.value.status_code == 400


@pytest.mark.parametrize(
    "url",
    [
        "ftp://provider.example/v1",
        "https://user:password@provider.example/v1",
        "https://provider.example/v1?api_key=secret",
        "https://provider.example/v1#fragment",
    ],
)
def test_base_url_rejects_unsafe_shapes(url):
    with pytest.raises(AdministrationError) as error:
        asyncio.run(LlmProfileGateway(load_settings()).validate_base_url(url))
    assert error.value.status_code == 400
