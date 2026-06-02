#!/usr/bin/env python3
"""
normalize_nearby_rifugios.py — Standardize the `nearby_rifugios` field on every
trail to a single, uniform shape.

WHY
---
Historically `nearby_rifugios` was authored three different ways across the
dataset:
  1. a rifugio id string          → "rif-067"
  2. an inline dict               → {"name": "Rifugio Seceda", "elevation_m": 2519, ...}
  3. a free-text name string      → "Rifugio Auronzo (at trailhead, 2,320m, +39 ...)"
The mixed shapes caused a 500 ("unhashable type: 'dict'") in the recommend
endpoint and silently dropped the free-text ones.

AFTER
-----
Every entry becomes an object:
    {"id": <rifugio id or null>, "name": <clean name>, ...extra inline fields}
The id is recovered by matching the name against rifugios.json (after stripping
trailing "(...)" notes). Entries whose rifugio exists in the table get a real
id (so the app shows live open/season data); the rest keep id: null but a clean
name. Extra inline fields (elevation_m, distance_from_trail_km) are preserved.

USAGE
-----
    python normalize_nearby_rifugios.py --dry-run   # show what would change
    python normalize_nearby_rifugios.py             # write (creates a .bak)

Idempotent: re-running on already-normalized data produces no further changes.
"""

import json
import os
import re
import sys
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAILS_JSON   = os.path.join(BASE_DIR, 'data', 'trails.json')
RIFUGIOS_JSON = os.path.join(BASE_DIR, 'backend', 'data', 'rifugios.json')


def _norm(s: str) -> str:
    """Lowercase, drop trailing '(...)' notes, strip non-alphanumerics."""
    s = re.sub(r'\(.*?\)', '', s or '')          # remove parenthetical notes
    return re.sub(r'[^a-z0-9]', '', s.lower())


def _clean_name(s: str) -> str:
    """Human-readable name: drop trailing '(...)' note, collapse whitespace."""
    s = re.sub(r'\s*\(.*?\)\s*', '', s or '')
    return re.sub(r'\s+', ' ', s).strip()


def build_name_index(rifugios):
    ids = {r.get('id') for r in rifugios if r.get('id')}
    by_name = {}
    name_by_id = {}
    for r in rifugios:
        rid = r.get('id')
        if rid:
            name_by_id[rid] = r.get('name', '')
        key = _norm(r.get('name'))
        if key:
            by_name[key] = rid
    return ids, by_name, name_by_id


def normalize_entry(entry, ids, by_name, name_by_id):
    """Return a uniform {id, name, ...} object for any input shape."""
    if isinstance(entry, str):
        # Already a known id?
        if entry in ids:
            return {'id': entry, 'name': name_by_id.get(entry, '')}, 'id'
        # Free-text name → try to recover an id by name match.
        rid = by_name.get(_norm(entry))
        name = name_by_id.get(rid) if rid else _clean_name(entry)
        return {'id': rid, 'name': name}, ('matched' if rid else 'unmatched')

    if isinstance(entry, dict):
        rid = entry.get('id')
        if not (isinstance(rid, str) and rid in ids):
            rid = by_name.get(_norm(entry.get('name')))
        # Prefer the canonical table name when the id resolves.
        name = name_by_id.get(rid) if rid else _clean_name(entry.get('name'))
        out = {k: v for k, v in entry.items() if k not in ('id', 'name')}
        out = {'id': rid, 'name': name, **out}
        return out, ('matched' if rid else 'unmatched')

    # Unknown type — drop.
    return None, 'dropped'


def main():
    dry = '--dry-run' in sys.argv

    trails_doc = json.load(open(TRAILS_JSON, encoding='utf-8'))
    rifugios   = json.load(open(RIFUGIOS_JSON, encoding='utf-8'))
    if isinstance(rifugios, dict):
        rifugios = rifugios.get('rifugios', [])
    ids, by_name, name_by_id = build_name_index(rifugios)

    trails = trails_doc.get('trails', [])
    stats = {'id': 0, 'matched': 0, 'unmatched': 0, 'dropped': 0}
    changed_trails = 0

    for t in trails:
        nr = t.get('nearby_rifugios')
        if not nr:
            continue
        new_list = []
        for entry in nr:
            obj, kind = normalize_entry(entry, ids, by_name, name_by_id)
            stats[kind] += 1
            if obj is not None:
                new_list.append(obj)
        if new_list != nr:
            changed_trails += 1
            if dry:
                print(f"\n{t.get('id')}:")
                print(f"  before: {json.dumps(nr, ensure_ascii=False)}")
                print(f"  after:  {json.dumps(new_list, ensure_ascii=False)}")
        t['nearby_rifugios'] = new_list

    print("\n── Summary ─────────────────────────────")
    print(f"  entries already-id / matched / unmatched / dropped: "
          f"{stats['id']} / {stats['matched']} / {stats['unmatched']} / {stats['dropped']}")
    print(f"  trails changed: {changed_trails}")

    if dry:
        print("\n(dry run — no files written)")
        return

    if changed_trails == 0:
        print("\nNothing to change — already normalized.")
        return

    backup = TRAILS_JSON + '.bak'
    shutil.copy2(TRAILS_JSON, backup)
    with open(TRAILS_JSON, 'w', encoding='utf-8') as f:
        json.dump(trails_doc, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {TRAILS_JSON} (backup at {backup})")


if __name__ == '__main__':
    main()
