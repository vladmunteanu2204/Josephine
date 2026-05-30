"""
db.py — PostgreSQL connection pool and table DDL for Alpenvia.

If DATABASE_URL is set, all load_*/save_* functions in app.py use this module.
If not set, app.py falls back to JSON files (backwards-compatible).

Usage:
    from db import get_db, DB_AVAILABLE

    if DB_AVAILABLE:
        with get_db() as conn:
            rows = conn.execute("SELECT id, data FROM trails WHERE status='published'").fetchall()
"""

import os
import json
from contextlib import contextmanager

try:
    from sqlalchemy import create_engine, text, event
    from sqlalchemy.pool import QueuePool
    _SA_AVAILABLE = True
except ImportError:
    _SA_AVAILABLE = False

DATABASE_URL = os.environ.get('DATABASE_URL', '')

# SQLAlchemy uses postgresql:// but Replit/Heroku may give postgres://
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

DB_AVAILABLE = bool(DATABASE_URL and _SA_AVAILABLE)

_engine = None

if DB_AVAILABLE:
    _engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,       # detect stale connections
        pool_recycle=1800,        # recycle connections every 30 min
        connect_args={'connect_timeout': 10},
    )
    print(f"[db] PostgreSQL pool initialised ({DATABASE_URL[:30]}...)")
else:
    if DATABASE_URL and not _SA_AVAILABLE:
        print("[db] WARNING: DATABASE_URL set but SQLAlchemy not installed — falling back to JSON")
    else:
        print("[db] DATABASE_URL not set — using JSON file storage")


@contextmanager
def get_db():
    """Yield a SQLAlchemy Connection. Commits on success, rolls back on error."""
    if not DB_AVAILABLE:
        raise RuntimeError("PostgreSQL not configured")
    conn = _engine.connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── DDL ───────────────────────────────────────────────────────────────────

CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS trails (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    region          TEXT,
    difficulty      TEXT,
    distance_km     REAL,
    duration_hours  REAL,
    elevation_gain_m INTEGER,
    status          TEXT DEFAULT 'published',
    dog_friendly    BOOLEAN DEFAULT FALSE,
    family_friendly BOOLEAN DEFAULT FALSE,
    rating          REAL,
    data            JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_trails_status     ON trails(status);
CREATE INDEX IF NOT EXISTS idx_trails_difficulty ON trails(difficulty);
CREATE INDEX IF NOT EXISTS idx_trails_region     ON trails(region);

CREATE TABLE IF NOT EXISTS rifugios (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    type     TEXT,
    region   TEXT,
    altitude INTEGER,
    status   TEXT DEFAULT 'published',
    data     JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_rifugios_status ON rifugios(status);
CREATE INDEX IF NOT EXISTS idx_rifugios_region ON rifugios(region);

CREATE TABLE IF NOT EXISTS multi_day_trails (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    difficulty TEXT,
    region     TEXT,
    status     TEXT DEFAULT 'published',
    data       JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_mdt_status ON multi_day_trails(status);

CREATE TABLE IF NOT EXISTS completed_hikes (
    id         TEXT PRIMARY KEY,
    trail_id   TEXT,
    user_email TEXT,
    start_time TIMESTAMPTZ,
    data       JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_hikes_user  ON completed_hikes(user_email);
CREATE INDEX IF NOT EXISTS idx_hikes_trail ON completed_hikes(trail_id);

CREATE TABLE IF NOT EXISTS reviews (
    id         SERIAL PRIMARY KEY,
    trail_id   TEXT NOT NULL,
    user_email TEXT,
    rating     INTEGER,
    comment    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data       JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_reviews_trail ON reviews(trail_id);

CREATE TABLE IF NOT EXISTS plans (
    id         SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    trail_id   TEXT,
    plan_date  DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data       JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_email);

CREATE TABLE IF NOT EXISTS user_analytics (
    trail_id   TEXT PRIMARY KEY,
    views      INTEGER DEFAULT 0,
    saves      INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenges (
    id   TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS booking_inquiries (
    id         SERIAL PRIMARY KEY,
    rifugio_id TEXT,
    user_email TEXT,
    status     TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data       JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_bookings_rifugio ON booking_inquiries(rifugio_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user    ON booking_inquiries(user_email);
"""


def create_tables():
    """Create all tables. Safe to call multiple times (IF NOT EXISTS)."""
    if not DB_AVAILABLE:
        print("[db] Skipping table creation — no DB configured")
        return
    with get_db() as conn:
        for stmt in CREATE_TABLES_SQL.strip().split(';'):
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt + ';'))
    print("[db] Tables ready")


# ── Helper: JSONB round-trip ──────────────────────────────────────────────

def row_to_trail(row) -> dict:
    """Reconstruct a full trail dict from a DB row."""
    data = dict(row.data) if row.data else {}
    data.update({
        'id': row.id,
        'name': row.name,
        'region': row.region,
        'difficulty': row.difficulty,
        'distance_km': row.distance_km,
        'duration_hours': row.duration_hours,
        'elevation_gain_m': row.elevation_gain_m,
        'status': row.status,
        'dog_friendly': row.dog_friendly,
        'family_friendly': row.family_friendly,
        'rating': row.rating,
    })
    return data


def row_to_rifugio(row) -> dict:
    data = dict(row.data) if row.data else {}
    data.update({'id': row.id, 'name': row.name, 'type': row.type,
                 'region': row.region, 'altitude': row.altitude, 'status': row.status})
    return data


def row_to_mdt(row) -> dict:
    data = dict(row.data) if row.data else {}
    data.update({'id': row.id, 'name': row.name, 'difficulty': row.difficulty,
                 'region': row.region, 'status': row.status})
    return data
