"""
insights.py — the insider-knowledge selection engine.

A trail or rifugio may carry an ``insights[]`` list. Each item is a small piece
of curated local knowledge (a photo spot, a quiet tip, which malga dish to order,
a hazard, a sunrise/sunset cue…) that can be:

  - public    → may appear on the public trail page AND in chat
  - chat_only → Josephine's "secret", only revealed in conversation

Each item may carry optional ``conditions`` (months / season / time_of_day /
weather) so the right variant surfaces for the moment, mirroring the almanac's
window+weather-gate model. Every item is verification-gated exactly like the rest
of the curated content (reusing ``decision_engine.verification_state``): we never
assert what hasn't been verified, and hazards require ``verified`` regardless of
visibility.

Pure, import-free of app.py (mirrors dispersal.py / almanac.py). Never raises.
"""
from decision_engine import verification_state, _loc

# The curated taxonomy. Extensible: add a kind here (and a label in the editor +
# locales) and it flows through with no other change. Unknown kinds pass through.
INSIGHT_KINDS = (
    'photo_spot', 'viewpoint', 'tip', 'food',
    'hazard', 'dog_tip', 'sunrise_tip', 'sunset_tip',
)

# Safety-critical kinds: only ever surfaced when explicitly verified.
HAZARD_KINDS = {'hazard'}

# Ranking weights — the more fleeting / specific, the higher it floats.
_KIND_WEIGHT = {
    'hazard': 6, 'sunrise_tip': 5, 'sunset_tip': 5, 'photo_spot': 4,
    'viewpoint': 4, 'food': 3, 'dog_tip': 3, 'tip': 2,
}


# ── time-of-day buckets ──────────────────────────────────────────────────────
def _parse_hm(val):
    """'2026-06-04T21:02' or '21:02' -> (21, 2); None on failure."""
    try:
        s = str(val)
        hhmm = s[11:16] if 'T' in s else s[:5]
        return int(hhmm[:2]), int(hhmm[3:5])
    except Exception:  # noqa: BLE001
        return None


def _time_buckets(conditions):
    """Set of time-of-day buckets active for ``now`` (and sun position if known).

    Always returns at least one clock-based bucket; adds sun-relative buckets
    (sunrise / golden_hour / sunset) when sunrise/sunset are available.
    """
    buckets = set()
    now = (conditions or {}).get('now')
    if now is None:
        return buckets
    h = now.hour + now.minute / 60.0

    # Clock-based primary bucket (always present).
    if 5 <= h < 11:
        buckets.add('morning')
    elif 11 <= h < 14:
        buckets.add('midday')
    elif 14 <= h < 18:
        buckets.add('afternoon')
    elif 18 <= h < 22:
        buckets.add('evening')
    else:
        buckets.add('night')

    weather = (conditions or {}).get('weather') or {}
    sr = _parse_hm(conditions.get('sunrise') or weather.get('sunrise'))
    ss = _parse_hm(conditions.get('sunset') or weather.get('sunset'))
    if sr:
        srh = sr[0] + sr[1] / 60.0
        if srh - 0.5 <= h <= srh + 1.5:
            buckets.add('sunrise')
    if ss:
        ssh = ss[0] + ss[1] / 60.0
        if ssh - 1.5 <= h < ssh:
            buckets.add('golden_hour')
        if ssh - 0.5 <= h <= ssh + 0.5:
            buckets.add('sunset')
    return buckets


# ── condition matching (mirrors almanac _weather_ok) ─────────────────────────
def _weather_ok(gate, weather, now):
    """True if the weather/time gate is satisfied. A present gate requires weather
    to be known (we never assert a condition we can't verify) — fail closed."""
    if not gate:
        return True
    if gate.get('from_hour') is not None and now is not None and now.hour < gate['from_hour']:
        return False
    if not weather:
        return False
    if 'max_cloud_pct' in gate and (weather.get('clouds') or 100) > gate['max_cloud_pct']:
        return False
    if gate.get('recent_snow') and 'snow' not in (weather.get('description') or '').lower():
        return False
    return True


def _conditions_match(conds, context):
    """Does this insight's optional conditions fit the current context?
    Absent/empty conditions → always eligible. Each sub-check is guarded; only the
    weather gate fails closed (matches the almanac never-fabricate rule)."""
    if not conds:
        return True
    cond = (context or {}).get('conditions') or {}
    now = cond.get('now')

    months = conds.get('months')
    if months and now is not None:
        try:
            if now.strftime('%B') not in months:
                return False
        except Exception:  # noqa: BLE001
            pass

    season = conds.get('season')
    if season:
        cur = cond.get('season')
        if cur and cur not in season:
            return False

    tod = conds.get('time_of_day')
    if tod:
        if not (_time_buckets(cond) & set(tod)):
            return False

    gate = conds.get('weather')
    if gate and not _weather_ok(gate, cond.get('weather'), now):
        return False

    return True


# ── verification gate ────────────────────────────────────────────────────────
def _passes_gate(insight, parent_record):
    """Effective verification status = the item's own block if present, else the
    parent record's. public → verified|editorial; hazard → verified only."""
    own = insight.get('verification')
    status = verification_state(insight) if own else verification_state(parent_record)
    kind = (insight.get('kind') or '').lower()
    if kind in HAZARD_KINDS:
        return status == 'verified'
    return status in ('verified', 'editorial')


# ── public API ───────────────────────────────────────────────────────────────
def select_insights(record, context, *, visibility=None, limit=4, ignore_conditions=False):
    """Return localized, gated, context-matched insights for a trail/rifugio.

    visibility: 'public' | 'chat_only' | None (any). Returns slim dicts:
    {id, kind, text, coordinates?}. Never raises → [] on any failure.

    ignore_conditions=True skips the season/time/weather gate — used by the
    public trail page (browsed anytime), where conditions are annotations, not a
    live moment. Chat delivery keeps conditions on (moment-aware).
    """
    try:
        items = (record or {}).get('insights') or []
        lang = (context or {}).get('lang', 'en')
        out = []
        for it in items:
            if not isinstance(it, dict):
                continue
            vis = (it.get('visibility') or 'public').lower()
            if visibility and vis != visibility:
                continue
            if not _passes_gate(it, record):
                continue
            if not ignore_conditions and not _conditions_match(it.get('conditions'), context):
                continue
            text = _loc(it.get('text'), lang).strip()
            if not text:
                continue
            specificity = 3 if it.get('conditions') else 0
            if it.get('coordinates'):
                specificity += 1
            weight = _KIND_WEIGHT.get((it.get('kind') or '').lower(), 1)
            slim = {'id': it.get('id'), 'kind': it.get('kind') or 'tip', 'text': text}
            if it.get('coordinates'):
                slim['coordinates'] = it['coordinates']
            out.append((weight + specificity, slim))
        out.sort(key=lambda x: -x[0])
        return [s for _, s in out[:limit]]
    except Exception as e:  # noqa: BLE001
        print(f'[insights] select_insights failed: {e}')
        return []


def count_insights(record, context, *, visibility='chat_only', ignore_conditions=True):
    """How many insights of a given visibility exist. Used by the public trail
    page to tease 'N more secrets' without leaking the text. ignore_conditions
    defaults True so the teaser count is stable regardless of time of day."""
    return len(select_insights(record, context, visibility=visibility, limit=999,
                               ignore_conditions=ignore_conditions))


# ── Live Trail Companion: geo-anchored "moments" ─────────────────────────────
# Per-kind Josephine voice leads ({t} = the localized insight text).
_MOMENT_LEAD = {
    'photo_spot':  {'en': '📷 Stop here — {t}', 'it': '📷 Fermati qui — {t}', 'de': '📷 Halt kurz — {t}'},
    'viewpoint':   {'en': '◉ Look up — {t}',    'it': '◉ Guarda — {t}',       'de': '◉ Schau — {t}'},
    'tip':         {'en': '💡 {t}',             'it': '💡 {t}',               'de': '💡 {t}'},
    'food':        {'en': '🍽 {t}',             'it': '🍽 {t}',               'de': '🍽 {t}'},
    'hazard':      {'en': '⚠ Careful — {t}',    'it': '⚠ Attenzione — {t}',   'de': '⚠ Vorsicht — {t}'},
    'dog_tip':     {'en': '🐾 {t}',             'it': '🐾 {t}',               'de': '🐾 {t}'},
    'sunrise_tip': {'en': '🌅 {t}',             'it': '🌅 {t}',               'de': '🌅 {t}'},
    'sunset_tip':  {'en': '🌇 {t}',             'it': '🌇 {t}',               'de': '🌇 {t}'},
}
_MOMENT_ICON = {
    'photo_spot': '📷', 'viewpoint': '◉', 'tip': '💡', 'food': '🍽',
    'hazard': '⚠', 'dog_tip': '🐾', 'sunrise_tip': '🌅', 'sunset_tip': '🌇',
    'summit': '⛰', 'refuge': '🏠', 'rifugio': '🏠', 'lake': '💧',
    'waterfall': '💧', 'cultural': '◆', 'peak': '⛰', 'forest': '🌲', 'poi': '📍',
}
_PLACE_NEAR = {'en': "You're nearing {n}", 'it': 'Stai arrivando a {n}', 'de': 'Du näherst dich {n}'}


def _coord_pair(c):
    """Normalize a coordinate to (lat, lon) floats from {lat,lon}/{lat,lng} or
    a [lon,lat] pair. None if unusable."""
    try:
        if isinstance(c, dict):
            lat = c.get('lat')
            lon = c.get('lon', c.get('lng'))
            return (float(lat), float(lon)) if lat is not None and lon is not None else None
        if isinstance(c, (list, tuple)) and len(c) >= 2:
            return (float(c[1]), float(c[0]))   # GeoJSON [lon, lat]
    except (TypeError, ValueError):
        return None
    return None


def geo_moments(trail, context, *, default_radius=150):
    """Merge a trail's geo-anchored moments (verified insights incl. chat-only
    secrets + checkpoints + POIs) into one localized, Josephine-voiced list for the
    Live Trail Companion. Never raises → []."""
    try:
        lang = (context or {}).get('lang', 'en')
        lg = lang if lang in ('en', 'it', 'de') else 'en'
        out = []

        # Insights with coordinates (public + chat_only; verification-gated).
        for ins in select_insights(trail, context, visibility=None, limit=99,
                                   ignore_conditions=True):
            pair = _coord_pair(ins.get('coordinates'))
            if not pair:
                continue
            kind = (ins.get('kind') or 'tip').lower()
            lead = (_MOMENT_LEAD.get(kind) or _MOMENT_LEAD['tip'])
            line = lead.get(lg, lead['en']).format(t=ins['text'])
            out.append({'id': ins.get('id') or f'ins-{len(out)}', 'kind': kind,
                        'lat': pair[0], 'lon': pair[1], 'radius_m': default_radius,
                        'title': ins['text'][:40], 'line': line,
                        'icon': _MOMENT_ICON.get(kind, '✦'), 'source': 'insight'})

        # Checkpoints.
        for i, cp in enumerate(trail.get('checkpoints') or []):
            pair = _coord_pair(cp.get('coordinates'))
            if not pair:
                continue
            name = cp.get('name') or 'a waypoint'
            typ = (cp.get('type') or 'poi').lower()
            out.append({'id': f'cp-{i}', 'kind': typ, 'lat': pair[0], 'lon': pair[1],
                        'radius_m': cp.get('alert_distance') or 200,
                        'title': name, 'line': _PLACE_NEAR[lg].format(n=name),
                        'icon': _MOMENT_ICON.get(typ, '📍'), 'source': 'checkpoint'})

        # POIs.
        for i, poi in enumerate(trail.get('pois') or trail.get('points_of_interest') or []):
            pair = _coord_pair(poi.get('coordinates'))
            if not pair:
                continue
            name = poi.get('name') or 'a spot'
            typ = (poi.get('type') or 'poi').lower()
            out.append({'id': f'poi-{i}', 'kind': typ, 'lat': pair[0], 'lon': pair[1],
                        'radius_m': 200, 'title': name,
                        'line': _PLACE_NEAR[lg].format(n=name),
                        'icon': _MOMENT_ICON.get(typ, '📍'), 'source': 'poi'})

        return out
    except Exception as e:  # noqa: BLE001
        print(f'[insights] geo_moments failed: {e}')
        return []
