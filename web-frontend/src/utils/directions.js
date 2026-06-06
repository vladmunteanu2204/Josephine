// directions.js — "get me to the trailhead" helpers (Perk #1, Hybrid).
//
// Two parts to the hybrid flow:
//   1. fetchTrailheadDirections() asks our backend (which proxies Mapbox) for a
//      branded in-app PREVIEW: drive distance + time + route line.
//   2. nativeMapsUrl() builds a deep link to the phone's own maps app for the
//      actual turn-by-turn drive — $0, and the best in-car experience.
//
// Everything degrades gracefully: no geolocation, no Mapbox token, or no route
// all still leave the native handoff working (destination-only).

import { API_URL } from '../api';

// Promise wrapper around the Geolocation API. Resolves {lon, lat} or rejects.
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('geolocation-unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lon: pos.coords.longitude, lat: pos.coords.latitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000, ...options }
    );
  });
}

// Ask the backend for a route preview. Coordinates are (lon, lat), GeoJSON order.
// Returns { enabled, route } where route is null when handoff-only:
//   - { enabled: false }            → no server token; client hands off natively
//   - { enabled: true, route: null} → token present but no route found
//   - { enabled: true, route: {distance_m, duration_s, geometry, profile} }
export async function fetchTrailheadDirections({ fromLon, fromLat, toLon, toLat, profile = 'driving' }) {
  const qs = new URLSearchParams({
    from_lon: fromLon, from_lat: fromLat,
    to_lon: toLon, to_lat: toLat, profile,
  });
  const res = await fetch(`${API_URL}/directions?${qs.toString()}`);
  if (!res.ok) throw new Error(`directions-${res.status}`);
  return res.json();
}

// Platform-aware deep link to the native maps app. iOS → Apple Maps, everything
// else (Android, desktop) → Google Maps. Both accept a destination + driving
// mode; if the device knows the user's location it fills in the origin itself.
export function nativeMapsUrl({ lat, lon, label = '' }) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '');
  const q = encodeURIComponent(label || `${lat},${lon}`);
  if (isIOS) {
    // Apple Maps: daddr as "lat,lon", dirflg=d (drive). Label via q is optional.
    return `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d&q=${q}`;
  }
  // Google Maps universal URL — opens the app on Android, the web on desktop.
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

// Format helpers (metric, matching the app's voice).
export function formatDriveDistance(meters) {
  if (meters == null) return '';
  const km = meters / 1000;
  return km < 1 ? `${Math.round(meters)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatDriveDuration(seconds) {
  if (seconds == null) return '';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
