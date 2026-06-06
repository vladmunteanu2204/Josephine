import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Check, MapPin } from 'lucide-react';
import { PERK_OFFLINE_DOWNLOAD } from '../featureFlags';
import { canExportGpx, downloadTrailGpx } from '../utils/gpxExport';
import './OfflineDownload.css';

/**
 * OfflineDownload — "take it offline" (Perk: GPS-track download).
 *
 * One tap builds a standard GPX from the trail (client-side) and downloads it,
 * so the hiker can open it in any offline navigation app for no-signal stretches.
 *
 * Premium-gateable, but ON for everyone today (perks open during testing).
 *
 * @param {object} trail the full trail record
 */
function OfflineDownload({ trail }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);

  if (!PERK_OFFLINE_DOWNLOAD) return null;
  if (!canExportGpx(trail)) return null; // nothing to export

  const poiCount = Array.isArray(trail.pois)
    ? trail.pois.filter((p) => Array.isArray(p?.coordinates) && p.coordinates.length >= 2).length
    : 0;
  const ptCount = trail.coordinates.length;

  const handleDownload = () => {
    downloadTrailGpx(trail);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <div className="ofd">
      <div className="ofd__head">
        <Download size={18} strokeWidth={2} className="ofd__head-icon" />
        <h3 className="ofd__title">{t('trail.takeOffline', 'Take it offline')}</h3>
      </div>

      <p className="ofd__note">
        {t(
          'trail.offlineNote',
          'Download the GPS track and open it in your offline maps app — handy where there’s no signal on the mountain.',
        )}
      </p>

      <div className="ofd__meta">
        <span className="ofd__meta-item">
          <MapPin size={13} strokeWidth={2} /> {ptCount} {t('trail.trackPoints', 'track points')}
        </span>
        {poiCount > 0 && (
          <span className="ofd__meta-item">
            {poiCount} {t('trail.waypoints', 'waypoints')}
          </span>
        )}
      </div>

      <button
        className={`ofd__btn${done ? ' ofd__btn--done' : ''}`}
        onClick={handleDownload}
      >
        {done
          ? <><Check size={16} strokeWidth={2.5} /> {t('trail.downloaded', 'Downloaded')}</>
          : <><Download size={16} strokeWidth={2} /> {t('trail.downloadGpx', 'Download GPS track (GPX)')}</>}
      </button>
    </div>
  );
}

export default OfflineDownload;
