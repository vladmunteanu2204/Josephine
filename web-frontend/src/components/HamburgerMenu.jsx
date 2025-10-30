import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import './HamburgerMenu.css';

function HamburgerMenu({ isOpen, onClose, currentView, setCurrentView }) {
  const { t } = useTranslation();
  const { currentUser, logout } = useAuth();
  const menuRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      // Focus the close button when menu opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
      
      // Handle Escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleNavigation = (view) => {
    setCurrentView(view);
    onClose();
  };

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentView('home');
      onClose();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!isOpen) return null;

  const menuItems = [
    { id: 'home', icon: '🏠', label: t('nav.home') },
    { id: 'recommendations', icon: '✨', label: t('nav.smartRecommendations') },
    { id: 'catalog', icon: '🗺️', label: t('nav.trailCatalog') },
    { id: 'planner', icon: '📅', label: t('nav.hikePlanner') },
  ];

  const userMenuItems = currentUser ? [
    { id: 'profile', icon: '👤', label: t('header.profile') },
    { id: 'savedTrails', icon: '❤️', label: t('header.savedTrails') },
    { id: 'challenges', icon: '🏆', label: t('header.challenges') },
    { id: 'leaderboards', icon: '📊', label: t('header.leaderboards') },
    { id: 'settings', icon: '⚙️', label: t('header.settings') },
  ] : [];

  const adminMenuItem = currentUser?.email === 'vladmunteanu2204@gmail.com' ? [
    { id: 'admin', icon: '🔧', label: t('header.adminPanel') }
  ] : [];

  const menuContent = (
    <div 
      className="hamburger-menu-overlay" 
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hamburger-menu-title"
    >
      <div className="hamburger-menu" ref={menuRef}>
        <div className="hamburger-header">
          <h3 id="hamburger-menu-title" className="hamburger-title">Menu</h3>
          <button 
            ref={closeButtonRef}
            className="hamburger-close" 
            onClick={onClose} 
            aria-label="Close navigation menu"
          >
            ✕
          </button>
        </div>

        <div className="hamburger-content">
          {/* Main Navigation */}
          <div className="menu-section">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`menu-item ${currentView === item.id ? 'active' : ''}`}
                onClick={() => handleNavigation(item.id)}
              >
                <span className="menu-icon">{item.icon}</span>
                <span className="menu-label">{item.label}</span>
              </button>
            ))}
          </div>

          {/* User Section */}
          {currentUser && userMenuItems.length > 0 && (
            <>
              <div className="menu-divider"></div>
              <div className="menu-section">
                <div className="menu-section-title">{t('common.profile')}</div>
                {userMenuItems.map((item) => (
                  <button
                    key={item.id}
                    className={`menu-item ${currentView === item.id ? 'active' : ''}`}
                    onClick={() => handleNavigation(item.id)}
                  >
                    <span className="menu-icon">{item.icon}</span>
                    <span className="menu-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Admin Section */}
          {adminMenuItem.length > 0 && (
            <>
              <div className="menu-divider"></div>
              <div className="menu-section">
                {adminMenuItem.map((item) => (
                  <button
                    key={item.id}
                    className={`menu-item ${currentView === item.id ? 'active' : ''}`}
                    onClick={() => handleNavigation(item.id)}
                  >
                    <span className="menu-icon">{item.icon}</span>
                    <span className="menu-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Logout Button */}
          {currentUser && (
            <>
              <div className="menu-divider"></div>
              <button className="menu-item logout-item" onClick={handleLogout}>
                <span className="menu-icon">🚪</span>
                <span className="menu-label">{t('header.logout')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(menuContent, document.body);
}

export default HamburgerMenu;
