import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin, Mountain, Clock, Timer, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Heart, Check, Camera, Flag, Sparkles,
} from 'lucide-react';
import './HikeRecapSheet.css';

// Fixed A4 portrait canvas (96dpi), off-screen rasterised → single-page PDF.
export const RCP_WIDTH = 794;
export const RCP_HEIGHT = 1123;

const fmtDur = (h) => {
  const s = Math.round((h || 0) * 3600);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
};
const fmtSec = (sec) => fmtDur((sec || 0) / 3600);
const fmtDist = (km) => (km < 1 ? `${Math.round((km || 0) * 1000)} m` : `${(km || 0).toFixed(1)} km`);

function Stat({ icon, label, value }) {
  return (
    <div className="rcp-stat">
      <div className="rcp-stat__icon">{icon}</div>
      <div className="rcp-stat__label">{label}</div>
      <div className="rcp-stat__value">{value}</div>
    </div>
  );
}

/**
 * HikeRecapSheet — the post-hike "Trip Recap" one-pager. Purely presentational;
 * every value comes from the recorded hike (no invented data). Optional panels
 * (reflections, photos, route, best moments) are omitted when their data is absent.
 */
function HikeRecapSheet({ hikeData, trail, mapImg, elev, photos = [], recap }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.slice(0, 2) || 'en';
  const stats = hikeData?.stats || {};

  const dateStr = hikeData?.start_time
    ? new Date(hikeData.start_time).toLocaleDateString(
        lng, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  // Headline ascent: official planned profile if the hike was completed, else measured.
  const measuredAscent = Math.round(stats.elevation_gain_m || recap?.ascentM || 0);
  const ascentHeadline = hikeData?.completed && stats.trail_elevation_gain_m != null
    ? Math.round(stats.trail_elevation_gain_m) : measuredAscent;

  const checkpoints = Array.isArray(hikeData?.visited_checkpoints) ? hikeData.visited_checkpoints : [];
  const moments = (checkpoints.length > 0
    ? checkpoints.map((c) => ({ name: c.name }))
    : (Array.isArray(trail?.highlights) ? trail.highlights.map((h) => ({ name: h })) : [])
  ).slice(0, 3);

  const note = (hikeData?.note || '').trim();

  // "Highlights achieved" — assembled from what actually happened.
  const achievements = [];
  if (hikeData?.completed) achievements.push(t('recap.achCompleted', 'Completed {{trail}}', { trail: hikeData.trail_name }));
  if (hikeData?.is_summit) achievements.push(t('recap.achSummit', 'Reached the summit'));
  if (recap?.highestM) achievements.push(t('recap.achAltitude', 'Reached {{m}} m altitude', { m: recap.highestM.toLocaleString() }));
  if (checkpoints.length > 0) achievements.push(t('recap.achMoments', 'Lived {{n}} moments along the way', { n: checkpoints.length }));
  achievements.push(t('recap.achTogether', 'Quality time with your alpine companion'));

  const note2 = (trail?.josephineNote && (trail.josephineNote[lng] || trail.josephineNote.en)) || null;

  return (
    <div className="rcp" style={{ width: RCP_WIDTH, height: RCP_HEIGHT }}>
      {/* ── Header ── */}
      <header className="rcp-header">
        <div className="rcp-brand">
          <img className="rcp-brand__logo" src="/josephine/portrait.png" alt=""
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div>
            <div className="rcp-brand__name">JOSEPHINE</div>
            <div className="rcp-brand__tag">YOUR ALPINE COMPANION</div>
          </div>
        </div>
        <div className="rcp-mark">
          <Sparkles size={16} className="rcp-gold" strokeWidth={2} />
          <span className="rcp-mark__txt">{t('recap.mark', 'TRIP RECAP')}</span>
        </div>
      </header>

      {/* ── Title ── */}
      <section className="rcp-title">
        <h1 className="rcp-h1">{t('recap.title', 'Trip Recap')}</h1>
        <div className="rcp-trailname">
          <MapPin size={18} className="rcp-green" strokeWidth={2.4} />
          <span>{hikeData?.trail_name || trail?.name}</span>
          {trail?.region && <span className="rcp-region"> · {trail.region}</span>}
        </div>
        {dateStr && <div className="rcp-date">{dateStr}</div>}
        <p className="rcp-tagline">{t('recap.tagline', 'Another adventure, another memory')} <Heart size={13} className="rcp-gold" /></p>
      </section>

      {/* ── Overview stats ── */}
      <section className="rcp-overview">
        <h3 className="rcp-card__title">{t('recap.overview', 'Hike overview')}</h3>
        <div className="rcp-stats">
          <Stat icon={<MapPin size={20} />} label={t('recap.distance', 'Distance')} value={fmtDist(stats.distance_km)} />
          <Stat icon={<TrendingUp size={20} />} label={t('recap.elevGain', 'Elevation gain')} value={`+${ascentHeadline} m`} />
          <Stat icon={<Clock size={20} />} label={t('recap.duration', 'Duration')} value={fmtDur(stats.duration_hours)} />
          {recap?.movingSec ? (
            <Stat icon={<Timer size={20} />} label={t('recap.movingTime', 'Moving time')} value={fmtSec(recap.movingSec)} />
          ) : (
            <Stat icon={<Mountain size={20} />} label={t('recap.highest', 'Highest point')} value={recap?.highestM ? `${recap.highestM.toLocaleString()} m` : '—'} />
          )}
        </div>
      </section>

      {/* ── Route + elevation summary ── */}
      {mapImg && (
        <section className="rcp-mid">
          <div className="rcp-card rcp-route">
            <h3 className="rcp-card__title"><Mountain size={15} /> {t('recap.routeMap', 'Route map')}</h3>
            <img className="rcp-route__map" src={mapImg} alt="" crossOrigin="anonymous" />
            {elev && <img className="rcp-route__elev" src={elev.dataUrl} alt="" />}
          </div>
          <div className="rcp-side">
            {recap?.highestM != null && (
              <div className="rcp-mini"><span className="rcp-mini__icon"><Mountain size={16} /></span>
                <div><div className="rcp-mini__label">{t('recap.highest', 'Highest point')}</div><div className="rcp-mini__value">{recap.highestM.toLocaleString()} m</div></div></div>
            )}
            {recap?.lowestM != null && (
              <div className="rcp-mini"><span className="rcp-mini__icon"><TrendingDown size={16} /></span>
                <div><div className="rcp-mini__label">{t('recap.lowest', 'Lowest point')}</div><div className="rcp-mini__value">{recap.lowestM.toLocaleString()} m</div></div></div>
            )}
            {recap?.ascentM > 0 && (
              <div className="rcp-mini"><span className="rcp-mini__icon"><ArrowUpRight size={16} /></span>
                <div><div className="rcp-mini__label">{t('recap.totalAscent', 'Total ascent')}</div><div className="rcp-mini__value">+{recap.ascentM.toLocaleString()} m</div></div></div>
            )}
            {recap?.descentM > 0 && (
              <div className="rcp-mini"><span className="rcp-mini__icon"><ArrowDownRight size={16} /></span>
                <div><div className="rcp-mini__label">{t('recap.totalDescent', 'Total descent')}</div><div className="rcp-mini__value">−{recap.descentM.toLocaleString()} m</div></div></div>
            )}
          </div>
        </section>
      )}

      {/* ── Highlights achieved + best moments ── */}
      <section className="rcp-cols">
        <div className="rcp-card rcp-card--soft">
          <h3 className="rcp-card__title">{t('recap.achieved', 'Highlights achieved')}</h3>
          <ul className="rcp-check">
            {achievements.map((a, i) => <li key={i}><Check size={14} strokeWidth={3} /> {a}</li>)}
          </ul>
        </div>
        {moments.length > 0 && (
          <div className="rcp-card">
            <h3 className="rcp-card__title">{t('recap.bestMoments', 'Best moments')}</h3>
            <ul className="rcp-leaf">
              {moments.map((m, i) => <li key={i}>{m.name}</li>)}
            </ul>
          </div>
        )}
      </section>

      {/* ── Reflections + photos ── */}
      {(note || photos.length > 0) && (
        <section className="rcp-cols">
          {note && (
            <div className="rcp-card rcp-reflections">
              <h3 className="rcp-card__title">{t('recap.reflections', 'Your reflections')}</h3>
              <p className="rcp-reflections__txt">“{note}”</p>
            </div>
          )}
          {photos.length > 0 && (
            <div className={`rcp-card${note ? '' : ' rcp-card--wide'}`}>
              <h3 className="rcp-card__title"><Camera size={15} /> {t('recap.photos', 'Photo memories')}</h3>
              <div className="rcp-photos">
                {photos.slice(0, 4).map((src, i) => (
                  <div className="rcp-photos__item" key={i}><img src={src} alt="" crossOrigin="anonymous" /></div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Josephine note quote (fills space, on-brand close) ── */}
      {note2 && (
        <div className="rcp-quote">
          <span className="rcp-quote__mark">“</span>
          <span>{note2}</span>
          <Flag size={12} className="rcp-gold" />
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="rcp-footer">
        <div className="rcp-footer__left">
          <Mountain size={16} />
          <div>
            <div>{t('recap.footerL1', 'Curated with love by hikers, for hikers.')}</div>
            <div className="rcp-footer__sub">{t('recap.footerL2', 'Thank you for hiking with Josephine.')}</div>
          </div>
        </div>
        <div className="rcp-footer__right">
          <span className="rcp-footer__happy">{t('recap.happy', 'Happy trails!')}</span>
        </div>
      </footer>
    </div>
  );
}

export default HikeRecapSheet;
