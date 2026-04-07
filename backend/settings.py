"""
Centralized config and startup validation for production safety.
"""
import os
import sys

from dotenv import load_dotenv

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256").strip()
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "600"))

# Comma-separated list, e.g. https://app.example.com,https://www.example.com
_raw_cors = os.getenv("CORS_ORIGINS", "").strip()
if _raw_cors:
    CORS_ORIGINS = [o.strip() for o in _raw_cors.split(",") if o.strip()]
else:
    # Sensible local defaults (Vite / alternate dev ports)
    CORS_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]


# Login throttling (sliding window). Enabled automatically in production unless opted out.
_LOGIN_RATE_RAW = os.getenv("LOGIN_RATE_ENABLED", "").strip().lower()
if _LOGIN_RATE_RAW in ("0", "false", "no", "off"):
    LOGIN_RATE_ENABLED = False
elif _LOGIN_RATE_RAW in ("1", "true", "yes", "on"):
    LOGIN_RATE_ENABLED = True
else:
    LOGIN_RATE_ENABLED = IS_PRODUCTION

LOGIN_RATE_PER_ID_MAX = max(3, min(500, int(os.getenv("LOGIN_RATE_PER_ID_MAX", "12"))))
LOGIN_RATE_PER_ID_WINDOW_SEC = max(60, min(86400, int(os.getenv("LOGIN_RATE_PER_ID_WINDOW_SEC", "900"))))
LOGIN_RATE_PER_IP_MAX = max(5, min(2000, int(os.getenv("LOGIN_RATE_PER_IP_MAX", "45"))))
LOGIN_RATE_PER_IP_WINDOW_SEC = max(60, min(86400, int(os.getenv("LOGIN_RATE_PER_IP_WINDOW_SEC", "300"))))


_FORBIDDEN_JWT_SECRETS = frozenset(
    {
        "change-me",
        "change-this-to-a-long-random-secret",
        "secret",
        "jwt-secret",
    }
)


def validate_settings() -> None:
    """Exit on misconfiguration in production; warn in development (except JWT, always required)."""
    if not JWT_SECRET:
        print("[FATAL] JWT_SECRET is not set. Add it to .env (min 24 chars). Example: openssl rand -base64 32", file=sys.stderr)
        sys.exit(1)
    if JWT_SECRET in _FORBIDDEN_JWT_SECRETS:
        print("[FATAL] JWT_SECRET is a known weak placeholder. Use a long random value (e.g. openssl rand -base64 32).", file=sys.stderr)
        sys.exit(1)

    errors: list[str] = []

    if not DATABASE_URL:
        errors.append("DATABASE_URL is not set")

    if len(JWT_SECRET) < 24:
        errors.append("JWT_SECRET should be at least 24 characters")

    if IS_PRODUCTION:
        if not _raw_cors:
            errors.append("CORS_ORIGINS must be set in production (comma-separated frontend URLs)")
        if errors:
            for e in errors:
                print(f"[FATAL] {e}", file=sys.stderr)
            sys.exit(1)
    else:
        for e in errors:
            print(f"[WARN] {e}", file=sys.stderr)
