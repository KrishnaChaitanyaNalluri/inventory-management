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


def validate_settings() -> None:
    """Exit on misconfiguration in production; warn in development."""
    errors: list[str] = []

    if not DATABASE_URL:
        errors.append("DATABASE_URL is not set")

    if not JWT_SECRET:
        errors.append("JWT_SECRET is not set")
    elif JWT_SECRET in ("change-me", "change-this-to-a-long-random-secret"):
        errors.append("JWT_SECRET must be changed from the example value")
    elif len(JWT_SECRET) < 24:
        errors.append("JWT_SECRET should be at least 24 characters in production")

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
