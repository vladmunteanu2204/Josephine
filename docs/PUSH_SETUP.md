# Web Push setup — Josephine's proactive "moments"

On-device **memory** + the **proactive in-app opener** work with zero setup. This
doc covers the remaining piece: **real push notifications** (the "Mountain
moments" toggle in Settings). Everything is guarded — until VAPID keys are set,
push is simply disabled and the toggle explains why.

## 1. VAPID keys

Generate once (dev keys are already generated locally and git-ignored:
`backend/vapid_private.pem`, `backend/vapid_public.txt`). To generate fresh:

```bash
cd backend
./venv/bin/python - <<'PY'
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64
p = ec.generate_private_key(ec.SECP256R1())
open('vapid_private.pem','wb').write(p.private_bytes(
    serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
pub = p.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
open('vapid_public.txt','w').write(base64.urlsafe_b64encode(pub).rstrip(b'=').decode())
print('done')
PY
```

**Production env** (preferred over files):
```
VAPID_PUBLIC_KEY   = <contents of vapid_public.txt>     # application server key (base64url)
VAPID_PRIVATE_KEY  = <PKCS8 PEM>  (or an absolute path to vapid_private.pem)
VAPID_SUBJECT      = mailto:you@yourdomain.com
```
`push.is_enabled()` is true only when both keys load. The browser fetches the
public key from `GET /api/push/vapid-public`.

## 2. How a user opts in
Settings → **Mountain moments** toggle → asks permission → subscribes →
`POST /api/push/subscribe` stores it in `backend/data/push_subscriptions.json`
(git-ignored). Dead subscriptions are pruned automatically on send.

## 3. Sending a notification
`POST /api/admin/push/send` (admin JWT). With no `title`/`body`, it pulls the
**top active Living Almanac moment** as the content (real, already-curated) —
so you can send without writing copy:
```
POST /api/admin/push/send            # → uses the top almanac moment
POST /api/admin/push/send {"title":"…","body":"…","url":"/","lang":"it"}
```

## 4. Firing it on a schedule (the last manual piece)
There's no cron yet. To make moments fire daily, hit `/api/admin/push/send` from
a scheduler — e.g. a cron job, a hosted scheduled task, or the platform's
scheduler — once each morning (and only when an almanac moment is active; the
endpoint returns `{ok:false, reason:'no_active_moment'}` otherwise, so it's safe
to call daily).

## 5. Platform reality (not bugs)
- **Chrome / Android / desktop**: works once subscribed.
- **iOS / iPadOS**: web-push is delivered **only to an installed (home-screen)
  PWA**, iOS 16.4+. In a normal Safari tab it won't fire — the toggle says so.
- **Dev**: the service worker is unregistered in dev (for Vite HMR), so push
  can't be exercised on the Vite dev server — test on a production build / device.

## 6. Files
- `backend/push.py` — VAPID send + subscription store (guarded).
- `backend/app.py` — `/api/push/vapid-public`, `/subscribe`, `/unsubscribe`,
  `/api/admin/push/send`.
- `web-frontend/public/sw.js` — push + notificationclick handlers.
- `web-frontend/src/utils/push.js` — subscribe/unsubscribe/status.
- `web-frontend/src/components/Settings.jsx` — the opt-in toggle.
