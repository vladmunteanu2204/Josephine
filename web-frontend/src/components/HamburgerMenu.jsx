import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import Icon from './Icon';
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

  const mainMenuItems = [
    { key: 'home', iconType: 'lucide', iconName: 'Home', label: t('nav.home') },
    { key: 'recommendations', iconType: 'lucide', iconName: 'Sparkles', label: t('nav.smartRecommendations') },
    { key: 'catalog', iconType: '3d', iconName: 'compass', label: t('nav.trailCatalog') },
    { key: 'rifugios', iconType: '3d', iconName: 'mountain-logo', label: t('nav.rifugios') },
    { key: 'planner', iconType: 'lucide', iconName: 'Calendar', label: t('nav.hikePlanner') }
  ];

  const userMenuItems = currentUser ? [
    { key: 'profile', iconType: 'lucide', iconName: 'User', label: t('profile.title') },
    { key: 'savedTrails', iconType: 'lucide', iconName: 'Heart', label: t('profile.savedTrails') },
    { key: 'challenges', iconType: 'lucide', iconName: 'Target', label: t('challenges.title') },
    { key: 'leaderboards', iconType: '3d', iconName: 'trophy', label: t('leaderboards.title') },
    { key: 'settings', iconType: 'lucide', iconName: 'Settings', label: t('settings.title') }
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
            <Icon type="lucide" name="X" size={24} tone="neutral" />
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
                <span className="hamburger-item-icon">
                  <Icon type={item.iconType} name={item.iconName} size={20} tone="alpine" />
                </span>
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
                    <span className="hamburger-item-icon">
                      <Icon type={item.iconType} name={item.iconName} size={20} tone="alpine" />
                    </span>
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
                  <span className="hamburger-item-icon">
                    <Icon type="lucide" name="Lock" size={20} tone="gold" />
                  </span>
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
                  <span className="hamburger-item-icon">
                    <Icon type="lucide" name="LogOut" size={20} tone="neutral" />
                  </span>
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
