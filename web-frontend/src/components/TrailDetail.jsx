import React from 'react';
import './TrailDetail.css';

function TrailDetail({ trail, onBack }) {
  return (
    <div className="trail-detail">
      <button className="back-button" onClick={onBack}>
        ← Back to Trails
      </button>

      <div className="detail-hero">
        <img 
          src={trail.thumbnail || trail.image_url} 
          alt={trail.name}
          className="detail-hero-image"
        />
        <div className="detail-hero-content">
          <h1>{trail.name}</h1>
          <p className="detail-region">{trail.region}</p>
        </div>
      </div>

      <div className="container">
        <div className="detail-stats-grid">
          <div className="detail-stat-card">
            <div className="stat-icon-large">📏</div>
            <div className="stat-value">{trail.distance_km} km</div>
            <div className="stat-label">Distance</div>
          </div>
          <div className="detail-stat-card">
            <div className="stat-icon-large">⏱️</div>
            <div className="stat-value">{trail.duration_hours}h</div>
            <div className="stat-label">Duration</div>
          </div>
          <div className="detail-stat-card">
            <div className="stat-icon-large">⛰️</div>
            <div className="stat-value">{trail.elevation_gain_m}m</div>
            <div className="stat-label">Elevation Gain</div>
          </div>
          <div className="detail-stat-card">
            <span className={`badge badge-${trail.difficulty}`} style={{ fontSize: '14px', padding: '6px 14px' }}>
              {trail.difficulty}
            </span>
            <div className="stat-label" style={{ marginTop: '8px' }}>Difficulty</div>
          </div>
        </div>

        <div className="detail-section">
          <h2>Description</h2>
          <p className="description-text">{trail.description}</p>
        </div>

        {trail.pois && trail.pois.length > 0 && (
          <div className="detail-section">
            <h2>Points of Interest</h2>
            <div className="pois-grid">
              {trail.pois.map((poi, index) => (
                <div key={index} className="poi-card">
                  <div className="poi-icon">
                    {poi.type === 'lake' && '💧'}
                    {poi.type === 'viewpoint' && '👁️'}
                    {poi.type === 'cabin' && '🏠'}
                    {poi.type === 'cultural' && '🏛️'}
                    {!['lake', 'viewpoint', 'cabin', 'cultural'].includes(poi.type) && '📍'}
                  </div>
                  <div>
                    <div className="poi-name">{poi.name}</div>
                    {poi.message && <div className="poi-description">{poi.message}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {trail.tags && trail.tags.length > 0 && (
          <div className="detail-section">
            <h2>Tags</h2>
            <div className="trail-tags">
              {trail.tags.map((tag, i) => (
                <span key={i} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {trail.trail_type && (
          <div className="detail-section">
            <div className="info-row">
              <span className="info-label">Trail Type:</span>
              <span className="info-value">{trail.trail_type}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrailDetail;
