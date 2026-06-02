// ─── Geographic Awareness — South Tyrol / Dolomites ──────────────────────────
// Detects when a recommended trail is far from the user's stated start area
// and suggests transportation context. Zero API cost — pure lookup + haversine.

// ── Known area name → [lat, lon] ─────────────────────────────────────────────
// Covers the main towns/valleys a user might type as their starting point.
// Alias pairs handle Italian/German bilingual names and common abbreviations.
const AREA_COORDS = {
  // Merano area
  'merano':            [46.672, 11.159],
  'meran':             [46.672, 11.159],
  'tirolo':            [46.699, 11.155],
  'tirol':             [46.699, 11.155],
  'lagundo':           [46.686, 11.138],
  'algund':            [46.686, 11.138],
  'lana':              [46.615, 11.150],
  'marlengo':          [46.651, 11.131],
  'marlinge':          [46.651, 11.131],
  'scena':             [46.685, 11.170],
  'schenna':           [46.685, 11.170],
  'rablà':             [46.660, 11.080],
  'rabland':           [46.660, 11.080],

  // Bolzano area
  'bolzano':           [46.498, 11.354],
  'bozen':             [46.498, 11.354],
  'appiano':           [46.448, 11.252],
  'eppan':             [46.448, 11.252],
  'caldaro':           [46.373, 11.244],
  'kaltern':           [46.373, 11.244],
  'renon':             [46.559, 11.413],
  'ritten':            [46.559, 11.413],
  'castel firmiano':   [46.474, 11.298],
  'sigmundskron':      [46.474, 11.298],

  // Bressanone / Brixen
  'bressanone':        [46.716, 11.656],
  'brixen':            [46.716, 11.656],

  // Vipiteno / Sterzing
  'vipiteno':          [46.893, 11.433],
  'sterzing':          [46.893, 11.433],

  // Val Gardena
  'ortisei':           [46.575, 11.671],
  'st. ulrich':        [46.575, 11.671],
  'santa cristina':    [46.563, 11.722],
  'st. christina':     [46.563, 11.722],
  'selva':             [46.552, 11.763],
  'wolkenstein':       [46.552, 11.763],
  'val gardena':       [46.575, 11.720],
  'gröden':            [46.575, 11.720],
  'grödental':         [46.575, 11.720],
  'alpe di siusi':     [46.543, 11.628],
  'seiser alm':        [46.543, 11.628],
  'passo gardena':     [46.510, 11.822],
  'grödner joch':      [46.510, 11.822],

  // Val Sarentino
  'sarentino':         [46.631, 11.357],
  'sarnthein':         [46.631, 11.357],
  'val sarentino':     [46.631, 11.357],
  'sarntal':           [46.631, 11.357],

  // Val Pusteria / Pustertal
  'brunico':           [46.796, 11.936],
  'bruneck':           [46.796, 11.936],
  'bressanone val pusteria': [46.796, 11.936],
  'campo tures':       [46.918, 11.957],
  'sand in taufers':   [46.918, 11.957],
  'dobbiaco':          [46.731, 12.218],
  'toblach':           [46.731, 12.218],
  'san candido':       [46.732, 12.285],
  'innichen':          [46.732, 12.285],
  'sesto':             [46.700, 12.349],
  'sexten':            [46.700, 12.349],
  'val pusteria':      [46.796, 12.000],
  'pustertal':         [46.796, 12.000],
  'san vigilio':       [46.700, 11.927],
  'st. vigil':         [46.700, 11.927],
  'lago di braies':    [46.694, 12.084],
  'pragser wildsee':   [46.694, 12.084],

  // Vinschgau / Venosta
  'naturns':           [46.649, 11.006],
  'naturno':           [46.649, 11.006],
  'silandro':          [46.628, 10.773],
  'schlanders':        [46.628, 10.773],
  'malles':            [46.684, 10.549],
  'mals':              [46.684, 10.549],
  'glorenza':          [46.673, 10.560],
  'glurns':            [46.673, 10.560],
  'prato allo stelvio':[46.614, 10.597],
  'prad am stilfserjoch': [46.614, 10.597],
  'vinschgau':         [46.660, 10.850],
  'venosta':           [46.660, 10.850],
  'val venosta':       [46.660, 10.850],
  'reschenpass':       [46.831, 10.519],
  'reschensee':        [46.808, 10.530],

  // Dolomiti / Eastern Dolomites
  'cortina':           [46.540, 12.137],
  "cortina d'ampezzo": [46.540, 12.137],
  'arabba':            [46.497, 11.872],
  'corvara':           [46.549, 11.872],
  'alta badia':        [46.565, 11.894],
  'val badia':         [46.626, 11.878],
  'san martino in badia': [46.699, 11.947],
  'st. martin in thurn': [46.699, 11.947],
  'canazei':           [46.476, 11.771],
  'passo pordoi':      [46.488, 11.824],
  'lago di sorapis':   [46.557, 12.202],
  'misurina':          [46.584, 12.173],
  'tre cime':          [46.620, 12.302],
  'drei zinnen':       [46.620, 12.302],
};

// ── Trail region → centroid [lat, lon] ────────────────────────────────────────
// One centroid per region used in trails.json. Approximate geographic center.
const REGION_COORDS = {
  'Bolzano & Surroundings': [46.498, 11.354],
  'Merano & Surroundings':  [46.672, 11.159],
  'Val Gardena':             [46.565, 11.710],
  'Val Pusteria':            [46.760, 12.050],
  'Val Sarentino':           [46.631, 11.370],
  'Vinschgau':               [46.660, 10.850],
  'Dolomites':               [46.570, 12.100],
  'South Tyrol':             [46.600, 11.400],  // generic fallback
};

// ── Approximate driving times (minutes) between major hubs ───────────────────
// Used to give a realistic hint rather than just km ("about X minutes by car").
// Only one-way pairs are stored; lookup normalises order.
const DRIVE_TIMES = {
  'merano|bolzano':         35,
  'merano|val gardena':     55,
  'merano|bressanone':      45,
  'merano|val pusteria':    80,
  'merano|vinschgau':       30,
  'merano|dolomites':       90,
  'bolzano|val gardena':    40,
  'bolzano|bressanone':     30,
  'bolzano|val pusteria':   70,
  'bolzano|vinschgau':      55,
  'bolzano|dolomites':      75,
  'val gardena|val pusteria': 55,
  'val gardena|bressanone': 35,
  'val gardena|dolomites':  45,
  'bressanone|val pusteria': 45,
  'val pusteria|dolomites': 40,
  'vinschgau|val gardena':  75,
};

// Known SAD bus connections between regions (line numbers approximate)
const BUS_CONNECTIONS = {
  'merano|val gardena':    'SAD line 170 (Merano → Ortisei)',
  'merano|bolzano':        'SAD line 201 (Merano → Bolzano, frequent)',
  'bolzano|val gardena':   'SAD line 170 (Bolzano → Ortisei)',
  'bolzano|bressanone':    'Train + SAD (Bolzano → Brixen, frequent)',
  'bolzano|val pusteria':  'Train to Brunico + local bus',
  'bolzano|dolomites':     'SAD line 445 (Bolzano → Cortina, seasonal)',
  'val gardena|val pusteria': 'SAD line 442 via Passo Gardena (summer only)',
  'val pusteria|dolomites':'SAD line 446 (Brunico → Cortina)',
  'merano|vinschgau':      'SAD line 221 (Merano → Malles/Mals)',
};

// ─────────────────────────────────────────────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Resolve a user-typed area name to [lat, lon]. Tries exact match, then
// partial/contained match, then any token match.
function resolveAreaCoords(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();

  if (AREA_COORDS[key]) return { coords: AREA_COORDS[key], matched: key };

  // Partial containment (handles "near Merano", "Merano area", etc.)
  for (const [k, v] of Object.entries(AREA_COORDS)) {
    if (key.includes(k) || k.includes(key)) return { coords: v, matched: k };
  }

  // Token match — any meaningful word in the input
  const tokens = key.split(/[\s,/]+/).filter(t => t.length > 2);
  for (const token of tokens) {
    if (AREA_COORDS[token]) return { coords: AREA_COORDS[token], matched: token };
    for (const [k, v] of Object.entries(AREA_COORDS)) {
      if (k.includes(token) || token.includes(k)) return { coords: v, matched: k };
    }
  }

  return null;
}

// Bucket a lat/lon into the nearest known region name (for drive-time lookup)
function coordsToRegionBucket(lat, lon) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const [region, [rlat, rlon]] of Object.entries(REGION_COORDS)) {
    const d = haversineKm(lat, lon, rlat, rlon);
    if (d < nearestDist) { nearestDist = d; nearest = region; }
  }
  return nearest;
}

// Look up approximate drive time between two region buckets
function getDriveMinutes(regionA, regionB) {
  const a = regionA.toLowerCase().replace('& surroundings', '').replace('& surrounding', '').trim();
  const b = regionB.toLowerCase().replace('& surroundings', '').replace('& surrounding', '').trim();
  const key1 = `${a}|${b}`;
  const key2 = `${b}|${a}`;
  return DRIVE_TIMES[key1] ?? DRIVE_TIMES[key2] ?? null;
}

function getBusLine(regionA, regionB) {
  const a = regionA.toLowerCase().replace('& surroundings', '').trim();
  const b = regionB.toLowerCase().replace('& surroundings', '').trim();
  return BUS_CONNECTIONS[`${a}|${b}`] ?? BUS_CONNECTIONS[`${b}|${a}`] ?? null;
}

// ─── Main exports ─────────────────────────────────────────────────────────────

/**
 * Check distance from a known area name to a trail region.
 * Use this when the user typed a start area (e.g. "near Tirolo").
 */
export function checkDistanceWarning(startArea, trailRegion) {
  const resolved = resolveAreaCoords(startArea);
  if (!resolved) return null;
  return _checkFromCoords(resolved.coords[0], resolved.coords[1],
    resolved.matched.replace(/\b\w/g, c => c.toUpperCase()), trailRegion);
}

/**
 * Check distance from the user's GPS coordinates to a trail region.
 * Use this when geolocation is available (the primary check for awareness).
 *
 * @param {number} userLat
 * @param {number} userLon
 * @param {string} trailRegion — e.g. "Val Gardena"
 */
export function checkDistanceFromGPS(userLat, userLon, trailRegion) {
  // Don't warn if GPS is the generic Dolomites fallback (46.5, 11.35)
  // — that means we never got a real position, so we can't give accurate distance
  if (Math.abs(userLat - 46.5) < 0.02 && Math.abs(userLon - 11.35) < 0.02) return null;

  const nearestArea = coordsToRegionBucket(userLat, userLon);
  // Find the canonical display name for the user's location
  let displayName = nearestArea?.replace(' & Surroundings', '') ?? 'your location';

  // Try to resolve a more specific town name from the coords
  let closestTown = null, closestDist = Infinity;
  for (const [name, [lat, lon]] of Object.entries(AREA_COORDS)) {
    const d = haversineKm(userLat, userLon, lat, lon);
    if (d < closestDist) { closestDist = d; closestTown = name; }
  }
  if (closestDist < 8) {
    displayName = closestTown.replace(/\b\w/g, c => c.toUpperCase());
  }

  return _checkFromCoords(userLat, userLon, displayName, trailRegion);
}

// Shared implementation
function _checkFromCoords(lat, lon, locationLabel, trailRegion) {
  const regionCentroid = REGION_COORDS[trailRegion];
  if (!regionCentroid) return null;

  const distKm = haversineKm(lat, lon, regionCentroid[0], regionCentroid[1]);
  if (distKm < 30) return null;  // same area — no warning needed

  const startRegion = coordsToRegionBucket(lat, lon);
  const driveMinutes = getDriveMinutes(startRegion, trailRegion);
  const busLine = getBusLine(startRegion, trailRegion);

  return {
    distKm:         Math.round(distKm),
    driveMinutes,
    busLine,
    startAreaLabel: locationLabel,
    trailRegion,
  };
}

/**
 * Builds a natural Josephine-voice transport awareness message.
 * Rotates through variants so it never feels copy-pasted.
 *
 * @param {ReturnType<typeof checkDistanceWarning>} warning
 * @param {number} seed — use e.g. Date.now() for variety
 */
export function buildTransportNote(warning, seed = 0) {
  const { distKm, driveMinutes, busLine, startAreaLabel, trailRegion } = warning;

  const driveHint = driveMinutes
    ? `about ${driveMinutes} minutes by car`
    : distKm > 100
      ? 'a good hour and a half by car'
      : distKm > 60
        ? 'roughly an hour by car'
        : 'about 40–50 minutes by car';

  const busHint = busLine
    ? ` ${busLine} runs there too.`
    : '';

  const regionLabel = trailRegion.replace(' & Surroundings', '');

  const variants = [
    `One thing worth knowing — ${regionLabel} is about ${distKm} km from ${startAreaLabel}, ${driveHint}.${busHint} Are you planning to drive, or would you like something a bit closer?`,
    `Just flagging: this trail is in ${regionLabel}, around ${distKm} km from ${startAreaLabel} (${driveHint}).${busHint} Totally worth it — just factor in the travel.`,
    `Heads up — ${regionLabel} is about ${distKm} km from ${startAreaLabel}, so plan for ${driveHint} each way.${busHint}`,
  ];

  return variants[seed % variants.length];
}
