// gpxExport.js — "download for offline" helper (Perk: offline GPS-track download).
//
// Builds a standard GPX 1.1 file from a trail record entirely in the browser
// (the trail's coordinates + POIs are already loaded), then triggers a download.
// The user opens the .gpx in any offline navigation app (Organic Maps, Gaia,
// Komoot, OsmAnd…) for no-signal stretches. Zero backend cost, works offline.
//
// Trail coordinates are GeoJSON order [lon, lat]; GPX wants lat/lon attributes.

const CREATOR = 'Josephine — Alpenvia';

// XML-escape the few characters that matter inside attributes / text nodes.
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A filesystem-friendly slug for the download filename.
function slugify(str) {
  return String(str || 'trail')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'trail';
}

/**
 * Build a GPX 1.1 document string for a trail.
 * - <trk> with one <trkseg> from trail.coordinates
 * - one <wpt> per POI that has coordinates
 * @param {object} trail full trail record
 * @returns {string} GPX XML
 */
export function buildTrailGpx(trail) {
  const coords = Array.isArray(trail?.coordinates) ? trail.coordinates : [];
  const pois = Array.isArray(trail?.pois) ? trail.pois : [];
  const name = trail?.name || 'Trail';
  const time = new Date().toISOString();

  const waypoints = pois
    .filter((p) => Array.isArray(p?.coordinates) && p.coordinates.length >= 2)
    .map((p) => {
      const [lon, lat] = p.coordinates;
      const desc = p.description ? `\n    <desc>${esc(p.description)}</desc>` : '';
      const type = p.type ? `\n    <type>${esc(p.type)}</type>` : '';
      return `  <wpt lat="${lat}" lon="${lon}">\n    <name>${esc(p.name || 'Point')}</name>${desc}${type}\n  </wpt>`;
    })
    .join('\n');

  const trkpts = coords
    .filter((c) => Array.isArray(c) && c.length >= 2)
    .map((c) => `      <trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`)
    .join('\n');

  const metaDesc = trail?.tagline ? `\n    <desc>${esc(trail.tagline)}</desc>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${esc(CREATOR)}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${esc(name)}</name>${metaDesc}
    <time>${time}</time>
  </metadata>
${waypoints ? waypoints + '\n' : ''}  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

// Whether a trail has enough geometry to be worth exporting.
export function canExportGpx(trail) {
  return Array.isArray(trail?.coordinates) && trail.coordinates.length >= 2;
}

/**
 * Generate the GPX and trigger a browser download.
 * @param {object} trail full trail record
 */
export function downloadTrailGpx(trail) {
  const gpx = buildTrailGpx(trail);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(trail?.name)}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
