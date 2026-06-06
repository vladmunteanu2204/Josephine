import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, TrendingUp } from 'lucide-react';
import JosephineAvatar from './JosephineAvatar';
import './HikeComplete.css';

const fmtDist = (km) => (km < 1 ? `${Math.round((km || 0) * 1000)} m` : `${km.toFixed(1)} km`);
const fmtDur = (h) => {
  const s = Math.round((h || 0) * 3600);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
};

// On-brand post-hike close — Josephine sees you off the trail. No gamification.
// `completed` distinguishes a full finish (celebratory) from turning back early
// (a calmer, encouraging close).
export default function HikeComplete({ hikeData, line, completed = true, onDone, onAddReview, onExportGpx }) {
  const { t } = useTranslation();
  const stats = hikeData?.stats || {};
  const moments = hikeData?.visited_checkpoints || [];

  // Full finish → celebrate (summit flag plants the flag). Early exit → peaceful.
  const celebrateState = completed
    ? (hikeData?.is_summit ? 'celebrateSummit' : 'celebrate')
    : 'peaceful';
  const eyebrow = completed
    ? t('gps.completeEyebrow', 'Hike complete')
    : t('gps.endedEyebrow', 'Hike ended');
  const title = completed
    ? t('gps.completeTitle', 'Beautiful work')
    : t('gps.endedTitle', 'Good effort today');

  // Ascent headline: for a *completed* planned trail we trust the official
  // surveyed profile (the trail's stored gain) as the headline number, and show
  // the GPS/DEM-measured track underneath as "your track". For early exits or
  // free hikes (no official profile), the measured value is the headline.
  const measuredAscent = Math.round(stats.elevation_gain_m || 0);
  const officialAscent = stats.trail_elevation_gain_m != null
    ? Math.round(stats.trail_elevation_gain_m) : null;
  const useOfficialAscent = completed && officialAscent != null;
  const ascentValue = useOfficialAscent ? officialAscent : measuredAscent;

  return (
    <div className={`hc-overlay${completed ? '' : ' hc-overlay--partial'}`}>
      <div className="hc-card">
        <JosephineAvatar state={celebrateState} size={148} feather={false} className="hc-avatar" />
        <p className="hc-eyebrow">{eyebrow}</p>
        <h2 className="hc-title">{title}</h2>
        <p className="hc-trail">{hikeData?.trail_name}</p>
        {line && <p className="hc-line">“{line}”</p>}

        <div className="hc-stats">
          <div className="hc-stat">
            <MapPin size={15} strokeWidth={2} />
            <span className="hc-stat-v">{fmtDist(stats.distance_km)}</span>
            <span className="hc-stat-l">{t('gps.completeDistance', 'Distance')}</span>
          </div>
          <div className="hc-stat">
            <Clock size={15} strokeWidth={2} />
            <span className="hc-stat-v">{fmtDur(stats.duration_hours)}</span>
            <span className="hc-stat-l">{t('gps.completeTime', 'Time')}</span>
          </div>
          <div className="hc-stat">
            <TrendingUp size={15} strokeWidth={2} />
            <span className="hc-stat-v">{ascentValue} m</span>
            <span className="hc-stat-l">{t('gps.completeAscent', 'Ascent')}</span>
            {useOfficialAscent && (
              <span className="hc-stat-sub">
                {t('gps.completeYourTrack', 'Your track')}: {measuredAscent} m
              </span>
            )}
          </div>
        </div>

        {moments.length > 0 && (
          <div className="hc-moments">
            <p className="hc-moments-l">{t('gps.completeAlong', 'Along the way')}</p>
            <ul className="hc-moments-list">
              {moments.map((m, i) => <li key={i}>✦ {m.name}</li>)}
            </ul>
          </div>
        )}

        <div className="hc-actions">
          <button className="hc-btn hc-btn--primary" onClick={onDone}>
            {t('gps.completeDone', 'Done')}
          </button>
          <div className="hc-actions-row">
            {onExportGpx && (
              <button className="hc-btn hc-btn--ghost" onClick={onExportGpx}>
                {t('gps.completeSave', 'Save route')}
              </button>
            )}
            {onAddReview && (
              <button className="hc-btn hc-btn--ghost" onClick={onAddReview}>
                {t('gps.completeReview', 'Write a review')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
