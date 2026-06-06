import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin, Mountain, Clock, BarChart3, Dog, Heart, Sun, Camera,
  ShieldCheck, Backpack, Flag,
} from 'lucide-react';
import './ItineraryExportSheet.css';

// Fixed A4 portrait canvas (96dpi). The sheet is rendered off-screen and
// rasterised by html2canvas, so everything here is sized to fit one A4 page.
export const SHEET_WIDTH = 794;
export const SHEET_HEIGHT = 1123;

const DIFFICULTY_LABEL = {
  easy: 'Easy',
  medium: 'Moderate',
  moderate: 'Moderate',
  hard: 'Challenging',
  difficult: 'Challenging',
  expert: 'Expert',
};

function fmtSeason(best) {
  if (!Array.isArray(best) || best.length === 0) return null;
  const short = (m) => (m || '').slice(0, 3);
  return `${short(best[0])} – ${short(best[best.length - 1])}`;
}

/**
 * ItineraryExportSheet — the printable "Day Hike Guide" page.
 * Purely presentational; all async data (map image, elevation SVG model,
 * schedule) is computed by the caller and passed in as props.
 */
function ItineraryExportSheet({ trail, heroImg, mapImg, elev, schedule = [] }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.slice(0, 2) || 'en';

  const diffKey = (trail.difficulty || 'moderate').toLowerCase();
  const diffLabel = DIFFICULTY_LABEL[diffKey] || trail.difficulty || '—';
  const season = fmtSeason(trail.best_season);
  const note =
    (trail.josephineNote && (trail.josephineNote[lng] || trail.josephineNote.en)) ||
    trail.tagline ||
    null;

  const highlights = Array.isArray(trail.highlights) ? trail.highlights.slice(0, 5) : [];
  const photoSpots = (trail.pois || trail.points_of_interest || [])
    .filter((p) => /viewpoint|summit|peak|lake|cultural/i.test(p?.type || ''))
    .slice(0, 3);

  // generic packing checklist (no per-trail data); dog row only when relevant
  const packing = [
    t('pdf.packBoots', 'Hiking boots & comfortable layers'),
    t('pdf.packWater', 'Water (min. 1.5 L) & snacks'),
    t('pdf.packSun', 'Sun protection (hat, sunscreen, glasses)'),
    t('pdf.packRain', 'Rain jacket or windbreaker'),
    ...(trail.dog_friendly ? [t('pdf.packDog', 'Dog essentials: leash, water, treats, waste bags')] : []),
    t('pdf.packCamera', 'Camera — you’ll want it!'),
  ];

  const safety = [
    t('pdf.safetyWeather', 'Check the weather before you go'),
    t('pdf.safetyRocky', 'Some sections are rocky — watch your step'),
    t('pdf.safetyMarked', 'Stay on marked trails'),
    t('pdf.safetyShade', 'Little shade on exposed sections'),
    t('pdf.safetyPlans', 'Let someone know your plans'),
  ];

  return (
    <div className="ies" style={{ width: SHEET_WIDTH, height: SHEET_HEIGHT }}>
      {/* ── Header ── */}
      <header className="ies-header">
        <div className="ies-brand">
          <img className="ies-brand__logo" src="/josephine/portrait.png" alt=""
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="ies-brand__txt">
            <div className="ies-brand__name">JOSEPHINE</div>
            <div className="ies-brand__tag">YOUR ALPINE COMPANION</div>
          </div>
        </div>
        <div className="ies-mark">
          <Mountain size={16} className="ies-gold" strokeWidth={2} />
          <span className="ies-mark__txt">{t('pdf.trailGuide', 'TRAIL GUIDE')}</span>
        </div>
      </header>

      {/* ── Title + hero ── */}
      <section className="ies-title-row">
        <div className="ies-title-col">
          <h1 className="ies-h1">{t('pdf.dayHikeGuide', 'Day Hike Guide')}</h1>
          <p className="ies-subtitle">{t('pdf.curatedBy', 'Curated by your alpine companion')} <Heart size={13} className="ies-gold" /></p>
          <div className="ies-rule" />
          <div className="ies-trailname">
            <MapPin size={20} className="ies-green" strokeWidth={2.4} />
            <span>{trail.name}</span>
          </div>
          <div className="ies-region">{trail.region}</div>
        </div>
        {heroImg && (
          <div className="ies-hero">
            <img src={heroImg} alt="" crossOrigin="anonymous" />
          </div>
        )}
      </section>

      {/* ── Stat strip ── */}
      <section className="ies-stats">
        <Stat icon={<MapPin size={22} />} label={t('pdf.distance', 'Distance')} value={`${trail.distance_km} km`} />
        <Stat icon={<Mountain size={22} />} label={t('pdf.elevGain', 'Elevation gain')} value={`+${trail.elevation_gain_m} m`} />
        <Stat icon={<Clock size={22} />} label={t('pdf.duration', 'Duration')} value={`${trail.duration_hours} h`} />
        <Stat icon={<BarChart3 size={22} />} label={t('pdf.difficulty', 'Difficulty')} value={diffLabel} />
        {trail.dog_friendly && (
          <Stat icon={<Dog size={22} />} label={t('pdf.dogFriendly', 'Dog friendly')} value={t('pdf.yes', 'Yes')} valueClass="ies-gold" />
        )}
      </section>

      {/* ── Route + highlights ── */}
      <section className="ies-mid">
        <div className="ies-card ies-route">
          <h3 className="ies-card__title"><Mountain size={15} /> {t('pdf.routeOverview', 'Route Overview')}</h3>
          {mapImg
            ? <img className="ies-route__map" src={mapImg} alt="" crossOrigin="anonymous" />
            : <div className="ies-route__map ies-route__map--empty">{t('pdf.mapUnavailable', 'Map preview unavailable')}</div>}
          {elev && (
            <div className="ies-elev">
              <div className="ies-elev__label">{t('pdf.elevProfile', 'Elevation profile')}</div>
              <img className="ies-elev__svg" src={elev.dataUrl} alt="" />
            </div>
          )}
        </div>

        <div className="ies-side">
          <div className="ies-card">
            <h3 className="ies-card__title"><Mountain size={15} /> {t('pdf.highlights', 'Highlights')}</h3>
            <ul className="ies-leaf">
              {highlights.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
          {season && (
            <div className="ies-card ies-card--soft">
              <h3 className="ies-card__title"><Sun size={15} /> {t('pdf.bestTime', 'Best time to hike')}</h3>
              <div className="ies-season">{season}</div>
            </div>
          )}
        </div>
      </section>

      {/* ── Day at a glance ── */}
      {schedule.length > 1 && (
        <section className="ies-glance">
          <h3 className="ies-glance__title">{t('pdf.atAGlance', 'Your day at a glance')}</h3>
          <div className="ies-timeline">
            {schedule.map((s, i) => (
              <React.Fragment key={i}>
                <div className="ies-step">
                  <div className="ies-step__icon">{s.icon}</div>
                  <div className="ies-step__time">{s.time}</div>
                  <div className="ies-step__label">{s.label}</div>
                  {s.sub && <div className="ies-step__sub">{s.sub}</div>}
                </div>
                {i < schedule.length - 1 && <div className="ies-step__arrow">›</div>}
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {/* ── Three columns ── */}
      <section className="ies-cols">
        <div className="ies-card">
          <h3 className="ies-card__title"><Backpack size={15} /> {t('pdf.whatToPack', 'What to pack')}</h3>
          <ul className="ies-leaf ies-leaf--sm">
            {packing.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
        <div className="ies-card">
          <h3 className="ies-card__title"><ShieldCheck size={15} /> {t('pdf.safetyNotes', 'Safety notes')}</h3>
          <ul className="ies-check ies-leaf--sm">
            {safety.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
          <div className="ies-emergency">
            <span className="ies-emergency__num">112</span>
            <span>{t('pdf.emergency', 'EU Alpine Emergency Number')}</span>
          </div>
        </div>
        <div className="ies-card">
          <h3 className="ies-card__title"><Camera size={15} /> {t('pdf.photoSpots', 'Best photo spots')}</h3>
          {photoSpots.length > 0 ? (
            <ol className="ies-photos">
              {photoSpots.map((p, i) => (
                <li key={i}><span className="ies-photos__n">{i + 1}</span>
                  <span><strong>{p.name}</strong>{p.description ? <em>{p.description}</em> : null}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ies-muted">{t('pdf.photoAnywhere', 'Every ridge and meadow is a postcard — keep your camera ready.')}</p>
          )}
        </div>
      </section>

      {/* ── Quote ── */}
      {note && (
        <div className="ies-quote">
          <span className="ies-quote__mark">“</span>
          <span className="ies-quote__txt">{note}</span>
          <Flag size={12} className="ies-gold" />
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="ies-footer">
        <div className="ies-footer__left">
          <Mountain size={16} />
          <div>
            <div>{t('pdf.footerL1', 'Curated with love by hikers, for hikers.')}</div>
            <div className="ies-footer__sub">{t('pdf.footerL2', 'More trails, tips & inspiration in the Josephine app.')}</div>
          </div>
        </div>
        <div className="ies-footer__right">
          <span>{t('pdf.footerThanks', 'Thank you for hiking with us.')}</span>
          <span className="ies-footer__happy">{t('pdf.happyTrails', 'Happy trails!')}</span>
          <span className="ies-footer__page">1 / 1</span>
        </div>
      </footer>
    </div>
  );
}

function Stat({ icon, label, value, valueClass = '' }) {
  return (
    <div className="ies-stat">
      <div className="ies-stat__icon">{icon}</div>
      <div className="ies-stat__label">{label}</div>
      <div className={`ies-stat__value ${valueClass}`}>{value}</div>
    </div>
  );
}

export default ItineraryExportSheet;
