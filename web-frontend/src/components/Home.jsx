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
    const { bg, overlay, cue } = heroLayersRef.current;
    if (bg) bg.style.transform = `translateY(${y * 0.4}px)`;
    if (overlay) overlay.style.opacity = Math.max(0, 1 - y / 400);
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
    document.querySelector('.home-content')?.scrollIntoView({ behavior: 'smooth' });
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'Good morning! ✦';
    if (h >= 12 && h < 17) return 'Good afternoon! ✦';
    if (h >= 17 && h < 21) return 'Good evening! ✦';
    return 'Still planning? ✦';
  };

  return (
    <div className="home-page">

      {/* ── Hero ── */}
      <div className="hero" ref={heroRef}>
        <div className="hero__bg" ref={el => heroLayersRef.current.bg = el} />
        <div className="hero__overlay" ref={el => heroLayersRef.current.overlay = el} />

        <div className="hero__inner container">

          {/* Left: headline + CTAs */}
          <div className="hero__left">
            <h1 className="hero__title">
              {t('hero.title')}<br />
              <span className="hero__title-accent">{t('hero.titleAccent')}</span>
            </h1>
            <p className="hero__subtitle">{t('hero.subtitle')}</p>
            <div className="hero__ctas">
              <button className="hero__btn-primary" onClick={() => setCurrentView('recommendations')}>
                Plan My Day
              </button>
              <button className="hero__btn-ghost" onClick={() => setCurrentView('catalog')}>
                Explore Places
              </button>
            </div>
          </div>

          {/* Right: Josephine companion card */}
          <div className="hero__companion">
            <div className="hero__companion-card">
              <div className="hcc__portrait">
                <img
                  src="/josephine-pose-neutral.png"
                  alt="Josephine"
                  className="hcc__portrait-img"
                  onError={e => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hcc__portrait-fallback" style={{ display: 'none' }}>
                  <img src="/josephine-mark.svg" alt="" className="hcc__mark" />
                </div>
              </div>
              <div className="hcc__body">
                <div className="hcc__name-row">
                  <span className="hcc__name">Josephine</span>
                  <span className="hcc__wave" aria-hidden="true">
                    {[3,5,8,5,9,4].map((h, i) => (
                      <span key={i} className="hcc__bar" style={{ height: `${h * 1.8}px`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </span>
                </div>
                <p className="hcc__greeting">{getGreeting()}</p>
                <p className="hcc__msg">The weather is perfect for a panoramic hike today. Want me to suggest something special?</p>
                <div className="hcc__btns">
                  <button className="hcc__btn-primary" onClick={() => setCurrentView('recommendations')}>
                    Yes, surprise me
                  </button>
                  <button className="hcc__btn-ghost" onClick={() => setCurrentView('planner')}>
                    I have something in mind
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="hero__cue" onClick={handleScrollToContent} ref={el => heroLayersRef.current.cue = el}>
          <span className="hero__cue-text">DISCOVER WHAT'S OUT THERE</span>
          <span className="hero__cue-arrow">↓</span>
        </div>
      </div>

      {/* ── Meet Josephine ── */}
      <section className="meet-josephine">
        <div className="container">
          <p className="meet-josephine__eyebrow">MEET JOSEPHINE</p>
          <p className="meet-josephine__headline">
            Your human alpine companion.<br />
            <span className="meet-josephine__sub">
              She knows the mountains, the trails, the rifugios and the little things that make your day unforgettable.
            </span>
          </p>

          <div className="meet-josephine__pillars">
            {[
              { icon: '📍', label: 'Local knowledge' },
              { icon: '☀️', label: 'Live conditions' },
              { icon: '✦',  label: 'Smart recommendations' },
              { icon: '♡',  label: 'Always by your side' },
            ].map(({ icon, label }) => (
              <div key={label} className="meet-josephine__pillar">
                <span className="meet-josephine__pillar-icon">{icon}</span>
                <span className="meet-josephine__pillar-label">{label}</span>
              </div>
            ))}
          </div>

          {/* Character row — shows 3D poses when available, hides gracefully */}
          <div className="meet-josephine__characters">
            {[
              { src: '/josephine-pose-welcome.png', alt: 'Josephine welcoming', mod: '' },
              { src: '/josephine-pose-neutral.png',  alt: 'Josephine',           mod: 'meet-josephine__char--center' },
              { src: '/josephine-pose-point.png',   alt: 'Josephine pointing',  mod: '' },
            ].map(({ src, alt, mod }) => (
              <div key={src} className={`meet-josephine__char ${mod}`}>
                <img
                  src={src}
                  alt={alt}
                  className="meet-josephine__char-img"
                  onError={e => e.currentTarget.closest('.meet-josephine__char').style.display = 'none'}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main content ── */}
      <div className="container home-content">

        {/* Featured Trails */}
        <section className="home-section">
          <div className="section-header-home">
            <h2 className="section-title-home">{t('home.featuredTrails')}</h2>
            <div className="gradient-divider-home" />
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

        {/* Josephine Speaks */}
        <section className="home-section home-josephine-speaks">
          <div className="jph-speaks-grid">
            <div className="jph-speaks-content">
              <p className="jph-speaks-eyebrow">JOSEPHINE SPEAKS</p>
              <h2 className="jph-speaks-headline">She talks to you, guides you and adapts to you.</h2>
              <ul className="jph-speaks-list">
                {[
                  'Natural conversations',
                  'Voice messages',
                  'Smart suggestions',
                  'Encouragement when you need it most',
                ].map(item => (
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
              {/* Character image — hidden if not available */}
              <img
                src="/josephine-pose-think.png"
                alt="Josephine"
                className="jph-speaks-char-img"
                onError={e => e.currentTarget.style.display = 'none'}
              />
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

        {/* Multi-day + Narya */}
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
            <div className="home-feature-card__badge home-feature-card__badge--narya">NARYA · YOUR CANINE COMPANION</div>
            <h3 className="home-feature-card__title">Paw-approved adventures for you and your dog.</h3>
            <ul className="home-feature-narya-list">
              {['Dog-friendly trails', 'Water points', 'Shade & safety tips', 'Happy tails guaranteed'].map(item => (
                <li key={item}>✓ {item}</li>
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
