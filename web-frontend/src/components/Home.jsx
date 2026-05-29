import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import FeaturedCarousel from './FeaturedCarousel';
import ThemeCards from './ThemeCards';
import './Home.css';

const API_URL = '/api';

function Home({ setCurrentView, navigateToCatalog, viewTrail }) {
  const { t } = useTranslation();
  const [featuredTrails, setFeaturedTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollYRef = useRef(0);
  const rafRef = useRef(null);
  const heroRef = useRef(null);
  const heroLayersRef = useRef({});

  const applyParallax = useCallback(() => {
    const y = scrollYRef.current;
    const { bg, back, front, overlay, title, subtitle, cta, cue } = heroLayersRef.current;
    if (bg) bg.style.transform = `translateY(${y * 0.5}px)`;
    if (back) back.style.transform = `translateY(${y * 0.3}px)`;
    if (front) front.style.transform = `translateY(${y * 0.15}px)`;
    if (overlay) overlay.style.opacity = Math.max(0, 1 - y / 300);
    if (title) title.style.transform = `translateY(${y * 0.1}px)`;
    if (subtitle) subtitle.style.transform = `translateY(${y * 0.12}px)`;
    if (cta) cta.style.transform = `translateY(${y * 0.08}px)`;
    if (cue) cue.style.opacity = Math.max(0, 1 - y / 200);
    rafRef.current = null;
  }, []);

  useEffect(() => {
    loadFeaturedTrails();

    const handleScroll = () => {
      scrollYRef.current = window.scrollY;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(applyParallax);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [applyParallax]);

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
    if (navigateToCatalog) {
      navigateToCatalog(tags);
    } else {
      setCurrentView('catalog');
    }
  };

  const handleScrollToContent = () => {
    const contentElement = document.querySelector('.home-content');
    if (contentElement) {
      contentElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const preferReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="home-page">
      {/* Enhanced Cinematic Parallax Hero Section */}
      <div className="hero-parallax-redesign" ref={heroRef}>
        <div
          className="hero-layer hero-bg-redesign"
          ref={el => heroLayersRef.current.bg = el}
        ></div>
        <div
          className="hero-layer hero-mountains-back-redesign"
          ref={el => heroLayersRef.current.back = el}
        ></div>
        <div
          className="hero-layer hero-mountains-front-redesign"
          ref={el => heroLayersRef.current.front = el}
        ></div>
        <div className="hero-ridge-redesign"></div>
        <div
          className="hero-overlay-redesign"
          ref={el => heroLayersRef.current.overlay = el}
        ></div>

        <div className="hero-content-wrapper-redesign">
          <div className="container hero-content-redesign">
            <h1
              className="hero-title-redesign"
              ref={el => heroLayersRef.current.title = el}
            >
              {t('hero.title')}<br />
              <span className="hero-title-accent">{t('hero.titleAccent')}</span>
            </h1>
            <p
              className="hero-subtitle-redesign"
              ref={el => heroLayersRef.current.subtitle = el}
            >
              {t('hero.subtitle')}
            </p>
            {/* Josephine Guide Card */}
            <div className="josephine-guide-card" role="complementary" aria-label={t('home.josephineGuide')}>
              <div className="guide-card-portrait" aria-hidden="true">
                <img src="/josephine-mark.svg" alt="" className="guide-portrait-mark" />
              </div>
              <div className="guide-card-body">
                <p className="guide-card-quote">{t('home.josephineGuide')}</p>
                <p className="guide-card-origin">{t('hero.originLine')}</p>
              </div>
            </div>

            <div
              className="hero-cta-buttons-redesign"
              ref={el => heroLayersRef.current.cta = el}
            >
              <button className="hero-btn-primary-redesign" onClick={() => setCurrentView('recommendations')}>
                <span className="hero-btn-text">{t('home.startAdventure')}</span>
                <span className="hero-btn-arrow">→</span>
              </button>
            </div>

            <div
              className="hero-scroll-cue"
              onClick={handleScrollToContent}
              ref={el => heroLayersRef.current.cue = el}
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
              <span className="quick-action-icon">✦</span>
              <h3 className="quick-action-title">{t('home.smartRecommendations')}</h3>
              <p className="quick-action-desc">{t('home.smartRecommendationsDesc')}</p>
              <span className="quick-action-arrow">Explore →</span>
            </div>
            
            <div className="quick-action-card" onClick={() => setCurrentView('catalog')}>
              <span className="quick-action-icon">◈</span>
              <h3 className="quick-action-title">{t('home.browseTrailCatalog')}</h3>
              <p className="quick-action-desc">{t('home.browseTrailCatalogDesc')}</p>
              <span className="quick-action-arrow">Explore →</span>
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
