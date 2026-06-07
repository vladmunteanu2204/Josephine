import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { RotateCw, Check, Trash2, Lightbulb, Sparkles, X, BookOpen, Loader2 } from 'lucide-react';

// Layer 2.5 — questions the deterministic layers couldn't answer, ranked by how
// often they're asked. Each can be DRAFTED into a Josephine-voice answer (EN/IT/DE)
// by the LLM, reviewed/edited, and APPROVED → published to the live learned-intents
// store with no code deploy (served for free before the paid LLM next time).
const MODE_COLOR = {
  llm:          { label: 'LLM',         color: '#60a5fa' },
  cached:       { label: 'LLM (cached)', color: '#818cf8' },
  no_key:       { label: 'No key',      color: '#fbbf24' },
  rate_limited: { label: 'Rate-limited', color: '#f59e0b' },
  error:        { label: 'Error',       color: '#f87171' },
  guardrail:    { label: 'Guardrail',   color: '#c084fc' },
  learned:      { label: 'Learned',     color: '#4ade80' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const btn = (accent) => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
  border: `1px solid ${accent}66`, background: `${accent}14`, color: accent, cursor: 'pointer',
  fontSize: 13, fontWeight: 600,
});

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.25)',
  color: '#f0ece6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
};

const labelStyle = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.6, marginBottom: 4, display: 'block' };

export default function KnowledgeGaps() {
  const [gaps, setGaps] = useState([]);
  const [totals, setTotals] = useState({ distinct: 0, total_hits: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [learned, setLearned] = useState([]);
  const [showLearned, setShowLearned] = useState(false);

  // Per-gap draft editor: { [gapId]: { question, keywords, answer_en, answer_it, answer_de, drafting, saving, err } }
  const [editors, setEditors] = useState({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/knowledge-gaps', { params: { limit: 300 } });
      setGaps(res.data.gaps || []);
      setTotals({ distinct: res.data.distinct || 0, total_hits: res.data.total_hits || 0 });
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLearned = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/learned-intents');
      setLearned(res.data.intents || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }, []);

  useEffect(() => { load(); loadLearned(); }, [load, loadLearned]);

  const dismiss = async (id) => {
    setGaps(prev => prev.filter(g => g.id !== id));   // optimistic
    try { await axios.delete('/api/admin/knowledge-gaps', { params: { id } }); }
    catch { load(); }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear ALL logged questions? This cannot be undone.')) return;
    try { await axios.delete('/api/admin/knowledge-gaps', { params: { all: 1 } }); load(); }
    catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const patchEditor = (id, patch) =>
    setEditors(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const closeEditor = (id) =>
    setEditors(prev => { const n = { ...prev }; delete n[id]; return n; });

  // Open the editor for a gap and ask the LLM to draft an answer.
  const draft = async (gap) => {
    patchEditor(gap.id, {
      question: gap.question, keywords: '', answer_en: '', answer_it: '', answer_de: '',
      drafting: true, saving: false, err: null,
    });
    try {
      const res = await axios.post('/api/admin/knowledge-gaps/draft', { question: gap.question });
      const d = res.data.draft || {};
      if (d.offscope) {
        patchEditor(gap.id, {
          drafting: false,
          err: "Josephine considers this off-scope — she'd decline it. You can still write a custom redirect, or just dismiss the gap.",
        });
        return;
      }
      patchEditor(gap.id, {
        drafting: false,
        keywords: (d.keywords || []).join(', '),
        answer_en: d.answer_en || '',
        answer_it: d.answer_it || '',
        answer_de: d.answer_de || '',
      });
    } catch (e) {
      patchEditor(gap.id, { drafting: false, err: e.response?.data?.message || e.response?.data?.error || e.message });
    }
  };

  // Approve & publish, then dismiss the originating gap.
  const approve = async (gap) => {
    const ed = editors[gap.id];
    if (!ed) return;
    const keywords = ed.keywords.split(',').map(s => s.trim()).filter(Boolean);
    if (keywords.length === 0) { patchEditor(gap.id, { err: 'Add at least one trigger keyword.' }); return; }
    if (!ed.answer_en.trim()) { patchEditor(gap.id, { err: 'The English answer is required.' }); return; }
    patchEditor(gap.id, { saving: true, err: null });
    try {
      await axios.post('/api/admin/learned-intents', {
        keywords,
        answer_en: ed.answer_en,
        answer_it: ed.answer_it,
        answer_de: ed.answer_de,
        source_question: gap.question,
      });
      closeEditor(gap.id);
      setGaps(prev => prev.filter(g => g.id !== gap.id));
      await axios.delete('/api/admin/knowledge-gaps', { params: { id: gap.id } }).catch(() => {});
      loadLearned();
    } catch (e) {
      patchEditor(gap.id, { saving: false, err: e.response?.data?.message || e.response?.data?.error || e.message });
    }
  };

  const deleteLearned = async (id) => {
    if (!window.confirm('Retire this learned intent? Josephine will stop using it.')) return;
    setLearned(prev => prev.filter(i => i.id !== id));
    try { await axios.delete('/api/admin/learned-intents', { params: { id } }); }
    catch { loadLearned(); }
  };

  const cell = { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', verticalAlign: 'top' };
  const th = { ...cell, textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.6 };

  return (
    <div style={{ color: '#f0ece6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <Lightbulb size={20} />
        <h2 style={{ margin: 0, fontSize: 20 }}>Knowledge gaps</h2>
        <button onClick={() => setShowLearned(s => !s)} title="Show learned intents"
          style={{ ...btn('#86efac'), marginLeft: 'auto' }}>
          <BookOpen size={14} /> Learned ({learned.length})
        </button>
        <button onClick={() => { load(); loadLearned(); }} title="Refresh" style={btn('#f0ece6')}>
          <RotateCw size={14} /> Refresh
        </button>
        {gaps.length > 0 && (
          <button onClick={clearAll} style={btn('#f3a3a3')}>
            <Trash2 size={14} /> Clear all
          </button>
        )}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
        Questions Josephine couldn't answer offline (handled by the LLM or the fallback), ranked by how often they're asked.
        Hit <strong>Draft</strong> to let the LLM propose an EN/IT/DE answer in her voice, review/edit it, then <strong>Approve</strong> to publish it live — no code deploy needed.
        {' '}<strong>{totals.distinct}</strong> distinct · <strong>{totals.total_hits}</strong> total asks.
      </p>

      {showLearned && (
        <div style={{ marginBottom: 20, border: '1px solid rgba(134,239,172,0.25)', borderRadius: 12, padding: 14, background: 'rgba(74,222,128,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <BookOpen size={16} color="#86efac" />
            <strong style={{ fontSize: 14 }}>Published learned intents</strong>
            <span style={{ opacity: 0.6, fontSize: 12 }}>served before the LLM, for free</span>
          </div>
          {learned.length === 0 && <p style={{ opacity: 0.6, fontSize: 13, margin: 0 }}>None yet — approve a draft below to publish your first one.</p>}
          {learned.map(i => (
            <div key={i.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {(i.keywords || []).map(k => (
                    <span key={k} style={{ display: 'inline-block', background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '1px 7px', margin: '0 5px 4px 0' }}>{k}</span>
                  ))}
                </div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{i.answer_en}</div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 3 }}>{i.hits} hit{i.hits === 1 ? '' : 's'}{i.source_question ? ` · from “${i.source_question.slice(0, 60)}”` : ''}</div>
              </div>
              <button onClick={() => deleteLearned(i.id)} title="Retire intent" style={{ ...btn('#f3a3a3'), padding: '5px 9px' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && <p style={{ opacity: 0.6 }}>Loading…</p>}
      {error && <p style={{ color: '#f3a3a3' }}>Error: {error}</p>}

      {!loading && !error && gaps.length === 0 && (
        <p style={{ opacity: 0.6 }}>No gaps logged yet — every question so far was answered by Layers 1–2. 🎉</p>
      )}

      {!loading && gaps.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 56 }}>Asks</th>
                <th style={th}>Question</th>
                <th style={{ ...th, width: 110 }}>Source</th>
                <th style={{ ...th, width: 56 }}>Lang</th>
                <th style={{ ...th, width: 90 }}>Last</th>
                <th style={{ ...th, width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => {
                const m = MODE_COLOR[g.mode] || { label: g.mode, color: '#9ca3af' };
                const ed = editors[g.id];
                return (
                  <React.Fragment key={g.id}>
                    <tr>
                      <td style={{ ...cell, fontWeight: 700, fontSize: 16 }}>{g.hits}</td>
                      <td style={cell}>
                        <div>{g.question}</div>
                        {g.sample_reply && (
                          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.5, lineHeight: 1.4 }}>
                            ↳ {g.sample_reply.slice(0, 140)}{g.sample_reply.length > 140 ? '…' : ''}
                          </div>
                        )}
                      </td>
                      <td style={cell}>
                        <span style={{ color: m.color, fontSize: 12, fontWeight: 600 }}>{m.label}</span>
                      </td>
                      <td style={{ ...cell, textTransform: 'uppercase', opacity: 0.7, fontSize: 12 }}>{g.lang || '—'}</td>
                      <td style={{ ...cell, opacity: 0.6, fontSize: 12 }}>{timeAgo(g.last_seen)}</td>
                      <td style={cell}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!ed && (
                            <button onClick={() => draft(g)} title="Draft an answer with the LLM" style={{ ...btn('#c4b5fd'), padding: '5px 9px' }}>
                              <Sparkles size={13} /> Draft
                            </button>
                          )}
                          <button onClick={() => dismiss(g.id)} title="Mark resolved / dismiss" style={{ ...btn('#86efac'), padding: '5px 9px' }}>
                            <Check size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {ed && (
                      <tr>
                        <td colSpan={6} style={{ ...cell, background: 'rgba(196,181,253,0.05)' }}>
                          {ed.drafting ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.8, fontSize: 13 }}>
                              <Loader2 size={15} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Drafting Josephine's answer…
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Sparkles size={14} color="#c4b5fd" />
                                <strong style={{ fontSize: 13 }}>Review &amp; edit the draft, then approve</strong>
                                <button onClick={() => closeEditor(g.id)} title="Cancel" style={{ ...btn('#f0ece6'), marginLeft: 'auto', padding: '4px 8px' }}>
                                  <X size={13} />
                                </button>
                              </div>
                              {ed.err && <div style={{ color: '#f3a3a3', fontSize: 12 }}>{ed.err}</div>}
                              <div>
                                <label style={labelStyle}>Trigger keywords (comma-separated)</label>
                                <input style={inputStyle} value={ed.keywords}
                                  onChange={e => patchEditor(g.id, { keywords: e.target.value })}
                                  placeholder="e.g. e-bike charging, charge ebike, battery" />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                                <div>
                                  <label style={labelStyle}>English answer *</label>
                                  <textarea style={{ ...inputStyle, minHeight: 84 }} value={ed.answer_en}
                                    onChange={e => patchEditor(g.id, { answer_en: e.target.value })} />
                                </div>
                                <div>
                                  <label style={labelStyle}>Italian (tu)</label>
                                  <textarea style={{ ...inputStyle, minHeight: 84 }} value={ed.answer_it}
                                    onChange={e => patchEditor(g.id, { answer_it: e.target.value })} />
                                </div>
                                <div>
                                  <label style={labelStyle}>German (du)</label>
                                  <textarea style={{ ...inputStyle, minHeight: 84 }} value={ed.answer_de}
                                    onChange={e => patchEditor(g.id, { answer_de: e.target.value })} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => approve(g)} disabled={ed.saving} style={{ ...btn('#4ade80'), opacity: ed.saving ? 0.6 : 1 }}>
                                  {ed.saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                                  Approve &amp; publish
                                </button>
                                <button onClick={() => draft(g)} disabled={ed.drafting} style={btn('#c4b5fd')}>
                                  <RotateCw size={13} /> Re-draft
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
