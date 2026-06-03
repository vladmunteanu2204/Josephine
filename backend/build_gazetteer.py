"""
build_gazetteer.py — one-off (re-runnable) builder for the South Tyrol place
gazetteer used by the recommendation proximity ranking.

Pulls every populated place (city/town/village/hamlet) in the autonomous
Province of Bolzano (ISO IT-BZ = South Tyrol) from OpenStreetMap via Overpass,
with its German / Italian / Ladin / alternate names and real coordinates, and
writes them to data/south_tyrol_places.json. Coordinates are sourced, never
fabricated. Run again any time to refresh.

Usage:  python3 build_gazetteer.py
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

OVERPASS = "https://overpass-api.de/api/interpreter"
OUT = os.path.join(os.path.dirname(__file__), "data", "south_tyrol_places.json")

# Two one-time bulk extracts (single thread): settlements + lodging/huts. Taking
# complete sets from an OSM extract is the policy-endorsed path (vs hammering a
# live geocoding API at runtime).
QUERY_SETTLEMENTS = """
[out:json][timeout:180];
area["ISO3166-2"="IT-BZ"]->.a;
(
  node["place"~"^(city|town|village|hamlet)$"]["name"](area.a);
);
out;
"""

QUERY_POIS = """
[out:json][timeout:180];
area["ISO3166-2"="IT-BZ"]->.a;
(
  node["tourism"~"^(hotel|guest_house|hostel|chalet|apartment|alpine_hut|wilderness_hut)$"]["name"](area.a);
);
out;
"""


def fetch(query):
    data = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(
        OVERPASS, data=data,
        headers={
            "User-Agent": "JosephineGazetteer/1.0 (South Tyrol hiking companion)",
            "Accept": "application/json",
        },
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=200) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001
            print(f"  attempt {attempt+1} failed: {e}", file=sys.stderr)
            time.sleep(5)
    raise SystemExit("Overpass fetch failed after 3 attempts")


def _names(t):
    names = []
    for key in ("name", "name:de", "name:it", "name:lld", "alt_name",
                "official_name", "old_name"):
        v = t.get(key)
        if v:
            names.extend(p.strip() for p in v.split(";") if p.strip())
    seen, uniq = set(), []
    for n in names:
        k = n.lower()
        if k not in seen:
            seen.add(k); uniq.append(n)
    return uniq


def main():
    rank = {"city": 4, "town": 3, "village": 2, "hamlet": 1}
    places = []

    print("Querying Overpass for South Tyrol (IT-BZ) settlements…")
    for e in fetch(QUERY_SETTLEMENTS).get("elements", []):
        t = e.get("tags", {})
        lat, lon = e.get("lat"), e.get("lon")
        if lat is None or lon is None or not t.get("name"):
            continue
        places.append({
            "name": t["name"], "names": _names(t),
            "lat": round(lat, 5), "lon": round(lon, 5),
            "place": t.get("place", "village"),
            "rank": rank.get(t.get("place", "village"), 1),
            "poi": False,
        })
    print(f"  settlements: {len(places)}")

    time.sleep(2)  # be gentle between bulk queries (single thread)
    print("Querying Overpass for South Tyrol lodging & alpine huts…")
    n0 = len(places)
    for e in fetch(QUERY_POIS).get("elements", []):
        t = e.get("tags", {})
        lat, lon = e.get("lat"), e.get("lon")
        if lat is None or lon is None or not t.get("name"):
            continue
        places.append({
            "name": t["name"], "names": _names(t),
            "lat": round(lat, 5), "lon": round(lon, 5),
            "place": t.get("tourism", "hotel"),
            "rank": 0,        # below any settlement on a name collision
            "poi": True,      # POIs resolve by EXACT name only (no fuzzy guessing)
        })
    print(f"  lodging/huts: {len(places) - n0}")

    # Settlements first (biggest-first) so first-match-wins prefers real towns.
    places.sort(key=lambda p: (p["poi"], -p["rank"]))
    out = {
        "_source": "OpenStreetMap via Overpass (area ISO3166-2=IT-BZ): "
                   "place=city/town/village/hamlet + tourism lodging/huts",
        "_license": "ODbL — © OpenStreetMap contributors",
        "_generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(places),
        "places": places,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    print(f"  wrote {len(places)} entries → {OUT}")


if __name__ == "__main__":
    main()
