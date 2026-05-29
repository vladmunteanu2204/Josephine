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

function TrailDetail({ trail, onBack, setIsGPSActive }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [fullTrail, setFullTrail] = useState(trail);
  const [loading, setLoading] = useState(false);
  const [isHikeActive, setIsHikeActive] = useState(false);
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const heroRef = useRef(null);
  const statsRef = useRef(null);

  useEffect(() => {
    // If trail only has an ID, fetch the full trail data
    if (trail && trail.id && !trail.name) {
      const fetchTrailData = async () => {
        setLoading(true);
        try {
          const response = await axios.get('/api/trails');
          const trails = response.data.trails || response.data;
          const foundTrail = trails.find(t => t.id === trail.id);
          if (foundTrail) {
            setFullTrail(foundTrail);
          }
        } catch (error) {
          console.error('Error fetching trail:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchTrailData();
    }
  }, [trail]);

  // Check if trail is saved
  useEffect(() => {
    if (fullTrail && fullTrail.id) {
      const savedTrails = JSON.parse(localStorage.getItem('savedTrails') || '[]');
      setIsSaved(savedTrails.includes(fullTrail.id));
    }
  }, [fullTrail]);

  // Cleanup: Reset GPS state when component unmounts
  useEffect(() => {
    return () => {
      if (setIsGPSActive) setIsGPSActive(false);
    };
  }, [setIsGPSActive]);

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.pageYOffset;
      const rate = scrolled * 0.5;
      setParallaxOffset(rate);
    };

    const preferReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!preferReducedMotion.matches) {
      window.addEventListener('scroll', handleScroll);
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const preferReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preferReducedMotion.matches) return;

    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated-in');
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    if (statsRef.current) observer.observe(statsRef.current);

    return () => observer.disconnect();
  }, [fullTrail]);

  if (loading) {
    return (
      <div className="trail-detail">
        <button className="back-button" onClick={onBack}>
          ← {t('trail.backToTrails')}
        </button>
        <div className="loading-state">{t('common.loading')}</div>
      </div>
    );
  }

  if (!fullTrail || !fullTrail.name) {
    return (
      <div className="trail-detail">
        <button className="back-button" onClick={onBack}>
          ← {t('trail.backToTrails')}
        </button>
        <div className="error-state">{t('common.error')}</div>
      </div>
    );
  }
  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: '#4ade80',
      medium: '#fbbf24',
      hard: '#ef4444'
    };
    return colors[difficulty] || '#d4a574';
  };

  const getDifficultyIcon = (difficulty) => {
    const icons = {
      easy: '🟢',
      medium: '🟠',
      hard: '🔴'
    };
    return icons[difficulty] || '⚪';
  };

  const handleSaveToggle = () => {
    const savedTrails = JSON.parse(localStorage.getItem('savedTrails') || '[]');
    let updated;
    
    if (isSaved) {
      updated = savedTrails.filter(id => id !== fullTrail.id);
      toast.info(t('trail.trailUnsaved'));
    } else {
      updated = [...savedTrails, fullTrail.id];
      toast.success(t('trail.trailSaved'));
    }
    
    localStorage.setItem('savedTrails', JSON.stringify(updated));
    setIsSaved(!isSaved);
  };

  const formatSeason = (seasons) => {
    if (!seasons) return 'Year-round';
    if (typeof seasons === 'string') return seasons;
    if (Array.isArray(seasons)) {
      if (seasons.length === 0) return 'Year-round';
      if (seasons.length <= 2) return seasons.join(', ');
      return `${seasons[0]} - ${seasons[seasons.length - 1]}`;
    }
    return 'Year-round';
  };

  const getPoiIcon = (type) => {
    const icons = {
      lake: '💧',
      viewpoint: '👁️',
      cabin: '🏠',
      cultural: '🏛️',
      peak: '⛰️',
      waterfall: '🌊',
      forest: '🌲'
    };
    return icons[type] || '📍';
  };

  const handleHikeEnd = (hikeData) => {
    setIsHikeActive(false);
    if (setIsGPSActive) setIsGPSActive(false);
    if (hikeData) {
      toast.success(`Hike completed! Distance: ${hikeData.stats.distance_km.toFixed(2)}km, Duration: ${hikeData.stats.duration_hours.toFixed(1)}h`, 5000);
    }
  };

  if (ENABLE_HIKE_TRACKING && isHikeActive) {
    return (
      <ActiveHikeTracker 
        trail={fullTrail} 
        onEnd={handleHikeEnd}
      />
    );
  }

  return (
    <div className="trail-detail">
      <button className="back-button" onClick={onBack}>
        ← {t('trail.backToTrails')}
      </button>

      <button 
        className={`save-trail-btn ${isSaved ? 'saved' : ''}`}
        onClick={handleSaveToggle}
        aria-label={isSaved ? t('trail.unsaveTrail') : t('trail.saveTrail')}
      >
        <span className="save-icon">{isSaved ? '❤️' : '🤍'}</span>
      </button>

      <div className="detail-hero" ref={heroRef}>
        <img 
          src={fullTrail.wallpaper || fullTrail.thumbnail || fullTrail.image_url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200'} 
          alt={fullTrail.name}
          className="detail-hero-image"
          style={{
            transform: `translateY(${parallaxOffset}px)`
          }}
        />
        <div className="detail-hero-overlay"></div>
        <div className="detail-hero-content hero-fade-in">
          <div className="hero-top-row">
            <span className="region-badge">{fullTrail.region}</span>
            <span className="difficulty-badge-hero" style={{ 
              backgroundColor: getDifficultyColor(fullTrail.difficulty),
              boxShadow: `0 0 30px ${getDifficultyColor(fullTrail.difficulty)}60`
            }}>
              {getDifficultyIcon(fullTrail.difficulty)} {fullTrail.difficulty}
            </span>
          </div>
          <h1 className="hero-title">{fullTrail.name}</h1>
          <p className="hero-tagline">
            {fullTrail.tagline || 
             (fullTrail.difficulty === 'easy' && t('trail.taglineEasy')) ||
             (fullTrail.difficulty === 'medium' && t('trail.taglineMedium')) ||
             (fullTrail.difficulty === 'hard' && t('trail.taglineHard'))
            }
          </p>
        </div>
      </div>

      <div className="container detail-container">
        <div className="stats-grid stats-animated" ref={statsRef}>
          <div className="stat-glass-card" style={{ animationDelay: '0.1s' }}>
            <div className="stat-icon stat-icon-glow">📏</div>
            <div className="stat-value">{fullTrail.distance_km} km</div>
            <div className="stat-label">{t('trail.distance')}</div>
          </div>
          <div className="stat-glass-card" style={{ animationDelay: '0.2s' }}>
            <div className="stat-icon stat-icon-glow">⏱️</div>
            <div className="stat-value">{fullTrail.duration_hours}h</div>
            <div className="stat-label">{t('trail.duration')}</div>
          </div>
          <div className="stat-glass-card" style={{ animationDelay: '0.3s' }}>
            <div className="stat-icon stat-icon-glow">⛰️</div>
            <div className="stat-value">{fullTrail.elevation_gain_m}m</div>
            <div className="stat-label">{t('trail.elevation')}</div>
          </div>
          <div className="stat-glass-card" style={{ animationDelay: '0.4s' }}>
            <div className="stat-icon" style={{ fontSize: '16px' }}>
              <span 
                className="difficulty-badge-detail" 
                style={{ 
                  backgroundColor: getDifficultyColor(fullTrail.difficulty),
                  boxShadow: `0 0 20px ${getDifficultyColor(fullTrail.difficulty)}40`
                }}
              >
                {fullTrail.difficulty}
              </span>
            </div>
            <div className="stat-label" style={{ marginTop: '12px' }}>{t('trail.difficulty')}</div>
          </div>
        </div>

        {ENABLE_HIKE_TRACKING && (
          <div className="start-hike-section">
            <button 
              className="btn-start-hike btn-pulse"
              onClick={() => {
                setIsHikeActive(true);
                if (setIsGPSActive) setIsGPSActive(true);
              }}
            >
              <span className="btn-icon">🥾</span>
              <span className="btn-text">{t('trail.startHike')}</span>
              <span className="btn-subtext">{t('trail.gpsTrackingFeatures')}</span>
            </button>
          </div>
        )}

        {fullTrail.coordinates && fullTrail.coordinates.length > 0 && (
          <div className="weather-section">
            <div className="section-header">
              <h2 className="section-title">{t('weather.title', 'Weather Conditions')}</h2>
              <div className="gradient-divider"></div>
            </div>
            <WeatherWidget 
              lat={fullTrail.coordinates[0][1]} 
              lon={fullTrail.coordinates[0][0]} 
              difficulty={fullTrail.difficulty}
            />
          </div>
        )}

        <div className="trail-overview-section">
          <div className="section-header">
            <h2 className="section-title">{t('trail.trailOverview')}</h2>
            <div className="gradient-divider"></div>
          </div>
          <p className="overview-text">{fullTrail.description}</p>

          {(() => {
            const note = fullTrail.josephineNote;
            if (!note || typeof note !== 'object') return null;
            const lang = i18n.language ? i18n.language.split('-')[0] : 'en';
            const noteText = (note[lang] || note.en || '').trim();
            if (!noteText) return null;
            return (
              <div className="josephine-note-callout">
                <div className="josephine-note-label">
                  <span className="josephine-note-icon">✦</span>
                  <span className="josephine-note-byline">{t('trail.josephineNote')}</span>
                </div>
                <p className="josephine-note-text">{noteText}</p>
              </div>
            );
          })()}
        </div>

        <div className="map-section">
          <div className="section-header">
            <h2 className="section-title">{t('trail.interactiveMap')}</h2>
            <div className="gradient-divider"></div>
          </div>
          <TrailMap trail={fullTrail} />
        </div>

        <MediaGallery trail={fullTrail} />

        {fullTrail.pois && fullTrail.pois.length > 0 && (
          <div className="poi-section">
            <div className="section-header">
              <h2 className="section-title">{t('trail.pointsOfInterest')}</h2>
              <div className="gradient-divider"></div>
            </div>
            <div className="poi-grid">
              {fullTrail.pois.map((poi, index) => (
                <div key={index} className="poi-card-premium">
                  <div className="poi-icon-circle">
                    {getPoiIcon(poi.type)}
                  </div>
                  <div className="poi-content">
                    <h3 className="poi-name">{poi.name}</h3>
                    <p className="poi-description">{poi.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="footer-meta">
          <div className="meta-card">
            <span className="meta-icon">🥾</span>
            <div className="meta-content">
              <span className="meta-label">{t('trail.trailType')}</span>
              <span className="meta-value">{fullTrail.trail_type || 'Loop'}</span>
            </div>
          </div>
          <div className="meta-card">
            <span className="meta-icon">🌤️</span>
            <div className="meta-content">
              <span className="meta-label">{t('trail.bestSeason')}</span>
              <span className="meta-value">{formatSeason(fullTrail.best_season)}</span>
            </div>
          </div>
          <div className="meta-card">
            <span className="meta-icon">🐕</span>
            <div className="meta-content">
              <span className="meta-label">{t('trail.dogFriendly')}</span>
              <span className="meta-value">{fullTrail.dog_friendly ? t('trail.yes') : t('trail.no')}</span>
            </div>
          </div>
        </div>

        <ReviewsSection trailId={fullTrail.id} />
      </div>
    </div>
  );
}

export default TrailDetail;
