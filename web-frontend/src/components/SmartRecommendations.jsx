import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './SmartRecommendations.css';

const API_URL = window.location.hostname.includes('replit.dev')
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : 'http://localhost:8000/api';

function SmartRecommendations({ viewTrail }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [duration, setDuration] = useState(3);
  const [difficulty, setDifficulty] = useState('medium');
  const [interests, setInterests] = useState([]);
  const [startArea, setStartArea] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedTrailIds, setSavedTrailIds] = useState(() => {
    const saved = localStorage.getItem('savedTrails');
    if (!saved) return [];
    
    const parsed = JSON.parse(saved);
    // Migration: Convert old format (full objects) to new format (IDs only)
    if (parsed.length > 0 && typeof parsed[0] === 'object') {
      const ids = parsed.map(trail => trail.id);
      localStorage.setItem('savedTrails', JSON.stringify(ids));
      return ids;
    }
    return parsed;
  });

  const INTERESTS = [
    { id: 'alpine lakes', icon: '💧', label: t('recommendations.alpineLakes') },
    { id: 'panoramic views', icon: '🏔️', label: t('recommendations.panoramicViews') },
    { id: 'via ferrata', icon: '🧗', label: t('recommendations.viaFerrata') },
    { id: 'forests', icon: '🌲', label: t('recommendations.forests') },
    { id: 'cultural routes', icon: '🏛️', label: t('recommendations.culturalRoutes') },
    { id: 'loop', icon: '🔄', label: t('recommendations.loopTrails') },
  ];

  const toggleInterest = (interestId) => {
    setInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`${API_URL}/ai/recommend`, {
        duration_hours: duration,
        difficulty,
        interests,
        start_area: startArea
      });
      
      setResults(response.data.results || []);
      setStep(4);
    } catch (err) {
      setError(t('recommendations.failedToLoad'));
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSaveTrail = (trail, e) => {
    e.stopPropagation();
    const isSaved = savedTrailIds.includes(trail.id);
    
    let newSaved;
    if (isSaved) {
      newSaved = savedTrailIds.filter(id => id !== trail.id);
    } else {
      newSaved = [...savedTrailIds, trail.id];
    }
    
    setSavedTrailIds(newSaved);
    localStorage.setItem('savedTrails', JSON.stringify(newSaved));
  };

  const isTrailSaved = (trailId) => {
    return savedTrailIds.includes(trailId);
  };

  const resetWizard = () => {
    setStep(1);
    setDuration(3);
    setDifficulty('medium');
    setInterests([]);
    setStartArea('');
    setResults([]);
    setError('');
  };

  return (
    <div className="container">
      <div className="recommendations-header">
        <h1>{t('recommendations.title')}</h1>
        <p>{t('recommendations.subtitle')}</p>
      </div>

      {step < 4 && (
        <div className="wizard-progress">
          <span className="progress-text">
            {t('recommendations.step')} {step} {t('recommendations.of')} 3
          </span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {step === 1 && (
        <div className="wizard-step">
          <h2>{t('recommendations.howLong')}</h2>
          <div className="slider-container">
            <div className="slider-value">{duration} {t('recommendations.hours')}</div>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>1h</span>
              <span>8h</span>
            </div>
          </div>

          <h2 style={{ marginTop: '48px' }}>{t('recommendations.whatDifficulty')}</h2>
          <div className="options-row">
            {['easy', 'medium', 'hard'].map(diff => (
              <button
                key={diff}
                className={`option-btn ${difficulty === diff ? 'active' : ''}`}
                onClick={() => setDifficulty(diff)}
              >
                {t(`catalog.${diff}`)}
              </button>
            ))}
          </div>

          <button className="btn-primary next-btn" onClick={() => setStep(2)}>
            {t('recommendations.next')}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-step">
          <h2>{t('recommendations.whatInterests')}</h2>
          <p className="hint">{t('recommendations.selectAll')}</p>
          
          <div className="interests-grid">
            {INTERESTS.map(interest => (
              <button
                key={interest.id}
                className={`interest-card ${interests.includes(interest.id) ? 'active' : ''}`}
                onClick={() => toggleInterest(interest.id)}
              >
                <div className="interest-icon">{interest.icon}</div>
                <div className="interest-label">{interest.label}</div>
              </button>
            ))}
          </div>

          <div className="wizard-nav">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              {t('recommendations.back')}
            </button>
            <button className="btn-primary" onClick={() => setStep(3)}>
              {t('recommendations.next')}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wizard-step">
          <h2>{t('recommendations.whereToStart')}</h2>
          <input
            type="text"
            className="text-input"
            placeholder={t('recommendations.enterLocation')}
            value={startArea}
            onChange={(e) => setStartArea(e.target.value)}
          />

          <div className="summary-card">
            <h3>{t('recommendations.yourPreferences')}</h3>
            <ul>
              <li>{t('recommendations.duration')}: {duration} {t('recommendations.hours')}</li>
              <li>{t('recommendations.difficulty')}: {t(`catalog.${difficulty}`)}</li>
              <li>{t('recommendations.interests')}: {interests.join(', ') || t('recommendations.noneSelected')}</li>
              <li>{t('recommendations.startArea')}: {startArea || t('recommendations.anyLocation')}</li>
            </ul>
          </div>

          <div className="wizard-nav">
            <button className="btn-secondary" onClick={() => setStep(2)}>
              {t('recommendations.back')}
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? t('recommendations.findingTrails') : `✨ ${t('recommendations.getRecommendations')}`}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="results-section">
          <div className="results-header">
            <h2>{t('recommendations.recommendedTrails')}</h2>
            <button className="btn-secondary" onClick={resetWizard}>
              {t('recommendations.newSearch')}
            </button>
          </div>

          <p className="results-disclaimer">
            ✓ {t('recommendations.verifiedOnly')}
          </p>

          {results.length > 0 ? (
            <div className="trail-grid">
              {results.map(trail => (
                <div 
                  key={trail.id} 
                  className="trail-card"
                  onClick={() => viewTrail(trail)}
                >
                  <button
                    className={`save-btn ${isTrailSaved(trail.id) ? 'saved' : ''}`}
                    onClick={(e) => toggleSaveTrail(trail, e)}
                    aria-label={isTrailSaved(trail.id) ? t('recommendations.unsaveTrail') : t('recommendations.saveTrail')}
                  >
                    {isTrailSaved(trail.id) ? '❤️' : '🤍'}
                  </button>
                  <img 
                    src={trail.thumbnail} 
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
                    </div>
                    <div className="trail-tags">
                      {trail.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🏔️</div>
              <p>{t('recommendations.noResults')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SmartRecommendations;
