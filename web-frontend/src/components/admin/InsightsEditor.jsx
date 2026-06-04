import React, { useState } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Check, Sparkles } from 'lucide-react';
import './InsightsEditor.css';

// Kept in sync with backend insights.INSIGHT_KINDS
const KINDS = [
  ['photo_spot', '📷 Photo spot'],
  ['viewpoint', '◉ Viewpoint'],
  ['tip', '💡 Tip'],
  ['food', '🍽 Food / specialty'],
  ['hazard', '⚠ Hazard / warning'],
  ['dog_tip', '🐾 Dog tip'],
  ['sunrise_tip', '🌅 Sunrise tip'],
  ['sunset_tip', '🌇 Sunset tip'],
];
const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
const TIMES = ['sunrise', 'morning', 'midday', 'afternoon', 'golden_hour', 'sunset', 'evening', 'night'];
const VERIF = ['unverified', 'editorial', 'verified', 'stale'];

const blankItem = () => ({
  id: '', kind: 'tip', visibility: 'public',
  text: { en: '', it: '', de: '' },
  conditions: { months: [], season: [], time_of_day: [], weather: {} },
  verification: { status: 'unverified', source_type: 'manual', source_url: '', last_verified_at: '' },
  coordinates: null,
});

function genId() {
  return 'ins_' + Math.random().toString(16).slice(2, 10);
}

/**
 * Shared editor for a record's insights[] (trails + rifugios).
 * Props: value (array), onChange(nextArray), facts (string of verified facts for
 * the AI-draft prompt, optional).
 */
export default function InsightsEditor({ value, onChange, facts = '' }) {
  const items = Array.isArray(value) ? value : [];
  const [showForm, setShowForm] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [draft, setDraft] = useState(blankItem());
  const [notes, setNotes] = useState('');
  const [drafting, setDrafting] = useState(false);

  const openNew = () => { setDraft(blankItem()); setNotes(''); setEditIndex(null); setShowForm(true); };
  const openEdit = (i) => {
    const it = items[i];
    setDraft({ ...blankItem(), ...it, conditions: { ...blankItem().conditions, ...(it.conditions || {}) },
      verification: { ...blankItem().verification, ...(it.verification || {}) } });
    setNotes(''); setEditIndex(i); setShowForm(true);
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  const save = () => {
    const it = { ...draft };
    if (!it.id) it.id = genId();
    if (it.verification.status === 'verified' && !it.verification.last_verified_at) {
      it.verification.last_verified_at = new Date().toISOString().slice(0, 10);
    }
    // prune empty condition arrays / weather
    const c = it.conditions || {};
    it.conditions = {};
    if (c.months?.length) it.conditions.months = c.months;
    if (c.season?.length) it.conditions.season = c.season;
    if (c.time_of_day?.length) it.conditions.time_of_day = c.time_of_day;
    if (c.weather && Object.keys(c.weather).length) it.conditions.weather = c.weather;
    if (!Object.keys(it.conditions).length) delete it.conditions;
    if (!it.coordinates || it.coordinates.lat == null) delete it.coordinates;

    if (!it.text.en && !it.text.it && !it.text.de) { setShowForm(false); return; }
    const next = [...items];
    if (editIndex != null) next[editIndex] = it; else next.push(it);
    onChange(next);
    setShowForm(false);
  };

  const aiDraft = async () => {
    setDrafting(true);
    try {
      const res = await axios.post('/api/admin/ai-draft', {
        notes, facts, field: 'insight', kind: draft.kind,
      });
      const d = res.data?.draft || {};
      setDraft(p => ({ ...p, text: { en: d.en || p.text.en, it: d.it || p.text.it, de: d.de || p.text.de } }));
      if (res.data?.mode === 'no_key') alert(res.data.message || 'AI drafting is off — your notes were kept in English.');
    } catch {
      alert('AI draft failed — try again.');
    } finally { setDrafting(false); }
  };

  const setCond = (patch) => setDraft(p => ({ ...p, conditions: { ...p.conditions, ...patch } }));
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const kindLabel = (k) => (KINDS.find(x => x[0] === k) || [k, k])[1];

  return (
    <div className="ins-editor">
      <div className="ins-head">
        <span className="ins-title">✦ Insider insights <small>(photo spots, tips, secrets — Josephine delivers these in chat)</small></span>
        <button type="button" className="ins-add" onClick={openNew}><Plus size={14} /> Add insight</button>
      </div>

      {items.length === 0 && <p className="ins-empty">No insights yet. Add photo spots, viewpoints, food tips, hazards — mark each public (shows on the trail page) or chat-only (Josephine's secret).</p>}

      <ul className="ins-list">
        {items.map((it, i) => (
          <li className="ins-row" key={it.id || i}>
            <span className="ins-kind">{kindLabel(it.kind)}</span>
            <span className={`ins-vis ins-vis--${it.visibility || 'public'}`}>{it.visibility === 'chat_only' ? 'secret' : 'public'}</span>
            <span className="ins-prev">{(it.text?.en || it.text?.it || it.text?.de || '').slice(0, 70)}</span>
            <span className={`ins-verif ins-verif--${(it.verification?.status) || 'unverified'}`}>{it.verification?.status || 'unverified'}</span>
            <button type="button" className="ins-icon" onClick={() => openEdit(i)}><Pencil size={13} /></button>
            <button type="button" className="ins-icon ins-icon--del" onClick={() => remove(i)}><Trash2 size={13} /></button>
          </li>
        ))}
      </ul>

      {showForm && (
        <div className="ins-form">
          <div className="ins-grid2">
            <label>Kind
              <select value={draft.kind} onChange={e => setDraft(p => ({ ...p, kind: e.target.value }))}>
                {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label>Visibility
              <select value={draft.visibility} onChange={e => setDraft(p => ({ ...p, visibility: e.target.value }))}>
                <option value="public">Public (trail page + chat)</option>
                <option value="chat_only">Chat-only (Josephine's secret)</option>
              </select>
            </label>
          </div>

          <div className="ins-ai">
            <input placeholder="Rough notes for AI-draft (e.g. 'best photos from north shore at dawn')"
                   value={notes} onChange={e => setNotes(e.target.value)} />
            <button type="button" onClick={aiDraft} disabled={drafting || !notes.trim()}>
              <Sparkles size={13} /> {drafting ? 'Drafting…' : 'AI draft'}
            </button>
          </div>

          {['en', 'it', 'de'].map(lng => (
            <label key={lng} className="ins-text">{lng.toUpperCase()}
              <textarea rows={2} value={draft.text[lng]}
                        onChange={e => setDraft(p => ({ ...p, text: { ...p.text, [lng]: e.target.value } }))} />
            </label>
          ))}

          <p className="ins-sub">When to show this (optional — leave blank for always)</p>
          <label className="ins-text">Months (comma-separated, English)
            <input value={(draft.conditions.months || []).join(', ')}
                   onChange={e => setCond({ months: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
          </label>
          <div className="ins-chips">
            <span className="ins-chips-l">Season:</span>
            {SEASONS.map(s => (
              <button type="button" key={s} className={`ins-chip ${(draft.conditions.season || []).includes(s) ? 'on' : ''}`}
                      onClick={() => setCond({ season: toggle(draft.conditions.season || [], s) })}>{s}</button>
            ))}
          </div>
          <div className="ins-chips">
            <span className="ins-chips-l">Time:</span>
            {TIMES.map(s => (
              <button type="button" key={s} className={`ins-chip ${(draft.conditions.time_of_day || []).includes(s) ? 'on' : ''}`}
                      onClick={() => setCond({ time_of_day: toggle(draft.conditions.time_of_day || [], s) })}>{s.replace('_', ' ')}</button>
            ))}
          </div>
          <div className="ins-grid2">
            <label>Only if clouds ≤ (%)
              <input type="number" value={draft.conditions.weather?.max_cloud_pct ?? ''}
                     onChange={e => setCond({ weather: { ...draft.conditions.weather, ...(e.target.value === '' ? { max_cloud_pct: undefined } : { max_cloud_pct: Number(e.target.value) }) } })} />
            </label>
            <label>Only after hour
              <input type="number" value={draft.conditions.weather?.from_hour ?? ''}
                     onChange={e => setCond({ weather: { ...draft.conditions.weather, ...(e.target.value === '' ? { from_hour: undefined } : { from_hour: Number(e.target.value) }) } })} />
            </label>
          </div>

          <div className="ins-grid2">
            <label>Latitude (optional)
              <input type="number" value={draft.coordinates?.lat ?? ''}
                     onChange={e => setDraft(p => ({ ...p, coordinates: { ...(p.coordinates || {}), lat: e.target.value === '' ? null : Number(e.target.value) } }))} />
            </label>
            <label>Longitude (optional)
              <input type="number" value={draft.coordinates?.lon ?? ''}
                     onChange={e => setDraft(p => ({ ...p, coordinates: { ...(p.coordinates || {}), lon: e.target.value === '' ? null : Number(e.target.value) } }))} />
            </label>
          </div>

          <div className="ins-grid2">
            <label>Verification
              <select value={draft.verification.status}
                      onChange={e => setDraft(p => ({ ...p, verification: { ...p.verification, status: e.target.value } }))}>
                {VERIF.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Source (who/where confirmed)
              <input value={draft.verification.source_url}
                     onChange={e => setDraft(p => ({ ...p, verification: { ...p.verification, source_url: e.target.value } }))} />
            </label>
          </div>
          <p className="ins-hint">Hazards only ever surface when <b>verified</b>. Public insights need at least <b>editorial</b>. Only claim specifics you've confirmed.</p>

          <div className="ins-actions">
            <button type="button" className="ins-save" onClick={save}><Check size={14} /> {editIndex != null ? 'Update' : 'Add'} insight</button>
            <button type="button" className="ins-cancel" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
