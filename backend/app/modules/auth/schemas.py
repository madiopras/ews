"""Authentication, user profile, and account API contracts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.modules.destinations.schemas import Category


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=120)
    accepted_terms: bool = False


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    email_verified: bool = False
    auth_provider: str = "password"
    preferred_language: Literal["id", "en"] = "id"
    interests: list[str] = Field(default_factory=list)
    home_city: str = ""
    created_at: str = ""


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(..., min_length=20, max_length=4000)
    password: str = Field(..., min_length=8, max_length=128)


class VerifyEmailIn(BaseModel):
    token: str = Field(..., min_length=20, max_length=4000)


class ProfileUpdateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    preferred_language: Literal["id", "en"] = "id"
    interests: list[Category] = Field(default_factory=list, max_length=20)
    home_city: str = Field(default="", max_length=120)


class AccountDeleteIn(BaseModel):
    confirmation: str
    password: str | None = Field(default=None, max_length=128)


class GoogleCredentialIn(BaseModel):
    credential: str = Field(..., min_length=100, max_length=10000)
