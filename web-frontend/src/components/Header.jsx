import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import HamburgerMenu from './HamburgerMenu';
import LanguageBottomSheet from './LanguageBottomSheet';
import Login from './Login';
import Signup from './Signup';
import UserMenuPortal from './UserMenuPortal';
import './Header.css';

const languageLabels = {
  en: 'EN',
  it: 'IT',
  de: 'DE'
};

function Header({ currentView, setCurrentView }) {
  const { t, i18n } = useTranslation();
  const { currentUser, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHamburger, setShowHamburger] = useState(false);
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);
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
      case 'savedTrails':
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
      case 'home':
        setCurrentView('home');
        break;
      case 'recommendations':
        setCurrentView('recommendations');
        break;
      case 'catalog':
        setCurrentView('catalog');
        break;
      case 'rifugios':
        setCurrentView('rifugios');
        break;
      case 'multiday-trails':
        setCurrentView('multiday-trails');
        break;
      case 'logout':
        handleLogout();
        break;
      default:
        break;
    }
  };

  const getCurrentLanguageLabel = () => {
    const currentLang = i18n.language.split('-')[0];
    return languageLabels[currentLang] || 'EN';
  };

  return (
    <>
      <header className="header header-mobile-redesign">
        <div className="container header-content-mobile">
          <div className="logo logo-mobile" onClick={() => setCurrentView('home')}>
            <span className="logo-icon logo-icon-mobile">🏔️</span>
            <span className="logo-text logo-text-mobile">Alpenvia</span>
          </div>
          
          <div className="header-actions-mobile">
            <button
              className="header-icon-btn language-btn-mobile"
              onClick={() => setShowLanguageSheet(true)}
              aria-label={t('language.selectLanguage')}
              title={t('language.selectLanguage')}
            >
              <span className="language-icon">🌐</span>
              <span className="language-label-mobile">{getCurrentLanguageLabel()}</span>
              <span className="language-chevron">▼</span>
            </button>
            
            {currentUser ? (
              <button 
                ref={avatarButtonRef}
                className="header-icon-btn user-btn-mobile"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-label="User menu"
                aria-expanded={showUserMenu}
              >
                <div className="user-avatar user-avatar-mobile">
                  {getInitials(currentUser.displayName || currentUser.email)}
                </div>
              </button>
            ) : (
              <button 
                className="header-icon-btn auth-btn-mobile"
                onClick={() => setShowLogin(true)}
                aria-label={t('auth.login')}
              >
                <span className="auth-icon">👤</span>
              </button>
            )}

            <button
              className="header-icon-btn hamburger-btn-mobile"
              onClick={() => setShowHamburger(true)}
              aria-label={t('menu.navigation')}
              aria-expanded={showHamburger}
            >
              <span className="hamburger-icon">☰</span>
            </button>

            {currentUser && (
              <UserMenuPortal
                isOpen={showUserMenu}
                onClose={() => setShowUserMenu(false)}
                anchorRef={avatarButtonRef}
                userEmail={currentUser.email}
                isAdmin={currentUser.email === 'vladmunteanu2204@gmail.com'}
                onNavigate={handleMenuNavigation}
              />
            )}
          </div>
        </div>
      </header>

      <HamburgerMenu
        isOpen={showHamburger}
        onClose={() => setShowHamburger(false)}
        currentView={currentView}
        onNavigate={handleMenuNavigation}
        onLogout={handleLogout}
      />

      <LanguageBottomSheet
        isOpen={showLanguageSheet}
        onClose={() => setShowLanguageSheet(false)}
      />

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
