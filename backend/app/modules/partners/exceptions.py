"""Typed Partner/Mitra application errors."""

from typing import Any


class PartnerError(Exception):
    def __init__(self, status_code: int, detail: Any):
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail
