import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './MultiDayTrailDetail.css';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('replit') 
  ? `https://${window.location.host.split('--')[0].replace(/^webview-/, '')}--8000.${window.location.host.split('.').slice(1).join('.')}` 
  : 'http://localhost:8000');

function MultiDayTrailDetail({ trailId, onNavigate }) {
  const { t, i18n } = useTranslation();
  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(1);
  const [showEquipment, setShowEquipment] = useState(false);

  useEffect(() => {
    fetchTrailDetail();
  }, [trailId]);

  const fetchTrailDetail = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/multi-day-trails/${trailId}`);
      setTrail(response.data);
    } catch (error) {
      console.error('Error fetching trail detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: '#4caf50',
      moderate: '#ff9800',
      challenging: '#f44336',
      expert: '#9c27b0'
    };
    return colors[difficulty] || '#999';
  };

  if (loading) {
    return (
      <div className="multiday-detail-loading">
        <div className="loading-spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="multiday-detail-error">
        <h2>{t('multiday.notFound', 'Trail not found')}</h2>
        <button onClick={() => onNavigate('multiday-trails')}>
          {t('multiday.backToList', 'Back to Trails')}
        </button>
      </div>
    );
  }

  const currentStage = trail.stages?.[activeStage - 1];

  return (
    <div className="multiday-detail-page">
      {/* Hero Section */}
      <div 
        className="multiday-detail-hero"
        style={{ backgroundImage: `url(${trail.hero_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600'})` }}
      >
        <div className="multiday-detail-hero-overlay"></div>
        <div className="multiday-detail-hero-content">
          <button className="back-btn" onClick={() => onNavigate('multiday-trails')}>
            ← {t('common.back', 'Back')}
          </button>
          <h1 className="multiday-detail-title">{trail.name}</h1>
          <div className="multiday-detail-meta">
            <span className="meta-item">📍 {trail.region}</span>
            <span className="meta-item">📅 {trail.duration_days}D/{trail.duration_nights}N</span>
            <span className="meta-item">📏 {trail.total_distance_km} km</span>
            <span className="meta-item">⛰️ {trail.total_elevation_gain_m} m ↑</span>
            <span 
              className="meta-item difficulty-badge"
              style={{ 
                background: getDifficultyColor(trail.difficulty) + '20',
                color: getDifficultyColor(trail.difficulty)
              }}
            >
              {t(`difficulty.${trail.difficulty}`, trail.difficulty)}
            </span>
          </div>
        </div>
      </div>

      <div className="multiday-detail-container">
        {/* Overview Section */}
        <div className="detail-section overview-section">
          <h2>{t('multiday.overview', 'Trek Overview')}</h2>
          <p className="overview-description">{trail.description}</p>

          {(() => {
            const note = trail.josephineNote;
            if (!note || typeof note !== 'object') return null;
            const lang = i18n.language ? i18n.language.split('-')[0] : 'en';
            const noteText = (note[lang] || note.en || '').trim();
            if (!noteText) return null;
            return (
              <div className="josephine-note-callout">
                <div className="josephine-note-label">
                  <span className="josephine-note-icon">🏔️</span>
                  <span className="josephine-note-byline">{t('trail.josephineNote')}</span>
                </div>
                <p className="josephine-note-text">{noteText}</p>
              </div>
            );
          })()}

          {trail.highlights && trail.highlights.length > 0 && (
            <div className="highlights-grid">
              {trail.highlights.map((highlight, index) => (
                <div key={index} className="highlight-item">
                  <span className="highlight-icon">✨</span>
                  <span>{highlight}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stages Section */}
        <div className="detail-section stages-section">
          <h2>{t('multiday.stages', 'Trek Stages')} ({trail.stages?.length || 0} {t('multiday.days', 'days')})</h2>
          
          {/* Stage Navigation */}
          <div className="stages-nav">
            {trail.stages?.map((stage, index) => (
              <button
                key={index}
                className={`stage-nav-btn ${activeStage === stage.stage_number ? 'active' : ''}`}
                onClick={() => setActiveStage(stage.stage_number)}
              >
                <div className="stage-nav-number">{t('multiday.day', 'Day')} {stage.stage_number}</div>
                <div className="stage-nav-name">{stage.name}</div>
                <div className="stage-nav-stats">
                  {stage.distance_km} km · {stage.estimated_duration_hours}h
                </div>
              </button>
            ))}
          </div>

          {/* Active Stage Detail */}
          {currentStage && (
            <div className="stage-detail-card">
              <div className="stage-detail-header">
                <div>
                  <h3>
                    {t('multiday.day', 'Day')} {currentStage.stage_number}: {currentStage.name}
                  </h3>
                  <p className="stage-description">{currentStage.description}</p>
                </div>
                <div 
                  className="stage-difficulty-badge"
                  style={{ 
                    background: getDifficultyColor(currentStage.difficulty) + '20',
                    color: getDifficultyColor(currentStage.difficulty)
                  }}
                >
                  {t(`difficulty.${currentStage.difficulty}`, currentStage.difficulty)}
                </div>
              </div>

              <div className="stage-stats-grid">
                <div className="stage-stat">
                  <div className="stage-stat-icon">📏</div>
                  <div className="stage-stat-content">
                    <div className="stage-stat-label">{t('multiday.distance', 'Distance')}</div>
                    <div className="stage-stat-value">{currentStage.distance_km} km</div>
                  </div>
                </div>
                <div className="stage-stat">
                  <div className="stage-stat-icon">⬆️</div>
                  <div className="stage-stat-content">
                    <div className="stage-stat-label">{t('multiday.elevationGain', 'Elevation Gain')}</div>
                    <div className="stage-stat-value">{currentStage.elevation_gain_m} m</div>
                  </div>
                </div>
                <div className="stage-stat">
                  <div className="stage-stat-icon">⬇️</div>
                  <div className="stage-stat-content">
                    <div className="stage-stat-label">{t('multiday.elevationLoss', 'Elevation Loss')}</div>
                    <div className="stage-stat-value">{currentStage.elevation_loss_m} m</div>
                  </div>
                </div>
                <div className="stage-stat">
                  <div className="stage-stat-icon">⏱️</div>
                  <div className="stage-stat-content">
                    <div className="stage-stat-label">{t('multiday.duration', 'Duration')}</div>
                    <div className="stage-stat-value">{currentStage.estimated_duration_hours}h</div>
                  </div>
                </div>
              </div>

              {/* Route Points */}
              <div className="route-points">
                <div className="route-point">
                  <div className="route-point-icon start">🚀</div>
                  <div className="route-point-content">
                    <div className="route-point-label">{t('multiday.start', 'Start')}</div>
                    <div className="route-point-name">{currentStage.start_point?.name}</div>
                    <div className="route-point-elevation">{currentStage.start_point?.elevation_m} m</div>
                  </div>
                </div>
                <div className="route-connector"></div>
                <div className="route-point">
                  <div className="route-point-icon end">🏁</div>
                  <div className="route-point-content">
                    <div className="route-point-label">{t('multiday.end', 'End')}</div>
                    <div className="route-point-name">{currentStage.end_point?.name}</div>
                    <div className="route-point-elevation">{currentStage.end_point?.elevation_m} m</div>
                  </div>
                </div>
              </div>

              {/* Overnight Rifugio */}
              {currentStage.overnight_rifugio_name && (
                <div className="overnight-rifugio">
                  <h4>🏔️ {t('multiday.overnightStay', 'Overnight Stay')}</h4>
                  <div className="rifugio-card">
                    <div className="rifugio-info">
                      <div className="rifugio-name">{currentStage.overnight_rifugio_name}</div>
                      {currentStage.overnight_rifugio_details && (
                        <div className="rifugio-details">
                          <span>📍 {currentStage.overnight_rifugio_details.altitude} m</span>
                          <span>🛏️ {currentStage.overnight_rifugio_details.beds} {t('multiday.beds', 'beds')}</span>
                          {currentStage.overnight_rifugio_details.contact && (
                            <span>📞 {currentStage.overnight_rifugio_details.contact}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Stage Highlights */}
              {currentStage.highlights && currentStage.highlights.length > 0 && (
                <div className="stage-highlights">
                  <h4>{t('multiday.highlights', 'Stage Highlights')}</h4>
                  <ul>
                    {currentStage.highlights.map((highlight, index) => (
                      <li key={index}>{highlight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Equipment & Planning Section */}
        <div className="detail-section planning-section">
          <div className="planning-header">
            <h2>{t('multiday.planning', 'Trip Planning')}</h2>
            <button 
              className="equipment-toggle-btn"
              onClick={() => setShowEquipment(!showEquipment)}
            >
              {showEquipment ? '▼' : '▶'} {t('multiday.equipmentChecklist', 'Equipment Checklist')}
            </button>
          </div>

          {showEquipment && trail.equipment_checklist && (
            <div className="equipment-checklist">
              <div className="checklist-grid">
                {trail.equipment_checklist.map((item, index) => (
                  <div key={index} className="checklist-item">
                    <span className="checklist-checkbox">☐</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Booking Tips */}
          {trail.booking_tips && trail.booking_tips.length > 0 && (
            <div className="booking-tips">
              <h4>💡 {t('multiday.bookingTips', 'Booking Tips')}</h4>
              <ul>
                {trail.booking_tips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Season Info */}
          <div className="season-info">
            <h4>📅 {t('multiday.bestSeason', 'Best Season')}</h4>
            <p>
              {trail.best_season_start && trail.best_season_end && (
                <>
                  {new Date(`2000-${trail.best_season_start}`).toLocaleDateString('en', { month: 'long', day: 'numeric' })}
                  {' - '}
                  {new Date(`2000-${trail.best_season_end}`).toLocaleDateString('en', { month: 'long', day: 'numeric' })}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Gallery */}
        {trail.photos && trail.photos.length > 0 && (
          <div className="detail-section gallery-section">
            <h2>{t('multiday.gallery', 'Trail Gallery')}</h2>
            <div className="photos-grid">
              {trail.photos.map((photo, index) => (
                <div key={index} className="photo-item">
                  <img src={photo} alt={`${trail.name} - ${index + 1}`} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="detail-section cta-section">
          <h3>{t('multiday.readyToStart', 'Ready to Start Your Adventure?')}</h3>
          <p>{t('multiday.ctaDescription', 'Plan your multi-day trek and book your rifugio stays in advance')}</p>
          <div className="cta-buttons">
            <button 
              className="cta-btn primary"
              onClick={() => onNavigate('rifugios')}
            >
              🏔️ {t('multiday.browseRifugios', 'Browse Rifugios')}
            </button>
            <button 
              className="cta-btn secondary"
              onClick={() => onNavigate('hike-planner')}
            >
              📋 {t('multiday.addToPlanner', 'Add to Planner')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MultiDayTrailDetail;
