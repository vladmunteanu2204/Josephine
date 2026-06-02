import React from 'react';
import './ui.css';

/* Segmented control for mutually-exclusive choices (time, difficulty,
   type/status filters, map/list mode).
   options: [{ value, label, icon? }]  ·  size: 'sm' | 'md'  ·  block: full-width */
export default function SegmentedControl({
  options = [],
  value,
  onChange,
  size = 'md',
  block = false,
  ariaLabel,
  className = '',
}) {
  return (
    <div
      className={`ui-seg ui-seg--${size}${block ? ' ui-seg--block' : ''}${className ? ' ' + className : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((o) => {
        const Icon = o.icon;
        const isActive = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`ui-seg__opt${isActive ? ' is-active' : ''}`}
            onClick={() => onChange?.(o.value)}
          >
            {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true" />}
            {o.label != null && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
