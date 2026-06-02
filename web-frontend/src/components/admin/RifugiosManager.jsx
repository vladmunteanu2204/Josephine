import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Hotel, Plus, Check, Pencil, Trash2, Undo2, X, MessageSquare, BedDouble } from 'lucide-react';
import './RifugiosManager.css';

const TYPE_LABELS = { rifugio: 'Rifugio', malga: 'Malga', bivacco: 'Bivacco' };
const STATUS_COLORS = { open: '#4ade80', closed: '#ef4444', opening_soon: '#fbbf24' };

const BLANK_FORM = {
  id: '', name: '', type: 'rifugio', region: 'South Tyrol', altitude: 0,
  coordinates: { lat: 0, lng: 0 },
  contact: { phone: '', email: '', website: '', whatsapp: '' },
  facilities: { beds: 0, showers: false, meals: false, wifi: false, dogs: false, payment_methods: [] },
  description: '', access_info: '',
  opening_season: { start_date: '', end_date: '' },
  prices: { overnight: 0, breakfast: 0, dinner: 0, half_board: 0 },
  photos: [], status: 'seasonal', special_closures: [],
  josephine_note: '', highlights: [],
  booking_email_verified: false,
};

export default function RifugiosManager({ adminPassword }) {
  const [rifugios, setRifugios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null);   // null | 'new' | rifugio id
  const [form, setForm]         = useState(BLANK_FORM);
  const [photosInput, setPhotosInput] = useState('');
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/rifugios', { params: { _admin: 1 } });
      setRifugios(res.data.rifugios || []);
    } catch (e) {
      showToast(e.response?.data?.error || e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const publish = async (id, newStatus) => {
    try {
      await axios.post(`/api/admin/rifugios/${id}/publish`,
        { status: newStatus },
        { headers: { 'X-Admin-Password': adminPassword } }
      );
      showToast(newStatus === 'published' ? 'Rifugio published' : 'Moved to draft');
      load();
    } catch (e) {
      showToast(e.response?.data?.error || e.message, 'error');
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ ...BLANK_FORM, id: `rif-${Date.now()}` });
    setPhotosInput('');
    setEditing('new');
  };

  const openEdit = (rif) => {
    setForm({ ...BLANK_FORM, ...rif,
      coordinates: rif.coordinates || { lat: 0, lng: 0 },
      contact: { ...BLANK_FORM.contact, ...(rif.contact || {}) },
      facilities: { ...BLANK_FORM.facilities, ...(rif.facilities || {}) },
      opening_season: { ...BLANK_FORM.opening_season, ...(rif.opening_season || {}) },
      prices: { ...BLANK_FORM.prices, ...(rif.prices || {}) },
      josephine_note: rif.josephine_note || '',
      highlights: rif.highlights || [],
    });
    setPhotosInput((rif.photos || []).join('\n'));
    setEditing(rif.id);
  };

  const save = async () => {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        photos: photosInput.split('\n').map(s => s.trim()).filter(Boolean),
      };
      if (editing === 'new') {
        await axios.post('/api/admin/rifugios', payload, { headers: { 'X-Admin-Password': adminPassword } });
        showToast('Rifugio created');
      } else {
        await axios.put(`/api/admin/rifugios/${editing}`, payload, { headers: { 'X-Admin-Password': adminPassword } });
        showToast('Rifugio updated');
      }
      setEditing(null);
      load();
    } catch (e) {
      showToast(e.response?.data?.error || e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!confirm('Delete this rifugio? This cannot be undone.')) return;
    try {
      await axios.delete(`/api/admin/rifugios/${id}`, { headers: { 'X-Admin-Password': adminPassword } });
      showToast('Rifugio deleted');
      load();
    } catch (e) {
      showToast(e.response?.data?.error || e.message, 'error');
    }
  };

  // helpers
  const set = (path, val) => setForm(prev => {
    const parts = path.split('.');
    if (parts.length === 1) return { ...prev, [path]: val };
    return { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: val } };
  });

  const filtered = rifugios.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.region?.toLowerCase().includes(q);
    const matchType   = !typeFilter || r.type === typeFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'draft' ? r.status === 'draft' : (r.status || 'published') === 'published');
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="rif-mgr">

      {toast && <div className={`rif-toast rif-toast--${toast.type}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="rif-mgr-header">
        <div>
          <h2 className="rif-mgr-title"><Hotel size={20} strokeWidth={2} /> Rifugios Manager</h2>
          <p className="rif-mgr-sub">{rifugios.length} locations · manage opening seasons, facilities, prices</p>
        </div>
        <button className="rif-mgr-btn-new" onClick={openNew}><Plus size={16} strokeWidth={2} /> Add Rifugio</button>
      </div>

      {/* Filters */}
      <div className="rif-mgr-filters">
        <input className="rif-mgr-search" placeholder="Search by name or region…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="rif-mgr-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="rifugio">Rifugio</option>
          <option value="malga">Malga</option>
          <option value="bivacco">Bivacco</option>
        </select>
      </div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: `All (${rifugios.length})` },
          { key: 'published', label: `✓ Published (${rifugios.filter(r => (r.status || 'published') === 'published').length})` },
          { key: 'draft', label: `📝 Drafts (${rifugios.filter(r => r.status === 'draft').length})` },
        ].map(p => (
          <button key={p.key} onClick={() => setStatusFilter(p.key)} style={{
            padding: '6px 14px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer',
            background: statusFilter === p.key ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
            border: statusFilter === p.key ? '1px solid rgba(201,168,76,0.5)' : '1px solid rgba(255,255,255,0.1)',
            color: statusFilter === p.key ? '#c9a84c' : 'rgba(240,236,230,0.6)',
          }}>{p.label}</button>
        ))}
      </div>

      {loading && <div className="rif-mgr-loading">Loading…</div>}

      {/* Grid */}
      {!loading && (
        <div className="rif-mgr-grid">
          {filtered.map(rif => (
            <div key={rif.id} className="rif-mgr-card">
              {rif.photos?.[0] && (
                <div className="rif-mgr-card__photo-wrap">
                  <img src={rif.photos[0]} alt={rif.name} className="rif-mgr-card__photo" />
                  <div className="rif-mgr-card__photo-overlay" />
                </div>
              )}
              <div className="rif-mgr-card__body">
                <div className="rif-mgr-card__top">
                  <span className="rif-mgr-type-badge">{TYPE_LABELS[rif.type] || rif.type}</span>
                  <span
                    className="rif-mgr-status-dot"
                    style={{ background: STATUS_COLORS[rif.current_status] || '#6b7280' }}
                    title={rif.current_status}
                  />
                </div>
                <h4 className="rif-mgr-card__name">
                  {rif.name}
                  {rif.booking_email_verified && (
                    <span className="rif-verify-badge" title="Booking email verified"><Check size={11} strokeWidth={3} /></span>
                  )}
                </h4>
                <p className="rif-mgr-card__meta">{rif.region} · {rif.altitude}m</p>
                {rif.opening_season?.start_date && (
                  <p className="rif-mgr-card__season">
                    Season: {rif.opening_season.start_date} – {rif.opening_season.end_date}
                  </p>
                )}
                {rif.facilities?.beds > 0 && (
                  <p className="rif-mgr-card__beds"><BedDouble size={14} strokeWidth={2} /> {rif.facilities.beds} beds</p>
                )}
                <div className="rif-mgr-card__actions">
                  {rif.status === 'draft' ? (
                    <button
                      style={{ flex: 1, padding: '7px 0', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '12px', cursor: 'pointer' }}
                      onClick={() => publish(rif.id, 'published')}
                    ><Check size={13} strokeWidth={2.5} /> Publish</button>
                  ) : (
                    <button className="rif-btn-edit" onClick={() => openEdit(rif)}><Pencil size={13} strokeWidth={2} /> Edit</button>
                  )}
                  {rif.status !== 'draft' && (
                    <button
                      style={{ padding: '7px 10px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '8px', color: '#fbbf24', fontSize: '12px', cursor: 'pointer' }}
                      onClick={() => publish(rif.id, 'draft')}
                      aria-label="Unpublish"
                    ><Undo2 size={13} strokeWidth={2} /></button>
                  )}
                  {rif.status === 'draft' && (
                    <button className="rif-btn-edit" style={{ marginLeft: '4px' }} onClick={() => openEdit(rif)} aria-label="Edit"><Pencil size={13} strokeWidth={2} /></button>
                  )}
                  <button className="rif-btn-del"  onClick={() => del(rif.id)} aria-label="Delete"><Trash2 size={13} strokeWidth={2} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Create drawer */}
      {editing !== null && (
        <div className="rif-drawer-overlay" onClick={() => setEditing(null)}>
          <div className="rif-drawer" onClick={e => e.stopPropagation()}>
            <div className="rif-drawer-header">
              <h3>{editing === 'new' ? 'New Rifugio' : `Editing: ${form.name}`}</h3>
              <button className="rif-drawer-close" onClick={() => setEditing(null)} aria-label="Close"><X size={18} strokeWidth={2} /></button>
            </div>

            <div className="rif-drawer-body">

              {/* Basic info */}
              <fieldset className="rif-fieldset">
                <legend>Basic Info</legend>
                <div className="rif-form-grid">
                  <div className="rif-fg">
                    <label>Name *</label>
                    <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Rifugio Bolzano" />
                  </div>
                  <div className="rif-fg">
                    <label>ID</label>
                    <input value={form.id} onChange={e => set('id', e.target.value)} disabled={editing !== 'new'} />
                  </div>
                  <div className="rif-fg">
                    <label>Type</label>
                    <select value={form.type} onChange={e => set('type', e.target.value)}>
                      <option value="rifugio">Rifugio</option>
                      <option value="malga">Malga</option>
                      <option value="bivacco">Bivacco</option>
                    </select>
                  </div>
                  <div className="rif-fg">
                    <label>Region</label>
                    <input value={form.region} onChange={e => set('region', e.target.value)} />
                  </div>
                  <div className="rif-fg">
                    <label>Altitude (m)</label>
                    <input type="number" value={form.altitude} onChange={e => set('altitude', +e.target.value)} />
                  </div>
                  <div className="rif-fg">
                    <label>Status</label>
                    <select value={form.status} onChange={e => set('status', e.target.value)}>
                      <option value="seasonal">Seasonal</option>
                      <option value="open">Always open</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="rif-fg rif-fg--full">
                    <label>Description</label>
                    <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
                  </div>
                  <div className="rif-fg rif-fg--full">
                    <label>Access info</label>
                    <textarea rows={2} value={form.access_info} onChange={e => set('access_info', e.target.value)} />
                  </div>
                </div>
              </fieldset>

              {/* Coordinates */}
              <fieldset className="rif-fieldset">
                <legend>Coordinates</legend>
                <div className="rif-form-grid">
                  <div className="rif-fg">
                    <label>Latitude</label>
                    <input type="number" step="0.000001" value={form.coordinates.lat} onChange={e => set('coordinates', { ...form.coordinates, lat: +e.target.value })} />
                  </div>
                  <div className="rif-fg">
                    <label>Longitude</label>
                    <input type="number" step="0.000001" value={form.coordinates.lng} onChange={e => set('coordinates', { ...form.coordinates, lng: +e.target.value })} />
                  </div>
                </div>
              </fieldset>

              {/* Opening season */}
              <fieldset className="rif-fieldset">
                <legend>Opening Season</legend>
                <div className="rif-form-grid">
                  <div className="rif-fg">
                    <label>Opens</label>
                    <input type="date" value={form.opening_season.start_date} onChange={e => set('opening_season', { ...form.opening_season, start_date: e.target.value })} />
                  </div>
                  <div className="rif-fg">
                    <label>Closes</label>
                    <input type="date" value={form.opening_season.end_date} onChange={e => set('opening_season', { ...form.opening_season, end_date: e.target.value })} />
                  </div>
                </div>
              </fieldset>

              {/* Prices */}
              <fieldset className="rif-fieldset">
                <legend>Prices (€)</legend>
                <div className="rif-form-grid">
                  {['overnight','breakfast','dinner','half_board'].map(k => (
                    <div key={k} className="rif-fg">
                      <label>{k.replace('_',' ')}</label>
                      <input type="number" value={form.prices[k]} onChange={e => set('prices', { ...form.prices, [k]: +e.target.value })} />
                    </div>
                  ))}
                </div>
              </fieldset>

              {/* Contact */}
              <fieldset className="rif-fieldset">
                <legend>Contact</legend>
                <div className="rif-form-grid">
                  {['phone','email','website','whatsapp'].map(k => (
                    <div key={k} className="rif-fg">
                      <label>{k.charAt(0).toUpperCase() + k.slice(1)}</label>
                      <input value={form.contact[k]} onChange={e => set('contact', { ...form.contact, [k]: e.target.value })} />
                    </div>
                  ))}
                </div>
                <label className="rif-verify-toggle" title="Only verified-email huts receive auto-sent booking inquiries">
                  <input
                    type="checkbox"
                    checked={!!form.booking_email_verified}
                    onChange={e => setForm(f => ({ ...f, booking_email_verified: e.target.checked }))}
                  />
                  <Check size={14} strokeWidth={2.5} /> Booking email verified (enables auto-send)
                </label>
              </fieldset>

              {/* Facilities */}
              <fieldset className="rif-fieldset">
                <legend>Facilities</legend>
                <div className="rif-form-grid">
                  <div className="rif-fg">
                    <label>Beds</label>
                    <input type="number" value={form.facilities.beds} onChange={e => set('facilities', { ...form.facilities, beds: +e.target.value })} />
                  </div>
                  {['showers','meals','wifi','dogs'].map(k => (
                    <div key={k} className="rif-fg rif-fg--check">
                      <label>
                        <input type="checkbox" checked={form.facilities[k]} onChange={e => set('facilities', { ...form.facilities, [k]: e.target.checked })} />
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>

              {/* Josephine's Tip */}
              <fieldset className="rif-fieldset" style={{ borderColor: 'rgba(201,168,76,0.3)' }}>
                <legend style={{ color: '#c9a84c', display: 'inline-flex', alignItems: 'center', gap: 6 }}><MessageSquare size={15} strokeWidth={2} /> Josephine's Insider Tip</legend>
                <p style={{ fontSize: '12px', opacity: 0.6, margin: '0 0 10px' }}>
                  A personal tip shown on the detail page and delivered by Josephine in chat. Keep it short, specific, and useful — e.g. "Ask for the Schlutzkrapfen on Sundays" or "The sunrise from the east terrace is worth the early start."
                </p>
                <textarea
                  rows={3}
                  value={form.josephine_note}
                  onChange={e => set('josephine_note', e.target.value)}
                  placeholder="e.g. Ask Hannes for the off-menu Kaiserschmarrn — he only makes it for guests who ask."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </fieldset>

              {/* Highlights */}
              <fieldset className="rif-fieldset">
                <legend>Highlights (one per line)</legend>
                <textarea
                  rows={3}
                  value={(form.highlights || []).join('\n')}
                  onChange={e => set('highlights', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                  placeholder="Panoramic terrace&#10;Traditional Tyrolean kitchen&#10;Dog-friendly"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </fieldset>

              {/* Photos */}
              <fieldset className="rif-fieldset">
                <legend>Photos (one URL per line)</legend>
                <textarea
                  className="rif-photos-input"
                  rows={4}
                  value={photosInput}
                  onChange={e => setPhotosInput(e.target.value)}
                  placeholder="https://…&#10;https://…"
                />
              </fieldset>

            </div>

            <div className="rif-drawer-footer">
              <button className="rif-btn-cancel" onClick={() => setEditing(null)}>Cancel</button>
              <button className="rif-btn-save" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing === 'new' ? 'Create Rifugio' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
