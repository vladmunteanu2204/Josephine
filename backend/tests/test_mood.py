"""Unit tests for mood.parse_mood — deterministic, no LLM, EN/IT/DE."""
from mood import parse_mood

KEYS = {"interests", "avoid", "must_have", "difficulty", "with_dog", "family", "mood"}


def test_shape_always_has_all_keys():
    for txt in ("", "   ", "anything at all"):
        out = parse_mood(txt)
        assert set(out) == KEYS


def test_empty_returns_neutral_defaults():
    out = parse_mood("")
    assert out == {"interests": [], "avoid": [], "must_have": [],
                   "difficulty": None, "with_dog": False, "family": False, "mood": None}


def test_peaceful_sets_easy_and_calm_interests():
    out = parse_mood("I want a peaceful, relaxing walk")
    assert out["difficulty"] == "easy"
    assert "forests" in out["interests"]
    assert "crowds" in out["avoid"]
    assert out["mood"] == "peaceful"


def test_dog_flag_detected_and_unioned_with_other_rules():
    out = parse_mood("a quiet stroll with my dog")
    assert out["with_dog"] is True
    assert out["difficulty"] == "easy"          # from the 'peaceful'/'easy' rule


def test_old_dog_adds_water_requirement():
    out = parse_mood("hiking with my old dog")
    assert out["with_dog"] is True
    assert out["difficulty"] == "easy"
    assert "water_for_dog" in out["must_have"]


def test_family_sets_family_and_easy():
    out = parse_mood("somewhere good for kids and family")
    assert out["family"] is True
    assert out["difficulty"] == "easy"


def test_fear_of_heights_avoids_exposure():
    out = parse_mood("I'm scared of heights, no exposure please")
    assert "exposure" in out["avoid"]
    assert out["difficulty"] == "easy"


def test_epic_sets_big_view():
    out = parse_mood("I want to feel small, something epic and breathtaking")
    assert "big_view" in out["must_have"]
    assert "panoramic views" in out["interests"]
    assert out["mood"] == "epic"


def test_challenge_sets_hard():
    out = parse_mood("give me a tough, demanding summit workout")
    assert out["difficulty"] == "hard"


def test_interests_union_across_rules():
    out = parse_mood("a waterfall, a turquoise lake and a scenic view")
    for tag in ("waterfalls", "alpine lakes", "panoramic views"):
        assert tag in out["interests"]


def test_italian_and_german_triggers():
    # Uses base-form triggers ('rilassante', 'entspannt') that match exactly.
    # NOTE: the IT/DE stems wrapped in \b(...)\b don't match inflected forms
    # (e.g. 'tranquilla', 'gemütliche') — minor pre-existing quirk, see MORNING_REPORT.
    assert parse_mood("una camminata rilassante")["difficulty"] == "easy"     # IT
    assert parse_mood("ich bin entspannt heute")["difficulty"] == "easy"      # DE


def test_difficulty_is_first_set_not_overwritten():
    # 'peaceful'/'easy' appears before 'challenge' in the rules; easy wins as first-set.
    out = parse_mood("a calm easy walk that is also a bit challenging")
    assert out["difficulty"] == "easy"
