import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './SavedTrails.css';

function SavedTrails({ onNavigate }) {
  const { t } = useTranslation();
  const [savedTrails, setSavedTrails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedTrails();
  }, []);

  const loadSavedTrails = async () => {
    try {
      const saved = JSON.parse(localStorage.getItem('savedTrails') || '[]');
      
      if (saved.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch full trail details for saved trails
      const API_URL = `${window.location.protocol}//${window.location.hostname}:8000`;
      const response = await axios.get(`${API_URL}/api/trails`);
      const allTrails = response.data.trails || response.data;
      
      const savedTrailData = allTrails.filter(trail => saved.includes(trail.id));
      setSavedTrails(savedTrailData);
    } catch (error) {
      console.error('Error loading saved trails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = (trailId) => {
    const saved = JSON.parse(localStorage.getItem('savedTrails') || '[]');
    const updated = saved.filter(id => id !== trailId);
    localStorage.setItem('savedTrails', JSON.stringify(updated));
    setSavedTrails(savedTrails.filter(trail => trail.id !== trailId));
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: '#22c55e',
      medium: '#f59e0b',
      hard: '#ef4444'
    };
    return colors[difficulty?.toLowerCase()] || '#6b7280';
  };

  if (loading) {
    return (
      <div className="saved-trails-page">
        <div className="saved-trails-container">
          <div className="loading-state">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-trails-page">
      <div className="saved-trails-container">
        <button onClick={() => onNavigate('home')} className="back-button">
          ← {t('common.backToHome')}
        </button>

        <div className="saved-trails-header">
          <h1 className="saved-trails-title">
            <span className="heart-icon">❤️</span>
            {t('savedTrails.title')}
          </h1>
          <p className="saved-trails-subtitle">{t('savedTrails.subtitle')}</p>
        </div>

        {savedTrails.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏔️</div>
            <h2>{t('savedTrails.emptyTitle')}</h2>
            <p>{t('savedTrails.emptyMessage')}</p>
            <button 
              onClick={() => onNavigate('catalog')} 
              className="btn-browse"
            >
              {t('savedTrails.browseCatalog')}
            </button>
          </div>
        ) : (
          <>
            <div className="saved-trails-stats">
              <span className="trails-count">
                {savedTrails.length} {savedTrails.length === 1 ? t('savedTrails.trail') : t('savedTrails.trails')}
              </span>
            </div>

            <div className="saved-trails-grid">
              {savedTrails.map((trail) => (
                <div key={trail.id} className="saved-trail-card">
                  <div className="card-image-wrapper">
                    <img 
                      src={trail.thumbnail || trail.gallery?.[0] || '/placeholder-trail.jpg'} 
                      alt={trail.name}
                      className="card-image"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnsave(trail.id);
                      }}
                      className="unsave-button"
                      aria-label={t('common.unsaveTrail')}
                    >
                      ❤️
                    </button>
                    <div 
                      className="difficulty-badge"
                      style={{ backgroundColor: getDifficultyColor(trail.difficulty) }}
                    >
                      {t(`catalog.difficulty.${trail.difficulty?.toLowerCase()}`)}
                    </div>
                  </div>

                  <div className="card-content">
                    <h3 className="card-title">{trail.name}</h3>
                    {trail.tagline && (
                      <p className="card-tagline">{trail.tagline}</p>
                    )}

                    <div className="card-stats">
                      <div className="stat">
                        <span className="stat-icon">📏</span>
                        <span className="stat-value">{trail.distance} km</span>
                      </div>
                      <div className="stat">
                        <span className="stat-icon">⏱️</span>
                        <span className="stat-value">{trail.duration}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-icon">⛰️</span>
                        <span className="stat-value">{trail.elevation_gain}m</span>
                      </div>
                    </div>

                    {trail.rating && (
                      <div className="card-rating">
                        <span className="stars">{'⭐'.repeat(Math.round(trail.rating))}</span>
                        <span className="rating-value">{trail.rating.toFixed(1)}</span>
                      </div>
                    )}

                    <button 
                      onClick={() => onNavigate('detail', trail.id)}
                      className="btn-view-trail"
                    >
                      {t('savedTrails.viewDetails')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SavedTrails;
