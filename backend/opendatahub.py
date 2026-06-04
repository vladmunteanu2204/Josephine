"""
opendatahub.py — licensed external facts from Open Data Hub South Tyrol.

Open Data Hub (NOI Techpark, https://opendatahub.com) is the official, free,
no-key tourism dataset for South Tyrol (CC BY 4.0). We use it to *propose*
verified external facts for the admin to review — hut opening seasons/contact and
nearby events — instead of scraping third-party sites. Nothing here persists; the
endpoint that calls it returns a proposal the owner confirms and saves.

Pure, TTL-cached, fully guarded (mirrors dispersal.py / almanac.py): the network
is never a hard dependency — any failure returns an empty, well-formed result.
"""
import time
from datetime import date

try:
    import requests
except Exception:  # noqa: BLE001
    requests = None

BASE = 'https://tourism.opendatahub.com/v1'
SOURCE_HOME = 'https://opendatahub.com'
_TIMEOUT = 5.0
_CACHE_TTL = 6 * 3600          # 6h — opening seasons/events change slowly
_cache = {}                     # key -> (fetched_at, value)


def _cached(key, producer):
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < _CACHE_TTL:
        return hit[1]
    val = producer()
    _cache[key] = (now, val)
    return val


def _get(path, params):
    """GET BASE/path → parsed JSON dict, or None. Never raises."""
    if requests is None:
        return None
    try:
        r = requests.get(f'{BASE}/{path.lstrip("/")}', params=params, timeout=_TIMEOUT,
                         headers={'Accept': 'application/json'})
        if r.status_code != 200:
            return None
        return r.json()
    except Exception as e:  # noqa: BLE001
        print(f'[opendatahub] GET {path} failed: {e}')
        return None


def _loc_str(val, lang='en'):
    """ODH often returns {de:..,it:..,en:..} maps; flatten to a string."""
    if isinstance(val, dict):
        return val.get(lang) or val.get('en') or val.get('de') or next(
            (v for v in val.values() if isinstance(v, str)), '')
    return val or ''


def fetch_hut(name, lat=None, lon=None):
    """Propose opening season + contact for a hut/rifugio by name (and optional
    geo). Returns {ok, opening_season?, contact?, source_url} — guarded."""
    def _produce():
        params = {'pagesize': 5, 'language': 'en'}
        if name:
            params['searchfilter'] = name
        if lat is not None and lon is not None:
            params['latitude'] = lat
            params['longitude'] = lon
            params['radius'] = 1500
        data = _get('Accommodation', params) or _get('ODHActivityPoi', params)
        items = (data or {}).get('Items') or []
        if not items:
            return {'ok': False}
        it = items[0]
        out = {'ok': True, 'source_url': SOURCE_HOME}
        # Opening season — schema varies; probe the common shapes.
        season = None
        for op in (it.get('OperationSchedule') or []):
            start, end = op.get('Start'), op.get('Stop')
            if start and end:
                season = {'start_date': start[:10], 'end_date': end[:10]}
                break
        if season:
            out['opening_season'] = season
        contact = (it.get('ContactInfos') or {})
        c = contact.get('en') or contact.get('de') or next(iter(contact.values()), {}) if isinstance(contact, dict) else {}
        if isinstance(c, dict):
            cc = {k: c.get(k) for k in ('Phonenumber', 'Email', 'Url') if c.get(k)}
            if cc:
                out['contact'] = {'phone': cc.get('Phonenumber', ''),
                                  'email': cc.get('Email', ''),
                                  'website': cc.get('Url', '')}
        return out

    if not name and (lat is None or lon is None):
        return {'ok': False}
    key = f'hut:{name}:{lat}:{lon}'
    try:
        return _cached(key, _produce)
    except Exception as e:  # noqa: BLE001
        print(f'[opendatahub] fetch_hut failed: {e}')
        return {'ok': False}


def fetch_events(lat, lon, radius_km=15, from_date=None, to_date=None, lang='en'):
    """Nearby events in a date range → [{title, start, end, source_url}]. Guarded."""
    def _produce():
        params = {'pagesize': 10, 'language': lang}
        if lat is not None and lon is not None:
            params['latitude'] = lat
            params['longitude'] = lon
            params['radius'] = int(radius_km * 1000)
        if from_date:
            params['begindate'] = from_date
        if to_date:
            params['enddate'] = to_date
        data = _get('EventShort', params) or _get('Event', params)
        items = (data or {}).get('Items') or []
        out = []
        for it in items[:10]:
            title = _loc_str(it.get('Detail'), lang) or it.get('EventTitle') or it.get('Shortname') or ''
            if isinstance(title, dict):
                title = _loc_str(title, lang)
            start = (it.get('StartDate') or it.get('DateBegin') or '')[:10]
            end = (it.get('EndDate') or it.get('DateEnd') or '')[:10]
            # Never propose a past event as current — the API's date filter is
            # unreliable, so we hard-filter to events that haven't ended yet.
            ref = end or start
            if not ref:
                continue
            try:
                if date.fromisoformat(ref) < date.today():
                    continue
            except Exception:  # noqa: BLE001
                continue
            if title:
                out.append({'title': title, 'start': start, 'end': end, 'source_url': SOURCE_HOME})
        out.sort(key=lambda e: e['start'] or e['end'])
        return out

    if lat is None or lon is None:
        return []
    key = f'events:{round(lat,3)}:{round(lon,3)}:{radius_km}:{from_date}:{to_date}'
    try:
        return _cached(key, _produce)
    except Exception as e:  # noqa: BLE001
        print(f'[opendatahub] fetch_events failed: {e}')
        return []
