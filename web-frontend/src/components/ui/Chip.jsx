import React from 'react';
import { X } from 'lucide-react';
import './ui.css';

/* Pill chip for metadata, filters and selected-filter tokens.
   - Pass a lucide icon as `icon`.
   - `onClick` makes it a button (toggle/filter).
   - `removable` + `onRemove` renders a clear "×" affordance. */
export default function Chip({
  icon: Icon,
  active = false,
  onClick,
  removable = false,
  onRemove,
  as,
  children,
  className = '',
  ...rest
}) {
  const Tag = as || (onClick ? 'button' : 'span');
  const isButton = Tag === 'button';
  return (
    <Tag
      className={`ui-chip${active ? ' is-active' : ''}${onClick ? ' ui-chip--btn' : ''}${className ? ' ' + className : ''}`}
      onClick={onClick}
      {...(isButton ? { type: 'button' } : {})}
      {...rest}
    >
      {Icon && <Icon size={14} strokeWidth={2} className="ui-chip__icon" aria-hidden="true" />}
      <span className="ui-chip__label">{children}</span>
      {removable && (
        <X
          size={14}
          className="ui-chip__x"
          aria-hidden="true"
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
        />
      )}
    </Tag>
  );
}
