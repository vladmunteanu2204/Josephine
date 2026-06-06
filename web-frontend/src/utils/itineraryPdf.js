// Helpers for the "Josephine — Your Alpine Companion" itinerary PDF export.
//
// Everything here is client-side: the static route map is fetched from the Mapbox
// Static Images API, and the elevation profile is decoded directly from Mapbox
// Terrain-RGB raster tiles (deterministic — no map instance, no timing races).
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Terrain-RGB tile zoom. z14 @2x ≈ ~5 m/px in the Alps — plenty for a profile.
const TILE_ZOOM = 14;

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

// ── elevation profile (Terrain-RGB tile decoding) ────────────────────────────

// Slippy-map tile maths. Returns fractional tile coordinates so we can also
// recover the exact pixel within the tile.
function lonToTileX(lon, z) {
  return ((lon + 180) / 360) * 2 ** z;
}
function latToTileY(lat, z) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

// Fetch one Terrain-RGB tile and return its decoded ImageData (512×512 → @2x
// makes it 1024×1024). Resolves null on any failure.
async function fetchTerrainTile(z, x, y) {
  if (!MAPBOX_TOKEN) return null;
  const url =
    `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}@2x.pngraw` +
    `?access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const data = ctx.getImageData(0, 0, bmp.width, bmp.height);
    try { bmp.close(); } catch { /* no-op */ }
    return data;
  } catch {
    return null;
  }
}



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
 * Sample ground elevation along the route by decoding Mapbox Terrain-RGB tiles
 * directly. Deterministic: each resampled point reads its exact pixel from the
 * elevation raster — no map instance, no idle/timing races. Always resolves to
 * [{ distKm, ele }] (metres), falling back to a synthetic profile if the tiles
 * can't be fetched, so PDF generation is never blocked.
 */
export async function sampleRouteElevation(trail, samples = 80) {
  const coords = getCoords(trail);
  const pts = resampleByDistance(coords, samples);
  if (pts.length === 0) return [];
  if (!MAPBOX_TOKEN) return fallbackProfile(trail, pts);

  // Decode Terrain-RGB: ele = -10000 + (R*256² + G*256 + B) * 0.1
  const decode = (img, px, py) => {
    const i = (py * img.width + px) * 4;
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    return -10000 + (r * 65536 + g * 256 + b) * 0.1;
  };

  const tileCache = new Map(); // "x/y" → ImageData | null (cached failures too)
  const getTile = async (tx, ty) => {
    const key = `${tx}/${ty}`;
    if (tileCache.has(key)) return tileCache.get(key);
    const img = await fetchTerrainTile(TILE_ZOOM, tx, ty);
    tileCache.set(key, img);
    return img;
  };

  const out = [];
  for (const p of pts) {
    const fx = lonToTileX(p.lon, TILE_ZOOM);
    const fy = latToTileY(p.lat, TILE_ZOOM);
    const tx = Math.floor(fx);
    const ty = Math.floor(fy);
    const img = await getTile(tx, ty); // eslint-disable-line no-await-in-loop
    let ele = null;
    if (img) {
      const px = Math.min(img.width - 1, Math.max(0, Math.floor((fx - tx) * img.width)));
      const py = Math.min(img.height - 1, Math.max(0, Math.floor((fy - ty) * img.height)));
      const v = decode(img, px, py);
      if (isFinite(v) && v > -5000 && v < 9000) ele = v;
    }
    out.push({ distKm: p.distKm, ele });
  }

  const good = out.filter((o) => o.ele != null).length;
  if (good < pts.length * 0.5) return fallbackProfile(trail, pts);
  return fillNulls(out);
}

// Build a complete, self-contained elevation-profile SVG (gridlines + axis
// labels baked in) for an elevation series, returned as a data-URL. Baking
// everything into one <img> rasterises reliably through html2canvas and always
// fills its container at full width.
export function elevationToSvg(series, { width = 720, height = 138 } = {}) {
  if (!series || series.length < 2) return null;
  const eles = series.map((s) => s.ele);
  const minE = Math.min(...eles);
  const maxE = Math.max(...eles);
  const span = Math.max(1, maxE - minE);
  const maxDist = series[series.length - 1].distKm || 1;

  // plot area (gutters for axis labels)
  const gutterL = 50;
  const gutterB = 22;
  const padT = 10;
  const padR = 14;
  const x0 = gutterL;
  const x1 = width - padR;
  const y0 = padT;
  const y1 = height - gutterB;

  const x = (d) => x0 + (d / maxDist) * (x1 - x0);
  const y = (e) => y1 - ((e - minE) / span) * (y1 - y0);

  let line = '';
  series.forEach((s, i) => {
    line += `${i === 0 ? 'M' : 'L'}${x(s.distKm).toFixed(1)},${y(s.ele).toFixed(1)} `;
  });
  const area = `${line}L${x1.toFixed(1)},${y1} L${x0.toFixed(1)},${y1} Z`;

  const round = (v, step) => Math.round(v / step) * step;
  const gridEle = [maxE, (maxE + minE) / 2, minE];
  const gridlines = gridEle
    .map((e) => {
      const yy = y(e).toFixed(1);
      return (
        `<line x1="${x0}" y1="${yy}" x2="${x1}" y2="${yy}" stroke="#e3dac4" stroke-width="1"/>` +
        `<text x="${x0 - 8}" y="${(y(e) + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="#8a8067" font-family="sans-serif">${round(e, 50)} m</text>`
      );
    })
    .join('');

  const xVals = [0, maxDist / 2, maxDist];
  const xlabels = xVals
    .map((d, i) => {
      const anchor = i === 0 ? 'start' : i === xVals.length - 1 ? 'end' : 'middle';
      return `<text x="${x(d).toFixed(1)}" y="${height - 5}" text-anchor="${anchor}" font-size="12" fill="#8a8067" font-family="sans-serif">${d.toFixed(1)} km</text>`;
    })
    .join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#2f5233" stop-opacity="0.30"/>` +
    `<stop offset="1" stop-color="#2f5233" stop-opacity="0.04"/>` +
    `</linearGradient></defs>` +
    gridlines +
    `<path d="${area.trim()}" fill="url(#eg)"/>` +
    `<path d="${line.trim()}" fill="none" stroke="#2f5233" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>` +
    xlabels +
    `</svg>`;

  return {
    width,
    height,
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
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
