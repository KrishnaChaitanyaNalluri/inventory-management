import bcrypt
from dotenv import load_dotenv
load_dotenv()

from database import get_cursor

# ── New staff user ─────────────────────────────────────────────────────────────
NAME  = "Test Staff"
PHONE = "0000"
PIN   = "0000"
ROLE  = "staff"
# ───────────────────────────────────────────────────────────────────────────────

pin_hash = bcrypt.hashpw(PIN.encode(), bcrypt.gensalt()).decode()

with get_cursor() as cur:
    # Pick next available short ID
    cur.execute("SELECT id FROM users ORDER BY id")
    existing_ids = [r[0] for r in cur.fetchall()]
    new_id = "u%d" % (len(existing_ids) + 1)
    # Make sure it's unique
    while new_id in existing_ids:
        new_id = new_id + "x"

    # Remove any existing user with same phone first
    cur.execute("DELETE FROM users WHERE phone = %s", (PHONE,))
    cur.execute(
        "INSERT INTO users (id, name, phone, role, pin_hash) VALUES (%s, %s, %s, %s, %s)",
        (new_id, NAME, PHONE, ROLE, pin_hash)
    )

print("Staff user created!")
print("  Name  : %s" % NAME)
print("  Phone : %s" % PHONE)
print("  PIN   : %s" % PIN)
print("  Role  : %s" % ROLE)
