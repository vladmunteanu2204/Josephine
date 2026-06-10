"""Unit tests for insights.py — verification gating + selection + geo_moments.

The verification gate is safety-critical: unverified content must never surface,
and hazards require explicit 'verified' regardless of visibility.
"""
from datetime import datetime

import insights as I

ED = {"id": "a", "kind": "tip", "visibility": "public",
      "verification": {"status": "editorial"},
      "text": {"en": "editorial tip", "it": "consiglio", "de": "Tipp"}}
UNVER = {"id": "b", "kind": "tip", "visibility": "public",
         "verification": {"status": "unverified"},
         "text": {"en": "unverified", "it": "x", "de": "x"}}
HAZ_ED = {"id": "c", "kind": "hazard", "visibility": "public",
          "verification": {"status": "editorial"},
          "text": {"en": "loose rock", "it": "x", "de": "x"}}
HAZ_VER = {"id": "d", "kind": "hazard", "visibility": "public",
           "verification": {"status": "verified"},
           "text": {"en": "verified hazard", "it": "x", "de": "x"}}
CHAT = {"id": "e", "kind": "tip", "visibility": "chat_only",
        "verification": {"status": "editorial"},
        "text": {"en": "secret", "it": "x", "de": "x"}}
INHERIT = {"id": "f", "kind": "tip",  # no own verification → inherits parent
           "text": {"en": "inherits", "it": "x", "de": "x"}}
COND_JAN = {"id": "g", "kind": "tip", "visibility": "public",
            "verification": {"status": "editorial"}, "conditions": {"months": ["January"]},
            "text": {"en": "winter only", "it": "x", "de": "x"}}
COORD = {"id": "h", "kind": "photo_spot", "visibility": "public",
         "verification": {"status": "editorial"}, "coordinates": [11.16, 46.67],
         "text": {"en": "shoot here", "it": "x", "de": "x"}}


# ── _passes_gate ─────────────────────────────────────────────────────────────
def test_editorial_passes():
    assert I._passes_gate(ED, {}) is True


def test_unverified_blocked():
    assert I._passes_gate(UNVER, {}) is False


def test_inherits_parent_verification():
    assert I._passes_gate(INHERIT, {"verification": {"status": "editorial"}}) is True
    assert I._passes_gate(INHERIT, {"verification": {"status": "unverified"}}) is False
    assert I._passes_gate(INHERIT, {}) is False   # no parent verification → unverified


def test_hazard_requires_verified():
    assert I._passes_gate(HAZ_ED, {}) is False    # editorial is NOT enough for a hazard
    assert I._passes_gate(HAZ_VER, {}) is True


# ── select_insights ──────────────────────────────────────────────────────────
def test_select_hides_unverified():
    rec = {"insights": [ED, UNVER]}
    out = I.select_insights(rec, {"lang": "en"})
    ids = [o["id"] for o in out]
    assert ids == ["a"]


def test_select_returns_slim_localized_dicts():
    rec = {"insights": [ED]}
    out = I.select_insights(rec, {"lang": "it"})
    assert out[0] == {"id": "a", "kind": "tip", "text": "consiglio"}


def test_select_filters_by_visibility():
    rec = {"insights": [ED, CHAT]}
    pub = I.select_insights(rec, {"lang": "en"}, visibility="public")
    secret = I.select_insights(rec, {"lang": "en"}, visibility="chat_only")
    assert [o["id"] for o in pub] == ["a"]
    assert [o["id"] for o in secret] == ["e"]


def test_select_hazard_gating():
    assert I.select_insights({"insights": [HAZ_ED]}, {"lang": "en"}) == []
    assert [o["id"] for o in I.select_insights({"insights": [HAZ_VER]}, {"lang": "en"})] == ["d"]


def test_select_respects_limit():
    rec = {"insights": [ED, dict(ED, id="a2"), dict(ED, id="a3")]}
    out = I.select_insights(rec, {"lang": "en"}, limit=2)
    assert len(out) == 2


def test_conditions_gate_on_and_off():
    rec = {"insights": [COND_JAN]}
    july_ctx = {"lang": "en", "conditions": {"now": datetime(2025, 7, 1, 10, 0)}}
    # In July, a January-only insight is hidden when conditions are honoured...
    assert I.select_insights(rec, july_ctx) == []
    # ...but shown when conditions are ignored (public page browsed anytime).
    assert len(I.select_insights(rec, july_ctx, ignore_conditions=True)) == 1


def test_select_includes_coordinates_when_present():
    out = I.select_insights({"insights": [COORD]}, {"lang": "en"})
    assert out[0]["coordinates"] == [11.16, 46.67]


# ── count_insights ───────────────────────────────────────────────────────────
def test_count_chat_only_secrets():
    rec = {"insights": [ED, CHAT]}
    assert I.count_insights(rec, {"lang": "en"}, visibility="chat_only") == 1


# ── geo_moments ──────────────────────────────────────────────────────────────
def test_geo_moments_merges_insight_poi_checkpoint():
    trail = {
        "verification": {"status": "editorial"},
        "insights": [COORD],
        "pois": [{"name": "Lake", "type": "lake", "coordinates": [11.18, 46.70]}],
        "checkpoints": [{"name": "Gate", "type": "poi", "coordinates": [11.19, 46.71]}],
    }
    out = I.geo_moments(trail, {"lang": "en"})
    sources = sorted(m["source"] for m in out)
    assert sources == ["checkpoint", "insight", "poi"]
    ins = next(m for m in out if m["source"] == "insight")
    assert ins["lat"] == 46.67 and ins["lon"] == 11.16     # [lon,lat] -> lat,lon
    assert "shoot here" in ins["line"]


def test_geo_moments_never_raises_on_garbage():
    assert I.geo_moments({"insights": [{"coordinates": "nonsense"}]}, {"lang": "en"}) == []
