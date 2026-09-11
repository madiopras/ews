"""Typed errors for billing use cases."""

from typing import Any


class BillingError(Exception):
    def __init__(self, status_code: int, detail: Any):
        self.status_code = status_code
        self.detail = detail
        super().__init__(str(detail))
