import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useToast } from '../contexts/ToastContext';
import ReviewsSection from './ReviewsSection';
import TrailMap from './TrailMap';
import MediaGallery from './MediaGallery';
import ActiveHikeTracker from './ActiveHikeTracker';
import WeatherWidget from './WeatherWidget';
import { ENABLE_HIKE_TRACKING } from '../featureFlags';
import './TrailDetail.css';

const DIFFICULTY_CONFIG = {
  easy:   { color: '#4ade80', label: 'Easy'     },
  medium: { color: '#c9a84c', label: 'Moderate' },
  hard:   { color: '#ef4444', label: 'Hard'     },
};

function TrailDetail({ trail, onBack, setIsGPSActive }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [fullTrail, setFullTrail] = useState(trail);
  const [loading, setLoading]     = useState(false);
  const [isHikeActive, setIsHikeActive] = useState(false);
  const [isSaved, setIsSaved]     = useState(false);
  const [parallaxOffset, setParallaxOffset] = useState(0);
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

  // Cleanup GPS on unmount
  useEffect(() => () => { if (setIsGPSActive) setIsGPSActive(false); }, [setIsGPSActive]);

  // Parallax
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onScroll = () => setParallaxOffset(window.pageYOffset * 0.45);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSaveToggle = () => {
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

  const handleHikeEnd = (hikeData) => {
    setIsHikeActive(false);
    if (setIsGPSActive) setIsGPSActive(false);
    if (hikeData) {
      toast.success(`Hike complete! ${hikeData.stats.distance_km.toFixed(2)} km · ${hikeData.stats.duration_hours.toFixed(1)}h`, 5000);
    }
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
    <div className="td-page"><button className="td-back" onClick={onBack}>← {t('trail.backToTrails')}</button>
      <div className="td-state">{t('common.loading')}</div></div>
  );
  if (!fullTrail?.name) return (
    <div className="td-page"><button className="td-back" onClick={onBack}>← {t('trail.backToTrails')}</button>
      <div className="td-state td-state--error">{t('common.error')}</div></div>
  );

  if (ENABLE_HIKE_TRACKING && isHikeActive) {
    return <ActiveHikeTracker trail={fullTrail} onEnd={handleHikeEnd} />;
  }

  const diff = DIFFICULTY_CONFIG[fullTrail.difficulty] || DIFFICULTY_CONFIG.medium;
  const heroImg = fullTrail.wallpaper || fullTrail.image_url || fullTrail.thumbnail ||
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&auto=format&fit=crop&q=80';

  // Josephine note
  const lang = (i18n.language || 'en').split('-')[0];
  const note = fullTrail.josephineNote;
  const noteText = note && typeof note === 'object' ? (note[lang] || note.en || '').trim() : '';

  return (
    <div className="td-page">

      {/* ── Hero ── */}
      <div className="td-hero" ref={heroRef}>
        <img
          src={heroImg}
          alt={fullTrail.name}
          className="td-hero__img"
          style={{ transform: `translateY(${parallaxOffset}px)` }}
        />
        <div className="td-hero__overlay" />

        {/* Top controls */}
        <div className="td-hero__controls">
          <button className="td-back-btn" onClick={onBack} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className={`td-save-btn ${isSaved ? 'saved' : ''}`}
            onClick={handleSaveToggle}
            aria-label={isSaved ? t('trail.unsaveTrail') : t('trail.saveTrail')}
          >
            {isSaved ? '♥' : '♡'}
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
          <span className="td-stat__value">{fullTrail.distance_km}</span>
          <span className="td-stat__unit">km</span>
          <span className="td-stat__label">{t('trail.distance')}</span>
        </div>
        <div className="td-stat-divider" />
        <div className="td-stat">
          <span className="td-stat__value">{fullTrail.duration_hours}</span>
          <span className="td-stat__unit">h</span>
          <span className="td-stat__label">{t('trail.duration')}</span>
        </div>
        <div className="td-stat-divider" />
        <div className="td-stat">
          <span className="td-stat__value">{fullTrail.elevation_gain_m}</span>
          <span className="td-stat__unit">m ↑</span>
          <span className="td-stat__label">{t('trail.elevation')}</span>
        </div>
        <div className="td-stat-divider" />
        <div className="td-stat">
          <span className="td-stat__value" style={{ color: diff.color }}>{diff.label}</span>
          <span className="td-stat__label">{t('trail.difficulty')}</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="container td-body">

        {/* Description */}
        <section className="td-section">
          <h2 className="td-section__title">{t('trail.trailOverview')}</h2>
          <p className="td-overview">{fullTrail.description}</p>
        </section>

        {/* Josephine note */}
        {noteText && (
          <div className="td-jph-note">
            <div className="td-jph-note__header">
              <img src="/josephine-mark.svg" alt="" className="td-jph-note__mark" />
              <span className="td-jph-note__label">{t('trail.josephineNote')}</span>
            </div>
            <p className="td-jph-note__text">{noteText}</p>
          </div>
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

        {/* Map */}
        <section className="td-section">
          <h2 className="td-section__title">{t('trail.interactiveMap')}</h2>
          <div className="td-map-wrap">
            <TrailMap trail={fullTrail} />
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

        <ReviewsSection trailId={fullTrail.id} />

        {/* Spacer for pinned CTA */}
        <div style={{ height: 80 }} />
      </div>

      {/* ── Pinned CTA ── */}
      <div className="td-cta-bar">
        {ENABLE_HIKE_TRACKING ? (
          <button
            className="td-cta-btn"
            onClick={() => { setIsHikeActive(true); if (setIsGPSActive) setIsGPSActive(true); }}
          >
            {t('trail.startHike')}
          </button>
        ) : (
          <button className="td-cta-btn" onClick={handleSaveToggle}>
            {isSaved ? '♥ Saved' : 'Start this route →'}
          </button>
        )}
      </div>
    </div>
  );
}

export default TrailDetail;
