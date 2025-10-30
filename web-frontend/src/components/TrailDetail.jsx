import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useToast } from '../contexts/ToastContext';
import ReviewsSection from './ReviewsSection';
import TrailMap from './TrailMap';
import MediaGallery from './MediaGallery';
import ActiveHikeTracker from './ActiveHikeTracker';
import WeatherWidget from './WeatherWidget';
import './TrailDetail.css';

function TrailDetail({ trail, onBack }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [fullTrail, setFullTrail] = useState(trail);
  const [loading, setLoading] = useState(false);
  const [isHikeActive, setIsHikeActive] = useState(false);
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const heroRef = useRef(null);
  const statsRef = useRef(null);
  const elevationRef = useRef(null);

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
    if (elevationRef.current) observer.observe(elevationRef.current);

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

  const generateElevationProfile = () => {
    if (!fullTrail.coordinates || fullTrail.coordinates.length < 2) return [];
    
    const points = [];
    const coords = fullTrail.coordinates;
    const numPoints = Math.min(coords.length, 50);
    const step = Math.max(1, Math.floor(coords.length / numPoints));
    
    let cumulativeDistance = 0;
    
    for (let i = 0; i < coords.length; i += step) {
      const coord = coords[i];
      const elevation = coord[2] || coord.elevation || 0; // GPX elevation is 3rd element or .elevation property
      
      // Calculate cumulative distance using Haversine formula
      if (i > 0) {
        const prevCoord = coords[i - step] || coords[i - 1];
        const [lon1, lat1] = prevCoord;
        const [lon2, lat2] = coord;
        
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        cumulativeDistance += R * c;
      }
      
      points.push({
        distance: cumulativeDistance.toFixed(1),
        elevation: Math.round(elevation)
      });
    }
    
    // If no elevation data in coordinates, fallback to synthetic data
    if (points.every(p => p.elevation === 0)) {
      const totalDistance = fullTrail.distance_km || 10;
      const elevationGain = fullTrail.elevation_gain_m || 500;
      return points.map((p, i) => {
        const progress = i / (points.length - 1);
        const baseElevation = 1000;
        const elevation = baseElevation + Math.sin(progress * Math.PI) * elevationGain;
        return {
          distance: (progress * totalDistance).toFixed(1),
          elevation: Math.round(elevation)
        };
      });
    }
    
    return points;
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
    if (hikeData) {
      toast.success(`Hike completed! Distance: ${hikeData.stats.distance_km.toFixed(2)}km, Duration: ${hikeData.stats.duration_hours.toFixed(1)}h`, 5000);
    }
  };

  if (isHikeActive) {
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
          </div>
          <div className="difficulty-badge-hero" style={{ 
            backgroundColor: getDifficultyColor(fullTrail.difficulty),
            boxShadow: `0 0 30px ${getDifficultyColor(fullTrail.difficulty)}60`
          }}>
            {getDifficultyIcon(fullTrail.difficulty)} {fullTrail.difficulty}
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

        {fullTrail.coordinates && fullTrail.coordinates.length > 1 && (
          <div className="elevation-profile-section" ref={elevationRef}>
            <div className="section-header">
              <h2 className="section-title">{t('trail.elevationProfile')}</h2>
              <div className="gradient-divider"></div>
            </div>
            <div className="elevation-chart-container">
              <svg className="elevation-chart" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="elevationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                {(() => {
                  const elevationData = generateElevationProfile();
                  if (elevationData.length < 2) return null;
                  
                  const maxElevation = Math.max(...elevationData.map(p => p.elevation));
                  const minElevation = Math.min(...elevationData.map(p => p.elevation));
                  const range = maxElevation - minElevation || 100;
                  
                  const pathData = elevationData.map((point, index) => {
                    const x = (index / (elevationData.length - 1)) * 780 + 10;
                    const y = 190 - ((point.elevation - minElevation) / range) * 170;
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ');
                  
                  return (
                    <>
                      <path
                        d={`${pathData} L 790 190 L 10 190 Z`}
                        fill="url(#elevationGradient)"
                        className="elevation-area"
                      />
                      <path
                        d={pathData}
                        fill="none"
                        stroke="#d4a574"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="elevation-line"
                      />
                    </>
                  );
                })()}
              </svg>
              <div className="elevation-axis">
                <span className="elevation-label">0 km</span>
                <span className="elevation-label">{fullTrail.distance_km} km</span>
              </div>
            </div>
          </div>
        )}

        <div className="start-hike-section">
          <button 
            className="btn-start-hike btn-pulse"
            onClick={() => setIsHikeActive(true)}
          >
            <span className="btn-icon">🥾</span>
            <span className="btn-text">{t('trail.startHike')}</span>
            <span className="btn-subtext">{t('trail.gpsTrackingFeatures')}</span>
          </button>
        </div>

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
