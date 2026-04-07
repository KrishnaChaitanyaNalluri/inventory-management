"""DDL applied by migrate.py and on API startup (IF NOT EXISTS — safe to re-run)."""

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            VARCHAR(20)  PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150),
    phone         VARCHAR(20),
    pin_hash      VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'employee',
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id                  VARCHAR(20)  PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    category            VARCHAR(100) NOT NULL,
    sub_category        VARCHAR(100),
    unit                VARCHAR(50)  NOT NULL,
    current_quantity    INTEGER      NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER      NOT NULL DEFAULT 1,
    storage_location    VARCHAR(50),
    note                TEXT,
    updated_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id              VARCHAR(40)  PRIMARY KEY,
    item_id         VARCHAR(20)  REFERENCES inventory_items(id),
    item_name       VARCHAR(200) NOT NULL,
    unit            VARCHAR(50)  NOT NULL,
    action          VARCHAR(20)  NOT NULL,
    quantity        INTEGER      NOT NULL,
    reason          VARCHAR(50)  NOT NULL,
    note            TEXT,
    employee_id     VARCHAR(20)  REFERENCES users(id),
    employee_name   VARCHAR(100) NOT NULL,
    timestamp       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_feedback (
    id           VARCHAR(40)  PRIMARY KEY,
    user_id      VARCHAR(20)  NOT NULL REFERENCES users(id),
    user_name    VARCHAR(100) NOT NULL,
    category     VARCHAR(20)  NOT NULL,
    message      TEXT         NOT NULL,
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_category    ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_tx_item_id        ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_tx_timestamp      ON inventory_transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_created  ON app_feedback(created_at DESC);
"""

# Column added after initial deploy — run on every API boot (IF NOT EXISTS).
SCHEMA_ALTER = """
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS offsite_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
"""
