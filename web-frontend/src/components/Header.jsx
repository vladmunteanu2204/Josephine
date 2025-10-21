import React from 'react';
import './Header.css';

function Header({ currentView, setCurrentView }) {
  return (
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
            Home
          </button>
          <button 
            className={`nav-link ${currentView === 'recommendations' ? 'active' : ''}`}
            onClick={() => setCurrentView('recommendations')}
          >
            Smart Recommendations
          </button>
          <button 
            className={`nav-link ${currentView === 'catalog' ? 'active' : ''}`}
            onClick={() => setCurrentView('catalog')}
          >
            Trail Catalog
          </button>
        </nav>
      </div>
    </header>
  );
}

export default Header;
