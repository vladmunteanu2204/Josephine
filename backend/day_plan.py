"""
day_plan.py — realistic, departure-anchored day-plan engine.

Pure and dependency-injected (no Flask / network / app imports) so it stays
unit-testable and mirrors dispersal.py / insights.py. Given a trail, a departure
time, an origin, the day's sunset, and (optionally) a drive-time function + the
real on-route huts, it builds an honest, clock-accurate timeline:

    depart → drive → trailhead → paced hike with the REAL on-route stops →
    back at the car, before dark.

Honesty rules baked in (matching the rest of the app):
  - A place is NAMED only when it comes from the trail's own POIs or a
    verified-open hut passed in. Otherwise the step is generic and unnamed
    ("Picnic with a view"). It never invents a café/hut name.
  - The plan is validated against sunset; it never silently proposes a day that
    finishes in the dark — it flags `daylight_ok=False` with a warning.
  - The drive time labels its basis ('mapbox' vs 'estimate').

Never raises → returns a best-effort plan (or a minimal one) on bad input.
"""
import math

# ── pacing (mirrors web-frontend deriveSchedule so the timeline agrees with the
#    PDF/trail-page numbers) ────────────────────────────────────────────────────
_FLAT_KMH = 4.2          # flat walking speed
_CLIMB_MPH = 600.0       # metres of ascent per hour
_DESC_MPH = 1200.0       # metres of descent per hour of *extra* time
_PACE_FACTOR = {'relaxed': 1.2, 'average': 1.0, 'fast': 0.85}

# ── dwell + buffers (minutes) ─────────────────────────────────────────────────
_PARK_BUFFER_MIN = 10        # park + boots on
_LUNCH_MIN = 45              # sit-down at a hut
_PICNIC_MIN = 30             # bring-your-own break
_DAYLIGHT_BUFFER_MIN = 30    # be back this long before sunset
_DRIVE_FALLBACK_KMH = 38.0   # mountain-road average when no routing token

_DWELL_BY_TYPE = {
    'viewpoint': 10, 'photo_spot': 10, 'photo': 10, 'lake': 10, 'waterfall': 10,
    'summit': 15, 'peak': 15, 'cultural': 8,
    'cabin': 10, 'refuge': 10, 'rifugio': 10, 'food': 10, 'hut': 10,
}

# step kind → icon hint (frontend maps to a lucide icon)
_ICON = {
    'depart': 'car', 'drive': 'car', 'coffee': 'coffee', 'hike_start': 'footprints',
    'viewpoint': 'eye', 'photo': 'camera', 'summit': 'mountain', 'lunch': 'utensils',
    'finish': 'flag', 'drive_back': 'car',
}


def _kind_for_poi(ptype):
    t = (ptype or '').lower()
    if t in ('summit', 'peak'):
        return 'summit'
    if t in ('food', 'cabin', 'refuge', 'rifugio', 'hut'):
        return 'lunch'        # a food POI reads as a refreshment stop
    if t in ('viewpoint', 'lake', 'waterfall'):
        return 'viewpoint'
    return 'photo'


def _haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p = math.pi / 180
    dlat = (lat2 - lat1) * p
    dlon = (lon2 - lon1) * p
    a = (math.sin(dlat / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin(dlon / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def _parse_hhmm(val):
    """'8:00' / '08:00' / '2026-06-10T08:00' → minutes-from-midnight, or None."""
    if val is None:
        return None
    s = str(val)
    hm = s[11:16] if 'T' in s else s.strip()[:5]
    try:
        h, m = hm.split(':')
        h, m = int(h), int(m)
        if 0 <= h < 24 and 0 <= m < 60:
            return h * 60 + m
    except (ValueError, AttributeError):
        pass
    return None


def _fmt_min(total):
    """minutes-from-midnight → 'H:MM' (24h, no leading zero on hour)."""
    total = int(round(total)) % (24 * 60)
    return f"{total // 60}:{total % 60:02d}"


def _trailhead_latlon(trail):
    c = trail.get('coordinates')
    if isinstance(c, list) and c and isinstance(c[0], (list, tuple)) and len(c[0]) >= 2:
        return c[0][1], c[0][0]   # stored [lon, lat]
    th = (trail.get('trailhead_info') or {}).get('coordinates')
    if isinstance(th, dict) and th.get('lat') is not None:
        return th['lat'], th.get('lng', th.get('lon'))
    return None


def _cumulative_m(coords):
    cum = [0.0]
    for i in range(len(coords) - 1):
        a, b = coords[i], coords[i + 1]
        cum.append(cum[-1] + _haversine_m(a[1], a[0], b[1], b[0]))
    return cum


def _nearest_idx(coords, lon, lat, lo, hi):
    best, bestd = lo, float('inf')
    for i in range(lo, hi + 1):
        d = _haversine_m(coords[i][1], coords[i][0], lat, lon)
        if d < bestd:
            best, bestd = i, d
    return best


def _hike_offsets(trail, pace_factor):
    """Return (span_min, [(offset_min, poi_dict)]) — the hiking spine anchored to
    the verified duration_hours, with up to 4 on-route POIs placed by Naismith
    pacing (ascent leg for return trips, summit at the turnaround)."""
    coords = trail.get('coordinates') or []
    if len(coords) < 2:
        # No geometry: a single block of duration, no interior stops.
        span_h = float(trail.get('duration_hours') or 2.0) * pace_factor
        return span_h * 60.0, [], True

    last = len(coords) - 1
    cum = _cumulative_m(coords)
    total = cum[last]
    if total <= 0:
        span_h = float(trail.get('duration_hours') or 2.0) * pace_factor
        return span_h * 60.0, [], True

    gain = max(0.0, float(trail.get('elevation_gain_m') or 0))
    ttype = trail.get('trail_type')
    back_to_start = (ttype in ('out_and_back', 'loop')
                     or _haversine_m(coords[0][1], coords[0][0],
                                     coords[last][1], coords[last][0]) < 120)

    pois = [p for p in (trail.get('pois') or []) if isinstance(p, dict)
            and isinstance(p.get('coordinates'), (list, tuple)) and len(p['coordinates']) >= 2]
    summit_poi = next((p for p in pois if 'summit' in (p.get('type') or '').lower()
                       or 'peak' in (p.get('type') or '').lower()), None)

    if not back_to_start:
        turn = last
    elif summit_poi:
        turn = _nearest_idx(coords, summit_poi['coordinates'][0], summit_poi['coordinates'][1], 1, last - 1)
    else:
        turn = next((i for i, d in enumerate(cum) if d >= total / 2), last // 2) or last // 2

    up_km = cum[turn] / 1000.0
    down_km = (total - cum[turn]) / 1000.0
    t_up = up_km / _FLAT_KMH + gain / _CLIMB_MPH
    t_down = down_km / _FLAT_KMH + (gain if back_to_start else 0) / _DESC_MPH
    t_move = max(0.1, t_up + t_down)
    up_frac = t_up / t_move

    span_h = float(trail.get('duration_hours') or t_move) * pace_factor
    span_min = span_h * 60.0

    def offset_min(idx):
        if idx <= turn:
            f = cum[idx] / cum[turn] if cum[turn] > 0 else 0
            return span_min * up_frac * f
        denom = total - cum[turn]
        f = (cum[idx] - cum[turn]) / denom if denom > 0 else 1
        return span_min * up_frac + span_min * (1 - up_frac) * f

    hi = max(1, turn if back_to_start else last - 1)
    placed = []
    for p in pois:
        is_summit = summit_poi is not None and p is summit_poi
        idx = turn if is_summit else _nearest_idx(coords, p['coordinates'][0], p['coordinates'][1], 1, hi)
        if 0 < idx < last:
            placed.append((offset_min(idx), p))
    placed.sort(key=lambda x: x[0])
    return span_min, placed, back_to_start   # selection/capping happens in build_day_plan


def build_day_plan(trail, *, departure, origin=None, sunset=None, pace='average',
                   want_lunch=True, get_drive_min=None, huts=None, reverse_place=None,
                   lang='en'):
    """Build the realistic day-plan timeline. See module docstring.

    departure   : 'HH:MM'
    origin      : (lat, lon) | None  (None → start at the trailhead, no drive)
    sunset      : 'HH:MM' or ISO | None
    get_drive_min(origin_latlon, dest_latlon) → (minutes, 'mapbox') | None  (injected)
    huts        : list of {name, lat, lon, open_now, verification} already filtered
                  to on-route + usable — the engine names a lunch hut only from here.
    """
    pace = pace if pace in _PACE_FACTOR else 'average'
    pace_factor = _PACE_FACTOR[pace]
    t0 = _parse_hhmm(departure)
    if t0 is None:
        t0 = 8 * 60   # sensible default 08:00

    warnings = []
    steps = []
    th = _trailhead_latlon(trail)

    # 1) drive origin → trailhead
    drive_min, drive_basis = 0, None
    if origin and th:
        res = get_drive_min(origin, th) if get_drive_min else None
        if res:
            drive_min, drive_basis = int(round(res[0])), res[1]
        else:
            km = _haversine_m(origin[0], origin[1], th[0], th[1]) / 1000.0
            drive_min, drive_basis = int(round(km / _DRIVE_FALLBACK_KMH * 60)), 'estimate'

    clock = t0
    if origin and th:
        steps.append({'kind': 'depart', 'icon': _ICON['depart'], 'minutes': clock,
                      'time': _fmt_min(clock),
                      'label': 'Leave', 'sub': 'Set off for the trailhead'})
        clock += drive_min

    # 2) arrive + park/boot buffer
    steps.append({'kind': 'hike_start', 'icon': _ICON['hike_start'], 'minutes': clock + _PARK_BUFFER_MIN,
                  'time': _fmt_min(clock + _PARK_BUFFER_MIN),
                  'label': (trail.get('name') or 'Trailhead').split('–')[0].strip(),
                  'sub': 'Trailhead — boots on'})
    hike_start = clock + _PARK_BUFFER_MIN

    # 3) hike spine + on-route stops, with dwell accumulating
    span_min, placed, back_to_start = _hike_offsets(trail, pace_factor)

    # For a one-way (point-to-point) hike you END somewhere else — you don't
    # return to the trailhead. Name the destination so lunch/finish are honest:
    # you'd eat in the destination town at the end, not at the midpoint.
    coords = trail.get('coordinates') or []
    destination = None
    if not back_to_start and reverse_place and len(coords) >= 2:
        end = coords[-1]
        try:
            destination = reverse_place(end[1], end[0])   # nearest settlement to the finish
        except Exception:  # noqa: BLE001
            destination = None
    lunch_offset = span_min * (0.5 if back_to_start else 0.85)   # midday for loops; near the end for one-way

    # Classify placed POIs: scenic (viewpoint/summit/photo) vs food-like. Skip
    # trailhead markers and anything that blurs into the start/finish.
    scenic, food = [], []
    for off, p in placed:
        ptype = (p.get('type') or '').lower()
        name = (p.get('name') or '')
        if ptype == 'trailhead' or 'start' in name.lower():
            continue
        if off < 0.10 * span_min or off > 0.90 * span_min:
            continue
        if _kind_for_poi(ptype) == 'lunch':
            food.append((off, p))
        else:
            scenic.append((off, p))

    events = []  # (offset_min, dict-without-time)

    # exactly ONE lunch: the on-route food POI nearest midday → else a verified
    # hut → else a generic (unnamed) picnic. Other food POIs are dropped (you
    # don't stop to eat four times).
    lunch_hut = next((h for h in (huts or []) if h.get('open_now') is not False), None)
    if want_lunch:
        if not back_to_start and destination:
            # one-way hike ending in a village → you eat in the village, at the end
            events.append((lunch_offset, {
                'kind': 'lunch', 'icon': _ICON['lunch'], 'label': f'Lunch in {destination}',
                'place': destination, 'sub': "the village has plenty of options",
                'verified': True, 'dwell': _LUNCH_MIN, 'coordinates': None,
            }))
        elif food:
            off, p = min(food, key=lambda x: abs(x[0] - lunch_offset))
            events.append((off, {
                'kind': 'lunch', 'icon': _ICON['lunch'], 'label': p.get('name'),
                'place': p.get('name'), 'sub': 'Bite to eat on the way',
                'verified': True, 'dwell': _LUNCH_MIN, 'coordinates': p.get('coordinates'),
            }))
        elif lunch_hut:
            events.append((lunch_offset, {
                'kind': 'lunch', 'icon': _ICON['lunch'], 'label': lunch_hut.get('name'),
                'place': lunch_hut.get('name'), 'sub': 'Lunch at the hut',
                'verified': True, 'dwell': _LUNCH_MIN,
                'coordinates': [lunch_hut.get('lon'), lunch_hut.get('lat')]
                if lunch_hut.get('lon') is not None else None,
            }))
        else:
            events.append((lunch_offset, {
                'kind': 'lunch', 'icon': _ICON['lunch'], 'label': 'Picnic with a view',
                'place': None, 'sub': 'Bring your own — no hut on this route',
                'verified': False, 'dwell': _PICNIC_MIN, 'coordinates': None,
            }))

    # scenic stops: keep the summit + up to 2 others, evenly spread.
    summit = [x for x in scenic if _kind_for_poi((x[1].get('type') or '')) == 'summit']
    rest = [x for x in scenic if x not in summit]
    keep = max(0, 2 - len(summit)) if summit else 3
    if len(rest) > keep:
        stride = len(rest) / keep if keep else len(rest)
        rest = [rest[int(k * stride)] for k in range(keep)]
    for off, p in (summit + rest):
        kind = _kind_for_poi(p.get('type'))
        events.append((off, {
            'kind': kind, 'icon': _ICON.get(kind, 'camera'),
            'label': p.get('name'), 'place': p.get('name'),
            'sub': (p.get('type') or '').replace('_', ' ') or None,
            'verified': True, 'dwell': _DWELL_BY_TYPE.get((p.get('type') or '').lower(), 8),
            'coordinates': p.get('coordinates'),
        }))
    events.sort(key=lambda x: x[0])

    accrued = 0
    for off, ev in events:
        t = hike_start + off + accrued
        ev = dict(ev)
        dwell = ev.pop('dwell', 0)
        ev['minutes'] = int(round(t))
        ev['time'] = _fmt_min(t)
        steps.append(ev)
        accrued += dwell

    # 4) finish — back at the trailhead (loop) OR arrive at the destination (one-way)
    finish = hike_start + span_min + accrued
    if back_to_start:
        steps.append({'kind': 'finish', 'icon': _ICON['finish'], 'minutes': int(round(finish)),
                      'time': _fmt_min(finish),
                      'label': 'Back at the trailhead', 'sub': 'Hike complete'})
        # drive home (you return to your car at the trailhead)
        if origin and th and drive_min:
            steps.append({'kind': 'drive_back', 'icon': _ICON['drive_back'],
                          'minutes': int(round(finish + drive_min)),
                          'time': _fmt_min(finish + drive_min),
                          'label': 'Drive back', 'sub': f'~{drive_min} min to where you started'})
    else:
        # one-way: you ARRIVE somewhere else — don't claim a drive back to the car.
        steps.append({'kind': 'finish', 'icon': _ICON['finish'], 'minutes': int(round(finish)),
                      'time': _fmt_min(finish),
                      'label': f'Arrive in {destination}' if destination else 'Arrive at the finish',
                      'sub': "trail's end — one-way hike"})
        warnings.append('one_way_return')   # the UI/Josephine notes the return is on you

    # 6) daylight validation (be off the mountain before dusk)
    sunset_min = _parse_hhmm(sunset)
    daylight_ok = True
    if sunset_min is not None:
        latest_finish = sunset_min - _DAYLIGHT_BUFFER_MIN
        daylight_ok = finish <= latest_finish
        if not daylight_ok:
            warnings.append('finish_after_dark')

    assumptions = {
        'drive_min': drive_min, 'drive_basis': drive_basis, 'pace': pace,
        'park_buffer_min': _PARK_BUFFER_MIN,
        'lunch': ('hut' if lunch_hut else ('picnic' if want_lunch else None)),
    }

    return {
        'trail_id': trail.get('id'),
        'trail_name': trail.get('name'),
        'departure': _fmt_min(t0),
        'drive_min': drive_min,
        'drive_basis': drive_basis,
        'sunset': _fmt_min(sunset_min) if sunset_min is not None else None,
        'finish': _fmt_min(finish),
        'pace': pace,
        'daylight_ok': daylight_ok,
        'warnings': warnings,
        'assumptions': assumptions,
        'steps': steps,
        'lang': lang,
    }
