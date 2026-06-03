import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home as HomeIcon, Map as ExploreIcon, CalendarRange as PlanIcon, Heart as SavedIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthPromptModal from './AuthPromptModal';
import './BottomNav.css';

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
          ? 'Sign in to save and revisit your favourite trails.'
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
          <span className="jph-bottom-nav__icon"><Icon size={22} strokeWidth={1.75} /></span>
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
          <img src="/logo.webp" alt="" className="jph-bottom-nav__j-mark" />
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
          <span className="jph-bottom-nav__icon"><Icon size={22} strokeWidth={1.75} /></span>
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
