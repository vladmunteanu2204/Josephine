import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import AuthPromptModal from './AuthPromptModal';
import './BottomNav.css';

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M3 10L11 3L19 10V19H14V14H8V19H3V10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

const ExploreIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M7 3L2 5.5V18.5L7 16L13 18.5L18 16V3L13 5.5L7 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M7 3V16M13 5.5V18.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const PlanIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="3" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 2V6M14 2V6M3 10H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 14H14M8 17H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const SavedIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M11 18.5L4 11.5C3 10.5 2.5 9.5 2.5 8C2.5 5.8 4.2 4 6.5 4C8 4 9.2 4.6 11 7C12.8 4.6 14 4 15.5 4C17.8 4 19.5 5.8 19.5 8C19.5 9.5 19 10.5 18 11.5L11 18.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);


const GATED_VIEWS = ['planner', 'savedTrails'];

function BottomNav({ currentView, setCurrentView, onJosephineOpen, onShowLogin }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authPromptMsg, setAuthPromptMsg] = useState('');

  const handleTabClick = (key) => {
    if (GATED_VIEWS.includes(key) && !currentUser) {
      setAuthPromptMsg(
        key === 'savedTrails'
          ? 'Sign in to see your saved trails across all your devices.'
          : 'Sign in to access trip planning and personalised features.'
      );
      setShowAuthPrompt(true);
      return;
    }
    setCurrentView(key);
  };

  const tabs = [
    { key: 'home',        label: t('nav.home',    'Home'),    Icon: HomeIcon    },
    { key: 'catalog',     label: t('nav.explore', 'Explore'), Icon: ExploreIcon },
    { key: 'planner',     label: t('nav.myPlan',  'My Plan'), Icon: PlanIcon    },
    { key: 'savedTrails', label: t('nav.saved',   'Saved'),   Icon: SavedIcon   },
  ];
  return (
    <>
    <nav className="jph-bottom-nav" aria-label="Main navigation">
      {/* First 2 tabs */}
      {tabs.slice(0, 2).map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`jph-bottom-nav__tab ${currentView === key ? 'active' : ''}`}
          onClick={() => handleTabClick(key)}
          aria-label={label}
          aria-current={currentView === key ? 'page' : undefined}
        >
          <span className="jph-bottom-nav__icon"><Icon /></span>
          <span className="jph-bottom-nav__label">{label}</span>
        </button>
      ))}

      {/* Centre Josephine button */}
      <button
        className="jph-bottom-nav__josephine"
        onClick={() => setCurrentView('josephine')}
        aria-label="Talk to Josephine"
      >
        <div className="jph-bottom-nav__j-ring">
          <img src="/josephine-mark.svg" alt="" className="jph-bottom-nav__j-mark" />
        </div>
      </button>

      {/* Last 2 tabs */}
      {tabs.slice(2).map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`jph-bottom-nav__tab ${currentView === key ? 'active' : ''}`}
          onClick={() => handleTabClick(key)}
          aria-label={label}
          aria-current={currentView === key ? 'page' : undefined}
        >
          <span className="jph-bottom-nav__icon"><Icon /></span>
          <span className="jph-bottom-nav__label">{label}</span>
        </button>
      ))}
    </nav>

      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        onLogin={() => { setShowAuthPrompt(false); onShowLogin?.(); }}
        message={authPromptMsg}
      />
    </>
  );
}

export default BottomNav;
