import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin, Mountain, Clock, BarChart3, Heart, CalendarRange, Ruler,
  TrendingUp, TrendingDown, BedDouble, Phone, Coffee, AlertTriangle,
  Backpack, Lightbulb, Siren, LifeBuoy, CloudSun, ShieldAlert, Hotel, Flag,
} from 'lucide-react';
import { chunkStages } from '../utils/itineraryPdf';
import './MultiDayExportSheet.css';

// Fixed A4 portrait canvas (96dpi). Each page is rasterised separately and added
// to the PDF as its own page.
export const MDE_WIDTH = 794;
export const MDE_HEIGHT = 1123;

const DIFFICULTY_LABEL = {
  easy: 'Easy',
  medium: 'Moderate',
  moderate: 'Moderate',
  hard: 'Challenging',
  challenging: 'Challenging',
  difficult: 'Challenging',
  expert: 'Expert',
};

function fmtSeasonMMDD(mmdd) {
  if (!mmdd) return '';
  const [m, d] = String(mmdd).split('-');
  return new Date(2000, parseInt(m, 10) - 1, parseInt(d, 10))
    .toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function Brand() {
  return (
    <div className="mde-brand">
      <img className="mde-brand__logo" src="/josephine/portrait.png" alt=""
        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      <div>
        <div className="mde-brand__name">JOSEPHINE</div>
        <div className="mde-brand__tag">YOUR ALPINE COMPANION</div>
      </div>
    </div>
  );
}

function PageFooter({ page, total }) {
  const { t } = useTranslation();
  return (
    <footer className="mde-footer">
      <div className="mde-footer__left">
        <Mountain size={15} />
        <span>{t('pdfMd.footer', 'Curated with love by hikers, for hikers — Josephine.')}</span>
      </div>
      <span className="mde-footer__page">{page} / {total}</span>
    </footer>
  );
}

function Stat({ icon, label, value, valueClass = '' }) {
  return (
    <div className="mde-stat">
      <div className="mde-stat__icon">{icon}</div>
      <div className="mde-stat__label">{label}</div>
      <div className={`mde-stat__value ${valueClass}`}>{value}</div>
    </div>
  );
}

/**
 * MultiDayExportSheet — printable multi-page "Trek Guide".
 * Presentational only; async assets (hero, map, elevation profile) are computed
 * by the caller and passed in. Renders N stacked A4 `.mde-page` elements; the
 * download component captures each one as a separate PDF page.
 */
function MultiDayExportSheet({ trail, heroImg, mapImg, elev }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.slice(0, 2) || 'en';

  const diffKey = (trail.difficulty || 'moderate').toLowerCase();
  const diffLabel = DIFFICULTY_LABEL[diffKey] || trail.difficulty || '—';
  const note =
    (trail.josephineNote && (trail.josephineNote[lng] || trail.josephineNote.en)) || null;

  const highlights = Array.isArray(trail.highlights) ? trail.highlights.slice(0, 6) : [];
  const stages = Array.isArray(trail.stages) ? trail.stages : [];
  const stagePages = chunkStages(stages, 3);
  const equipment = trail.equipment_checklist || trail.gear_checklist || [];
  const bookingTips = trail.booking_tips || [];
  const emergency = trail.emergency_contacts || null;

  const season =
    trail.best_season_start
      ? `${fmtSeasonMMDD(trail.best_season_start)} – ${fmtSeasonMMDD(trail.best_season_end)}`
      : null;

  // Total pages: cover + stage pages + planning page.
  const totalPages = 1 + stagePages.length + 1;
  let pageNo = 0;
  const next = () => (pageNo += 1);

  return (
    <div className="mde-doc">
      {/* ───────────────────────── Page 1 — Cover / Overview ───────────────────────── */}
      <div className="mde-page">
        <header className="mde-header">
          <Brand />
          <div className="mde-mark">
            <Mountain size={16} className="mde-gold" strokeWidth={2} />
            <span className="mde-mark__txt">{t('pdfMd.trekGuide', 'MULTI-DAY TREK')}</span>
          </div>
        </header>

        <section className="mde-title-row">
          <div className="mde-title-col">
            <h1 className="mde-h1">{t('pdfMd.title', 'Trek Guide')}</h1>
            <p className="mde-subtitle">
              {t('pdfMd.curatedBy', 'Hut-to-hut, curated by your alpine companion')}
              <Heart size={13} className="mde-gold" />
            </p>
            <div className="mde-rule" />
            <div className="mde-trailname">
              <MapPin size={20} className="mde-green" strokeWidth={2.4} />
              <span>{trail.name}</span>
            </div>
            <div className="mde-region">{trail.region}</div>
          </div>
          {heroImg && (
            <div className="mde-hero"><img src={heroImg} alt="" crossOrigin="anonymous" /></div>
          )}
        </section>

        <section className="mde-stats">
          <Stat icon={<CalendarRange size={20} />} label={t('pdfMd.duration', 'Duration')}
            value={`${trail.duration_days} ${t('pdfMd.days', 'days')} · ${trail.duration_nights} ${t('pdfMd.nights', 'nights')}`} />
          <Stat icon={<Ruler size={20} />} label={t('pdfMd.distance', 'Distance')}
            value={`${trail.total_distance_km} km`} />
          <Stat icon={<TrendingUp size={20} />} label={t('pdfMd.ascent', 'Total ascent')}
            value={`+${(trail.total_elevation_gain_m || 0).toLocaleString()} m`} />
          <Stat icon={<TrendingDown size={20} />} label={t('pdfMd.descent', 'Total descent')}
            value={`−${(trail.total_elevation_loss_m || 0).toLocaleString()} m`} />
          <Stat icon={<BarChart3 size={20} />} label={t('pdfMd.difficulty', 'Difficulty')} value={diffLabel} />
        </section>

        <section className="mde-mid">
          <div className="mde-card mde-route">
            <h3 className="mde-card__title"><Mountain size={15} /> {t('pdfMd.routeOverview', 'Route Overview')}</h3>
            {mapImg
              ? <img className="mde-route__map" src={mapImg} alt="" crossOrigin="anonymous" />
              : <div className="mde-route__map mde-route__map--empty">{t('pdfMd.mapUnavailable', 'Map preview unavailable')}</div>}
            {elev && (
              <div className="mde-elev">
                <div className="mde-elev__label">{t('pdfMd.elevProfile', 'Whole-trek elevation profile')}</div>
                <img className="mde-elev__svg" src={elev.dataUrl} alt="" />
              </div>
            )}
          </div>

          <div className="mde-side">
            <div className="mde-card">
              <h3 className="mde-card__title"><Mountain size={15} /> {t('pdfMd.highlights', 'Trek Highlights')}</h3>
              <ul className="mde-leaf">
                {highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
            {season && (
              <div className="mde-card mde-card--soft">
                <h3 className="mde-card__title"><CalendarRange size={15} /> {t('pdfMd.bestSeason', 'Best season')}</h3>
                <div className="mde-season">{season}</div>
              </div>
            )}
          </div>
        </section>

        {note && (
          <div className="mde-quote">
            <span className="mde-quote__mark">“</span>
            <span className="mde-quote__txt">{note}</span>
            <Flag size={12} className="mde-gold" />
          </div>
        )}

        <PageFooter page={next()} total={totalPages} />
      </div>

      {/* ───────────────────────── Stage pages ───────────────────────── */}
      {stagePages.map((group, gi) => (
        <div className="mde-page" key={`sp-${gi}`}>
          <header className="mde-header mde-header--slim">
            <Brand />
            <div className="mde-mark">
              <Mountain size={16} className="mde-gold" strokeWidth={2} />
              <span className="mde-mark__txt">{t('pdfMd.stages', 'STAGES')}</span>
            </div>
          </header>

          {gi === 0 && <h2 className="mde-section-h">{t('pdfMd.dayByDay', 'Your trek, day by day')}</h2>}

          <div className="mde-stage-list">
            {group.map((s) => {
              const sDiff = DIFFICULTY_LABEL[(s.difficulty || '').toLowerCase()] || s.difficulty || '';
              return (
                <div className="mde-stage" key={s.stage_number}>
                  <div className="mde-stage__head">
                    <div className="mde-stage__day">{t('pdfMd.day', 'Day')} {s.stage_number}</div>
                    <div className="mde-stage__name">{s.name}</div>
                    {sDiff && <span className="mde-chip">{sDiff}</span>}
                  </div>

                  <div className="mde-stage__stats">
                    <span><Ruler size={13} /> {s.distance_km} km</span>
                    <span><TrendingUp size={13} /> +{s.elevation_gain_m} m</span>
                    <span><TrendingDown size={13} /> −{s.elevation_loss_m} m</span>
                    <span><Clock size={13} /> {s.estimated_duration_hours} h</span>
                  </div>

                  {s.start_point?.name && (
                    <div className="mde-stage__route">
                      <span className="mde-rp">
                        <b>{s.start_point.name}</b>
                        <i>{s.start_point.elevation_m} m</i>
                      </span>
                      <span className="mde-rp__arrow">→</span>
                      <span className="mde-rp">
                        <b>{s.end_point?.name}</b>
                        <i>{s.end_point?.elevation_m} m</i>
                      </span>
                    </div>
                  )}

                  <div className="mde-stage__cols">
                    {s.overnight_rifugio_name && (
                      <div className="mde-stage__sleep">
                        <div className="mde-stage__sub"><Hotel size={13} /> {t('pdfMd.overnight', 'Overnight')}</div>
                        <div className="mde-sleep__name">{s.overnight_rifugio_name}</div>
                        <div className="mde-sleep__meta">
                          {s.overnight_rifugio_details?.altitude && (
                            <span><Mountain size={12} /> {s.overnight_rifugio_details.altitude} m</span>
                          )}
                          {s.overnight_rifugio_details?.beds > 0 && (
                            <span><BedDouble size={12} /> {s.overnight_rifugio_details.beds}</span>
                          )}
                          {s.overnight_rifugio_details?.contact && (
                            <span><Phone size={12} /> {s.overnight_rifugio_details.contact}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {Array.isArray(s.stops) && s.stops.length > 0 && (
                      <div className="mde-stage__stops">
                        <div className="mde-stage__sub"><Coffee size={13} /> {t('pdfMd.food', 'Food & drink')}</div>
                        <ul className="mde-stops">
                          {s.stops.slice(0, 2).map((st, i) => (
                            <li key={i}><b>km {st.km_from_start}</b> {st.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {s.weather_risk && (
                    <div className="mde-warn">
                      <AlertTriangle size={13} />
                      <span>{s.weather_risk}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <PageFooter page={next()} total={totalPages} />
        </div>
      ))}

      {/* ───────────────────────── Planning / Equipment / Emergency ───────────────────────── */}
      <div className="mde-page">
        <header className="mde-header mde-header--slim">
          <Brand />
          <div className="mde-mark">
            <Mountain size={16} className="mde-gold" strokeWidth={2} />
            <span className="mde-mark__txt">{t('pdfMd.planning', 'TRIP PLANNING')}</span>
          </div>
        </header>

        <h2 className="mde-section-h">{t('pdfMd.beforeYouGo', 'Before you go')}</h2>

        <section className="mde-plan-grid">
          {equipment.length > 0 && (
            <div className="mde-card mde-plan-equip">
              <h3 className="mde-card__title"><Backpack size={15} /> {t('pdfMd.equipment', 'Equipment checklist')}</h3>
              <ul className="mde-check mde-check--2col">
                {equipment.map((it, i) => <li key={i}>{it}</li>)}
              </ul>
            </div>
          )}

          <div className="mde-plan-side">
            {season && (
              <div className="mde-card mde-card--soft">
                <h3 className="mde-card__title"><CalendarRange size={15} /> {t('pdfMd.bestSeason', 'Best season')}</h3>
                <div className="mde-season">{season}</div>
              </div>
            )}
            {bookingTips.length > 0 && (
              <div className="mde-card">
                <h3 className="mde-card__title"><Lightbulb size={15} /> {t('pdfMd.bookingTips', 'Booking tips')}</h3>
                <ul className="mde-leaf mde-leaf--sm">
                  {bookingTips.slice(0, 6).map((tp, i) => <li key={i}>{tp}</li>)}
                </ul>
              </div>
            )}
          </div>
        </section>

        {emergency && (
          <section className="mde-card mde-emergency-card">
            <h3 className="mde-card__title"><Siren size={15} /> {t('pdfMd.emergency', 'Emergency contacts')}</h3>
            <div className="mde-emergency">
              {emergency.mountain_rescue && (
                <div className="mde-emergency__row">
                  <span className="mde-emergency__k"><LifeBuoy size={14} /> {t('pdfMd.rescue', 'Mountain rescue')}</span>
                  <span className="mde-emergency__v">{emergency.mountain_rescue}</span>
                </div>
              )}
              {emergency.weather && (
                <div className="mde-emergency__row">
                  <span className="mde-emergency__k"><CloudSun size={14} /> {t('pdfMd.weather', 'Weather forecast')}</span>
                  <span className="mde-emergency__v">{emergency.weather}</span>
                </div>
              )}
              {emergency.local_police && (
                <div className="mde-emergency__row">
                  <span className="mde-emergency__k"><ShieldAlert size={14} /> {t('pdfMd.police', 'Local police')}</span>
                  <span className="mde-emergency__v">{emergency.local_police}</span>
                </div>
              )}
            </div>
            <div className="mde-emergency__eu">
              <span className="mde-emergency__num">112</span>
              <span>{t('pdfMd.euEmergency', 'EU Alpine Emergency Number')}</span>
            </div>
          </section>
        )}

        {note && (
          <div className="mde-quote">
            <span className="mde-quote__mark">“</span>
            <span className="mde-quote__txt">{note}</span>
            <Flag size={12} className="mde-gold" />
          </div>
        )}

        <PageFooter page={next()} total={totalPages} />
      </div>
    </div>
  );
}

export default MultiDayExportSheet;
