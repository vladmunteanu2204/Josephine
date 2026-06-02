import React, { useState, useEffect, useRef, useCallback } from 'react';
import { trailImg, trailImgAlt } from '../utils/trailImage';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useSeason } from '../contexts/SeasonContext';
import { seasonAsset } from '../hooks/useSeason';
import './Home.css';

const API_URL = '/api';

function Home({ setCurrentView, navigateToCatalog, navigateToRifugios, viewTrail }) {
  const { t } = useTranslation();
  const { config } = useSeason();

  const [featuredTrails, setFeaturedTrails] = useState([]);
  const [activeTrail, setActiveTrail] = useState(0);
  const [multiDayTrail, setMultiDayTrail] = useState(null);
  const [dogFriendlyCount, setDogFriendlyCount] = useState(null);
  const [rifugioCounts, setRifugioCounts] = useState({ rifugio: null, malga: null, bivacco: null });

  // Seasonal messages override the static list; fall back to generic if config absent
  const JOSEPHINE_MESSAGES = config.messages ?? [
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

  const heroBg = seasonAsset(config, 'heroImage');
  const [josephineMsg] = useState(() => Math.floor(Math.random() * JOSEPHINE_MESSAGES.length));
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

  /* ── Touch swipe for the cinematic showcase (mobile) ── */
  const cinemaTouchX = useRef(null);
  const cinemaTouchY = useRef(null);
  const onCinemaTouchStart = (e) => {
    cinemaTouchX.current = e.touches[0].clientX;
    cinemaTouchY.current = e.touches[0].clientY;
  };
  const onCinemaTouchEnd = (e) => {
    if (cinemaTouchX.current == null || featuredTrails.length < 2) return;
    const dx = e.changedTouches[0].clientX - cinemaTouchX.current;
    const dy = e.changedTouches[0].clientY - cinemaTouchY.current;
    cinemaTouchX.current = null;
    cinemaTouchY.current = null;
    // Ignore mostly-vertical gestures (page scroll) and tiny taps
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    const n = featuredTrails.length;
    if (dx < 0) goToTrail((activeTrail + 1) % n);
    else        goToTrail((activeTrail - 1 + n) % n);
  };

  /* ── Data loading ── */
  useEffect(() => {
    const load = async () => {
      try {
        const [trailsRes, multiDayRes, rifugiosRes] = await Promise.all([
          axios.get(`${API_URL}/trails`),
          axios.get(`${API_URL}/multi-day-trails`).catch(() => null),
          axios.get(`${API_URL}/rifugios`).catch(() => null),
        ]);
        if (trailsRes.data.trails?.length > 0) {
          const top = trailsRes.data.trails
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 5);
          setFeaturedTrails(top);
          startTrailTimer(top);
          setDogFriendlyCount(trailsRes.data.trails.filter(t => t.dog_friendly).length);
        }
        if (rifugiosRes?.data?.rifugios) {
          const rifs = rifugiosRes.data.rifugios;
          setRifugioCounts({
            rifugio: rifs.filter(r => r.type === 'rifugio').length,
            malga:   rifs.filter(r => r.type === 'malga').length,
            bivacco: rifs.filter(r => r.type === 'bivacco').length,
          });
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
          style={{ backgroundImage: `url('${heroBg}')`, backgroundPosition: config.heroPosition ?? '72% 50%' }}
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
      <section
        className="hp-cinema"
        id="hp-cinema"
        onTouchStart={onCinemaTouchStart}
        onTouchEnd={onCinemaTouchEnd}
      >
        {/* Background slides — only the active and immediately adjacent slides get
            a background-image so we don't fetch all 5 trail photos up front. */}
        {featuredTrails.map((trail, i) => {
          const n = featuredTrails.length;
          const near = i === activeTrail
            || i === (activeTrail + 1) % n
            || i === (activeTrail - 1 + n) % n;
          return (
            <div
              key={trail.id}
              className={`hp-cinema__slide ${i === activeTrail ? 'hp-cinema__slide--active' : ''}`}
              style={near ? { backgroundImage: `url('${trailImg(trail, 'card')}')` } : undefined}
            />
          );
        })}
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
                    src={seasonAsset(config, 'portrait')}
                    alt=""
                    className="hp-convo__avatar"
                    onError={e => { e.currentTarget.src = '/josephine-portrait.webp'; }}
                  />
                )}
                <p className="hp-convo__text">{msg.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3b. MEET JOSEPHINE — character + pillars
      ══════════════════════════════════════════ */}
      <section className="hp-meet">
        <div className="hp-meet__inner">
          <div className="hp-meet__head">
            <p className="hp-meet__eyebrow">{t('meet.eyebrow', 'Your alpine companion')}</p>
            <h2 className="hp-meet__title">{t('meet.title', 'Meet Josephine')}</h2>
            <p className="hp-meet__lead">
              {t('meet.lead', "Part local guide, part friend — Josephine knows these mountains by heart and plans your day around how you feel, the weather, and what's open.")}
            </p>
          </div>

          {/* Single portrait */}
          <div className="hp-meet__portrait-wrap">
            <img
              src={seasonAsset(config, 'portrait')}
              alt="Josephine"
              className="hp-meet__portrait-img"
              onError={e => { e.currentTarget.src = '/josephine-portrait.webp'; }}
            />
          </div>

          {/* Pillars */}
          <div className="hp-meet__pillars">
            {[
              { icon: '🏔', title: t('meet.pillar1Title', 'Local knowledge'),     desc: t('meet.pillar1Desc', 'Every trail, malga and shortcut — learned on foot, not from a brochure.') },
              { icon: '🌤', title: t('meet.pillar2Title', 'Live conditions'),       desc: t('meet.pillar2Desc', 'She reads today\'s weather and visibility before she suggests a thing.') },
              { icon: '✦',  title: t('meet.pillar3Title', 'Smart recommendations'), desc: t('meet.pillar3Desc', 'Tell her your mood and time — she curates three options that fit.') },
              { icon: '♥',  title: t('meet.pillar4Title', 'Always by your side'),   desc: t('meet.pillar4Desc', 'From first step to summit and back, she\'s with you the whole way.') },
            ].map((p, i) => (
              <div className="hp-meet__pillar" key={i}>
                <span className="hp-meet__pillar-icon">{p.icon}</span>
                <h3 className="hp-meet__pillar-title">{p.title}</h3>
                <p className="hp-meet__pillar-desc">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. MOUNTAIN HUTS — rifugios / malghe / bivacchi
      ══════════════════════════════════════════ */}
      <section className="hp-huts">
        <div className="hp-huts__inner">

          {/* Josephine voice intro */}
          <div className="hp-huts__intro">
            <img src="/logo.webp" alt="" className="hp-huts__j-mark" onError={e => e.currentTarget.style.display='none'} />
            <p className="hp-huts__voice">
              "Whether you need a warm meal at a malga or a bed for the night at a rifugio, the mountains have a place waiting for you."
            </p>
          </div>

          {/* Three type cards */}
          <div className="hp-huts__cards">
            <button
              className="hp-huts__card hp-huts__card--malga"
              onClick={() => navigateToRifugios?.('malga', 'open')}
            >
              <span className="hp-huts__card-type">🧀 Malga</span>
              <p className="hp-huts__card-desc">Alpine dairy farms. Fresh cheese, cold drinks, no reservation needed.</p>
              {rifugioCounts.malga !== null && (
                <span className="hp-huts__card-count">{rifugioCounts.malga} places</span>
              )}
              <span className="hp-huts__card-arrow">→</span>
            </button>

            <button
              className="hp-huts__card hp-huts__card--rifugio"
              onClick={() => navigateToRifugios?.('rifugio', 'open')}
            >
              <span className="hp-huts__card-type">🏔 Rifugio</span>
              <p className="hp-huts__card-desc">Mountain huts with beds. Book ahead, hike between them over multiple days.</p>
              {rifugioCounts.rifugio !== null && (
                <span className="hp-huts__card-count">{rifugioCounts.rifugio} places</span>
              )}
              <span className="hp-huts__card-arrow">→</span>
            </button>

            <button
              className="hp-huts__card hp-huts__card--bivacco"
              onClick={() => navigateToRifugios?.('bivacco', 'open')}
            >
              <span className="hp-huts__card-type">⛺ Bivacco</span>
              <p className="hp-huts__card-desc">Unmanned emergency shelters. Always open, always free.</p>
              {rifugioCounts.bivacco !== null && (
                <span className="hp-huts__card-count">{rifugioCounts.bivacco} places</span>
              )}
              <span className="hp-huts__card-arrow">→</span>
            </button>
          </div>

          <button className="hp-huts__cta" onClick={() => navigateToRifugios?.('')}>
            Explore all mountain huts →
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. TWO PATHS — full viewport split
      ══════════════════════════════════════════ */}
      <section className="hp-paths">

        <div
          className="hp-paths__card"
          onClick={() => setCurrentView('multiday-trails')}
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=70&auto=format')` }}
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
          style={{ backgroundImage: `url('/josephine-with-narya.webp')` }}
        >
          <div className="hp-paths__scrim hp-paths__scrim--narya" />
          <div className="hp-paths__body">
            {/* Narya character badge */}
            <div className="hp-narya-badge">
              <img
                src="/narya.webp"
                alt="Narya"
                className="hp-narya-badge__img"
                onError={e => e.currentTarget.style.display = 'none'}
              />
              <div>
                <p className="hp-narya-badge__name">Narya</p>
                <p className="hp-narya-badge__title">Your Canine Companion</p>
              </div>
            </div>

            <h3 className="hp-paths__title">
              Paw-approved<br />adventures
            </h3>

            <ul className="hp-narya-list">
              <li>Dog-friendly trails</li>
              <li>Water points on route</li>
              <li>Shade &amp; safety tips</li>
              <li>Happy tail guarantee</li>
            </ul>

            {dogFriendlyCount !== null && (
              <p className="hp-paths__sub">{dogFriendlyCount} dog-friendly trails</p>
            )}

            <blockquote className="hp-narya-quote">
              "New trail, new scents, same mountains.<br />Let's make it unforgettable."
            </blockquote>

            <span className="hp-paths__link hp-paths__link--narya">Explore dog trails →</span>
          </div>
        </div>

      </section>

    </div>
  );
}

export default Home;
