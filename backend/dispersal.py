"""
dispersal.py — crowd-dispersal + temporal-intelligence engine.

Pure, self-contained (no Flask/app imports) so it stays unit-testable and
reusable by the chat today and the future Today-Near-Me / Concierge surfaces.

Given a trail + the current time + weather, it decides whether the trail is an
overcrowded South Tyrol hotspot under pressure right now and what to advise:
go early (beat the crowds), go to a quieter quality-matched alternative
(peak now), plan it for tomorrow morning (late in the day), or watch the
daylight (won't finish before dusk). The recommend endpoint uses crowd_pressure
to demote hotspots at peak and attaches decide()'s signal to the top pick; the
frontend renders the voiced, localized message.

Level 0 (time/season/crowding/weekend heuristics) + Level 1 (curated
hotspots.json). Level 2 (real-time Open Data Hub parking/traffic) is out of
scope here.
"""

import os
import json
import math
import time
from datetime import datetime, timedelta

_HOTSPOTS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'hotspots.json')

# Fixed month names so peak-month checks never depend on server locale (strftime
# %B is locale-sensitive).
_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
           'July', 'August', 'September', 'October', 'November', 'December']

_CROWD_BASE = {'low': 0.2, 'medium': 0.5, 'high': 0.85}
_DAYLIGHT_BUFFER_MIN = 30   # finish this long before sunset to be safe

_cache = {'data': None, 'loaded_at': 0.0}
_CACHE_TTL = 300  # seconds


def load_hotspots():
    """Load + cache the curated hotspot list. Never raises (returns [] on error)."""
    now = time.time()
    if _cache['data'] is not None and now - _cache['loaded_at'] < _CACHE_TTL:
        return _cache['data']
    try:
        with open(_HOTSPOTS_PATH, 'r') as f:
            data = json.load(f).get('hotspots', [])
    except Exception as e:
        print(f'[dispersal] could not load hotspots.json: {e}')
        data = []
    _cache['data'] = data
    _cache['loaded_at'] = now
    return data


def validate_hotspots(trail_ids):
    """Log a warning for any hotspot match/alternative referencing a trail id
    that isn't in the published set. Call once at startup with the real ids."""
    ids = set(trail_ids or [])
    for h in load_hotspots():
        for tid in h.get('match', {}).get('trail_ids', []):
            if tid not in ids:
                print(f"[dispersal] hotspot {h['id']}: match trail_id '{tid}' not found")
        for a in h.get('alternatives', []):
            if a.get('trail_id') not in ids:
                print(f"[dispersal] hotspot {h['id']}: alternative '{a.get('trail_id')}' not found")


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p = math.pi / 180
    dlat = (lat2 - lat1) * p
    dlon = (lon2 - lon1) * p
    a = (math.sin(dlat / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin(dlon / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def _trail_first_coord(trail):
    """Best-effort (lat, lon) for a trail; None if unknown."""
    c = trail.get('coordinates')
    if isinstance(c, list) and c and isinstance(c[0], (list, tuple)) and len(c[0]) >= 2:
        return c[0][1], c[0][0]   # stored [lon, lat]
    th = (trail.get('trailhead_info') or {}).get('coordinates')
    if isinstance(th, dict) and th.get('lat') is not None:
        return th['lat'], th.get('lng', th.get('lon'))
    return None


def match_hotspot(trail, hotspots=None):
    """Return the hotspot this trail belongs to, or None. Priority:
    explicit trail_ids → name/region keywords → coordinate radius."""
    if hotspots is None:
        hotspots = load_hotspots()
    tid = trail.get('id')
    haystack = f"{trail.get('name', '')} {trail.get('region', '')}".lower()

    for h in hotspots:
        if tid and tid in h.get('match', {}).get('trail_ids', []):
            return h
    for h in hotspots:
        kws = h.get('match', {}).get('name_keywords', [])
        if any(kw in haystack for kw in kws):
            return h
    coord = _trail_first_coord(trail)
    if coord and coord[1] is not None:
        for h in hotspots:
            hc = h.get('coordinates') or {}
            r = h.get('match', {}).get('radius_km', 0)
            if hc.get('lat') is not None and r:
                if _haversine_km(coord[0], coord[1], hc['lat'], hc['lng']) <= r:
                    return h
    return None


def _is_fair_weather(weather):
    desc = (weather or {}).get('description', '').lower()
    if any(w in desc for w in ('rain', 'shower', 'drizzle', 'storm', 'thunder', 'snow')):
        return False
    return any(w in desc for w in ('clear', 'sun', 'mainly')) or not desc


def crowd_pressure(trail, hotspot, now, weather=None):
    """Estimate how busy this trail is *right now*, 0..1. Combines static
    crowding level, peak month, peak hour window, weekend, and fair weather."""
    crowding = trail.get('crowding') or {}
    p = _CROWD_BASE.get(str(crowding.get('level', 'medium')).lower(), 0.5)
    if hotspot:
        p = max(p, 0.7)   # hotspots are inherently busy

    month = _MONTHS[now.month - 1]
    peak = (hotspot or {}).get('peak', {})
    peak_months = peak.get('months') or crowding.get('peak_months') or []
    if peak_months:
        p *= 1.0 if month in peak_months else 0.5

    hours = peak.get('hours')
    if hours and len(hours) == 2:
        p *= 1.0 if hours[0] <= now.hour < hours[1] else 0.4

    if now.weekday() >= 5:   # Sat/Sun
        p *= peak.get('weekend_multiplier', 1.3)

    if weather is not None:
        p *= 1.1 if _is_fair_weather(weather) else 0.6

    return max(0.0, min(1.0, p))


def _parse_iso(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace('Z', ''))
    except (ValueError, TypeError):
        return None


def decide(trail, hotspot, now, sunset=None, travel_min=0, duration_h=None, weather=None):
    """Return the structured dispersal signal for the chat to voice.

    reason_code ∈ {beat_crowds, peak_today, plan_tomorrow, daylight_risk, none}
    """
    is_hotspot = hotspot is not None
    pressure = crowd_pressure(trail, hotspot, now, weather)

    month = _MONTHS[now.month - 1]
    peak = (hotspot or {}).get('peak', {})
    peak_months = peak.get('months') or []
    hours = peak.get('hours') or [9, 16]
    in_peak_month = (month in peak_months) if peak_months else False
    start_h, end_h = hours[0], hours[1]

    peak_now = is_hotspot and in_peak_month and (start_h <= now.hour < end_h)
    beat_crowds = is_hotspot and in_peak_month and (now.hour < start_h)
    late_in_day = is_hotspot and in_peak_month and (now.hour >= end_h - 2)

    # Daylight: would we finish (travel + hike) before sunset (minus buffer)?
    daylight_ok = True
    sunset_dt = _parse_iso(sunset)
    if sunset_dt and duration_h:
        finish = now + timedelta(minutes=travel_min or 0) + timedelta(hours=duration_h)
        daylight_ok = finish <= (sunset_dt - timedelta(minutes=_DAYLIGHT_BUFFER_MIN))

    if not daylight_ok:
        reason = 'daylight_risk'
    elif beat_crowds:
        reason = 'beat_crowds'
    elif late_in_day:
        reason = 'plan_tomorrow'
    elif peak_now and pressure >= 0.6:
        reason = 'peak_today'
    else:
        reason = 'none'

    suggest_tomorrow = reason in ('plan_tomorrow', 'daylight_risk')
    show_alternative = reason in ('peak_today', 'plan_tomorrow', 'daylight_risk')
    access_note = (hotspot or {}).get('access_note') if (is_hotspot and reason != 'none') else None

    return {
        'is_hotspot': is_hotspot,
        'hotspot_id': hotspot.get('id') if hotspot else None,
        'hotspot_name': hotspot.get('name') if hotspot else None,
        'pressure': round(pressure, 2),
        'peak_now': peak_now,
        'beat_crowds': beat_crowds,
        'daylight_ok': daylight_ok,
        'suggest_tomorrow': suggest_tomorrow,
        'show_alternative': show_alternative,
        'reason_code': reason,
        'access_note': access_note,   # localized {en,it,de} dict or None
    }
