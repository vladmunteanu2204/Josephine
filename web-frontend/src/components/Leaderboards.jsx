import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getUserGamificationData, getLeaderboardData, calculateLevel } from '../utils/gamification';
import './Leaderboards.css';

function Leaderboards({ onNavigate }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('allTime');
  const [userData, setUserData] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);

  useEffect(() => {
    const data = getUserGamificationData();
    setUserData(data);
    setLeaderboardData(getLeaderboardData());
  }, []);

  if (!userData) return null;

  const currentLevel = calculateLevel(userData.xp);

  return (
    <div className="leaderboards-page">
      {/* Header */}
      <div className="leaderboards-header">
        <button className="back-button" onClick={() => onNavigate('home')}>
          ← {t('common.back')}
        </button>
        <h1 className="page-title">{t('leaderboards.title', 'Leaderboards')}</h1>
        <p className="page-subtitle">{t('leaderboards.subtitle', 'Compete with other hikers')}</p>
      </div>

      {/* User Stats Card */}
      <div className="user-stats-card">
        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-label">{t('leaderboards.yourRank', 'Your Rank')}</div>
            <div className="stat-value">#1</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">{t('leaderboards.level', 'Level')}</div>
            <div className="stat-value">{currentLevel.level}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">{t('leaderboards.totalXP', 'Total XP')}</div>
            <div className="stat-value">{userData.xp.toLocaleString()}</div>
          </div>
        </div>
        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-label">{t('leaderboards.totalHikes', 'Total Hikes')}</div>
            <div className="stat-value">{userData.stats.totalHikes}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">{t('leaderboards.totalDistance', 'Distance')}</div>
            <div className="stat-value">{userData.stats.totalDistance.toFixed(1)}km</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">{t('leaderboards.totalElevation', 'Elevation')}</div>
            <div className="stat-value">{Math.round(userData.stats.totalElevation)}m</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="leaderboard-tabs">
        <button
          className={`tab-button ${activeTab === 'allTime' ? 'active' : ''}`}
          onClick={() => setActiveTab('allTime')}
        >
          {t('leaderboards.allTime', 'All Time')}
        </button>
        <button
          className={`tab-button ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          {t('leaderboards.monthly', 'This Month')}
        </button>
      </div>

      {/* Leaderboard Table */}
      <div className="leaderboard-table">
        <div className="table-header">
          <div className="col-rank">{t('leaderboards.rank', 'Rank')}</div>
          <div className="col-name">{t('leaderboards.hiker', 'Hiker')}</div>
          <div className="col-level">{t('leaderboards.level', 'Level')}</div>
          <div className="col-xp">{t('leaderboards.xp', 'XP')}</div>
          <div className="col-hikes">{t('leaderboards.hikes', 'Hikes')}</div>
          <div className="col-distance">{t('leaderboards.distance', 'Distance')}</div>
        </div>

        {leaderboardData.map((entry) => (
          <div
            key={entry.rank}
            className={`table-row ${entry.isCurrentUser ? 'current-user' : ''}`}
          >
            <div className="col-rank">
              {entry.rank === 1 && <span className="medal">🥇</span>}
              {entry.rank === 2 && <span className="medal">🥈</span>}
              {entry.rank === 3 && <span className="medal">🥉</span>}
              {entry.rank > 3 && <span className="rank-number">#{entry.rank}</span>}
            </div>
            <div className="col-name">
              {entry.name}
              {entry.isCurrentUser && <span className="you-badge">{t('leaderboards.you', 'You')}</span>}
            </div>
            <div className="col-level">
              <span className="level-badge">{entry.level}</span>
            </div>
            <div className="col-xp">{entry.xp.toLocaleString()}</div>
            <div className="col-hikes">{entry.totalHikes}</div>
            <div className="col-distance">{entry.totalDistance.toFixed(1)}km</div>
          </div>
        ))}
      </div>

      {/* Info Message */}
      <div className="leaderboard-info">
        <p>{t('leaderboards.info', 'Complete more hikes to climb the leaderboard and earn badges!')}</p>
      </div>
    </div>
  );
}

export default Leaderboards;
