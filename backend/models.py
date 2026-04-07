from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    identifier: str   # phone or email
    pin: str = Field(min_length=4, max_length=6)


class LoginResponse(BaseModel):
    token: str
    user_id: str
    name: str
    role: str


class UserPublicResponse(BaseModel):
    id: str
    name: str
    email: Optional[str]
    phone: Optional[str]
    role: str


class CreateUserRequest(BaseModel):
    name: str
    identifier: str  # phone or email (same as login)
    pin: str
    role: str


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    pin: Optional[str] = Field(None, min_length=4, max_length=6)


# ── Inventory Items ────────────────────────────────────────────────────────────

class InventoryItemResponse(BaseModel):
    id: str
    name: str
    category: str
    sub_category: Optional[str]
    unit: str
    current_quantity: int
    offsite_quantity: int
    low_stock_threshold: int
    storage_location: Optional[str]
    note: Optional[str]
    updated_at: datetime
    sort_order: int = 0


class ReorderItemsRequest(BaseModel):
    """New order for one sub-category group (same category + sub_category)."""

    item_ids: list[str] = Field(min_length=1)


class AdjustQuantityRequest(BaseModel):
    action: str           # "add" | "subtract"
    quantity: int
    reason: str
    note: Optional[str] = None


class UpdateThresholdRequest(BaseModel):
    threshold: int


class CreateInventoryItemRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    sub_category: Optional[str] = None
    unit: str = Field(min_length=1, max_length=50)
    current_quantity: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=1, ge=0)
    storage_location: Optional[str] = None
    note: Optional[str] = None


class UpdateInventoryItemMetadataRequest(BaseModel):
    """Replace catalog fields (name, unit, category, etc.) — not stock counts."""

    name: str = Field(min_length=1, max_length=200)
    unit: str = Field(min_length=1, max_length=50)
    category: str = Field(min_length=1, max_length=100)
    sub_category: Optional[str] = None
    storage_location: Optional[str] = None
    note: Optional[str] = None


# ── Transactions ───────────────────────────────────────────────────────────────

class TransactionResponse(BaseModel):
    id: str
    item_id: str
    item_name: str
    unit: str
    action: str
    quantity: int
    reason: str
    note: Optional[str]
    employee_id: str
    employee_name: str
    timestamp: datetime


# ── Feedback (bugs / enhancements) ────────────────────────────────────────────

class FeedbackCreateRequest(BaseModel):
    category: str
    message: str

    @field_validator("category")
    @classmethod
    def category_normalise(cls, v: str) -> str:
        s = v.strip().lower()
        if s not in ("bug", "enhancement"):
            raise ValueError("category must be bug or enhancement")
        return s

    @field_validator("message")
    @classmethod
    def message_ok(cls, v: str) -> str:
        s = v.strip()
        if len(s) < 5:
            raise ValueError("message must be at least 5 characters")
        if len(s) > 4000:
            raise ValueError("message is too long")
        return s


class FeedbackResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    category: str
    message: str
    created_at: datetime
