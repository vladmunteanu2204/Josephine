"""Admin authentication & authorization tests.

Covers: login success/failure, that protected routes require a valid JWT,
expired-token rejection, and the per-IP brute-force lockout. The lockout test
clears the shared attempt bucket before and after so it can't poison other tests.
"""
import time

import pytest

ADMIN_PWD = "test_pwd"  # set by conftest via ADMIN_PASSWORD


@pytest.fixture(autouse=True)
def _clear_lockout():
    """Keep the per-IP failed-attempt bucket clean around every test."""
    import app
    with app._failed_lock:
        app._failed_attempts.clear()
    yield
    with app._failed_lock:
        app._failed_attempts.clear()


def _login(client, password):
    return client.post("/api/admin/login", json={"password": password})


# ── login ─────────────────────────────────────────────────────────────────────
def test_login_wrong_password_401(client):
    r = _login(client, "definitely-wrong")
    assert r.status_code == 401


def test_login_correct_password_returns_token(client):
    r = _login(client, ADMIN_PWD)
    assert r.status_code == 200
    body = r.get_json()
    assert body.get("token") and body.get("expires_in")


# ── protected routes ───────────────────────────────────────────────────────────
def test_protected_route_requires_auth(client):
    # Creating a trail must be rejected without a token.
    r = client.post("/api/admin/trails", json={"id": "x", "name": "x"})
    assert r.status_code == 401


def test_protected_route_accepts_valid_token(client):
    token = _login(client, ADMIN_PWD).get_json()["token"]
    # A protected admin GET should pass auth (200), not 401.
    r = client.get("/api/admin/knowledge-gaps", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code != 401, "valid admin token was rejected"


def test_expired_jwt_rejected(client):
    import app
    import jwt
    from datetime import datetime, timedelta
    expired = jwt.encode(
        {"sub": "admin", "exp": datetime.utcnow() - timedelta(hours=1)},
        app.JWT_SECRET, algorithm=app.JWT_ALGORITHM,
    )
    r = client.post("/api/admin/trails", json={"id": "x"},
                    headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401, "expired token must be rejected"


def test_garbage_token_rejected(client):
    r = client.post("/api/admin/trails", json={"id": "x"},
                    headers={"Authorization": "Bearer not-a-real-jwt"})
    assert r.status_code == 401


# ── brute-force lockout ────────────────────────────────────────────────────────
def test_lockout_after_max_failed_attempts(client):
    import app
    # MAX_FAILED wrong attempts, then the next is locked out (429), not 401.
    for _ in range(app.MAX_FAILED):
        assert _login(client, "wrong").status_code == 401
    r = _login(client, "wrong")
    assert r.status_code == 429, "should be locked out after MAX_FAILED attempts"
    # Even the correct password is refused while locked.
    assert _login(client, ADMIN_PWD).status_code == 429
