import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './MultiDayTrails.css';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('replit') 
  ? `https://${window.location.host.split('--')[0].replace(/^webview-/, '')}--8000.${window.location.host.split('.').slice(1).join('.')}` 
  : 'http://localhost:8000');

function MultiDayTrails({ onNavigate }) {
  const { t } = useTranslation();
  const [trails, setTrails] = useState([]);
  const [filteredTrails, setFilteredTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    difficulty: '',
    region: '',
    durationMin: '',
    durationMax: '',
    type: ''
  });

  useEffect(() => {
    fetchTrails();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trails, filters]);

  const fetchTrails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/multi-day-trails`);
      setTrails(response.data.trails || []);
    } catch (error) {
      console.error('Error fetching multi-day trails:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...trails];

    if (filters.difficulty) {
      filtered = filtered.filter(t => t.difficulty === filters.difficulty);
    }

    if (filters.region) {
      filtered = filtered.filter(t => 
        t.region.toLowerCase().includes(filters.region.toLowerCase())
      );
    }

    if (filters.durationMin) {
      filtered = filtered.filter(t => t.duration_days >= parseInt(filters.durationMin));
    }

    if (filters.durationMax) {
      filtered = filtered.filter(t => t.duration_days <= parseInt(filters.durationMax));
    }

    if (filters.type) {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    setFilteredTrails(filtered);
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      difficulty: '',
      region: '',
      durationMin: '',
      durationMax: '',
      type: ''
    });
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
      <div className="multiday-loading">
        <div className="loading-spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="multiday-trails-page">
      {/* Hero Section */}
      <div className="multiday-hero">
        <div className="multiday-hero-overlay"></div>
        <div className="multiday-hero-content">
          <h1 className="multiday-hero-title">
            {t('multiday.heroTitle', 'Hut-to-Hut Multi-Day Treks')}
          </h1>
          <p className="multiday-hero-subtitle">
            {t('multiday.heroSubtitle', 'Epic alpine adventures connecting the most beautiful rifugios in the Dolomites')}
          </p>
        </div>
      </div>

      <div className="multiday-container">
        {/* Filters Sidebar */}
        <div className="multiday-sidebar">
          <div className="filter-header">
            <h3>{t('multiday.filters', 'Filters')}</h3>
            <button onClick={clearFilters} className="clear-filters-btn">
              {t('common.clear', 'Clear')}
            </button>
          </div>

          <div className="filter-section">
            <label>{t('multiday.difficulty', 'Difficulty')}</label>
            <select 
              value={filters.difficulty} 
              onChange={(e) => updateFilter('difficulty', e.target.value)}
            >
              <option value="">{t('common.all', 'All')}</option>
              <option value="easy">{t('difficulty.easy', 'Easy')}</option>
              <option value="moderate">{t('difficulty.moderate', 'Moderate')}</option>
              <option value="challenging">{t('difficulty.challenging', 'Challenging')}</option>
              <option value="expert">{t('difficulty.expert', 'Expert')}</option>
            </select>
          </div>

          <div className="filter-section">
            <label>{t('multiday.region', 'Region')}</label>
            <input
              type="text"
              value={filters.region}
              onChange={(e) => updateFilter('region', e.target.value)}
              placeholder={t('multiday.regionPlaceholder', 'e.g., Dolomites')}
            />
          </div>

          <div className="filter-section">
            <label>{t('multiday.duration', 'Duration (Days)')}</label>
            <div className="duration-inputs">
              <input
                type="number"
                min="1"
                placeholder={t('common.min', 'Min')}
                value={filters.durationMin}
                onChange={(e) => updateFilter('durationMin', e.target.value)}
              />
              <span>-</span>
              <input
                type="number"
                min="1"
                placeholder={t('common.max', 'Max')}
                value={filters.durationMax}
                onChange={(e) => updateFilter('durationMax', e.target.value)}
              />
            </div>
          </div>

          <div className="filter-section">
            <label>{t('multiday.type', 'Trek Type')}</label>
            <select 
              value={filters.type} 
              onChange={(e) => updateFilter('type', e.target.value)}
            >
              <option value="">{t('common.all', 'All')}</option>
              <option value="point-to-point">{t('multiday.pointToPoint', 'Point to Point')}</option>
              <option value="loop">{t('multiday.loop', 'Loop')}</option>
              <option value="out-and-back">{t('multiday.outAndBack', 'Out & Back')}</option>
            </select>
          </div>

          <div className="filter-stats">
            <div className="stat-item">
              <span className="stat-label">{t('multiday.totalTrails', 'Total Trails')}</span>
              <span className="stat-value">{trails.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('multiday.showing', 'Showing')}</span>
              <span className="stat-value">{filteredTrails.length}</span>
            </div>
          </div>
        </div>

        {/* Trails Grid */}
        <div className="multiday-content">
          <div className="multiday-header-bar">
            <h2>{t('multiday.availableTrails', 'Available Multi-Day Treks')}</h2>
            <div className="results-count">
              {filteredTrails.length} {t('multiday.results', 'results')}
            </div>
          </div>

          {filteredTrails.length === 0 ? (
            <div className="no-trails">
              <div className="no-trails-icon">🏔️</div>
              <h3>{t('multiday.noTrailsFound', 'No trails found')}</h3>
              <p>{t('multiday.tryDifferentFilters', 'Try adjusting your filters to see more options')}</p>
              <button onClick={clearFilters} className="reset-btn">
                {t('multiday.resetFilters', 'Reset Filters')}
              </button>
            </div>
          ) : (
            <div className="trails-grid">
              {filteredTrails.map(trail => (
                <div 
                  key={trail.id} 
                  className="trail-card"
                  onClick={() => onNavigate('multiday-detail', trail.id)}
                >
                  <div className="trail-card-image">
                    <img 
                      src={trail.thumbnail || trail.hero_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'} 
                      alt={trail.name}
                      loading="lazy"
                    />
                    <div className="trail-card-type-badge">
                      {t(`multiday.${trail.type?.replace(/-/g, '')}`, trail.type)}
                    </div>
                  </div>

                  <div className="trail-card-content">
                    <h3 className="trail-card-title">{trail.name}</h3>
                    
                    <div className="trail-card-stats">
                      <div className="stat">
                        <span className="stat-icon">📅</span>
                        <span>{trail.duration_days}D/{trail.duration_nights}N</span>
                      </div>
                      <div className="stat">
                        <span className="stat-icon">📏</span>
                        <span>{trail.total_distance_km} km</span>
                      </div>
                      <div className="stat">
                        <span className="stat-icon">⛰️</span>
                        <span>{trail.total_elevation_gain_m} m ↑</span>
                      </div>
                      <div className="stat">
                        <span className="stat-icon">🥾</span>
                        <span>{trail.stages?.length || 0} {t('multiday.stages', 'stages')}</span>
                      </div>
                    </div>

                    <p className="trail-card-description">
                      {trail.description?.substring(0, 150)}...
                    </p>

                    <div className="trail-card-footer">
                      <div className="trail-card-region">
                        📍 {trail.region}
                      </div>
                      <div 
                        className="trail-card-difficulty"
                        style={{ 
                          background: getDifficultyColor(trail.difficulty) + '20',
                          color: getDifficultyColor(trail.difficulty)
                        }}
                      >
                        {t(`difficulty.${trail.difficulty}`, trail.difficulty)}
                      </div>
                    </div>

                    <button className="trail-card-btn">
                      {t('multiday.viewDetails', 'View Details')} →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MultiDayTrails;
