#!/usr/bin/env python3
"""
Alpenvia — One-time data seed script
=====================================
Run ONCE to generate realistic South Tyrol trail and rifugio data using Claude API.
All generated records get status="draft" — you must review and publish via Admin Panel.

Usage:
    ANTHROPIC_API_KEY=your_key python backend/seed_data.py

Options (env vars):
    SEED_TRAIL_BATCHES   — number of batches of 15 trails (default: 3 = 45 trails)
    SEED_RIFUGIO_BATCHES — number of batches of 10 rifugios (default: 2 = 20 rifugios)
    SEED_DRY_RUN         — if set to "1", print output but don't write files

Generated records are MERGED with existing data (existing IDs are never overwritten).
"""

import anthropic
import json
import math
import os
import sys
import time

# ── Config ────────────────────────────────────────────────────────────────────

TRAIL_BATCHES   = int(os.environ.get('SEED_TRAIL_BATCHES',   3))
RIFUGIO_BATCHES = int(os.environ.get('SEED_RIFUGIO_BATCHES', 2))
DRY_RUN         = os.environ.get('SEED_DRY_RUN') == '1'

BASE_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAILS_FILE   = os.path.join(BASE_DIR, 'data', 'trails.json')
RIFUGIOS_FILE = os.path.join(BASE_DIR, 'backend', 'data', 'rifugios.json')

API_KEY = os.environ.get('ANTHROPIC_API_KEY')
if not API_KEY:
    print("ERROR: ANTHROPIC_API_KEY is not set.")
    sys.exit(1)

client = anthropic.Anthropic(api_key=API_KEY)

# ── Prompts ───────────────────────────────────────────────────────────────────

TRAIL_PROMPT = """Generate {n} realistic South Tyrol / Dolomites hiking trails as a JSON array.
Cover these regions (spread across them): South Tyrol, Dolomites, Merano & Surroundings,
Bolzano & Surroundings, Val Pusteria, Val Gardena, Vinschgau, Val Sarentino.
Mix difficulty levels: roughly half easy, quarter medium, quarter hard.

Each trail object MUST include ALL of these fields exactly:

id (unique kebab-case slug, e.g. "seceda-ridge-loop"),
name (short descriptive name in English),
region (one of the regions listed above),
difficulty ("easy" | "medium" | "hard"),
tagline (1 evocative sentence),
distance_km (number),
duration_hours (number),
elevation_gain_m (integer),
elevation_loss_m (integer),
trail_type ("loop" | "out_and_back" | "point_to_point"),
interests (array, pick from: "alpine lakes" | "panoramic views" | "forests" |
  "cultural routes" | "loop trail" | "waterfalls" | "summits" | "wildlife" | "glaciers"),
description (exactly 3 sentences, specific and vivid),
coordinates (empty array []),
pois (2–4 objects, each: {name, type ("cultural"|"viewpoint"|"lake"|"summit"|"waterfall"|"church"), description (1 sentence)}),
rating (4.0–5.0, one decimal),
reviews_count (integer 50–2000),
image_url ("https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800"),
thumbnail ("https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400"),
gallery (array of 3 Unsplash alpine photo URLs with ?w=800),
difficulty_details ({technical: "very_low"|"low"|"medium"|"high"|"very_high",
  fitness: same scale, exposure: same scale}),
best_season (array of month names, e.g. ["May","June","July","August","September"]),
facilities (array, pick from: "parking" | "restaurants" | "wc" | "first_aid" | "cable_car"),
dog_friendly (boolean),
family_friendly (boolean),
tags (3–5 lowercase strings),
josephineNote ({en: "warm first-person tip from Josephine, very specific to THIS trail — mention exact features, not generic advice"}),
access_info ("2–3 sentences: nearest town, road to take, trailhead location"),
opening_season ({start_date: "YYYY-MM-DD" or null if year_round, end_date: "YYYY-MM-DD" or null}),
year_round (boolean — true if open all year),
transport ({
  car: "parking info: location, spaces, cost",
  bus: "SAD bus line number, stop name, frequency, months of operation — or 'No direct bus service' if none"
}),
trailhead_info ({parking: "spaces and cost", facilities: "what exists at trailhead"}),
nearby_rifugios ([]),
crowding ({level: "low"|"medium"|"high", peak_months: ["July","August"], quiet_tip: "specific actionable tip"}),
weather_notes ("1 sentence about typical weather conditions or risks"),
highlights (["3 very specific, vivid things to see or experience on THIS trail"]),
status: "draft"

IMPORTANT: Use REAL South Tyrol geography. Do not invent impossible mountains or wrong bus lines.
South Tyrol bus operator is SAD Südtirol (sad.it). Common lines: 204, 206, 210, 252, 260, 340, 350, 442.
Return ONLY the raw JSON array. No markdown fences. No explanation."""

RIFUGIO_PROMPT = """Generate {n} realistic South Tyrol mountain huts as a JSON array.
Cover a mix of types: mostly rifugio, 1–2 malga (alpine dairy farm), 0–1 bivacco (emergency shelter).
Spread across regions: Dolomites, Val Gardena, Val Pusteria, Merano & Surroundings, Vinschgau.

Each object MUST include ALL these fields:

id ("rif-NNN" slug, e.g. "rif-042" — ensure uniqueness),
name (authentic Italian/German alpine hut name),
type ("rifugio" | "malga" | "bivacco"),
region,
altitude (integer, meters — realistic for South Tyrol: 1200–3000m),
coordinates ({lat: float (46.0–47.1), lng: float (10.5–12.3)}),
contact ({phone: "+39 0474 XXXXXX", email: "info@example.it", website: "https://...", whatsapp: "+39 333 XXXXXXX"}),
facilities ({beds: integer, showers: bool, meals: bool, wifi: bool, dogs: bool, payment_methods: ["cash","card"]}),
description ("2–3 sentences, specific history and character"),
access_info ("2–3 sentences including CAI/SAT trail numbers and approach time"),
transport ({car: "parking and access road", bus: "nearest SAD bus stop — or 'No direct bus, nearest stop is X'"}),
opening_season ({start_date: "2025-MM-DD", end_date: "2025-MM-DD"}),
prices ({overnight: int, breakfast: int, dinner: int, half_board: int}),
photos (["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800", (2 more)]  ),
status: "draft",
nearby_trails ([]),
special_closures ([]),
josephine_note ("warm, specific tip about THIS hut — best dish, best seat, must-know insider info"),
highlights (["3 specific things about this hut"]),
booking_required (boolean — true for rifugio/malga, false for bivacco),
booking_note ("how far ahead, how to book, payment policy")

IMPORTANT: Realistic Italian phone numbers, altitudes, and trail numbers (CAI numbering system).
Bivaccos have no meals, no beds count as 0 (or emergency mats), are free, open year-round.
Return ONLY the raw JSON array. No markdown fences. No explanation."""

# ── Helpers ───────────────────────────────────────────────────────────────────

def haversine_km(lat1, lon1, lat2, lon2):
    """Distance in km between two coordinates."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def parse_json_response(text: str):
    """Strip markdown fences if present and parse JSON."""
    text = text.strip()
    if text.startswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:])  # drop first ```json line
        if text.rstrip().endswith('```'):
            text = text.rstrip()[:-3]
    return json.loads(text)


def generate_batch(prompt: str, n: int, retries: int = 3):
    """Call Claude Haiku to generate n records. Retries on JSON parse error."""
    for attempt in range(retries):
        try:
            print(f"  Generating batch of {n} (attempt {attempt + 1})…")
            resp = client.messages.create(
                model='claude-haiku-4-5',
                max_tokens=8192,
                messages=[{'role': 'user', 'content': prompt.format(n=n)}],
            )
            result = parse_json_response(resp.content[0].text)
            if not isinstance(result, list):
                raise ValueError("Response is not a JSON array")
            print(f"  ✓ Got {len(result)} records")
            return result
        except Exception as e:
            print(f"  ✗ Attempt {attempt + 1} failed: {e}")
            if attempt < retries - 1:
                time.sleep(3)
    print("  ERROR: All retry attempts failed for this batch.")
    return []


def link_nearby(trails, rifugios, radius_km=10.0):
    """
    Fill nearby_rifugios on trails and nearby_trails on rifugios
    based on geographic proximity (within radius_km).
    Only works for trails/rifugios that have coordinate data.
    """
    for trail in trails:
        coords = trail.get('coordinates', [])
        if not coords or not isinstance(coords[0], (list, tuple)):
            continue
        t_lat, t_lon = coords[0][1], coords[0][0]  # GeoJSON order: [lng, lat]
        nearby = []
        for rif in rifugios:
            r_coords = rif.get('coordinates', {})
            if not r_coords:
                continue
            r_lat = r_coords.get('lat') or r_coords.get('latitude')
            r_lon = r_coords.get('lng') or r_coords.get('longitude')
            if r_lat and r_lon:
                if haversine_km(t_lat, t_lon, r_lat, r_lon) <= radius_km:
                    nearby.append(rif['id'])
        if nearby:
            trail['nearby_rifugios'] = list(set(trail.get('nearby_rifugios', []) + nearby))

    for rif in rifugios:
        r_coords = rif.get('coordinates', {})
        if not r_coords:
            continue
        r_lat = r_coords.get('lat') or r_coords.get('latitude')
        r_lon = r_coords.get('lng') or r_coords.get('longitude')
        if not (r_lat and r_lon):
            continue
        nearby = []
        for trail in trails:
            coords = trail.get('coordinates', [])
            if not coords or not isinstance(coords[0], (list, tuple)):
                continue
            t_lat, t_lon = coords[0][1], coords[0][0]
            if haversine_km(r_lat, r_lon, t_lat, t_lon) <= radius_km:
                nearby.append(trail['id'])
        if nearby:
            rif['nearby_trails'] = list(set(rif.get('nearby_trails', []) + nearby))


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Alpenvia Seed Script")
    print(f"Trails: {TRAIL_BATCHES} batch(es) × 15 = ~{TRAIL_BATCHES * 15} new trails")
    print(f"Rifugios: {RIFUGIO_BATCHES} batch(es) × 10 = ~{RIFUGIO_BATCHES * 10} new rifugios")
    print("All records will be set to status='draft' — publish via Admin Panel.")
    if DRY_RUN:
        print("DRY RUN — files will not be written.")
    print("=" * 60)

    # ── Load existing data ──
    with open(TRAILS_FILE) as f:
        trails_data = json.load(f)
    with open(RIFUGIOS_FILE) as f:
        rifugios_existing = json.load(f)

    existing_trail_ids   = {t['id'] for t in trails_data.get('trails', [])}
    existing_rifugio_ids = {r['id'] for r in rifugios_existing}

    # ── Generate trails ──
    new_trails = []
    print(f"\n[TRAILS] Generating {TRAIL_BATCHES} batch(es)…")
    for i in range(TRAIL_BATCHES):
        print(f"  Batch {i + 1}/{TRAIL_BATCHES}")
        batch = generate_batch(TRAIL_PROMPT, 15)
        for t in batch:
            if t.get('id') and t['id'] not in existing_trail_ids:
                t['status'] = 'draft'  # enforce draft
                new_trails.append(t)
                existing_trail_ids.add(t['id'])
            else:
                print(f"  Skipping duplicate id: {t.get('id')}")
        time.sleep(1)  # avoid rate limiting

    # ── Generate rifugios ──
    new_rifugios = []
    print(f"\n[RIFUGIOS] Generating {RIFUGIO_BATCHES} batch(es)…")
    for i in range(RIFUGIO_BATCHES):
        print(f"  Batch {i + 1}/{RIFUGIO_BATCHES}")
        batch = generate_batch(RIFUGIO_PROMPT, 10)
        for r in batch:
            if r.get('id') and r['id'] not in existing_rifugio_ids:
                r['status'] = 'draft'  # enforce draft
                new_rifugios.append(r)
                existing_rifugio_ids.add(r['id'])
            else:
                print(f"  Skipping duplicate id: {r.get('id')}")
        time.sleep(1)

    # ── Geographic linking ──
    all_trails   = trails_data.get('trails', []) + new_trails
    all_rifugios = rifugios_existing + new_rifugios
    print(f"\n[LINKING] Linking trails ↔ rifugios within 10km radius…")
    link_nearby(new_trails, all_rifugios)
    link_nearby(all_trails, new_rifugios)

    # ── Summary ──
    print(f"\n[SUMMARY]")
    print(f"  New trails:   {len(new_trails)}")
    print(f"  New rifugios: {len(new_rifugios)}")
    print(f"  Total trails:   {len(all_trails)}")
    print(f"  Total rifugios: {len(all_rifugios)}")

    if DRY_RUN:
        print("\n[DRY RUN] Not writing files. First new trail:")
        if new_trails:
            print(json.dumps(new_trails[0], indent=2, ensure_ascii=False)[:800])
        return

    # ── Write files ──
    trails_data['trails'] = all_trails
    with open(TRAILS_FILE, 'w') as f:
        json.dump(trails_data, f, indent=2, ensure_ascii=False)
    print(f"  ✓ Written {TRAILS_FILE}")

    with open(RIFUGIOS_FILE, 'w') as f:
        json.dump(all_rifugios, f, indent=2, ensure_ascii=False)
    print(f"  ✓ Written {RIFUGIOS_FILE}")

    print("\n✓ Seed complete.")
    print("→ Open the Admin Panel → Trails tab to review and publish drafts.")
    print("→ Open the Admin Panel → Rifugios tab to review and publish rifugio drafts.")


if __name__ == '__main__':
    main()
