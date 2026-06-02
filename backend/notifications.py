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


# Italian labels for the meal/board preference values stored on the inquiry.
_MEALS_IT = {
    'half_board': 'mezza pensione',
    'breakfast': 'colazione',
    'dinner': 'cena',
    'none': 'nessun pasto',
}


def build_inquiry_text(inquiry, rifugio=None):
    """Compose the hut-facing booking inquiry — written in ITALIAN, since the
    rifugios are Italian-speaking. Reused verbatim for the hut email body, the
    hiker's confirmation copy, and the WhatsApp/email fallback draft."""
    rif_name = inquiry.get('rifugio_name') or (rifugio or {}).get('name', 'il rifugio')
    name = inquiry.get('user_name', '')
    email = inquiry.get('user_email', '')
    phone = inquiry.get('user_phone', '') or '—'
    ci = inquiry.get('check_in', '')
    co = inquiry.get('check_out', '')
    adults = inquiry.get('adults', 1) or 1
    children = inquiry.get('children', 0) or 0
    meal = inquiry.get('meal_preference', '')
    meal_it = _MEALS_IT.get(meal, meal)
    dogs = 'sì' if inquiry.get('dogs') else 'no'
    sr = (inquiry.get('special_requests') or '').strip()
    if len(sr) > 1000:
        sr = sr[:1000] + '…'

    ospiti = f"{adults} adulto" if adults == 1 else f"{adults} adulti"
    if children:
        ospiti += f" + {children} bambino" if children == 1 else f" + {children} bambini"

    lines = [
        f"Gentile {rif_name},",
        "",
        "vorrei richiedere una prenotazione con i seguenti dettagli:",
        "",
        f"• Arrivo (check-in): {ci}",
        f"• Partenza (check-out): {co}",
        f"• Ospiti: {ospiti}",
        f"• Trattamento: {meal_it}",
        f"• Cane al seguito: {dogs}",
    ]
    if sr:
        lines.append(f"• Note / richieste particolari: {sr}")
    lines += [
        "",
        "I miei recapiti:",
        f"• Nome: {name}",
        f"• Email: {email}",
        f"• Telefono: {phone}",
        "",
        "Resto in attesa di una vostra conferma sulla disponibilità.",
        "Grazie mille e cordiali saluti,",
        f"{name}",
        "",
        "—",
        "Richiesta inviata tramite Josephine. Si prega di rispondere "
        "direttamente all'email del cliente.",
    ]
    return "\n".join(lines)
