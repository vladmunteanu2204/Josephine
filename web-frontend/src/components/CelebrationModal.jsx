import React, { useEffect, useState } from 'react';
import './CelebrationModal.css';

function CelebrationModal({ hikeData, gamification, onClose }) {
  const [showConfetti, setShowConfetti] = useState(true);
  const [animationPhase, setAnimationPhase] = useState('entering');

  useEffect(() => {
    // Start animation sequence
    setTimeout(() => setAnimationPhase('poles-cross'), 500);
    setTimeout(() => setShowConfetti && setShowConfetti(true), 1000);
    setTimeout(() => setAnimationPhase('show-stats'), 1500);
  }, []);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatDistance = (km) => {
    return km < 1 ? `${(km * 1000).toFixed(0)}m` : `${km.toFixed(2)}km`;
  };

  const newBadges = gamification?.newBadges || [];
  const xpGained = gamification?.xpGained || 0;

  return (
    <div className="celebration-overlay">
      <div className={`celebration-modal ${animationPhase}`}>
        {/* Confetti effect */}
        {showConfetti && (
          <div className="confetti-container">
            {[...Array(50)].map((_, i) => (
              <div 
                key={i} 
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  backgroundColor: ['#d4a574', '#4a7c9e', '#2d4a3e', '#ef4444', '#4ade80'][Math.floor(Math.random() * 5)]
                }}
              />
            ))}
          </div>
        )}

        {/* 3D Hiking Poles Animation */}
        <div className="poles-container">
          <div className="pole pole-left">
            <div className="pole-shaft"></div>
            <div className="pole-grip"></div>
            <div className="pole-tip"></div>
          </div>
          <div className="pole pole-right">
            <div className="pole-shaft"></div>
            <div className="pole-grip"></div>
            <div className="pole-tip"></div>
          </div>
        </div>

        {/* Congratulations Message */}
        <div className="congrats-message">
          <h1 className="congrats-title">🎉 CONGRATULATIONS! 🎉</h1>
          <p className="congrats-subtitle">You've completed the hike!</p>
          <p className="trail-name">{hikeData.trail_name}</p>
        </div>

        {/* Stats Summary */}
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-icon">🥾</div>
            <div className="stat-value">{formatDistance(hikeData.stats.distance_km)}</div>
            <div className="stat-label">Distance</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⛰️</div>
            <div className="stat-value">{Math.round(hikeData.stats.elevation_gain_m)}m</div>
            <div className="stat-label">Elevation</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-value">{formatDuration(hikeData.stats.duration_hours * 3600)}</div>
            <div className="stat-label">Time</div>
          </div>
          {xpGained > 0 && (
            <div className="stat-card xp-card">
              <div className="stat-icon">⭐</div>
              <div className="stat-value">+{xpGained} XP</div>
              <div className="stat-label">Experience</div>
            </div>
          )}
        </div>

        {/* Badges Earned */}
        {newBadges.length > 0 && (
          <div className="badges-earned">
            <h3>🏆 New Badges Earned!</h3>
            <div className="badge-list">
              {newBadges.map((badge, idx) => (
                <div key={idx} className="badge-item">
                  <span className="badge-icon">{badge.icon}</span>
                  <span className="badge-name">{badge.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Close Button */}
        <button className="celebration-close-btn" onClick={onClose}>
          <span className="btn-icon">📊</span>
          View Profile & Stats
        </button>
      </div>
    </div>
  );
}

export default CelebrationModal;
