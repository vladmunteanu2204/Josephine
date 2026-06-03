# Phase 1 — The Planning Core + Daily Plan Card (implementation spec)

Goal: prove the magic for a **consumer**. A mood-first prompt → one beautiful,
true, shareable **Daily Plan Card**, and an honest "not that today → here's
better" when conditions say so. Built by **incrementally refactoring** the
existing engine (strangler), keeping behavior green at every step.

Done = the acceptance test in `MASTERPLAN.md §8` passes for a consumer (no hotel
needed yet).

---

## A. Strangler refactor order (each step ships green)

The existing `get_recommendations` (`app.py`) + `dispersal.py` already do
retrieve → score → reject → dispersal. We extract, we don't rewrite. Keep a
regression harness (the 133-scenario pattern) green after **every** step.

**Step 1 — Extract scoring/filtering (ZERO behavior change).**
Move the per-trail scoring + hard filters out of `get_recommendations` into
`backend/decision_engine.py`:
- `score_trail(trail, ctx) -> (score, reasons, warnings)` (the interest/diff/
  season/dog/family/proximity logic, verbatim).
- `retrieve_and_rank(trails, ctx) -> ranked[]` (area match, dog filter,
  proximity fallback, daily jitter, sort).
`get_recommendations` calls these. Output byte-identical. Verify with the
recommend test battery (Naturno, Braies dispersal, dog, season, area_not_found).

**Step 2 — Extract context (ZERO behavior change).**
`backend/context_engine.py`:
- `build_context(body, user=None, hotel=None) -> Context` — wraps today's body
  parsing: duration/difficulty/interests/with_dog/family/start_area/max_dist +
  `_local_now(now)` + origin resolution (`_resolve_area_coords` / lat-lon /
  fallback) + weather + season + daylight (sunset) + `almanac.active_moments`.
- `Context` is a plain dict (documented below). `get_recommendations` builds it
  and passes to the decision engine. Still returns the same `{results}` list.

**Step 3 — Compose a Plan (NEW capability, additive).**
`decision_engine.compose_plan(ctx, ranked) -> Plan` (the Card shape, §C):
- pick top; compute **timing** (suggested_start, latest_safe_start from
  duration + sunset, "beat crowds" from dispersal); **hut pairing** (first open
  rifugio from `trail.nearby_rifugios` via `_resolve_nearby_rifugios`/`open_now`,
  else nearest by proximity); **access** (trail transport/access_info +
  dispersal `access_note`); **safety** (weather + season + dispersal
  `daylight_risk` → normal/caution/avoid); **signals** (qualitative, §D);
  **josephine_says** + **local_tip** (voiced); **moment** (top Almanac tie-in);
  **alternatives** (easier / quieter / rainy / tomorrow — reuse dispersal
  alternative + a re-rank with relaxed constraints).
- **Honest refusal:** if all candidates hard-reject (weather/season/daylight/
  dog), return a Plan with `safety.level="avoid"`, no trail, and `alternatives`
  = safer options (lower/shorter/tomorrow). The Card renders this state.

**Step 4 — New endpoint (additive, backward-compatible).**
`POST /api/josephine/plan` → `build_context` → `retrieve_and_rank` →
`compose_plan` → returns **one Plan**. Keep `/api/ai/recommend` untouched for the
existing chat options flow.

**Step 5 — Mood-first input.**
`backend/mood.py`: `parse_mood(text, lang) -> intent_overrides` — a deterministic
map (Layer-2 style, no LLM) from emotional phrasing to planning criteria (§B).
Folds into `build_context`. (LLM mood-parsing is a later enhancement; keep it
free + deterministic for the common moods first.)

**Step 6 — Daily Plan Card (frontend).**
`DailyPlanCard.jsx` renders the Plan (full / partial / caution / no-result),
surfaced in `JosephineChat` as the output of a plan, with save + share. Mood-first
entry: a prompt-style opener ("Tell me the day you want…") + the existing mood
tiles feeding `parse_mood`.

---

## B. Mood → criteria map (`mood.py`, deterministic, EN/IT/DE triggers)

`parse_mood` scans the prompt and returns overrides merged into intent. Examples:

| Mood phrase (any lang) | interests | avoid | must_have | difficulty | notes |
|---|---|---|---|---|---|
| "feel small" / "epic" / "in a movie" | panoramic views, summits | — | big_view | — | grandeur |
| "peaceful" / "calm" / "tired but beautiful" | forests, alpine lakes | crowds | — | easy | low effort, high beauty |
| "impress my date" / "romantic" | panoramic views | crowds | sunset_or_hut | — | scenery + reward |
| "good food" / "lunch" / "dumplings" | cultural routes | — | open_food_stop | — | hut pairing required |
| "scared of heights" | forests, alpine lakes | exposure | — | easy | reject exposed/ferrata |
| "with my dog" / "old dog" | (dog-friendly hard) | — | water_for_dog | easy if "old" | hard filter |
| "family" / "kids" | — | — | — | easy | family hard filter |
| "rainy day" / "it rained" | forests, cultural routes | high_altitude | — | — | low, sheltered |

`must_have` like `open_food_stop` becomes a composition requirement (a hut must
pair); `avoid: exposure` becomes a hard reject for via-ferrata/exposed trails.
Unmapped prompts fall back to the existing `parseRecommendIntent` + neutral
intent (and can still go to the LLM for phrasing only).

---

## C. The Daily Plan Card — data contract (the Plan object)

```json
{
  "plan_id": "plan_3f9c…",
  "lang": "en",
  "confidence": "high | medium | low",
  "title": "A quiet forest walk with lunch above Merano",
  "josephine_says": "I'd choose this today: the high routes are wet and you wanted calm, so this stays in the larch forest — with a malga halfway for dumplings.",
  "origin":  { "type": "hotel|gps|area|fallback", "name": "Merano", "lat": 46.672, "lon": 11.159 },
  "trail":   { "id": "...", "name": "...", "distance_km": 7.0, "duration_hours": 2.5,
               "difficulty": "easy", "region": "Merano & Surroundings", "image": "…", "coordinates": [...] },
  "timing":  { "suggested_start": "08:00", "latest_safe_start": "13:30",
               "sunset": "21:02", "reason": "quiet trails + afternoon storm risk" },
  "hut":     { "id": "...", "name": "...", "type": "malga", "open_now": true,
               "note": "famous for Schlutzkrapfen" },          // or null
  "access":  { "by_car": "…", "by_transport": "…", "parking": "lower lot fills by 09:00",
               "reservation_required": false },
  "weather": { "summary": "clear · 20°C", "wind_kmh": 7 },
  "signals": ["quiet today", "dog-friendly", "wet up high", "best before 11"],  // qualitative, NEVER a number
  "safety":  { "level": "normal|caution|avoid", "message": "" },
  "dog_note":    "shade most of the way; water at the malga",   // or null
  "family_note": null,
  "local_tip":   "Park in the lower lot — the top one fills by 9 and the walk up is lovely anyway.",
  "moment":  { "id": "larch-gold", "emoji": "🍂", "line": "the larches are peaking this week" },  // or null
  "alternatives": [ { "kind": "easier|quieter|rainy|tomorrow", "trail_id": "...", "name": "...", "why": "…" } ],
  "share":   { "headline": "Your day above Merano ✦", "subline": "Forest walk + a malga lunch, quiet today." }
}
```

Rules: every field localized via existing patterns; data fields carry through
verification status (Phase 0); `signals`/`josephine_says`/`local_tip` are voiced,
not numeric; missing hut/weather/access degrade gracefully (field omitted, card
still renders).

## D. Signals (qualitative, replacing the numeric score)
Derived from the same factors Codex's score used, surfaced as short chips:
crowd_fit→"quiet today"/"busy after 10"; weather_fit→"wet up high"/"clear all
day"; dog_fit→"dog-friendly"; effort→"gentle"/"a real climb"; timing→"best
before 11". 3–5 max, honest, never invented.

---

## Context object (from `build_context`)
```json
{ "intent": { "mood": "peaceful", "interests": [...], "avoid": [...],
              "must_have": [...], "difficulty": "easy", "duration_hours": 3,
              "with_dog": false, "family": false },
  "origin": { "type": "...", "name": "...", "lat": .., "lon": .. },
  "conditions": { "now": "ISO", "weather": {...}, "season": "summer",
                  "sunset": "…", "active_moments": [...] },
  "entitlements": { "tier": "free", "features": [] } }   // stub in Phase 1
```

---

## Endpoints (Phase 1)
- `POST /api/josephine/plan` — body: mood/prompt + duration/difficulty/dog/
  family + (lat,lon | start_area) + now + lang. Returns one Plan.
- `POST /api/josephine/plan/:id/save` — persist to the user's plans (reuse
  existing plans store).  *(share = client-side card render for now.)*
- `/api/ai/recommend` — unchanged (chat options flow).

## Test plan
- **Refactor parity (steps 1–2):** recommend battery byte-identical (Naturno→
  Vinschgau, Braies peak→demote+alt, dog honesty, season, area_not_found).
- **Plan composition:** peaceful+lunch near Merano → easy forest trail + open
  hut + timing + tip + signals; "scared of heights" → no exposed/ferrata;
  rainy → low/sheltered; old dog → easy + dog-friendly + water note.
- **Honest refusal:** late start + long route + early sunset → `safety:"avoid"`
  + tomorrow/shorter alternatives, no unsafe trail.
- **Card states:** full / partial (no hut) / caution / no-result render.
- `ast.parse(app.py)`; `npx vite build` green; EN/IT/DE parity; engine pure +
  guarded (never 500s the plan).

## Out of scope for Phase 1 (later phases)
Hotel origin/QR (P2), entitlements/billing (P2-3), preference memory (P3),
Open Data Hub live access rules/lifts (P4), push alerts (P3). Phase 0
(verification contract, LLM cost cap, privacy baseline) runs alongside.
