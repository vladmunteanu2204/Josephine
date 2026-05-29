import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { ENABLE_GAMIFICATION } from '../featureFlags';
import './HamburgerMenu.css';

function HamburgerMenu({ isOpen, onClose, currentView, onNavigate, onLogout }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const svgIcons = {
    home: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 9L10 2L17 9V18H13V13H7V18H3V9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    recommendations: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2L10 4M10 16L10 18M2 10H4M16 10H18M4.93 4.93L6.34 6.34M13.66 13.66L15.07 15.07M4.93 15.07L6.34 13.66M13.66 6.34L15.07 4.93" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    catalog: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 2L2 4.5V17.5L7 15L13 17.5L18 15V2L13 4.5L7 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M7 2V15M13 4.5V17.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    rifugios: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 18L6 8L10 3L14 8L18 18H2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        <path d="M7 18V13H13V18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    planner: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 2V6M13 2V6M3 9H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M7 13H13M7 16H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    profile: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 18C3 15.2386 6.13401 13 10 13C13.866 13 17 15.2386 17 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    savedTrails: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 17L3.5 10.5C2.5 9.5 2 8.5 2 7C2 5 3.5 3 6 3C7.5 3 8.5 3.5 10 5.5C11.5 3.5 12.5 3 14 3C16.5 3 18 5 18 7C18 8.5 17.5 9.5 16.5 10.5L10 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    settings: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 3V5M10 15V17M3 10H5M15 10H17M4.93 4.93L6.34 6.34M13.66 13.66L15.07 15.07M4.93 15.07L6.34 13.66M13.66 6.34L15.07 4.93" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    challenges: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2L12.6 7.3L18.5 8.2L14.25 12.3L15.2 18.2L10 15.4L4.8 18.2L5.75 12.3L1.5 8.2L7.4 7.3L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    leaderboards: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="12" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="8" y="7" width="4" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="2" width="4" height="16" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    admin: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 7H13M7 10H13M7 13H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    logout: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 3H16C17.1 3 18 3.9 18 5V15C18 16.1 17.1 17 16 17H13M8 14L13 10L8 6M13 10H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  };

  const mainMenuItems = [
    { key: 'home', label: t('nav.home') },
    { key: 'recommendations', label: t('nav.smartRecommendations') },
    { key: 'catalog', label: t('nav.trailCatalog') },
    { key: 'rifugios', label: t('nav.rifugios') },
    { key: 'planner', label: t('nav.hikePlanner') }
  ];

  const userMenuItems = currentUser ? [
    { key: 'profile', label: t('profile.title') },
    { key: 'savedTrails', label: t('profile.savedTrails') },
    { key: 'settings', label: t('settings.title') }
  ] : [];

  const secondaryMenuItems = ENABLE_GAMIFICATION && currentUser ? [
    { key: 'challenges', label: t('challenges.title') },
    { key: 'leaderboards', label: t('leaderboards.title') }
  ] : [];

  const isAdmin = currentUser?.email === 'vladmunteanu2204@gmail.com';

  const handleItemClick = (key) => {
    if (key === 'logout') {
      onLogout();
    } else {
      onNavigate(key);
    }
    onClose();
  };

  return (
    <>
      <div 
        className="hamburger-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div 
        className="hamburger-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t('menu.navigation')}
      >
        <div className="hamburger-header">
          <h2 className="hamburger-title">{t('menu.navigation')}</h2>
          <button 
            className="hamburger-close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        <nav className="hamburger-nav">
          <div className="hamburger-section">
            {mainMenuItems.map((item) => (
              <button
                key={item.key}
                className={`hamburger-item ${currentView === item.key ? 'active' : ''}`}
                onClick={() => handleItemClick(item.key)}
              >
                <span className="hamburger-item-icon">{svgIcons[item.key]}</span>
                <span className="hamburger-item-label">{item.label}</span>
                {currentView === item.key && <span className="hamburger-item-indicator">•</span>}
              </button>
            ))}
          </div>

          {currentUser && userMenuItems.length > 0 && (
            <>
              <div className="hamburger-divider"></div>
              <div className="hamburger-section">
                {userMenuItems.map((item) => (
                  <button
                    key={item.key}
                    className={`hamburger-item ${currentView === item.key ? 'active' : ''}`}
                    onClick={() => handleItemClick(item.key)}
                  >
                    <span className="hamburger-item-icon">{svgIcons[item.key]}</span>
                    <span className="hamburger-item-label">{item.label}</span>
                    {currentView === item.key && <span className="hamburger-item-indicator">•</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {currentUser && secondaryMenuItems.length > 0 && (
            <>
              <div className="hamburger-divider"></div>
              <div className="hamburger-section">
                {secondaryMenuItems.map((item) => (
                  <button
                    key={item.key}
                    className={`hamburger-item ${currentView === item.key ? 'active' : ''}`}
                    onClick={() => handleItemClick(item.key)}
                  >
                    <span className="hamburger-item-icon">{svgIcons[item.key]}</span>
                    <span className="hamburger-item-label">{item.label}</span>
                    {currentView === item.key && <span className="hamburger-item-indicator">•</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {isAdmin && (
            <>
              <div className="hamburger-divider"></div>
              <div className="hamburger-section">
                <button
                  className={`hamburger-item ${currentView === 'admin' ? 'active' : ''}`}
                  onClick={() => handleItemClick('admin')}
                >
                  <span className="hamburger-item-icon">{svgIcons.admin}</span>
                  <span className="hamburger-item-label">{t('admin.title')}</span>
                  {currentView === 'admin' && <span className="hamburger-item-indicator">•</span>}
                </button>
              </div>
            </>
          )}

          {currentUser && (
            <>
              <div className="hamburger-divider"></div>
              <div className="hamburger-section">
                <button
                  className="hamburger-item hamburger-logout"
                  onClick={() => handleItemClick('logout')}
                >
                  <span className="hamburger-item-icon">{svgIcons.logout}</span>
                  <span className="hamburger-item-label">{t('auth.logout')}</span>
                </button>
              </div>
            </>
          )}
        </nav>
      </div>
    </>
  );
}

export default HamburgerMenu;
