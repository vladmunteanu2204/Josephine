# TODO — deferred setup

## ⚠️ 12. Verify curated notes (never-fabricate) — LAUNCH BLOCKER

Audit finding (Daily Plan Card review): the planning ENGINE is trustworthy, but
the **curated content is AI-seeded and unverified** and contains fabricated
specifics + at least one geographic mislink. The owner's hard rule
("never provide erroneous/fabricated data") makes this the #1 launch blocker.

Examples found:
- `rifugios.json` notes are confident invented anecdotes — e.g. rif-067 Malga
  Fedare: *"Arrive by 4pm to watch the evening milking… you can help"* (a
  specific operational claim almost certainly untrue). Most hut/trail notes read
  the same way.
- `data/trails.json` `nearby_rifugios` links are unreliable — Val di Funes
  Meadow Trail listed Malga Fedare, which is 9.4 km away in a different valley.

Done already (mitigations):
- Distance-gate hut pairing (compose_plan only pairs a hut within ~6 km).
- Rounded "best before ~HH:MM" (no false-precise minutes).
- **Verification-metadata contract is now authored AND enforced.** Admin guided
  forms write `verification {status, source_type, source_url, last_verified_at}`
  (status ∈ unverified|editorial|verified|stale) on every trail/rifugio.
  `decision_engine.compose_plan` now GATES what the card asserts on that status
  (`verification_state` / `can_state_fact` / `can_show_voice`):
  · hard operational facts (hut note, hut `open_now`, lunch signal, parking
    "fills by 09:00") → only when the source record is **verified**;
  · curated voice/prose (trail note, quiet-tip, highlights) → **verified or
    editorial**; · engine-generated lead/why/signals always stand; · directions
    (by car/bus = generic wayfinding) always show; · hut *name* (identity, not a
    claim) still shows. `verified` auto-downgrades to `stale` past
    `stale_after_days`. The card payload now carries
    `verification {trail, hut}`. **Net effect:** until the owner verifies a
    record in the admin panel, Josephine no longer asserts its specifics.

Still to do (the real workstream):
- [ ] Add `stale_after_days` to the admin form (contract field exists & is honored
      by the engine, but the guided form doesn't yet expose it — defaults unset).
- [ ] **Verify the actual records** — the gate is built, but every existing
      trail/rifugio is still `unverified`, so cards are currently bland until the
      owner walks the admin panel confirming specifics.
- [ ] Re-source rifugio/gastronomy data from **Open Data Hub South Tyrol** +
      verified hut contacts (Phase 0 verified-hut activation) instead of seed
      flavor text.
- [ ] Admin "stale / unverified data" review view (fed by the gap-logger pattern).
- [ ] Re-check all `nearby_rifugios` links for geographic sanity.

> **Strategic plan of record:** see `docs/MASTERPLAN.md` — the reviewed
> 5-system architecture (Knowledge Graph / Context / Decision / Agent /
> Commercial), the Open Data Hub South Tyrol data-moat finding, GDPR + LLM-cost
> workstreams, and the re-sequenced 5-phase roadmap. This file (TODO) is the
> near-term task list; the masterplan is the destination.

## 11. Place resolution / geocoding (offline gazetteer)

"I'm in <village>" / "I'm at <hotel>" → coordinates → proximity-ranked hikes.

- **Offline gazetteer (the only resolver — self-hosted, compliant, no runtime
  network):** `backend/data/south_tyrol_places.json` — every South Tyrol
  settlement + lodging/alpine-hut POI from OpenStreetMap (ODbL). Rebuild with
  `python3 backend/build_gazetteer.py` (one-time bulk extract from Overpass;
  re-run to refresh). Covers ~all real places (DE/IT/Ladin names, umlaut-tolerant,
  typo-tolerant). Unknown / out-of-region input → honest "widen" offer.
- **Attribution (DONE):** "© OpenStreetMap contributors" shown discreetly at the
  foot of the hamburger menu (`HamburgerMenu` + `.hamburger-attribution`).
- **Live geocoder: REMOVED** (was an opt-in Nominatim fallback). Dropped to stay
  cleanly within the OSM Nominatim usage policy (no silent embedding, commercial
  reliance discouraged). If a fallback is ever wanted, re-add a provider-agnostic
  `GEOCODER_URL` (self-hosted Nominatim or a commercial provider) — but the
  offline gazetteer already covers villages + hotels, so it's likely unnecessary.
- **B2B partners:** store each partner hotel's coordinates directly at
  onboarding (you'll have them) so the concierge never depends on geocoding.

## 0. Enable hut-booking auto-email (Resend)

The booking system auto-emails a hut when its email is **verified**; until the
provider is configured it runs in fallback mode (the hiker sends the inquiry via
a one-tap WhatsApp/email/copy draft). Inquiries are always saved either way.

- [ ] Create a Resend account + verify a sending domain.
- [ ] Set backend env (Replit → Secrets):
      `RESEND_API_KEY`, `BOOKING_FROM_EMAIL` (e.g. `Josephine <bookings@yourdomain>`).
- [ ] In Admin → Rifugios, tick **"Booking email verified"** ONLY for huts whose
      email you've confirmed is real (the seed emails in `rifugios.json` are
      placeholders — do NOT trust them blindly).
- [ ] Restart the backend. Then a booking to a verified hut emails it (Reply-To
      the hiker) + sends the hiker a confirmation; unverified huts stay on the
      one-tap fallback.
- Code: `backend/notifications.py`, `backend/app.py` → `submit_booking_inquiry` /
  `_deliver_booking_inquiry`. Per-IP rate limit + bilingual EN/IT message built in.
- Optional later: an admin "Resend" action on a saved inquiry.

## 1. Enable Haiku (Josephine open-ended chat)

The chat engine is fully wired for Claude Haiku, but it only activates when an
API key is present. Until then, `/api/chat` returns the offline fallback for any
question the local layers can't answer.

- [ ] Set `ANTHROPIC_API_KEY` in the backend environment (Replit → Secrets).
- [ ] Restart the backend so it picks up the key.
- Model used: `claude-haiku-4-5` (see `backend/app.py` → `josephine_chat`).
- Already in place: per-IP rate limiting, response caching, and trail-context
  grounding (the current trail's facts are injected into the system prompt with
  a "don't invent beyond these facts" instruction).
- Optional hardening to consider later: a monthly spend cap / max-token trim.

## 2. Go live with donations (Lemon Squeezy "buy me a coffee")

The donate page + backend are built and run in "coming soon" mode until these
env vars are set. See `backend/app.py` (donation config block + `/api/donate/*`)
and `web-frontend/src/components/Donate.jsx`.

In Lemon Squeezy:
- [ ] Create a store and a **product with a "Pay what you want" variant**
      (required so the server can set a custom price). Note the store ID and
      variant ID.
- [ ] Create an API key.

Set these backend env vars:
- [ ] `LEMONSQUEEZY_API_KEY`
- [ ] `LEMONSQUEEZY_STORE_ID`
- [ ] `LEMONSQUEEZY_VARIANT_ID`  (the PWYW variant)
- [ ] `DONATION_COFFEE_PRICE_CENTS`  (optional, default `300` = €3.00)
- [ ] `DONATION_CURRENCY`  (optional, default `EUR`)
- [ ] `APP_BASE_URL`  (optional, e.g. `https://yourapp.com` — used for the
      post-payment return redirect)

Once all three required keys are set, `/api/donate/config` reports `enabled:true`
and the page switches from "coming soon" to a working checkout.

Optional follow-ups (not built yet):
- [ ] `/api/donate/webhook` to record completed donations / show a supporters count.

## 3. Reviews — persistence + real auth (audit #4, #5) — DEFERRED

Currently reviews are NOT persisted and NOT truly authenticated:
- `POST /api/trails/<id>/reviews` and `/api/rifugios/<id>/reviews` return a
  fabricated review object and write nothing to storage; the frontend shows it
  optimistically, so it disappears on reload. (`backend/app.py`)
- Auth is a soft check: any non-empty `user_id` is accepted (forgeable). The
  backend never verifies Firebase identity anywhere (same gap affects saved
  hikes).
- `load_reviews()` returns a **list** in DB mode but the GET endpoints expect a
  dict with `reviews` + `statistics` → will 500 review reads when Postgres is
  active (audit #5).

To do when revisited:
- [ ] Persist reviews (JSON store, and a `reviews` table when `DB_AVAILABLE`).
- [ ] Normalise `load_reviews()` to the `{reviews, statistics}` shape in DB mode
      (fix #5).
- [ ] Verify Firebase ID tokens on the backend (Firebase Admin SDK +
      service-account credential) so reviews and saved hikes are genuinely
      authenticated — then drop the forgeable `user_id` soft-check.

## 4. Remaining dependency notes (audit #6, #7)

- Frontend: 2 moderate vulns remain (esbuild/vite dev-build chain). They need a
  breaking Vite major bump (`npm audit fix --force`) and don't ship in the
  static bundle — deferred to avoid breakage. Root + non-breaking frontend
  fixes are done (root: 0 vulns; frontend: 7 → 2).
- Local `.venv` runs Python 3.14, on which `gevent` won't build, so
  `pip install -r backend/requirements.txt` can't fully sync locally. Installed
  `flask-talisman` directly so local `import app` works. Production/Replit uses
  a compatible Python; no prod impact.

## 5. Audit closure status

The full code audit (P0 data-loss/identity → P1 correctness/consolidation →
P2 polish → hygiene) is **closed**. Done & committed: persistence routed
through Postgres (reviews/plans/bookings/challenges), crash-safe writes,
client-trust hardening (scoped `/api/hikes`, unguessable ids, CORS fail-closed),
404 + deep-link resilience, input validation, single API client, accessible
Modal/Sheet primitives, z-index + colour tokens, full JosephineChat +
transport-note i18n, WCAG `--text-muted`, functional emoji→lucide, dead-code
removal, atexit analytics flush, `_chat_cache` cap, generic 500 responses,
dead `X-Admin-Password` header removed.

**Won't-fix / needs-infra (consciously accepted, not oversights):**
- **CSP `'unsafe-inline'`** stays for `style-src`/`script-src`: the UI uses
  inline `style={{}}` pervasively; removing it needs a nonce/hash pipeline
  (build-system change) or a large inline-style refactor. Revisit if/when a
  CSP-hardening pass is scoped.
- **Per-worker in-memory rate limits / lockout** (`_booking_rate_ok`,
  `_failed_attempts`, chat limiter): correct within one worker, but not shared
  across gunicorn workers. Making them global needs Redis or a DB-backed
  counter (infra). Acceptable at current scale; revisit with multi-worker load.

**Deferred — structural refactor (own session):** split the ~4,000-line
`backend/app.py` into blueprints/service modules, break up the god-functions
(`get_recommendations`, `structured_answer`), and add a frontend navigation
context to end prop-drilling. User-invisible and high-risk; best done in a
dedicated session with heavy incremental testing rather than bundled with
feature work.

**Deferred — remaining modal a11y (low priority):** two overlays were left on
their bespoke implementations rather than the shared `Modal`/`Sheet` primitives:
- `CelebrationModal` — entangled with the active-hike tracker's `z-index:
  999999` fullscreen; portaling it to the primitive risks it rendering behind
  the still-mounted map. Needs a real GPS-hike to verify. Single action button,
  so the focus-trap value is low.
- `MediaGallery` lightbox — already has Escape + arrow-key nav + click-to-close;
  it's a full-bleed image viewer, an awkward fit for the centred card primitive.
  Could gain a focus trap + `aria-modal` if revisited.

**Won't-do — emoji→lucide (by design):** the conversion was functional-only.
Colour-coded weather *conditions* (☀️🌧️❄️), celebration 🎉🏆, mood tiles,
flags 🇬🇧, badge icons, canvas-drawn text and `alert()` glyphs stay as emoji
(a monochrome outline would lose meaning / can't render). Admin `TrailManager`
was left (internal tool, alert-heavy, low ROI).

## 6. Local dev state (housekeeping)

- Empty `headers: {  }` objects remain in several admin components after the
  dead `X-Admin-Password` removal — inert (auth is the Bearer interceptor),
  cosmetic only; tidy opportunistically.
- Testing left the dev Firebase session cleared on `localhost:5173` (re-login in
  dev) and dev servers may still be running (backend `:8000`, vite `:5173`).

## 7. Product roadmap — next development phases

From the market research (Codex + our own scan): no incumbent owns the
"what should I do **today**?" decision; Josephine's edge is the season- and
weather-aware engine that picks one good answer now. Locked decisions:
prioritise a **B2B hotel/farm-stay concierge**, with **real verified rifugio
contacts** as the only near-term data enabler (no Open Data Hub / affiliate /
pilot yet). The audit just made this buildable — booking inquiries, plans and
reviews now durably persist (P0), so the concierge wedge has a real backbone.

Build bottom-up (each phase shippable on its own):

- **Phase 0 — Verified-hut activation (do first; cheap, high-leverage).**
  Secure real hut booking emails/phones; tick `booking_email_verified` per hut
  so the already-built booking system flips from hiker-sends-fallback to true
  auto-send. Add an admin affordance (verified-only filter + "X/42 verified"
  count) in `RifugiosManager`. This is the credibility floor for any B2B pitch.

- **Phase 1 — Today-Near-Me.** One-tap "best hike from here, right now":
  reuse `POST /api/ai/recommend` + weather + a new `nearestAreaName(lat,lon)`
  export in `geoAwareness.js`; client-side soft re-rank by distance / open huts
  / crowding / weather. New `utils/todayEngine.js` + `components/TodayNearMe.jsx`,
  route in `App.jsx`. Serves as the consumer hook **and** the B2B demo. While
  here, extract a clean `recommend()` service fn out of the `get_recommendations`
  god-function (incremental, not the full app.py split).

- **Phase 2 — Concierge Mode (the B2B product).** Branded `?host=<slug>`
  surface a hotel hands guests via link/QR. Backend `hosts.json` +
  `load/save_hosts` + `GET /api/hosts/<slug>` + admin CRUD; frontend
  `HostContext.jsx` (mirror `SeasonContext` accent theming) + `ConciergeMode.jsx`
  wrapping Today-Near-Me; `HostsManager.jsx` admin + zero-dep QR via
  api.qrserver.com. Seed `demo-hotel-merano`.

- **Phase 3 — Host analytics + SaaS packaging.** Per-host event counts (views,
  picks opened, inquiries started) in HostsManager; pricing scaffold
  (€29/mo or €99/season). Extend the existing Lemon Squeezy wiring for billing
  later.

Moat note: AV huts are already on hut-reservation.org — the durable edge is the
CAI/private **email-phone long tail** (Phase 0's verified-contacts work, treated
as an ongoing data effort) plus the "today" decision assistant.

## 8. Long-term vision — become the #1 South Tyrol tourism brand

Positioning: "Josephine knows South Tyrol like a local friend — tells you what
to do today, books it, gets you there, and keeps you off the overcrowded spots."
A decision-assistant + concierge + local insider, NOT a map/catalog. The moat is
South-Tyrol-specific local intelligence, not map data.

### Tier 1 — features that make it indispensable here
- **Südtirol Guest Pass / Mobilcard integration** — surface "this bus/lift is
  free with your Guest Pass." Ties directly into the B2B concierge (hotel issues
  the pass) and removes parking friction.
- **Overtourism dispersal / "go now, go here instead"** — crowd + access +
  parking intelligence (Braies access slots, Seiser Alm traffic limits, full
  lots) → steer to equally good, quieter alternatives. This is also the angle
  that wins an IDM Südtirol / Tourismusverein partnership (it solves THEIR #1
  problem). See §9 for the working discussion.
- **Winter** — ski touring, snowshoe, slope/lift status, avalanche bulletins.
  Same engine; doubles the season and audience (Dolomiti Superski is huge).
- **Real-time conditions** — lift/cable-car open status, hut open/full/closed,
  trail/road/pass closures, webcams. Drives daily opens.
- **Ladin + German dialect** — add Ladin (Val Gardena/Badia): small effort,
  big "we're from here" brand signal.

### Tier 2 — concierge depth (extends the booking rail already built)
- Book the whole day: cable-car tickets, restaurant/Buschenschank/Hofschank
  tables, guided tours, e-bike/gear rental, wellness slots.
- Cultural seasons: Törggelen, Almabtrieb, Christmas markets, wine roads —
  year-round relevance beyond summer hiking.
- Cuisine layer: hike + hut lunch + winery itineraries (Michelin density +
  Speck/wine identity).

### Tier 3 — trust & retention
- Offline maps/trails + safety (SOS with coords, live-location share, one-tap
  mountain rescue 112).
- Post-trip recap (build on TripSummary) → shareable, organic word-of-mouth.

### Business moves
- Data moat = verified contacts + real-time + crowd data (ongoing ops, not a
  one-off feature).
- GTM: hotels (the §7 plan) + a lighthouse tourism-board/valley reference; the
  overtourism angle is the door-opener.
- Monetization layered: B2B SaaS to hosts → booking commissions → premium
  consumer tier (offline + winter + live) → tourism-board/sponsored placements.
- Brand = "the local friend"; protect Josephine's voice (native-speaker review
  of IT/DE/Ladin copy before launch).

### What NOT to do
- Don't try to out-map Komoot/Outdooractive — maps are a commodity; the
  decision + booking + local intelligence is the wedge.
- Don't sprawl — the four Tier-1 bets (Guest Pass, crowd dispersal, winter,
  real-time) are what actually move toward #1.

First thing to fund if only one: the overtourism dispersal feature + a
tourism-board partnership.

## 8b. The "soul" — what makes people talk about it (vision, not yet built)

Diagnosis: today Josephine is an excellent *utility*. Utilities don't spread —
**characters and feelings** do. The "companion" is a promise the product
doesn't yet keep (every chat starts from zero). Soul = depth, not more tabs.
Three pillars, in bet order:

1. **Living Almanac — "this week in the mountains"** (highest-leverage bet).
   A card surfacing real, time-sensitive, hyper-local moments: larch gold
   (~10 days in Oct), enrosadira firing tonight (clear sky), Almabtrieb cattle
   drives, first snow dusting, wildflower peak, Törggelen opening, Christmas
   markets, "Braies most turquoise right now — go before 8". This is the
   screenshot-and-share, open-it-every-morning magic AND the deepest moat (pure
   South Tyrol local intelligence nobody can fake). Rides existing weather/
   season/dispersal/gazetteer. MUST be real/sourced (never-fabricate rule) —
   curate a seasonal-events + natural-phenomena calendar; gate phenomena on
   live weather.

2. **Josephine with memory + point of view.** Cross-session memory, opinions,
   warmth so the relationship compounds ("last time you did Seceda at sunrise —
   ready for something wilder?"; "you hate crowds, so not Braies today"). She
   has favourites, is honest ("that one's overrated"), has a backstory. The
   relationship IS the product. Needs a per-user memory store (prefs, past
   picks, mood) + voice/persona guidelines; respect privacy.

3. **Shareable postcard** — a beautiful, personal end-of-day recap people
   *want* to post (route + photo + Josephine's handwritten-feel note + the
   enrosadira they caught, subtly branded). The organic word-of-mouth engine.
   Build on the existing TripSummary.

What NOT to do: don't bolt on more utility when it feels flat — soul is depth.
One character with memory + one living almanac + one postcard beats ten tabs.

### 8b-bis. Converged soul plan (Claude + Codex independently agreed)

A second independent analysis (Codex) landed on the SAME core — Daily Briefing
(=Almanac), "told like a local", "not the famous viewpoint" (=dispersal),
handwritten itinerary (=postcard), "today from your hotel" (=Concierge). When
two analyses converge, the differentiator is no longer the idea — it's
**execution + curation**. North-star reframe to adopt (Codex's best line):
**"the soul is when Josephine protects you from choosing wrong"** (wrong trail,
weather, crowd, hut, effort, timing).

The genuinely additive pieces to build, in order, AFTER the Almanac:

1. **Mood-first front door (next soul build).** Lead with "tell Josephine the
   day you want" — open emotional input, not hours/difficulty: "I want to feel
   small", "impress my date", "scared of heights", "peaceful walk + good
   lunch", "old dog, still loves adventure". We have mood *tiles* already; this
   is the open free-text version + the emotional framing as the entry. Cheap,
   high-impact, partly built. NOTE: reliable free-text→plan currently leans on
   the LLM — grow the deterministic mood→criteria map in Layer 2 to keep it
   cheap (ties to the LLM-cost work).

2. **The Daily Plan Card.** The single, unified OUTPUT of every plan AND the
   share artifact AND the hotel handout — one beautiful, sendable card: start
   time · route · hut stop · weather note · dog/family note · transport/parking
   · Josephine's personal tip · save/share. This subsumes the "postcard" (pillar
   3) — make it the output of planning, not just a post-trip recap. Ties
   Almanac + dispersal + timing together.

3. **Per-trail "local intelligence" content layer (the moat + the bottleneck).**
   Taste + story + small details: opinions ("famous but mobbed after 10",
   "better after rain — the forest smells incredible", "skip today, clouds hide
   the view"), story hooks ("the path locals take when tourists go to Braies",
   "first Dolomites hike for someone you love"), and the details no generic app
   has (where to park without chaos, which malga has the best dumplings, where
   dogs drink, where sunset actually lands, muddy-after-rain). This is ~70%
   CURATION, not code — owner's ongoing work, fed by the knowledge-gap logger
   (Layer 2.5). MUST be real (never-fabricate) — not LLM-generated.

**Skip the literal numeric "Josephine Score" (92/100).** It's the "4.8 stars"
trap Codex himself warns against — false precision, and it WILL sometimes be
wrong (breaks the never-fabricate rule + the trust the whole thesis rests on).
KEEP its signals — crowd fit, weather fit, dog fit, effort/reward — but surface
them as honest qualitative reasons ("quiet today · dog-friendly · wet up high ·
best before 11"), NOT a number.

## 8c. Living Almanac — build spec ("this week in the mountains")

Curated engine of fleeting, real, local moments Josephine *tells* you, gated on
live conditions so it's never wrong. Rides existing weather service (+ sunset),
seasons, dispersal, gazetteer, Europe/Rome time, and the trilingual-data pattern.

**Locked decisions:**
- **Surface = inside the chat** (lead message + slim Almanac card, in her voice —
  "told to you", not a dashboard) **+ push notifications once notification infra
  exists** (see notifications.py; the morning "the larches are peaking this week,
  go before 8" nudge is the killer use). No Home banner for v1.
- **Curation = collaborative.** Claude drafts the seed moments (flagging any date
  it's unsure of); the owner reviews them AND contributes their own moments.

**⚠️ OWNER ACTION (you owe Claude this):** hand over a vetted/extra list of
"moments" — fleeting South Tyrol phenomena & events with rough date windows
(and which valleys), e.g. larch gold, enrosadira, Almabtrieb, Törggelen,
apple blossom, first snow, wildflower peak, Christmas markets, chestnut season.
Claude will draft ~15 to start; review them + add yours before launch (the
never-fabricate rule makes accuracy of dates/places essential).

**Principles:** ephemeral > evergreen ("tonight" / "~6 days left"); told, not
displayed; never fabricated (only show a moment when its date-window + live-
weather gate passes; year-varying events phrased approximately).

**Architecture (full plan delivered in chat):**
- `backend/data/almanac.json` — moments: id, type (phenomenon/event/condition),
  window (MM-DD from/to, year-wrap aware), optional elevation band + areas
  (gazetteer), weather_gate, weight, localized `voice` + `share` (EN/IT/DE in
  the data file like hotspots' `why`), optional `cta` (area/interest).
- `backend/almanac.py` — `_in_window`, `_days_left`, `_weather_ok` (reuse
  weather_service: enrosadira⇒clear sky at sunset, first-snow⇒recent snow),
  `active_moments(now, weather, area, lang)` ranked by weight + ephemerality +
  weather-satisfied + area proximity. Guarded.
- `app.py` — `load_almanac()` near `load_hotspots`; `GET /api/almanac`
  (now/lat/lon/area/lang/limit; day-bucket cache like dispersal; short bucket
  for weather-gated); intent route ("what's happening / in season / this week").
- `JosephineChat.jsx` — lead with one moment on open; Almanac card; chips
  (plan-around-it → seeds recommend; more moments; share = postcard hook).
- Locales: only short validity-label `tj` keys ("tonight", "{n} days left").

**Phasing:**
- **P1 — DONE** (commits 1281046 backend, 5dbe771 frontend): almanac.json (12
  moments EN/IT/DE), almanac.py engine, GET /api/almanac, chat surfacing (leads
  on open + "what's happening" intent + Plan-around-it / What-else chips),
  enrosadira & first-snow weather gates. Verified across seasons + browser preview.
- **P2 — TODO:** location-personalised ranking (pass real user coords),
  elevation-aware larch (gold descends over weeks), share → postcard hook, and
  **push notifications** (the morning "larches peak this week, go before 8"
  nudge — the killer use; needs notification infra, see notifications.py).
- **P3 — TODO:** real event feeds (market/Almabtrieb exact dates from a source),
  admin curation UI for moments, webcam/first-snow auto-detection.

**⚠️ OWNER ACTION (open):** hand Claude extra/vetted moments + confirm the
`_review`-flagged date windows in almanac.json — the gate before launch. Do this
when you have time; Claude will fold them in and re-verify.

**Verify:** active_moments at seeded dates (Oct⇒larch, Jun⇒wildflowers,
Dec⇒markets), clear vs cloudy ⇒ enrosadira on/off, year-wrap window, EN/IT/DE
parity; API localized; build green; ast parse.

## 9. Crowd dispersal + temporal intelligence (spec)

The flagship differentiator. Reframed from the discussion: it's a **temporal
intelligence layer** on the recommendation engine, with overcrowded hotspots as
the sharpest case. Philosophy: don't *deny* the famous spot — make the user feel
they're **discovering a secret that's just as good or better**. Show abundance.

### Decision A — full hotspot inventory + quality-matched alternatives
- Curate **every** suffering hotspot in South Tyrol (not just the top 5):
  Lago di Braies, Seiser Alm, Tre Cime/Lavaredo, Lago di Carezza, Seceda,
  Alpe di Siusi, etc. — research + maintain the full list.
- New data file `hotspots.json` — per hotspot: location, **peak window**
  (hours/days it's mobbed), **access constraints** (car cap, road-closure hours,
  "lot fills by ~09:00", shuttle info), and a **ranked list of alternatives**
  matched by *experience* (turquoise lake → another turquoise lake; panoramic
  ridge → another), each with a one-line "why it's just as good / better" hook
  in Josephine's voice.
- Curation IS the moat (same ops muscle as verified hut contacts).

### Decision B — Josephine always checks the clock
Core: the realistic answer to "I want to hike X" depends on **when** it's asked.
Add a temporal layer to the recommend/chat flow using three inputs together —
**current local time, sunset time, and the spot's peak/access window** — on top
of the existing weather branching (`buildWeatherGreeting`/`buildWeatherRemark`).

Scenarios to handle (gentle nudge, tempting toward firm):
- **Today-vs-tomorrow detection** — late-day request for a far/long/hotspot pick
  ⇒ infer they likely mean tomorrow: *"For Braies you want a morning — set it up
  for tomorrow (beat the crowds + parking)? For today, here's something close."*
- **Beat-the-crowds (positive firm)** — early morning + hotspot + clear ⇒
  *"Go now — almost to yourself, and you'll beat the 9am parking."*
- **Peak window** — midday + weekend + hotspot + sunny ⇒ *"Right now it'll be
  heaving — quiet stunner for today, or Braies at sunrise tomorrow?"*
- **Daylight/sunset safety** — if travel + hike duration won't finish before
  dusk ⇒ suggest a shorter option today or move to tomorrow.
- **Weekend multiplier** — bump crowd estimate Sat/Sun + holidays.
- Compose with weather (storm → short morning window) already in place.

Implementation notes: extend the engine with a `recommend()`-level time/crowd
re-rank + a small `temporalNote` builder (mirror the existing keyed,
interpolated, i18n'd `tj()` weather-note pattern — must be EN/IT/DE/Ladin).
Sunset via a lightweight calc or the weather API. Reuse the trail `crowding`
signal already returned by `/api/ai/recommend`.

### Decision C — deferred (parked here, with §8 Level 2)
- **Real-time crowd/parking/lift data** (Open Data Hub / NOI Techpark feeds,
  webcams, lot occupancy) — integration effort, patchy coverage. Fast-follow.
- **Tourism-board partnership** (IDM Südtirol / Tourismusverein) — the
  overtourism angle is the door-opener; unlocks Level 2 data + credibility +
  possible co-branding. Revisit when there's a reason to.

### Phasing
- **Level 0 (heuristic)** — clock + sunset + season + static `crowding` rules;
  today-vs-tomorrow + alternatives. ~70% of the value, mostly engine tweaks.
- **Level 1 (curated)** — `hotspots.json` with peak windows, access constraints,
  ranked alternatives. High trust, admin data-entry, no integration.
- **Level 2 (real-time)** — see Decision C. Deferred.

## 10. Josephine Layer-2 (`structured_answer`) full i18n — dedicated session

From the Josephine audit: `structured_answer` in `backend/app.py` (≈lines
3790–4290) is the offline, deterministic responder the chat hits BEFORE the LLM,
and it returns **English only** — so IT/DE users get English for ~60 canned
answers (gear, food, transport, emergencies, etc.). Owner decision: **full
translation** (not LLM-routing), done as its own focused pass (much of the
content is **alpine-safety-critical** and needs exactness + native review).

### Architecture (build first)
- New `backend/josephine_answers.py`: `ANSWERS = { key: {'en':[...], 'it':[...],
  'de':[...]} }` (always lists, even singletons, so `_vary` rotation works) +
  helper `answer(key, lang, q='', **vars)` → pick `lang` (fallback `en`),
  `_vary(q, variants)` for stable rotation, then `{var}` interpolation.
- Refactor `structured_answer(question, lang='en')`: keep ALL control flow /
  keyword detection exactly as-is; replace each inline English `return "…"` /
  `return _vary(q,[…])` with `answer('key', lang, q, **vars)`. Convert the
  data-templated returns (opening/access/technical/dog/family/prices/transport/
  crowding/recovery) to `{name}`/`{status}`-style placeholders.
- Caller `/api/chat` (≈line 4334): pass `lang` → `structured_answer(message, lang)`.
- Until `it`/`de` are filled, they fall back to `en` → **zero regression** (IT/DE
  behave exactly as today), so it can ship incrementally.

### Key inventory (every answer to key + translate)
- **Weather-gear** (≈3834–3868): wxGearRain, wxGearSun, wxGearWind, wxGearFog,
  wxGearSnow, wxGearGeneric. **Weather-deflect** (3871): wxNoLive.
- **General knowledge** (3904–4095): gearEasy, gearHard, gearMedium(2 variants);
  food(2); booking(2); rifugioTypes(2); bus(2); emergency(2); startTime(2);
  water; cash; altitude; navigation; fitness; photography; connectivity;
  language; guide; toilets; whoAreYou; greeting(3).
- **Entity-templated** (4104–4239): openRifugio (closed/opensIn/openUntil/
  noDates/bivacco templates), openTrail (inSeason/outSeason/noDates), access/
  accessNone, technicalTrail/technicalRifugio, dogTrailYes/No/Unknown,
  dogRifugioYes/No/Unknown, familyTrailYes/No/Unknown/Rifugio, pricesRifugio/
  pricesTrail, transport/transportNone, crowding/crowdingNone.
- **Recovery routing** (4242–4282): recoveryStage, recoveryRejoin connectives.
- **Final fallback** (after 4282): the generic "out of my map" reply (varies).

### Translation guidance
- Josephine's warm first-person voice; **IT = tu**, **DE = du** (informal).
- Keep numbers/units/phone codes EXACT (118, 112, SPF 50, 2L, 6°C/1000m, GPS).
- **SAFETY keys** — emergency, altitude, navigation, wxGearRain/Snow, technical —
  translate precisely and **flag for native-speaker review before launch**
  (mistranslation here = the "never erroneous data" rule broken).

### Verify
- Parity: `en/it/de` key counts equal in `josephine_answers.py`.
- `structured_answer(q, 'en')` returns byte-identical strings to today (spot-check
  ~10 across categories) — proves the refactor preserved content.
- `structured_answer(q, 'it'/'de')` returns the translation (spot-check).
- `python3 -c "import ast; ast.parse(open('backend/app.py').read())"`; chat smoke
  in all three languages.
