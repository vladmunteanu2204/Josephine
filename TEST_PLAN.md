# Test Plan — AlpenviaMobile (Josephine)

## Why this exists

The app is big and getting bigger, and most changes are made by an AI assistant that can't hold the whole codebase in its head at once. Tests are the **seatbelt**: each one writes down a promise the app must keep, and re-checks it in seconds on every change — so a mistake gets caught *by a machine before it reaches the user*, not by the user in production. The elevation catastrophe (computed +1779 m vs real +1105 m) is the canonical example of what a single test would have stopped.

**Design principles**
- **Catch the scary, skip the trivial.** Test the things that, if silently broken, would be embarrassing or dangerous (wrong stats, leaked drafts, leaked user data) — not getters.
- **Fast & deterministic.** No network, no real Anthropic/Mapbox calls, no clock/`random` nondeterminism. The whole suite should run in seconds so it runs on every change.
- **Ground truth as tripwire.** The 21 hand-verified trails become regression anchors: their numbers must not drift.
- **Each past mistake → one permanent test.** The net gets denser as the app grows, so the app gets *safer* with size, not more fragile.

## Current state (verified 2026-06-09)

- **Backend:** `backend/tests/test_guardrails.py`, `backend/tests/test_structured_intents.py` exist but use a bare `sys.exit()` harness; **pytest is not in `requirements.txt`**; no `conftest.py`, no CI.
- **`app` is a module-level Flask global** (no app factory). Importing it requires `ADMIN_PASSWORD` set (raises otherwise); `ANTHROPIC_API_KEY`/`DATABASE_URL` are optional (degrade gracefully). A `flask test_client()` works fine for route tests.
- **Frontend:** Vite + React 18, **zero test infrastructure** (no vitest/jest/RTL).
- Data lives in JSON (`data/trails.json` = 21 trails; `backend/data/{rifugios,hotspots,multi_day_trails}.json` currently empty); Postgres is a fallback-capable mirror.

## Tooling

| Side | Stack | Why |
|---|---|---|
| Backend | **pytest** + Flask `test_client` (+ `freezegun` for time, `pytest-mock`) | Standard; the test client needs no running server. `freezegun` pins season/dispersal/“now”. |
| Frontend | **Vitest** + **@testing-library/react** + **jsdom** | Vitest is native to Vite (shares the config); RTL for the few component tests. |
| CI | **GitHub Actions** (`.github/workflows/test.yml`) | Run both suites on every push/PR; red check blocks merge. |

Backend bootstrap — add `backend/conftest.py`:
```python
import os, sys
os.environ.setdefault('ADMIN_PASSWORD', 'test_pwd')      # required at import
os.environ.setdefault('ANTHROPIC_API_KEY', 'sk-test')    # keeps Claude path inert
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pytest
from app import app as flask_app

@pytest.fixture
def client():
    flask_app.config['TESTING'] = True
    return flask_app.test_client()

def admin_token():                                       # mint a valid JWT for admin tests
    import app
    return app._issue_admin_token() if hasattr(app, '_issue_admin_token') else None
```

## Test layers (the pyramid)

```
            ┌────────────────────────────┐
   few      │  E2E smoke (optional, P3)  │  app boots, /api/health, one real page render
            ├────────────────────────────┤
   some     │  Integration / API + contract │  flask test_client, FE↔BE field contract
            ├────────────────────────────┤
   many     │  Unit (pure functions)     │  insights, scoring, ascent, utils
            ├────────────────────────────┤
   bedrock  │  Data-integrity            │  trails.json invariants + 21-trail ground truth
            └────────────────────────────┘
```

---

## 1. Data-integrity tests — `backend/tests/test_data_integrity.py`  *(highest value, lowest effort)*

These guard against the most common real failure: an edit to `data/trails.json` (often by the assistant) that silently breaks a promise. Run over every trail.

- **Schema/required fields:** every trail has non-empty `id`, `name`, `region`, `difficulty`, `distance_km`, `duration_hours`, `elevation_gain_m`, `status`.
- **ID uniqueness:** no duplicate trail ids.
- **Status enum:** `status ∈ {published, draft}`.
- **Coordinate shape & bounds:** `coordinates` is a list of `[lon, lat]` (lon ∈ [-180,180], lat ∈ [-90,90]); **lon first** (catch the [lat,lon] swap). For South Tyrol sanity, lon ≈ 10–13, lat ≈ 46–47.
- **Enums:** `activity_type ∈ {walk,hike,trekking,via_ferrata}`; `grade_cai ∈ {T,E,EE,EEA,null}`; `trail_type ∈ {loop,out_and_back,point_to_point}`; `difficulty ∈ {easy,medium,hard}`.
- **Trilingual:** `josephineNote` has non-empty `en/it/de`.
- **Insights shape:** each insight has `id,kind,text{en,it,de}`; `kind ∈ INSIGHT_KINDS`; `visibility ∈ {public,chat_only}`; **every `hazard` insight has `verification.status == 'verified'`** (safety-critical); coordinates (if present) valid.
- **POIs shape:** each has `name,type,coordinates[lon,lat]`.
- **best_season:** months are valid month names.
- **Ground-truth stat lock (regression):** for the 21 verified trails, assert each stat equals its known value within ±0 (verbatim) — e.g. `tirolo-spronser-seen-rundtour` ascent **== 1105**, `tirolo-mutspitze` == 7.7 km / +908 / 4.42 h. *This is the tripwire that would have caught the elevation disaster.* Keep the expected values in a small `fixtures/groundtruth.json`.
- **Provenance consistency (once P1 lands):** for any trail with `data_provenance`, `data_provenance[f].value == trail[f]` (catches the stale-string drift we cleaned by hand).

*(Rifugios/hotspots/multi-day: same style, but `skip` gracefully while those files are empty; assert-if-present.)*

## 2. Backend unit tests (pure functions)

| File | Targets (file:function) | Key cases |
|---|---|---|
| `test_insights.py` | `insights.select_insights`, `_passes_gate`, `_conditions_match`, `_time_buckets`, `geo_moments` | unverified/`unverified` parent insight is hidden; `editorial`/`verified` surfaces; hazard requires verified; `limit` respected; month/weather/time gating; geo_moments merges insights+pois+checkpoints with coords. |
| `test_decision_engine.py` | `decision_engine.score_trail`, `rank_trails`, `_season_status`, `_season_range_label`, `verification_state`, `_loc` | season in/shoulder/out; ranking order deterministic; `verification_state` returns verified/editorial/unverified per `rec.verification.status`; localized string fallback. |
| `test_dispersal.py` | `dispersal.match_hotspot`, `crowd_pressure`, `decide`, `_haversine_km` | exact-id vs keyword vs radius match; pressure rises in peak month/hour/fair-weather; `decide` → beat_crowds/peak_today/plan_tomorrow/daylight_risk. Pin time with `freezegun`. |
| `test_recommender.py` | `recommender.canon_difficulty`, `build_profile`, `score_for_user` | difficulty normalization (easy/medium/hard/expert aliases); profile weights from behaviour+completed; per-user score favors matched tags/region/dog. |
| `test_mood.py` | `mood.parse_mood` | "tranquil walk with my dog" → `{with_dog:True, difficulty:easy/…, interests:[…]}`; avoid/must_have extraction; lang variants. Pure regex, no LLM. |
| `test_geo_helpers.py` | `app.haversine`, `app._trail_centroid`, `app._resolve_area_coords`, `app._vary` | known-distance pairs (Merano↔Bolzano ≈ X km ±1); centroid of a coord list; gazetteer exact/fuzzy area lookup; `_vary` deterministic for a fixed seed. |
| `test_ascent.py` *(lands with P2)* | the new `ingest/elevation/dtm.py` ascent | the corrected prominence algorithm: monotonic climb ⇒ ≈ net gain; noisy sub-T wiggles ignored; **regression: the 25-point Cima-di-Tel-style profile ⇒ ~1450, never ~1779**; calibration harness median APE over the 21 < target. |

## 3. Backend integration / API tests — `test_routes_public.py`, `test_routes_admin.py`, `test_auth_idor.py`

- **Published-only gate:** `GET /api/trails` never returns a `draft` trail; count matches published.
- **Single-trail draft hide:** `GET /api/trails/<draft-id>` → 404 (or hidden) without admin; **`?_admin=1` + valid JWT** → returns it; `?_admin=1` + bad/no JWT → still hidden.
- **Insights endpoint gating:** `GET /api/trails/<id>/insights` returns only gate-passing insights; respects `?lang` and `?visibility`.
- **Health:** `GET /api/health` → 200 `{ok:true}`.
- **Admin auth:** `POST /api/admin/login` wrong password → 401; correct → token; protected route without token → 401; **expired JWT → 401**; **10 failed logins from one IP → 429 on the 11th** (lockout), clears after window (freezegun).
- **IDOR (risk #17):** when Firebase is enabled, `GET /api/hikes?email=victim@x` and `GET /api/saved-trails?email=victim@x` from an unauthenticated/other caller must **not** return the victim's data; `POST` writes can't set another user's `user_email`. *(These tests document the vulnerability and lock the fix once #17 lands.)*
- **Dual-source consistency (risk #20):** after `POST /api/admin/trails`, the trail exists and matches in both the JSON file and (if DB configured) the DB row.
- **GPX endpoint validation:** `POST /api/admin/gpx/parse` with malformed XML → 400; out-of-bounds coords rejected; oversized file rejected.

## 4. System-prompt & contract tests — `test_system_prompt.py`, `test_contract.py`

- **Prompt integrity:** `_build_system_prompt()` runs without error on real data; contains every published trail's `name`; **stays under a token ceiling** (e.g. < 180k); contains **no real user emails** (privacy).
- **KEEP_TRAIL drift guard:** a fixture trail with a field *not* in `KEEP_TRAIL` is absent from the prompt — and a meta-test asserts the documented “Josephine-relevant” field set ⊆ `KEEP_TRAIL` so new schema fields don't silently vanish from her context.
- **FE↔BE field contract:** a shared `fixtures/trail_contract.json` lists the fields the frontend reads (`activity_type, grade_cai, distance_km, duration_hours, elevation_gain_m, coordinates, josephineNote, pois, …`). Backend test asserts a served trail provides them; frontend test asserts the components read them. Catches silent contract breaks between the two repos-in-one.

## 5. Frontend unit tests (Vitest) — `src/utils/*.test.js`

| File | Targets | Cases |
|---|---|---|
| `format.test.js` | `fmtDuration` | 4.42→"4:25"; 0/null/negative→null; 2→"2:00". |
| `activity.test.js` | `activityMeta`, `gradeLabel`, `gradeTitle` | each activity maps to label/Icon/color; via_ferrata→"Ferrata C"; CAI→"EE"; unknown→null; tooltip text. |
| `trailImage.test.js` | `trailImg`, `trailGallery`, `trailImgAlt` | new `images[]` vs legacy fields vs fallback; gallery merge; alt from name+region. |
| `gpxExport.test.js` | `buildTrailGpx`, `canExportGpx` | valid XML with trkpts + waypoints from `coordinates`/`pois`; `canExportGpx` false when <2 coords; slugified filename. |
| `directions.test.js` | `formatDriveDistance`, `formatDriveDuration`, `nativeMapsUrl` | "500 m"/"12.4 km"; "2 h 15 min"; iOS→Apple, else Google. |
| `access.test.js` | `isGuestAllowed` | guest views allowed, others not. |
| `memory.test.js` | `recencyBucket`, `isReturning`, `recordVisit` | bucket boundaries (today/yesterday/…); returning after >1 visit. (localStorage via jsdom.) |
| `i18n.test.js` | locale parity | **en/it/de have identical key sets** (deep) — no missing/orphaned translations; every key used as `t('…')` in components exists. |

## 6. Frontend component tests (Vitest + RTL) — `src/components/*.test.jsx`

- **`TrailCatalog.test.jsx`** — feed a fixture trail array (mock axios); assert filtering: difficulty filter narrows set; **activity filter** narrows set; tag filter (array overlap); search matches name/region/description; `clearAll` resets; active-filter chips render. (Mock mapbox/i18n/Auth.)
- **`TrailDetailV2.test.jsx`** — render a fixture trail; assert hero chips (rating, activity badge, grade chip), stats (distance, gain, `fmtDuration`, difficulty color), and **graceful degradation**: a *coverage* trail with no `josephineNote`/`insights`/`pois` renders **without empty holes or crashes** (this is the lane-UI promise — same template, thin content). Mock heavy children (TrailMap, WeatherWidget, axios).

## Priorities & first slice

**P0 — the seatbelt (do first; ~1 day, no feature risk):**
- `conftest.py` + pytest in `requirements.txt`; convert the 2 existing bare tests to pytest.
- `test_data_integrity.py` (full §1, incl. the 21-trail ground-truth lock).
- `test_routes_public.py` — published-only + draft-hide + health.
- `test_routes_admin.py` — login + auth-required + JWT expiry.
- Vitest setup + `format.test.js`, `activity.test.js`, `i18n.test.js`.
- CI workflow running both. → *From here on, every change runs the net.*

**P1 — the brains:** `test_insights.py`, `test_decision_engine.py`, `test_dispersal.py`, `test_recommender.py`, `test_mood.py`; `test_auth_idor.py` (locks #17); `test_system_prompt.py` (KEEP_TRAIL drift).

**P2 — pipeline + UI:** `test_ascent.py` + calibration harness (with ingest P2); `test_contract.py`; `TrailCatalog.test.jsx`, `TrailDetailV2.test.jsx` (incl. graceful degradation); dual-source + GPX-validation tests.

**P3 — nice-to-have:** itineraryPdf math, gamification badges, push/personalization, chat rate-limiting, an E2E smoke (app boots + one page renders).

## Fixtures (`backend/tests/fixtures/`, `web-frontend/src/__fixtures__/`)
- `published_trail.json`, `draft_trail.json` (canonical minimal valid trails).
- `groundtruth.json` — the 21 trails' locked stats.
- `trail_contract.json` — the FE↔BE field list.
- `valid.gpx`, `malformed.gpx`.
- Helpers to mint a valid/expired admin JWT, a frozen `now`, a fake weather snapshot.

## Conventions
- One assertion-theme per test; name says the promise (`test_drafts_never_appear_in_public_catalog`).
- Pure-function tests need no fixtures/clients; keep them first and fastest.
- Time/season/dispersal tests pin the clock (`freezegun`); never rely on the real date.
- A failing test is never deleted to go green — it's either a real bug to fix or a promise to renegotiate explicitly.

## Running
```bash
# backend
cd backend && pip install -r requirements.txt && pytest -q
# frontend
cd web-frontend && npm test            # vitest run
```
