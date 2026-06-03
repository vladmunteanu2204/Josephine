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
