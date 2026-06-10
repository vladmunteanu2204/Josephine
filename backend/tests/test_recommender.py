"""Unit tests for recommender.py — per-user profile + scoring (pure)."""
import recommender as R

T_HARD = {
    "id": "h", "difficulty": "hard", "interests": ["alpine lakes"],
    "region": "Merano & Surroundings", "duration_hours": 6.0, "dog_friendly": True,
    "rating": 4.6, "nearby_rifugios": ["r1"], "best_season": ["July"], "status": "published",
}
T_EASY = {
    "id": "e", "difficulty": "easy", "interests": ["forests"],
    "region": "Val Gardena", "duration_hours": 2.0, "rating": 4.0, "status": "published",
}
BY_ID = {"h": T_HARD, "e": T_EASY}


# ── canon_difficulty ─────────────────────────────────────────────────────────
def test_canon_difficulty_maps_synonyms():
    assert R.canon_difficulty("easy") == "easy"
    assert R.canon_difficulty("medium") == "moderate"
    assert R.canon_difficulty("difficult") == "hard"
    assert R.canon_difficulty("schwer") == "hard"      # DE
    assert R.canon_difficulty("expert") == "expert"


def test_canon_difficulty_unknown_defaults_moderate():
    assert R.canon_difficulty(None) == "moderate"
    assert R.canon_difficulty("banana") == "moderate"


# ── build_profile ────────────────────────────────────────────────────────────
def test_empty_profile_is_cold_start():
    p = R.build_profile([], [], BY_ID)
    assert p["cold_start"] is True
    assert p["preferred_difficulty"] is None
    assert p["total_signal"] == 0


def test_completed_hard_hike_builds_strong_profile():
    hikes = [{"trail_id": "h", "stats": {"elevation_gain_m": 1200, "distance_km": 16}}]
    p = R.build_profile([], hikes, BY_ID)
    assert p["cold_start"] is False
    assert p["preferred_difficulty"] == "hard"
    assert p["fitness_level"] == "advanced"        # >=1000 m gain
    assert p["dog_affinity"] == 1.0                # the only signal trail is dog-friendly
    assert p["rifugio_affinity"] == 1.0
    assert p["completed_count"] == 1


def test_unsave_cancels_category_affinity():
    behaviour = [
        {"trail_id": "h", "action": "save"},
        {"trail_id": "h", "action": "unsave"},
    ]
    p = R.build_profile(behaviour, [], BY_ID)
    # save (+4) then unsave (-4) net the per-category weights to zero.
    assert p["difficulty_pref"].get("hard", 0) == 0
    assert p["tag_affinity"].get("alpine lakes", 0) == 0


def test_view_only_stays_cold_until_enough_views():
    p = R.build_profile([{"trail_id": "h", "action": "view"}], [], BY_ID)
    assert p["cold_start"] is True       # one curious click doesn't flip it


# ── score_trail ──────────────────────────────────────────────────────────────
def test_score_trail_rewards_matching_profile():
    hikes = [{"trail_id": "h", "stats": {"elevation_gain_m": 1200, "distance_km": 16}}]
    profile = R.build_profile([], hikes, BY_ID)
    score, reasons = R.score_trail(T_HARD, profile)
    assert score > 0
    codes = {r["code"] for r in reasons}
    assert "matchesDifficulty" in codes or "sharedInterest" in codes


def test_score_trail_reasons_are_codes_not_prose():
    profile = R.build_profile([], [{"trail_id": "h", "stats": {"distance_km": 16}}], BY_ID)
    _, reasons = R.score_trail(T_HARD, profile)
    for r in reasons:
        assert isinstance(r, dict) and "code" in r


# ── recommend ────────────────────────────────────────────────────────────────
def test_recommend_cold_start_orders_by_rating():
    cold = R.build_profile([], [], BY_ID)
    out = R.recommend([T_HARD, T_EASY], cold, limit=6)
    assert [r["trail"]["id"] for r in out] == ["h", "e"]   # 4.6 before 4.0


def test_recommend_excludes_ids():
    cold = R.build_profile([], [], BY_ID)
    out = R.recommend([T_HARD, T_EASY], cold, exclude_ids=["h"], limit=6)
    assert [r["trail"]["id"] for r in out] == ["e"]


def test_recommend_skips_unpublished():
    draft = dict(T_EASY, id="d", status="draft")
    cold = R.build_profile([], [], BY_ID)
    out = R.recommend([T_HARD, draft], cold, limit=6)
    assert "d" not in [r["trail"]["id"] for r in out]


def test_recommend_in_season_boost():
    cold = R.build_profile([], [], BY_ID)
    out = R.recommend([T_HARD], cold, season_month=7, limit=6)   # July, T_HARD's season
    assert any(rc["code"] == "inSeasonNow" for rc in out[0]["reasons"])


def test_recommend_respects_limit():
    cold = R.build_profile([], [], BY_ID)
    out = R.recommend([T_HARD, T_EASY], cold, limit=1)
    assert len(out) == 1


# ── month helpers ────────────────────────────────────────────────────────────
def test_month_num_accepts_many_forms():
    assert R._month_num("June") == 6
    assert R._month_num("jun") == 6
    assert R._month_num(6) == 6
    assert R._month_num("06") == 6
    assert R._month_num("banana") is None


def test_in_season_window():
    assert R._in_season({"best_season": ["July"]}, 7) is True
    assert R._in_season({"best_season": ["July"]}, 1) is False
    assert R._in_season({}, 7) is False     # no season = no boost
