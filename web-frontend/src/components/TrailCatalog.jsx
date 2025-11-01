import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Icon from './Icon';
import { useToast } from '../contexts/ToastContext';
import './TrailCatalog.css';

const API_URL = '/api';

function TrailCatalog({ viewTrail }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [trails, setTrails] = useState([]);
  const [filteredTrails, setFilteredTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'map'
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

  useEffect(() => {
    loadTrails();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [selectedDifficulty, selectedTags, searchQuery, trails]);

  const loadTrails = async () => {
    try {
      const response = await axios.get(`${API_URL}/trails`);
      const trailData = response.data.trails || [];
      setTrails(trailData);
    } catch (error) {
      console.error('Error loading trails:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...trails];

    // Filter by difficulty
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(t => t.difficulty.toLowerCase() === selectedDifficulty);
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(trail => {
        const trailTags = trail.tags || trail.interests || [];
        return selectedTags.some(tag => 
          trailTags.some(tt => tt.toLowerCase().includes(tag.toLowerCase()))
        );
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(trail =>
        trail.name?.toLowerCase().includes(query) ||
        trail.region?.toLowerCase().includes(query) ||
        trail.description?.toLowerCase().includes(query)
      );
    }

    setFilteredTrails(filtered);
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleSaveTrail = (trail, e) => {
    e.stopPropagation();
    const isSaved = savedTrailIds.includes(trail.id);
    
    let newSaved;
    if (isSaved) {
      newSaved = savedTrailIds.filter(id => id !== trail.id);
      toast.info(t('recommendations.trailUnsaved') || `${trail.name} removed from saved trails`);
    } else {
      newSaved = [...savedTrailIds, trail.id];
      toast.success(t('recommendations.trailSaved') || `${trail.name} saved!`);
    }
    
    setSavedTrailIds(newSaved);
    localStorage.setItem('savedTrails', JSON.stringify(newSaved));
  };

  const isTrailSaved = (trailId) => {
    return savedTrailIds.includes(trailId);
  };

  const allTags = ['alpine lakes', 'panoramic views', 'forests', 'family friendly', 'loop trail', 'cultural routes'];

  return (
    <div className="catalog-page">
      <div className="catalog-header-section">
        <div className="container">
          <h1 className="catalog-title">{t('catalog.title')}</h1>
          <p className="catalog-subtitle">{t('catalog.subtitle')}</p>
        </div>
      </div>

      <div className="container catalog-container">
        {/* Sticky Sidebar */}
        <aside className="filters-sidebar">
          <div className="filters-sticky">
            <h3 className="filters-title">{t('catalog.filters')}</h3>

            {/* Search Bar */}
            <div className="filter-section">
              <label className="filter-label">{t('catalog.search')}</label>
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder={t('catalog.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="search-clear" onClick={() => setSearchQuery('')}>
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div className="filter-section">
              <label className="filter-label">{t('catalog.filterByDifficulty')}</label>
              <div className="filter-options">
                {['all', 'easy', 'medium', 'hard'].map(diff => (
                  <button
                    key={diff}
                    className={`filter-option ${selectedDifficulty === diff ? 'active' : ''}`}
                    onClick={() => setSelectedDifficulty(diff)}
                  >
                    {t(`catalog.${diff}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags Filter */}
            <div className="filter-section">
              <label className="filter-label">{t('catalog.filterByTags')}</label>
              <div className="filter-tags">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    className={`filter-tag ${selectedTags.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear All */}
            {(selectedDifficulty !== 'all' || selectedTags.length > 0 || searchQuery) && (
              <button 
                className="clear-filters-btn" 
                onClick={() => {
                  setSelectedDifficulty('all');
                  setSelectedTags([]);
                  setSearchQuery('');
                }}
              >
                {t('catalog.clearFilters')}
              </button>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="catalog-main">
          <div className="catalog-controls">
            <p className="results-count">
              {t('catalog.showing')} <strong>{filteredTrails.length}</strong> {filteredTrails.length !== 1 ? t('catalog.trails') : t('catalog.trail')}
            </p>

            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <Icon type="lucide" name="Grid3x3" size={18} tone="neutral" />
              </button>
              <button
                className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
                aria-label="Map view"
              >
                <Icon type="3d" name="compass" size={18} tone="alpine" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-catalog">{t('catalog.loadingTrails')}</div>
          ) : viewMode === 'grid' ? (
            filteredTrails.length > 0 ? (
              <div className="trail-grid-catalog">
                {filteredTrails.map(trail => (
                  <div 
                    key={trail.id}
                    className="trail-card-catalog"
                    onClick={() => viewTrail(trail)}
                  >
                    <button
                      className={`save-btn-catalog ${isTrailSaved(trail.id) ? 'saved' : ''}`}
                      onClick={(e) => toggleSaveTrail(trail, e)}
                      aria-label={isTrailSaved(trail.id) ? t('recommendations.unsaveTrail') : t('recommendations.saveTrail')}
                    >
                      <Icon type="lucide" name="Heart" size={20} tone={isTrailSaved(trail.id) ? "gold" : "neutral"} className={isTrailSaved(trail.id) ? "filled-heart" : ""} />
                    </button>
                    <img 
                      src={trail.thumbnail || trail.image_url} 
                      alt={trail.name}
                      className="trail-image-catalog"
                    />
                    <div className="trail-content-catalog">
                      <div className="trail-header-catalog">
                        <h3 className="trail-name-catalog">{trail.name}</h3>
                        <span className={`badge-catalog badge-${trail.difficulty}`}>
                          {t(`catalog.${trail.difficulty}`)}
                        </span>
                      </div>
                      <p className="trail-region-catalog">{trail.region}</p>
                      <div className="trail-stats-catalog">
                        <div className="stat-catalog">
                          <span className="stat-icon">📏</span>
                          <span>{trail.distance_km} km</span>
                        </div>
                        <div className="stat-catalog">
                          <span className="stat-icon">⏱️</span>
                          <span>{trail.duration_hours}h</span>
                        </div>
                        <div className="stat-catalog">
                          <span className="stat-icon">⛰️</span>
                          <span>{trail.elevation_gain_m}m</span>
                        </div>
                        {trail.rating && (
                          <div className="stat-catalog">
                            <span className="stat-icon">⭐</span>
                            <span>{trail.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-catalog">
                <div className="empty-icon-catalog">🏔️</div>
                <p>{t('catalog.noMatchingTrails')}</p>
              </div>
            )
          ) : (
            <div className="map-view-placeholder">
              <div className="map-placeholder-content">
                <span className="map-placeholder-icon">🗺️</span>
                <h3>{t('catalog.mapViewTitle')}</h3>
                <p>{t('catalog.mapViewDesc')}</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default TrailCatalog;
