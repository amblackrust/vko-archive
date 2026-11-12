"""Contracts of the visitor cabinet (T5.18). There are no requests, orders, payments or
statuses of applications here: only the visitor's own favorites, selections, search history
and subscriptions."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.security import PASSWORD_MAX_LENGTH

FavoriteType = Literal["document", "exhibition", "news"]
Topic = Literal["news", "exhibitions"]
Lang = Literal["kk", "ru", "en"]


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    display_name: str = Field(default="", max_length=100)
    lang: Lang = "ru"  # language of the confirmation mail


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)  # Google ID token (JWT)


class GoogleConfig(BaseModel):
    client_id: str | None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    lang: Lang = "ru"  # language of the mail


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class EmailConfirm(BaseModel):
    token: str = Field(min_length=1, max_length=200)


class EmailResend(BaseModel):
    lang: Lang = "ru"


class Accepted(BaseModel):
    status: Literal["accepted"] = "accepted"


class VisitorMe(BaseModel):
    id: uuid.UUID
    email: str
    email_confirmed: bool
    display_name: str
    csrf_token: str  # echo in X-CSRF-Token on POST/PUT/DELETE


class FavoriteRef(BaseModel):
    type: FavoriteType
    id: uuid.UUID


class FavoriteItem(FavoriteRef):
    title: str
    href: str
    is_demo: bool


class FavoriteStatus(BaseModel):
    favorite: bool


class SelectionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class SelectionItemAdd(BaseModel):
    document_id: uuid.UUID


class SelectionDocument(BaseModel):
    id: uuid.UUID
    title: str
    href: str
    archive_code: str | None


class Selection(BaseModel):
    id: uuid.UUID
    title: str
    documents: list[SelectionDocument]


class SearchEntry(BaseModel):
    id: uuid.UUID
    query: str
    href: str  # /search?q=...


class SearchCreate(BaseModel):
    query: str = Field(min_length=1, max_length=200)


class Subscriptions(BaseModel):
    topics: list[Topic]
    demo_notice: bool = True  # nothing is sent yet: no mail integration
