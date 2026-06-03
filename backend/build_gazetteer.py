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

QUERY = """
[out:json][timeout:180];
area["ISO3166-2"="IT-BZ"]->.a;
(
  node["place"~"^(city|town|village|hamlet)$"]["name"](area.a);
);
out;
"""


def fetch():
    data = urllib.parse.urlencode({"data": QUERY}).encode()
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


def main():
    print("Querying Overpass for South Tyrol (IT-BZ) places…")
    raw = fetch()
    els = raw.get("elements", [])
    print(f"  got {len(els)} nodes")

    # Rank by settlement size so ambiguous names prefer the bigger place.
    rank = {"city": 4, "town": 3, "village": 2, "hamlet": 1}
    places = []
    for e in els:
        t = e.get("tags", {})
        lat, lon = e.get("lat"), e.get("lon")
        if lat is None or lon is None:
            continue
        name = t.get("name")
        if not name:
            continue
        names = []
        for key in ("name", "name:de", "name:it", "name:lld", "alt_name",
                    "official_name", "old_name"):
            v = t.get(key)
            if v:
                # alt_name can be ';'-separated
                names.extend(p.strip() for p in v.split(";") if p.strip())
        # de-dupe, keep order
        seen, uniq = set(), []
        for n in names:
            k = n.lower()
            if k not in seen:
                seen.add(k); uniq.append(n)
        places.append({
            "name": name,
            "names": uniq,
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "place": t.get("place", "village"),
            "rank": rank.get(t.get("place", "village"), 1),
        })

    # Sort biggest-first so the resolver's first-match-wins prefers cities.
    places.sort(key=lambda p: -p["rank"])
    out = {
        "_source": "OpenStreetMap via Overpass (area ISO3166-2=IT-BZ)",
        "_license": "ODbL — © OpenStreetMap contributors",
        "_generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(places),
        "places": places,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    print(f"  wrote {len(places)} places → {OUT}")


if __name__ == "__main__":
    main()
