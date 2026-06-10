"""Unit tests for decision_engine.py pure helpers:
season classification, verification state (incl. stale downgrade), localization.
"""
import decision_engine as DE


# ── _season_status ───────────────────────────────────────────────────────────
def test_season_in():
    assert DE._season_status("July", ["June", "July", "August"]) == "in"


def test_season_shoulder_adjacent():
    # October is one month after a Jun–Sep season → shoulder (no penalty).
    assert DE._season_status("October", ["June", "July", "August", "September"]) == "shoulder"


def test_season_out():
    assert DE._season_status("January", ["July"]) == "out"


def test_season_dec_jan_wrap_is_shoulder():
    assert DE._season_status("January", ["December"]) == "shoulder"


def test_season_empty_is_in():
    assert DE._season_status("January", []) == "in"


def test_season_range_label():
    assert DE._season_range_label(["June", "July", "August"]) == "June–August"
    assert DE._season_range_label([]) == ""


# ── verification_state ───────────────────────────────────────────────────────
def test_verification_defaults_unverified():
    assert DE.verification_state({}) == "unverified"
    assert DE.verification_state(None) == "unverified"


def test_verification_editorial_and_verified():
    assert DE.verification_state({"verification": {"status": "editorial"}}) == "editorial"
    assert DE.verification_state({"verification": {"status": "verified"}}) == "verified"


def test_verification_unknown_status_is_unverified():
    assert DE.verification_state({"verification": {"status": "banana"}}) == "unverified"


def test_verified_downgrades_to_stale_when_old():
    rec = {"verification": {"status": "verified",
                            "last_verified_at": "2020-01-01", "stale_after_days": 30}}
    assert DE.verification_state(rec) == "stale"


def test_verified_stays_verified_when_no_staleness_config():
    rec = {"verification": {"status": "verified"}}
    assert DE.verification_state(rec) == "verified"


# ── _loc ─────────────────────────────────────────────────────────────────────
def test_loc_picks_language_with_fallback():
    val = {"en": "hello", "it": "ciao", "de": "hallo"}
    assert DE._loc(val, "it") == "ciao"
    assert DE._loc(val, "de") == "hallo"
    assert DE._loc(val, "fr") == "hello"      # falls back to en


def test_loc_passthrough_string_and_none():
    assert DE._loc("plain", "en") == "plain"
    assert DE._loc(None, "en") == ""


# ── can_state_fact (verified-only) ───────────────────────────────────────────
def test_can_state_fact_only_when_verified():
    assert DE.can_state_fact({"verification": {"status": "verified"}}) is True
    assert DE.can_state_fact({"verification": {"status": "editorial"}}) is False
