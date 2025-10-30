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
import Footer from './components/Footer';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [previousView, setPreviousView] = useState('home');
  const [selectedTrail, setSelectedTrail] = useState(null);

  const viewTrail = (trail) => {
    setPreviousView(currentView);
    setSelectedTrail(trail);
    setCurrentView('detail');
  };

  const navigate = (view, trailId = null) => {
    if (view === 'detail') {
      setPreviousView(currentView);
    }
    
    if (trailId) {
      setCurrentView(view);
      if (view === 'detail') {
        setSelectedTrail({ id: trailId });
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
          <Header currentView={currentView} setCurrentView={setCurrentView} />
        
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
        </main>

        <Footer setCurrentView={setCurrentView} />
        </AuthProvider>
      </ToastProvider>
    </div>
  );
}

export default App;
