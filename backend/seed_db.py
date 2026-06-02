#!/usr/bin/env python3
"""
seed_db.py — One-time (idempotent) importer that pushes the bundled JSON
catalog into PostgreSQL.

WHY THIS EXISTS
---------------
In production the app reads trails / rifugios / multi-day routes from
PostgreSQL (when DATABASE_URL is set). A freshly provisioned database has the
tables but no rows, so the catalog and recommend endpoints fall back to the
bundled JSON. This script seeds the database from those same JSON files so the
catalog actually lives in Postgres — the JSON then becomes a pure safety-net.

It is SAFE TO RUN MULTIPLE TIMES: every write is an UPSERT (INSERT ... ON
CONFLICT DO UPDATE), so re-running re-syncs the DB to the current JSON without
creating duplicates. Run it once after first deploy, and again whenever you
edit the JSON catalog and want the DB to match.

USAGE
-----
    # DATABASE_URL must be set in the environment (Replit injects it for you).
    python seed_db.py            # seed everything
    python seed_db.py --verify   # only print current DB counts, write nothing

Importing app.py also runs db.create_tables(), so the tables are guaranteed to
exist before we write.
"""

import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TRAILS_JSON    = os.path.join(BASE_DIR, 'data', 'trails.json')
RIFUGIOS_JSON  = os.path.join(BASE_DIR, 'backend', 'data', 'rifugios.json')
MULTIDAY_JSON  = os.path.join(BASE_DIR, 'backend', 'data', 'multi_day_trails.json')


def _read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _count(table):
    """Return row count for a table, or None if the query fails."""
    from db import get_db
    from sqlalchemy import text
    try:
        with get_db() as conn:
            return conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
    except Exception as e:
        print(f"  ! could not count {table}: {e}")
        return None


def verify():
    """Print current DB row counts without writing anything."""
    print("Current PostgreSQL row counts:")
    for table in ('trails', 'rifugios', 'multi_day_trails'):
        print(f"  {table:<18} {_count(table)}")


def seed():
    # Import lazily so that a missing DATABASE_URL produces a clear message
    # before SQLAlchemy or app import side-effects run.
    import app  # noqa: F401  (importing runs create_tables() when DB is available)
    from db import DB_AVAILABLE
    from app import save_trail, save_rifugios, save_multi_day_trails

    if not DB_AVAILABLE:
        print(
            "ERROR: DATABASE_URL is not set (or SQLAlchemy isn't installed), so "
            "there is no database to seed.\n"
            "       Set DATABASE_URL and re-run. In JSON-only mode no seeding "
            "is needed — the app reads the JSON files directly."
        )
        sys.exit(1)

    # ── Trails ────────────────────────────────────────────────────────────
    trails = _read_json(TRAILS_JSON).get('trails', [])
    print(f"Seeding {len(trails)} trails from {TRAILS_JSON} ...")
    ok = fail = 0
    for t in trails:
        try:
            if save_trail(t):
                ok += 1
            else:
                fail += 1
                print(f"  ! trail not written to DB: {t.get('id')} ({t.get('name')})")
        except Exception as e:
            fail += 1
            print(f"  ! error on trail {t.get('id')}: {e}")
    print(f"  trails: {ok} upserted, {fail} failed")

    # ── Rifugios (JSON is a bare list) ───────────────────────────────────
    rifugios = _read_json(RIFUGIOS_JSON)
    if isinstance(rifugios, dict):
        rifugios = rifugios.get('rifugios', [])
    print(f"Seeding {len(rifugios)} rifugios from {RIFUGIOS_JSON} ...")
    save_rifugios(rifugios)   # upserts each internally
    print(f"  rifugios: {len(rifugios)} sent")

    # ── Multi-day trails ─────────────────────────────────────────────────
    mdt = _read_json(MULTIDAY_JSON)
    mdt_list = mdt.get('trails', []) if isinstance(mdt, dict) else mdt
    print(f"Seeding {len(mdt_list)} multi-day trails from {MULTIDAY_JSON} ...")
    save_multi_day_trails({'trails': mdt_list})
    print(f"  multi-day trails: {len(mdt_list)} sent")

    print("\nDone. Verifying DB row counts:")
    verify()


if __name__ == '__main__':
    if '--verify' in sys.argv:
        # Verify needs the DB connection but not the full app import side-effects;
        # importing db is enough.
        import db  # noqa: F401
        if not db.DB_AVAILABLE:
            print("DATABASE_URL not set — nothing to verify (JSON-only mode).")
            sys.exit(0)
        verify()
    else:
        seed()
