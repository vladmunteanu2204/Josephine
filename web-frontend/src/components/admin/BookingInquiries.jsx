import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { RotateCw, X, AlertTriangle, Trash2 } from 'lucide-react';
import './BookingInquiries.css';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  confirmed: { label: 'Confirmed', color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  declined:  { label: 'Declined',  color: '#f87171', bg: 'rgba(239,68,68,0.12)'   },
};

const NEXT_STATUS = { pending: 'confirmed', confirmed: 'declined', declined: 'pending' };

function StatusBadge({ status, onClick }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <button
      className="bk-status-badge"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color + '55' }}
      onClick={onClick}
      title="Click to cycle status"
    >
      {cfg.label}
    </button>
  );
}

export default function BookingInquiries({ adminPassword }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [filters, setFilters]     = useState({ status: '', date_from: '', date_to: '' });
  const [selected, setSelected]   = useState(null);   // detail modal
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status)    params.status    = filters.status;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to)   params.date_to   = filters.date_to;

      const res = await axios.get('/api/admin/booking-inquiries', { params });
      setInquiries(res.data.inquiries || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [adminPassword, filters]);

  useEffect(() => { load(); }, [load]);

  const cycleStatus = async (inq) => {
    const next = NEXT_STATUS[inq.status] || 'pending';
    try {
      await axios.put(`/api/admin/booking-inquiries/${inq.id}`, { status: next });
      showToast(`Marked as ${next}`);
      load();
    } catch (e) {
      showToast(e.response?.data?.error || e.message, 'error');
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await axios.put(`/api/admin/booking-inquiries/${selected.id}`, { admin_notes: notes });
      showToast('Notes saved');
      setSelected(prev => ({ ...prev, admin_notes: notes }));
      load();
    } catch (e) {
      showToast(e.response?.data?.error || e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteInquiry = async (id) => {
    if (!confirm('Delete this booking inquiry?')) return;
    try {
      await axios.delete(`/api/admin/booking-inquiries/${id}`);
      showToast('Inquiry deleted');
      if (selected?.id === id) setSelected(null);
      load();
    } catch (e) {
      showToast(e.response?.data?.error || e.message, 'error');
    }
  };

  const openDetail = (inq) => {
    setSelected(inq);
    setNotes(inq.admin_notes || '');
  };

  const counts = {
    all:       inquiries.length,
    pending:   inquiries.filter(i => i.status === 'pending').length,
    confirmed: inquiries.filter(i => i.status === 'confirmed').length,
    declined:  inquiries.filter(i => i.status === 'declined').length,
  };

  return (
    <div className="bk-page">

      {/* Toast */}
      {toast && (
        <div className={`bk-toast bk-toast--${toast.type}`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="bk-header">
        <div>
          <h2 className="bk-title">📋 Booking Inquiries</h2>
          <p className="bk-sub">Rifugio booking requests from guests</p>
        </div>
        <button className="bk-refresh" onClick={load}><RotateCw size={15} strokeWidth={2} /> Refresh</button>
      </div>

      {/* Status quick-filter pills */}
      <div className="bk-pills">
        {[['', 'All', counts.all], ['pending','Pending',counts.pending], ['confirmed','Confirmed',counts.confirmed], ['declined','Declined',counts.declined]].map(([val, label, count]) => (
          <button
            key={val}
            className={`bk-pill ${filters.status === val ? 'bk-pill--active' : ''}`}
            onClick={() => setFilters(f => ({ ...f, status: val }))}
          >
            {label} <span className="bk-pill-count">{count}</span>
          </button>
        ))}
      </div>

      {/* Date filters */}
      <div className="bk-date-filters">
        <label>Check-in from <input type="date" value={filters.date_from} onChange={e => setFilters(f=>({...f,date_from:e.target.value}))} className="bk-date-input" /></label>
        <label>to <input type="date" value={filters.date_to} onChange={e => setFilters(f=>({...f,date_to:e.target.value}))} className="bk-date-input" /></label>
        {(filters.date_from || filters.date_to) && (
          <button className="bk-clear-dates" onClick={() => setFilters(f=>({...f,date_from:'',date_to:''}))}><X size={14} strokeWidth={2} /> Clear dates</button>
        )}
      </div>

      {loading && <div className="bk-loading">Loading…</div>}
      {error   && <div className="bk-error"><AlertTriangle size={15} strokeWidth={2} /> {error}</div>}

      {!loading && !error && inquiries.length === 0 && (
        <div className="bk-empty">
          <p>No booking inquiries {filters.status ? `with status "${filters.status}"` : ''} found.</p>
        </div>
      )}

      {/* Table */}
      {!loading && inquiries.length > 0 && (
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Rifugio</th>
                <th>Guest</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Guests</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map(inq => (
                <tr key={inq.id} className="bk-row" onClick={() => openDetail(inq)}>
                  <td className="bk-id">{inq.id}</td>
                  <td className="bk-rifugio">
                    {inq.rifugio_name}
                    {inq.delivery_status && (
                      <span className={`bk-deliv bk-deliv--${inq.delivery_status}`}>
                        {inq.delivery_status === 'emailed' ? '✉ auto-sent'
                          : inq.delivery_status === 'failed' ? '⚠ send failed'
                          : 'manual'}
                      </span>
                    )}
                  </td>
                  <td className="bk-guest">
                    <span>{inq.user_name}</span>
                    <small>{inq.user_email}</small>
                  </td>
                  <td>{inq.check_in}</td>
                  <td>{inq.check_out}</td>
                  <td>{inq.adults}{inq.children > 0 ? ` + ${inq.children}c` : ''}</td>
                  <td>{inq.created_at ? new Date(inq.created_at).toLocaleDateString() : '—'}</td>
                  <td onClick={e => { e.stopPropagation(); cycleStatus(inq); }}>
                    <StatusBadge status={inq.status} />
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="bk-btn-detail" onClick={() => openDetail(inq)}>Details</button>
                    <button className="bk-btn-delete" onClick={() => deleteInquiry(inq.id)} aria-label="Delete"><Trash2 size={15} strokeWidth={2} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="bk-modal-overlay" onClick={() => setSelected(null)}>
          <div className="bk-modal" onClick={e => e.stopPropagation()}>
            <div className="bk-modal-header">
              <h3>Booking #{selected.id}</h3>
              <button className="bk-modal-close" onClick={() => setSelected(null)} aria-label="Close"><X size={18} strokeWidth={2} /></button>
            </div>

            <div className="bk-modal-body">
              <div className="bk-detail-grid">
                <div className="bk-detail-row"><span>Rifugio</span><strong>{selected.rifugio_name}</strong></div>
                <div className="bk-detail-row"><span>Guest</span><strong>{selected.user_name}</strong></div>
                <div className="bk-detail-row"><span>Email</span><a href={`mailto:${selected.user_email}`}>{selected.user_email}</a></div>
                {selected.user_phone && <div className="bk-detail-row"><span>Phone</span><strong>{selected.user_phone}</strong></div>}
                <div className="bk-detail-row"><span>Check-in</span><strong>{selected.check_in}</strong></div>
                <div className="bk-detail-row"><span>Check-out</span><strong>{selected.check_out}</strong></div>
                <div className="bk-detail-row"><span>Adults</span><strong>{selected.adults}</strong></div>
                <div className="bk-detail-row"><span>Children</span><strong>{selected.children || 0}</strong></div>
                <div className="bk-detail-row"><span>Meal plan</span><strong>{selected.meal_preference || '—'}</strong></div>
                <div className="bk-detail-row"><span>Dogs</span><strong>{selected.dogs ? '🐕 Yes' : 'No'}</strong></div>
                <div className="bk-detail-row"><span>Contact via</span><strong>{selected.contact_method || 'email'}</strong></div>
                <div className="bk-detail-row"><span>Status</span>
                  <StatusBadge status={selected.status} onClick={() => { cycleStatus(selected); setSelected(prev=>({...prev,status:NEXT_STATUS[prev.status]||'pending'})); }} />
                </div>
              </div>

              {selected.special_requests && (
                <div className="bk-special">
                  <span>Special requests</span>
                  <p>{selected.special_requests}</p>
                </div>
              )}

              <div className="bk-notes-section">
                <label>Admin notes</label>
                <textarea
                  className="bk-notes-input"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Internal notes (not shown to guest)…"
                />
                <button className="bk-btn-save" onClick={saveNotes} disabled={saving}>
                  {saving ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
