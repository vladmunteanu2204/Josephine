"""Pytest bootstrap for the AlpenviaMobile backend.

Importing `app` requires ADMIN_PASSWORD to be set (it raises otherwise) and works
best with a dummy ANTHROPIC_API_KEY so the Claude path stays inert during tests.
No network, no real DB — tests run against the bundled JSON data and the Flask
test client.
"""
import os
import sys

# Must be set BEFORE `import app` (app.py raises if ADMIN_PASSWORD is missing).
os.environ.setdefault("ADMIN_PASSWORD", "test_pwd")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-inert")
os.environ.setdefault("FLASK_ENV", "testing")

# backend/ on the path so `import app` works regardless of pytest's cwd.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest  # noqa: E402


@pytest.fixture(scope="session")
def flask_app():
    import app as app_module
    app_module.app.config["TESTING"] = True
    return app_module.app


@pytest.fixture
def client(flask_app):
    return flask_app.test_client()


@pytest.fixture
def admin_headers():
    """Authorization header carrying a freshly minted, valid admin JWT.

    Mints the token the same way the login route does, via the app's own helpers,
    so the test stays correct even if the signing details change.
    """
    import app as app_module
    token = None
    for name in ("_issue_admin_token", "_make_admin_token", "issue_admin_token"):
        fn = getattr(app_module, name, None)
        if callable(fn):
            try:
                token = fn()
            except TypeError:
                token = fn("test_admin")
            break
    if token is None:
        # Fallback: sign a JWT exactly like the app does (JWT_SECRET = sha256(ADMIN_PASSWORD)).
        import jwt as _jwt
        import time
        secret = getattr(app_module, "JWT_SECRET", None)
        if secret is None:
            import hashlib
            secret = hashlib.sha256(os.environ["ADMIN_PASSWORD"].encode()).hexdigest()
        token = _jwt.encode(
            {"admin": True, "exp": int(time.time()) + 3600}, secret, algorithm="HS256"
        )
    return {"Authorization": f"Bearer {token}"}
