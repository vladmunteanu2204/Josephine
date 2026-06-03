import React from 'react';

// Phase 1 — the Daily Plan Card. Renders one composed plan from
// /api/josephine/plan: full, partial (no hut), caution/avoid, or refusal
// (no trail). Self-contained styling so it sits cleanly inside the chat.
const GOLD = '#d4a05a';

const SAFETY = {
  caution: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.45)', color: '#fbbf24', icon: '⚠' },
  avoid:   { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.5)',  color: '#f3a3a3', icon: '⛔' },
};

export default function DailyPlanCard({ plan, t, onSave, onViewTrail, onAlt, saved }) {
  if (!plan) return null;
  const tt = (k, fb) => (t ? t(k, fb) : fb);
  const trail = plan.trail;
  const safety = plan.safety || {};
  const banner = SAFETY[safety.level];

  const Row = ({ label, children }) => (
    <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13 }}>
      <span style={{ minWidth: 92, color: 'rgba(240,236,230,0.55)' }}>{label}</span>
      <span style={{ color: 'rgba(240,236,230,0.9)' }}>{children}</span>
    </div>
  );

  return (
    <div style={{
      background: 'linear-gradient(160deg, rgba(40,38,34,0.96), rgba(28,27,24,0.96))',
      border: `1px solid ${GOLD}44`, borderRadius: 16, overflow: 'hidden',
      maxWidth: 460, boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
    }}>
      {/* Safety banner */}
      {banner && (
        <div style={{ background: banner.bg, borderBottom: `1px solid ${banner.border}`,
          color: banner.color, padding: '8px 14px', fontSize: 12.5, fontWeight: 600 }}>
          {banner.icon} {safety.message}
        </div>
      )}

      {/* Trail image + title */}
      {trail?.image && (
        <div style={{ position: 'relative', height: 150, background: '#1c1b18' }}>
          <img src={trail.image} alt={trail.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(20,19,16,0.95), transparent 60%)' }} />
        </div>
      )}

      <div style={{ padding: '14px 16px 16px' }}>
        {plan.title && (
          <h3 style={{ margin: '0 0 6px', fontFamily: 'Georgia, serif', fontSize: 19, color: '#f0ece6' }}>
            {plan.moment?.emoji ? plan.moment.emoji + ' ' : ''}{plan.title}
          </h3>
        )}
        {plan.josephine_says && (
          <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.55, color: 'rgba(240,236,230,0.88)' }}>
            {plan.josephine_says}
          </p>
        )}

        {/* Signals */}
        {plan.signals?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {plan.signals.map((s, i) => (
              <span key={i} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 999,
                background: `${GOLD}1f`, color: '#e8c79a', fontWeight: 600 }}>{s}</span>
            ))}
          </div>
        )}

        {/* Details */}
        {trail && (
          <div style={{ marginBottom: 12 }}>
            <Row label={tt('plan.trail', 'Trail')}>
              {trail.name} · {trail.distance_km}km · {trail.duration_hours}h · {trail.difficulty}
            </Row>
            {plan.timing?.suggested_start && (
              <Row label={tt('plan.start', 'Start by')}>
                {plan.timing.suggested_start}
                {plan.timing.latest_safe_start ? ` · ${tt('plan.latest', 'latest')} ${plan.timing.latest_safe_start}` : ''}
                {plan.timing.reason ? ` — ${plan.timing.reason}` : ''}
              </Row>
            )}
            {plan.hut?.name && (
              <Row label={tt('plan.hut', 'Hut stop')}>
                {plan.hut.name}{plan.hut.open_now === false ? ` (${tt('plan.closed', 'closed now')})` : ''}
                {plan.hut.note ? ` — ${plan.hut.note}` : ''}
              </Row>
            )}
            {(plan.access?.parking || plan.access?.by_car || plan.access?.by_transport) && (
              <Row label={tt('plan.getting', 'Getting there')}>
                {plan.access.parking || plan.access.by_car || plan.access.by_transport}
              </Row>
            )}
            {plan.weather?.summary && (
              <Row label={tt('plan.weather', 'Weather')}>{plan.weather.summary}</Row>
            )}
          </div>
        )}

        {/* Notes */}
        {plan.dog_note && <p style={{ fontSize: 12.5, color: 'rgba(240,236,230,0.7)', margin: '4px 0' }}>🐾 {plan.dog_note}</p>}
        {plan.family_note && <p style={{ fontSize: 12.5, color: 'rgba(240,236,230,0.7)', margin: '4px 0' }}>👨‍👩‍👧 {plan.family_note}</p>}
        {plan.local_tip && (
          <p style={{ fontSize: 12.5, color: '#e8c79a', margin: '8px 0 0', lineHeight: 1.5 }}>
            💡 {plan.local_tip}
          </p>
        )}

        {/* Alternatives */}
        {plan.alternatives?.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {plan.alternatives.map((a, i) => (
              <button key={i} onClick={() => onAlt && onAlt(a)}
                style={{ fontSize: 12, padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.05)', color: '#f0ece6' }}>
                {a.kind === 'easier' ? tt('plan.altEasier', 'Easier') :
                 a.kind === 'quieter' ? tt('plan.altQuieter', 'Quieter') :
                 a.kind === 'rainy' ? tt('plan.altRainy', 'Rainy-day') :
                 tt('plan.altTomorrow', 'Tomorrow')}{a.kind !== 'tomorrow' && a.name ? `: ${a.name}` : ''}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        {trail && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={() => onViewTrail && onViewTrail(trail)}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: GOLD, color: '#1c1b18', fontWeight: 700, fontSize: 13.5 }}>
              {tt('plan.view', 'View details')}
            </button>
            <button onClick={() => onSave && onSave(trail)}
              style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${GOLD}66`, background: 'transparent', color: '#e8c79a', fontWeight: 600, fontSize: 13.5 }}>
              {saved ? tt('plan.saved', '✓ Saved') : tt('plan.save', 'Save')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
