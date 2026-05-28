import React from 'react';
import { useTranslation } from 'react-i18next';
import './ThemeCards.css';

function ThemeCards({ onThemeClick }) {
  const { t } = useTranslation();

  const themes = [
    {
      id: 'lake-day',
      icon: '🏞️',
      title: t('home.themeLakeDay'),
      description: t('home.themeLakeDayDesc'),
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      tags: ['alpine lakes']
    },
    {
      id: 'malga',
      icon: '🧀',
      title: t('home.themeMalga'),
      description: t('home.themeMalgaDesc'),
      color: '#d97706',
      gradient: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
      tags: ['malga', 'food']
    },
    {
      id: 'easy-walk',
      icon: '🌿',
      title: t('home.themeEasyWalk'),
      description: t('home.themeEasyWalkDesc'),
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      tags: ['easy', 'scenic']
    },
    {
      id: 'dog-friendly',
      icon: '🐕',
      title: t('home.themeDogFriendly'),
      description: t('home.themeDogFriendlyDesc'),
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      tags: ['dog friendly']
    },
    {
      id: 'romantic',
      icon: '🌅',
      title: t('home.themeRomantic'),
      description: t('home.themeRomanticDesc'),
      color: '#ec4899',
      gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      tags: ['panoramic views', 'romantic']
    },
    {
      id: 'rainy-day',
      icon: '☁️',
      title: t('home.themeRainyDay'),
      description: t('home.themeRainyDayDesc'),
      color: '#6b7280',
      gradient: 'linear-gradient(135deg, #6b7280 0%, #374151 100%)',
      tags: ['forests', 'covered']
    },
    {
      id: 'parents',
      icon: '👨‍👩‍👧',
      title: t('home.themeParents'),
      description: t('home.themeParentsDesc'),
      color: '#8b5cf6',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      tags: ['family friendly', 'easy']
    },
    {
      id: 'half-day',
      icon: '⏱️',
      title: t('home.themeHalfDay'),
      description: t('home.themeHalfDayDesc'),
      color: '#14b8a6',
      gradient: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
      tags: ['short']
    },
    {
      id: 'hut-to-hut',
      icon: '🏔️',
      title: t('home.themeHutToHut'),
      description: t('home.themeHutToHutDesc'),
      color: '#d4a574',
      gradient: 'linear-gradient(135deg, #d4a574 0%, #c89660 100%)',
      tags: ['multi-day', 'rifugio']
    }
  ];

  return (
    <div className="theme-cards-section">
      <div className="theme-cards-header">
        <h2 className="section-title-large">{t('home.exploreByTheme')}</h2>
        <p className="section-subtitle">{t('home.exploreByThemeDesc')}</p>
      </div>

      <div className="theme-cards-grid">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className="theme-card"
            onClick={() => onThemeClick && onThemeClick(theme.tags)}
            style={{ '--theme-color': theme.color }}
          >
            <div className="theme-card-bg" style={{ background: theme.gradient }}></div>
            <div className="theme-card-content">
              <div className="theme-icon">{theme.icon}</div>
              <h3 className="theme-title">{theme.title}</h3>
              <p className="theme-description">{theme.description}</p>
              <div className="theme-arrow">→</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ThemeCards;
