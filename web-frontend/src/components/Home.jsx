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

      {/* ── Meet Josephine ── */}
      <section className="home-meet-josephine">
        <div className="container">
          <p className="meet-eyebrow">MEET JOSEPHINE</p>
          <h2 className="meet-headline">
            Your human alpine companion.<br />
            <span className="meet-headline-sub">
              She knows the mountains, the trails, the rifugios and the little things that make your day unforgettable.
            </span>
          </h2>

          <div className="meet-pillars">
            {[
              { icon: '📍', label: 'Local knowledge' },
              { icon: '☀️', label: 'Live conditions' },
              { icon: '✦',  label: 'Smart recommendations' },
              { icon: '♡',  label: 'Always by your side' },
            ].map(({ icon, label }) => (
              <div key={label} className="meet-pillar">
                <span className="meet-pillar-icon">{icon}</span>
                <span className="meet-pillar-label">{label}</span>
              </div>
            ))}
          </div>

          {/* Character portrait placeholder — swap with real pose when ready */}
          <div className="meet-character-row">
            <div className="meet-character">
              <img src="/josephine-pose-welcome.png" alt="Josephine welcoming"
                className="meet-character-img"
                onError={e => { e.target.src = '/josephine-mark.svg'; e.target.className = 'meet-character-fallback'; }}
              />
            </div>
            <div className="meet-character">
              <img src="/josephine-pose-neutral.png" alt="Josephine"
                className="meet-character-img meet-character-img--center"
                onError={e => { e.target.src = '/josephine-mark.svg'; e.target.className = 'meet-character-fallback'; }}
              />
            </div>
            <div className="meet-character">
              <img src="/josephine-pose-point.png" alt="Josephine pointing"
                className="meet-character-img"
                onError={e => { e.target.src = '/josephine-mark.svg'; e.target.className = 'meet-character-fallback'; }}
              />
            </div>
          </div>
        </div>
      </section>

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

        {/* ── Josephine Speaks ── */}
        <section className="home-section home-josephine-speaks">
          <div className="jph-speaks-grid">
            <div className="jph-speaks-content">
              <p className="jph-speaks-eyebrow">JOSEPHINE SPEAKS</p>
              <h2 className="jph-speaks-headline">She talks to you, guides you and adapts to you.</h2>
              <ul className="jph-speaks-list">
                {['Natural conversations', 'Voice messages', 'Smart suggestions', 'Encouragement when you need it most'].map(item => (
                  <li key={item} className="jph-speaks-item">
                    <span className="jph-speaks-check">✓</span> {item}
                  </li>
                ))}
              </ul>
              <button className="jph-speaks-cta" onClick={() => setCurrentView('recommendations')}>
                Plan my day with Josephine →
              </button>
            </div>
            <div className="jph-speaks-visual">
              <div className="jph-speaks-character">
                <img src="/josephine-pose-think.png" alt="Josephine thinking"
                  className="jph-speaks-img"
                  onError={e => { e.target.src = '/josephine-mark.svg'; e.target.className = 'jph-speaks-fallback'; }}
                />
              </div>
              <div className="jph-speaks-bubble">
                <p className="jph-speaks-bubble-text">You've been amazing today! ☀️ Look at that view… worth every step.</p>
                <div className="jph-speaks-audio">
                  <span className="jph-speaks-audio-dot" />
                  {[3,5,8,6,9,5,7,4,6,8,5,3].map((h, i) => (
                    <span key={i} className="jph-speaks-audio-bar" style={{ height: `${h * 1.6}px`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                  <span className="jph-speaks-audio-time">0:06</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Multi-day + Narya ── */}
        <section className="home-section home-feature-cards">
          <div className="home-feature-card" onClick={() => setCurrentView('multiday-trails')}>
            <div className="home-feature-card__badge">MULTI-DAY JOURNEYS</div>
            <h3 className="home-feature-card__title">Hut-to-hut adventures curated with care.</h3>
            <div className="home-feature-card__preview">
              <div className="home-feature-trail-chip">
                <span className="home-feature-trail-name">Dolomites Alta Via 1</span>
                <span className="home-feature-trail-meta">7 days · Moderate</span>
              </div>
            </div>
            <span className="home-feature-card__link">Explore routes →</span>
          </div>

          <div className="home-feature-card home-feature-card--narya" onClick={() => setCurrentView('catalog')}>
            <div className="home-feature-card__badge home-feature-card__badge--narya">NARYA</div>
            <h3 className="home-feature-card__title">Your canine companion. Paw-approved adventures.</h3>
            <ul className="home-feature-narya-list">
              {['Dog-friendly trails', 'Water points', 'Shade & safety tips'].map(item => (
                <li key={item}>🐾 {item}</li>
              ))}
            </ul>
            <span className="home-feature-card__link">Find dog-friendly trails →</span>
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
