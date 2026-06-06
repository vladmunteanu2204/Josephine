import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { trailImg, trailImgAlt, trailGallery, onImgError } from '../utils/trailImage';
import ReviewsSection from './ReviewsSection';
import TrailMap from './TrailMap';
import MediaGallery from './MediaGallery';
import WeatherWidget from './WeatherWidget';
import TrailheadDirections from './TrailheadDirections';
import { ENABLE_HIKE_TRACKING } from '../featureFlags';
import AuthPromptModal from './AuthPromptModal';
import { ArrowLeft, Heart, TrendingUp, TrendingDown } from 'lucide-react';
import './TrailDetail.css';

const DIFFICULTY_CONFIG = {
  easy:   { color: '#4ade80', label: 'Easy'     },
  medium: { color: '#c9a84c', label: 'Moderate' },
  hard:   { color: '#ef4444', label: 'Hard'     },
};

// Icon per insider-insight kind (kept in sync with backend insights.INSIGHT_KINDS)
const INSIGHT_ICON = {
  photo_spot: '📷', viewpoint: '◉', tip: '💡', food: '🍽',
  hazard: '⚠', dog_tip: '🐾', sunrise_tip: '🌅', sunset_tip: '🌇',
};

/* ── Elevation Profile ─────────────────────────────────────── */
function ElevationProfile({ trail }) {
  const W = 500, H = 90;
  const coords = trail.coordinates || [];
  const gain   = trail.elevation_gain_m || 0;
  const loss   = trail.elevation_loss_m || 0;
  const type   = trail.trail_type || 'out_and_back';

  const [elevations, setElevations] = useState(null);
  const [elevLoading, setElevLoading] = useState(false);

  useEffect(() => {
    if (coords.length < 2) return;
    const N = Math.min(coords.length, 100);
    const step = (coords.length - 1) / (N - 1);
    const sampled = Array.from({ length: N }, (_, i) => coords[Math.round(i * step)]);
    const lats = sampled.map(c => c[1]).join(',');
    const lngs = sampled.map(c => c[0]).join(',');
    setElevLoading(true);
    fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.elevation)) setElevations(d.elevation); })
      .catch(() => {})
      .finally(() => setElevLoading(false));
  }, [trail.id]);

  let pts;
  if (elevations?.length >= 2) {
    const minE   = Math.min(...elevations);
    const maxE   = Math.max(...elevations);
    const rangeE = Math.max(maxE - minE, 1);
    pts = elevations.map((e, i) => [
      (i / (elevations.length - 1)) * W,
      H - ((e - minE) / rangeE) * H * 0.82 - H * 0.06,
    ]);
  } else if (!elevLoading) {
    // Synthetic fallback when no real data
    const peak = H * 0.84;
    if (type === 'loop') {
      pts = [[0,H],[W*0.15,H-peak*0.4],[W*0.5,H-peak],[W*0.85,H-peak*0.35],[W,H]];
    } else if (type === 'point_to_point') {
      const end = H - Math.max(0, (gain - loss) / Math.max(gain, 1)) * H * 0.6;
      pts = [[0,H],[W*0.4,H-peak],[W*0.65,H-peak*0.8],[W,end]];
    } else {
      pts = [[0,H],[W*0.45,H-peak],[W*0.55,H-peak],[W,H]];
    }
  }

  const minElev = elevations ? Math.round(Math.min(...elevations)) : null;
  const maxElev = elevations ? Math.round(Math.max(...elevations)) : null;

  const curvePath = pts?.reduce((acc, p, i) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const prev = pts[i - 1];
    const cx = (prev[0] + p[0]) / 2;
    return `${acc} C${cx},${prev[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
  }, '') ?? '';
  const fillPath = pts ? `${curvePath} L${W},${H} L0,${H} Z` : '';

  return (
    <div className="td-elev">
      <div className="td-elev__stats">
        <span className="td-elev__stat"><TrendingUp size={14} strokeWidth={2} className="td-elev__arrow" />{gain}m gain</span>
        {loss > 0 && <span className="td-elev__stat"><TrendingDown size={14} strokeWidth={2} className="td-elev__arrow td-elev__arrow--down" />{loss}m loss</span>}
        {minElev !== null && (
          <span className="td-elev__stat td-elev__stat--muted">{minElev}–{maxElev}m a.s.l.</span>
        )}
        <span className="td-elev__stat td-elev__stat--muted">{trail.distance_km} km total</span>
      </div>

      <div className="td-elev__chart">
        {maxElev !== null && (
          <div className="td-elev__yaxis">
            <span>{maxElev}m</span>
            <span>{minElev}m</span>
          </div>
        )}
        {elevLoading ? (
          <div className="td-elev__loading">Loading terrain…</div>
        ) : pts ? (
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="td-elev__svg" aria-hidden="true">
            <defs>
              <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#c9a84c" stopOpacity="0.4"/>
                <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.03"/>
              </linearGradient>
            </defs>
            <path d={fillPath}  fill="url(#elevGrad)" />
            <path d={curvePath} fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : null}
      </div>

      <div className="td-elev__xaxis">
        <span>0 km</span>
        <span>{(trail.distance_km / 2).toFixed(1)} km</span>
        <span>{trail.distance_km} km</span>
      </div>
    </div>
  );
}

/* ── Nearby Rifugios row ───────────────────────────────────── */
function NearbyRifugios({ ids, onViewRifugio }) {
  const [rifugios, setRifugios] = useState([]);

  useEffect(() => {
    if (!ids?.length) return;
    axios.get('/api/rifugios')
      .then(res => {
        const all = Array.isArray(res.data) ? res.data : (res.data.rifugios || []);
        setRifugios(all.filter(r => ids.includes(r.id)));
      })
      .catch(() => {});
  }, [ids]);

  if (!rifugios.length) return null;

  return (
    <section className="td-section">
      <h2 className="td-section__title">Nearby Rifugios</h2>
      <div className="td-rifugio-row">
        {rifugios.map(rif => (
          <div
            key={rif.id}
            className="td-rifugio-card"
            onClick={() => onViewRifugio?.(rif)}
            style={{ cursor: onViewRifugio ? 'pointer' : 'default' }}
          >
            {rif.photos?.[0] && (
              <img
                src={rif.photos[0]}
                alt={rif.name}
                className="td-rifugio-card__img"
                onError={onImgError}
              />
            )}
            <div className="td-rifugio-card__body">
              <p className="td-rifugio-card__name">{rif.name}</p>
              <p className="td-rifugio-card__meta">
                {rif.altitude ? `${rif.altitude}m` : ''}{rif.altitude && rif.type ? ' · ' : ''}{rif.type || ''}
              </p>
              {rif.opening_season?.start_date && (
                <p className="td-rifugio-card__season">
                  Open {rif.opening_season.start_date?.slice(5,10)} – {rif.opening_season.end_date?.slice(5,10)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrailDetail({ trail, onBack, setIsGPSActive, viewRifugio, onShowLogin, onPlanWithJosephine, autoStartHike, onAutoStartConsumed, onStartHike }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { currentUser } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [fullTrail, setFullTrail] = useState(trail);
  const [loading, setLoading]     = useState(false);
  const [isSaved, setIsSaved]     = useState(false);
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [publicInsights, setPublicInsights] = useState([]);
  const [secretCount, setSecretCount] = useState(0);
  const [drivingRoute, setDrivingRoute] = useState(null);
  const heroRef = useRef(null);

  // Fetch full trail if only ID passed
  useEffect(() => {
    if (trail && trail.id && !trail.name) {
      setLoading(true);
      axios.get('/api/trails')
        .then(res => {
          const found = (res.data.trails || res.data).find(tr => tr.id === trail.id);
          if (found) setFullTrail(found);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [trail]);

  // Sync saved state
  useEffect(() => {
    if (fullTrail?.id) {
      const saved = JSON.parse(localStorage.getItem('savedTrails') || '[]');
      setIsSaved(saved.includes(fullTrail.id));
    }
  }, [fullTrail]);

  // Insider insights: public list + count of chat-only secrets (the teaser)
  useEffect(() => {
    if (!fullTrail?.id) return;
    const lng = (i18n.language || 'en').split('-')[0];
    axios.get(`/api/trails/${fullTrail.id}/insights`, { params: { lang: lng } })
      .then(res => {
        setPublicInsights(res.data?.insights || []);
        setSecretCount(res.data?.secret_count || 0);
      })
      .catch(() => { setPublicInsights([]); setSecretCount(0); });
  }, [fullTrail?.id, i18n.language]);

  // Cleanup GPS on unmount
  useEffect(() => () => { if (setIsGPSActive) setIsGPSActive(false); }, [setIsGPSActive]);

  // Launched with "Start hike" from another surface → start tracking immediately.
  useEffect(() => {
    if (autoStartHike && ENABLE_HIKE_TRACKING && fullTrail?.name) {
      if (onStartHike) onStartHike(fullTrail);
      if (onAutoStartConsumed) onAutoStartConsumed();
    }
  }, [autoStartHike, fullTrail?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Parallax
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onScroll = () => setParallaxOffset(window.pageYOffset * 0.45);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSaveToggle = () => {
    if (!currentUser) { setShowAuthPrompt(true); return; }
    const saved = JSON.parse(localStorage.getItem('savedTrails') || '[]');
    let next;
    if (isSaved) {
      next = saved.filter(id => id !== fullTrail.id);
      toast.info(t('trail.trailUnsaved'));
    } else {
      next = [...saved, fullTrail.id];
      toast.success(t('trail.trailSaved'));
    }
    localStorage.setItem('savedTrails', JSON.stringify(next));
    setIsSaved(!isSaved);
  };


  const formatSeason = (s) => {
    if (!s) return 'Year-round';
    if (typeof s === 'string') return s;
    if (!s.length) return 'Year-round';
    if (s.length <= 2) return s.join(', ');
    return `${s[0]} – ${s[s.length - 1]}`;
  };

  const getPoiIcon = (type) =>
    ({ lake: '◈', viewpoint: '◉', cabin: '⌂', cultural: '◆', peak: '▲', waterfall: '≋', forest: '✦' }[type] || '◍');

  // ── Guards ──
  if (loading) return (
    <div className="td-page"><button className="td-back" onClick={onBack}><ArrowLeft size={16} strokeWidth={2} /> {t('trail.backToTrails')}</button>
      <div className="td-state">{t('common.loading')}</div></div>
  );
  if (!fullTrail?.name) return (
    <div className="td-page"><button className="td-back" onClick={onBack}><ArrowLeft size={16} strokeWidth={2} /> {t('trail.backToTrails')}</button>
      <div className="td-state td-state--error">{t('common.error')}</div></div>
  );

  const diff = DIFFICULTY_CONFIG[fullTrail.difficulty] || DIFFICULTY_CONFIG.medium;
  const heroImg = trailImg(fullTrail, 'hero');

  // Josephine note
  const lang = (i18n.language || 'en').split('-')[0];
  const note = fullTrail.josephineNote;
  const noteText = note && typeof note === 'object' ? (note[lang] || note.en || '').trim() : '';

  // "Good to know" — built defensively from whatever fields the trail carries.
  const goodToKnowRows = (() => {
    const rows = [];
    const s = fullTrail.best_season;
    if (Array.isArray(s) && s.length) {
      rows.push([t('trail.gtkBestTime', 'Best time'), s.length > 1 ? `${s[0]}–${s[s.length - 1]}` : s[0]]);
    } else if (typeof s === 'string' && s) {
      rows.push([t('trail.gtkBestTime', 'Best time'), s]);
    }
    if (fullTrail.trail_type) rows.push([t('trail.gtkTrailType', 'Trail type'), String(fullTrail.trail_type).replace(/_/g, ' ')]);
    const parking = fullTrail.trailhead_info?.parking || fullTrail.transport?.car;
    if (parking) rows.push([t('trail.gtkParking', 'Parking'), parking]);
    const fac = Array.isArray(fullTrail.facilities) ? fullTrail.facilities : [];
    if (fac.length) rows.push([t('trail.gtkFacilities', 'Facilities'), fac.slice(0, 3).join(', ')]);
    if (fullTrail.crowding?.level) {
      const tip = fullTrail.crowding.quiet_tip ? ` · ${fullTrail.crowding.quiet_tip}` : '';
      rows.push([t('trail.gtkCrowds', 'Crowds'), `${fullTrail.crowding.level}${tip}`]);
    }
    if (fullTrail.dog_friendly) rows.push([t('trail.gtkDog', 'Dogs'), '✓']);
    if (fullTrail.family_friendly) rows.push([t('trail.gtkFamily', 'Family'), '✓']);
    return rows.slice(0, 6);
  })();

  return (
    <div className="td-page">

      {/* ── Hero ── */}
      <div className="td-hero" ref={heroRef}>
        <img
          src={heroImg}
          alt={fullTrail.name}
          className="td-hero__img"
          style={{ transform: `translateY(${parallaxOffset}px)` }}
          onError={onImgError}
        />
        <div className="td-hero__overlay" />

        {/* Top controls */}
        <div className="td-hero__controls">
          <button className="td-back-btn" onClick={onBack} aria-label="Back">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <button
            className={`td-save-btn ${isSaved ? 'td-save-btn--saved' : ''}`}
            onClick={handleSaveToggle}
            aria-label={isSaved ? 'Unsave trail' : 'Save trail'}
            aria-pressed={isSaved}
          >
            <Heart size={20} strokeWidth={2} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Hero text */}
        <div className="td-hero__content">
          <div className="td-hero__meta">
            <span className="td-region">{fullTrail.region}</span>
            <span className="td-diff-badge" style={{ color: diff.color, borderColor: diff.color }}>
              {diff.label}
            </span>
          </div>
          <h1 className="td-hero__title">{fullTrail.name}</h1>
          {fullTrail.tagline && <p className="td-hero__tagline">{fullTrail.tagline}</p>}
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="td-stats">
        <div className="td-stat">
          <span className="td-stat__number">
            <span className="td-stat__value">{fullTrail.distance_km}</span>
            <span className="td-stat__unit"> km</span>
          </span>
          <span className="td-stat__label">{t('trail.distance', 'Distance')}</span>
        </div>
        <div className="td-stat-divider" />
        <div className="td-stat">
          <span className="td-stat__number">
            <span className="td-stat__value">{fullTrail.duration_hours}</span>
            <span className="td-stat__unit"> h</span>
          </span>
          <span className="td-stat__label">{t('trail.duration', 'Duration')}</span>
        </div>
        <div className="td-stat-divider" />
        <div className="td-stat">
          <span className="td-stat__number">
            <span className="td-stat__value">{fullTrail.elevation_gain_m}</span>
            <span className="td-stat__unit"> m</span>
          </span>
          <span className="td-stat__label">{t('trail.elevation', 'Elevation')}</span>
        </div>
        <div className="td-stat-divider" />
        <div className="td-stat">
          <span className="td-stat__number">
            <span className="td-stat__value" style={{ color: diff.color }}>{diff.label}</span>
          </span>
          <span className="td-stat__label">{t('trail.difficulty', 'Difficulty')}</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="container td-body">

        {/* Description */}
        <section className="td-section">
          <h2 className="td-section__title">{t('trail.trailOverview')}</h2>
          <p className="td-overview">{fullTrail.description}</p>
        </section>

        {/* Why Josephine picked this */}
        {noteText && (
          <div className="td-jph-note">
            <div className="td-jph-note__header">
              <img src="/josephine-portrait.webp" alt="Josephine" className="td-jph-note__mark" />
              <span className="td-jph-note__label">{t('trail.whyPicked', 'Why Josephine picked this')}</span>
            </div>
            <p className="td-jph-note__text">{noteText}</p>
          </div>
        )}

        {/* Local notes — public insider insights */}
        {publicInsights.length > 0 && (
          <div className="td-insights">
            <p className="td-insights__label">{t('trail.localSecretsTitle', 'Local notes')}</p>
            <ul className="td-insights__list">
              {publicInsights.map((ins) => (
                <li className="td-insights__item" key={ins.id}>
                  <span className="td-insights__icon">{INSIGHT_ICON[ins.kind] || '✦'}</span>
                  <span className="td-insights__text">{ins.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Plan-with-Josephine CTA — teases the chat-only secrets */}
        {onPlanWithJosephine && (
          <button className="td-plan-cta" onClick={() => onPlanWithJosephine(fullTrail)}>
            <img src="/josephine-portrait.webp" alt="" className="td-plan-cta__mark" />
            <span className="td-plan-cta__text">
              {secretCount > 0
                ? t('trail.secretsCta', 'Plan with Josephine — she knows {{count}} more secrets here', { count: secretCount })
                : t('trail.planCta', 'Plan this hike with Josephine')}
            </span>
            <span className="td-plan-cta__arrow">→</span>
          </button>
        )}

        {/* Good to know */}
        {goodToKnowRows.length > 0 && (
          <div className="td-gtk">
            <p className="td-gtk__label">{t('trail.goodToKnowTitle', 'Good to know')}</p>
            <div className="td-gtk__grid">
              {goodToKnowRows.map(([k, v]) => (
                <div className="td-gtk__cell" key={k}>
                  <span className="td-gtk__key">{k}</span>
                  <span className="td-gtk__val">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Elevation Profile */}
        {(fullTrail.elevation_gain_m || fullTrail.coordinates?.length > 1) && (
          <section className="td-section">
            <h2 className="td-section__title">Elevation Profile</h2>
            <ElevationProfile trail={fullTrail} />
          </section>
        )}

        {/* Weather */}
        {fullTrail.coordinates?.length > 0 && (
          <section className="td-section">
            <h2 className="td-section__title">{t('weather.title', 'Weather Conditions')}</h2>
            <WeatherWidget
              lat={fullTrail.coordinates[0][1]}
              lon={fullTrail.coordinates[0][0]}
              difficulty={fullTrail.difficulty}
            />
          </section>
        )}

        {/* Getting there (Perk #1 — turn-by-turn to the trailhead) */}
        <section className="td-section">
          <TrailheadDirections trail={fullTrail} onRoute={setDrivingRoute} />
        </section>

        {/* Map */}
        <section className="td-section">
          <h2 className="td-section__title">{t('trail.interactiveMap')}</h2>
          <div className="td-map-wrap">
            <TrailMap trail={fullTrail} drivingRoute={drivingRoute} />
          </div>
        </section>

        {/* Media */}
        <MediaGallery trail={fullTrail} />

        {/* POIs */}
        {fullTrail.pois?.length > 0 && (
          <section className="td-section">
            <h2 className="td-section__title">{t('trail.pointsOfInterest')}</h2>
            <div className="td-poi-grid">
              {fullTrail.pois.map((poi, i) => (
                <div key={i} className="td-poi">
                  <span className="td-poi__icon">{getPoiIcon(poi.type)}</span>
                  <div>
                    <p className="td-poi__name">{poi.name}</p>
                    <p className="td-poi__desc">{poi.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Meta chips */}
        <div className="td-meta-row">
          <div className="td-meta-chip">
            <span className="td-meta-chip__label">{t('trail.trailType')}</span>
            <span className="td-meta-chip__value">{fullTrail.trail_type || 'Loop'}</span>
          </div>
          <div className="td-meta-chip">
            <span className="td-meta-chip__label">{t('trail.bestSeason')}</span>
            <span className="td-meta-chip__value">{formatSeason(fullTrail.best_season)}</span>
          </div>
          <div className="td-meta-chip">
            <span className="td-meta-chip__label">{t('trail.dogFriendly')}</span>
            <span className="td-meta-chip__value">{fullTrail.dog_friendly ? '✓ Yes' : 'No'}</span>
          </div>
        </div>

        {/* Nearby Rifugios */}
        <NearbyRifugios ids={fullTrail.nearby_rifugios} onViewRifugio={viewRifugio} />

        <ReviewsSection trailId={fullTrail.id} onShowLogin={onShowLogin} />

      </div>

      {ENABLE_HIKE_TRACKING && (
        <div className="td-cta-bar">
          <button
            className="td-cta-btn"
            onClick={() => { if (onStartHike) onStartHike(fullTrail); }}
          >
            {t('trail.startHike')}
          </button>
        </div>
      )}

      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        onLogin={() => onShowLogin?.()}
        message="Sign in to save this trail and start tracking your routes."
      />
    </div>
  );
}

export default TrailDetail;
