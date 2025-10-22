import React from 'react';
import { useTranslation } from 'react-i18next';
import './ThemeCards.css';

function ThemeCards({ onThemeClick }) {
  const { t } = useTranslation();

  const themes = [
    {
      id: 'lakes',
      icon: '💧',
      title: t('home.themeLakes'),
      description: t('home.themeLakesDesc'),
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      tags: ['alpine lakes']
    },
    {
      id: 'peaks',
      icon: '⛰️',
      title: t('home.themePeaks'),
      description: t('home.themePeaksDesc'),
      color: '#8b5cf6',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      tags: ['panoramic views']
    },
    {
      id: 'forests',
      icon: '🌲',
      title: t('home.themeForests'),
      description: t('home.themeForestsDesc'),
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      tags: ['forests']
    },
    {
      id: 'family',
      icon: '👨‍👩‍👧‍👦',
      title: t('home.themeFamily'),
      description: t('home.themeFamilyDesc'),
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      tags: ['family friendly']
    },
    {
      id: 'culture',
      icon: '🏛️',
      title: t('home.themeCulture'),
      description: t('home.themeCultureDesc'),
      color: '#ec4899',
      gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      tags: ['cultural routes']
    },
    {
      id: 'loops',
      icon: '🔄',
      title: t('home.themeLoops'),
      description: t('home.themeLoopsDesc'),
      color: '#d4a574',
      gradient: 'linear-gradient(135deg, #d4a574 0%, #c89660 100%)',
      tags: ['loop trail']
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
