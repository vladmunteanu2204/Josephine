"""Security regression tests for the user-data IDOR (task #17).

These assert the *secure* behavior we want: an anonymous caller must not be able
to read another user's private data just by passing ?email=. They are currently
marked xfail because the gate isn't implemented yet — when #17 lands, they flip to
xpass and you'll know the hole is closed. They are READ-ONLY (no data is written).
"""
import pytest

VICTIM = "victim@example.com"

idor_open = pytest.mark.xfail(
    reason="task #17: GET user-data routes have no caller auth; ?email= reads anyone's data",
    strict=False,
)


@idor_open
def test_hikes_not_readable_by_email_without_auth(client):
    # An unauthenticated request for someone else's hikes should be rejected,
    # not answered. Today it returns 200 (the bug) → xfail until #17.
    r = client.get(f"/api/hikes?email={VICTIM}")
    assert r.status_code in (401, 403), \
        "anonymous caller must not read another user's hikes by email"


@idor_open
def test_saved_trails_not_readable_by_email_without_auth(client):
    r = client.get(f"/api/saved-trails?email={VICTIM}")
    assert r.status_code in (401, 403), \
        "anonymous caller must not read another user's saved trails by email"


@idor_open
def test_notification_prefs_not_readable_by_email_without_auth(client):
    r = client.get(f"/api/me/notification-prefs?email={VICTIM}")
    assert r.status_code in (401, 403), \
        "anonymous caller must not read another user's notification prefs by email"
