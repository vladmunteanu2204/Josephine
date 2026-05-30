import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useToast } from '../contexts/ToastContext';
import './TrailCatalog.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

/* Approximate region centres for trails without coordinates */
const REGION_CENTRES = {
  'South Tyrol':            [11.35, 46.50],
  'Dolomites':              [11.95, 46.48],
  'Merano & Surroundings':  [11.16, 46.67],
  'Bolzano & Surroundings': [11.35, 46.50],
  'Val Pusteria':           [11.95, 46.79],
  'Val Gardena':            [11.72, 46.56],
  'Vinschgau':              [10.90, 46.68],
  'Val Sarentino':          [11.45, 46.62],
};

const DIFF_COLORS = { easy: '#4ade80', medium: '#c9a84c', hard: '#ef4444' };

function CatalogMap({ trails, onViewTrail }) {
  const [popup, setPopup] = useState(null);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="catalog-map-fallback">
        <span className="catalog-map-fallback__icon">◈</span>
        <p>Map requires a Mapbox token (VITE_MAPBOX_TOKEN)</p>
      </div>
    );
  }

  const getCoords = (trail) => {
    const c = trail.coordinates;
    if (c?.length > 0 && c[0]?.length >= 2) return [c[0][0], c[0][1]];
    return REGION_CENTRES[trail.region] || [11.35, 46.50];
  };

  return (
    <div className="catalog-map-wrap">
      <Map
        initialViewState={{ longitude: 11.4, latitude: 46.6, zoom: 8.5 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        onClick={() => setPopup(null)}
      >
        <NavigationControl position="top-right" />
        {trails.map(trail => {
          const [lng, lat] = getCoords(trail);
          const color = DIFF_COLORS[trail.difficulty] || '#c9a84c';
          return (
            <Marker key={trail.id} longitude={lng} latitude={lat} anchor="center"
              onClick={e => { e.originalEvent.stopPropagation(); setPopup(trail); }}>
              <div className="catalog-map-pin" style={{ '--pin-color': color }}
                title={trail.name}>
                <div className="catalog-map-pin__dot" />
              </div>
            </Marker>
          );
        })}
        {popup && (
          <Popup
            longitude={getCoords(popup)[0]}
            latitude={getCoords(popup)[1]}
            anchor="bottom"
            offset={16}
            onClose={() => setPopup(null)}
            closeButton={false}
            className="catalog-map-popup"
          >
            <div className="cmp-inner">
              {popup.thumbnail && (
                <img src={popup.thumbnail} alt={popup.name} className="cmp-img"
                  onError={e => e.target.style.display = 'none'} />
              )}
              <div className="cmp-body">
                <p className="cmp-region">{popup.region}</p>
                <p className="cmp-name">{popup.name}</p>
                <p className="cmp-stats">
                  {popup.distance_km} km · {popup.duration_hours}h · {popup.elevation_gain_m}m ↑
                </p>
                <button className="cmp-btn" onClick={() => { setPopup(null); onViewTrail(popup); }}>
                  View trail →
                </button>
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

const API_URL = '/api';

function TrailCatalog({ viewTrail, initialTags = [], onTagsConsumed }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [trails, setTrails] = useState([]);
  const [filteredTrails, setFilteredTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedTags, setSelectedTags] = useState(initialTags);
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
    if (initialTags && initialTags.length > 0) {
      setSelectedTags(initialTags);
      if (onTagsConsumed) onTagsConsumed();
    }
  }, [initialTags]);

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
                <span className="search-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </span>
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
                ▦
              </button>
              <button
                className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
                aria-label="Map view"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 2L1 4V16L6 14L12 16L17 14V2L12 4L6 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M6 2V14" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 4V16" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
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
                      {isTrailSaved(trail.id) ? '❤️' : '🤍'}
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
            <CatalogMap trails={filteredTrails} onViewTrail={viewTrail} />
          )}
        </main>
      </div>
    </div>
  );
}

export default TrailCatalog;
