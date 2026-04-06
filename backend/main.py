import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import jwt, JWTError

import settings
from database import get_cursor, close_pool
from models import (
    LoginRequest, LoginResponse,
    UserPublicResponse,
    CreateUserRequest,
    UpdateUserRequest,
    InventoryItemResponse,
    AdjustQuantityRequest,
    UpdateThresholdRequest,
    TransactionResponse,
)

ALLOWED_ROLES = frozenset({"employee", "manager", "admin"})


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_settings()
    yield
    close_pool()


app = FastAPI(title="Dumont Inventory API", version="1.0.0", lifespan=lifespan)

# Bearer tokens in headers — no cookies; credentials=False avoids CORS issues with "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

bearer = HTTPBearer()

JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.JWT_ALGORITHM
JWT_EXPIRE_MINUTES = settings.JWT_EXPIRE_MINUTES


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    with get_cursor() as cur:
        cur.execute("SELECT id, name, role FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    return {"id": row[0], "name": row[1], "role": row[2]}


def require_manager(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Only managers can change alert thresholds")
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage users")
    return user


def split_login_identifier(identifier: str) -> tuple[Optional[str], Optional[str]]:
    """Return (email, phone) — exactly one set, for storage."""
    s = identifier.strip()
    if not s:
        raise HTTPException(status_code=400, detail="identifier is required")
    if "@" in s:
        return (s, None)
    return (None, s)


# ── Auth ───────────────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest):
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, name, role, pin_hash FROM users WHERE phone = %s OR email = %s",
            (body.identifier, body.identifier),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    stored = row[3]
    if stored is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    hash_bytes = stored.encode("utf-8") if isinstance(stored, str) else stored
    if not bcrypt.checkpw(body.pin.encode("utf-8"), hash_bytes):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return LoginResponse(
        token=create_token(row[0]),
        user_id=row[0],
        name=row[1],
        role=row[2],
    )


# ── Users (admin) ─────────────────────────────────────────────────────────────

@app.get("/users", response_model=list[UserPublicResponse])
def list_users(_admin=Depends(require_admin)):
    with get_cursor() as cur:
        cur.execute("SELECT id, name, email, phone, role FROM users ORDER BY name")
        rows = cur.fetchall()
    return [
        UserPublicResponse(id=r[0], name=r[1], email=r[2], phone=r[3], role=r[4])
        for r in rows
    ]


@app.post("/users", response_model=UserPublicResponse)
def create_user(body: CreateUserRequest, _admin=Depends(require_admin)):
    if body.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if len(body.pin) < 4:
        raise HTTPException(status_code=400, detail="PIN must be at least 4 characters")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    email, phone = split_login_identifier(body.identifier)

    with get_cursor() as cur:
        cur.execute(
            "SELECT id FROM users WHERE phone = %s OR email = %s",
            (body.identifier.strip(), body.identifier.strip()),
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="A user with this phone or email already exists")

        new_id = "u" + uuid.uuid4().hex[:10]
        pin_hash = bcrypt.hashpw(body.pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cur.execute(
            """INSERT INTO users (id, name, email, phone, pin_hash, role)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (new_id, name, email, phone, pin_hash, body.role),
        )
        cur.execute(
            "SELECT id, name, email, phone, role FROM users WHERE id = %s",
            (new_id,),
        )
        row = cur.fetchone()

    return UserPublicResponse(
        id=row[0], name=row[1], email=row[2], phone=row[3], role=row[4],
    )


@app.patch("/users/{user_id}", response_model=UserPublicResponse)
def update_user(user_id: str, body: UpdateUserRequest, admin=Depends(require_admin)):
    admin_id = admin["id"]

    if body.role is not None and body.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    if body.pin is not None and len(body.pin) < 4:
        raise HTTPException(status_code=400, detail="PIN must be at least 4 characters")

    with get_cursor() as cur:
        cur.execute(
            "SELECT id, name, email, phone, role FROM users WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        old_role = row[4]
        if user_id == admin_id and body.role is not None and body.role != old_role:
            raise HTTPException(status_code=400, detail="You cannot change your own role")
        if (
            body.role is not None
            and body.role != old_role
            and old_role == "admin"
        ):
            cur.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
            if cur.fetchone()[0] <= 1:
                raise HTTPException(status_code=400, detail="Cannot remove the last admin")

        new_name = body.name.strip() if body.name is not None else row[1]
        if body.name is not None and not new_name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        new_role = body.role if body.role is not None else old_role

        if body.pin is not None:
            pin_hash = bcrypt.hashpw(body.pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            cur.execute(
                "UPDATE users SET name = %s, role = %s, pin_hash = %s WHERE id = %s",
                (new_name, new_role, pin_hash, user_id),
            )
        else:
            cur.execute(
                "UPDATE users SET name = %s, role = %s WHERE id = %s",
                (new_name, new_role, user_id),
            )

        cur.execute(
            "SELECT id, name, email, phone, role FROM users WHERE id = %s",
            (user_id,),
        )
        out = cur.fetchone()

    return UserPublicResponse(
        id=out[0], name=out[1], email=out[2], phone=out[3], role=out[4],
    )


# ── Items ──────────────────────────────────────────────────────────────────────

@app.get("/items", response_model=list[InventoryItemResponse])
def list_items(
    category: Optional[str] = Query(None),
    sub_category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    low_stock: Optional[bool] = Query(None),
    user=Depends(get_current_user),
):
    sql = "SELECT id, name, category, sub_category, unit, current_quantity, low_stock_threshold, storage_location, note, updated_at FROM inventory_items WHERE 1=1"
    params: list = []

    if category:
        sql += " AND category = %s"
        params.append(category)
    if sub_category:
        sql += " AND sub_category = %s"
        params.append(sub_category)
    if search:
        sql += " AND (name ILIKE %s OR category ILIKE %s)"
        params += [f"%{search}%", f"%{search}%"]
    if low_stock:
        sql += " AND current_quantity <= low_stock_threshold"

    sql += " ORDER BY category, sub_category NULLS FIRST, name"

    with get_cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    return [InventoryItemResponse(
        id=r[0], name=r[1], category=r[2], sub_category=r[3],
        unit=r[4], current_quantity=r[5], low_stock_threshold=r[6],
        storage_location=r[7], note=r[8], updated_at=r[9],
    ) for r in rows]


@app.get("/items/{item_id}", response_model=InventoryItemResponse)
def get_item(item_id: str, user=Depends(get_current_user)):
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, name, category, sub_category, unit, current_quantity, low_stock_threshold, storage_location, note, updated_at FROM inventory_items WHERE id = %s",
            (item_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return InventoryItemResponse(
        id=row[0], name=row[1], category=row[2], sub_category=row[3],
        unit=row[4], current_quantity=row[5], low_stock_threshold=row[6],
        storage_location=row[7], note=row[8], updated_at=row[9],
    )


@app.post("/items/{item_id}/adjust", response_model=TransactionResponse)
def adjust_item(item_id: str, body: AdjustQuantityRequest, user=Depends(get_current_user)):
    if body.action not in ("add", "subtract"):
        raise HTTPException(status_code=400, detail="action must be 'add' or 'subtract'")
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")

    with get_cursor() as cur:
        cur.execute(
            "SELECT current_quantity, name, unit FROM inventory_items WHERE id = %s FOR UPDATE",
            (item_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")

        current_qty, item_name, unit = row
        new_qty = current_qty + body.quantity if body.action == "add" else max(0, current_qty - body.quantity)
        now = datetime.now(timezone.utc)

        cur.execute(
            "UPDATE inventory_items SET current_quantity = %s, updated_at = %s WHERE id = %s",
            (new_qty, now, item_id),
        )

        tx_id = f"t{uuid.uuid4().hex[:12]}"
        cur.execute(
            """INSERT INTO inventory_transactions
               (id, item_id, item_name, unit, action, quantity, reason, note, employee_id, employee_name, timestamp)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (tx_id, item_id, item_name, unit, body.action, body.quantity,
             body.reason, body.note, user["id"], user["name"], now),
        )

    return TransactionResponse(
        id=tx_id, item_id=item_id, item_name=item_name, unit=unit,
        action=body.action, quantity=body.quantity, reason=body.reason,
        note=body.note, employee_id=user["id"], employee_name=user["name"],
        timestamp=now,
    )


@app.patch("/items/{item_id}/threshold")
def update_threshold(item_id: str, body: UpdateThresholdRequest, user=Depends(require_manager)):
    if body.threshold < 0:
        raise HTTPException(status_code=400, detail="threshold must be >= 0")
    with get_cursor() as cur:
        cur.execute(
            "SELECT low_stock_threshold, name, unit FROM inventory_items WHERE id = %s FOR UPDATE",
            (item_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")
        old_threshold, item_name, unit = row
        if old_threshold == body.threshold:
            return {"ok": True}

        cur.execute(
            "UPDATE inventory_items SET low_stock_threshold = %s WHERE id = %s",
            (body.threshold, item_id),
        )
        now = datetime.now(timezone.utc)
        tx_id = f"t{uuid.uuid4().hex[:12]}"
        cur.execute(
            """INSERT INTO inventory_transactions
               (id, item_id, item_name, unit, action, quantity, reason, note, employee_id, employee_name, timestamp)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                tx_id,
                item_id,
                item_name,
                unit,
                "set_threshold",
                body.threshold,
                "threshold_change",
                f"Previous alert level was {old_threshold}",
                user["id"],
                user["name"],
                now,
            ),
        )
    return {"ok": True}


# ── Transactions ───────────────────────────────────────────────────────────────

@app.get("/transactions", response_model=list[TransactionResponse])
def list_transactions(
    item_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    user=Depends(get_current_user),
):
    sql = "SELECT id, item_id, item_name, unit, action, quantity, reason, note, employee_id, employee_name, timestamp FROM inventory_transactions WHERE 1=1"
    params: list = []

    if item_id:
        sql += " AND item_id = %s"
        params.append(item_id)
    if action:
        sql += " AND action = %s"
        params.append(action)

    sql += " ORDER BY timestamp DESC LIMIT %s"
    params.append(limit)

    with get_cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    return [TransactionResponse(
        id=r[0], item_id=r[1], item_name=r[2], unit=r[3], action=r[4],
        quantity=r[5], reason=r[6], note=r[7], employee_id=r[8],
        employee_name=r[9], timestamp=r[10],
    ) for r in rows]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready():
    """For load balancers: confirms database connectivity."""
    try:
        with get_cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    except Exception:
        raise HTTPException(status_code=503, detail="database unavailable")
    return {"status": "ok", "database": True}
