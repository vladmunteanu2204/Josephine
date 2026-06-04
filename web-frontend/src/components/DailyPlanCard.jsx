import React from 'react';
import './DailyPlanCard.css';

// Phase 1 — the Daily Plan Card. Renders one composed plan from
// /api/josephine/plan: full, partial (no hut), caution/avoid banner, or
// refusal (no trail). Voiced/dynamic text comes localized from the backend;
// the static labels here use the chat's t() with English fallbacks.
const SAFETY_ICON = { caution: '⚠', avoid: '⛔' };
// Kept in sync with backend insights.INSIGHT_KINDS
const INSIGHT_ICON = {
  photo_spot: '📷', viewpoint: '◉', tip: '💡', food: '🍽',
  hazard: '⚠', dog_tip: '🐾', sunrise_tip: '🌅', sunset_tip: '🌇',
};

export default function DailyPlanCard({ plan, t, onSave, onViewTrail, onAlt, saved, onStartHike }) {
  if (!plan) return null;
  const tt = (k, fb) => (t ? t(k, fb) : fb);
  const trail = plan.trail;
  const safety = plan.safety || {};
  const hasBanner = safety.level === 'caution' || safety.level === 'avoid';

  // Refusal (no trail) — just the voice + a banner.
  if (!trail) {
    return (
      <div className="dpc dpc--refusal">
        {hasBanner && (
          <div className={`dpc__banner dpc__banner--${safety.level}`}>
            {SAFETY_ICON[safety.level]} {safety.message}
          </div>
        )}
        <div className="dpc__body">
          <p className="dpc__says">{plan.josephine_says}</p>
        </div>
      </div>
    );
  }

  const Row = ({ k, children }) => (
    <div className="dpc__row"><span className="dpc__row-k">{k}</span><span className="dpc__row-v">{children}</span></div>
  );
  const altLabel = (kind) => ({
    easier: tt('planAltEasier', 'Easier'),
    quieter: tt('planAltQuieter', 'Quieter'),
    rainy: tt('planAltRainy', 'Rainy-day'),
    tomorrow: tt('planAltTomorrow', 'Tomorrow'),
  }[kind] || kind);

  return (
    <div className="dpc">
      {hasBanner && (
        <div className={`dpc__banner dpc__banner--${safety.level}`}>
          {SAFETY_ICON[safety.level]} {safety.message}
        </div>
      )}

      {trail.image && (
        <div className="dpc__hero">
          <img src={trail.image} alt={trail.name} onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }} />
        </div>
      )}

      <div className="dpc__body">
        {plan.title && (
          <h3 className="dpc__title">{plan.moment?.emoji ? plan.moment.emoji + ' ' : ''}{plan.title}</h3>
        )}
        {plan.josephine_says && <p className="dpc__says">{plan.josephine_says}</p>}

        {plan.signals?.length > 0 && (
          <div className="dpc__signals">
            {plan.signals.map((s, i) => <span key={i} className="dpc__sig">{s}</span>)}
          </div>
        )}

        <div className="dpc__rows">
          <Row k={tt('planTrail', 'Trail')}>
            {trail.name} · {trail.distance_km}km · {trail.duration_hours}h · {trail.difficulty}
          </Row>
          {plan.timing?.suggested_start && (
            <Row k={tt('planStart', 'Start by')}>
              {plan.timing.suggested_start}
              {plan.timing.latest_safe_start ? ` · ${tt('planLatest', 'latest')} ${plan.timing.latest_safe_start}` : ''}
              {plan.timing.reason ? ` — ${plan.timing.reason}` : ''}
            </Row>
          )}
          {plan.hut?.name && (
            <Row k={tt('planHut', 'Hut stop')}>
              {plan.hut.name}{plan.hut.open_now === false ? ` (${tt('planClosed', 'closed now')})` : ''}
              {plan.hut.note ? ` — ${plan.hut.note}` : ''}
            </Row>
          )}
          {(plan.access?.parking || plan.access?.by_car || plan.access?.by_transport) && (
            <Row k={tt('planGetting', 'Getting there')}>
              {plan.access.parking || plan.access.by_car || plan.access.by_transport}
            </Row>
          )}
          {plan.weather?.summary && <Row k={tt('planWeather', 'Weather')}>{plan.weather.summary}</Row>}
        </div>

        {plan.dog_note && <p className="dpc__note">🐾 {plan.dog_note}</p>}
        {plan.family_note && <p className="dpc__note">👨‍👩‍👧 {plan.family_note}</p>}
        {plan.local_tip && <p className="dpc__tip">💡 {plan.local_tip}</p>}

        {plan.secrets?.length > 0 && (
          <div className="dpc__secrets">
            <p className="dpc__secrets-title">{tt('planSecretsTitle', "Josephine's secrets")}</p>
            <ul className="dpc__secrets-list">
              {plan.secrets.map((s) => (
                <li key={s.id} className="dpc__secret">
                  <span className="dpc__secret-icon">{INSIGHT_ICON[s.kind] || '✦'}</span>
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan.alternatives?.length > 0 && (
          <div className="dpc__alts">
            {plan.alternatives.map((a, i) => (
              <button key={i} className="dpc__alt" onClick={() => onAlt && onAlt(a)}>
                {altLabel(a.kind)}{a.kind !== 'tomorrow' && a.name ? `: ${a.name}` : ''}
              </button>
            ))}
          </div>
        )}

        <div className="dpc__actions">
          {onStartHike && (
            <button className="dpc__btn dpc__btn--primary dpc__btn--full" onClick={() => onStartHike(trail)}>
              {tt('planStartHike', '▶ Start with Josephine')}
            </button>
          )}
          <div className="dpc__actions-row">
            <button className={`dpc__btn ${onStartHike ? 'dpc__btn--ghost' : 'dpc__btn--primary'}`} onClick={() => onViewTrail && onViewTrail(trail)}>
              {tt('planView', 'View details')}
            </button>
            <button className="dpc__btn dpc__btn--ghost" onClick={() => onSave && onSave(trail)}>
              {saved ? tt('planSaved', '✓ Saved') : tt('planSave', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
