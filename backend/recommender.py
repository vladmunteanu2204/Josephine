"""
recommender.py — user-specific trail recommendation engine (Phase 17B).

Pure, dependency-free scoring. Given a user's *behaviour* (views, saves, plans,
reviews) and their *completed hikes*, it builds a preference profile, then ranks
the published catalogue for that one person — replacing the generic, everyone-
sees-the-same scorer used by /api/recommendations.

Design notes
------------
- Everything degrades to a sensible "cold start" (popularity + rating) when a
  user has no history yet, so a brand-new signed-in user still gets a useful
  "Recommended for you" row instead of an empty one.
- Reasons are returned as *codes* (+ params), never prose, so the frontend can
  localise them into EN/IT/DE. e.g. {'code': 'matchesDifficulty', 'difficulty': 'moderate'}.
- No I/O here. The caller (behaviour_store / app.py) loads behaviour, hikes and
  trails and hands them in. That keeps this module trivially unit-testable.
"""

from __future__ import annotations

import math
from collections import defaultdict

# ── Action → signal weight ───────────────────────────────────────────────────
# How strongly each interaction expresses preference. A completed hike is the
# loudest signal; a passing view the quietest. `unsave` actively cancels a save.
ACTION_WEIGHTS = {
    'view': 1.0,
    'save': 4.0,
    'unsave': -4.0,
    'plan': 5.0,
    'review': 3.0,
    'complete': 8.0,   # also derived from completed_hikes directly
}

# Difficulty synonyms → canonical ladder. Trails in the wild use a mix of
# 'easy/medium/hard', 'moderate', 'difficult', 'expert', etc.
_DIFFICULTY_CANON = {
    'easy': 'easy', 'facile': 'easy', 'leicht': 'easy', 'beginner': 'easy',
    'medium': 'moderate', 'moderate': 'moderate', 'intermediate': 'moderate',
    'medio': 'moderate', 'mittel': 'moderate',
    'hard': 'hard', 'difficult': 'hard', 'difficile': 'hard', 'schwer': 'hard',
    'challenging': 'hard',
    'expert': 'expert', 'expert only': 'expert', 'very hard': 'expert',
}
_DIFFICULTY_RANK = {'easy': 1, 'moderate': 2, 'hard': 3, 'expert': 4}


def canon_difficulty(value) -> str:
    return _DIFFICULTY_CANON.get(str(value or '').strip().lower(), 'moderate')


def _trail_tags(trail) -> list:
    """Collect the themed tags a trail expresses, normalised + deduped."""
    tags = []
    for key in ('interests', 'tags', 'themes'):
        v = trail.get(key)
        if isinstance(v, list):
            tags.extend(v)
    tt = trail.get('trail_type')
    if tt:
        tags.append(tt)
    out, seen = [], set()
    for tag in tags:
        s = str(tag).strip().lower()
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _has_rifugio(trail) -> bool:
    nr = trail.get('nearby_rifugios')
    return bool(nr) if isinstance(nr, list) else bool(nr)


# ── Profile building ─────────────────────────────────────────────────────────
def build_profile(behaviour, completed_hikes, trails_by_id) -> dict:
    """Assemble a weighted preference profile for one user.

    behaviour        — list of {trail_id, action, metadata?} events
    completed_hikes   — list of hike dicts ({trail_id, stats:{...}, ...})
    trails_by_id      — {id: trail dict} for the published catalogue
    """
    diff_w = defaultdict(float)
    tag_w = defaultdict(float)
    region_w = defaultdict(float)
    duration_acc = []          # (weight, hours)
    rifugio_pos = 0.0
    dog_pos = 0.0
    total_pos = 0.0
    strong_pos = 0.0           # positive signal from intentful acts (not passive views)
    interacted = set()         # trail ids the user has touched at all

    def add_signal(trail, weight, *, strong=False):
        nonlocal rifugio_pos, dog_pos, total_pos, strong_pos
        if weight == 0:
            return
        diff_w[canon_difficulty(trail.get('difficulty'))] += weight
        for tag in _trail_tags(trail):
            tag_w[tag] += weight
        region = (trail.get('region') or '').strip()
        if region:
            region_w[region] += weight
        dur = trail.get('duration_hours')
        if isinstance(dur, (int, float)) and dur > 0 and weight > 0:
            duration_acc.append((weight, float(dur)))
        if weight > 0:
            total_pos += weight
            if strong:
                strong_pos += weight
            if _has_rifugio(trail):
                rifugio_pos += weight
            if trail.get('dog_friendly'):
                dog_pos += weight

    # Behaviour events. A "view" is passive browsing; save/plan/review/complete
    # are intentful — only the latter (plus completed hikes) flip a user out of
    # the popularity-led cold-start fallback.
    for ev in behaviour or []:
        tid = ev.get('trail_id')
        trail = trails_by_id.get(tid)
        if not trail:
            continue
        interacted.add(tid)
        action = ev.get('action')
        add_signal(trail, ACTION_WEIGHTS.get(action, 0.0),
                   strong=(action not in ('view',)))

    # Completed hikes — strongest signal + fitness evidence
    gains, dists = [], []
    for h in completed_hikes or []:
        tid = h.get('trail_id')
        if tid:
            interacted.add(tid)
        trail = trails_by_id.get(tid)
        if trail:
            add_signal(trail, ACTION_WEIGHTS['complete'], strong=True)
        stats = h.get('stats') or {}
        g = stats.get('trail_elevation_gain_m') or stats.get('elevation_gain_m')
        d = stats.get('distance_km')
        if isinstance(g, (int, float)) and g > 0:
            gains.append(float(g))
        if isinstance(d, (int, float)) and d > 0:
            dists.append(float(d))

    preferred_difficulty = max(diff_w, key=diff_w.get) if diff_w else None
    avg_duration = (
        sum(w * h for w, h in duration_acc) / sum(w for w, _ in duration_acc)
        if duration_acc else None
    )

    # Fitness from completed-hike physicality (averaged).
    fitness = 'beginner'
    if gains or dists:
        avg_gain = sum(gains) / len(gains) if gains else 0
        avg_dist = sum(dists) / len(dists) if dists else 0
        if avg_gain >= 1000 or avg_dist >= 15:
            fitness = 'advanced'
        elif avg_gain >= 500 or avg_dist >= 8:
            fitness = 'intermediate'

    return {
        'difficulty_pref': dict(diff_w),
        'preferred_difficulty': preferred_difficulty,
        'tag_affinity': dict(tag_w),
        'region_affinity': dict(region_w),
        'avg_duration_h': avg_duration,
        'fitness_level': fitness,
        'rifugio_affinity': (rifugio_pos / total_pos) if total_pos else 0.0,
        'dog_affinity': (dog_pos / total_pos) if total_pos else 0.0,
        'completed_count': len(completed_hikes or []),
        'total_signal': total_pos,
        'strong_signal': strong_pos,
        'interacted_ids': sorted(interacted),
        # Stay in the popularity-led fallback until the user does something
        # intentful (one save/plan/review/complete) OR browses a fair bit
        # (~5 trail views). A single curious click no longer flips the row.
        'cold_start': strong_pos < 1.0 and total_pos < 5.0,
    }


# ── Scoring ──────────────────────────────────────────────────────────────────
def _normalise(weights: dict) -> dict:
    """Scale a weight dict to 0..1 by its max, so one prolific category can't
    swamp the score."""
    if not weights:
        return {}
    mx = max(weights.values()) or 1.0
    return {k: (v / mx) for k, v in weights.items() if v > 0}


def score_trail(trail, profile, *, top_tag_set=None):
    """Return (score, reasons[]) for one candidate trail under a profile.

    reasons is a list of {code, **params} ordered by contribution — the caller
    keeps the top few for the "why" chips.
    """
    reasons = []
    score = 0.0

    tag_aff = _normalise(profile.get('tag_affinity', {}))
    region_aff = _normalise(profile.get('region_affinity', {}))
    diff_aff = _normalise(profile.get('difficulty_pref', {}))

    # 1) Difficulty fit (0..3)
    tdiff = canon_difficulty(trail.get('difficulty'))
    if diff_aff.get(tdiff):
        contrib = 3.0 * diff_aff[tdiff]
        score += contrib
        if profile.get('preferred_difficulty') == tdiff:
            reasons.append((contrib, {'code': 'matchesDifficulty', 'difficulty': tdiff}))

    # 2) Shared interests (0..4) — the strongest personalisation lever
    shared = [(tag, tag_aff[tag]) for tag in _trail_tags(trail) if tag in tag_aff]
    if shared:
        shared.sort(key=lambda x: x[1], reverse=True)
        contrib = 4.0 * min(1.0, sum(w for _, w in shared) / 2.0)
        score += contrib
        reasons.append((contrib, {'code': 'sharedInterest', 'tag': shared[0][0]}))

    # 3) Region affinity (0..1.5)
    region = (trail.get('region') or '').strip()
    if region and region_aff.get(region):
        contrib = 1.5 * region_aff[region]
        score += contrib
        reasons.append((contrib, {'code': 'sameRegion', 'region': region}))

    # 4) Duration closeness (0..1.5) — gaussian falloff, ~2h sigma
    avg_dur = profile.get('avg_duration_h')
    tdur = trail.get('duration_hours')
    if avg_dur and isinstance(tdur, (int, float)) and tdur > 0:
        contrib = 1.5 * math.exp(-((tdur - avg_dur) ** 2) / (2 * 2.0 ** 2))
        score += contrib
        if contrib > 1.0:
            reasons.append((contrib, {'code': 'fitsDuration', 'hours': round(tdur)}))

    # 5) Rifugio affinity (0..1)
    if profile.get('rifugio_affinity', 0) >= 0.4 and _has_rifugio(trail):
        contrib = 1.0 * profile['rifugio_affinity']
        score += contrib
        reasons.append((contrib, {'code': 'rifugioNearby'}))

    # 6) Dog-friendly affinity (0..1)
    if profile.get('dog_affinity', 0) >= 0.5 and trail.get('dog_friendly'):
        contrib = 1.0 * profile['dog_affinity']
        score += contrib
        reasons.append((contrib, {'code': 'dogFriendly'}))

    # 7) Fitness alignment — nudge toward difficulty that matches measured fitness.
    fitness = profile.get('fitness_level')
    fit_target = {'beginner': 'easy', 'intermediate': 'moderate', 'advanced': 'hard'}.get(fitness)
    if fit_target and tdiff == fit_target:
        score += 0.5

    # 8) Quality prior (0..1) — rating breaks ties and lifts genuinely great trails.
    rating = trail.get('rating')
    if isinstance(rating, (int, float)) and rating > 0:
        contrib = min(1.0, rating / 5.0)
        score += contrib
        if rating >= 4.5:
            reasons.append((contrib, {'code': 'highlyRated'}))

    reasons.sort(key=lambda x: x[0], reverse=True)
    return score, [r for _, r in reasons]


# Month name/abbrev/number → 1..12, so a trail's `best_season` (stored as full
# month names like "June") can be matched however it's written in the wild.
_MONTH_INDEX = {}
for _i, (_full, _abbr) in enumerate((
    ('january', 'jan'), ('february', 'feb'), ('march', 'mar'), ('april', 'apr'),
    ('may', 'may'), ('june', 'jun'), ('july', 'jul'), ('august', 'aug'),
    ('september', 'sep'), ('october', 'oct'), ('november', 'nov'), ('december', 'dec'),
), start=1):
    _MONTH_INDEX[_full] = _i
    _MONTH_INDEX[_abbr] = _i
    _MONTH_INDEX[str(_i)] = _i


def _month_num(value):
    """Coerce a month token ('June', 'jun', 6, '06') to 1..12, or None."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        n = int(value)
        return n if 1 <= n <= 12 else None
    key = str(value).strip().lower().lstrip('0') or '0'
    return _MONTH_INDEX.get(key) or _MONTH_INDEX.get(str(value).strip().lower())


def _in_season(trail, season_month) -> bool:
    """True when `season_month` falls inside the trail's best_season window.
    Trails without a best_season are treated as all-season (neutral, no boost)."""
    month_n = _month_num(season_month)
    if month_n is None:
        return False
    best = trail.get('best_season')
    if not best:
        return False
    if isinstance(best, str):
        best = [best]
    return any(_month_num(m) == month_n for m in best)


def recommend(trails, profile, *, exclude_ids=None, limit=6, season_month=None):
    """Rank published trails for a user. Returns [{trail, score, reasons}].

    Completed/interacted trails are excluded so the row stays fresh and forward-
    looking. On a cold start (no signal) we fall back to a popularity prior so
    the user still sees a curated, non-empty row.

    season_month (optional) lets the row favour trails that are *in season right
    now* — a strong nudge on the cold-start/guest row (where we have no personal
    signal to go on) and a gentle tiebreak for personalised users.
    """
    exclude = set(exclude_ids or [])
    cold = profile.get('cold_start', True)

    scored = []
    for trail in trails:
        tid = trail.get('id')
        if not tid or tid in exclude:
            continue
        if str(trail.get('status', 'published')) != 'published':
            continue
        in_season = _in_season(trail, season_month)
        if cold:
            # Popularity prior: rating-led, lightly fitness-aware.
            rating = trail.get('rating') or 0
            s = float(rating)
            reasons = [{'code': 'popularPick'}]
            if rating and rating >= 4.5:
                reasons = [{'code': 'highlyRated'}]
            if in_season:
                s += 1.2  # enough to lift an in-season trail above an off-season one
                reasons.insert(0, {'code': 'inSeasonNow'})
        else:
            s, reasons = score_trail(trail, profile)
            if s <= 0:
                continue
            if in_season:
                s += 0.6  # a tiebreak, not a takeover, for personalised picks
                reasons.append({'code': 'inSeasonNow'})
        scored.append({'trail': trail, 'score': round(s, 3), 'reasons': reasons[:2]})

    scored.sort(key=lambda x: x['score'], reverse=True)
    return scored[:limit]
