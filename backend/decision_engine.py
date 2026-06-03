"""
decision_engine.py — trail scoring + ranking.

Phase 1 / Step 1 of the strangler refactor: the per-trail scoring and the
retrieve→reject→rank pipeline, extracted verbatim from get_recommendations so
behaviour is byte-identical. Pure and import-free of app.py — the geo helpers
(resolve_area_coords, trail_centroid, haversine) are injected, so there's no
circular import. Later steps add plan composition on top of rank_trails().
"""
import random

_MONTHS_ORDER = ['January', 'February', 'March', 'April', 'May', 'June',
                 'July', 'August', 'September', 'October', 'November', 'December']

# Generic geographic words that appear in many trail descriptions and must not
# be used as area-matching tokens on their own.
_GEO_STOPWORDS = {
    'lago', 'lake', 'val', 'valle', 'tal', 'berg', 'alpe', 'alm',
    'pass', 'passo', 'wald', 'forst', 'monte', 'mount', 'peak',
    'nord', 'sud', 'west', 'east', 'alto', 'bassa', 'upper', 'lower',
}

NEAR_RADIUS_KM = 45.0


def _season_status(current_month, best_season):
    """Classify the current month vs a trail's best_season as
    'in' / 'shoulder' (immediately adjacent) / 'out'. Shoulder months (e.g.
    early October just after a Jun–Sep season) get no penalty — they're often
    the quietest, finest windows."""
    season = {_MONTHS_ORDER.index(m) for m in best_season if m in _MONTHS_ORDER}
    if not season:
        return 'in'
    cur = _MONTHS_ORDER.index(current_month) if current_month in _MONTHS_ORDER else -1
    if cur in season:
        return 'in'
    if any((abs(cur - s) == 1) or (abs(cur - s) == 11) for s in season):  # 11 = Dec/Jan wrap
        return 'shoulder'
    return 'out'


def _season_range_label(best_season):
    nums = sorted(_MONTHS_ORDER.index(m) for m in best_season if m in _MONTHS_ORDER)
    return f"{_MONTHS_ORDER[nums[0]]}–{_MONTHS_ORDER[nums[-1]]}" if nums else ''


def _search_fields(trail):
    """The text blob an area name is matched against (region/name/access/etc.)."""
    return ' '.join([
        trail.get('region') or '',
        trail.get('name') or '',
        trail.get('access_info') or '',
        str((trail.get('trailhead_info') or {}).get('parking', '')),
        (trail.get('description') or '')[:200],
        str((trail.get('transport') or {}).get('car', '')),
    ]).lower()


def score_trail(trail, ctx):
    """Score one trail under the request context. Returns (score, reasons,
    warnings). Behaviour identical to the previous inline loop body."""
    difficulty      = ctx['difficulty']
    difficulty_any  = ctx['difficulty_any']
    duration_hours  = ctx['duration_hours']
    mood_interests  = ctx['mood_interests']
    with_dog        = ctx['with_dog']
    family_friendly = ctx['family_friendly']
    start_area      = ctx['start_area']
    current_month   = ctx['current_month']

    score = 0
    reasons = []
    warnings = []

    # Safe-defaulted core fields — production DB rows may have NULLs.
    t_difficulty = (trail.get('difficulty') or 'medium')
    try:
        t_duration = float(trail.get('duration_hours') or 3)
    except (TypeError, ValueError):
        t_duration = 3.0

    # ── Difficulty ──────────────────────────────────────────────
    if difficulty_any:
        pass
    elif t_difficulty.lower() == difficulty.lower():
        score += 4
        reasons.append(t_difficulty)
    elif (difficulty == 'medium' and t_difficulty == 'easy') or \
         (difficulty == 'hard'   and t_difficulty == 'medium'):
        score += 1

    # ── Duration ────────────────────────────────────────────────
    duration_diff = abs(t_duration - duration_hours)
    if duration_diff <= 0.5:
        score += 3
    elif duration_diff <= 1.5:
        score += 2
    elif duration_diff > 2.5:
        score -= 1

    # ── Interest / mood — interests + tags + partial keyword ────
    trail_keywords = set(
        [i.lower() for i in trail.get('interests', [])] +
        [t.lower() for t in trail.get('tags', [])]
    )
    for interest in mood_interests:
        interest_lower = interest.lower()
        if interest_lower in trail_keywords:
            score += 3
            reasons.append(interest)
        elif any(interest_lower.split()[0] in kw for kw in trail_keywords):
            score += 1
            reasons.append(interest)

    if 'loop' in mood_interests and trail.get('trail_type', '').lower() == 'loop':
        score += 2

    # ── Dog-friendly (non-dog trails are hard-filtered later) ────
    if with_dog and trail.get('dog_friendly'):
        score += 3
        reasons.append("dog-friendly")

    # ── Family-friendly ─────────────────────────────────────────
    if family_friendly:
        if trail.get('family_friendly'):
            score += 3
            reasons.append("family-friendly")
        elif t_difficulty == 'hard':
            score -= 5

    # ── Location ────────────────────────────────────────────────
    if start_area:
        area_l = start_area.lower()
        search_fields = _search_fields(trail)
        if area_l in search_fields:
            score += 6
            reasons.append(f"near {start_area}")
        elif any(
            word in search_fields
            for word in area_l.split()
            if len(word) > 3 and word not in _GEO_STOPWORDS
        ):
            score += 2

    # ── Season awareness (shoulder-aware) ───────────────────────
    best_season = trail.get('best_season', [])
    if best_season:
        status = _season_status(current_month, best_season)
        if status == 'in':
            score += 2
        elif status == 'out':
            score -= 2
            warnings.append(f"best visited {_season_range_label(best_season)}")

    return score, reasons, warnings


def rank_trails(trails, ctx, *, resolve_area_coords, trail_centroid, haversine):
    """Retrieve → reject → rank. Returns (scored_sorted, signal) where signal is
    None or {'kind': 'area_not_found'|'no_dog_friendly', 'area': str}. Behaviour
    identical to the previous inline pipeline."""
    start_area      = ctx['start_area']
    with_dog        = ctx['with_dog']
    max_distance_km = ctx.get('max_distance_km')

    # Hard distance filter — only when a max was specified.
    if max_distance_km:
        trails = [t for t in trails if (t.get('distance_km') or 999) <= float(max_distance_km)]

    scored_trails = []
    for trail in trails:
        score, reasons, warnings = score_trail(trail, ctx)
        scored_trails.append({'trail': trail, 'score': score,
                              'reasons': reasons, 'warnings': warnings})

    # Area requested → hard-filter to trails that actually mention it; else
    # fall back to physical proximity; else signal "not found".
    if start_area:
        area_tokens = [w for w in start_area.lower().split() if len(w) > 3]
        specific_tokens = [w for w in area_tokens if w not in _GEO_STOPWORDS] or area_tokens
        area_matched = [
            item for item in scored_trails
            if f"near {start_area}" in item['reasons']
            or any(word in _search_fields(item['trail']) for word in specific_tokens)
        ]
        if area_matched:
            scored_trails = area_matched
        else:
            origin = resolve_area_coords(start_area)
            near = []
            if origin:
                for item in scored_trails:
                    ctr = trail_centroid(item['trail'])
                    if not ctr:
                        continue
                    dist = haversine(origin[0], origin[1], ctr[0], ctr[1])
                    if dist <= NEAR_RADIUS_KM:
                        item['score'] += max(0.0, 6.0 - dist / 9.0)
                        item['reasons'].append(f"near {start_area}")
                        near.append(item)
            if near:
                scored_trails = near
            else:
                return [], {'kind': 'area_not_found', 'area': start_area}

    # Hiking with a dog → only dog-friendly trails; honest signal if none.
    if with_dog:
        dog_ok = [it for it in scored_trails if it['trail'].get('dog_friendly')]
        if dog_ok:
            scored_trails = dog_ok
        else:
            return [], {'kind': 'no_dog_friendly', 'area': start_area or ''}

    # Daily jitter — stable within a day, rotates each morning.
    daily_rng = random.Random(ctx['today_str'])
    for item in scored_trails:
        item['score'] += daily_rng.uniform(0, 0.8)

    scored_trails.sort(key=lambda x: x['score'], reverse=True)
    return scored_trails, None


# ───────────────────────── Plan composition (Phase 1 / Step 3) ──────────────
# Compose a single Daily Plan Card from the ranked candidates + context. Pure
# and guarded; dispersal + resolve_nearby_rifugios are injected (no app import).
from datetime import datetime as _dt, timedelta as _td

_DIFF_EFFORT = {'easy': 'gentle', 'medium': 'a steady effort', 'hard': 'a real climb'}


def _loc(val, lang):
    """A trail/rifugio field that may be a {en,it,de} dict or a plain string."""
    if isinstance(val, dict):
        return val.get((lang or 'en')[:2]) or val.get('en') or next(iter(val.values()), '')
    return val or ''


def _clock(iso):
    """'2026-06-03T21:02' -> (21, 2) or None."""
    try:
        hhmm = iso[11:16]
        return int(hhmm[:2]), int(hhmm[3:5])
    except Exception:
        return None


def _fmt_hm(h, m):
    return f"{int(h):02d}:{int(m):02d}"


def _refusal_plan(context, message):
    return {
        'plan_id': f"plan_{int(_dt.now().timestamp())}",
        'lang': context.get('lang', 'en'),
        'confidence': 'low',
        'title': None,
        'trail': None,
        'josephine_says': message,
        'safety': {'level': 'avoid', 'message': message},
        'alternatives': [],
    }


def compose_plan(context, ranked, *, resolve_nearby_rifugios, dispersal_mod):
    """Build one Daily Plan Card. Never raises — degrades to a refusal/caution."""
    try:
        lang = context.get('lang', 'en')
        cond = context['conditions']
        intent = context['intent']
        origin = context['origin']
        now = cond['now']
        sunset = cond.get('sunset')
        weather = cond.get('weather') or {}
        moments = cond.get('active_moments') or []

        if not ranked:
            return _refusal_plan(context,
                                 "I couldn't find a safe, good fit for those exact constraints today — "
                                 "tell me a bit more (more time, or somewhere lower) and I'll try again.")

        pick = ranked[0]
        trail = pick['trail']
        reasons = pick.get('reasons') or []
        warnings = pick.get('warnings') or []
        try:
            duration_h = float(trail.get('duration_hours') or intent.get('duration_hours') or 3)
        except (TypeError, ValueError):
            duration_h = 3.0

        # Dispersal signal (timing / crowd / daylight / access).
        try:
            hotspot = dispersal_mod.match_hotspot(trail)
            sig = dispersal_mod.decide(trail, hotspot, now, sunset, 0, duration_h, weather)
        except Exception:  # noqa: BLE001
            sig = {'reason_code': 'none', 'daylight_ok': True, 'beat_crowds': False,
                   'peak_now': False, 'access_note': None, 'show_alternative': False}

        # ── Timing ──────────────────────────────────────────────────────────
        if sig.get('beat_crowds') or sig.get('peak_now'):
            suggested_start = '07:30'
            t_reason = 'beat the crowds and the parking'
        elif cond.get('season') == 'summer':
            suggested_start = '08:00'
            t_reason = 'be off the exposed ground before afternoon storms'
        else:
            suggested_start = '09:00'
            t_reason = 'an easy, unhurried start'
        latest = None
        clk = _clock(sunset) if sunset else None
        if clk:
            mins = clk[0] * 60 + clk[1] - int((duration_h + 1.0) * 60)   # finish + 1h buffer
            if mins > 0:
                latest = _fmt_hm(mins // 60, mins % 60)
        timing = {'suggested_start': suggested_start, 'latest_safe_start': latest,
                  'sunset': _fmt_hm(*clk) if clk else None, 'reason': t_reason}

        # ── Hut pairing ─────────────────────────────────────────────────────
        hut = None
        try:
            huts = resolve_nearby_rifugios(trail.get('nearby_rifugios', []))
            chosen = next((h for h in huts if h.get('open_now') is not False), huts[0] if huts else None)
            if chosen:
                hut = {'id': chosen.get('id'), 'name': chosen.get('name'),
                       'type': chosen.get('type', 'rifugio'),
                       'open_now': chosen.get('open_now'),
                       'note': _loc(chosen.get('josephine_note'), lang)[:160]}
        except Exception:  # noqa: BLE001
            hut = None

        # ── Access ──────────────────────────────────────────────────────────
        transport = trail.get('transport') or {}
        access = {
            'by_car': transport.get('car') or '',
            'by_transport': transport.get('bus') or '',
            'parking': str((trail.get('trailhead_info') or {}).get('parking', '')) or '',
            'reservation_required': bool(sig.get('access_note')),
        }

        # ── Weather summary ─────────────────────────────────────────────────
        wsummary = ''
        if weather:
            desc = weather.get('description', '')
            temp = weather.get('temperature')
            wsummary = f"{desc} · {temp}°C" if temp is not None else desc
        weather_out = {'summary': wsummary, 'wind_kmh': weather.get('wind_speed')}

        # ── Signals (qualitative — never a number) ──────────────────────────
        signals = []
        crowding = (trail.get('crowding') or {})
        if sig.get('beat_crowds'):
            signals.append('quiet if you go now')
        elif sig.get('peak_now'):
            signals.append('busy right now')
        elif crowding.get('level') == 'low':
            signals.append('quiet today')
        wdesc = (weather.get('description') or '').lower()
        if 'snow' in wdesc:
            signals.append('snow up high')
        elif 'rain' in wdesc or 'thunder' in wdesc:
            signals.append('wet up high')
        elif 'clear' in wdesc:
            signals.append('clear skies')
        if intent.get('with_dog') and trail.get('dog_friendly'):
            signals.append('dog-friendly')
        eff = _DIFF_EFFORT.get((trail.get('difficulty') or '').lower())
        if eff:
            signals.append(eff)
        if latest:
            signals.append(f'best before {latest}')
        signals = signals[:5]

        # ── Safety ──────────────────────────────────────────────────────────
        if not sig.get('daylight_ok', True):
            safety = {'level': 'avoid',
                      'message': "Not enough daylight to finish this safely today — "
                                 "go early tomorrow, or pick something shorter now."}
        elif warnings or 'snow' in wdesc:
            safety = {'level': 'caution', 'message': warnings[0] if warnings else 'Snow up high — check conditions.'}
        else:
            safety = {'level': 'normal', 'message': ''}

        # ── Notes ───────────────────────────────────────────────────────────
        dog_note = None
        if intent.get('with_dog') and trail.get('dog_friendly'):
            dog_note = "Keep them on a lead near pastures and wildlife; water at the hut."
        family_note = None
        if intent.get('family') and trail.get('family_friendly'):
            family_note = "Gentle enough for younger legs."
        local_tip = (_loc(crowding.get('quiet_tip'), lang)
                     or access['parking']
                     or (_loc((trail.get('highlights') or [''])[0], lang) if trail.get('highlights') else '')
                     or '')

        # ── Almanac moment tie-in ───────────────────────────────────────────
        moment = None
        if moments:
            mo = moments[0]
            moment = {'id': mo.get('id'), 'emoji': mo.get('emoji', ''),
                      'line': mo.get('share') or mo.get('voice', '')}

        # ── Josephine's voice ───────────────────────────────────────────────
        note = _loc(trail.get('josephineNote') or trail.get('josephine_note'), lang).strip()
        lead = ''
        mood = intent.get('mood')
        if mood == 'peaceful':
            lead = "You wanted calm — "
        elif mood == 'epic':
            lead = "You wanted something that makes you feel small — "
        elif mood == 'romantic':
            lead = "For something memorable — "
        elif mood == 'food':
            lead = "For a good lunch on the trail — "
        why = ''
        if sig.get('reason_code') == 'beat_crowds':
            why = "go now and you'll have it nearly to yourself. "
        elif sig.get('peak_now'):
            why = "it's busy at peak, so start early. "
        josephine_says = (lead + why + note).strip() or note or \
            "This one feels right for today."

        # ── Title ───────────────────────────────────────────────────────────
        title = trail.get('name', 'Your hike today')

        # ── Alternatives ────────────────────────────────────────────────────
        alternatives = []
        rest = [r['trail'] for r in ranked[1:8]]
        easier = next((t for t in rest if (t.get('difficulty') or '').lower() == 'easy'
                       and t.get('id') != trail.get('id')), None)
        if easier:
            alternatives.append({'kind': 'easier', 'trail_id': easier.get('id'),
                                 'name': easier.get('name'), 'why': 'gentler on the legs'})
        quieter = next((t for t in rest if (t.get('crowding') or {}).get('level') == 'low'
                        and t.get('id') != trail.get('id') and (not easier or t.get('id') != easier.get('id'))), None)
        if quieter:
            alternatives.append({'kind': 'quieter', 'trail_id': quieter.get('id'),
                                 'name': quieter.get('name'), 'why': 'fewer people'})
        if sig.get('suggest_tomorrow'):
            alternatives.append({'kind': 'tomorrow', 'trail_id': trail.get('id'),
                                 'name': trail.get('name'), 'why': 'same place, at sunrise tomorrow'})
        alternatives = alternatives[:3]

        confidence = 'high' if (reasons and sig.get('reason_code') in ('none', 'beat_crowds')
                                and safety['level'] == 'normal') else 'medium'

        best_image = (trail.get('wallpaper') or (trail.get('gallery') or [None])[0]
                      or trail.get('image_url') or trail.get('thumbnail') or '')

        return {
            'plan_id': f"plan_{int(_dt.now().timestamp())}",
            'lang': lang,
            'confidence': confidence,
            'title': title,
            'josephine_says': josephine_says,
            'origin': origin,
            'trail': {
                'id': trail.get('id'), 'name': trail.get('name', ''),
                'distance_km': trail.get('distance_km'),
                'duration_hours': trail.get('duration_hours'),
                'difficulty': trail.get('difficulty', 'medium'),
                'region': trail.get('region', ''), 'image': best_image,
            },
            'timing': timing,
            'hut': hut,
            'access': access,
            'weather': weather_out,
            'signals': signals,
            'safety': safety,
            'dog_note': dog_note,
            'family_note': family_note,
            'local_tip': local_tip,
            'moment': moment,
            'alternatives': alternatives,
            'share': {
                'headline': f"Your day{(' near ' + origin['name']) if origin.get('name') and origin['type'] in ('area', 'gps') else ''} ✦",
                'subline': title,
            },
        }
    except Exception as e:  # noqa: BLE001
        print(f"[decision_engine] compose_plan failed: {e}")
        return _refusal_plan(context, "Something went sideways planning that — try again in a moment.")
