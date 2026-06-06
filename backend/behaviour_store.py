"""
behaviour_store.py — persistence for Phase 17B personalisation.

Stores the per-user signals the recommender feeds on:
  • behaviour events  (views / saves / plans / reviews)
  • saved trails       (server mirror of the client's localStorage list)
  • notification prefs (weekly recs, weather alerts)

Mirrors the rest of the backend: **PostgreSQL when DATABASE_URL is set,
JSON files under /data as a dev fallback** — so everything works locally with
no database, exactly like completed_hikes/reviews already do.

All writes are best-effort and never raise into the request path: a failure to
record a view must never break the page the user is looking at.
"""

from __future__ import annotations

import os
import json
import time
import threading
from datetime import datetime, timezone

from db import DB_AVAILABLE, get_db

try:
    from sqlalchemy import text as _sql
except Exception:  # pragma: no cover
    _sql = None

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_DIR = os.path.join(_BASE_DIR, 'data')
_BEHAVIOUR_PATH = os.path.join(_DATA_DIR, 'user_behaviour.json')
_SAVED_PATH = os.path.join(_DATA_DIR, 'saved_trails_server.json')
_PREFS_PATH = os.path.join(_DATA_DIR, 'notification_prefs.json')

_LOCK = threading.Lock()
_MAX_JSON_EVENTS = 5000   # cap the dev JSON log so it can't grow without bound

VALID_ACTIONS = {'view', 'save', 'unsave', 'plan', 'review', 'complete'}
_DEFAULT_PREFS = {'weekly_recs': True, 'weather_alerts': True}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── tiny JSON helpers (dev fallback) ─────────────────────────────────────────
def _read_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def _write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, 'w') as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)


# ── behaviour events ─────────────────────────────────────────────────────────
def record_behaviour(user_email, trail_id, action, metadata=None) -> bool:
    """Append one behaviour signal. Returns True on success, False (no-op) when
    the inputs are unusable — never raises."""
    if not user_email or not trail_id:
        return False
    action = str(action or '').strip().lower()
    if action not in VALID_ACTIONS:
        return False
    meta = metadata if isinstance(metadata, dict) else {}

    if DB_AVAILABLE and _sql is not None:
        try:
            with get_db() as conn:
                conn.execute(_sql("""
                    INSERT INTO user_behaviour (user_email, trail_id, action, metadata, created_at)
                    VALUES (:e, :t, :a, :m::jsonb, NOW())
                """), {'e': user_email, 't': trail_id, 'a': action, 'm': json.dumps(meta)})
            return True
        except Exception as e:  # noqa: BLE001
            print(f"[behaviour] DB write fell back to JSON: {e}")

    with _LOCK:
        store = _read_json(_BEHAVIOUR_PATH, {'events': []})
        store['events'].append({
            'user_email': user_email, 'trail_id': trail_id,
            'action': action, 'metadata': meta, 'created_at': _now_iso(),
        })
        if len(store['events']) > _MAX_JSON_EVENTS:
            store['events'] = store['events'][-_MAX_JSON_EVENTS:]
        _write_json(_BEHAVIOUR_PATH, store)
    return True


def get_behaviour(user_email, limit=1000) -> list:
    """Most-recent-first behaviour events for one user."""
    if not user_email:
        return []
    if DB_AVAILABLE and _sql is not None:
        try:
            with get_db() as conn:
                rows = conn.execute(_sql("""
                    SELECT trail_id, action, metadata, created_at
                    FROM user_behaviour WHERE user_email = :e
                    ORDER BY created_at DESC LIMIT :n
                """), {'e': user_email, 'n': limit}).fetchall()
            return [{'trail_id': r.trail_id, 'action': r.action,
                     'metadata': dict(r.metadata) if r.metadata else {},
                     'created_at': r.created_at.isoformat() if r.created_at else None}
                    for r in rows]
        except Exception as e:  # noqa: BLE001
            print(f"[behaviour] DB read fell back to JSON: {e}")
    events = _read_json(_BEHAVIOUR_PATH, {'events': []}).get('events', [])
    mine = [e for e in events if e.get('user_email') == user_email]
    return list(reversed(mine))[:limit]


def users_with_behaviour() -> list:
    """Distinct user emails that have any behaviour or saved trail — the
    audience for personalised push."""
    emails = set()
    if DB_AVAILABLE and _sql is not None:
        try:
            with get_db() as conn:
                for tbl in ('user_behaviour', 'saved_trails'):
                    rows = conn.execute(_sql(
                        f"SELECT DISTINCT user_email FROM {tbl}")).fetchall()
                    emails.update(r.user_email for r in rows if r.user_email)
            return sorted(emails)
        except Exception as e:  # noqa: BLE001
            print(f"[behaviour] users_with_behaviour fell back to JSON: {e}")
    for e in _read_json(_BEHAVIOUR_PATH, {'events': []}).get('events', []):
        if e.get('user_email'):
            emails.add(e['user_email'])
    for em in _read_json(_SAVED_PATH, {'saved': {}}).get('saved', {}):
        emails.add(em)
    return sorted(emails)


# ── saved trails (server mirror) ─────────────────────────────────────────────
def set_saved(user_email, trail_id, saved: bool) -> bool:
    if not user_email or not trail_id:
        return False
    if DB_AVAILABLE and _sql is not None:
        try:
            with get_db() as conn:
                if saved:
                    conn.execute(_sql("""
                        INSERT INTO saved_trails (user_email, trail_id, saved_at)
                        VALUES (:e, :t, NOW())
                        ON CONFLICT (user_email, trail_id) DO NOTHING
                    """), {'e': user_email, 't': trail_id})
                else:
                    conn.execute(_sql(
                        "DELETE FROM saved_trails WHERE user_email=:e AND trail_id=:t"),
                        {'e': user_email, 't': trail_id})
            return True
        except Exception as e:  # noqa: BLE001
            print(f"[saved] DB write fell back to JSON: {e}")
    with _LOCK:
        store = _read_json(_SAVED_PATH, {'saved': {}})
        ids = set(store['saved'].get(user_email, []))
        ids.add(trail_id) if saved else ids.discard(trail_id)
        store['saved'][user_email] = sorted(ids)
        _write_json(_SAVED_PATH, store)
    return True


def get_saved(user_email) -> list:
    if not user_email:
        return []
    if DB_AVAILABLE and _sql is not None:
        try:
            with get_db() as conn:
                rows = conn.execute(_sql(
                    "SELECT trail_id FROM saved_trails WHERE user_email=:e ORDER BY saved_at DESC"),
                    {'e': user_email}).fetchall()
            return [r.trail_id for r in rows]
        except Exception as e:  # noqa: BLE001
            print(f"[saved] DB read fell back to JSON: {e}")
    return list(_read_json(_SAVED_PATH, {'saved': {}}).get('saved', {}).get(user_email, []))


# ── notification preferences ─────────────────────────────────────────────────
def get_notification_prefs(user_email) -> dict:
    prefs = dict(_DEFAULT_PREFS)
    if not user_email:
        return prefs
    if DB_AVAILABLE and _sql is not None:
        try:
            with get_db() as conn:
                row = conn.execute(_sql(
                    "SELECT data FROM notification_prefs WHERE user_email=:e"),
                    {'e': user_email}).fetchone()
            if row and row.data:
                prefs.update(dict(row.data))
            return prefs
        except Exception as e:  # noqa: BLE001
            print(f"[prefs] DB read fell back to JSON: {e}")
    stored = _read_json(_PREFS_PATH, {}).get(user_email)
    if isinstance(stored, dict):
        prefs.update(stored)
    return prefs


def set_notification_prefs(user_email, prefs: dict) -> dict:
    if not user_email:
        return dict(_DEFAULT_PREFS)
    clean = {k: bool(v) for k, v in (prefs or {}).items() if k in _DEFAULT_PREFS}
    merged = {**_DEFAULT_PREFS, **clean}
    if DB_AVAILABLE and _sql is not None:
        try:
            with get_db() as conn:
                conn.execute(_sql("""
                    INSERT INTO notification_prefs (user_email, data, updated_at)
                    VALUES (:e, :d::jsonb, NOW())
                    ON CONFLICT (user_email) DO UPDATE
                        SET data = EXCLUDED.data, updated_at = NOW()
                """), {'e': user_email, 'd': json.dumps(merged)})
            return merged
        except Exception as e:  # noqa: BLE001
            print(f"[prefs] DB write fell back to JSON: {e}")
    with _LOCK:
        store = _read_json(_PREFS_PATH, {})
        store[user_email] = merged
        _write_json(_PREFS_PATH, store)
    return merged
