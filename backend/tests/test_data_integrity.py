"""Data-integrity tests over data/trails.json — the bedrock layer.

These guard against the most common real failure: an edit that silently breaks a
promise (wrong stat, swapped coordinate, leaked draft, malformed insight). They
read the bundled JSON directly — no app import, no network — so they're fast and
deterministic.
"""
import json
import os

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TRAILS_PATH = os.path.join(REPO_ROOT, "data", "trails.json")
GROUNDTRUTH_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "groundtruth.json")

ACTIVITY_TYPES = {"walk", "hike", "trekking", "via_ferrata"}
DIFFICULTIES = {"easy", "medium", "hard"}
TRAIL_TYPES = {"loop", "out_and_back", "point_to_point"}
GRADE_CAI = {"T", "E", "EE", "EEA", None}
STATUSES = {"published", "draft"}
INSIGHT_KINDS = {
    "photo_spot", "viewpoint", "tip", "food", "hazard",
    "dog_tip", "sunrise_tip", "sunset_tip",
}
MONTHS = {
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
}
LANGS = ("en", "it", "de")


def _load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def trails():
    return _load(TRAILS_PATH)["trails"]


def _ids(trails):
    return [t.get("id") for t in trails]


# ── identity & required scalar fields ───────────────────────────────────────
def test_trails_file_loads_and_nonempty(trails):
    assert isinstance(trails, list) and len(trails) > 0


def test_ids_are_unique_and_nonempty(trails):
    ids = _ids(trails)
    assert all(isinstance(i, str) and i.strip() for i in ids), "every trail needs a non-empty string id"
    dupes = [i for i in set(ids) if ids.count(i) > 1]
    assert not dupes, f"duplicate trail ids: {dupes}"


@pytest.mark.parametrize("field", [
    "name", "region", "difficulty", "activity_type", "trail_type",
    "distance_km", "duration_hours", "elevation_gain_m", "elevation_loss_m",
    "status", "description", "josephineNote",
])
def test_required_field_present_on_every_trail(trails, field):
    missing = [t.get("id") for t in trails if t.get(field) in (None, "", [], {})]
    assert not missing, f"missing/empty '{field}' on: {missing}"


# ── enums ───────────────────────────────────────────────────────────────────
def test_status_enum(trails):
    bad = [(t["id"], t.get("status")) for t in trails if t.get("status") not in STATUSES]
    assert not bad, f"bad status values: {bad}"


def test_activity_type_enum(trails):
    bad = [(t["id"], t.get("activity_type")) for t in trails if t.get("activity_type") not in ACTIVITY_TYPES]
    assert not bad, f"bad activity_type: {bad}"


def test_difficulty_enum(trails):
    bad = [(t["id"], t.get("difficulty")) for t in trails if t.get("difficulty") not in DIFFICULTIES]
    assert not bad, f"bad difficulty: {bad}"


def test_trail_type_enum(trails):
    bad = [(t["id"], t.get("trail_type")) for t in trails if t.get("trail_type") not in TRAIL_TYPES]
    assert not bad, f"bad trail_type: {bad}"


def test_grade_cai_enum(trails):
    bad = [(t["id"], t.get("grade_cai")) for t in trails if t.get("grade_cai") not in GRADE_CAI]
    assert not bad, f"bad grade_cai: {bad}"


def test_via_ferrata_has_ferrata_grade(trails):
    """If we ever add a via_ferrata trail, it must carry a ferrata_grade A–E."""
    bad = [t["id"] for t in trails
           if t.get("activity_type") == "via_ferrata"
           and str(t.get("ferrata_grade", "")).upper() not in {"A", "B", "C", "D", "E"}]
    assert not bad, f"via_ferrata trails missing valid ferrata_grade: {bad}"


# ── numeric sanity ──────────────────────────────────────────────────────────
def test_stats_are_sane_numbers(trails):
    for t in trails:
        tid = t["id"]
        assert t["distance_km"] > 0, f"{tid}: distance must be > 0"
        assert t["duration_hours"] > 0, f"{tid}: duration must be > 0"
        assert t["elevation_gain_m"] >= 0, f"{tid}: gain must be >= 0"
        assert t["elevation_loss_m"] >= 0, f"{tid}: loss must be >= 0"
        # loose upper bounds — catch unit slips / runaway computations, not real values
        assert t["distance_km"] < 100, f"{tid}: distance {t['distance_km']} km implausibly large"
        assert t["elevation_gain_m"] < 5000, f"{tid}: gain {t['elevation_gain_m']} m implausibly large"


# ── coordinates: [lon, lat], South-Tyrol bounds (catches the [lat,lon] swap) ──
def test_coordinates_shape_and_bounds(trails):
    for t in trails:
        coords = t.get("coordinates")
        assert isinstance(coords, list) and len(coords) >= 2, f"{t['id']}: needs >=2 coords"
        for pt in coords:
            assert isinstance(pt, (list, tuple)) and len(pt) == 2, f"{t['id']}: coord not a pair: {pt}"
            lon, lat = pt
            assert -180 <= lon <= 180 and -90 <= lat <= 90, f"{t['id']}: out of range {pt}"
            # Regional sanity: South Tyrol ≈ lon 10–13, lat 46–47.5. A [lat,lon] swap
            # would put lon≈46 — caught here.
            assert 9.0 <= lon <= 13.5, f"{t['id']}: lon {lon} outside South Tyrol — [lat,lon] swap?"
            assert 45.5 <= lat <= 48.0, f"{t['id']}: lat {lat} outside South Tyrol — [lat,lon] swap?"


# ── trilingual content ──────────────────────────────────────────────────────
def test_josephine_note_is_trilingual(trails):
    for t in trails:
        jn = t.get("josephineNote")
        assert isinstance(jn, dict), f"{t['id']}: josephineNote must be a dict"
        for lang in LANGS:
            assert jn.get(lang, "").strip(), f"{t['id']}: josephineNote.{lang} empty"


def test_best_season_months_valid(trails):
    for t in trails:
        season = t.get("best_season")
        assert isinstance(season, list) and season, f"{t['id']}: best_season must be a non-empty list"
        bad = [m for m in season if m not in MONTHS]
        assert not bad, f"{t['id']}: bad month names {bad}"


# ── POIs ────────────────────────────────────────────────────────────────────
def test_pois_shape(trails):
    for t in trails:
        for p in t.get("pois", []):
            assert p.get("name"), f"{t['id']}: POI missing name"
            assert p.get("type"), f"{t['id']}: POI '{p.get('name')}' missing type"
            c = p.get("coordinates")
            assert isinstance(c, (list, tuple)) and len(c) == 2, f"{t['id']}: POI '{p.get('name')}' bad coords"
            lon, lat = c
            assert 9.0 <= lon <= 13.5 and 45.5 <= lat <= 48.0, f"{t['id']}: POI '{p.get('name')}' coords look swapped: {c}"


# ── insights (optional, but if present must be well-formed + safe) ───────────
def test_insights_shape_and_hazard_safety(trails):
    for t in trails:
        for ins in t.get("insights", []):
            iid = f"{t['id']}/{ins.get('id')}"
            assert ins.get("id"), f"{t['id']}: insight missing id"
            assert ins.get("kind") in INSIGHT_KINDS, f"{iid}: bad kind {ins.get('kind')}"
            text = ins.get("text", {})
            assert isinstance(text, dict), f"{iid}: text must be a dict"
            for lang in LANGS:
                assert text.get(lang, "").strip(), f"{iid}: text.{lang} empty"
            # SAFETY: hazard insights must be verified before they can surface as fact.
            if ins.get("kind") == "hazard":
                assert (ins.get("verification") or {}).get("status") == "verified", \
                    f"{iid}: hazard insight must have verification.status == 'verified'"


# ── regression: the 21 verified stats must never drift silently ─────────────
def test_ground_truth_stats_locked(trails):
    """The would-have-caught-the-elevation-disaster test.

    Every stat is pinned to its committed value. If an edit (or a future
    'recompute') changes a number, this goes red immediately. To intentionally
    change a value, update fixtures/groundtruth.json in the same commit.
    """
    gt = _load(GROUNDTRUTH_PATH)
    by_id = {t["id"]: t for t in trails}
    drift = []
    for tid, expected in gt.items():
        t = by_id.get(tid)
        if t is None:
            drift.append(f"{tid}: MISSING from trails.json")
            continue
        for field, exp in expected.items():
            got = t.get(field)
            if got != exp:
                drift.append(f"{tid}.{field}: expected {exp}, got {got}")
    assert not drift, "stat drift detected (update groundtruth.json if intentional):\n" + "\n".join(drift)
