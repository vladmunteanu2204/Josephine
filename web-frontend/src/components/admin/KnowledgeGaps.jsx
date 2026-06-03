import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { RotateCw, Check, Trash2, Lightbulb } from 'lucide-react';

// Layer 2.5 — questions the deterministic layers couldn't answer, ranked by how
// often they're asked. The queue of what to promote into Layer 2 (josephine_answers).
const MODE_COLOR = {
  llm:          { label: 'LLM',         color: '#60a5fa' },
  cached:       { label: 'LLM (cached)', color: '#818cf8' },
  no_key:       { label: 'No key',      color: '#fbbf24' },
  rate_limited: { label: 'Rate-limited', color: '#f59e0b' },
  error:        { label: 'Error',       color: '#f87171' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function KnowledgeGaps() {
  const [gaps, setGaps] = useState([]);
  const [totals, setTotals] = useState({ distinct: 0, total_hits: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => { load(); }, [load]);

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

  const cell = { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', verticalAlign: 'top' };
  const th = { ...cell, textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.6 };

  return (
    <div style={{ color: '#f0ece6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <Lightbulb size={20} />
        <h2 style={{ margin: 0, fontSize: 20 }}>Knowledge gaps</h2>
        <button onClick={load} title="Refresh"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.05)', color: '#f0ece6', cursor: 'pointer' }}>
          <RotateCw size={14} /> Refresh
        </button>
        {gaps.length > 0 && (
          <button onClick={clearAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
              border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.08)', color: '#f3a3a3', cursor: 'pointer' }}>
            <Trash2 size={14} /> Clear all
          </button>
        )}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
        Questions Josephine couldn't answer offline (handled by the LLM or the fallback), ranked by how often they're asked.
        Add the recurring ones to Layer 2 (<code>josephine_answers.py</code>), then mark them done.
        {' '}<strong>{totals.distinct}</strong> distinct · <strong>{totals.total_hits}</strong> total asks.
      </p>

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
                <th style={{ ...th, width: 70 }}>Done</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => {
                const m = MODE_COLOR[g.mode] || { label: g.mode, color: '#9ca3af' };
                return (
                  <tr key={g.id}>
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
                      <button onClick={() => dismiss(g.id)} title="Mark resolved / dismiss"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 7,
                          border: '1px solid rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.08)', color: '#86efac', cursor: 'pointer' }}>
                        <Check size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
