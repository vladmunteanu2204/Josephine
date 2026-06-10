import React from 'react';
import {
  Car, Coffee, Footprints, Eye, Camera, Mountain, Utensils, Flag, Sun, Clock, AlertTriangle,
} from 'lucide-react';
import './DayPlanTimeline.css';

const ICONS = {
  car: Car, drive: Car, coffee: Coffee, footprints: Footprints, hike_start: Footprints,
  eye: Eye, viewpoint: Eye, camera: Camera, photo: Camera, mountain: Mountain, summit: Mountain,
  utensils: Utensils, lunch: Utensils, flag: Flag, finish: Flag, depart: Car, drive_back: Car,
};

function stepIcon(s) {
  const Cmp = ICONS[s.icon] || ICONS[s.kind] || Clock;
  return <Cmp size={15} strokeWidth={2} aria-hidden="true" />;
}

/**
 * Premium vertical day-plan timeline.
 * props: { plan, t } — plan = the backend day_plan payload.
 */
export default function DayPlanTimeline({ plan, t }) {
  if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) return null;
  const tr = (k, fb, v) => (typeof t === 'function' ? t(k, fb, v) : fb);

  const a = plan.assumptions || {};
  const driveApprox = plan.drive_basis === 'estimate';

  return (
    <div className="dpt" role="group" aria-label={tr('dayPlan.title', 'Your day, planned')}>
      <div className="dpt__head">
        <span className="dpt__kicker">{tr('dayPlan.kicker', 'Day plan')}</span>
        <h3 className="dpt__title">{plan.trail_name || tr('dayPlan.title', 'Your day, planned')}</h3>
        <div className="dpt__meta">
          {plan.drive_min ? (
            <span className="dpt__chip">
              <Car size={12} strokeWidth={2} />~{plan.drive_min} min{driveApprox ? '*' : ''}
            </span>
          ) : null}
          {a.pace ? <span className="dpt__chip">{a.pace} pace</span> : null}
          {plan.finish ? (
            <span className="dpt__chip"><Clock size={12} strokeWidth={2} />back {plan.finish}</span>
          ) : null}
          {plan.sunset ? (
            <span className="dpt__chip"><Sun size={12} strokeWidth={2} />{plan.sunset}</span>
          ) : null}
        </div>
      </div>

      {plan.daylight_ok === false && (
        <div className="dpt__warn" role="alert">
          <AlertTriangle size={15} strokeWidth={2} />
          <span>{tr('dayPlan.daylightWarn',
            'Heads up — this finishes close to dark. Leave earlier, pick up the pace, or choose a shorter route.')}</span>
        </div>
      )}

      <ul className="dpt__list">
        {plan.steps.map((s, i) => (
          <li className={`dpt__step${s.kind === 'finish' && plan.daylight_ok === false ? ' is-risk' : ''}`} key={i}>
            <span className="dpt__time">{s.time}</span>
            <span className="dpt__node">{stepIcon(s)}</span>
            <div className="dpt__body">
              <div className="dpt__label">{s.label}</div>
              {s.sub ? <div className="dpt__sub">{s.sub}</div> : null}
            </div>
          </li>
        ))}
      </ul>

      {driveApprox && (
        <p className="dpt__foot">{tr('dayPlan.driveApprox', '*drive time is an estimate')}</p>
      )}
    </div>
  );
}
