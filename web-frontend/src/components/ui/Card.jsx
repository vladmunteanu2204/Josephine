import React from 'react';
import './ui.css';

/* Standard surface card. `interactive` adds hover affordance for clickable cards. */
export default function Card({ as = 'div', interactive = false, className = '', children, ...rest }) {
  const Tag = as;
  return (
    <Tag
      className={`ui-card${interactive ? ' ui-card--interactive' : ''}${className ? ' ' + className : ''}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
