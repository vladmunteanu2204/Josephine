import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Map, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Search, X, List, Map as MapIcon, Mountain,
  BedDouble, UtensilsCrossed, ShowerHead, Wifi, Dog,
} from 'lucide-react';
import { SegmentedControl } from './ui';
import './Rifugios.css';

import { API_URL } from '../api';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const STATUS_CONFIG = {
  open:   { dot: '#4ade80', label: 'Open'   },
  closed: { dot: '#ef4444', label: 'Closed' },
};

const TYPE_LABELS = { rifugio: 'Rifugio', malga: 'Malga', bivacco: 'Bivacco' };

const TYPE_COLORS = { rifugio: '#c9a84c', malga: '#4ade80', bivacco: '#94a3b8' };

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatSeason(opening_season) {
  if (!opening_season?.start_date || !opening_season?.end_date) return null;
  try {
    const s = new Date(opening_season.start_date);
    const e = new Date(opening_season.end_date);
    const sm = MONTH_SHORT[s.getUTCMonth()];
    const em = MONTH_SHORT[e.getUTCMonth()];
    return sm === em ? sm : `${sm}–${em}`;
  } catch { return null; }
}

const TYPE_DESCRIPTIONS = {
  malga: {
    headline: 'Alpine Dairy Farms',
    body: 'Working farms that welcome day visitors. Fresh cheese, buttermilk, and a meal with the farming family. Season varies by altitude — typically late May through October.',
    color: '#4ade80',
  },
  rifugio: {
    headline: 'Mountain Huts',
    body: 'Staffed huts with beds, showers, and full meals. Book ahead in July and August. Season typically runs May through October or November depending on the hut.',
    color: '#c9a84c',
  },
  bivacco: {
    headline: 'Emergency Shelters',
    body: 'Unmanned, always unlocked, always free. No reservation possible — bring everything you need. Year-round access for self-sufficient mountaineers.',
    color: '#94a3b8',
  },
};

/* ── Map sub-component ── */
function RifugioMap({ rifugios, onSelect }) {
  const [popup, setPopup] = useState(null);
  const validRifs = rifugios.filter(r => r.coordinates?.lat && r.coordinates?.lng);

  // Center on South Tyrol
  const [viewport] = useState({
    latitude: 46.65,
    longitude: 11.2,
    zoom: 8,
  });

  if (!MAPBOX_TOKEN) {
    return (
      <div className="rif-map-unavailable">
        <p>Map unavailable — Mapbox token not configured.</p>
      </div>
    );
  }

  return (
    <div className="rif-map-wrap">
      <Map
        initialViewState={viewport}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        {validRifs.map(r => (
          <Marker
            key={r.id}
            longitude={r.coordinates.lng}
            latitude={r.coordinates.lat}
            anchor="bottom"
            onClick={e => { e.originalEvent.stopPropagation(); setPopup(r); }}
          >
            <div
              className="rif-map-pin"
              style={{ background: TYPE_COLORS[r.type] || '#c9a84c' }}
              title={r.name}
            />
          </Marker>
        ))}

        {popup && (
          <Popup
            longitude={popup.coordinates.lng}
            latitude={popup.coordinates.lat}
            anchor="top"
            onClose={() => setPopup(null)}
            closeButton={true}
            closeOnClick={false}
            className="rif-map-popup"
          >
            <div className="rif-popup-inner">
              {popup.photos?.[0] && (
                <img src={popup.photos[0]} alt={popup.name} className="rif-popup-img" />
              )}
              <div className="rif-popup-body">
                <span
                  className="rif-popup-type"
                  style={{ color: TYPE_COLORS[popup.type] || '#c9a84c' }}
                >
                  {TYPE_LABELS[popup.type] || popup.type}
                </span>
                <p className="rif-popup-name">{popup.name}</p>
                <p className="rif-popup-meta">⛰ {popup.altitude}m · {popup.region}</p>
                <button className="rif-popup-view" onClick={() => onSelect(popup.id)}>
                  View →
                </button>
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

function Rifugios({ onNavigate, initialType, onTypeConsumed, initialStatus, onStatusConsumed }) {
  const { t } = useTranslation();
  const [rifugios, setRifugios]           = useState([]);
  const [filtered, setFiltered]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [typeFilter, setTypeFilter]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [showMap, setShowMap]             = useState(false);

  // C1: consume initialType + initialStatus on mount
  useEffect(() => {
    if (initialType) { setTypeFilter(initialType); onTypeConsumed?.(); }
    if (initialStatus) { setStatusFilter(initialStatus); onStatusConsumed?.(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    axios.get(`${API_URL}/rifugios`)
      .then(r => setRifugios(r.data.rifugios || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let list = rifugios;
    if (search)       list = list.filter(r => `${r.name} ${r.region}`.toLowerCase().includes(search.toLowerCase()));
    if (typeFilter)   list = list.filter(r => r.type === typeFilter);
    if (statusFilter) list = list.filter(r => {
      const s = r.current_status || r.status;
      // collapse opening_soon → closed for the user-facing filter
      const normalised = s === 'opening_soon' ? 'closed' : s;
      return normalised === statusFilter;
    });
    setFiltered(list);
  }, [rifugios, search, typeFilter, statusFilter]);

  const clearAll = () => { setSearch(''); setTypeFilter(''); setStatusFilter(''); };

  if (loading) return (
    <div className="rif-page">
      <div className="rif-state">{t('common.loading')}</div>
    </div>
  );

  const typeBanner = typeFilter ? TYPE_DESCRIPTIONS[typeFilter] : null;

  return (
    <div className="rif-page">

      {/* ── Header ── */}
      <div className="rif-header">
        <div className="container">
          <p className="rif-header__eyebrow">ALPINE SHELTERS</p>
          <h1 className="rif-header__title">Rifugios &amp; Malge</h1>
          <p className="rif-header__sub">
            Mountain huts, alpine dairies and bivouacs — your resting points in the wild.
          </p>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="rif-filters">
        <div className="container rif-bar">
          <div className="rif-search-wrap">
            <Search size={18} strokeWidth={2} className="rif-search-icon" aria-hidden="true" />
            <input
              className="rif-search"
              placeholder={t('rifugio.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="rif-search-clear" onClick={() => setSearch('')} aria-label={t('common.clear', 'Clear')}>
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Type */}
          <SegmentedControl
            size="sm"
            ariaLabel={t('rifugio.type')}
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: '',        label: t('rifugio.allTypes') },
              { value: 'rifugio', label: t('rifugio.typeRifugio') },
              { value: 'malga',   label: t('rifugio.typeMalga') },
              { value: 'bivacco', label: t('rifugio.typeBivacco') },
            ]}
          />

          {/* Status */}
          <SegmentedControl
            size="sm"
            ariaLabel={t('rifugio.status')}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '',       label: t('rifugio.anyStatus') },
              { value: 'open',   label: t('rifugio.statusOpen') },
              { value: 'closed', label: t('rifugio.statusClosed') },
            ]}
          />

          {/* List / Map mode switch */}
          <SegmentedControl
            size="sm"
            ariaLabel="View mode"
            value={showMap ? 'map' : 'list'}
            onChange={v => setShowMap(v === 'map')}
            options={[
              { value: 'list', label: t('rifugio.listView', 'List'), icon: List },
              { value: 'map',  label: t('rifugio.mapView', 'Map'),  icon: MapIcon },
            ]}
          />

          {(search || typeFilter || statusFilter) && (
            <button className="rif-clear" onClick={clearAll}>
              <X size={14} strokeWidth={2} /> {t('common.clear', 'Clear')}
            </button>
          )}
        </div>
      </div>

      {/* C2: Type description banner */}
      {typeBanner && (
        <div
          className="rif-type-banner"
          style={{ '--type-color': typeBanner.color }}
        >
          <div className="container">
            <p className="rif-type-banner__headline">{typeBanner.headline}</p>
            <p className="rif-type-banner__body">{typeBanner.body}</p>
          </div>
        </div>
      )}

      {/* ── Map view ── */}
      {showMap ? (
        <div className="container rif-map-container">
          <RifugioMap
            rifugios={filtered}
            onSelect={id => onNavigate('rifugio-detail', id)}
          />
        </div>
      ) : (
        /* ── Grid ── */
        <div className="container rif-body">
          <p className="rif-count">{filtered.length} {filtered.length === 1 ? 'place' : 'places'} found</p>

          {filtered.length === 0 ? (
            <div className="rif-empty">
              <Mountain size={48} strokeWidth={1.25} aria-hidden="true" />
              <p>{t('rifugio.noResults', 'No rifugios match your filters.')}</p>
              <button className="rif-clear" onClick={clearAll}>{t('common.clear', 'Clear')}</button>
            </div>
          ) : (
            <div className="rif-grid">
              {filtered.map(r => {
                const rawStatus = r.current_status || 'closed';
                const normStatus = rawStatus === 'opening_soon' ? 'closed' : rawStatus;
                const st = STATUS_CONFIG[normStatus] || STATUS_CONFIG.closed;
                const img = r.photos?.[0] ||
                  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&auto=format&fit=crop&q=70';
                return (
                  <article
                    key={r.id}
                    className="rif-card"
                    onClick={() => onNavigate('rifugio-detail', r.id)}
                  >
                    {/* Photo */}
                    <div className="rif-card__img-wrap">
                      <img src={img} alt={r.name} loading="lazy" className="rif-card__img" />
                      <div className="rif-card__img-overlay" />
                      <span className="rif-card__type-badge">{TYPE_LABELS[r.type] || r.type}</span>
                    </div>

                    {/* Body */}
                    <div className="rif-card__body">
                      <div className="rif-card__status-row">
                        <span className="rif-card__dot" style={{ background: st.dot }} />
                        <span className="rif-card__status-label" style={{ color: st.dot }}>{st.label}</span>
                        {r.opening_hours && (
                          <span className="rif-card__hours">{r.opening_hours}</span>
                        )}
                      </div>

                      <h3 className="rif-card__name">{r.name}</h3>

                      <div className="rif-card__meta">
                        <span className="rif-card__meta-alt"><Mountain size={13} strokeWidth={2} /> {r.altitude}m</span>
                        {formatSeason(r.opening_season) && (
                          <>
                            <span className="rif-card__meta-sep">·</span>
                            <span className="rif-card__meta-season">{formatSeason(r.opening_season)}</span>
                          </>
                        )}
                        <span className="rif-card__meta-sep">·</span>
                        <span className="rif-card__meta-region">{r.region}</span>
                      </div>

                      {r.facilities && (
                        <div className="rif-card__amenities">
                          {r.facilities.beds > 0  && <span className="rif-card__amenity"><BedDouble size={15} strokeWidth={2} /> {r.facilities.beds}</span>}
                          {r.facilities.meals     && <span className="rif-card__amenity" title="Meals"><UtensilsCrossed size={15} strokeWidth={2} /></span>}
                          {r.facilities.showers   && <span className="rif-card__amenity" title="Showers"><ShowerHead size={15} strokeWidth={2} /></span>}
                          {r.facilities.wifi      && <span className="rif-card__amenity" title="WiFi"><Wifi size={15} strokeWidth={2} /></span>}
                          {r.facilities.dogs      && <span className="rif-card__amenity" title="Dog-friendly"><Dog size={15} strokeWidth={2} /></span>}
                        </div>
                      )}

                      {/* C3: Josephine note */}
                      {r.josephine_note && (
                        <p className="rif-card__josephine-note">
                          {r.josephine_note.length > 80
                            ? r.josephine_note.slice(0, 80) + '…'
                            : r.josephine_note}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Rifugios;
