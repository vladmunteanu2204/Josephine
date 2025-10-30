import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './Rifugios.css';

const API_URL = import.meta.env.PROD 
  ? '/api' 
  : `${window.location.protocol}//${window.location.hostname}:8000/api`;

function Rifugios({ onNavigate }) {
  const { t } = useTranslation();
  const [rifugios, setRifugios] = useState([]);
  const [filteredRifugios, setFilteredRifugios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    region: '',
    status: '',
    min_altitude: '',
    max_altitude: ''
  });
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'map'

  useEffect(() => {
    loadRifugios();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rifugios, searchQuery, filters]);

  const loadRifugios = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/rifugios`);
      setRifugios(response.data.rifugios || []);
    } catch (error) {
      console.error('Error loading rifugios:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...rifugios];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.region.toLowerCase().includes(query) ||
        (r.description && r.description.toLowerCase().includes(query))
      );
    }

    if (filters.type) {
      filtered = filtered.filter(r => r.type === filters.type);
    }

    if (filters.region) {
      filtered = filtered.filter(r => r.region === filters.region);
    }

    if (filters.status) {
      filtered = filtered.filter(r => r.status === filters.status);
    }

    if (filters.min_altitude) {
      filtered = filtered.filter(r => r.altitude >= parseInt(filters.min_altitude));
    }

    if (filters.max_altitude) {
      filtered = filtered.filter(r => r.altitude <= parseInt(filters.max_altitude));
    }

    setFilteredRifugios(filtered);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      region: '',
      status: '',
      min_altitude: '',
      max_altitude: ''
    });
    setSearchQuery('');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return { icon: '🟢', text: t('rifugio.statusOpen'), class: 'status-open' };
      case 'closed':
        return { icon: '🔴', text: t('rifugio.statusClosed'), class: 'status-closed' };
      case 'opening_soon':
        return { icon: '🟡', text: t('rifugio.statusOpeningSoon'), class: 'status-opening-soon' };
      default:
        return { icon: '⚪', text: t('rifugio.statusSeasonal'), class: 'status-seasonal' };
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      rifugio: t('rifugio.typeRifugio'),
      malga: t('rifugio.typeMalga'),
      bivacco: t('rifugio.typeBivacco')
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="rifugios-page">
        <div className="loading-state">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="rifugios-page">
      {/* Hero Section */}
      <div className="rifugios-header">
        <h1 className="page-title">🏔️ {t('rifugio.title')}</h1>
        <p className="page-subtitle">{t('rifugio.subtitle')}</p>
      </div>

      <div className="rifugios-container">
        {/* Filters Sidebar */}
        <aside className="filters-sidebar">
          <div className="filters-header">
            <h2>{t('catalog.filters')}</h2>
            <button className="clear-filters-btn" onClick={clearFilters}>
              {t('admin.clearFilters')}
            </button>
          </div>

          {/* Search */}
          <div className="filter-group">
            <label>{t('catalog.search')}</label>
            <input
              type="text"
              className="search-input"
              placeholder={t('rifugio.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Type Filter */}
          <div className="filter-group">
            <label>{t('rifugio.type')}</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="filter-select"
            >
              <option value="">{t('catalog.all')}</option>
              <option value="rifugio">{t('rifugio.typeRifugio')}</option>
              <option value="malga">{t('rifugio.typeMalga')}</option>
              <option value="bivacco">{t('rifugio.typeBivacco')}</option>
            </select>
          </div>

          {/* Region Filter */}
          <div className="filter-group">
            <label>{t('rifugio.region')}</label>
            <select
              value={filters.region}
              onChange={(e) => handleFilterChange('region', e.target.value)}
              className="filter-select"
            >
              <option value="">{t('catalog.all')}</option>
              <option value="South Tyrol">South Tyrol</option>
              <option value="Trentino">Trentino</option>
              <option value="Dolomites">Dolomites</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="filter-group">
            <label>{t('rifugio.status')}</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="filter-select"
            >
              <option value="">{t('catalog.all')}</option>
              <option value="open">{t('rifugio.statusOpen')}</option>
              <option value="closed">{t('rifugio.statusClosed')}</option>
              <option value="opening_soon">{t('rifugio.statusOpeningSoon')}</option>
            </select>
          </div>

          {/* Altitude Range */}
          <div className="filter-group">
            <label>{t('rifugio.altitudeRange')}</label>
            <div className="altitude-inputs">
              <input
                type="number"
                placeholder="Min (m)"
                value={filters.min_altitude}
                onChange={(e) => handleFilterChange('min_altitude', e.target.value)}
                className="altitude-input"
              />
              <input
                type="number"
                placeholder="Max (m)"
                value={filters.max_altitude}
                onChange={(e) => handleFilterChange('max_altitude', e.target.value)}
                className="altitude-input"
              />
            </div>
          </div>

          {/* Results Count */}
          <div className="results-count">
            {filteredRifugios.length} {t('rifugio.resultsFound')}
          </div>
        </aside>

        {/* Main Content */}
        <main className="rifugios-content">
          {/* View Mode Toggle */}
          <div className="view-controls">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              📱 {t('catalog.gridView')}
            </button>
            <button
              className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
              onClick={() => setViewMode('map')}
            >
              🗺️ {t('catalog.mapView')}
            </button>
          </div>

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="rifugios-grid">
              {filteredRifugios.map((rifugio) => {
                const status = getStatusBadge(rifugio.status);
                return (
                  <div
                    key={rifugio.id}
                    className="rifugio-card"
                    onClick={() => onNavigate('rifugio-detail', rifugio.id)}
                  >
                    {/* Hero Image */}
                    <div className="rifugio-card-image">
                      <img
                        src={rifugio.photos?.[0] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'}
                        alt={rifugio.name}
                        loading="lazy"
                      />
                      <div className={`status-badge ${status.class}`}>
                        {status.icon} {status.text}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="rifugio-card-content">
                      <h3 className="rifugio-name">{rifugio.name}</h3>

                      <div className="rifugio-meta">
                        <span className="meta-item">
                          ⛰️ {rifugio.altitude}m
                        </span>
                        <span className="meta-item">
                          📍 {rifugio.region}
                        </span>
                      </div>

                      <div className="rifugio-type-badge">
                        {getTypeLabel(rifugio.type)}
                      </div>

                      {/* Facilities Icons */}
                      {rifugio.facilities && (
                        <div className="facilities-icons">
                          {rifugio.facilities.beds > 0 && (
                            <span title={t('rifugio.beds')}>🛏️ {rifugio.facilities.beds}</span>
                          )}
                          {rifugio.facilities.meals && (
                            <span title={t('rifugio.meals')}>🍽️</span>
                          )}
                          {rifugio.facilities.showers && (
                            <span title={t('rifugio.showers')}>🚿</span>
                          )}
                          {rifugio.facilities.wifi && (
                            <span title={t('rifugio.wifi')}>📶</span>
                          )}
                          {rifugio.facilities.dogs && (
                            <span title={t('rifugio.dogs')}>🐕</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Map View */}
          {viewMode === 'map' && (
            <div className="rifugios-map-placeholder">
              <p>🗺️ {t('rifugio.mapViewPlaceholder')}</p>
              <p className="map-hint">{t('rifugio.mapViewHint')}</p>
            </div>
          )}

          {/* Empty State */}
          {filteredRifugios.length === 0 && (
            <div className="empty-state">
              <p>{t('rifugio.noResults')}</p>
              <button className="clear-filters-btn" onClick={clearFilters}>
                {t('admin.clearFilters')}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Rifugios;
