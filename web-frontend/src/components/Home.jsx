import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const API_URL = window.location.hostname.includes('replit.dev')
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : 'http://localhost:8000/api';

function Home({ setCurrentView, viewTrail }) {
  const { t } = useTranslation();
  const [recommendedTrail, setRecommendedTrail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendation();
  }, []);

  const loadRecommendation = async () => {
    try {
      const response = await axios.post(`${API_URL}/ai/recommend`, {
        duration_hours: 3,
        difficulty: 'medium',
        interests: ['panoramic views', 'alpine lakes']
      });
      
      if (response.data.results && response.data.results.length > 0) {
        setRecommendedTrail(response.data.results[0]);
      }
    } catch (error) {
      console.error('Error loading recommendation:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="hero">
        <div className="container">
          <h1>{t('hero.title')}</h1>
          <p>{t('hero.subtitle')}</p>
        </div>
      </div>

      <div className="container">
        <div className="cta-grid">
          <div className="cta-card" onClick={() => setCurrentView('recommendations')}>
            <div className="cta-icon">✨</div>
            <h3>{t('home.smartRecommendations')}</h3>
            <p>{t('home.smartRecommendationsDesc')}</p>
          </div>
          
          <div className="cta-card" onClick={() => setCurrentView('catalog')}>
            <div className="cta-icon">🗺️</div>
            <h3>{t('home.browseTrailCatalog')}</h3>
            <p>{t('home.browseTrailCatalogDesc')}</p>
          </div>
        </div>

        <div className="section">
          <h2 className="section-title">{t('home.todaysFeaturedTrail')}</h2>
          
          {loading ? (
            <div className="loading">{t('home.loadingRecommendation')}</div>
          ) : recommendedTrail ? (
            <div className="trail-grid">
              <div className="trail-card" onClick={() => viewTrail(recommendedTrail)}>
                <img 
                  src={recommendedTrail.thumbnail || recommendedTrail.image_url} 
                  alt={recommendedTrail.name}
                  className="trail-image"
                />
                <div className="trail-content">
                  <div className="trail-header">
                    <h3 className="trail-name">{recommendedTrail.name}</h3>
                    <span className={`badge badge-${recommendedTrail.difficulty}`}>
                      {t(`catalog.${recommendedTrail.difficulty}`)}
                    </span>
                  </div>
                  <p className="trail-region">{recommendedTrail.region}</p>
                  <div className="trail-stats">
                    <div className="stat">
                      <span className="stat-icon">📏</span>
                      <span>{recommendedTrail.distance_km} km</span>
                    </div>
                    <div className="stat">
                      <span className="stat-icon">⏱️</span>
                      <span>{recommendedTrail.duration_hours}h</span>
                    </div>
                    <div className="stat">
                      <span className="stat-icon">⛰️</span>
                      <span>{recommendedTrail.elevation_gain_m}m</span>
                    </div>
                  </div>
                  <div className="trail-tags">
                    {recommendedTrail.tags && recommendedTrail.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                    {recommendedTrail.interests && !recommendedTrail.tags && recommendedTrail.interests.slice(0, 3).map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🏔️</div>
              <p>{t('home.noTrailsAvailable')}</p>
            </div>
          )}
        </div>

        <div className="section">
          <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              ✓ {t('home.verifiedRoutes')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;
