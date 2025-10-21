import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

function Home({ setCurrentView, viewTrail }) {
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
          <h1>Discover Alpine Hiking</h1>
          <p>Verified trails in South Tyrol & Trentino, curated for every adventurer</p>
        </div>
      </div>

      <div className="container">
        <div className="cta-grid">
          <div className="cta-card" onClick={() => setCurrentView('recommendations')}>
            <div className="cta-icon">✨</div>
            <h3>Smart Recommendations</h3>
            <p>Personal suggestions from verified routes</p>
          </div>
          
          <div className="cta-card" onClick={() => setCurrentView('catalog')}>
            <div className="cta-icon">🗺️</div>
            <h3>Browse Trail Catalog</h3>
            <p>Explore all verified alpine routes</p>
          </div>
        </div>

        <div className="section">
          <h2 className="section-title">Today's Featured Trail</h2>
          
          {loading ? (
            <div className="loading">Loading recommendation...</div>
          ) : recommendedTrail ? (
            <div className="trail-grid">
              <div className="trail-card" onClick={() => viewTrail(recommendedTrail)}>
                <img 
                  src={recommendedTrail.thumbnail} 
                  alt={recommendedTrail.name}
                  className="trail-image"
                />
                <div className="trail-content">
                  <div className="trail-header">
                    <h3 className="trail-name">{recommendedTrail.name}</h3>
                    <span className={`badge badge-${recommendedTrail.difficulty}`}>
                      {recommendedTrail.difficulty}
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
                    {recommendedTrail.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🏔️</div>
              <p>No trails available</p>
            </div>
          )}
        </div>

        <div className="section">
          <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              ✓ All routes verified and curated for South Tyrol & Trentino
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;
