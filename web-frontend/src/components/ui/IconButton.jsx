import React from 'react';
import './ui.css';

/* Standard icon button. Pass a lucide icon component as `icon`.
   variant: 'ghost' | 'outline' | 'solid'  ·  size: 'sm' | 'md' */
export default function IconButton({
  icon: Icon,
  label,
  onClick,
  variant = 'ghost',
  size = 'md',
  active = false,
  disabled = false,
  type = 'button',
  className = '',
  ...rest
}) {
  const px = size === 'sm' ? 16 : 20;
  return (
    <button
      type={type}
      className={`ui-icon-btn ui-icon-btn--${variant} ui-icon-btn--${size}${active ? ' is-active' : ''}${className ? ' ' + className : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      {...rest}
    >
      {Icon && <Icon size={px} strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}
