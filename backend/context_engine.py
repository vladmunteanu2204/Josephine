"""
context_engine.py — fuse a request into one planning Context.

Turns {prompt/mood, explicit fields, origin, now} into the single object the
decision engine plans against: intent (mood-parsed) + origin (hotel/gps/area/
fallback) + conditions (weather/season/sunset/almanac) + entitlements.

Import-free of app.py: app-resident helpers (resolve_area_coords, local_now,
weather fetch) are injected, so there's no circular import.
"""
from datetime import datetime

import mood as mood_mod
import almanac

_DEFAULT_CENTER = (46.5, 11.35)   # region-wide fallback (Bolzano-ish)
_SEASON = {12: 'winter', 1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring',
           5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer',
           9: 'autumn', 10: 'autumn', 11: 'autumn'}


def build_context(body, *, resolve_area_coords, local_now, get_weather=None):
    body = body or {}
    lang = body.get('lang') or 'en'
    prompt = body.get('prompt') or body.get('mood') or body.get('message') or ''

    # ── Intent: explicit fields + mood overrides ────────────────────────────
    interests = list(body.get('interests') or [])
    difficulty_set = body.get('difficulty')
    with_dog = bool(body.get('with_dog')) or ('dog-friendly' in interests)
    family = bool(body.get('family_friendly') or body.get('family'))
    try:
        duration_hours = float(body.get('duration_hours') or body.get('duration') or 3)
    except (TypeError, ValueError):
        duration_hours = 3.0

    m = mood_mod.parse_mood(prompt, lang)
    for i in m['interests']:
        if i not in interests:
            interests.append(i)
    if with_dog or m['with_dog']:
        with_dog = True
        if 'dog-friendly' not in interests:
            interests.append('dog-friendly')
    family = family or m['family']
    if difficulty_set is None:
        difficulty_set = m['difficulty']         # may stay None
    difficulty = difficulty_set or 'any'
    difficulty_any = str(difficulty).lower() == 'any'
    mood_interests = [i for i in interests if i != 'dog-friendly']

    # ── Origin: gps > area > fallback (hotel added in Phase 2) ──────────────
    lat, lon = body.get('lat'), body.get('lon')
    start_area = body.get('start_area') or body.get('starting_area') or ''
    if lat is not None and lon is not None:
        try:
            origin = {'type': 'gps', 'name': start_area or 'your location',
                      'lat': float(lat), 'lon': float(lon)}
        except (TypeError, ValueError):
            origin = None
    else:
        origin = None
    if origin is None and start_area:
        co = resolve_area_coords(start_area)
        origin = {'type': 'area', 'name': start_area,
                  'lat': (co[0] if co else None), 'lon': (co[1] if co else None)}
    if origin is None:
        origin = {'type': 'fallback', 'name': 'South Tyrol',
                  'lat': _DEFAULT_CENTER[0], 'lon': _DEFAULT_CENTER[1]}

    # ── Conditions ──────────────────────────────────────────────────────────
    now_dt = local_now(body.get('now'))
    wlat = origin['lat'] if origin['lat'] is not None else _DEFAULT_CENTER[0]
    wlon = origin['lon'] if origin['lon'] is not None else _DEFAULT_CENTER[1]
    weather = None
    if get_weather:
        try:
            weather = get_weather(wlat, wlon)
        except Exception:  # noqa: BLE001
            weather = None
    sunset = (weather or {}).get('sunset')
    season = _SEASON.get(now_dt.month, 'summer')
    try:
        moments = almanac.active_moments(now_dt, weather, origin.get('name'), lang, 3)
    except Exception:  # noqa: BLE001
        moments = []

    return {
        'lang': lang,
        'prompt': prompt,
        'intent': {
            'mood': m['mood'],
            'interests': interests,
            'mood_interests': mood_interests,
            'avoid': m['avoid'],
            'must_have': m['must_have'],
            'difficulty': difficulty,
            'difficulty_set': difficulty_set,
            'difficulty_any': difficulty_any,
            'duration_hours': duration_hours,
            'with_dog': with_dog,
            'family': family,
            'max_distance_km': body.get('max_distance_km'),
        },
        'origin': origin,
        'conditions': {
            'now': now_dt,
            'now_iso': now_dt.isoformat(),
            'weather': weather,
            'season': season,
            'sunset': sunset,
            'active_moments': moments,
        },
        'entitlements': {'tier': 'free', 'features': []},
    }


def to_ranking_ctx(context):
    """Adapt a Context to the flat ctx dict that decision_engine.rank_trails
    expects (keeps rank_trails' Step-1 contract unchanged). For an `area`
    origin we pass the name so text-match + proximity fire; for gps/fallback we
    leave it blank (region-wide) — gps proximity is a Phase-2 refinement."""
    it = context['intent']
    origin = context['origin']
    start_area = origin['name'] if origin['type'] == 'area' else ''
    return {
        'difficulty': it['difficulty'],
        'difficulty_any': it['difficulty_any'],
        'duration_hours': it['duration_hours'],
        'mood_interests': it['mood_interests'],
        'with_dog': it['with_dog'],
        'family_friendly': it['family'],
        'start_area': start_area,
        'current_month': context['conditions']['now'].strftime('%B'),
        'max_distance_km': it.get('max_distance_km'),
        'today_str': datetime.now().strftime('%Y-%m-%d'),
    }
