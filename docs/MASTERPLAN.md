# Josephine Masterplan — bringing her to life

Review of Codex's 12-month blueprint, pressure-tested against this codebase, our
scale, the never-fabricate rule, and the data sources actually available in
South Tyrol. This is the plan of record; TODO.md holds the near-term task list.

---

## 1. Verdict on Codex's blueprint

**Adopt the spine.** The five-system decomposition is right and we should commit
to it: Knowledge Graph → Context Engine → Decision Engine → Agent Layer →
Commercial Layer. Two ideas in it are genuinely excellent:

- **Verification metadata on every knowledge entity** (`verification_status`,
  `source_type`, `source_url`, `last_verified_at`, `stale_after_days`). This
  turns our "never fabricate" rule from a vibe into a **data contract** and
  powers a "fix the stale data" admin loop. Elevate this to a foundational
  principle, not just a field.
- **LLM for phrasing, never for factual authority.** Matches what we built.

**But it reads like a greenfield build. It isn't.** ~60% already exists (see §3).
The biggest execution risk is a big-bang rewrite that stalls for months and
regresses the dog/season/dispersal logic we carefully tuned. We refactor
incrementally (strangler pattern), not rewrite.

### Where I push back on Codex
1. **Defer Redis + Celery.** Premature for current scale (pre-revenue, single
   gunicorn on Replit). Weather caching is already an in-process dict + SQLite;
   the Almanac is editorial (no job). Background workers earn their place only
   when live feeds arrive (Phase "Moat"). Until then: on-request caching +, if
   needed, a tiny APScheduler/cron. Adding Celery now = ops cost, no payoff.
2. **Kill the literal "Josephine Score (92/100)."** It's the "4.8 stars" trap
   Codex himself warns against — false precision that *will* sometimes be wrong,
   breaking trust + the never-fabricate rule. KEEP the multi-factor score
   **internally** for ranking; SURFACE it as honest qualitative reasons
   ("quiet today · dog-friendly · wet up high · best before 11"), not a number.
3. **Drop `source_type: "scraped"`.** Legal/ToS risk and unnecessary — see §4.
4. **Tighten Phase 1.** Codex bundles DB + 2 engines + plan endpoint + card +
   hotel + analytics + admin CRUD into 2 months. Too much, and it gates the
   "does a plan feel magic?" validation behind the hotel build. Prove the magic
   for one consumer first; hotel is a thin wrapper on the same engine (§6).

### What Codex omitted (we must add)
- **GDPR / privacy** (EU product, storing mood history, preferences, hotel-guest
  analytics, and raw questions in the gap log). Non-optional. See §5.
- **LLM cost governance** (spend cap + provider abstraction) — so a paid product
  is never hostage to one key. See §5.
- **Data licensing/attribution** (OSM ODbL already in use; Open Data Hub terms).
- **Offline/safety** (no-signal terrain) — deferred but named.

---

## 2. The North Star
Codex's sharpest line, adopted as our product principle:
**"The soul is when Josephine protects you from choosing wrong"** — wrong trail,
weather, crowd, hut, effort, timing. Every system serves that. The emotional
wrapper: *a local friend looking after you*. The shareable artifact: the **Daily
Plan Card**. The habit: the **Daily Briefing** (= Living Almanac, already live).

---

## 3. What already exists (map to the five systems)
Evolve these; don't rebuild.

| System | Already have | Gap to close |
|---|---|---|
| Knowledge Graph | `data/trails.json`, `rifugios.json`, `hotspots.json`, `almanac.json`, `south_tyrol_places.json` (gazetteer), DB dual-mode (`db.py`, `DB_AVAILABLE`, `migrate.py`) | verification metadata contract; `places`, `hotel_profiles`, `plan_cards`, `user_preferences`, `access_rules`, `partner_offers`, billing tables (add per-feature, not upfront) |
| Context Engine | `_local_now`, gazetteer resolver, weather service, season logic, dog/family flags, dispersal inputs | extract a real `context_engine` that fuses mood + origin(hotel/gps/area) + conditions + entitlements into one object |
| Decision Engine | `get_recommendations` (score), `dispersal.py` (reject/demote + alternative + "why"), `no_dog_friendly`/season hard filters, proximity ranking | extract `decision_engine`: formal retrieve→reject→score→compose→alternatives + a composed **plan** (timing, hut pairing, access, tip) |
| Agent Layer | `JosephineChat`, 3-layer answer stack, `josephine_answers` (EN/IT/DE), Almanac surfacing, knowledge-gap logger (Layer 2.5) | mood-first front door; plan endpoints; preference memory; Daily Plan Card output |
| Commercial Layer | Lemon Squeezy partially wired (donations), admin JWT + admin panel, analytics buffer | hotel profiles + QR (Concierge, TODO §7), entitlements, subscriptions, webhook → entitlement |

---

## 4. The data moat — the key research finding
Codex hand-waved "live data once reliable access is confirmed." It already exists,
free and legal:

**NOI Techpark — Open Data Hub South Tyrol** (`opendatahub.com`):
- **Free, no API key, no auth** for open data; JSON; Swagger; real-time + historical.
- **Tourism API** (LTS/IDM): events, accommodations, gastronomy, POIs, suggested
  tours, **ski areas + lift status (daily)**, venues.
- **Mobility API**: public transport, **parking**, charging, and **traffic events
  (jams, roadworks, road closures)** for the Province of Bolzano.
- **Weather**: measurements only (precip/temp) — keep **Open-Meteo for forecasts**.

Implications:
- Replaces most of Codex's "manual editorial" load AND the dropped "scraping"
  path with an **official, free, attributable** source.
- Directly upgrades: Almanac **events**, `access_rules` (live **road closures /
  parking** → finally makes **dispersal Level 2** real), **lift status**,
  transport notes.
- It is the **door-opener to the IDM / tourism-board partnership** (overtourism
  dispersal solves their #1 problem; we'd be a showcase consumer of their data).
- Treat feeds as **ingest + verify** (source_type `official_feed`), not
  blind-trust; cache; respect their terms + attribution.

Sourcing policy: `official_feed` (Open Data Hub) > `manual`/`editorial` (our
curation — the taste/story layer) > `partner` > `user`. **No scraping.**

---

## 5. Cross-cutting workstreams (Codex missed)
- **Privacy/GDPR (EU):** lawful basis + consent for preference/mood history and
  hotel-guest analytics; data minimization; retention limits; the gap-logger
  stores raw questions (scrub PII / cap retention); a privacy policy + DPA for
  hotel partners. Design in now, cheap; retrofitting is expensive.
- **LLM cost governance:** monthly spend cap + kill-switch, and a
  provider-agnostic layer (Anthropic / OpenAI-compatible / self-hosted Ollama /
  off) so the commercial product is never hostage to one key. (Discussed; spec
  in chat history.)
- **Attribution/legal:** OSM ODbL credit already shipped (discreet menu line);
  add Open Data Hub attribution when integrated.
- **Offline/safety (deferred, named):** offline plan card + SOS-with-coords for
  no-signal terrain — retention/trust, Tier-3.

---

## 6. Re-sequenced roadmap (our reality, not greenfield)

**Phase 0 — Foundations (short, do alongside Phase 1)**
- Verification-metadata contract on knowledge entities + an admin "stale data"
  view (extends the gap-logger pattern).
- LLM spend cap + provider abstraction. Privacy baseline (consent + retention).

**Phase 1 — The planning core + the visible payoff (prove the magic, consumer)**
- Extract `context_engine` + `decision_engine` from `get_recommendations` +
  `dispersal` (incremental; keep behavior, add plan composition: timing, hut
  pairing, access note, Josephine tip, honest refusal + alternative).
- **Mood-first front door** (open emotional input; grow the deterministic
  mood→criteria map in Layer 2 to keep it cheap).
- **Daily Plan Card** — the single, beautiful, shareable output of every plan.
- Success: "I want peace and lunch near Merano" → one complete, safe, local,
  shareable plan; and "not that today → here's better" works.

**Phase 2 — Hotel concierge (the revenue engine; a thin wrapper)**
- `hotel_profiles` + `/#hotel/:slug` + QR + "Today from [Hotel]" (origin = hotel
  coords + branding); `HotelsManager` admin; hotel analytics.
- Lemon Squeezy hotel subscriptions + entitlements + webhook→entitlement
  (extend existing donation wiring). 5–10 pilot hotels.

**Phase 3 — Consumer paid layer**
- Trip Pass / Plus entitlements; preference memory + plan history; richer share
  cards; seasonal alerts (push, when notification infra lands).

**Phase 4 — The live-data moat (now Redis/Celery earns its place)**
- Open Data Hub ingestion (lifts, traffic/road-closures→access_rules, events→
  Almanac), freshness jobs, dispersal Level 2 (real parking/traffic).
- Partner offers v1 (offer attachment on plan cards, not a marketplace).
- Pursue the IDM/tourism-board partnership.

**Phase 5 — Scale & commercialization**
- Self-serve hotel onboarding, subscription dashboard, partner referral
  reporting, monthly hotel impact report, optional API/feed integrations.

---

## 7. Risks & non-goals
- **#1 risk: rewrite-stall.** Mitigate with strangler refactor + keep the test
  battery (133-scenario harness pattern) green at each step.
- **#2 risk: curation debt.** The taste/story/local-detail layer is ~70% human
  work; the gap-logger + Open Data Hub reduce but don't remove it. Budget for it.
- **#3 risk: feature sprawl** (Codex lists ~6 entitlement tiers, marketplace,
  white-label). Resist until the core magic + first paying hotels exist.
- **Non-goals:** out-mapping Komoot/Outdooractive; full marketplace before
  offer-attachment proves demand; live transport before note-based is solid.

---

## 8. The one-sentence test (acceptance)
A guest at a partner hotel types *"peaceful walk and a good lunch, I'm a bit
tired"* and gets back a single, beautiful, **true** Daily Plan Card — right
trail for today's weather and crowds, a malga that's actually open, when to
start, where to park, and one tip only a local would know — that they screenshot
and send to a friend.
