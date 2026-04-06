from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    identifier: str   # phone or email
    pin: str


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
    pin: Optional[str] = None


# ── Inventory Items ────────────────────────────────────────────────────────────

class InventoryItemResponse(BaseModel):
    id: str
    name: str
    category: str
    sub_category: Optional[str]
    unit: str
    current_quantity: int
    low_stock_threshold: int
    storage_location: Optional[str]
    note: Optional[str]
    updated_at: datetime


class AdjustQuantityRequest(BaseModel):
    action: str           # "add" | "subtract"
    quantity: int
    reason: str
    note: Optional[str] = None


class UpdateThresholdRequest(BaseModel):
    threshold: int


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
