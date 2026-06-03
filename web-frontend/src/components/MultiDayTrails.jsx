import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Mountain, CalendarRange, Ruler, TrendingUp, Footprints, MapPin, ArrowRight } from 'lucide-react';
import './MultiDayTrails.css';

import { API_URL } from '../api';

const DIFFICULTY_COLORS = {
  easy:        { bg: 'rgba(74,222,128,0.15)',  text: '#4ade80' },
  moderate:    { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24' },
  challenging: { bg: 'rgba(249,115,22,0.15)',  text: '#f97316' },
  expert:      { bg: 'rgba(248,113,113,0.15)', text: '#f87171' },
};

function MultiDayTrails({ onNavigate }) {
  const { t } = useTranslation();
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => { fetchTrails(); }, []);

  const fetchTrails = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/multi-day-trails`);
      setTrails(res.data.trails || []);
    } catch (e) {
      console.error('Error fetching multi-day trails:', e);
    } finally {
      setLoading(false);
    }
  };

  const uniqueRegions = [...new Set(trails.map(t => t.region).filter(Boolean))].sort();

  const filtered = trails.filter(tr => {
    if (difficultyFilter && tr.difficulty !== difficultyFilter) return false;
    if (regionFilter && tr.region !== regionFilter) return false;
    if (typeFilter && tr.type !== typeFilter) return false;
    return true;
  });

  const hasFilters = difficultyFilter || regionFilter || typeFilter;

  const clearFilters = () => {
    setDifficultyFilter('');
    setRegionFilter('');
    setTypeFilter('');
  };

  const difficultyLabel = { easy: 'Easy', moderate: 'Moderate', challenging: 'Challenging', expert: 'Expert' };
  const typeLabel = { 'point-to-point': 'Point to Point', loop: 'Loop', 'out-and-back': 'Out & Back' };

  if (loading) {
    return (
      <div className="mdt-loading">
        <div className="mdt-spinner" />
        <span>Loading treks…</span>
      </div>
    );
  }

  return (
    <div className="mdt-page">
      <div className="mdt-hero">
        <div className="mdt-hero__overlay" />
        <div className="mdt-hero__content">
          <p className="mdt-hero__eyebrow">Multi-Day Journeys</p>
          <h1 className="mdt-hero__title">Hut-to-Hut Treks</h1>
          <p className="mdt-hero__sub">Epic alpine adventures connecting the most beautiful rifugios in the Dolomites</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mdt-filters">
        <div className="mdt-filter-group">
          <span className="mdt-filter-label">Difficulty</span>
          {['easy', 'moderate', 'challenging', 'expert'].map(d => (
            <button
              key={d}
              className={`mdt-filter-pill ${difficultyFilter === d ? 'active' : ''}`}
              onClick={() => setDifficultyFilter(difficultyFilter === d ? '' : d)}
            >
              {difficultyLabel[d]}
            </button>
          ))}
        </div>

        {uniqueRegions.length > 1 && (
          <>
            <div className="mdt-filter-divider" />
            <div className="mdt-filter-group">
              <span className="mdt-filter-label">Region</span>
              <select
                className="mdt-filter-select"
                value={regionFilter}
                onChange={e => setRegionFilter(e.target.value)}
              >
                <option value="">All regions</option>
                {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="mdt-filter-divider" />
        <div className="mdt-filter-group">
          <span className="mdt-filter-label">Type</span>
          <select
            className="mdt-filter-select"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            <option value="point-to-point">Point to Point</option>
            <option value="loop">Loop</option>
            <option value="out-and-back">Out & Back</option>
          </select>
        </div>

        {hasFilters && (
          <button className="mdt-filter-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="mdt-main">
        <div className="mdt-results-bar">
          <span className="mdt-results-count">
            {filtered.length} {filtered.length === 1 ? 'trek' : 'treks'} available
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="mdt-empty">
            <div className="mdt-empty__icon"><Mountain size={48} strokeWidth={1.25} /></div>
            <h3>No treks match your filters</h3>
            <p>Try adjusting the difficulty, region or type</p>
            <button className="mdt-empty__btn" onClick={clearFilters}>Reset filters</button>
          </div>
        ) : (
          <div className="mdt-grid">
            {filtered.map(trail => {
              const dc = DIFFICULTY_COLORS[trail.difficulty] || { bg: 'rgba(255,255,255,0.08)', text: 'rgba(240,236,230,0.7)' };
              return (
                <div
                  key={trail.id}
                  className="mdt-card"
                  onClick={() => onNavigate('multiday-detail', trail.id)}
                >
                  <div className="mdt-card__img">
                    <img src={trail.hero_image || trail.thumbnail} alt={trail.name} loading="lazy" />
                    <div className="mdt-card__img-overlay" />
                    <span className="mdt-card__type">
                      {typeLabel[trail.type] || trail.type}
                    </span>
                    <span
                      className="mdt-card__difficulty"
                      style={{ background: dc.bg, color: dc.text }}
                    >
                      {difficultyLabel[trail.difficulty] || trail.difficulty}
                    </span>
                  </div>

                  <div className="mdt-card__body">
                    <h3 className="mdt-card__title">{trail.name}</h3>

                    <div className="mdt-card__stats">
                      <span className="mdt-card__stat">
                        <CalendarRange size={14} strokeWidth={2} /> {trail.duration_days} days · {trail.duration_nights} nights
                      </span>
                      <span className="mdt-card__stat">
                        <Ruler size={14} strokeWidth={2} /> {trail.total_distance_km} km
                      </span>
                      <span className="mdt-card__stat">
                        <TrendingUp size={14} strokeWidth={2} /> {trail.total_elevation_gain_m?.toLocaleString()} m
                      </span>
                      <span className="mdt-card__stat">
                        <Footprints size={14} strokeWidth={2} /> {trail.stages?.length || 0} stages
                      </span>
                    </div>

                    <p className="mdt-card__desc">
                      {trail.description?.substring(0, 130)}{trail.description?.length > 130 ? '…' : ''}
                    </p>

                    <div className="mdt-card__footer">
                      <span className="mdt-card__region"><MapPin size={14} strokeWidth={2} /> {trail.region}</span>
                      <span className="mdt-card__cta">Explore trek <ArrowRight size={15} strokeWidth={2} /></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MultiDayTrails;
