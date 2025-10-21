import React, { useState } from 'react';
import axios from 'axios';
import './SmartRecommendations.css';

const API_URL = window.location.hostname.includes('replit.dev')
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : 'http://localhost:8000/api';

const INTERESTS = [
  { id: 'alpine lakes', icon: '💧', label: 'Alpine Lakes' },
  { id: 'panoramic views', icon: '🏔️', label: 'Panoramic Views' },
  { id: 'via ferrata', icon: '🧗', label: 'Via Ferrata' },
  { id: 'forests', icon: '🌲', label: 'Forests' },
  { id: 'cultural routes', icon: '🏛️', label: 'Cultural Routes' },
  { id: 'loop', icon: '🔄', label: 'Loop Trails' },
];

function SmartRecommendations({ viewTrail }) {
  const [step, setStep] = useState(1);
  const [duration, setDuration] = useState(3);
  const [difficulty, setDifficulty] = useState('medium');
  const [interests, setInterests] = useState([]);
  const [startArea, setStartArea] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      setError('Failed to load recommendations. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
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
        <h1>Smart Recommendations</h1>
        <p>Get personalized trail suggestions from our verified routes in South Tyrol & Trentino</p>
      </div>

      {step < 4 && (
        <div className="wizard-progress">
          <span className="progress-text">Step {step} of 3</span>
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
          <h2>How long do you want to hike?</h2>
          <div className="slider-container">
            <div className="slider-value">{duration} hours</div>
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

          <h2 style={{ marginTop: '48px' }}>What difficulty?</h2>
          <div className="options-row">
            {['easy', 'medium', 'hard'].map(diff => (
              <button
                key={diff}
                className={`option-btn ${difficulty === diff ? 'active' : ''}`}
                onClick={() => setDifficulty(diff)}
              >
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </button>
            ))}
          </div>

          <button className="btn-primary next-btn" onClick={() => setStep(2)}>
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-step">
          <h2>What interests you?</h2>
          <p className="hint">Select all that apply</p>
          
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
              Back
            </button>
            <button className="btn-primary" onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wizard-step">
          <h2>Where do you want to start?</h2>
          <input
            type="text"
            className="text-input"
            placeholder="Enter location (e.g., Bolzano, Merano)"
            value={startArea}
            onChange={(e) => setStartArea(e.target.value)}
          />

          <div className="summary-card">
            <h3>Your Preferences</h3>
            <ul>
              <li>Duration: {duration} hours</li>
              <li>Difficulty: {difficulty}</li>
              <li>Interests: {interests.join(', ') || 'None selected'}</li>
              <li>Starting area: {startArea || 'Any'}</li>
            </ul>
          </div>

          <div className="wizard-nav">
            <button className="btn-secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Finding trails...' : '✨ Get Recommendations'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="results-section">
          <div className="results-header">
            <h2>Recommended Trails for You</h2>
            <button className="btn-secondary" onClick={resetWizard}>
              New Search
            </button>
          </div>

          <p className="results-disclaimer">
            ✓ Verified routes only — curated for South Tyrol & Trentino
          </p>

          {results.length > 0 ? (
            <div className="trail-grid">
              {results.map(trail => (
                <div 
                  key={trail.id} 
                  className="trail-card"
                  onClick={() => viewTrail(trail)}
                >
                  <img 
                    src={trail.thumbnail} 
                    alt={trail.name}
                    className="trail-image"
                  />
                  <div className="trail-content">
                    <div className="trail-header">
                      <h3 className="trail-name">{trail.name}</h3>
                      <span className={`badge badge-${trail.difficulty}`}>
                        {trail.difficulty}
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
              <p>No trails match your criteria. Try adjusting your preferences.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SmartRecommendations;
