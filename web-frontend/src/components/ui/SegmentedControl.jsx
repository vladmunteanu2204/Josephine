import React, { useRef } from 'react';
import './ui.css';

/* Segmented control for mutually-exclusive choices (time, difficulty,
   type/status filters, map/list mode). Implemented as an ARIA radiogroup:
   selection applies on click, and arrow/Home/End keys move + select with a
   roving tabindex (the radiogroup pattern, not tabs — there are no tabpanels).
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
  const groupRef = useRef(null);
  const activeIdx = options.findIndex((o) => o.value === value);

  const focusOpt = (idx) => {
    const btns = groupRef.current?.querySelectorAll('[role="radio"]');
    btns?.[idx]?.focus();
  };

  const onKeyDown = (e, idx) => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange?.(options[next].value);
    focusOpt(next);
  };

  return (
    <div
      ref={groupRef}
      className={`ui-seg ui-seg--${size}${block ? ' ui-seg--block' : ''}${className ? ' ' + className : ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((o, idx) => {
        const Icon = o.icon;
        const isActive = o.value === value;
        // Roving tabindex: only the selected option (or the first, when none is
        // selected) is tabbable; arrow keys move between the rest.
        const tabIndex = isActive || (activeIdx === -1 && idx === 0) ? 0 : -1;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={tabIndex}
            className={`ui-seg__opt${isActive ? ' is-active' : ''}`}
            onClick={() => onChange?.(o.value)}
            onKeyDown={(e) => onKeyDown(e, idx)}
          >
            {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true" />}
            {o.label != null && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
