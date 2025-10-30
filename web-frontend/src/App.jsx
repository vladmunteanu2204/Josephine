import React, { useState } from 'react';
import './App.css';
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
import SplashScreen from './components/SplashScreen';
import OnboardingWizard from './components/OnboardingWizard';
import Footer from './components/Footer';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [previousView, setPreviousView] = useState('home');
  const [selectedTrail, setSelectedTrail] = useState(null);
  const [selectedRifugio, setSelectedRifugio] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('onboardingCompleted');
  });
  const [isGPSActive, setIsGPSActive] = useState(false);

  const viewTrail = (trail) => {
    setPreviousView(currentView);
    setSelectedTrail(trail);
    setCurrentView('detail');
  };

  const navigate = (view, param = null) => {
    if (view === 'detail' || view === 'rifugio-detail') {
      setPreviousView(currentView);
    }
    
    if (param) {
      setCurrentView(view);
      if (view === 'detail') {
        setSelectedTrail({ id: param });
      } else if (view === 'rifugio-detail') {
        setSelectedRifugio(param);
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
          {!isGPSActive && <Header currentView={currentView} setCurrentView={setCurrentView} />}
        
        <main className="main-content">
          {currentView === 'home' && (
            <Home 
              setCurrentView={setCurrentView}
              viewTrail={viewTrail}
            />
          )}
          
          {currentView === 'recommendations' && (
            <SmartRecommendations viewTrail={viewTrail} />
          )}
          
          {currentView === 'catalog' && (
            <TrailCatalog viewTrail={viewTrail} />
          )}
          
          {currentView === 'detail' && selectedTrail && (
            <TrailDetail 
              trail={selectedTrail}
              onBack={goBack}
              setIsGPSActive={setIsGPSActive}
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

          {currentView === 'leaderboards' && (
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

          {currentView === 'challenges' && (
            <Challenges onNavigate={navigate} />
          )}

          {currentView === 'rifugios' && (
            <Rifugios onNavigate={navigate} />
          )}

          {currentView === 'rifugio-detail' && selectedRifugio && (
            <RifugioDetail rifugioId={selectedRifugio} onNavigate={navigate} />
          )}
        </main>

        <Footer setCurrentView={setCurrentView} />
        
        {!showSplash && showOnboarding && (
          <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
        )}

        {showSplash && (
          <SplashScreen onComplete={() => setShowSplash(false)} />
        )}
        </AuthProvider>
      </ToastProvider>
    </div>
  );
}

export default App;
