import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './Rifugios.css';

const API_URL = import.meta.env.PROD
  ? '/api'
  : `${window.location.protocol}//${window.location.hostname}:8000/api`;

const STATUS_CONFIG = {
  open:         { dot: '#4ade80', label: 'Open'         },
  closed:       { dot: '#ef4444', label: 'Closed'       },
  opening_soon: { dot: '#c9a84c', label: 'Opening soon' },
  seasonal:     { dot: '#6b7280', label: 'Seasonal'     },
};

const TYPE_LABELS = { rifugio: 'Rifugio', malga: 'Malga', bivacco: 'Bivacco' };

function Rifugios({ onNavigate }) {
  const { t } = useTranslation();
  const [rifugios, setRifugios]           = useState([]);
  const [filtered, setFiltered]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [typeFilter, setTypeFilter]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');

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
    if (statusFilter) list = list.filter(r => r.status === statusFilter);
    setFiltered(list);
  }, [rifugios, search, typeFilter, statusFilter]);

  const clearAll = () => { setSearch(''); setTypeFilter(''); setStatusFilter(''); };

  if (loading) return (
    <div className="rif-page">
      <div className="rif-state">{t('common.loading')}</div>
    </div>
  );

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
        <div className="container rif-filters__inner">
          <div className="rif-search-wrap">
            <svg className="rif-search-icon" width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <input
              className="rif-search"
              placeholder="Search rifugios…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="rif-pills">
            {['', 'rifugio', 'malga', 'bivacco'].map(v => (
              <button
                key={v}
                className={`rif-pill ${typeFilter === v ? 'active' : ''}`}
                onClick={() => setTypeFilter(v)}
              >
                {v ? TYPE_LABELS[v] : 'All types'}
              </button>
            ))}
          </div>

          <div className="rif-pills">
            {['', 'open', 'opening_soon', 'closed'].map(v => (
              <button
                key={v}
                className={`rif-pill ${statusFilter === v ? 'active' : ''}`}
                onClick={() => setStatusFilter(v)}
              >
                {v ? STATUS_CONFIG[v]?.label : 'Any status'}
              </button>
            ))}
          </div>

          {(search || typeFilter || statusFilter) && (
            <button className="rif-clear" onClick={clearAll}>Clear ×</button>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="container rif-body">
        <p className="rif-count">{filtered.length} {filtered.length === 1 ? 'place' : 'places'} found</p>

        {filtered.length === 0 ? (
          <div className="rif-empty">
            <p>No rifugios match your filters.</p>
            <button className="rif-clear" onClick={clearAll}>Clear filters</button>
          </div>
        ) : (
          <div className="rif-grid">
            {filtered.map(r => {
              const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.seasonal;
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
                      <span className="rif-card__status-label">{st.label}</span>
                      {r.opening_hours && (
                        <span className="rif-card__hours">{r.opening_hours}</span>
                      )}
                    </div>

                    <h3 className="rif-card__name">{r.name}</h3>

                    <div className="rif-card__meta">
                      <span>⛰ {r.altitude}m</span>
                      <span>·</span>
                      <span>{r.region}</span>
                    </div>

                    {r.facilities && (
                      <div className="rif-card__amenities">
                        {r.facilities.beds > 0  && <span className="rif-card__amenity">🛏 {r.facilities.beds}</span>}
                        {r.facilities.meals     && <span className="rif-card__amenity">🍽</span>}
                        {r.facilities.showers   && <span className="rif-card__amenity">🚿</span>}
                        {r.facilities.wifi      && <span className="rif-card__amenity">📶</span>}
                        {r.facilities.dogs      && <span className="rif-card__amenity">🐕</span>}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Rifugios;
