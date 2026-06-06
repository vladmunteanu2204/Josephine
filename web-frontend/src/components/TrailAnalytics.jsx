import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Eye, Star, Check, Clock } from 'lucide-react';
import './TrailAnalytics.css';

function TrailAnalytics({ adminPassword }) {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('views');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/analytics/trails');
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSortedTrails = () => {
    if (!analytics || !analytics.trails) return [];
    const trails = [...analytics.trails];
    trails.sort((a, b) => b[sortBy] - a[sortBy]);
    return trails;
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return '#4ade80';
      case 'medium': return '#fbbf24';
      case 'hard': return '#ef4444';
      default: return '#9ca3af';
    }
  };

  return (
    <div className="trail-analytics">
      <h2>{t('admin.trailAnalytics')}</h2>
      <p className="section-description">{t('admin.trailAnalyticsDescription')}</p>

      {loading ? (
        <div className="loading-state">{t('common.loading')}</div>
      ) : analytics ? (
        <>
          <div className="analytics-overview">
            <div className="metric-card">
              <div className="metric-value">{analytics.total_views.toLocaleString()}</div>
              <div className="metric-label">{t('admin.totalViews')}</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{analytics.total_saves.toLocaleString()}</div>
              <div className="metric-label">{t('admin.totalSaves')}</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{analytics.total_completions.toLocaleString()}</div>
              <div className="metric-label">{t('admin.totalCompletions')}</div>
            </div>
          </div>

          <div className="sort-controls">
            <label>{t('admin.sortBy')}:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
              <option value="views">{t('admin.views')}</option>
              <option value="saves">{t('admin.saves')}</option>
              <option value="completions">{t('admin.completions')}</option>
            </select>
          </div>

          <div className="trails-list">
            {getSortedTrails().map((trail, idx) => (
              <div key={trail.id} className="trail-analytics-card">
                <div className="rank-badge">#{idx + 1}</div>
                <div className="trail-info">
                  <h3 className="trail-name">{trail.name}</h3>
                  <span 
                    className="difficulty-badge"
                    style={{ backgroundColor: getDifficultyColor(trail.difficulty) }}
                  >
                    {trail.difficulty}
                  </span>
                </div>
                <div className="trail-stats-grid">
                  <div className="stat-item">
                    <span className="stat-icon"><Eye size={18} strokeWidth={2} /></span>
                    <span className="stat-value">{trail.views}</span>
                    <span className="stat-label">{t('admin.views')}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon"><Star size={18} strokeWidth={2} /></span>
                    <span className="stat-value">{trail.saves}</span>
                    <span className="stat-label">{t('admin.saves')}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon"><Check size={18} strokeWidth={2.5} /></span>
                    <span className="stat-value">{trail.completions}</span>
                    <span className="stat-label">{t('admin.completions')}</span>
                  </div>
                  {trail.avg_duration > 0 && (
                    <div className="stat-item">
                      <span className="stat-icon"><Clock size={18} strokeWidth={2} /></span>
                      <span className="stat-value">{trail.avg_duration}h</span>
                      <span className="stat-label">{t('admin.avgDuration')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">{t('admin.noDataAvailable')}</div>
      )}
    </div>
  );
}

export default TrailAnalytics;
