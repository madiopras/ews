"""Pure billing policies."""

import hashlib
import hmac
from datetime import datetime


def add_months(base: datetime, months: int) -> datetime:
    year = base.year + (base.month - 1 + months) // 12
    month = (base.month - 1 + months) % 12 + 1
    leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    days = [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return base.replace(year=year, month=month, day=min(base.day, days[month - 1]))


def payment_state(notification: dict) -> str:
    status = notification.get("transaction_status")
    fraud = (notification.get("fraud_status") or "").lower()
    if status in ("settlement", "capture") and (not fraud or fraud == "accept"):
        return "paid"
    if status in ("deny", "cancel", "expire", "failure"):
        return "failed"
    return "pending"


def valid_notification_signature(notification: dict, server_key: str) -> bool:
    required = ("order_id", "status_code", "gross_amount", "signature_key")
    if any(key not in notification for key in required):
        return False
    raw = f"{notification['order_id']}{notification['status_code']}{notification['gross_amount']}{server_key}"
    expected = hashlib.sha512(raw.encode("utf-8")).hexdigest()
    return hmac.compare_digest(expected, str(notification["signature_key"]))


def notification_without_secret(notification: dict) -> dict:
    return {key: value for key, value in notification.items() if key != "signature_key"}
