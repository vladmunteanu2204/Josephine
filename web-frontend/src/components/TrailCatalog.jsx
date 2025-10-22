import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const API_URL = window.location.hostname.includes('replit.dev')
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : 'http://localhost:8000/api';

function TrailCatalog({ viewTrail }) {
  const { t } = useTranslation();
  const [trails, setTrails] = useState([]);
  const [filteredTrails, setFilteredTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  useEffect(() => {
    loadTrails();
  }, []);

  const loadTrails = async () => {
    try {
      const response = await axios.get(`${API_URL}/trails`);
      const trailData = response.data.trails || [];
      setTrails(trailData);
      setFilteredTrails(trailData);
    } catch (error) {
      console.error('Error loading trails:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterByDifficulty = (difficulty) => {
    setSelectedDifficulty(difficulty);
    if (difficulty === 'all') {
      setFilteredTrails(trails);
    } else {
      setFilteredTrails(trails.filter(t => t.difficulty.toLowerCase() === difficulty));
    }
  };

  return (
    <div className="container">
      <div className="catalog-header">
        <h1>{t('catalog.title')}</h1>
        <p>{t('catalog.subtitle')}</p>
      </div>

      <div className="filters">
        <h3>{t('catalog.filterByDifficulty')}</h3>
        <div className="filter-buttons">
          {['all', 'easy', 'medium', 'hard'].map(diff => (
            <button
              key={diff}
              className={`filter-btn ${selectedDifficulty === diff ? 'active' : ''}`}
              onClick={() => filterByDifficulty(diff)}
            >
              {t(`catalog.${diff}`)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading">{t('catalog.loadingTrails')}</div>
      ) : filteredTrails.length > 0 ? (
        <>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            {t('catalog.showing')} {filteredTrails.length} {filteredTrails.length !== 1 ? t('catalog.trails') : t('catalog.trail')}
          </p>
          <div className="trail-grid">
            {filteredTrails.map(trail => (
              <div 
                key={trail.id}
                className="trail-card"
                onClick={() => viewTrail(trail)}
              >
                <img 
                  src={trail.image_url} 
                  alt={trail.name}
                  className="trail-image"
                />
                <div className="trail-content">
                  <div className="trail-header">
                    <h3 className="trail-name">{trail.name}</h3>
                    <span className={`badge badge-${trail.difficulty}`}>
                      {t(`catalog.${trail.difficulty}`)}
                    </span>
                  </div>
                  <p className="trail-region">{trail.region}</p>
                  <div className="trail-stats">
                    <div className="stat">
                      <span className="stat-icon">📏</span>
                      <span>{trail.distance_km} km</span>
                    </div>
                    <div className="stat">
                      <span className="stat-icon">⏱️</span>
                      <span>{trail.duration_hours}h</span>
                    </div>
                    <div className="stat">
                      <span className="stat-icon">⛰️</span>
                      <span>{trail.elevation_gain_m}m</span>
                    </div>
                    {trail.rating && (
                      <div className="stat">
                        <span className="stat-icon">⭐</span>
                        <span>{trail.rating}</span>
                      </div>
                    )}
                  </div>
                  <div className="trail-tags">
                    {trail.interests && trail.interests.slice(0, 3).map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🏔️</div>
          <p>{t('catalog.noMatchingTrails')}</p>
        </div>
      )}
    </div>
  );
}

export default TrailCatalog;
