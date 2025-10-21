import React, { useState } from 'react';
import './App.css';
import Header from './components/Header';
import Home from './components/Home';
import SmartRecommendations from './components/SmartRecommendations';
import TrailCatalog from './components/TrailCatalog';
import TrailDetail from './components/TrailDetail';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [selectedTrail, setSelectedTrail] = useState(null);

  const viewTrail = (trail) => {
    setSelectedTrail(trail);
    setCurrentView('detail');
  };

  return (
    <div className="app">
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
            onBack={() => setCurrentView('catalog')}
          />
        )}
      </main>
    </div>
  );
}

export default App;
