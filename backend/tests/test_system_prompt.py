"""Tests for the Josephine system-prompt builder (_build_system_prompt).

Guards: the KEEP_TRAIL whitelist actually filters (no field leaks unintentionally),
the prompt builds from real data without error, stays within a sane size, and
never embeds known user identities.
"""
import pytest


def _rebuild(app):
    # Bust the 5-minute cache so each test sees a fresh build.
    app._system_prompt_cache["built_at"] = 0
    return app._build_system_prompt()


def _min_trail(**extra):
    base = {
        "id": "sentineltrailx", "name": "SentinelTrailX", "region": "Merano & Surroundings",
        "difficulty": "easy", "activity_type": "walk", "trail_type": "loop",
        "distance_km": 5.0, "duration_hours": 2.0, "elevation_gain_m": 100,
        "elevation_loss_m": 100, "status": "published",
        "description": "KEEPMEYYYY", "josephineNote": {"en": "x", "it": "x", "de": "x"},
        "best_season": ["May", "Oct"], "coordinates": [[11.16, 46.67], [11.17, 46.68]],
        "pois": [], "highlights": [], "tags": [], "interests": [],
    }
    base.update(extra)
    return base


def test_prompt_builds_from_real_data(client):
    import app
    p = _rebuild(app)
    assert isinstance(p, str) and len(p) > 500


def test_keep_trail_filters_non_whitelisted_field(monkeypatch):
    import app
    trail = _min_trail(secret_field="SHOULDNOTAPPEARZZZ")
    monkeypatch.setattr(app, "load_complete_trails", lambda: {"trails": [trail]})
    p = _rebuild(app)
    assert "SentinelTrailX" in p           # whitelisted 'name' is present
    assert "KEEPMEYYYY" in p               # whitelisted 'description' is present
    assert "SHOULDNOTAPPEARZZZ" not in p   # non-whitelisted field is filtered out


def test_prompt_within_size_ceiling(monkeypatch):
    import app
    # With the real catalogue, the prompt must stay well under Claude's context.
    p = _rebuild(app)
    # ~4 chars/token; 180k-token ceiling ≈ 720k chars. Generous sanity bound.
    assert len(p) < 720_000, f"system prompt is {len(p)} chars — too large"


def test_prompt_has_no_known_user_identities(monkeypatch):
    import app
    p = _rebuild(app).lower()
    for email in ("vladmunteanu2204@gmail.com", "mariaioana2204@gmail.com"):
        assert email not in p, "a user identity leaked into the system prompt"
