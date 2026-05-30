import React, { useState, useEffect } from 'react';
import './App.css';
import { ENABLE_HIKE_TRACKING, ENABLE_GAMIFICATION } from './featureFlags';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Header from './components/Header';
import Home from './components/Home';
import SmartRecommendations from './components/SmartRecommendations';
import TrailCatalog from './components/TrailCatalog';
import TrailDetail from './components/TrailDetail';
import Profile from './components/Profile';
import SavedTrails from './components/SavedTrails';
import Settings from './components/Settings';
import Leaderboards from './components/Leaderboards';
import HikePlanner from './components/HikePlanner';
import TermsAndConditions from './components/TermsAndConditions';
import PrivacyPolicy from './components/PrivacyPolicy';
import AdminPanel from './components/AdminPanel';
import Challenges from './components/Challenges';
import Rifugios from './components/Rifugios';
import RifugioDetail from './components/RifugioDetail';
import MultiDayTrails from './components/MultiDayTrails';
import MultiDayTrailDetail from './components/MultiDayTrailDetail';
import SplashScreen from './components/SplashScreen';
import Footer from './components/Footer';
import JosephineWidget from './components/JosephineWidget';
import BottomNav from './components/BottomNav';
import JosephineChat from './components/JosephineChat';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [previousView, setPreviousView] = useState('home');
  const [selectedTrail, setSelectedTrail] = useState(null);
  const [selectedRifugio, setSelectedRifugio] = useState(null);
  const [selectedMultiDayTrail, setSelectedMultiDayTrail] = useState(null);
  const [catalogInitialTags, setCatalogInitialTags] = useState([]);
  const [showSplash, setShowSplash] = useState(true);
  const [isGPSActive, setIsGPSActive] = useState(false);

  // Sync view to URL hash for back-button support and shareable links
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && hash !== currentView) {
      setCurrentView(hash);
    }
  }, []);

  // Redirect any disabled-feature views to home — catches all paths
  // (hash changes, popstate, direct setCurrentView calls, UserMenuPortal, etc.)
  useEffect(() => {
    const disabledViews = [
      ...(!ENABLE_GAMIFICATION ? ['challenges', 'leaderboards'] : []),
      ...(!ENABLE_HIKE_TRACKING ? ['hike'] : []),
    ];
    if (disabledViews.includes(currentView)) {
      setCurrentView('home');
    }
  }, [currentView]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash !== currentView) {
      window.history.pushState(null, '', `#${currentView}`);
    }
  }, [currentView]);

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.slice(1);
      if (hash) setCurrentView(hash);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const viewTrail = (trail) => {
    setPreviousView(currentView);
    setSelectedTrail(trail);
    setCurrentView('detail');
  };

  const viewRifugio = (rifugio) => {
    setPreviousView(currentView);
    setSelectedRifugio(rifugio?.id || rifugio);
    setCurrentView('rifugio-detail');
  };

  const navigate = (view, param = null) => {
    // Redirect disabled feature routes to home
    if (!ENABLE_GAMIFICATION && (view === 'challenges' || view === 'leaderboards')) {
      setCurrentView('home');
      return;
    }
    if (!ENABLE_HIKE_TRACKING && view === 'hike') {
      setCurrentView('home');
      return;
    }

    if (view === 'detail' || view === 'rifugio-detail' || view === 'multiday-detail') {
      setPreviousView(currentView);
    }
    
    if (param) {
      setCurrentView(view);
      if (view === 'detail') {
        setSelectedTrail({ id: param });
      } else if (view === 'rifugio-detail') {
        setSelectedRifugio(param);
      } else if (view === 'multiday-detail') {
        setSelectedMultiDayTrail(param);
      }
    } else {
      setCurrentView(view);
    }
  };

  const goBack = () => {
    setCurrentView(previousView);
  };

  return (
    <div className="app">
      <ToastProvider>
        <AuthProvider>
          {(!isGPSActive || !ENABLE_HIKE_TRACKING) && <Header currentView={currentView} setCurrentView={setCurrentView} />}
        
        <main className="main-content">
          {currentView === 'home' && (
            <Home
              setCurrentView={setCurrentView}
              navigateToCatalog={(tags) => { setCatalogInitialTags(tags || []); setCurrentView('catalog'); }}
              viewTrail={viewTrail}
            />
          )}

          {currentView === 'recommendations' && (
            <SmartRecommendations viewTrail={viewTrail} onBack={goBack} />
          )}

          {currentView === 'catalog' && (
            <TrailCatalog viewTrail={viewTrail} initialTags={catalogInitialTags} onTagsConsumed={() => setCatalogInitialTags([])} />
          )}
          
          {currentView === 'detail' && selectedTrail && (
            <TrailDetail
              trail={selectedTrail}
              onBack={goBack}
              setIsGPSActive={setIsGPSActive}
              viewRifugio={viewRifugio}
            />
          )}

          {currentView === 'profile' && (
            <Profile onNavigate={navigate} />
          )}

          {currentView === 'savedTrails' && (
            <SavedTrails onNavigate={navigate} />
          )}

          {currentView === 'settings' && (
            <Settings onNavigate={navigate} />
          )}

          {ENABLE_GAMIFICATION && currentView === 'leaderboards' && (
            <Leaderboards onNavigate={navigate} />
          )}

          {currentView === 'planner' && (
            <HikePlanner onNavigate={navigate} />
          )}

          {currentView === 'terms' && (
            <TermsAndConditions onBack={goBack} />
          )}

          {currentView === 'privacy' && (
            <PrivacyPolicy onBack={goBack} />
          )}

          {currentView === 'admin' && (
            <AdminPanel onNavigate={navigate} />
          )}

          {ENABLE_GAMIFICATION && currentView === 'challenges' && (
            <Challenges onNavigate={navigate} />
          )}

          {currentView === 'rifugios' && (
            <Rifugios onNavigate={navigate} />
          )}

          {currentView === 'rifugio-detail' && selectedRifugio && (
            <RifugioDetail rifugioId={selectedRifugio} onNavigate={navigate} />
          )}

          {currentView === 'multiday-trails' && (
            <MultiDayTrails onNavigate={navigate} />
          )}

          {currentView === 'multiday-detail' && selectedMultiDayTrail && (
            <MultiDayTrailDetail trailId={selectedMultiDayTrail} onNavigate={navigate} />
          )}

          {currentView === 'josephine' && (
            <JosephineChat onBack={goBack} setCurrentView={setCurrentView} viewTrail={viewTrail} />
          )}
        </main>

        <Footer setCurrentView={setCurrentView} />

        <BottomNav
          currentView={currentView}
          setCurrentView={setCurrentView}
          onJosephineOpen={() => setCurrentView('recommendations')}
        />

        <JosephineWidget setCurrentView={setCurrentView} />



        {showSplash && (
          <SplashScreen onComplete={() => setShowSplash(false)} />
        )}
        </AuthProvider>
      </ToastProvider>
    </div>
  );
}

export default App;
