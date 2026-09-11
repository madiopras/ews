"""Typed application errors for administration use cases."""

from typing import Any


class AdministrationError(Exception):
    def __init__(self, status_code: int, detail: Any):
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail
