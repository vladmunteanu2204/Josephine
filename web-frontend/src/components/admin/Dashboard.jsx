import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const HEALTH_COLOR = (s) => s >= 80 ? '#4ade80' : s >= 50 ? '#fbbf24' : '#ef4444';
const DIFF_COLOR   = { easy: '#4ade80', medium: '#fbbf24', hard: '#ef4444' };

function KpiCard({ icon, label, value, sub, accent }) {
  return (
    <div className="dash-kpi" style={{ borderColor: accent || 'rgba(201,168,76,0.2)' }}>
      <div className="dash-kpi__icon">{icon}</div>
      <div className="dash-kpi__body">
        <div className="dash-kpi__value" style={{ color: accent || '#c9a84c' }}>{value}</div>
        <div className="dash-kpi__label">{label}</div>
        {sub && <div className="dash-kpi__sub">{sub}</div>}
      </div>
    </div>
  );
}

function HealthBar({ score }) {
  return (
    <div className="dash-health-bar">
      <div
        className="dash-health-bar__fill"
        style={{ width: `${score}%`, background: HEALTH_COLOR(score) }}
      />
    </div>
  );
}

function Check({ ok }) {
  return <span className={`dash-check ${ok ? 'dash-check--ok' : 'dash-check--no'}`}>{ok ? '✓' : '✗'}</span>;
}

export default function Dashboard({ adminPassword, onNavigateToTrail }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/dashboard', {
        headers: { 'X-Admin-Password': adminPassword }
      });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="dash-loading"><div className="dash-spinner" />Loading command centre…</div>;
  if (error)   return <div className="dash-error">⚠ {error} <button onClick={load}>Retry</button></div>;
  if (!data)   return null;

  const { kpis, trail_matrix, recent_inquiries, recent_hikes, recent_plans, current_month } = data;

  return (
    <div className="dashboard">

      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h2 className="dash-title">🎯 Command Centre</h2>
          <p className="dash-subtitle">Live overview · {new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}</p>
        </div>
        <button className="dash-refresh" onClick={load}>↻ Refresh</button>
      </div>

      {/* ── KPI row ── */}
      <div className="dash-kpis">
        <KpiCard icon="🗺️" label="Trails"           value={kpis.trails}           accent="#c9a84c" />
        <KpiCard icon="🏠" label="Rifugios"          value={kpis.rifugios}          accent="#60a5fa" />
        <KpiCard icon="📋" label="Pending Bookings"  value={kpis.pending_bookings}
                 accent={kpis.pending_bookings > 0 ? '#fbbf24' : '#4ade80'}
                 sub={kpis.pending_bookings > 0 ? 'Needs attention' : 'All clear'} />
        <KpiCard icon="📅" label="Hike Plans"        value={kpis.total_plans}       accent="#a78bfa" />
        <KpiCard icon="👁️" label="Trail Views"        value={kpis.total_views}       accent="#34d399" />
        <KpiCard icon="⭐" label="Saves"             value={kpis.total_saves}       accent="#f472b6" />
      </div>

      {/* ── Trail health matrix ── */}
      <div className="dash-section">
        <h3 className="dash-section-title">Trail Health Matrix <span className="dash-month-badge">{current_month}</span></h3>
        <div className="dash-matrix-wrap">
          <table className="dash-matrix">
            <thead>
              <tr>
                <th>Trail</th>
                <th>Diff</th>
                <th title="GPX coordinates loaded">GPS</th>
                <th title="Wallpaper / hero image">Photo</th>
                <th title="Description ≥ 50 chars">Desc</th>
                <th title="Josephine's note (EN)">Note</th>
                <th title="Tags / interests">Tags</th>
                <th title="Best season set">Season</th>
                <th title="family_friendly set">Family</th>
                <th>In season</th>
                <th>Views</th>
                <th>Saves</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {trail_matrix.map(t => (
                <tr
                  key={t.id}
                  className="dash-matrix-row"
                  onClick={() => onNavigateToTrail?.(t.id)}
                  title={`Click to edit ${t.name}`}
                >
                  <td className="dash-matrix-name">{t.name}</td>
                  <td><span className="dash-diff-badge" style={{ background: DIFF_COLOR[t.difficulty] || '#6b7280' }}>{t.difficulty}</span></td>
                  <td><Check ok={t.checks.has_coordinates} /></td>
                  <td><Check ok={t.checks.has_wallpaper} /></td>
                  <td><Check ok={t.checks.has_description} /></td>
                  <td><Check ok={t.checks.has_note} /></td>
                  <td><Check ok={t.checks.has_tags} /></td>
                  <td><Check ok={t.checks.has_season} /></td>
                  <td><Check ok={t.checks.family_set} /></td>
                  <td>
                    <span className={`dash-season-pill ${t.in_season ? 'dash-season-pill--on' : 'dash-season-pill--off'}`}>
                      {t.in_season ? '✓ In season' : '✗ Off season'}
                    </span>
                  </td>
                  <td className="dash-num">{t.views}</td>
                  <td className="dash-num">{t.saves}</td>
                  <td className="dash-health-cell">
                    <HealthBar score={t.health_score} />
                    <span style={{ color: HEALTH_COLOR(t.health_score), fontSize: 11 }}>{t.health_score}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent activity row ── */}
      <div className="dash-activity">

        {/* Pending bookings */}
        <div className="dash-activity-card">
          <h4 className="dash-activity-title">📋 Recent Bookings</h4>
          {recent_inquiries.length === 0 ? (
            <p className="dash-empty">No bookings yet</p>
          ) : recent_inquiries.map(inq => (
            <div key={inq.id} className="dash-activity-row">
              <span className={`dash-status-dot dash-status-dot--${inq.status}`} />
              <div className="dash-activity-info">
                <strong>{inq.rifugio_name}</strong>
                <span>{inq.user_name} · {inq.check_in}</span>
              </div>
              <span className={`dash-badge dash-badge--${inq.status}`}>{inq.status}</span>
            </div>
          ))}
        </div>

        {/* Recent hikes */}
        <div className="dash-activity-card">
          <h4 className="dash-activity-title">🥾 Recent Hikes</h4>
          {recent_hikes.length === 0 ? (
            <p className="dash-empty">No completed hikes yet</p>
          ) : recent_hikes.map(hike => (
            <div key={hike.id} className="dash-activity-row">
              <span className="dash-status-dot dash-status-dot--open" />
              <div className="dash-activity-info">
                <strong>{hike.trail_name || hike.trail_id}</strong>
                <span>{hike.stats?.distance_km?.toFixed(1)} km · {hike.stats?.elevation_gain_m?.toFixed(0)} m ↑</span>
              </div>
            </div>
          ))}
        </div>

        {/* Recent plans */}
        <div className="dash-activity-card">
          <h4 className="dash-activity-title">📅 Recent Plans</h4>
          {recent_plans.length === 0 ? (
            <p className="dash-empty">No hike plans yet</p>
          ) : recent_plans.map(plan => (
            <div key={plan.id} className="dash-activity-row">
              <span className="dash-status-dot dash-status-dot--open" />
              <div className="dash-activity-info">
                <strong>{plan.user_email || 'Guest'}</strong>
                <span>{plan.startDate || 'No date'}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
