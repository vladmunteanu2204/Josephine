"""Unit tests for dispersal.py — crowd/temporal engine (pure, deterministic).

`now`/`sunset` are passed explicitly, so no clock mocking is needed.
"""
from datetime import datetime

import dispersal

HOTSPOT = {
    "id": "seceda", "name": "Seceda",
    "match": {"trail_ids": ["seceda-loop"], "name_keywords": ["seceda"], "radius_km": 3},
    "coordinates": {"lat": 46.60, "lng": 11.77},
    "peak": {"months": ["July", "August"], "hours": [9, 16], "weekend_multiplier": 1.5},
    "access_note": {"en": "busy", "it": "affollato", "de": "voll"},
}

# Tuesday + Saturday in peak month (July 2025): 1st = Tue, 5th = Sat.
TUE_EARLY = datetime(2025, 7, 1, 7, 0)    # before peak hours
TUE_PEAK = datetime(2025, 7, 1, 11, 0)    # within peak hours
TUE_LATE = datetime(2025, 7, 1, 15, 0)    # late in the day (>= end-2)
SAT_PEAK = datetime(2025, 7, 5, 11, 0)    # weekend, peak hours


# ── haversine + coord extraction ────────────────────────────────────────────
def test_haversine_one_degree_lon():
    assert dispersal._haversine_km(0, 0, 0, 1) == __import__("pytest").approx(111.19, abs=0.5)


def test_haversine_same_point_is_zero():
    assert dispersal._haversine_km(46.6, 11.7, 46.6, 11.7) == 0


def test_trail_first_coord_reads_lon_lat():
    trail = {"coordinates": [[11.16, 46.67], [11.17, 46.68]]}
    assert dispersal._trail_first_coord(trail) == (46.67, 11.16)  # returns (lat, lon)


def test_trail_first_coord_none_when_missing():
    assert dispersal._trail_first_coord({}) is None


# ── match_hotspot priority: id > keyword > radius ───────────────────────────
def test_match_by_explicit_id():
    assert dispersal.match_hotspot({"id": "seceda-loop"}, [HOTSPOT]) is HOTSPOT


def test_match_by_keyword():
    t = {"id": "x", "name": "Seceda panorama loop", "region": "Val Gardena"}
    assert dispersal.match_hotspot(t, [HOTSPOT]) is HOTSPOT


def test_match_by_radius():
    near = {"id": "x", "name": "unnamed", "coordinates": [[11.771, 46.601]]}
    assert dispersal.match_hotspot(near, [HOTSPOT]) is HOTSPOT


def test_no_match_returns_none():
    far = {"id": "x", "name": "somewhere else", "coordinates": [[12.5, 46.9]]}
    assert dispersal.match_hotspot(far, [HOTSPOT]) is None


# ── crowd_pressure ──────────────────────────────────────────────────────────
def test_pressure_base_levels_off_peak():
    # Off-peak hour so the hour multiplier (0.4) applies; just assert ordering.
    low = dispersal.crowd_pressure({"crowding": {"level": "low"}}, None, TUE_EARLY)
    high = dispersal.crowd_pressure({"crowding": {"level": "high"}}, None, TUE_EARLY)
    assert 0 <= low < high <= 1


def test_pressure_hotspot_at_peak_is_high():
    p = dispersal.crowd_pressure({"crowding": {"level": "medium"}}, HOTSPOT, TUE_PEAK)
    assert p >= 0.6


def test_pressure_clamped_to_one():
    p = dispersal.crowd_pressure(
        {"crowding": {"level": "high"}}, HOTSPOT, SAT_PEAK, weather={"description": "clear sky"}
    )
    assert p == 1.0


def test_pressure_lower_off_peak_month():
    jan = datetime(2025, 1, 7, 11, 0)
    peak = dispersal.crowd_pressure({"crowding": {"level": "medium"}}, HOTSPOT, TUE_PEAK)
    off = dispersal.crowd_pressure({"crowding": {"level": "medium"}}, HOTSPOT, jan)
    assert off < peak


# ── decide ──────────────────────────────────────────────────────────────────
def test_decide_non_hotspot_is_none():
    d = dispersal.decide({"id": "x"}, None, TUE_PEAK)
    assert d["is_hotspot"] is False and d["reason_code"] == "none"


def test_decide_beat_crowds_before_peak_hours():
    d = dispersal.decide({"id": "seceda-loop"}, HOTSPOT, TUE_EARLY)
    assert d["reason_code"] == "beat_crowds"


def test_decide_peak_today_during_peak():
    d = dispersal.decide({"id": "seceda-loop", "crowding": {"level": "high"}}, HOTSPOT, TUE_PEAK)
    assert d["reason_code"] == "peak_today"
    assert d["peak_now"] is True


def test_decide_plan_tomorrow_late_in_day():
    d = dispersal.decide({"id": "seceda-loop"}, HOTSPOT, TUE_LATE)
    assert d["reason_code"] == "plan_tomorrow"
    assert d["suggest_tomorrow"] is True


def test_decide_daylight_risk_overrides():
    # Long hike late vs an early sunset → won't finish before dusk.
    d = dispersal.decide(
        {"id": "seceda-loop"}, HOTSPOT, TUE_PEAK,
        sunset="2025-07-01T14:00:00", duration_h=6, travel_min=30,
    )
    assert d["reason_code"] == "daylight_risk"
    assert d["daylight_ok"] is False


def test_decide_attaches_access_note_when_acting():
    d = dispersal.decide({"id": "seceda-loop"}, HOTSPOT, TUE_LATE)
    assert d["access_note"] == HOTSPOT["access_note"]
