import React from 'react';
import * as LucideIcons from 'lucide-react';
import './Icon.css';

const Icon = ({ 
  name, 
  type = 'lucide',
  size = 24, 
  className = '', 
  style = {},
  tone = 'alpine',
  ...props 
}) => {
  const toneClasses = {
    alpine: 'icon-tone-alpine',
    sunset: 'icon-tone-sunset',
    neutral: 'icon-tone-neutral',
    gold: 'icon-tone-gold',
  };

  if (type === '3d') {
    const iconMap = {
      'mountain-logo': '/icons/mountain-logo.png',
      'hiking-boot': '/icons/hiking-boot.png',
      'alpine-lake': '/icons/alpine-lake.png',
      'trophy': '/icons/trophy.png',
      'compass': '/icons/compass.png',
      'backpack': '/icons/backpack.png',
    };

    return (
      <img
        src={iconMap[name]}
        alt=""
        className={`icon-3d ${toneClasses[tone]} ${className}`}
        style={{ 
          width: size, 
          height: size,
          ...style 
        }}
        aria-hidden="true"
        {...props}
      />
    );
  }

  if (type === 'lucide') {
    const LucideIcon = LucideIcons[name];
    
    if (!LucideIcon) {
      console.warn(`Lucide icon "${name}" not found`);
      return null;
    }

    return (
      <LucideIcon
        size={size}
        className={`icon-lucide ${toneClasses[tone]} ${className}`}
        style={style}
        aria-hidden="true"
        {...props}
      />
    );
  }

  return null;
};

export default Icon;
