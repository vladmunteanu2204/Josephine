import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import FeaturedCarousel from './FeaturedCarousel';
import ThemeCards from './ThemeCards';
import './Home.css';

const API_URL = '/api';

function Home({ setCurrentView, viewTrail }) {
  const { t } = useTranslation();
  const [featuredTrails, setFeaturedTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef(null);

  useEffect(() => {
    loadFeaturedTrails();
    
    // Parallax scroll effect
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadFeaturedTrails = async () => {
    try {
      const response = await axios.get(`${API_URL}/trails`);
      
      if (response.data.trails && response.data.trails.length > 0) {
        // Select top 4 trails with highest ratings
        const topTrails = response.data.trails
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 4);
        setFeaturedTrails(topTrails);
      }
    } catch (error) {
      console.error('Error loading trails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleThemeClick = (tags) => {
    // Navigate to catalog with filtered tags
    setCurrentView('catalog');
  };

  const handleScrollToContent = () => {
    const contentElement = document.querySelector('.home-content');
    if (contentElement) {
      contentElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const logoOpacity = Math.max(0, 1 - (scrollY / 300));
  const preferReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="home-page">
      {/* Enhanced Cinematic Parallax Hero Section */}
      <div className="hero-parallax-redesign" ref={heroRef}>
        <div 
          className="hero-layer hero-bg-redesign"
          style={!preferReducedMotion ? { transform: `translateY(${scrollY * 0.5}px)` } : {}}
        ></div>
        <div 
          className="hero-layer hero-mountains-back-redesign"
          style={!preferReducedMotion ? { transform: `translateY(${scrollY * 0.3}px)` } : {}}
        ></div>
        <div 
          className="hero-layer hero-mountains-front-redesign"
          style={!preferReducedMotion ? { transform: `translateY(${scrollY * 0.15}px)` } : {}}
        ></div>
        <div 
          className="hero-overlay-redesign"
          style={!preferReducedMotion ? { opacity: logoOpacity } : {}}
        ></div>
        
        <div className="hero-content-wrapper-redesign">
          <div className="container hero-content-redesign">
            <h1 
              className="hero-title-redesign" 
              style={!preferReducedMotion ? { transform: `translateY(${scrollY * 0.1}px)` } : {}}
            >
              {t('hero.title')}
            </h1>
            <p 
              className="hero-subtitle-redesign" 
              style={!preferReducedMotion ? { transform: `translateY(${scrollY * 0.12}px)` } : {}}
            >
              {t('hero.subtitle')}
            </p>
            {/* Josephine Mascot */}
            <div className="mascot-row">
              <div className="mascot-avatar" aria-hidden="true">
                <span className="mascot-emoji">🧭</span>
                <div className="mascot-highlight"></div>
              </div>
              <div className="mascot-bubble" role="note" aria-label={t('home.mascotPrompt')}>
                <p className="mascot-prompt">{t('home.mascotPrompt')}</p>
              </div>
            </div>

            <div 
              className="hero-cta-buttons-redesign" 
              style={!preferReducedMotion ? { transform: `translateY(${scrollY * 0.08}px)` } : {}}
            >
              <button className="hero-btn-primary-redesign" onClick={() => setCurrentView('recommendations')}>
                <span className="hero-btn-icon">✨</span>
                <span className="hero-btn-text">{t('home.smartRecommendations')}</span>
              </button>
              <button className="hero-btn-secondary-redesign" onClick={() => setCurrentView('catalog')}>
                <span className="hero-btn-icon">🗺️</span>
                <span className="hero-btn-text">{t('home.browseTrailCatalog')}</span>
              </button>
            </div>
            
            <div 
              className="hero-scroll-cue"
              onClick={handleScrollToContent}
              style={!preferReducedMotion ? { opacity: Math.max(0, 1 - (scrollY / 200)) } : {}}
            >
              <span className="scroll-cue-icon">🏔️</span>
              <span className="scroll-cue-text">{t('hero.scrollToExplore')}</span>
              <span className="scroll-cue-arrow">↓</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container home-content">
        {/* Featured Trails Carousel */}
        <section className="home-section">
          <div className="section-header-home">
            <h2 className="section-title-home">{t('home.featuredTrails')}</h2>
            <div className="gradient-divider-home"></div>
          </div>
          
          {loading ? (
            <div className="loading-carousel">{t('home.loadingRecommendation')}</div>
          ) : (
            <FeaturedCarousel trails={featuredTrails} onViewTrail={viewTrail} />
          )}
        </section>

        {/* Explore by Theme */}
        <section className="home-section">
          <ThemeCards onThemeClick={handleThemeClick} />
        </section>

        {/* Quick Actions */}
        <section className="home-section">
          <div className="quick-actions-grid">
            <div className="quick-action-card" onClick={() => setCurrentView('recommendations')}>
              <div className="quick-action-icon">✨</div>
              <h3 className="quick-action-title">{t('home.smartRecommendations')}</h3>
              <p className="quick-action-desc">{t('home.smartRecommendationsDesc')}</p>
              <span className="quick-action-arrow">→</span>
            </div>
            
            <div className="quick-action-card" onClick={() => setCurrentView('catalog')}>
              <div className="quick-action-icon">🗺️</div>
              <h3 className="quick-action-title">{t('home.browseTrailCatalog')}</h3>
              <p className="quick-action-desc">{t('home.browseTrailCatalogDesc')}</p>
              <span className="quick-action-arrow">→</span>
            </div>
          </div>
        </section>

        {/* Trust Badge */}
        <section className="home-section">
          <div className="trust-badge">
            <div className="trust-icon">✓</div>
            <p className="trust-text">{t('home.verifiedRoutes')}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Home;
