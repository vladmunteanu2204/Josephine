// Helpers for the "Josephine — Your Alpine Companion" itinerary PDF export.
//
// Everything here is client-side: the static route map is fetched from the Mapbox
// Static Images API (works with the public VITE_MAPBOX_TOKEN), and the elevation
// profile is sampled from the terrain DEM via a throwaway off-screen mapbox-gl map.
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// ── geometry helpers ─────────────────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Trail coordinates are GeoJSON [lon, lat].
function getCoords(trail) {
  const c = trail?.coordinates;
  return Array.isArray(c) ? c.filter((p) => Array.isArray(p) && p.length >= 2) : [];
}

function getPois(trail) {
  const p = trail?.pois || trail?.points_of_interest || [];
  return Array.isArray(p) ? p.filter((x) => Array.isArray(x?.coordinates)) : [];
}

// Resample a [lon,lat] polyline into `n` points spaced evenly by distance,
// each carrying its cumulative distance from the start (km).
function resampleByDistance(coords, n) {
  if (coords.length < 2) return [];
  // cumulative metres at each vertex
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lo1, la1] = coords[i - 1];
    const [lo2, la2] = coords[i];
    cum.push(cum[i - 1] + haversine(la1, lo1, la2, lo2));
  }
  const total = cum[cum.length - 1];
  if (total === 0) return [];
  const out = [];
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    // find segment containing `target`
    let i = 1;
    while (i < cum.length && cum[i] < target) i++;
    if (i >= cum.length) i = cum.length - 1;
    const segStart = cum[i - 1];
    const segEnd = cum[i];
    const t = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0;
    const [lo1, la1] = coords[i - 1];
    const [lo2, la2] = coords[i];
    out.push({
      lon: lo1 + (lo2 - lo1) * t,
      lat: la1 + (la2 - la1) * t,
      distKm: target / 1000,
    });
  }
  return out;
}

// ── static route map (Mapbox Static Images API) ──────────────────────────────

// Google encoded-polyline (precision 5). Input points are [lat, lon].
function encodePolyline(points) {
  let lastLat = 0;
  let lastLon = 0;
  let result = '';
  const enc = (val) => {
    let v = val < 0 ? ~(val << 1) : val << 1;
    let chunk = '';
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    chunk += String.fromCharCode(v + 63);
    return chunk;
  };
  for (const [lat, lon] of points) {
    const latE = Math.round(lat * 1e5);
    const lonE = Math.round(lon * 1e5);
    result += enc(latE - lastLat);
    result += enc(lonE - lastLon);
    lastLat = latE;
    lastLon = lonE;
  }
  return result;
}

// Decimate to at most `max` points (keeps first & last) so the encoded overlay
// stays well under the Static API URL length limit.
function decimate(coords, max) {
  if (coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  const out = [];
  for (let k = 0; k < max; k++) out.push(coords[Math.round(k * step)]);
  return out;
}

/**
 * Build a Mapbox Static Images API URL: the route as a gold path, the start as a
 * green pin, POIs as small gold pins. Returns null if no token / coords.
 */
export function buildStaticRouteMapUrl(trail, { width = 640, height = 420 } = {}) {
  if (!MAPBOX_TOKEN) return null;
  const coords = getCoords(trail);
  if (coords.length < 2) return null;

  const latLon = decimate(coords, 120).map(([lon, lat]) => [lat, lon]);
  const encoded = encodeURIComponent(encodePolyline(latLon));
  const overlays = [`path-4+c9a84c-1(${encoded})`];

  // start pin (forest green)
  const [sLon, sLat] = coords[0];
  overlays.push(`pin-s+0c160d(${sLon.toFixed(5)},${sLat.toFixed(5)})`);
  // POI pins (gold) — cap to keep URL short
  getPois(trail)
    .slice(0, 6)
    .forEach((poi) => {
      const [lon, lat] = poi.coordinates;
      overlays.push(`pin-s+c9a84c(${lon.toFixed(5)},${lat.toFixed(5)})`);
    });

  const overlay = overlays.join(',');
  const url =
    `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${overlay}` +
    `/auto/${width}x${height}@2x?padding=44&access_token=${MAPBOX_TOKEN}`;
  // Guard against the ~8192-char URL limit (drop POI pins if needed)
  if (url.length > 8000) {
    const minimal =
      `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/` +
      `path-4+c9a84c-1(${encoded}),pin-s+0c160d(${sLon.toFixed(5)},${sLat.toFixed(5)})` +
      `/auto/${width}x${height}@2x?padding=44&access_token=${MAPBOX_TOKEN}`;
    return minimal;
  }
  return url;
}

// ── elevation profile (terrain DEM sampling) ─────────────────────────────────

function fillNulls(series) {
  const out = series.map((s) => ({ ...s }));
  // forward/backward fill, then linear interpolate interior gaps
  let lastIdx = -1;
  for (let i = 0; i < out.length; i++) {
    if (out[i].ele != null) {
      if (lastIdx >= 0 && lastIdx < i - 1) {
        const a = out[lastIdx].ele;
        const b = out[i].ele;
        for (let j = lastIdx + 1; j < i; j++) {
          const t = (j - lastIdx) / (i - lastIdx);
          out[j].ele = a + (b - a) * t;
        }
      }
      lastIdx = i;
    }
  }
  // edges
  const firstGood = out.find((o) => o.ele != null)?.ele ?? 0;
  const lastGood = [...out].reverse().find((o) => o.ele != null)?.ele ?? firstGood;
  for (let i = 0; i < out.length && out[i].ele == null; i++) out[i].ele = firstGood;
  for (let i = out.length - 1; i >= 0 && out[i].ele == null; i--) out[i].ele = lastGood;
  return out;
}

// Synthetic shape from total gain/loss when the DEM can't be sampled. Not the
// truth, but a plausible silhouette so the panel isn't empty. Returns absolute-ish
// metres using a nominal base so the axis still reads sensibly.
function fallbackProfile(trail, pts) {
  const gain = Number(trail?.elevation_gain_m) || 300;
  const base = 1200; // nominal valley floor when we have no real datum
  const n = pts.length;
  const peakAt = Math.floor(n * 0.55);
  return pts.map((p, i) => {
    const up = i <= peakAt ? i / Math.max(1, peakAt) : 1 - (i - peakAt) / Math.max(1, n - 1 - peakAt);
    // smooth with a cosine bump
    const eased = (1 - Math.cos(Math.min(1, up) * Math.PI)) / 2;
    return { distKm: p.distKm, ele: base + gain * eased, synthetic: true };
  });
}

/**
 * Sample ground elevation along the route from Mapbox's terrain DEM.
 * Resolves to [{ distKm, ele }] (metres). Always resolves (falls back to a
 * synthetic profile) and never rejects, so PDF generation can't be blocked by it.
 */
export function sampleRouteElevation(trail, samples = 64) {
  const coords = getCoords(trail);
  const pts = resampleByDistance(coords, samples);
  if (pts.length === 0) return Promise.resolve([]);
  if (!MAPBOX_TOKEN || !mapboxgl) return Promise.resolve(fallbackProfile(trail, pts));

  return new Promise((resolve) => {
    let done = false;
    let map = null;
    const container = document.createElement('div');
    container.style.cssText =
      'position:absolute;left:-9999px;top:0;width:600px;height:600px;pointer-events:none;';
    document.body.appendChild(container);

    const finish = (result) => {
      if (done) return;
      done = true;
      try { map && map.remove(); } catch { /* no-op */ }
      try { container.remove(); } catch { /* no-op */ }
      resolve(result);
    };

    const timeout = setTimeout(() => finish(fallbackProfile(trail, pts)), 12000);

    try {
      map = new mapboxgl.Map({
        container,
        accessToken: MAPBOX_TOKEN,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        interactive: false,
        attributionControl: false,
        preserveDrawingBuffer: false,
      });
    } catch {
      clearTimeout(timeout);
      return finish(fallbackProfile(trail, pts));
    }

    map.on('error', () => { /* swallow tile errors; handled by timeout/idle */ });

    map.on('load', () => {
      try {
        map.addSource('dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: 'dem', exaggeration: 1 });
      } catch { /* terrain unavailable → idle handler will fallback */ }

      const bounds = new mapboxgl.LngLatBounds(
        [pts[0].lon, pts[0].lat],
        [pts[0].lon, pts[0].lat]
      );
      pts.forEach((p) => bounds.extend([p.lon, p.lat]));
      try {
        map.fitBounds(bounds, { padding: 60, animate: false });
      } catch { /* single-point route */ }

      map.once('idle', () => {
        // Give the DEM tiles a beat to decode before querying.
        setTimeout(() => {
          const out = pts.map((p) => {
            let ele = null;
            try {
              ele = map.queryTerrainElevation([p.lon, p.lat], { exaggerated: false });
            } catch { /* point outside loaded tiles */ }
            return { distKm: p.distKm, ele: ele != null && isFinite(ele) ? ele : null };
          });
          clearTimeout(timeout);
          const good = out.filter((o) => o.ele != null).length;
          if (good < pts.length * 0.5) return finish(fallbackProfile(trail, pts));
          finish(fillNulls(out));
        }, 450);
      });
    });
  });
}

// Build an SVG path string + axis labels for an elevation series. Pure, so the
// component can render it without recomputing geometry.
export function elevationToSvg(series, { width = 560, height = 150, pad = 4 } = {}) {
  if (!series || series.length < 2) return null;
  const eles = series.map((s) => s.ele);
  const minE = Math.min(...eles);
  const maxE = Math.max(...eles);
  const span = Math.max(1, maxE - minE);
  const maxDist = series[series.length - 1].distKm || 1;

  const x = (d) => pad + (d / maxDist) * (width - 2 * pad);
  const y = (e) => height - pad - ((e - minE) / span) * (height - 2 * pad);

  let line = '';
  series.forEach((s, i) => {
    line += `${i === 0 ? 'M' : 'L'}${x(s.distKm).toFixed(1)},${y(s.ele).toFixed(1)} `;
  });
  const area = `${line}L${x(maxDist).toFixed(1)},${height - pad} L${pad},${height - pad} Z`;

  // round axis labels to friendly steps
  const round = (v, step) => Math.round(v / step) * step;
  return {
    width,
    height,
    line: line.trim(),
    area: area.trim(),
    minLabel: `${round(minE, 50)} m`,
    maxLabel: `${round(maxE, 50)} m`,
    distLabel: `${maxDist.toFixed(1)} km`,
    synthetic: !!series[0]?.synthetic,
  };
}

// ── "your day at a glance" schedule (derived) ────────────────────────────────

const POI_ICON = {
  viewpoint: '🏔️',
  summit: '🏔️',
  peak: '🏔️',
  refuge: '🏠',
  rifugio: '🏠',
  hut: '🏠',
  food: '🍽️',
  restaurant: '🍽️',
  lake: '💧',
  water: '💧',
  cultural: '⛪',
  church: '⛪',
  park: '🌲',
  forest: '🌲',
};

function iconForType(type) {
  return POI_ICON[(type || '').toLowerCase()] || '📍';
}

function fmtTime(hoursFromMidnight) {
  const h = Math.floor(hoursFromMidnight);
  const m = Math.round((hoursFromMidnight - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Nearest route-vertex index for ordering POIs along the trail.
function nearestIndex(coords, lon, lat) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversine(lat, lon, coords[i][1], coords[i][0]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * Rough "08:00 Start → … → Finish" timeline derived from duration + POI order.
 * Honest about being an estimate (the caller labels it "at a glance").
 * Returns [{ time, label, sub, icon }].
 */
export function deriveSchedule(trail, { startHour = 8 } = {}) {
  const coords = getCoords(trail);
  if (coords.length < 2) return [];
  const duration = Number(trail?.duration_hours) || 3;
  const lastIdx = coords.length - 1;

  const pois = getPois(trail)
    .map((poi) => ({
      poi,
      idx: nearestIndex(coords, poi.coordinates[0], poi.coordinates[1]),
    }))
    .filter((p) => p.idx > 0 && p.idx < lastIdx)
    .sort((a, b) => a.idx - b.idx);

  // keep up to 4 interior stops, evenly spread if there are more
  let interior = pois;
  if (pois.length > 4) {
    const stride = pois.length / 4;
    interior = [0, 1, 2, 3].map((k) => pois[Math.floor(k * stride)]);
  }

  const steps = [];
  steps.push({
    time: fmtTime(startHour),
    label: trail.name?.split('–')[0]?.trim() || 'Start',
    sub: 'Trailhead',
    icon: '📍',
  });
  interior.forEach(({ poi, idx }) => {
    const frac = idx / lastIdx;
    steps.push({
      time: fmtTime(startHour + duration * frac),
      label: poi.name,
      sub: poi.type ? poi.type.replace(/_/g, ' ') : '',
      icon: iconForType(poi.type),
    });
  });
  steps.push({
    time: fmtTime(startHour + duration),
    label: trail.trail_type === 'loop' || trail.trail_type === 'out_and_back'
      ? 'Back to start'
      : 'Finish',
    sub: 'Trail end',
    icon: '🏁',
  });
  return steps;
}
