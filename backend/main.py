import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Query, Request
from psycopg2 import errors as pg_errors
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import jwt, JWTError

import settings
from database import get_cursor, close_pool
from security_http import SecurityHeadersMiddleware, enforce_login_rate_limit
from schema import SCHEMA, SCHEMA_ALTER
from models import (
    LoginRequest, LoginResponse,
    UserPublicResponse,
    CreateUserRequest,
    UpdateUserRequest,
    CreateInventoryItemRequest,
    UpdateInventoryItemMetadataRequest,
    InventoryItemResponse,
    AdjustQuantityRequest,
    UpdateThresholdRequest,
    TransactionResponse,
    FeedbackCreateRequest,
    FeedbackResponse,
)

ALLOWED_ROLES = frozenset({"employee", "manager", "admin"})


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_settings()
    with get_cursor() as cur:
        cur.execute(SCHEMA)
        cur.execute(SCHEMA_ALTER)
    yield
    close_pool()


app = FastAPI(
    title="Dumont Inventory API",
    version="1.0.0",
    lifespan=lifespan,
    openapi_url=None if settings.IS_PRODUCTION else "/openapi.json",
    docs_url=None if settings.IS_PRODUCTION else "/docs",
    redoc_url=None if settings.IS_PRODUCTION else "/redoc",
)

# Bearer tokens in headers — no cookies; credentials=False avoids CORS issues with "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(SecurityHeadersMiddleware)

bearer = HTTPBearer(auto_error=True)

JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.JWT_ALGORITHM
JWT_EXPIRE_MINUTES = settings.JWT_EXPIRE_MINUTES


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    try:
        # algorithms= forces HS256 only (no "none" / unexpected alg). Reject tokens missing exp/sub.
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_aud": False},
        )
        if "exp" not in payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        raw_sub = payload.get("sub")
        user_id = str(raw_sub).strip() if raw_sub is not None else ""
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
        raise HTTPException(
            status_code=403,
            detail="Only managers and admins can perform this action",
        )
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


@app.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str, admin=Depends(require_admin)):
    admin_id = admin["id"]
    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    with get_cursor() as cur:
        cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        if row[0] == "admin":
            cur.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
            if cur.fetchone()[0] <= 1:
                raise HTTPException(status_code=400, detail="Cannot delete the last admin")

        try:
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        except pg_errors.ForeignKeyViolation:
            raise HTTPException(
                status_code=409,
                detail="This user still has linked records (e.g. feedback). Remove those first or keep the user.",
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
    sql = "SELECT id, name, category, sub_category, unit, current_quantity, offsite_quantity, low_stock_threshold, storage_location, note, updated_at FROM inventory_items WHERE 1=1"
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
        unit=r[4], current_quantity=r[5], offsite_quantity=r[6], low_stock_threshold=r[7],
        storage_location=r[8], note=r[9], updated_at=r[10],
    ) for r in rows]


@app.get("/items/{item_id}", response_model=InventoryItemResponse)
def get_item(item_id: str, user=Depends(get_current_user)):
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, name, category, sub_category, unit, current_quantity, offsite_quantity, low_stock_threshold, storage_location, note, updated_at FROM inventory_items WHERE id = %s",
            (item_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return InventoryItemResponse(
        id=row[0], name=row[1], category=row[2], sub_category=row[3],
        unit=row[4], current_quantity=row[5], offsite_quantity=row[6], low_stock_threshold=row[7],
        storage_location=row[8], note=row[9], updated_at=row[10],
    )


@app.post("/items", response_model=InventoryItemResponse)
def create_item(body: CreateInventoryItemRequest, _user=Depends(require_manager)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    cat = body.category.strip()
    if not cat:
        raise HTTPException(status_code=400, detail="Category is required")
    unit = body.unit.strip()
    if not unit:
        raise HTTPException(status_code=400, detail="Unit is required")

    new_id = f"i{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    sub = (body.sub_category or "").strip() or None
    note = (body.note or "").strip() or None
    loc = (body.storage_location or "").strip() or None

    with get_cursor() as cur:
        cur.execute(
            """INSERT INTO inventory_items
               (id, name, category, sub_category, unit, current_quantity, offsite_quantity,
                low_stock_threshold, storage_location, note, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, 0, %s, %s, %s, %s)""",
            (
                new_id,
                name,
                cat,
                sub,
                unit,
                body.current_quantity,
                body.low_stock_threshold,
                loc,
                note,
                now,
            ),
        )
        cur.execute(
            "SELECT id, name, category, sub_category, unit, current_quantity, offsite_quantity, low_stock_threshold, storage_location, note, updated_at FROM inventory_items WHERE id = %s",
            (new_id,),
        )
        row = cur.fetchone()

    return InventoryItemResponse(
        id=row[0], name=row[1], category=row[2], sub_category=row[3],
        unit=row[4], current_quantity=row[5], offsite_quantity=row[6], low_stock_threshold=row[7],
        storage_location=row[8], note=row[9], updated_at=row[10],
    )


@app.patch("/items/{item_id}", response_model=InventoryItemResponse)
def update_item_metadata(item_id: str, body: UpdateInventoryItemMetadataRequest, _user=Depends(require_manager)):
    name = body.name.strip()
    unit = body.unit.strip()
    category = body.category.strip()
    if not name or not unit or not category:
        raise HTTPException(status_code=400, detail="name, unit, and category are required")
    sub = (body.sub_category or "").strip() or None
    loc = (body.storage_location or "").strip() or None
    note = (body.note or "").strip() or None
    now = datetime.now(timezone.utc)

    with get_cursor() as cur:
        cur.execute(
            """UPDATE inventory_items
               SET name = %s, unit = %s, category = %s, sub_category = %s,
                   storage_location = %s, note = %s, updated_at = %s
               WHERE id = %s""",
            (name, unit, category, sub, loc, note, now, item_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        cur.execute(
            "SELECT id, name, category, sub_category, unit, current_quantity, offsite_quantity, low_stock_threshold, storage_location, note, updated_at FROM inventory_items WHERE id = %s",
            (item_id,),
        )
        row = cur.fetchone()

    return InventoryItemResponse(
        id=row[0], name=row[1], category=row[2], sub_category=row[3],
        unit=row[4], current_quantity=row[5], offsite_quantity=row[6], low_stock_threshold=row[7],
        storage_location=row[8], note=row[9], updated_at=row[10],
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


@app.post("/items/{item_id}/adjust-offsite", response_model=TransactionResponse)
def adjust_offsite(item_id: str, body: AdjustQuantityRequest, user=Depends(require_manager)):
    if body.action not in ("add", "subtract"):
        raise HTTPException(status_code=400, detail="action must be 'add' or 'subtract'")
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")

    tx_action = "offsite_add" if body.action == "add" else "offsite_subtract"

    with get_cursor() as cur:
        cur.execute(
            "SELECT offsite_quantity, name, unit FROM inventory_items WHERE id = %s FOR UPDATE",
            (item_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")

        offsite_qty, item_name, unit = row
        new_qty = offsite_qty + body.quantity if body.action == "add" else max(0, offsite_qty - body.quantity)
        now = datetime.now(timezone.utc)

        cur.execute(
            "UPDATE inventory_items SET offsite_quantity = %s, updated_at = %s WHERE id = %s",
            (new_qty, now, item_id),
        )

        tx_id = f"t{uuid.uuid4().hex[:12]}"
        cur.execute(
            """INSERT INTO inventory_transactions
               (id, item_id, item_name, unit, action, quantity, reason, note, employee_id, employee_name, timestamp)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (tx_id, item_id, item_name, unit, tx_action, body.quantity,
             body.reason, body.note, user["id"], user["name"], now),
        )

    return TransactionResponse(
        id=tx_id, item_id=item_id, item_name=item_name, unit=unit,
        action=tx_action, quantity=body.quantity, reason=body.reason,
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
        if action not in ALLOWED_TRANSACTION_ACTIONS:
            raise HTTPException(status_code=400, detail="Invalid action filter")
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


# ── Feedback (bugs / enhancements) ─────────────────────────────────────────────

@app.post("/employee-notes", response_model=FeedbackResponse)
@app.post("/feedback", response_model=FeedbackResponse, include_in_schema=False)
def submit_feedback(body: FeedbackCreateRequest, user=Depends(get_current_user)):
    fid = "fb" + uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc)
    with get_cursor() as cur:
        cur.execute(
            """INSERT INTO app_feedback (id, user_id, user_name, category, message, created_at)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (fid, user["id"], user["name"], body.category, body.message, now),
        )
        cur.execute(
            "SELECT id, user_id, user_name, category, message, created_at FROM app_feedback WHERE id = %s",
            (fid,),
        )
        row = cur.fetchone()

    return FeedbackResponse(
        id=row[0],
        user_id=row[1],
        user_name=row[2],
        category=row[3],
        message=row[4],
        created_at=row[5],
    )


@app.get("/employee-notes", response_model=list[FeedbackResponse])
@app.get("/feedback", response_model=list[FeedbackResponse], include_in_schema=False)
def list_feedback(
    limit: int = Query(80, le=200),
    _mgr=Depends(require_manager),
):
    with get_cursor() as cur:
        cur.execute(
            """SELECT id, user_id, user_name, category, message, created_at
               FROM app_feedback ORDER BY created_at DESC LIMIT %s""",
            (limit,),
        )
        rows = cur.fetchall()
    return [
        FeedbackResponse(
            id=r[0], user_id=r[1], user_name=r[2], category=r[3],
            message=r[4], created_at=r[5],
        )
        for r in rows
    ]


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
