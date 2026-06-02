import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  ArrowLeft, ArrowRight, Mountain, Footprints, BedDouble,
  CalendarRange, Ruler, TrendingUp, TrendingDown, Clock,
} from 'lucide-react';
import './MultiDayTrailDetail.css';

const API_URL = '/api';

const DIFFICULTY_COLORS = {
  easy:        { bg: 'rgba(74,222,128,0.15)',  text: '#4ade80' },
  moderate:    { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24' },
  challenging: { bg: 'rgba(249,115,22,0.15)',  text: '#f97316' },
  expert:      { bg: 'rgba(248,113,113,0.15)', text: '#f87171' },
};

function formatSeason(mmdd) {
  if (!mmdd) return '';
  const [m, d] = mmdd.split('-');
  return new Date(2000, parseInt(m) - 1, parseInt(d))
    .toLocaleDateString('en', { month: 'long', day: 'numeric' });
}

function MultiDayTrailDetail({ trailId, onNavigate }) {
  const { t, i18n } = useTranslation();
  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(1);
  const [checkedItems, setCheckedItems] = useState({});

  useEffect(() => { fetchTrail(); }, [trailId]);

  const fetchTrail = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/multi-day-trails/${trailId}`);
      setTrail(res.data);
    } catch (e) {
      console.error('Error fetching trail detail:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mdtd-loading">
        <div className="mdtd-spinner" />
        <span>Loading trek…</span>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="mdtd-error">
        <h2 style={{ color: '#f0ece6' }}>Trek not found</h2>
        <button onClick={() => onNavigate('multiday-trails')}><ArrowLeft size={16} strokeWidth={2} /> Back to treks</button>
      </div>
    );
  }

  const dc = DIFFICULTY_COLORS[trail.difficulty] || { bg: 'rgba(255,255,255,0.08)', text: '#f0ece6' };
  const currentStage = trail.stages?.[activeStage - 1];

  const lang = i18n.language?.split('-')[0] || 'en';
  const josephineNote = (() => {
    const n = trail.josephineNote;
    if (!n) return '';
    if (typeof n === 'string') return n;
    return (n[lang] || n.en || '').trim();
  })();

  const toggleCheck = (key) => setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="mdtd-page">
      {/* Hero */}
      <div
        className="mdtd-hero"
        style={{ backgroundImage: `url(${trail.hero_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600'})` }}
      >
        <div className="mdtd-hero__overlay" />
        <div className="mdtd-hero__controls">
          <button className="mdtd-back-btn" onClick={() => onNavigate('multiday-trails')} aria-label="Back"><ArrowLeft size={20} strokeWidth={2} /></button>
        </div>
        <div className="mdtd-hero__content">
          <p className="mdtd-hero__eyebrow">Multi-Day Trek · {trail.region}</p>
          <h1 className="mdtd-hero__title">{trail.name}</h1>
        </div>
      </div>

      {/* Stat strip */}
      <div className="mdtd-stats">
        <div className="mdtd-stat">
          <span className="mdtd-stat__icon"><CalendarRange size={20} strokeWidth={2} /></span>
          <span className="mdtd-stat__value">{trail.duration_days} days · {trail.duration_nights} nights</span>
          <span className="mdtd-stat__label">Duration</span>
        </div>
        <div className="mdtd-stat">
          <span className="mdtd-stat__icon"><Ruler size={20} strokeWidth={2} /></span>
          <span className="mdtd-stat__value">{trail.total_distance_km} km</span>
          <span className="mdtd-stat__label">Total distance</span>
        </div>
        <div className="mdtd-stat">
          <span className="mdtd-stat__icon"><Mountain size={20} strokeWidth={2} /></span>
          <span className="mdtd-stat__value">{trail.total_elevation_gain_m?.toLocaleString()} m</span>
          <span className="mdtd-stat__label">Elevation gain</span>
        </div>
        <div className="mdtd-stat">
          <span className="mdtd-stat__icon"><Footprints size={20} strokeWidth={2} /></span>
          <span className="mdtd-stat__value">{trail.stages?.length || 0} stages</span>
          <span className="mdtd-stat__label">Stages</span>
        </div>
        <div className="mdtd-stat">
          <span
            className="mdtd-difficulty-badge"
            style={{ background: dc.bg, color: dc.text }}
          >
            {trail.difficulty}
          </span>
          <span className="mdtd-stat__label">Difficulty</span>
        </div>
      </div>

      <div className="mdtd-container">

        {/* Overview */}
        <div className="mdtd-section">
          <h2 className="mdtd-section__title">Trek Overview</h2>
          <p className="mdtd-description">{trail.description}</p>

          {josephineNote && (
            <div className="mdtd-josephine-note">
              <img src="/josephine-portrait.webp" alt="Josephine" className="mdtd-josephine-note__portrait" />
              <div className="mdtd-josephine-note__body">
                <p className="mdtd-josephine-note__label">Josephine's tip</p>
                <p className="mdtd-josephine-note__text">{josephineNote}</p>
              </div>
            </div>
          )}

          {trail.highlights?.length > 0 && (
            <>
              <p className="mdtd-section__subtitle">Trek highlights</p>
              <div className="mdtd-highlights">
                {trail.highlights.map((h, i) => (
                  <div key={i} className="mdtd-highlight">
                    <span className="mdtd-highlight__dot" />
                    {h}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Stages */}
        {trail.stages?.length > 0 && (
          <div className="mdtd-section">
            <h2 className="mdtd-section__title">Trek Stages</h2>

            <div className="mdtd-stages-nav">
              {trail.stages.map((stage) => (
                <button
                  key={stage.stage_number}
                  className={`mdtd-stage-btn ${activeStage === stage.stage_number ? 'active' : ''}`}
                  onClick={() => setActiveStage(stage.stage_number)}
                >
                  <div className="mdtd-stage-btn__day">Day {stage.stage_number}</div>
                  <div className="mdtd-stage-btn__name">{stage.name}</div>
                  <div className="mdtd-stage-btn__stats">{stage.distance_km} km · {stage.estimated_duration_hours}h</div>
                </button>
              ))}
            </div>

            {currentStage && (
              <div className="mdtd-stage-card">
                {/* Header */}
                <div className="mdtd-stage-header">
                  <div>
                    <h3>Day {currentStage.stage_number}: {currentStage.name}</h3>
                    <p className="mdtd-stage-description">{currentStage.description}</p>
                  </div>
                  {currentStage.difficulty && (
                    <span
                      style={{
                        background: DIFFICULTY_COLORS[currentStage.difficulty]?.bg || 'rgba(255,255,255,0.08)',
                        color: DIFFICULTY_COLORS[currentStage.difficulty]?.text || '#f0ece6',
                        fontSize: '11px', fontWeight: 600, padding: '5px 14px', borderRadius: '100px',
                        textTransform: 'capitalize', flexShrink: 0,
                      }}
                    >
                      {currentStage.difficulty}
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="mdtd-stage-stats">
                  <div className="mdtd-stage-stat">
                    <span className="mdtd-stage-stat__icon"><Ruler size={18} strokeWidth={2} /></span>
                    <div>
                      <div className="mdtd-stage-stat__label">Distance</div>
                      <div className="mdtd-stage-stat__value">{currentStage.distance_km} km</div>
                    </div>
                  </div>
                  <div className="mdtd-stage-stat">
                    <span className="mdtd-stage-stat__icon"><TrendingUp size={18} strokeWidth={2} /></span>
                    <div>
                      <div className="mdtd-stage-stat__label">Elevation gain</div>
                      <div className="mdtd-stage-stat__value">{currentStage.elevation_gain_m} m</div>
                    </div>
                  </div>
                  <div className="mdtd-stage-stat">
                    <span className="mdtd-stage-stat__icon"><TrendingDown size={18} strokeWidth={2} /></span>
                    <div>
                      <div className="mdtd-stage-stat__label">Elevation loss</div>
                      <div className="mdtd-stage-stat__value">{currentStage.elevation_loss_m} m</div>
                    </div>
                  </div>
                  <div className="mdtd-stage-stat">
                    <span className="mdtd-stage-stat__icon"><Clock size={18} strokeWidth={2} /></span>
                    <div>
                      <div className="mdtd-stage-stat__label">Duration</div>
                      <div className="mdtd-stage-stat__value">{currentStage.estimated_duration_hours}h</div>
                    </div>
                  </div>
                </div>

                {/* Route */}
                {currentStage.start_point?.name && (
                  <div className="mdtd-route">
                    <div className="mdtd-route-point">
                      <div className="mdtd-route-point__label">Start</div>
                      <div className="mdtd-route-point__name">{currentStage.start_point.name}</div>
                      <div className="mdtd-route-point__elev">{currentStage.start_point.elevation_m} m</div>
                    </div>
                    <span className="mdtd-route-arrow"><ArrowRight size={18} strokeWidth={2} /></span>
                    <div className="mdtd-route-point">
                      <div className="mdtd-route-point__label">End</div>
                      <div className="mdtd-route-point__name">{currentStage.end_point?.name}</div>
                      <div className="mdtd-route-point__elev">{currentStage.end_point?.elevation_m} m</div>
                    </div>
                  </div>
                )}

                {/* Overnight rifugio */}
                {currentStage.overnight_rifugio_name && (
                  <div className="mdtd-overnight">
                    <div className="mdtd-overnight__label">🏠 Overnight stay</div>
                    <div className="mdtd-overnight__name">{currentStage.overnight_rifugio_name}</div>
                    {currentStage.overnight_rifugio_details && (
                      <div className="mdtd-overnight__details">
                        {currentStage.overnight_rifugio_details.altitude && (
                          <span><Mountain size={14} strokeWidth={2} /> {currentStage.overnight_rifugio_details.altitude} m</span>
                        )}
                        {currentStage.overnight_rifugio_details.beds > 0 && (
                          <span><BedDouble size={14} strokeWidth={2} /> {currentStage.overnight_rifugio_details.beds} beds</span>
                        )}
                        {currentStage.overnight_rifugio_details.contact && (
                          <span>📞 {currentStage.overnight_rifugio_details.contact}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Sleep/booking */}
                {currentStage.sleep?.booking_note && (
                  <div className="mdtd-sleep">
                    <div className="mdtd-sleep__title">Booking</div>
                    <span>{currentStage.sleep.booking_note}</span>
                    <div className="mdtd-sleep__flags">
                      {currentStage.sleep.must_book && <span className="mdtd-sleep__flag">Must book in advance</span>}
                      {currentStage.sleep.half_board_recommended && <span className="mdtd-sleep__flag">Half-board recommended</span>}
                    </div>
                  </div>
                )}

                {/* Food stops */}
                {currentStage.stops?.length > 0 && (
                  <div>
                    <p className="mdtd-section__subtitle" style={{ marginBottom: 8 }}>☕ Food & drink on route</p>
                    <div className="mdtd-stops">
                      {currentStage.stops.map((stop, i) => (
                        <div key={i} className="mdtd-stop">
                          <span className="mdtd-stop__km">km {stop.km_from_start}</span>
                          <span className="mdtd-stop__name">{stop.name}</span>
                          {stop.what && <span className="mdtd-stop__what">— {stop.what}</span>}
                          {stop.open_months && (
                            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(240,236,230,0.35)', whiteSpace: 'nowrap' }}>
                              {stop.open_months}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stage highlights */}
                {currentStage.highlights?.length > 0 && (
                  <div>
                    <p className="mdtd-section__subtitle" style={{ marginBottom: 8 }}>Stage highlights</p>
                    <div className="mdtd-stage-highlights">
                      {currentStage.highlights.map((h, i) => (
                        <div key={i} className="mdtd-stage-highlight">{h}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weather risk */}
                {currentStage.weather_risk && (
                  <div className="mdtd-weather-risk">
                    <span className="mdtd-weather-risk__icon">⚠️</span>
                    <span>{currentStage.weather_risk}</span>
                  </div>
                )}

                {/* Exit routes */}
                {currentStage.exit_routes?.length > 0 && (
                  <div>
                    <p className="mdtd-section__subtitle" style={{ marginBottom: 8 }}>🚨 Emergency exits</p>
                    {currentStage.exit_routes.map((exit, i) => (
                      <div key={i} style={{
                        padding: '14px 18px', background: 'rgba(248,113,113,0.04)',
                        border: '1px solid rgba(248,113,113,0.12)', borderRadius: 10,
                        marginBottom: 8, fontSize: 13, color: 'rgba(240,236,230,0.65)', lineHeight: 1.6,
                      }}>
                        <div style={{ fontWeight: 700, color: 'rgba(240,236,230,0.85)', marginBottom: 6 }}>
                          {exit.name}
                        </div>
                        <div>{exit.description}</div>
                        {exit.transport && (
                          <div style={{ marginTop: 6, color: 'rgba(240,236,230,0.45)' }}>
                            🚌 {exit.transport}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Trip Planning */}
        <div className="mdtd-section">
          <h2 className="mdtd-section__title">Trip Planning</h2>

          {/* Season */}
          {trail.best_season_start && (
            <div className="mdtd-season" style={{ marginBottom: 24 }}>
              <span className="mdtd-season__icon">📅</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,230,0.4)', marginBottom: 4 }}>Best season</div>
                <div>{formatSeason(trail.best_season_start)} – {formatSeason(trail.best_season_end)}</div>
              </div>
            </div>
          )}

          {/* Booking strategy */}
          {trail.booking_strategy && (
            <>
              <p className="mdtd-section__subtitle">Booking strategy</p>
              <div className="mdtd-booking-strategy" style={{ marginBottom: 24 }}>
                {trail.booking_strategy}
              </div>
            </>
          )}

          {/* Booking tips */}
          {trail.booking_tips?.length > 0 && (
            <>
              <p className="mdtd-section__subtitle">Booking tips</p>
              <div className="mdtd-tips" style={{ marginBottom: 24 }}>
                {trail.booking_tips.map((tip, i) => (
                  <div key={i} className="mdtd-tip">💡 {tip}</div>
                ))}
              </div>
            </>
          )}

          {/* Equipment checklist */}
          {(trail.equipment_checklist?.length > 0 || trail.gear_checklist?.length > 0) && (
            <>
              <p className="mdtd-section__subtitle">Equipment checklist</p>
              <div className="mdtd-checklist">
                {(trail.equipment_checklist || trail.gear_checklist || []).map((item, i) => (
                  <button
                    key={i}
                    className={`mdtd-checklist-item ${checkedItems[i] ? 'checked' : ''}`}
                    onClick={() => toggleCheck(i)}
                  >
                    <span className="mdtd-checklist-box">{checkedItems[i] ? '✓' : ''}</span>
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Emergency contacts */}
        {trail.emergency_contacts && (
          <div className="mdtd-section">
            <h2 className="mdtd-section__title">Emergency Contacts</h2>
            <div className="mdtd-emergency">
              {trail.emergency_contacts.mountain_rescue && (
                <div className="mdtd-emergency-item">
                  <span className="mdtd-emergency-item__label">🆘 Mountain rescue</span>
                  <span className="mdtd-emergency-item__value">{trail.emergency_contacts.mountain_rescue}</span>
                </div>
              )}
              {trail.emergency_contacts.weather && (
                <div className="mdtd-emergency-item">
                  <span className="mdtd-emergency-item__label">🌤 Weather forecast</span>
                  <span className="mdtd-emergency-item__value">{trail.emergency_contacts.weather}</span>
                </div>
              )}
              {trail.emergency_contacts.local_police && (
                <div className="mdtd-emergency-item">
                  <span className="mdtd-emergency-item__label">🚔 Local police</span>
                  <span className="mdtd-emergency-item__value">{trail.emergency_contacts.local_police}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gallery */}
        {trail.photos?.length > 0 && (
          <div className="mdtd-section">
            <h2 className="mdtd-section__title">Gallery</h2>
            <div className="mdtd-gallery">
              {trail.photos.map((photo, i) => (
                <div key={i} className="mdtd-gallery__item">
                  <img src={photo} alt={`${trail.name} ${i + 1}`} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mdtd-cta">
          <h3>Ready to plan this trek?</h3>
          <p>Josephine will help you prepare, book and make the most of every stage.</p>
          <button className="mdtd-cta__btn" onClick={() => onNavigate('josephine')}>
            Plan this trek with Josephine <ArrowRight size={16} strokeWidth={2} />
          </button>
        </div>

      </div>
    </div>
  );
}

export default MultiDayTrailDetail;
