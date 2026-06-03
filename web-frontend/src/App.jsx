import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import './App.css';
import { ENABLE_HIKE_TRACKING, ENABLE_GAMIFICATION } from './featureFlags';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { SeasonProvider } from './contexts/SeasonContext';
// Always-visible shell (eager)
import Header from './components/Header';
import Home from './components/Home';
import SplashScreen from './components/SplashScreen';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';

// Route views — lazy-loaded on first visit
const SmartRecommendations = lazy(() => import('./components/SmartRecommendations'));
const TrailCatalog         = lazy(() => import('./components/TrailCatalog'));
const TrailDetail          = lazy(() => import('./components/TrailDetail'));
const Profile              = lazy(() => import('./components/Profile'));
const SavedTrails          = lazy(() => import('./components/SavedTrails'));
const Settings             = lazy(() => import('./components/Settings'));
const Leaderboards         = lazy(() => import('./components/Leaderboards'));
const MyPlan               = lazy(() => import('./components/planner/MyPlan'));
const TermsAndConditions   = lazy(() => import('./components/TermsAndConditions'));
const PrivacyPolicy        = lazy(() => import('./components/PrivacyPolicy'));
const AdminPanel           = lazy(() => import('./components/AdminPanel'));
const Challenges           = lazy(() => import('./components/Challenges'));
const Rifugios             = lazy(() => import('./components/Rifugios'));
const RifugioDetail        = lazy(() => import('./components/RifugioDetail'));
const MultiDayTrails       = lazy(() => import('./components/MultiDayTrails'));
const MultiDayTrailDetail  = lazy(() => import('./components/MultiDayTrailDetail'));
const JosephineChat        = lazy(() => import('./components/JosephineChat'));
const Donate               = lazy(() => import('./components/Donate'));

// Redirects guests away from members-only views and shows the login prompt.
// AuthProvider already holds children until auth is resolved, so currentUser
// is always final (never in a loading state) by the time this renders.
function GuestGuard({ setCurrentView, onShowLogin, children }) {
  const { currentUser } = useAuth();
  useEffect(() => {
    if (!currentUser) {
      setCurrentView('home');
      onShowLogin?.();
    }
  }, [currentUser, setCurrentView, onShowLogin]);
  if (!currentUser) return null;
  return children;
}

// All hash routes the app knows how to render. Anything else → NotFound.
const KNOWN_VIEWS = new Set([
  'home', 'recommendations', 'catalog', 'detail', 'profile', 'savedTrails',
  'settings', 'leaderboards', 'planner', 'terms', 'privacy', 'admin',
  'challenges', 'rifugios', 'rifugio-detail', 'multiday-trails',
  'multiday-detail', 'josephine', 'donate',
]);

// Shown for an unknown hash (typo, stale/shared link) instead of a blank page.
function NotFound({ onHome }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', textAlign: 'center',
      padding: '2rem', color: 'var(--text-primary, #e8e6df)',
    }}>
      <h1 style={{ fontSize: '3rem', margin: 0 }}>404</h1>
      <p style={{ opacity: 0.8, marginTop: '0.5rem' }}>
        We couldn’t find that page.
      </p>
      <button className="btn-primary" style={{ marginTop: '1.25rem' }} onClick={onHome}>
        Back to home
      </button>
    </div>
  );
}

// Minimal loading fallback — dark bg matches app shell
function ViewLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', background: '#080e08',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '2px solid rgba(201,168,76,0.2)',
        borderTopColor: '#c9a84c',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [previousView, setPreviousView] = useState('home');
  const [selectedTrail, setSelectedTrail] = useState(null);
  const [selectedRifugio, setSelectedRifugio] = useState(null);
  const [selectedMultiDayTrail, setSelectedMultiDayTrail] = useState(null);
  const [catalogInitialTags, setCatalogInitialTags] = useState([]);
  const [rifugiosInitialType, setRifugiosInitialType] = useState('');
  const [rifugiosInitialStatus, setRifugiosInitialStatus] = useState('');
  // Show the splash only once per browser session — returning to the tab or
  // navigating back shouldn't replay the 2-3s intro every time.
  const [showSplash, setShowSplash] = useState(() => {
    try { return !sessionStorage.getItem('jph_splash_seen'); }
    catch { return true; }
  });
  const handleSplashComplete = useCallback(() => {
    try { sessionStorage.setItem('jph_splash_seen', '1'); } catch {}
    setShowSplash(false);
  }, []);
  const [isGPSActive, setIsGPSActive] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

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

  // Detail views need their target held in state. On a hard refresh or a shared
  // link that state is gone, so fall back to the parent list rather than render
  // a blank screen.
  useEffect(() => {
    if (currentView === 'detail' && !selectedTrail) setCurrentView('catalog');
    else if (currentView === 'rifugio-detail' && !selectedRifugio) setCurrentView('rifugios');
    else if (currentView === 'multiday-detail' && !selectedMultiDayTrail) setCurrentView('multiday-trails');
  }, [currentView, selectedTrail, selectedRifugio, selectedMultiDayTrail]);

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
      <SeasonProvider>
      <ToastProvider>
        <AuthProvider>
          {(!isGPSActive || !ENABLE_HIKE_TRACKING) && (
          <Header
            currentView={currentView}
            setCurrentView={setCurrentView}
            showLoginModal={showLoginModal}
            setShowLoginModal={setShowLoginModal}
            navigateToRifugios={(type, status) => { setRifugiosInitialType(type || ''); setRifugiosInitialStatus(status || ''); setCurrentView('rifugios'); }}
          />
        )}
        
        <main className="main-content">
          <Suspense fallback={<ViewLoader />}>
          {currentView === 'home' && (
            <Home
              setCurrentView={setCurrentView}
              navigateToCatalog={(tags) => { setCatalogInitialTags(tags || []); setCurrentView('catalog'); }}
              navigateToRifugios={(type, status) => { setRifugiosInitialType(type || ''); setRifugiosInitialStatus(status || ''); setCurrentView('rifugios'); }}
              viewTrail={viewTrail}
            />
          )}

          {currentView === 'recommendations' && (
            <SmartRecommendations viewTrail={viewTrail} onBack={goBack} />
          )}

          {currentView === 'catalog' && (
            <TrailCatalog viewTrail={viewTrail} initialTags={catalogInitialTags} onTagsConsumed={() => setCatalogInitialTags([])} onShowLogin={() => setShowLoginModal(true)} />
          )}

          {currentView === 'detail' && selectedTrail && (
            <TrailDetail
              trail={selectedTrail}
              onBack={goBack}
              setIsGPSActive={setIsGPSActive}
              viewRifugio={viewRifugio}
              onShowLogin={() => setShowLoginModal(true)}
            />
          )}

          {currentView === 'profile' && (
            <GuestGuard setCurrentView={setCurrentView} onShowLogin={() => setShowLoginModal(true)}>
              <Profile onNavigate={navigate} />
            </GuestGuard>
          )}

          {currentView === 'savedTrails' && (
            <GuestGuard setCurrentView={setCurrentView} onShowLogin={() => setShowLoginModal(true)}>
              <SavedTrails onNavigate={navigate} />
            </GuestGuard>
          )}

          {currentView === 'settings' && (
            <Settings onNavigate={navigate} />
          )}

          {ENABLE_GAMIFICATION && currentView === 'leaderboards' && (
            <GuestGuard setCurrentView={setCurrentView} onShowLogin={() => setShowLoginModal(true)}>
              <Leaderboards onNavigate={navigate} />
            </GuestGuard>
          )}

          {currentView === 'planner' && (
            <GuestGuard setCurrentView={setCurrentView} onShowLogin={() => setShowLoginModal(true)}>
              <MyPlan onNavigate={navigate} />
            </GuestGuard>
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
            <GuestGuard setCurrentView={setCurrentView} onShowLogin={() => setShowLoginModal(true)}>
              <Challenges onNavigate={navigate} />
            </GuestGuard>
          )}

          {currentView === 'rifugios' && (
            <Rifugios
              onNavigate={navigate}
              initialType={rifugiosInitialType}
              onTypeConsumed={() => setRifugiosInitialType('')}
              initialStatus={rifugiosInitialStatus}
              onStatusConsumed={() => setRifugiosInitialStatus('')}
            />
          )}

          {currentView === 'rifugio-detail' && selectedRifugio && (
            <RifugioDetail rifugioId={selectedRifugio} onNavigate={navigate} onShowLogin={() => setShowLoginModal(true)} />
          )}

          {currentView === 'multiday-trails' && (
            <MultiDayTrails onNavigate={navigate} />
          )}

          {currentView === 'multiday-detail' && selectedMultiDayTrail && (
            <MultiDayTrailDetail trailId={selectedMultiDayTrail} onNavigate={navigate} />
          )}

          {currentView === 'josephine' && (
            <JosephineChat onBack={goBack} setCurrentView={setCurrentView} viewTrail={viewTrail} onShowLogin={() => setShowLoginModal(true)} />
          )}

          {currentView === 'donate' && (
            <Donate onBack={goBack} />
          )}

          {!KNOWN_VIEWS.has(currentView) && (
            <NotFound onHome={() => setCurrentView('home')} />
          )}
          </Suspense>
        </main>

        {/* The marketing footer (incl. its "Plan my day with Josephine" CTA) is
            redundant while the user is already in the chat — hide it there. */}
        {currentView !== 'josephine' && <Footer setCurrentView={setCurrentView} />}

        <BottomNav
          currentView={currentView}
          setCurrentView={setCurrentView}
          onJosephineOpen={() => setCurrentView('recommendations')}
          onShowLogin={() => setShowLoginModal(true)}
        />




        {showSplash && (
          <SplashScreen onComplete={handleSplashComplete} />
        )}
        </AuthProvider>
      </ToastProvider>
      </SeasonProvider>
    </div>
  );

}

export default App;
