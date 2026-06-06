"""Firebase ID-token verification — optional, credential-gated.

Server-side identity verification for user-generated content (reviews, saved
hikes). It activates ONLY when a Google service-account credential is provided,
so every environment without one keeps running exactly as before: verification
stays OFF and callers fall back to the legacy soft `user_id` trust (zero
regression). To switch it ON, set ONE of:

  - FIREBASE_CREDENTIALS_JSON       the service-account JSON, inline (Replit
                                    Secrets-friendly — paste the whole JSON)
  - GOOGLE_APPLICATION_CREDENTIALS  filesystem path to the service-account JSON

The `firebase-admin` package is imported lazily inside `_init()`, so the app
also runs unchanged if the dependency simply isn't installed yet.
"""

import os
import json

_initialized = False   # have we attempted init?
_enabled = False       # is verification live?
_auth = None           # firebase_admin.auth module handle


def _init():
    """Idempotently attempt to initialize the Firebase Admin SDK. Safe to call
    on every request — the real work happens once."""
    global _initialized, _enabled, _auth
    if _initialized:
        return
    _initialized = True

    raw = os.environ.get('FIREBASE_CREDENTIALS_JSON')
    path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if not raw and not path:
        # No credential supplied → verification intentionally disabled.
        return

    try:
        import firebase_admin
        from firebase_admin import credentials, auth as fb_auth

        if raw:
            cred = credentials.Certificate(json.loads(raw))
        else:
            cred = credentials.Certificate(path)

        # Reuse an existing default app if one was already created elsewhere.
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(cred)

        _auth = fb_auth
        _enabled = True
        print('[firebase] ID-token verification ENABLED')
    except Exception as e:
        # Missing package, malformed JSON, bad cert — degrade gracefully.
        print(f'[firebase] verification unavailable ({type(e).__name__}: {e}); '
              'falling back to soft user_id trust')
        _enabled = False


def is_enabled() -> bool:
    """True when a credential is present and the SDK initialized successfully."""
    _init()
    return _enabled


def verify_token(token: str):
    """Verify a Firebase ID token. Returns the decoded claims dict (includes
    `uid`, usually `email`/`name`) on success, or None if the token is missing,
    invalid/expired, or verification is disabled."""
    _init()
    if not _enabled or not token:
        return None
    try:
        return _auth.verify_id_token(token)
    except Exception as e:
        print(f'[firebase] token verify failed: {type(e).__name__}')
        return None
