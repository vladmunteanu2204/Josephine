import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './GamificationStats.css';

function GamificationStats({ adminPassword }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/analytics/gamification', {
        headers: {  }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error loading gamification stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateUnlockRate = (unlocks, totalUsers) => {
    if (totalUsers === 0) return 0;
    return ((unlocks / totalUsers) * 100).toFixed(1);
  };

  return (
    <div className="gamification-stats">
      <h2>{t('admin.gamificationStats')}</h2>
      <p className="section-description">{t('admin.gamificationStatsDescription')}</p>

      {loading ? (
        <div className="loading-state">{t('common.loading')}</div>
      ) : stats ? (
        <>
          {/* Overview Metrics */}
          <div className="overview-grid">
            <div className="overview-card">
              <div className="overview-icon">🏔️</div>
              <div className="overview-value">{stats.total_hikes}</div>
              <div className="overview-label">{t('admin.totalHikes')}</div>
            </div>
            <div className="overview-card">
              <div className="overview-icon">📏</div>
              <div className="overview-value">{stats.total_distance} km</div>
              <div className="overview-label">{t('admin.totalDistance')}</div>
            </div>
            <div className="overview-card">
              <div className="overview-icon">⛰️</div>
              <div className="overview-value">{stats.total_elevation} m</div>
              <div className="overview-label">{t('admin.totalElevation')}</div>
            </div>
            <div className="overview-card">
              <div className="overview-icon">🎯</div>
              <div className="overview-value">{stats.challenge_stats?.active_challenges || 0}</div>
              <div className="overview-label">{t('admin.activeChallenges')}</div>
            </div>
          </div>

          {/* Badge Statistics */}
          <div className="section-block">
            <h3 className="section-title">{t('admin.badgeUnlocks')}</h3>
            <div className="badges-grid">
              {Object.entries(stats.badge_stats || {}).map(([badgeName, data]) => (
                <div key={badgeName} className="badge-stat-card">
                  <div className="badge-header">
                    <span className="badge-icon">🏅</span>
                    <span className="badge-name">{badgeName.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="badge-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${calculateUnlockRate(data.unlocks, data.total_users)}%` }}
                      />
                    </div>
                    <div className="progress-text">
                      {data.unlocks} / {data.total_users} ({calculateUnlockRate(data.unlocks, data.total_users)}%)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Challenge Statistics */}
          <div className="section-block">
            <h3 className="section-title">{t('admin.challengeStats')}</h3>
            <div className="challenge-stats-grid">
              <div className="challenge-stat-item">
                <div className="challenge-stat-label">{t('admin.activeChallenges')}</div>
                <div className="challenge-stat-value">{stats.challenge_stats?.active_challenges || 0}</div>
              </div>
              <div className="challenge-stat-item">
                <div className="challenge-stat-label">{t('admin.totalParticipants')}</div>
                <div className="challenge-stat-value">{stats.challenge_stats?.total_participants || 0}</div>
              </div>
              <div className="challenge-stat-item">
                <div className="challenge-stat-label">{t('admin.completionRate')}</div>
                <div className="challenge-stat-value">{stats.challenge_stats?.completion_rate || 0}%</div>
              </div>
            </div>
          </div>

          {/* Level Distribution */}
          <div className="section-block">
            <h3 className="section-title">{t('admin.levelDistribution')}</h3>
            <div className="level-distribution">
              {Object.entries(stats.level_distribution || {}).map(([level, count]) => (
                <div key={level} className="level-bar-container">
                  <div className="level-label">{level.replace(/_/g, ' ')}</div>
                  <div className="level-bar">
                    <div 
                      className="level-bar-fill"
                      style={{ 
                        width: `${(count / Math.max(...Object.values(stats.level_distribution || {}))) * 100}%` 
                      }}
                    >
                      <span className="level-count">{count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">{t('admin.noDataAvailable')}</div>
      )}
    </div>
  );
}

export default GamificationStats;
