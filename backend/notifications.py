"""
notifications.py — outbound email for hut booking inquiries (via Resend).

Self-contained (no Flask import). Degrades gracefully: if RESEND_API_KEY /
BOOKING_FROM_EMAIL aren't set, EMAIL_ENABLED is False and the caller falls back
to a hiker-sends-it-themselves flow (WhatsApp/mailto deep links).

GDPR note: a booking inquiry contains the hiker's personal data (name, email,
phone) which is transmitted to the hut by email. Only send to huts whose address
has been verified (the caller gates on `booking_email_verified`).

Env:
  RESEND_API_KEY      — Resend API key
  BOOKING_FROM_EMAIL  — a Resend-verified sender, e.g. "Josephine <bookings@yourdomain>"
"""

import os

try:
    import requests
except Exception:  # pragma: no cover
    requests = None

RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
BOOKING_FROM_EMAIL = os.environ.get('BOOKING_FROM_EMAIL')
EMAIL_ENABLED = bool(RESEND_API_KEY and BOOKING_FROM_EMAIL and requests)

if not EMAIL_ENABLED:
    print("Note: RESEND_API_KEY/BOOKING_FROM_EMAIL not set — hut booking emails "
          "run in fallback mode (the hiker sends the inquiry themselves).")


def send_email(to, subject, text, reply_to=None):
    """Send a plain-text email via Resend.
    Returns (ok: bool, provider_id: str|None, error: str|None)."""
    if not EMAIL_ENABLED:
        return (False, None, 'email_disabled')
    payload = {
        'from': BOOKING_FROM_EMAIL,
        'to': [to],
        'subject': subject,
        'text': text,
    }
    if reply_to:
        payload['reply_to'] = reply_to
    try:
        resp = requests.post(
            'https://api.resend.com/emails',
            json=payload,
            headers={
                'Authorization': f'Bearer {RESEND_API_KEY}',
                'Content-Type': 'application/json',
            },
            timeout=8,
        )
        if resp.status_code not in (200, 201):
            return (False, None, f'resend_{resp.status_code}: {resp.text[:200]}')
        return (True, (resp.json() or {}).get('id'), None)
    except Exception as e:  # Timeout / connection / JSON errors
        return (False, None, str(e))


def build_inquiry_text(inquiry, rifugio=None):
    """Compose the hut-facing inquiry message (bilingual EN + IT, since huts are
    typically Italian/German-speaking). Reused verbatim for the hut email body,
    the hiker's confirmation copy, and the fallback WhatsApp/email draft."""
    rif_name = inquiry.get('rifugio_name') or (rifugio or {}).get('name', 'the rifugio')
    name = inquiry.get('user_name', '')
    email = inquiry.get('user_email', '')
    phone = inquiry.get('user_phone', '') or '—'
    ci = inquiry.get('check_in', '')
    co = inquiry.get('check_out', '')
    adults = inquiry.get('adults', 1)
    children = inquiry.get('children', 0)
    meal = inquiry.get('meal_preference', '')
    dogs = 'yes / sì' if inquiry.get('dogs') else 'no'
    sr = (inquiry.get('special_requests') or '').strip()
    if len(sr) > 1000:
        sr = sr[:1000] + '…'

    guests = f"{adults} adult(s) / adulti"
    if children:
        guests += f" + {children} child(ren) / bambini"

    lines = [
        f"Booking inquiry — {rif_name}",
        f"Richiesta di prenotazione — {rif_name}",
        "",
        f"Check-in: {ci}",
        f"Check-out: {co}",
        f"Guests / Ospiti: {guests}",
        f"Board / Trattamento: {meal}",
        f"Dog / Cane: {dogs}",
    ]
    if sr:
        lines += ["", f"Notes / Note: {sr}"]
    lines += [
        "",
        "— Guest / Ospite —",
        f"Name / Nome: {name}",
        f"Email: {email}",
        f"Phone / Telefono: {phone}",
        "",
        "Sent via Josephine. Please reply directly to the guest's email.",
        "Inviato tramite Josephine. Si prega di rispondere direttamente all'email dell'ospite.",
    ]
    return "\n".join(lines)
