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
