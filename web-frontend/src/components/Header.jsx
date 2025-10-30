import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import Login from './Login';
import Signup from './Signup';
import UserMenuPortal from './UserMenuPortal';
import './Header.css';

function Header({ currentView, setCurrentView }) {
  const { t } = useTranslation();
  const { currentUser, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const avatarButtonRef = useRef(null);

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

  const handleMenuNavigation = (key) => {
    switch(key) {
      case 'profile':
        setCurrentView('profile');
        break;
      case 'saved':
        setCurrentView('savedTrails');
        break;
      case 'challenges':
        setCurrentView('challenges');
        break;
      case 'leaderboards':
        setCurrentView('leaderboards');
        break;
      case 'planner':
        setCurrentView('planner');
        break;
      case 'admin':
        setCurrentView('admin');
        break;
      case 'settings':
        setCurrentView('settings');
        break;
      case 'logout':
        handleLogout();
        break;
      default:
        break;
    }
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
            <button 
              className={`nav-link ${currentView === 'planner' ? 'active' : ''}`}
              onClick={() => setCurrentView('planner')}
            >
              {t('nav.hikePlanner')}
            </button>
          </nav>

          <div className="header-actions">
            <LanguageSwitcher />
            
            {currentUser ? (
              <>
                <button 
                  ref={avatarButtonRef}
                  className="user-menu-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-label="User menu"
                  aria-expanded={showUserMenu}
                >
                  <div className="user-avatar">
                    {getInitials(currentUser.displayName || currentUser.email)}
                  </div>
                  <span className="user-name-header">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                </button>

                <UserMenuPortal
                  isOpen={showUserMenu}
                  onClose={() => setShowUserMenu(false)}
                  anchorRef={avatarButtonRef}
                  userEmail={currentUser.email}
                  isAdmin={currentUser.email === 'vladmunteanu2204@gmail.com'}
                  onNavigate={handleMenuNavigation}
                />
              </>
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
