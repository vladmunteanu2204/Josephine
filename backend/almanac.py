"""
almanac.py — the Living Almanac engine.

Surfaces fleeting, real South Tyrol "moments" (larch gold, enrosadira tonight,
Almabtrieb, Christmas markets…) that are *currently* live, given the date window
and — for weather-gated moments — live conditions. Pure, testable functions; the
chat renders them in Josephine's voice.

Never fabricates: a moment only appears when its date window AND its weather gate
are satisfied. Year-varying events are phrased approximately in almanac.json.
"""
import os
import json
import time
from datetime import date

_ALMANAC_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'almanac.json')
_CACHE_TTL = 300
_cache = {'data': None, 'loaded_at': 0.0}

# Short, localized validity labels (the ephemerality cue).
_VALIDITY = {
    'tonight':  {'en': 'tonight',         'it': 'stasera',          'de': 'heute Abend'},
    'fewDays':  {'en': 'last few days',    'it': 'ultimi giorni',    'de': 'nur noch wenige Tage'},
    'thisWeek': {'en': 'this week',        'it': 'questa settimana', 'de': 'diese Woche'},
    'nowOn':    {'en': 'on now',           'it': 'in corso',         'de': 'jetzt'},
}


def _lg(lang):
    return (lang or 'en')[:2] if (lang or 'en')[:2] in ('en', 'it', 'de') else 'en'


def load_almanac():
    """Load almanac moments (TTL-cached), mirroring load_hotspots."""
    now = time.time()
    if _cache['data'] is not None and now - _cache['loaded_at'] < _CACHE_TTL:
        return _cache['data']
    data = []
    try:
        with open(_ALMANAC_PATH, encoding='utf-8') as f:
            data = json.load(f).get('moments', [])
    except Exception as e:  # noqa: BLE001
        print(f'[almanac] could not load almanac.json: {e}')
    _cache['data'] = data
    _cache['loaded_at'] = now
    return data


def _md(s):
    """'10-01' -> (10, 1)."""
    return int(s[:2]), int(s[3:5])


def _in_window(now, window):
    """Is `now` (datetime) within the MM-DD window? Year-wrap aware."""
    f, t = window.get('from'), window.get('to')
    if not f or not t:
        return True
    cur, fm, tm = (now.month, now.day), _md(f), _md(t)
    if fm <= tm:
        return fm <= cur <= tm
    return cur >= fm or cur <= tm   # wraps the year end (e.g. Christmas markets)


def _days_left(now, window):
    """Whole days until the window's `to` (this year or next). None if open."""
    t = window.get('to')
    if not t:
        return None
    tm = _md(t)
    today = now.date()
    end = date(today.year, tm[0], tm[1])
    if end < today:
        end = date(today.year + 1, tm[0], tm[1])
    return (end - today).days


def _weather_ok(moment, weather, now):
    """True if the moment's weather/time gate is satisfied. Gated moments require
    weather to be present (we never assert a condition we can't verify)."""
    gate = moment.get('weather_gate')
    if not gate:
        return True
    if gate.get('from_hour') is not None and now.hour < gate['from_hour']:
        return False
    if not weather:
        return False
    if 'max_cloud_pct' in gate and (weather.get('clouds') or 100) > gate['max_cloud_pct']:
        return False
    if gate.get('recent_snow') and 'snow' not in (weather.get('description') or '').lower():
        return False
    return True


def _validity_label(moment, days_left, lang):
    lg = _lg(lang)
    if moment.get('type') == 'condition' or (moment.get('weather_gate') or {}).get('from_hour') is not None:
        return _VALIDITY['tonight'][lg]
    if days_left is not None and days_left <= 3:
        return _VALIDITY['fewDays'][lg]
    if days_left is not None and days_left <= 9:
        return _VALIDITY['thisWeek'][lg]
    return _VALIDITY['nowOn'][lg]


def _pick_area(moment, area):
    areas = moment.get('areas') or []
    if area:
        al = area.lower()
        for a in areas:
            if al in a.lower() or a.lower() in al:
                return a
    return areas[0] if areas else ''


def _sunset_hhmm(weather):
    s = (weather or {}).get('sunset') or ''
    return s[11:16] if len(s) >= 16 else ''


def _render(moment, days_left, weather, area, lang):
    lg = _lg(lang)
    voice = (moment.get('voice', {}).get(lg) or moment.get('voice', {}).get('en') or '')
    share = (moment.get('share', {}).get(lg) or moment.get('share', {}).get('en') or '')
    a = _pick_area(moment, area)
    sunset = _sunset_hhmm(weather)
    for k, v in (('{area}', a), ('{sunset}', sunset)):
        voice = voice.replace(k, v)
        share = share.replace(k, v)
    return {
        'id': moment.get('id'),
        'type': moment.get('type'),
        'emoji': moment.get('emoji', ''),
        'voice': voice.strip(),
        'share': share.strip(),
        'validity': _validity_label(moment, days_left, lang),
        'cta': moment.get('cta'),
    }


def active_moments(now, weather=None, area=None, lang='en', limit=3):
    """Ranked list of moments live *right now*. Sorted by weight + ephemerality
    boost (closing soon ranks higher) + area proximity. Never raises."""
    try:
        scored = []
        for m in load_almanac():
            w = m.get('window', {})
            if not _in_window(now, w):
                continue
            if not _weather_ok(m, weather, now):
                continue
            dl = _days_left(now, w)
            score = float(m.get('weight', 5))
            if dl is not None and dl <= 7:
                score += (8 - dl) * 0.5          # ephemerality: closing soon wins
            if area and m.get('areas'):
                al = area.lower()
                if any(al in a.lower() or a.lower() in al for a in m['areas']):
                    score += 3
            scored.append((score, dl if dl is not None else 999, m))
        scored.sort(key=lambda x: (-x[0], x[1]))
        return [_render(m, (None if dl == 999 else dl), weather, area, lang)
                for _, dl, m in scored[:max(1, limit)]]
    except Exception as e:  # noqa: BLE001
        print(f'[almanac] active_moments failed: {e}')
        return []


def validate_almanac():
    """Startup sanity check — logs locale-parity / window issues, never raises."""
    issues = 0
    for m in load_almanac():
        mid = m.get('id', '?')
        if not (m.get('voice', {}).get('en') and m.get('voice', {}).get('it') and m.get('voice', {}).get('de')):
            print(f"[almanac] WARN {mid}: voice missing a locale"); issues += 1
        w = m.get('window', {})
        try:
            _md(w.get('from', '')); _md(w.get('to', ''))
        except Exception:
            print(f"[almanac] WARN {mid}: bad window {w}"); issues += 1
    if not issues:
        print(f"[almanac] OK — {len(load_almanac())} moments, locale parity verified")
    return issues
