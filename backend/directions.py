"""
directions.py — trailhead routing via the Mapbox Directions API.

Powers Perk #1 ("get me to the trailhead"): given an origin (the guest's current
location) and a destination (a trail's trailhead coordinate), return the driving
distance, duration and route geometry so the frontend can show a branded preview
before handing off to the phone's native maps app for the actual turn-by-turn.

Credential-gated: needs MAPBOX_SERVER_TOKEN (a Mapbox token scoped for the
Directions API). With no token the module reports disabled and the caller falls
back to a native-maps deep link — still useful, zero Mapbox spend.

Cost control: trailhead destinations are FIXED, so we cache by (rounded-origin,
destination, profile). Rounding the origin to ~3 decimals (~110 m) means repeat
requests from the same area reuse one billed Directions call.
"""

import os
import time
import requests

_BASE_URL = 'https://api.mapbox.com/directions/v5/mapbox'
_VALID_PROFILES = {'driving', 'driving-traffic', 'walking', 'cycling'}

# Simple in-process TTL cache. Keyed by a coarse origin + exact destination +
# profile. Plenty for a single-instance Flask app; swap for Redis if it scales.
_CACHE_TTL = 3600  # 1 h
_cache = {}  # key -> (expires_at, payload)


def _token():
    return os.environ.get('MAPBOX_SERVER_TOKEN', '').strip()


def is_enabled() -> bool:
    """True when a Directions-capable Mapbox token is configured."""
    return bool(_token())


def _cache_key(from_lon, from_lat, to_lon, to_lat, profile):
    # Round the ORIGIN coarsely (~110 m) so nearby starts share a cached route;
    # keep the DESTINATION precise (it's a fixed trailhead).
    return (
        round(float(from_lon), 3), round(float(from_lat), 3),
        round(float(to_lon), 5), round(float(to_lat), 5),
        profile,
    )


def get_directions(from_lon, from_lat, to_lon, to_lat, profile='driving'):
    """Return {distance_m, duration_s, geometry} for the route, or None.

    None means: no token configured, an upstream/network error, or no route
    found. The caller treats any None as "fall back to native-maps handoff".
    Coordinates are GeoJSON order (lon, lat), matching trails.json.
    """
    token = _token()
    if not token:
        return None
    if profile not in _VALID_PROFILES:
        profile = 'driving'

    try:
        key = _cache_key(from_lon, from_lat, to_lon, to_lat, profile)
    except (TypeError, ValueError):
        return None

    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]

    coords = f'{float(from_lon)},{float(from_lat)};{float(to_lon)},{float(to_lat)}'
    url = f'{_BASE_URL}/{profile}/{coords}'
    params = {
        'access_token': token,
        'geometries': 'geojson',
        'overview': 'full',
        'alternatives': 'false',
        'steps': 'false',
    }
    try:
        resp = requests.get(url, params=params, timeout=6)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError):
        return None

    routes = data.get('routes') or []
    if not routes:
        return None
    route = routes[0]
    payload = {
        'distance_m': route.get('distance'),
        'duration_s': route.get('duration'),
        'geometry': route.get('geometry'),  # GeoJSON LineString
        'profile': profile,
    }
    _cache[key] = (time.time() + _CACHE_TTL, payload)
    return payload
