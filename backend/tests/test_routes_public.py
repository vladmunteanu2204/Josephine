"""Public HTTP route tests via the Flask test client.

No network, no real Anthropic/DB. The draft-visibility tests monkeypatch the
trail loader so we can assert gating without mutating data/trails.json (which
currently holds only published trails).
"""
import pytest


def _synthetic_trail(tid, status):
    return {
        "id": tid, "name": f"Test {tid}", "region": "Merano & Surroundings",
        "difficulty": "easy", "activity_type": "walk", "trail_type": "loop",
        "grade_cai": "T", "distance_km": 5.0, "duration_hours": 2.0,
        "elevation_gain_m": 100, "elevation_loss_m": 100, "status": status,
        "dog_friendly": True, "family_friendly": True,
        "best_season": ["May", "Oct"], "description": "x",
        "josephineNote": {"en": "x", "it": "x", "de": "x"},
        "coordinates": [[11.16, 46.67], [11.17, 46.68]],
        "pois": [], "highlights": [], "tags": [], "interests": [],
    }


@pytest.fixture
def patched_trails(monkeypatch):
    """Make the trail store return one published + one draft trail."""
    import app
    data = {"trails": [
        _synthetic_trail("pub-1", "published"),
        _synthetic_trail("draft-1", "draft"),
    ]}
    monkeypatch.setattr(app, "load_complete_trails", lambda: {"trails": list(data["trails"])})
    return data


# ── health ───────────────────────────────────────────────────────────────────
def test_health_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.get_json().get("ok") is True


# ── catalog list ──────────────────────────────────────────────────────────────
def test_trails_list_returns_published(client):
    r = client.get("/api/trails")
    assert r.status_code == 200
    body = r.get_json()
    assert "trails" in body and isinstance(body["trails"], list)
    assert all(t.get("status", "published") == "published" for t in body["trails"]), \
        "public catalog must contain only published trails"


def test_drafts_never_appear_in_public_catalog(client, patched_trails):
    r = client.get("/api/trails")
    assert r.status_code == 200
    ids = [t["id"] for t in r.get_json()["trails"]]
    assert "pub-1" in ids, "published trail should be listed"
    assert "draft-1" not in ids, "DRAFT LEAKED into the public catalog"


# ── single trail ──────────────────────────────────────────────────────────────
def test_published_single_trail_visible(client, patched_trails):
    r = client.get("/api/trails/pub-1")
    assert r.status_code == 200
    assert r.get_json().get("id") == "pub-1"


def test_draft_single_trail_hidden_without_admin(client, patched_trails):
    r = client.get("/api/trails/draft-1")
    assert r.status_code in (403, 404), "draft must be hidden from anonymous callers"


def test_draft_not_unlocked_by_admin_flag_without_jwt(client, patched_trails):
    # ?_admin=1 alone (no valid JWT) must NOT reveal a draft.
    r = client.get("/api/trails/draft-1?_admin=1")
    assert r.status_code in (403, 404), "?_admin=1 without a valid JWT must not reveal drafts"


def test_unknown_trail_404(client):
    r = client.get("/api/trails/this-id-does-not-exist-xyz")
    assert r.status_code == 404
