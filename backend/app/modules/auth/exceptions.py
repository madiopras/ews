"""Typed errors raised by authentication application services."""


class AuthError(Exception):
    """An expected authentication failure with a stable HTTP representation."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class DuplicateEmailError(Exception):
    """Persistence rejected a user because the email is already registered."""


class GoogleCredentialInvalid(Exception):
    """Google verified the request as an invalid end-user credential."""
