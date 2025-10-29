import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { getUserGamificationData, awardXP } from '../utils/gamification';
import './Challenges.css';

function Challenges({ onNavigate }) {
  const { t } = useTranslation();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    loadChallenges();
    setUserData(getUserGamificationData());
  }, []);

  const loadChallenges = async () => {
    try {
      const response = await axios.get('/api/challenges');
      setChallenges(response.data.challenges || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading challenges:', error);
      setLoading(false);
    }
  };

  const calculateProgress = (challenge) => {
    if (!userData) return 0;

    switch (challenge.type) {
      case 'distance':
        return Math.min((userData.stats.totalDistance / challenge.goal) * 100, 100);
      case 'elevation':
        return Math.min((userData.stats.totalElevation / challenge.goal) * 100, 100);
      case 'hikes':
        return Math.min((userData.stats.totalHikes / challenge.goal) * 100, 100);
      default:
        return 0;
    }
  };

  const isCompleted = (challenge) => {
    return calculateProgress(challenge) >= 100;
  };

  const claimReward = (challenge) => {
    awardXP(challenge.reward_xp);
    alert(`Congratulations! You've earned ${challenge.reward_xp} XP for completing ${challenge.name}!`);
    setUserData(getUserGamificationData());
  };

  if (loading) {
    return (
      <div className="challenges-page">
        <div className="loading-state">Loading challenges...</div>
      </div>
    );
  }

  return (
    <div className="challenges-page">
      <div className="challenges-header">
        <button className="back-button" onClick={() => onNavigate('home')}>
          ← Back to Home
        </button>
        <h1>🏆 Active Challenges</h1>
        <p className="challenges-subtitle">
          Complete challenges to earn XP and unlock special badges!
        </p>
      </div>

      <div className="challenges-container">
        {challenges.length === 0 ? (
          <div className="empty-state">
            <h3>No active challenges</h3>
            <p>Check back soon for new hiking challenges!</p>
          </div>
        ) : (
          <div className="challenges-grid">
            {challenges.map(challenge => {
              const progress = calculateProgress(challenge);
              const completed = isCompleted(challenge);
              
              return (
                <div key={challenge.id} className={`challenge-card ${completed ? 'completed' : ''}`}>
                  <div className="challenge-badge">
                    <div className="badge-icon">{challenge.badge_icon}</div>
                    {completed && <div className="completed-badge">✅ Completed</div>}
                  </div>
                  
                  <div className="challenge-content">
                    <div className="challenge-header">
                      <span className="challenge-icon">{challenge.icon}</span>
                      <h3>{challenge.name}</h3>
                    </div>
                    
                    <p className="challenge-description">{challenge.description}</p>
                    
                    <div className="challenge-meta">
                      <div className="meta-item">
                        <span className="meta-label">Type:</span>
                        <span className="meta-value">{challenge.type}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Goal:</span>
                        <span className="meta-value">
                          {challenge.goal} {challenge.type === 'distance' ? 'km' : challenge.type === 'elevation' ? 'm' : challenge.type === 'hikes' ? 'hikes' : ''}
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Reward:</span>
                        <span className="meta-value reward">{challenge.reward_xp} XP</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Difficulty:</span>
                        <span className={`meta-value diff-${challenge.difficulty}`}>
                          {challenge.difficulty}
                        </span>
                      </div>
                      {challenge.duration_days && (
                        <div className="meta-item">
                          <span className="meta-label">Time Limit:</span>
                          <span className="meta-value">{challenge.duration_days} days</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="progress-section">
                      <div className="progress-header">
                        <span>Your Progress</span>
                        <span className="progress-percentage">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="progress-details">
                        {challenge.type === 'distance' && (
                          <span>{userData?.stats.totalDistance.toFixed(1)} / {challenge.goal} km</span>
                        )}
                        {challenge.type === 'elevation' && (
                          <span>{Math.round(userData?.stats.totalElevation)} / {challenge.goal} m</span>
                        )}
                        {challenge.type === 'hikes' && (
                          <span>{userData?.stats.totalHikes} / {challenge.goal} hikes</span>
                        )}
                      </div>
                    </div>
                    
                    {completed && (
                      <button className="claim-reward-btn" onClick={() => claimReward(challenge)}>
                        🎁 Claim Reward
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Challenges;
