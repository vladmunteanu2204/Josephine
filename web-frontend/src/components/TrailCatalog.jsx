import React, { useState, useEffect, useMemo } from 'react';
import { trailImg } from '../utils/trailImage';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Search, X, SlidersHorizontal, LayoutGrid, Map as MapIcon,
  Heart, Ruler, Clock, TrendingUp, Star, Mountain, ArrowRight,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import AuthPromptModal from './AuthPromptModal';
import { Card, Chip, SegmentedControl } from './ui';
import { API_URL } from '../api';
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
        <MapIcon size={40} strokeWidth={1.5} aria-hidden="true" />
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
                  {popup.distance_km} km · {popup.duration_hours}h · {popup.elevation_gain_m} m
                </p>
                <button className="cmp-btn" onClick={() => { setPopup(null); onViewTrail(popup); }}>
                  View trail <ArrowRight size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

function TrailCatalog({ viewTrail, initialTags = [], onTagsConsumed, onShowLogin }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { currentUser } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedTags, setSelectedTags] = useState(initialTags);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'
  const [showFilters, setShowFilters] = useState(false);
  const [savedTrailIds, setSavedTrailIds] = useState(() => {
    const saved = localStorage.getItem('savedTrails');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (parsed.length > 0 && typeof parsed[0] === 'object') {
      const ids = parsed.map(trail => trail.id);
      localStorage.setItem('savedTrails', JSON.stringify(ids));
      return ids;
    }
    return parsed;
  });

  useEffect(() => { loadTrails(); }, []);

  useEffect(() => {
    if (initialTags && initialTags.length > 0) {
      setSelectedTags(initialTags);
      if (onTagsConsumed) onTagsConsumed();
    }
  }, [initialTags]);

  const loadTrails = async () => {
    try {
      const response = await axios.get(`${API_URL}/trails`);
      setTrails(response.data.trails || []);
    } catch (error) {
      console.error('Error loading trails:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrails = useMemo(() => {
    let filtered = [...trails];
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(t => t.difficulty?.toLowerCase() === selectedDifficulty);
    }
    if (selectedTags.length > 0) {
      filtered = filtered.filter(trail => {
        const trailTags = trail.tags || trail.interests || [];
        return selectedTags.some(tag =>
          trailTags.some(tt => tt.toLowerCase().includes(tag.toLowerCase()))
        );
      });
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(trail =>
        trail.name?.toLowerCase().includes(query) ||
        trail.region?.toLowerCase().includes(query) ||
        trail.description?.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [trails, selectedDifficulty, selectedTags, searchQuery]);

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const toggleSaveTrail = (trail, e) => {
    e.stopPropagation();
    if (!currentUser) { setShowAuthPrompt(true); return; }
    const isSaved = savedTrailIds.includes(trail.id);
    const newSaved = isSaved
      ? savedTrailIds.filter(id => id !== trail.id)
      : [...savedTrailIds, trail.id];
    toast[isSaved ? 'info' : 'success'](
      isSaved
        ? (t('recommendations.trailUnsaved') || `${trail.name} removed from saved trails`)
        : (t('recommendations.trailSaved') || `${trail.name} saved!`)
    );
    setSavedTrailIds(newSaved);
    localStorage.setItem('savedTrails', JSON.stringify(newSaved));
  };

  const isTrailSaved = (trailId) => savedTrailIds.includes(trailId);

  const clearAll = () => { setSelectedDifficulty('all'); setSelectedTags([]); setSearchQuery(''); };

  const allTags = ['alpine lakes', 'panoramic views', 'forests', 'family friendly', 'loop trail', 'cultural routes'];

  const DIFFS = [
    { value: 'all',    label: t('catalog.all') },
    { value: 'easy',   label: t('catalog.easy') },
    { value: 'medium', label: t('catalog.medium') },
    { value: 'hard',   label: t('catalog.hard') },
  ];
  const VIEWS = [
    { value: 'grid', label: t('catalog.gridView', 'Grid'), icon: LayoutGrid },
    { value: 'map',  label: t('catalog.mapView', 'Map'),  icon: MapIcon },
  ];

  const activeCount = (selectedDifficulty !== 'all' ? 1 : 0) + selectedTags.length;
  const hasActive = activeCount > 0 || !!searchQuery.trim();

  return (
    <div className="catalog-page">
      <div className="catalog-header-section">
        <div className="container">
          <h1 className="catalog-title">{t('catalog.title')}</h1>
          <p className="catalog-subtitle">{t('catalog.subtitle')}</p>
        </div>
      </div>

      <div className="container">
        {/* Compact sticky filter bar */}
        <div className="tc-bar">
          <div className="tc-search">
            <Search size={18} strokeWidth={2} className="tc-search__icon" aria-hidden="true" />
            <input
              type="text"
              className="tc-search__input"
              placeholder={t('catalog.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="tc-search__clear" onClick={() => setSearchQuery('')} aria-label={t('catalog.clearFilters')}>
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </div>

          <button className={`tc-filter-btn${activeCount ? ' is-active' : ''}`} onClick={() => setShowFilters(true)}>
            <SlidersHorizontal size={18} strokeWidth={2} />
            <span>{t('catalog.filters')}</span>
            {activeCount > 0 && <span className="tc-filter-btn__badge">{activeCount}</span>}
          </button>

          <SegmentedControl
            options={VIEWS}
            value={viewMode}
            onChange={setViewMode}
            ariaLabel="View mode"
            className="tc-viewseg"
          />
        </div>

        {/* Selected-filter chips */}
        {hasActive && (
          <div className="tc-active">
            {selectedDifficulty !== 'all' && (
              <Chip active removable onRemove={() => setSelectedDifficulty('all')}>
                {t(`catalog.${selectedDifficulty}`)}
              </Chip>
            )}
            {selectedTags.map(tag => (
              <Chip key={tag} active removable onRemove={() => toggleTag(tag)} className="tc-cap">
                {tag}
              </Chip>
            ))}
            <button className="tc-clear-link" onClick={clearAll}>{t('catalog.clearFilters')}</button>
          </div>
        )}

        <p className="tc-count">
          {t('catalog.showing')} <strong>{filteredTrails.length}</strong>{' '}
          {filteredTrails.length !== 1 ? t('catalog.trails') : t('catalog.trail')}
        </p>

        {/* Content */}
        {loading ? (
          <div className="tc-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="tc-card tc-card--skeleton" aria-hidden="true">
                <div className="tc-card__media" />
                <div className="tc-card__body">
                  <span className="tc-sk tc-sk--sm" />
                  <span className="tc-sk tc-sk--lg" />
                  <span className="tc-sk tc-sk--row" />
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'map' ? (
          <CatalogMap trails={filteredTrails} onViewTrail={viewTrail} />
        ) : filteredTrails.length > 0 ? (
          <div className="tc-grid">
            {filteredTrails.map(trail => {
              const saved = isTrailSaved(trail.id);
              return (
                <Card key={trail.id} as="article" interactive className="tc-card" onClick={() => viewTrail(trail)}>
                  <div className="tc-card__media">
                    <img src={trailImg(trail, 'thumb')} alt={trail.name} className="tc-card__img" loading="lazy" />
                    <div className="tc-card__scrim" />
                    {trail.difficulty && (
                      <span className={`tc-diff tc-diff--${trail.difficulty}`}>{t(`catalog.${trail.difficulty}`)}</span>
                    )}
                    <button
                      className={`tc-save${saved ? ' is-saved' : ''}`}
                      onClick={(e) => toggleSaveTrail(trail, e)}
                      aria-label={saved ? t('recommendations.unsaveTrail') : t('recommendations.saveTrail')}
                      aria-pressed={saved}
                    >
                      <Heart size={18} strokeWidth={2} fill={saved ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="tc-card__body">
                    <p className="tc-card__region">{trail.region}</p>
                    <h3 className="tc-card__name">{trail.name}</h3>
                    <div className="tc-card__metrics">
                      <span className="tc-metric"><Ruler size={14} strokeWidth={2} />{trail.distance_km} km</span>
                      <span className="tc-metric"><Clock size={14} strokeWidth={2} />{trail.duration_hours}h</span>
                      <span className="tc-metric"><TrendingUp size={14} strokeWidth={2} />{trail.elevation_gain_m} m</span>
                      {trail.rating ? (
                        <span className="tc-metric tc-metric--rating"><Star size={14} strokeWidth={2} fill="currentColor" />{trail.rating}</span>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="tc-empty">
            <Mountain size={48} strokeWidth={1.25} aria-hidden="true" />
            <p>{t('catalog.noMatchingTrails')}</p>
            {hasActive && (
              <button className="tc-clear-link" onClick={clearAll}>{t('catalog.clearFilters')}</button>
            )}
          </div>
        )}
      </div>

      {/* Filters bottom sheet */}
      {showFilters && (
        <>
          <div className="tc-sheet-backdrop" onClick={() => setShowFilters(false)} aria-hidden="true" />
          <div className="tc-sheet" role="dialog" aria-modal="true" aria-label={t('catalog.filters')}>
            <div className="tc-sheet__handle" />
            <div className="tc-sheet__head">
              <h3>{t('catalog.filters')}</h3>
              <button className="tc-sheet__close" onClick={() => setShowFilters(false)} aria-label={t('catalog.clearFilters')}>
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="tc-sheet__section">
              <label className="tc-sheet__label">{t('catalog.filterByDifficulty')}</label>
              <SegmentedControl block options={DIFFS} value={selectedDifficulty} onChange={setSelectedDifficulty} ariaLabel={t('catalog.filterByDifficulty')} />
            </div>

            <div className="tc-sheet__section">
              <label className="tc-sheet__label">{t('catalog.filterByTags')}</label>
              <div className="tc-sheet__tags">
                {allTags.map(tag => (
                  <Chip key={tag} active={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} className="tc-cap">
                    {tag}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="tc-sheet__actions">
              {hasActive && <button className="tc-sheet__clear" onClick={clearAll}>{t('catalog.clearFilters')}</button>}
              <button className="tc-sheet__done" onClick={() => setShowFilters(false)}>{t('catalog.done', 'Done')}</button>
            </div>
          </div>
        </>
      )}

      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        onLogin={() => onShowLogin?.()}
        message="Sign in to save and revisit your favourite trails."
      />
    </div>
  );
}

export default TrailCatalog;
