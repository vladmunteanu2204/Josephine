import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import Login from './Login';
import Signup from './Signup';
import './Header.css';

function Header({ currentView, setCurrentView }) {
  const { t } = useTranslation();
  const { currentUser, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
      setCurrentView('home');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
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

          <div className="header-actions">
            <LanguageSwitcher />
            
            {currentUser ? (
              <div className="user-menu-container">
                <button 
                  className="user-menu-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <div className="user-avatar">
                    {getInitials(currentUser.displayName || currentUser.email)}
                  </div>
                  <span className="user-name-header">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                </button>

                {showUserMenu && (
                  <div className="user-menu-dropdown">
                    <button 
                      className="user-menu-item"
                      onClick={() => {
                        setCurrentView('profile');
                        setShowUserMenu(false);
                      }}
                    >
                      <span>👤</span>
                      {t('auth.profile')}
                    </button>
                    <button 
                      className="user-menu-item"
                      onClick={() => {
                        setCurrentView('savedTrails');
                        setShowUserMenu(false);
                      }}
                    >
                      <span>❤️</span>
                      {t('auth.savedTrails')}
                    </button>
                    <button 
                      className="user-menu-item"
                      onClick={() => {
                        setCurrentView('settings');
                        setShowUserMenu(false);
                      }}
                    >
                      <span>⚙️</span>
                      {t('auth.settings')}
                    </button>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }}></div>
                    <button className="user-menu-item logout" onClick={handleLogout}>
                      <span>🚪</span>
                      {t('auth.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-buttons">
                <button 
                  className="auth-btn login-btn"
                  onClick={() => setShowLogin(true)}
                >
                  {t('auth.login')}
                </button>
                <button 
                  className="auth-btn signup-btn"
                  onClick={() => setShowSignup(true)}
                >
                  {t('auth.signup')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showLogin && (
        <Login 
          onClose={() => setShowLogin(false)}
          switchToSignup={() => {
            setShowLogin(false);
            setShowSignup(true);
          }}
        />
      )}

      {showSignup && (
        <Signup 
          onClose={() => setShowSignup(false)}
          switchToLogin={() => {
            setShowSignup(false);
            setShowLogin(true);
          }}
        />
      )}
    </>
  );
}

export default Header;
