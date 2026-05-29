import React from 'react';
import { useTranslation } from 'react-i18next';
import './ThemeCards.css';

function ThemeCards({ onThemeClick }) {
  const { t } = useTranslation();

  const themes = [
    {
      id: 'lake-day',
      icon: '◈',
      title: t('home.themeLakeDay'),
      description: t('home.themeLakeDayDesc'),
      accent: '#7aa8c4',
      bg: 'linear-gradient(145deg, #0d1f2d 0%, #0a1520 100%)',
      tags: ['alpine lakes'],
    },
    {
      id: 'malga',
      icon: '◈',
      title: t('home.themeMalga'),
      description: t('home.themeMalgaDesc'),
      accent: '#c9a84c',
      bg: 'linear-gradient(145deg, #1a1408 0%, #110e05 100%)',
      tags: ['malga', 'food'],
    },
    {
      id: 'easy-walk',
      icon: '◈',
      title: t('home.themeEasyWalk'),
      description: t('home.themeEasyWalkDesc'),
      accent: '#7abf8a',
      bg: 'linear-gradient(145deg, #0a1a0d 0%, #061008 100%)',
      tags: ['easy', 'scenic'],
    },
    {
      id: 'dog-friendly',
      icon: '◈',
      title: t('home.themeDogFriendly'),
      description: t('home.themeDogFriendlyDesc'),
      accent: '#c9a84c',
      bg: 'linear-gradient(145deg, #18140a 0%, #100e06 100%)',
      tags: ['dog friendly'],
    },
    {
      id: 'romantic',
      icon: '◈',
      title: t('home.themeRomantic'),
      description: t('home.themeRomanticDesc'),
      accent: '#c49aa0',
      bg: 'linear-gradient(145deg, #1a0e10 0%, #10080a 100%)',
      tags: ['panoramic views', 'romantic'],
    },
    {
      id: 'rainy-day',
      icon: '◈',
      title: t('home.themeRainyDay'),
      description: t('home.themeRainyDayDesc'),
      accent: '#8fa8b4',
      bg: 'linear-gradient(145deg, #0e1418 0%, #080e12 100%)',
      tags: ['forests', 'covered'],
    },
    {
      id: 'parents',
      icon: '◈',
      title: t('home.themeParents'),
      description: t('home.themeParentsDesc'),
      accent: '#a49abf',
      bg: 'linear-gradient(145deg, #14101a 0%, #0c0810 100%)',
      tags: ['family friendly', 'easy'],
    },
    {
      id: 'half-day',
      icon: '◈',
      title: t('home.themeHalfDay'),
      description: t('home.themeHalfDayDesc'),
      accent: '#7ab4a8',
      bg: 'linear-gradient(145deg, #0a1614 0%, #060e0c 100%)',
      tags: ['short'],
    },
    {
      id: 'hut-to-hut',
      icon: '◈',
      title: t('home.themeHutToHut'),
      description: t('home.themeHutToHutDesc'),
      accent: '#c9a84c',
      bg: 'linear-gradient(145deg, #1a1508 0%, #100e04 100%)',
      tags: ['multi-day', 'rifugio'],
    },
  ];

  return (
    <div className="theme-cards-section">
      <div className="theme-cards-header">
        <p className="theme-cards-eyebrow">EXPLORE BY MOOD</p>
        <h2 className="section-title-large">{t('home.exploreByTheme')}</h2>
        <p className="section-subtitle">{t('home.exploreByThemeDesc')}</p>
      </div>

      <div className="theme-cards-grid">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className="theme-card"
            onClick={() => onThemeClick && onThemeClick(theme.tags)}
            style={{ '--accent': theme.accent, background: theme.bg }}
          >
            <div className="theme-card-inner">
              <span className="theme-accent-dot" style={{ background: theme.accent }} />
              <h3 className="theme-title">{theme.title}</h3>
              <p className="theme-description">{theme.description}</p>
              <span className="theme-arrow" style={{ color: theme.accent }}>Explore →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ThemeCards;
