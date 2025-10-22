import React from 'react';
import ReviewsSection from './ReviewsSection';
import './TrailDetail.css';

function TrailDetail({ trail, onBack }) {
  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: '#4ade80',
      medium: '#fbbf24',
      hard: '#ef4444'
    };
    return colors[difficulty] || '#d4a574';
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

  return (
    <div className="trail-detail">
      <button className="back-button" onClick={onBack}>
        ← Back to Trails
      </button>

      <div className="detail-hero">
        <img 
          src={trail.thumbnail || trail.image_url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200'} 
          alt={trail.name}
          className="detail-hero-image"
        />
        <div className="detail-hero-overlay"></div>
        <div className="detail-hero-content">
          <span className="region-badge">{trail.region}</span>
          <h1 className="hero-title">{trail.name}</h1>
          <p className="hero-tagline">
            {trail.difficulty === 'easy' && 'Where serenity meets alpine beauty'}
            {trail.difficulty === 'medium' && 'Venture into the heart of the mountains'}
            {trail.difficulty === 'hard' && 'Challenge awaits among the peaks'}
          </p>
          <button className="view-map-btn">
            <span className="map-icon">🗺️</span>
            View on Map
          </button>
        </div>
      </div>

      <div className="container detail-container">
        <div className="stats-grid">
          <div className="stat-glass-card">
            <div className="stat-icon">📏</div>
            <div className="stat-value">{trail.distance_km} km</div>
            <div className="stat-label">Distance</div>
          </div>
          <div className="stat-glass-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-value">{trail.duration_hours}h</div>
            <div className="stat-label">Duration</div>
          </div>
          <div className="stat-glass-card">
            <div className="stat-icon">⛰️</div>
            <div className="stat-value">{trail.elevation_gain_m}m</div>
            <div className="stat-label">Elevation</div>
          </div>
          <div className="stat-glass-card">
            <div className="stat-icon" style={{ fontSize: '16px' }}>
              <span 
                className="difficulty-badge-detail" 
                style={{ 
                  backgroundColor: getDifficultyColor(trail.difficulty),
                  boxShadow: `0 0 20px ${getDifficultyColor(trail.difficulty)}40`
                }}
              >
                {trail.difficulty}
              </span>
            </div>
            <div className="stat-label" style={{ marginTop: '12px' }}>Difficulty</div>
          </div>
        </div>

        <div className="trail-overview-section">
          <div className="section-header">
            <h2 className="section-title">Trail Overview</h2>
            <div className="gradient-divider"></div>
          </div>
          <p className="overview-text">{trail.description}</p>
        </div>

        {trail.pois && trail.pois.length > 0 && (
          <div className="poi-section">
            <div className="section-header">
              <h2 className="section-title">Points of Interest</h2>
              <div className="gradient-divider"></div>
            </div>
            <div className="poi-grid">
              {trail.pois.map((poi, index) => (
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
              <span className="meta-label">Trail Type</span>
              <span className="meta-value">{trail.trail_type || 'Loop'}</span>
            </div>
          </div>
          <div className="meta-card">
            <span className="meta-icon">🌤️</span>
            <div className="meta-content">
              <span className="meta-label">Best Season</span>
              <span className="meta-value">{formatSeason(trail.best_season)}</span>
            </div>
          </div>
          <div className="meta-card">
            <span className="meta-icon">🐕</span>
            <div className="meta-content">
              <span className="meta-label">Dog Friendly</span>
              <span className="meta-value">{trail.dog_friendly ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        <ReviewsSection trailId={trail.id} />
      </div>
    </div>
  );
}

export default TrailDetail;
