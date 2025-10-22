import React from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import './Header.css';

function Header({ currentView, setCurrentView }) {
  const { t } = useTranslation();

  return (
    <header className="header">
      <div className="container header-content">
        <div className="logo" onClick={() => setCurrentView('home')}>
          <span className="logo-icon">🏔️</span>
          <span className="logo-text">Alpenvia</span>
        </div>
        
        <nav className="nav">
          <button 
            className={`nav-link ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentView('home')}
          >
            {t('nav.home')}
          </button>
          <button 
            className={`nav-link ${currentView === 'recommendations' ? 'active' : ''}`}
            onClick={() => setCurrentView('recommendations')}
          >
            {t('nav.smartRecommendations')}
          </button>
          <button 
            className={`nav-link ${currentView === 'catalog' ? 'active' : ''}`}
            onClick={() => setCurrentView('catalog')}
          >
            {t('nav.trailCatalog')}
          </button>
        </nav>

        <LanguageSwitcher />
      </div>
    </header>
  );
}

export default Header;
