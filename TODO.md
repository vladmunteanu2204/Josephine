# TODO — deferred setup

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
