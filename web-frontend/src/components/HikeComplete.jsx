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
export default function HikeComplete({ hikeData, line, onDone, onAddReview, onExportGpx }) {
  const { t } = useTranslation();
  const stats = hikeData?.stats || {};
  const moments = hikeData?.visited_checkpoints || [];

  const celebrateState = hikeData?.is_summit ? 'celebrateSummit' : 'celebrate';

  return (
    <div className="hc-overlay">
      <div className="hc-card">
        <JosephineAvatar state={celebrateState} size={148} feather={false} className="hc-avatar" />
        <p className="hc-eyebrow">{t('gps.completeEyebrow', 'Hike complete')}</p>
        <h2 className="hc-title">{t('gps.completeTitle', 'Beautiful work')}</h2>
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
            <span className="hc-stat-v">{Math.round(stats.elevation_gain_m || 0)} m</span>
            <span className="hc-stat-l">{t('gps.completeAscent', 'Ascent')}</span>
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
