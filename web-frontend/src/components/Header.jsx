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
      case 'profile':        setCurrentView('profile');         break;
      case 'savedTrails':    setCurrentView('savedTrails');     break;
      case 'challenges':     setCurrentView('challenges');      break;
      case 'leaderboards':   setCurrentView('leaderboards');    break;
      case 'planner':        setCurrentView('planner');         break;
      case 'admin':          setCurrentView('admin');           break;
      case 'settings':       setCurrentView('settings');        break;
      case 'home':           setCurrentView('home');            break;
      case 'recommendations':setCurrentView('recommendations'); break;
      case 'catalog':        setCurrentView('catalog');         break;
      case 'rifugios':       setCurrentView('rifugios');        break;
      case 'multiday-trails':setCurrentView('multiday-trails'); break;
      case 'logout':         handleLogout();                    break;
      default: break;
    }
  };

  const getCurrentLanguageLabel = () => {
    const currentLang = i18n.language.split('-')[0];
    return languageLabels[currentLang] || 'EN';
  };

  // Desktop nav items mapping to app views
  const desktopNavItems = [
    { key: 'home',        label: t('nav.home',    'Home') },
    { key: 'catalog',     label: t('nav.explore', 'Explore') },
    { key: 'planner',     label: t('nav.myPlan',  'My Plan') },
    { key: 'savedTrails', label: t('nav.saved',   'Saved') },
  ];

  return (
    <>
      <header className="jph-header">
        <div className="jph-header__inner">

          {/* ── Logo lockup ── */}
          <div
            className="jph-header__logo"
            onClick={() => setCurrentView('home')}
            role="link"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setCurrentView('home')}
            aria-label="Josephine — home"
          >
            <img
              src="/josephine-mark.svg"
              alt="Josephine mark"
              className="jph-header__mark-img"
              aria-hidden="true"
            />
            <div className="jph-header__wordmark-block">
              <span className="jph-header__wordmark">Josephine</span>
              <span className="jph-header__sub">YOUR HUMAN ALPINE COMPANION</span>
            </div>
          </div>

          {/* ── Desktop centre nav ── */}
          <nav className="jph-header__desktop-nav" aria-label="Main navigation">
            {desktopNavItems.map(item => (
              <button
                key={item.key}
                className={`jph-header__nav-item ${currentView === item.key ? 'active' : ''}`}
                onClick={() => setCurrentView(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* ── Right actions ── */}
          <div className="jph-header__actions">
            <button
              className="jph-header__btn jph-header__btn--lang"
              onClick={() => setShowLanguageSheet(true)}
              aria-label={t('language.selectLanguage')}
              title={t('language.selectLanguage')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M 12 2 a 15 15 0 0 1 0 20 M 12 2 a 15 15 0 0 0 0 20"/>
              </svg>
              <span className="jph-header__lang-label">{getCurrentLanguageLabel()}</span>
            </button>

            {currentUser ? (
              <button
                ref={avatarButtonRef}
                className="jph-header__btn jph-header__btn--avatar"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-label="User menu"
                aria-expanded={showUserMenu}
              >
                <div className="jph-header__avatar">
                  {getInitials(currentUser.displayName || currentUser.email)}
                </div>
              </button>
            ) : (
              <button
                className="jph-header__btn jph-header__btn--user"
                onClick={() => setShowLogin(true)}
                aria-label={t('auth.login')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </button>
            )}

            <button
              className="jph-header__btn jph-header__btn--menu"
              onClick={() => setShowHamburger(true)}
              aria-label={t('menu.navigation')}
              aria-expanded={showHamburger}
            >
              <span className="jph-header__menu-bars" aria-hidden="true">
                <span/>
                <span/>
                <span/>
              </span>
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
          switchToSignup={() => { setShowLogin(false); setShowSignup(true); }}
        />
      )}

      {showSignup && (
        <Signup
          onClose={() => setShowSignup(false)}
          switchToLogin={() => { setShowSignup(false); setShowLogin(true); }}
        />
      )}
    </>
  );
}

export default Header;
