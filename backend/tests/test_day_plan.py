"""Unit tests for day_plan.build_day_plan — realism + honesty + daylight.

Pure: drive-time function and huts are injected, so no network/app.
"""
import day_plan as DP

# A short loop near Merano with one viewpoint POI. ~5 km, 1.5 h, 300 m.
TRAIL = {
    "id": "demo", "name": "Demo Loop", "trail_type": "loop",
    "duration_hours": 1.5, "elevation_gain_m": 300,
    "coordinates": [[11.16, 46.67], [11.17, 46.68], [11.18, 46.69], [11.17, 46.68], [11.16, 46.67]],
    "pois": [{"name": "Sunny Ledge", "type": "viewpoint", "coordinates": [11.18, 46.69]}],
}
MERANO = (46.6713, 11.1597)

# injected drive function: 24 minutes, real routing
def drive_24(origin, dest):
    return (24, "mapbox")


def _minutes(plan, kind):
    return [s["minutes"] for s in plan["steps"] if s["kind"] == kind]


def _labels(plan):
    return [s.get("label") for s in plan["steps"]]


# ── clock math ───────────────────────────────────────────────────────────────
def test_departure_drives_then_hikes_in_order():
    plan = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                             get_drive_min=drive_24)
    mins = [s["minutes"] for s in plan["steps"]]
    assert mins == sorted(mins), "timeline must be chronological"
    assert plan["steps"][0]["kind"] == "depart"
    assert plan["steps"][0]["time"] == "8:00"


def test_arrival_is_departure_plus_drive_plus_buffer():
    plan = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                             get_drive_min=drive_24)
    start = next(s for s in plan["steps"] if s["kind"] == "hike_start")
    # 8:00 + 24 drive + 10 park = 8:34
    assert start["time"] == "8:34"


def test_pace_scaling_shifts_finish_later_when_relaxed():
    avg = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                            get_drive_min=drive_24, pace="average")
    slow = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                             get_drive_min=drive_24, pace="relaxed")
    f_avg = _minutes(avg, "finish")[0]
    f_slow = _minutes(slow, "finish")[0]
    assert f_slow > f_avg


def test_no_origin_starts_at_trailhead_no_drive():
    plan = DP.build_day_plan(TRAIL, departure="9:00", sunset="21:00")
    assert plan["drive_min"] == 0
    assert all(s["kind"] != "depart" for s in plan["steps"])
    assert plan["steps"][0]["kind"] == "hike_start"


# ── drive basis ──────────────────────────────────────────────────────────────
def test_no_routing_token_falls_back_to_estimate():
    bolzano = (46.4983, 11.3548)   # ~30 km from the trailhead
    plan = DP.build_day_plan(TRAIL, departure="8:00", origin=bolzano, sunset="21:00",
                             get_drive_min=lambda o, d: None)   # simulates no token
    assert plan["drive_basis"] == "estimate"
    assert plan["drive_min"] > 0    # haversine/38kmh over a real distance


def test_mapbox_basis_when_routing_succeeds():
    plan = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                             get_drive_min=drive_24)
    assert plan["drive_basis"] == "mapbox"
    assert plan["drive_min"] == 24


# ── daylight validation ──────────────────────────────────────────────────────
def test_daylight_ok_with_early_start_long_day():
    plan = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                             get_drive_min=drive_24)
    assert plan["daylight_ok"] is True
    assert "finish_after_dark" not in plan["warnings"]


def test_daylight_risk_flagged_when_finish_after_dusk():
    long_trail = dict(TRAIL, duration_hours=8.0, elevation_gain_m=1500)
    plan = DP.build_day_plan(long_trail, departure="15:00", origin=MERANO, sunset="18:00",
                             get_drive_min=drive_24)
    assert plan["daylight_ok"] is False
    assert "finish_after_dark" in plan["warnings"]


# ── honesty ──────────────────────────────────────────────────────────────────
def test_no_hut_means_generic_unnamed_lunch():
    plan = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                             get_drive_min=drive_24, want_lunch=True, huts=[])
    lunch = next(s for s in plan["steps"] if s["kind"] == "lunch")
    assert lunch["place"] is None          # never invents a place name
    assert lunch["verified"] is False


def test_verified_hut_is_named_for_lunch():
    hut = {"name": "Rifugio Demo", "lat": 46.69, "lon": 11.18, "open_now": True}
    plan = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                             get_drive_min=drive_24, want_lunch=True, huts=[hut])
    lunch = next(s for s in plan["steps"] if s["kind"] == "lunch")
    assert lunch["place"] == "Rifugio Demo"
    assert lunch["verified"] is True


def test_closed_hut_not_used_for_lunch():
    closed = {"name": "Closed Hut", "lat": 46.69, "lon": 11.18, "open_now": False}
    plan = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                             get_drive_min=drive_24, want_lunch=True, huts=[closed])
    lunch = next(s for s in plan["steps"] if s["kind"] == "lunch")
    assert lunch["place"] is None          # known-closed hut is not named

def test_want_lunch_false_has_no_lunch_step():
    plan = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                             get_drive_min=drive_24, want_lunch=False)
    assert all(s["kind"] != "lunch" for s in plan["steps"])


def test_real_poi_is_named_and_placed():
    plan = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                             get_drive_min=drive_24, want_lunch=False)
    assert "Sunny Ledge" in _labels(plan)


# ── robustness ───────────────────────────────────────────────────────────────
def test_handles_trail_without_geometry():
    bare = {"id": "x", "name": "No Geo", "duration_hours": 2.0}
    plan = DP.build_day_plan(bare, departure="8:00", sunset="20:00")
    assert plan["steps"][0]["kind"] == "hike_start"
    assert any(s["kind"] == "finish" for s in plan["steps"])


def test_point_to_point_arrives_at_destination_eats_there_no_drive_back():
    one_way = {
        "id": "p2p", "name": "Village A to Village B", "trail_type": "point_to_point",
        "duration_hours": 4.0, "elevation_gain_m": 500,
        "coordinates": [[11.10, 46.60], [11.15, 46.63], [11.20, 46.66]],
        "pois": [],
    }
    plan = DP.build_day_plan(
        one_way, departure="9:00", origin=MERANO, sunset="21:00",
        get_drive_min=drive_24, want_lunch=True, huts=[],
        reverse_place=lambda lat, lon: "Schenna",
    )
    finish = next(s for s in plan["steps"] if s["kind"] == "finish")
    assert "Schenna" in finish["label"]                     # arrive IN the destination
    lunch = next(s for s in plan["steps"] if s["kind"] == "lunch")
    assert lunch["place"] == "Schenna"                      # you eat in the destination village
    assert all(s["kind"] != "drive_back" for s in plan["steps"])  # no fabricated drive home
    assert "one_way_return" in plan["warnings"]


def test_loop_still_returns_to_trailhead():
    plan = DP.build_day_plan(TRAIL, departure="8:00", origin=MERANO, sunset="21:00",
                             get_drive_min=drive_24, reverse_place=lambda a, b: "Nowhere")
    finish = next(s for s in plan["steps"] if s["kind"] == "finish")
    assert finish["label"] == "Back at the trailhead"       # loop unaffected by reverse_place


def test_bad_departure_defaults_to_eight():
    plan = DP.build_day_plan(TRAIL, departure="garbage", sunset="21:00")
    assert plan["departure"] == "8:00"
