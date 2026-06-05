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
    origin_coords   = ctx.get('origin_coords')   # (lat, lon) for a GPS origin

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
    elif origin_coords:
        # GPS origin (no named area): prefer trails physically near the user.
        near = []
        for item in scored_trails:
            ctr = trail_centroid(item['trail'])
            if not ctr:
                continue
            dist = haversine(origin_coords[0], origin_coords[1], ctr[0], ctr[1])
            if dist <= NEAR_RADIUS_KM:
                item['score'] += max(0.0, 6.0 - dist / 9.0)
                item['reasons'].append('near you')
                near.append(item)
        if near:
            scored_trails = near
        # else: nothing within radius → keep region-wide (don't refuse on GPS)

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

_DIFF_EFFORT = {'easy': 'eff_easy', 'medium': 'eff_medium', 'hard': 'eff_hard'}

# Localized micro-copy for the Plan Card (signals, timing, safety, notes, voice).
_PHRASES = {
    'sig_quiet_now':   {'en': 'quiet if you go now', 'it': 'tranquillo se vai ora', 'de': 'jetzt noch ruhig'},
    'sig_busy_now':    {'en': 'busy right now', 'it': 'affollato ora', 'de': 'gerade voll'},
    'sig_quiet_today': {'en': 'quiet today', 'it': 'tranquillo oggi', 'de': 'heute ruhig'},
    'sig_snow':        {'en': 'snow up high', 'it': 'neve in quota', 'de': 'Schnee in der Höhe'},
    'sig_wet':         {'en': 'wet up high', 'it': 'bagnato in quota', 'de': 'nass in der Höhe'},
    'sig_clear':       {'en': 'clear skies', 'it': 'cielo sereno', 'de': 'klarer Himmel'},
    'sig_dog':         {'en': 'dog-friendly', 'it': 'cani ammessi', 'de': 'hundefreundlich'},
    'sig_lunch':       {'en': 'lunch sorted', 'it': 'pranzo assicurato', 'de': 'Mittagessen gesichert'},
    'sig_best_before': {'en': 'best before {t}', 'it': 'meglio prima delle {t}', 'de': 'am besten vor {t}'},
    'eff_easy':        {'en': 'gentle', 'it': 'facile', 'de': 'gemütlich'},
    'eff_medium':      {'en': 'a steady effort', 'it': 'impegno costante', 'de': 'solide Tour'},
    'eff_hard':        {'en': 'a real climb', 'it': 'una vera salita', 'de': 'ein echter Anstieg'},
    't_beat':          {'en': 'beat the crowds and the parking', 'it': 'eviti la folla e il parcheggio', 'de': 'der Menge und dem Parkplatz zuvorkommen'},
    't_storm':         {'en': 'be off the exposed ground before afternoon storms', 'it': 'sei al riparo prima dei temporali pomeridiani', 'de': 'vor den Nachmittagsgewittern aus dem freien Gelände'},
    't_easy':          {'en': 'an easy, unhurried start', 'it': 'una partenza tranquilla', 'de': 'ein entspannter Start'},
    'safe_daylight':   {'en': "Not enough daylight to finish this safely today — go early tomorrow, or pick something shorter now.",
                        'it': "Non c'è abbastanza luce per finire in sicurezza oggi — parti presto domani o scegli qualcosa di più breve.",
                        'de': "Heute reicht das Tageslicht nicht für eine sichere Tour — geh morgen früh oder wähl jetzt etwas Kürzeres."},
    'safe_snow':       {'en': 'Snow up high — check conditions.', 'it': 'Neve in quota — controlla le condizioni.', 'de': 'Schnee in der Höhe — prüf die Bedingungen.'},
    'dog_note':        {'en': 'Keep them on a lead near pastures and wildlife; water at the hut.',
                        'it': 'Tienilo al guinzaglio vicino ai pascoli e alla fauna; acqua al rifugio.',
                        'de': 'An der Leine bei Weiden und Wild; Wasser an der Hütte.'},
    'family_note':     {'en': 'Gentle enough for younger legs.', 'it': 'Adatto anche alle gambe più piccole.', 'de': 'Sanft genug für kleine Beine.'},
    'lead_peaceful':   {'en': 'You wanted calm — ', 'it': 'Volevi calma — ', 'de': 'Du wolltest Ruhe — '},
    'lead_epic':       {'en': 'You wanted something that makes you feel small — ', 'it': 'Volevi qualcosa che ti faccia sentire piccolo — ', 'de': 'Du wolltest etwas, das dich klein fühlen lässt — '},
    'lead_romantic':   {'en': 'For something memorable — ', 'it': 'Per qualcosa di memorabile — ', 'de': 'Für etwas Unvergessliches — '},
    'lead_food':       {'en': 'For a good lunch on the trail — ', 'it': 'Per un buon pranzo lungo il cammino — ', 'de': 'Für ein gutes Mittagessen unterwegs — '},
    'why_beat':        {'en': "go now and you'll have it nearly to yourself. ", 'it': 'vai ora e lo avrai quasi tutto per te. ', 'de': 'geh jetzt, dann hast du ihn fast für dich. '},
    'why_peak':        {'en': "it's busy at peak, so start early. ", 'it': "è affollato nelle ore di punta, quindi parti presto. ", 'de': 'zur Stoßzeit ist viel los, also starte früh. '},
}


def _p(key, lang, **vars):
    s = _PHRASES.get(key, {})
    txt = s.get((lang or 'en')[:2]) or s.get('en') or key
    for k, v in vars.items():
        txt = txt.replace('{' + k + '}', str(v))
    return txt


def _loc(val, lang):
    """A trail/rifugio field that may be a {en,it,de} dict or a plain string."""
    if isinstance(val, dict):
        return val.get((lang or 'en')[:2]) or val.get('en') or next(iter(val.values()), '')
    return val or ''


def verification_state(rec):
    """Effective verification status of a trail/rifugio record.

    Returns one of 'verified' | 'editorial' | 'stale' | 'unverified'.
    A 'verified' record whose last_verified_at is older than stale_after_days
    is downgraded to 'stale' so Josephine stops asserting it as current.
    """
    v = (rec or {}).get('verification') or {}
    status = (v.get('status') or 'unverified').strip().lower()
    if status not in ('verified', 'editorial', 'stale', 'unverified'):
        status = 'unverified'
    if status == 'verified':
        lva = v.get('last_verified_at')
        days = v.get('stale_after_days')
        if lva and days:
            try:
                d = _dt.fromisoformat(str(lva)[:10]).date()
                if (_dt.now().date() - d).days > int(days):
                    status = 'stale'
            except Exception:  # noqa: BLE001
                pass
    return status


def can_state_fact(rec):
    """May Josephine assert specific operational facts (hut note, parking that
    'fills by 9am', opening specifics) from this record? Only when verified."""
    return verification_state(rec) == 'verified'


def can_show_voice(rec):
    """May Josephine surface curated prose/voice (mood note, quiet-tip,
    highlights) from this record? Verified or our own editorial content."""
    return verification_state(rec) in ('verified', 'editorial')


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


MAX_HUT_KM = 6.0   # a hut only counts as "on this hike" if it's genuinely close


def _round_down_15(h, m):
    total = (h * 60 + m) // 15 * 15
    return total // 60, total % 60


def compose_plan(context, ranked, *, resolve_nearby_rifugios, dispersal_mod,
                 trail_centroid=None, haversine=None, select_insights=None):
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

        must_have = intent.get('must_have') or []

        # ── Timing ──────────────────────────────────────────────────────────
        if sig.get('beat_crowds') or sig.get('peak_now'):
            suggested_start = '07:30'
            t_reason = _p('t_beat', lang)
        elif cond.get('season') == 'summer':
            suggested_start = '08:00'
            t_reason = _p('t_storm', lang)
        else:
            suggested_start = '09:00'
            t_reason = _p('t_easy', lang)
        latest = None          # rounded "~HH:MM" string for display
        latest_t = None        # the rounded time without the tilde
        clk = _clock(sunset) if sunset else None
        if clk:
            mins = clk[0] * 60 + clk[1] - int((duration_h + 1.0) * 60)   # finish + 1h buffer
            if mins > 0:
                rh, rm = _round_down_15(mins // 60, mins % 60)            # don't oversell precision
                latest_t = _fmt_hm(rh, rm)
                latest = '~' + latest_t
        timing = {'suggested_start': suggested_start, 'latest_safe_start': latest,
                  'sunset': _fmt_hm(*clk) if clk else None, 'reason': t_reason}

        # ── Hut pairing (only a hut that's genuinely near the trail) ─────────
        hut = None
        try:
            huts = resolve_nearby_rifugios(trail.get('nearby_rifugios', []))
            ctr = trail_centroid(trail) if trail_centroid else None
            def _near_enough(h):
                if not (ctr and haversine and h.get('lat') is not None and h.get('lon') is not None):
                    return True   # can't verify distance → trust the curated link
                return haversine(ctr[0], ctr[1], h['lat'], h['lon']) <= MAX_HUT_KM
            huts = [h for h in huts if _near_enough(h)]
            chosen = next((h for h in huts if h.get('open_now') is not False), huts[0] if huts else None)
            if chosen:
                # 'open_now' is computed from curated opening hours — only assert
                # it as fact when the hut is verified; the note is a specific
                # operational claim, so it too is gated behind 'verified'.
                hut_ok = can_state_fact(chosen)
                hut = {'id': chosen.get('id'), 'name': chosen.get('name'),
                       'type': chosen.get('type', 'rifugio'),
                       'open_now': chosen.get('open_now') if hut_ok else None,
                       'note': _loc(chosen.get('josephine_note'), lang)[:160] if hut_ok else '',
                       'verification': verification_state(chosen)}
        except Exception:  # noqa: BLE001
            hut = None

        # ── Access ──────────────────────────────────────────────────────────
        # Directions (by car/bus) are generic wayfinding → always useful.
        # Parking specifics ("fills by 09:00") are an operational claim → gated.
        trail_fact_ok = can_state_fact(trail)
        trail_voice_ok = can_show_voice(trail)
        transport = trail.get('transport') or {}
        access = {
            'by_car': transport.get('car') or '',
            'by_transport': transport.get('bus') or '',
            'parking': (str((trail.get('trailhead_info') or {}).get('parking', '')) or '')
                       if trail_fact_ok else '',
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
            signals.append(_p('sig_quiet_now', lang))
        elif sig.get('peak_now'):
            signals.append(_p('sig_busy_now', lang))
        elif crowding.get('level') == 'low':
            signals.append(_p('sig_quiet_today', lang))
        wdesc = (weather.get('description') or '').lower()
        if 'snow' in wdesc:
            signals.append(_p('sig_snow', lang))
        elif 'rain' in wdesc or 'thunder' in wdesc:
            signals.append(_p('sig_wet', lang))
        elif 'clear' in wdesc:
            signals.append(_p('sig_clear', lang))
        if intent.get('with_dog') and trail.get('dog_friendly'):
            signals.append(_p('sig_dog', lang))
        if 'open_food_stop' in must_have and hut and hut.get('open_now') is True:
            signals.append(_p('sig_lunch', lang))
        eff_key = _DIFF_EFFORT.get((trail.get('difficulty') or '').lower())
        if eff_key:
            signals.append(_p(eff_key, lang))
        if latest:
            signals.append(_p('sig_best_before', lang, t=latest))
        signals = signals[:5]

        # ── Safety ──────────────────────────────────────────────────────────
        if not sig.get('daylight_ok', True):
            safety = {'level': 'avoid', 'message': _p('safe_daylight', lang)}
        elif warnings or 'snow' in wdesc:
            safety = {'level': 'caution', 'message': (warnings[0] if warnings else _p('safe_snow', lang))}
        else:
            safety = {'level': 'normal', 'message': ''}

        # ── Notes ───────────────────────────────────────────────────────────
        dog_note = _p('dog_note', lang) if (intent.get('with_dog') and trail.get('dog_friendly')) else None
        family_note = _p('family_note', lang) if (intent.get('family') and trail.get('family_friendly')) else None
        # Quiet-tip / highlight prose is curated voice → gate behind editorial+.
        # Parking already gated above (empty unless verified).
        local_tip = ''
        if trail_voice_ok:
            local_tip = (_loc(crowding.get('quiet_tip'), lang)
                         or (_loc((trail.get('highlights') or [''])[0], lang) if trail.get('highlights') else '')
                         or '')
        local_tip = local_tip or access['parking']

        # ── Insider insights (public + chat-only secrets) ───────────────────
        public_insights, secrets = [], []
        if select_insights:
            try:
                public_insights = select_insights(trail, context, visibility='public', limit=3)
                secrets = select_insights(trail, context, visibility='chat_only', limit=4)
            except Exception:  # noqa: BLE001
                public_insights, secrets = [], []

        # ── Almanac moment tie-in ───────────────────────────────────────────
        moment = None
        if moments:
            mo = moments[0]
            moment = {'id': mo.get('id'), 'emoji': mo.get('emoji', ''),
                      'line': mo.get('share') or mo.get('voice', '')}

        # ── Josephine's voice ───────────────────────────────────────────────
        # The freeform trail note may carry curated specifics — surface it only
        # when at least editorial; engine-generated lead/why always stand.
        note = _loc(trail.get('josephineNote') or trail.get('josephine_note'), lang).strip() \
            if trail_voice_ok else ''
        mood = intent.get('mood')
        lead = _p(f'lead_{mood}', lang) if mood in ('peaceful', 'epic', 'romantic', 'food') else ''
        why = ''
        if sig.get('reason_code') == 'beat_crowds':
            why = _p('why_beat', lang)
        elif sig.get('peak_now'):
            why = _p('why_peak', lang)
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
            'insights': public_insights,
            'secrets': secrets,
            'intent_summary': {           # structured signals for on-device memory
                'mood': intent.get('mood'),
                'difficulty': intent.get('difficulty'),
                'with_dog': bool(intent.get('with_dog')),
                'family': bool(intent.get('family')),
                'interests': intent.get('interests') or [],
            },
            'verification': {
                'trail': verification_state(trail),
                'hut': hut['verification'] if hut else None,
            },
            'alternatives': alternatives,
            'share': {
                'headline': f"Your day{(' near ' + origin['name']) if origin.get('name') and origin['type'] in ('area', 'gps') else ''} ✦",
                'subline': title,
            },
        }
    except Exception as e:  # noqa: BLE001
        print(f"[decision_engine] compose_plan failed: {e}")
        return _refusal_plan(context, "Something went sideways planning that — try again in a moment.")


def prefer_food_stops(ranked, resolve_nearby_rifugios):
    """Stable-reorder so trails with an OPEN nearby hut come first — used when the
    prompt asks for lunch/food. Preserves score order within each group. Guarded."""
    try:
        def has_open_hut(item):
            try:
                huts = resolve_nearby_rifugios(item['trail'].get('nearby_rifugios', []))
                return any(h.get('open_now') is not False for h in huts)
            except Exception:  # noqa: BLE001
                return False
        return sorted(ranked, key=lambda it: (0 if has_open_hut(it) else 1, -it.get('score', 0)))
    except Exception:  # noqa: BLE001
        return ranked
