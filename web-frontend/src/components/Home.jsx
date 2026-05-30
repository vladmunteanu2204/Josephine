import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './Home.css';

const API_URL = '/api';

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600',
  'https://images.unsplash.com/photo-1515091943-9d5c0ad475af?w=1600',
];

function Home({ setCurrentView, navigateToCatalog, viewTrail }) {
  const { t } = useTranslation();
  const [featuredTrails, setFeaturedTrails] = useState([]);
  const [activeTrail, setActiveTrail] = useState(0);
  const [multiDayTrail, setMultiDayTrail] = useState(null);
  const [dogFriendlyCount, setDogFriendlyCount] = useState(null);

  const JOSEPHINE_MESSAGES = [
    t('home.josephineMsg1', "The Dolomites are calling — want me to find a trail that fits your day perfectly?"),
    t('home.josephineMsg2', "Golden hour in the mountains is something else. Shall I find you a sunset hike?"),
    t('home.josephineMsg3', "Some of the best trails are crowd-free if you know when to go. Let me help."),
    t('home.josephineMsg4', "A perfect mountain day starts with the right trail. Want a recommendation?"),
    t('home.josephineMsg5', "Whether you have two hours or a full day, I know just the trail for you."),
  ];
  const CONVO = [
    { from: 'user',      text: t('convo.user1') },
    { from: 'josephine', text: t('convo.josephine1') },
    { from: 'user',      text: t('convo.user2') },
    { from: 'josephine', text: t('convo.josephine2') },
  ];

  const [josephineMsg] = useState(() => Math.floor(Math.random() * 5));
  const [heroBg] = useState(() => HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)]);
  const [convoVisible, setConvoVisible] = useState(false);

  const scrollYRef = useRef(0);
  const rafRef = useRef(null);
  const heroLayersRef = useRef({});
  const convoRef = useRef(null);
  const trailTimerRef = useRef(null);

  /* ── Parallax ── */
  const applyParallax = useCallback(() => {
    const y = scrollYRef.current;
    const { bg, cue } = heroLayersRef.current;
    if (bg) bg.style.transform = `translateY(${y * 0.35}px)`;
    if (cue) cue.style.opacity = Math.max(0, 1 - y / 180);
    rafRef.current = null;
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      scrollYRef.current = window.scrollY;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(applyParallax);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [applyParallax]);

  /* ── Conversation intersection observer ── */
  useEffect(() => {
    const el = convoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setConvoVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ── Trail auto-advance ── */
  const startTrailTimer = useCallback((trails) => {
    clearInterval(trailTimerRef.current);
    if (trails.length < 2) return;
    trailTimerRef.current = setInterval(() => {
      setActiveTrail(prev => (prev + 1) % trails.length);
    }, 6000);
  }, []);

  const goToTrail = (idx) => {
    setActiveTrail(idx);
    startTrailTimer(featuredTrails);
  };

  /* ── Data loading ── */
  useEffect(() => {
    const load = async () => {
      try {
        const [trailsRes, multiDayRes] = await Promise.all([
          axios.get(`${API_URL}/trails`),
          axios.get(`${API_URL}/multi-day-trails`).catch(() => null),
        ]);
        if (trailsRes.data.trails?.length > 0) {
          const top = trailsRes.data.trails
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 5);
          setFeaturedTrails(top);
          startTrailTimer(top);
          setDogFriendlyCount(trailsRes.data.trails.filter(t => t.dog_friendly).length);
        }
        if (multiDayRes?.data) {
          const arr = Array.isArray(multiDayRes.data)
            ? multiDayRes.data
            : (multiDayRes.data.trails || []);
          if (arr.length > 0) setMultiDayTrail(arr[0]);
        }
      } catch (e) {
        console.error('Home data load error:', e);
      }
    };
    load();
    return () => clearInterval(trailTimerRef.current);
  }, [startTrailTimer]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return t('hero.josephineGreeting');
    if (h >= 12 && h < 17) return t('hero.josephineGreetingAfternoon');
    if (h >= 17 && h < 21) return t('hero.josephineGreetingEvening');
    return t('hero.josephineGreetingNight');
  };

  const currentTrail = featuredTrails[activeTrail];

  return (
    <div className="home-page">

      {/* ══════════════════════════════════════════
          1. HERO — full viewport
      ══════════════════════════════════════════ */}
      <section className="hp-hero">
        <div
          className="hp-hero__bg"
          ref={el => heroLayersRef.current.bg = el}
          style={{ backgroundImage: `url('${heroBg}')` }}
        />
        <div className="hp-hero__scrim" />

        <div className="hp-hero__inner">

          {/* Left: headline */}
          <div className="hp-hero__left">
            <p className="hp-hero__eyebrow">{t('hero.region')}</p>
            <h1 className="hp-hero__title">
              {t('hero.title')}<br />
              <em>{t('hero.titleAccent')}</em>
            </h1>
            <p className="hp-hero__subtitle">{t('hero.subtitle')}</p>
            <button
              className="hp-hero__cta"
              onClick={() => setCurrentView('josephine')}
            >
              {t('hero.planCta')}
            </button>
          </div>

          {/* Right: Josephine card */}
          <div className="hp-hero__companion">
            <div className="hp-card">
              <div className="hp-card__portrait">
                <img
                  src="/josephine-pose-neutral.png"
                  alt="Josephine"
                  className="hp-card__portrait-img"
                  onError={e => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hp-card__portrait-fallback" style={{ display: 'none' }}>
                  <img src="/josephine-mark.svg" alt="" style={{ width: 56, opacity: 0.6 }} />
                </div>
              </div>
              <div className="hp-card__body">
                <div className="hp-card__name-row">
                  <span className="hp-card__name">Josephine</span>
                  <span className="hp-card__wave">
                    {[3, 5, 8, 5, 9, 4].map((h, i) => (
                      <span
                        key={i}
                        className="hp-card__bar"
                        style={{ height: `${h * 1.8}px`, animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </span>
                </div>
                <p className="hp-card__greeting">{getGreeting()}</p>
                <p className="hp-card__msg">{JOSEPHINE_MESSAGES[josephineMsg]}</p>
                <button
                  className="hp-card__btn"
                  onClick={() => setCurrentView('josephine')}
                >
                  {t('hero.josephineCta')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          className="hp-hero__cue"
          ref={el => heroLayersRef.current.cue = el}
          onClick={() => document.getElementById('hp-cinema')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="hp-hero__cue-text">{t('hero.scroll')}</span>
          <span className="hp-hero__cue-arrow">↓</span>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          2. CINEMATIC TRAIL SHOWCASE — full viewport
      ══════════════════════════════════════════ */}
      <section className="hp-cinema" id="hp-cinema">
        {/* Background slides */}
        {featuredTrails.map((trail, i) => (
          <div
            key={trail.id}
            className={`hp-cinema__slide ${i === activeTrail ? 'hp-cinema__slide--active' : ''}`}
            style={{ backgroundImage: `url('${trail.image_url || trail.thumbnail}')` }}
          />
        ))}
        <div className="hp-cinema__scrim" />

        {/* Trail info */}
        {currentTrail && (
          <div className="hp-cinema__content">
            <p className="hp-cinema__region">{currentTrail.region}</p>
            <h2 className="hp-cinema__title">{currentTrail.name}</h2>
            {currentTrail.tagline && (
              <p className="hp-cinema__tagline">{currentTrail.tagline}</p>
            )}
            <div className="hp-cinema__stats">
              <span>{currentTrail.distance_km} km</span>
              <span className="hp-cinema__dot">·</span>
              <span>{currentTrail.duration_hours}h</span>
              <span className="hp-cinema__dot">·</span>
              <span>{currentTrail.elevation_gain_m}m ↑</span>
              <span className="hp-cinema__dot">·</span>
              <span className={`hp-cinema__diff hp-cinema__diff--${currentTrail.difficulty}`}>
                {currentTrail.difficulty}
              </span>
            </div>
            <button
              className="hp-cinema__cta"
              onClick={() => viewTrail?.(currentTrail)}
            >
              {t('cinema.exploreCta')}
            </button>
          </div>
        )}

        {/* Nav arrows */}
        {featuredTrails.length > 1 && (
          <>
            <button
              className="hp-cinema__nav hp-cinema__nav--prev"
              onClick={() => goToTrail((activeTrail - 1 + featuredTrails.length) % featuredTrails.length)}
              aria-label="Previous trail"
            >
              ‹
            </button>
            <button
              className="hp-cinema__nav hp-cinema__nav--next"
              onClick={() => goToTrail((activeTrail + 1) % featuredTrails.length)}
              aria-label="Next trail"
            >
              ›
            </button>
          </>
        )}

        {/* Trail indicators */}
        <div className="hp-cinema__indicators">
          {featuredTrails.map((_, i) => (
            <button
              key={i}
              className={`hp-cinema__pip ${i === activeTrail ? 'hp-cinema__pip--active' : ''}`}
              onClick={() => goToTrail(i)}
              aria-label={`Trail ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3. JOSEPHINE CONVERSATION — full viewport
      ══════════════════════════════════════════ */}
      <section className="hp-convo" ref={convoRef}>
        <div className="hp-convo__inner">
          <p className="hp-convo__eyebrow">{t('convo.eyebrow')}</p>

          <div className="hp-convo__thread">
            {CONVO.map((msg, i) => (
              <div
                key={i}
                className={`hp-convo__bubble hp-convo__bubble--${msg.from} ${convoVisible ? 'hp-convo__bubble--in' : ''}`}
                style={{ animationDelay: convoVisible ? `${i * 0.6}s` : '0s' }}
              >
                {msg.from === 'josephine' && (
                  <img
                    src="/josephine-mark.svg"
                    alt=""
                    className="hp-convo__avatar"
                    onError={e => e.target.style.display = 'none'}
                  />
                )}
                <p className="hp-convo__text">{msg.text}</p>
              </div>
            ))}
          </div>

          <button
            className="hp-convo__cta"
            onClick={() => setCurrentView('josephine')}
          >
            {t('convo.startCta')}
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. TWO PATHS — full viewport split
      ══════════════════════════════════════════ */}
      <section className="hp-paths">

        <div
          className="hp-paths__card"
          onClick={() => setCurrentView('multiday-trails')}
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200')` }}
        >
          <div className="hp-paths__scrim" />
          <div className="hp-paths__body">
            <p className="hp-paths__eyebrow">{t('paths.multiDayEyebrow')}</p>
            <h3 className="hp-paths__title">
              {t('paths.multiDayTitle').split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h3>
            {multiDayTrail && (
              <p className="hp-paths__sub">
                {multiDayTrail.name} · {t('paths.multiDayDays', { count: multiDayTrail.total_days || multiDayTrail.stages?.length || '?' })}
              </p>
            )}
            <span className="hp-paths__link">{t('paths.multiDayCta')}</span>
          </div>
        </div>

        <div
          className="hp-paths__card hp-paths__card--narya"
          onClick={() => navigateToCatalog ? navigateToCatalog(['dog-friendly']) : setCurrentView('catalog')}
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1200')` }}
        >
          <div className="hp-paths__scrim" />
          <div className="hp-paths__body">
            <p className="hp-paths__eyebrow hp-paths__eyebrow--narya">{t('paths.dayTrailsEyebrow')}</p>
            <h3 className="hp-paths__title">
              {t('paths.dayTrailsTitle').split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h3>
            {dogFriendlyCount !== null && (
              <p className="hp-paths__sub">{t('home.dogFriendlyCount', { count: dogFriendlyCount, defaultValue: `${dogFriendlyCount} dog-friendly trails` })}</p>
            )}
            <span className="hp-paths__link hp-paths__link--narya">{t('paths.dayTrailsCta')}</span>
          </div>
        </div>

      </section>

    </div>
  );
}

export default Home;
