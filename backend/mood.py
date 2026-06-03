"""
mood.py — deterministic mood → planning-criteria parser (EN / IT / DE).

Turns an emotional, free-text prompt ("a peaceful walk and a good lunch, I'm a
bit tired") into structured overrides the planner understands — with no LLM, so
it's free and never fabricates. Unmatched prompts simply return empty overrides
and the caller falls back to its normal intent parsing.
"""
import re

# Each rule: (label, regex over EN/IT/DE triggers, overrides).
# overrides keys: interests[], avoid[], must_have[], difficulty, with_dog,
# family. Lists are unioned across matching rules; difficulty = first set;
# booleans OR together.
_RULES = [
    ("epic", r"\b(feel small|tiny|epic|in a movie|cinematic|grand(iose)?|breathtaking|jaw[- ]?dropping|spettacolar|grandios|atemberaubend|imponente)\b",
     {"interests": ["panoramic views", "summits"], "must_have": ["big_view"]}),
    ("peaceful", r"\b(peace(ful)?|calm|quiet|serene|relax|unwind|switch off|tired but|gentle|tranquill|sereno|rilassante|calma|ruhig|entspannt|gemütlich|friedlich)\b",
     {"interests": ["forests", "alpine lakes"], "avoid": ["crowds"], "difficulty": "easy"}),
    ("romantic", r"\b(romantic|impress (my )?(date|girlfriend|boyfriend|partner|wife|husband)|honeymoon|anniversary|romantic|romantisch|romantica|innamorat)\b",
     {"interests": ["panoramic views"], "avoid": ["crowds"], "must_have": ["sunset_or_hut"]}),
    ("food", r"\b(food|lunch|eat|dine|dinner|dumpling|kn[öo]del|canederli|hut food|malga|speck|cheese|strudel|cibo|pranzo|mangiare|essen|mittagessen|gut essen)\b",
     {"interests": ["cultural routes"], "must_have": ["open_food_stop"]}),
    ("no_heights", r"\b(scared of heights|afraid of heights|fear of heights|vertigo|no exposure|not exposed|no drops|paura dell.altezza|vertigini|h[öo]henangst|schwindelfrei)\b",
     {"interests": ["forests", "alpine lakes"], "avoid": ["exposure"], "difficulty": "easy"}),
    ("rainy", r"\b(rain(y|ing)?|wet|drizzle|it rained|after rain|piov|pioggia|bagnato|regn|nass)\b",
     {"interests": ["forests", "cultural routes"], "avoid": ["high_altitude"]}),
    ("old_dog", r"\b(old dog|elderly dog|senior dog|cane anziano|alter hund)\b",
     {"with_dog": True, "difficulty": "easy", "must_have": ["water_for_dog"]}),
    ("dog", r"\bdog\b|\bpup\b|\bpooch\b|\bcane\b|\bhund\b|with my dog|col cane|mit hund",
     {"with_dog": True}),
    ("family", r"\b(family|kids|children|child|toddler|famigli|bambin|kinder|familie)\b",
     {"family": True, "difficulty": "easy"}),
    ("water", r"\b(waterfall|cascade|cascata|wasserfall)\b",
     {"interests": ["waterfalls"]}),
    ("lake", r"\b(lake|turquoise|swim|lago|see\b|baden)\b",
     {"interests": ["alpine lakes"]}),
    ("view", r"\b(view|panorama|vista|scenic|lookout|sunset|sunrise|golden hour|panoram|aussicht|sonnenuntergang)\b",
     {"interests": ["panoramic views"]}),
    ("easy", r"\b(easy|gentle|short|stroll|leisurely|not too hard|tired|facile|breve|leicht|kurz|locker)\b",
     {"difficulty": "easy"}),
    ("challenge", r"\b(challeng|hard|tough|demanding|summit|workout|push myself|impegnativ|difficile|anstrengend|herausforder)\b",
     {"difficulty": "hard"}),
]


def parse_mood(text, lang='en'):
    """Return overrides dict for an emotional prompt. Keys always present:
    interests[], avoid[], must_have[], difficulty(None|str), with_dog(bool),
    family(bool), mood(None|str = the first/strongest matched label)."""
    t = (text or '').lower()
    out = {"interests": [], "avoid": [], "must_have": [],
           "difficulty": None, "with_dog": False, "family": False, "mood": None}
    if not t.strip():
        return out
    for label, pattern, ov in _RULES:
        if not re.search(pattern, t):
            continue
        if out["mood"] is None:
            out["mood"] = label
        for k in ("interests", "avoid", "must_have"):
            for v in ov.get(k, []):
                if v not in out[k]:
                    out[k].append(v)
        if ov.get("difficulty") and out["difficulty"] is None:
            out["difficulty"] = ov["difficulty"]
        if ov.get("with_dog"):
            out["with_dog"] = True
        if ov.get("family"):
            out["family"] = True
    return out
