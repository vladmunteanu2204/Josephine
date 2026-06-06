import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigation, MapPin, Car, Loader2 } from 'lucide-react';
import { PERK_TURN_BY_TURN } from '../featureFlags';
import {
  getCurrentPosition,
  fetchTrailheadDirections,
  nativeMapsUrl,
  formatDriveDistance,
  formatDriveDuration,
} from '../utils/directions';
import './TrailheadDirections.css';

/**
 * TrailheadDirections — "get me to the trailhead" (Perk #1, Hybrid).
 *
 * Shows a branded preview (drive distance + time, route line via onRoute) then
 * hands off to the phone's native maps app for the real turn-by-turn drive.
 * Destination = the trail's parking coordinate if present, else the route start.
 *
 * Degrades gracefully: location denied or no Mapbox token still leaves the
 * "Start navigation" native handoff fully working (destination-only).
 *
 * @param {object}   trail    the full trail record
 * @param {function} onRoute  optional — receives the driving GeoJSON LineString
 *                            (or null to clear) so the map can draw the route.
 */
function TrailheadDirections({ trail, onRoute }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState('idle'); // idle|locating|loading|ready|error
  const [preview, setPreview] = useState(null);  // {distance_m, duration_s}

  // Premium-gateable, but ON for everyone today (build perks open during testing).
  if (!PERK_TURN_BY_TURN) return null;

  const dest = Array.isArray(trail.parking_coordinates) && trail.parking_coordinates.length >= 2
    ? trail.parking_coordinates
    : (Array.isArray(trail.coordinates) ? trail.coordinates[0] : null);

  if (!dest || dest.length < 2) return null; // nothing to route to
  const [destLon, destLat] = dest;
  const parkingText = trail.trailhead_info?.parking || trail.transport?.car || '';

  const openNativeMaps = () => {
    window.open(nativeMapsUrl({ lat: destLat, lon: destLon, label: trail.name }), '_blank', 'noopener');
  };

  const handlePreview = async () => {
    setStatus('locating');
    let origin;
    try {
      origin = await getCurrentPosition();
    } catch {
      // No location (denied/unsupported) → skip preview, hand off natively.
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      const data = await fetchTrailheadDirections({
        fromLon: origin.lon, fromLat: origin.lat, toLon: destLon, toLat: destLat,
      });
      if (data.enabled && data.route) {
        setPreview({ distance_m: data.route.distance_m, duration_s: data.route.duration_s });
        onRoute?.(data.route.geometry);
        setStatus('ready');
      } else {
        // No token, or no route found → handoff only.
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const busy = status === 'locating' || status === 'loading';

  return (
    <div className="thd">
      <div className="thd__head">
        <Car size={18} strokeWidth={2} className="thd__head-icon" />
        <h3 className="thd__title">{t('trail.gettingThere', 'Getting there')}</h3>
      </div>

      {parkingText && (
        <p className="thd__parking">
          <MapPin size={14} strokeWidth={2} /> {parkingText}
        </p>
      )}

      {status === 'ready' && preview && (
        <div className="thd__preview" role="status">
          <span className="thd__preview-stat">
            <strong>{formatDriveDistance(preview.distance_m)}</strong>
            <span className="thd__preview-label">{t('trail.driveDistance', 'drive')}</span>
          </span>
          <span className="thd__preview-divider" aria-hidden="true">·</span>
          <span className="thd__preview-stat">
            <strong>{formatDriveDuration(preview.duration_s)}</strong>
            <span className="thd__preview-label">{t('trail.driveTime', 'by car')}</span>
          </span>
        </div>
      )}

      {status === 'error' && (
        <p className="thd__note">{t('trail.directionsHandoffNote', 'Tap below to open turn-by-turn in your maps app.')}</p>
      )}

      <div className="thd__actions">
        {status !== 'ready' && (
          <button
            className="thd__btn thd__btn--ghost"
            onClick={handlePreview}
            disabled={busy}
          >
            {busy
              ? <><Loader2 size={16} className="thd__spin" /> {status === 'locating' ? t('trail.locating', 'Locating you…') : t('trail.routing', 'Finding route…')}</>
              : <>{t('trail.previewRoute', 'Preview drive')}</>}
          </button>
        )}
        <button className="thd__btn thd__btn--primary" onClick={openNativeMaps}>
          <Navigation size={16} strokeWidth={2} /> {t('trail.startNavigation', 'Start navigation')}
        </button>
      </div>
    </div>
  );
}

export default TrailheadDirections;
