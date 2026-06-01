import React, { useState, useRef, useEffect, useCallback } from 'react';
import { trailImg } from '../utils/trailImage';
// NOTE: We intentionally avoid useTranslation() here.
// Safari + React.lazy + React.memo causes useContext() (called internally by
// useTranslation) to run with a null dispatcher → "Invalid hook call" crash.
// Instead we drive translations from the i18n singleton directly via
// useState/useEffect, which go through renderWithHooks normally.
import i18nInstance from '../i18n';
import axios from 'axios';
// Season config is resolved as a plain function call (no hook) to avoid the
// same Safari/lazy/useContext crash described above.
import { detectSeason, getSeasonConfig } from '../hooks/useSeason';
import './JosephineChat.css';

// Resolved once at module load — matches the same ?season= override used elsewhere
const _seasonOverride = new URLSearchParams(window.location.search).get('season');
const _seasonConfig   = getSeasonConfig(_seasonOverride || detectSeason());

const SESSION_KEY = 'josephine_session';
const SAVED_KEY   = 'savedTrails';
// South Tyrol centre — used for the "today's conditions" card weather lookup.
const WX_LAT = 46.5, WX_LON = 11.35;

/* ── Session memory ─────────────────────────────────────────────────── */
function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
function saveSession(data) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
  catch {}
}

/* ── Component ───────────────────────────────────────────────────────── */
function JosephineChat({ onBack, setCurrentView, viewTrail }) {
  // Drive language state from the i18n singleton; re-render when it changes.
  const [lang, setLang] = useState(() => i18nInstance.language?.slice(0, 2) || 'en');
  useEffect(() => {
    const handler = (lng) => setLang((lng || i18nInstance.language || 'en').slice(0, 2));
    i18nInstance.on('languageChanged', handler);
    return () => i18nInstance.off('languageChanged', handler);
  }, []);
  const t = useCallback(
    (key, fallback) => {
      const full = `josephineChat.${key}`;
      const val = i18nInstance.t(full);
      // i18next returns the key itself when missing → treat that as "no translation"
      return (val && val !== full) ? val : (fallback ?? key);
    },
    [lang],
  );

  /* Mood-first plan flow: seasonal tiles from SEASON_CONFIG, with i18n labels where available. */
  const MOODS = (_seasonConfig.moodTiles ?? []).map(m => ({ ...m }));
  const moodByLabel = Object.fromEntries(MOODS.map(m => [m.label, m.bundle]));

  const INITIAL_MESSAGES = [
    { id: 1, from: 'josephine', type: 'text', text: t('greeting'), chips: null },
    { id: 2, from: 'josephine', type: 'text', text: t('weatherPrompt'),
      chips: [t('chipPlanMyDay'), t('chipSurpriseMe'), t('chipShowMap')] },
    { id: 3, from: 'josephine', type: 'voice', text: null, duration: '0:08',
      bars: [3,5,8,6,9,5,7,4,6,8,5,3,7,5,9], chips: null },
  ];

  const [messages, setMessages]       = useState(() => INITIAL_MESSAGES);
  const [input, setInput]             = useState('');
  const [typing, setTyping]           = useState(false);
  // planningStep: 0 idle · 1 mood selection · 2 finding/results
  const [planningStep, setPlanningStep] = useState(0);
  const [planningData, setPlanningData] = useState({});
  const [apiResults, setApiResults]   = useState([]);
  const [selectedTrail, setSelectedTrail] = useState(null);
  const [savedIds, setSavedIds]       = useState(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
  });
  const [refining, setRefining]       = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const bottomRef = useRef(null);
  const greetingShownRef = useRef(false);
  const inputRef  = useRef(null);
  const prevLangRef = useRef(lang);

  /* Reset conversation when language changes ───────────────────────── */
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;
    setMessages([
      { id: 1, from: 'josephine', type: 'text', text: t('greeting'), chips: null },
      { id: 2, from: 'josephine', type: 'text', text: t('weatherPrompt'),
        chips: [t('chipPlanMyDay'), t('chipSurpriseMe'), t('chipShowMap')] },
      { id: 3, from: 'josephine', type: 'voice', text: null, duration: '0:08',
        bars: [3,5,8,6,9,5,7,4,6,8,5,3,7,5,9], chips: null },
    ]);
    setPlanningStep(0);
    setPlanningData({});
    setApiResults([]);
    setSelectedTrail(null);
    setChatHistory([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  /* Session memory greeting ─────────────────────────────────────────── */
  useEffect(() => {
    if (greetingShownRef.current) return;   // StrictMode double-fire guard
    greetingShownRef.current = true;
    const prev = loadSession();
    if (prev?.lastTrail && prev?.lastDifficulty) {
      setTimeout(() => {
        appendJosephineMessage({
          type: 'text',
          text: t('welcomeBack', `Welcome back! Ready for another adventure?`),
          chips: [t('chipSameVibe'), t('chipSomethingDifferent'), t('chipSurpriseMe')],
        });
      }, 800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  const appendJosephineMessage = (partial) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), from: 'josephine', ...partial }]);
  };
  const appendUserMessage = (text) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), from: 'user', type: 'text', text, chips: null }]);
  };

  /* ── Plan flow ───────────────────────────────────────────────────────── */
  const startPlanningFlow = () => {
    setPlanningStep(1);
    setPlanningData({});
    setApiResults([]);
    setSelectedTrail(null);
    setRefining(false);
    setTimeout(() => {
      appendJosephineMessage({ type: 'text', text: t('moodIntro'), chips: null });
      appendJosephineMessage({ type: 'mood-grid', moods: MOODS });
    }, 450);
  };

  /* Build a friendly conditions object from /api/weather/current. */
  const buildConditions = (w) => {
    const desc = (w?.description || '').toLowerCase();
    let sky = t('skyPartly', 'Partly cloudy'), emoji = '⛅';
    if (/clear|sun/.test(desc))            { sky = t('skyClear', 'Clear skies'); emoji = '☀️'; }
    else if (/rain|shower|storm|drizzle/.test(desc)) { sky = t('skyRain', 'Showers possible'); emoji = '🌦️'; }
    else if (/cloud|overcast/.test(desc))  {
      const few = /few|scattered|partly/.test(desc);
      sky = few ? t('skyPartly', 'Partly cloudy') : t('skyCloudy', 'Cloudy');
      emoji = few ? '⛅' : '☁️';
    }
    const vis = (w?.visibility ?? 10) >= 9 ? t('visExcellent', 'Excellent visibility') : t('visGood', 'Good visibility');
    return { temp: w?.temperature ?? 14, sky, emoji, vis, wind: w?.wind_speed ?? null };
  };

  /* Mood chosen → show conditions card, then surface three options. */
  const runConditionsThenOptions = async (data) => {
    setPlanningStep(2);
    setTyping(true);
    let conditions;
    try {
      const w = await axios.get('/api/weather/current', { params: { lat: WX_LAT, lon: WX_LON } });
      conditions = buildConditions(w.data);
    } catch {
      conditions = buildConditions(null);
    }
    setTyping(false);
    appendJosephineMessage({ type: 'conditions', conditions });
    setTimeout(() => callRecommendAPI(data), 750);
  };

  const callRecommendAPI = async (data, adjustments = {}) => {
    setPlanningStep(2);
    setTyping(true);
    setRefining(false);

    let duration   = data.duration_hours ?? 3;
    let difficulty = data.difficulty ?? 'medium';
    if (adjustments.durationDown)   duration   = Math.max(1.5, duration - 1.5);
    if (adjustments.difficultyDown) difficulty = difficulty === 'hard' ? 'medium' : 'easy';

    const interests = [
      ...(data.interests || []),
      ...(data.withDog ? ['dog-friendly'] : []),
    ];

    try {
      const response = await axios.post('/api/ai/recommend', {
        duration_hours:  duration,
        difficulty,
        interests,
        family_friendly: data.family_friendly ?? false,
        start_area:      data.startArea ?? '',
      });
      const results = (response.data.results || []).slice(0, 3);
      setApiResults(results);
      setTyping(false);

      if (results.length) {
        const first = results[0];
        saveSession({
          duration_hours: duration, difficulty, interests,
          lastTrail: first.id, lastDifficulty: first.difficulty, lastRegion: first.region,
        });
        setTimeout(() => {
          appendJosephineMessage({ type: 'text', text: t('optionsIntro'), chips: null });
          appendJosephineMessage({ type: 'options', trails: results });
        }, 350);
      } else {
        setTimeout(() => {
          appendJosephineMessage({
            type: 'text', text: t('noMatchIntro'),
            chips: [t('chipStartOver')],
          });
        }, 350);
      }
    } catch {
      setTyping(false);
      setPlanningStep(0);
      setTimeout(() => {
        appendJosephineMessage({
          type: 'text', text: t('windError'),
          chips: [t('retryChip'), t('chipStartOver')],
        });
      }, 350);
    }
  };

  /* Tapping an option → expanded card with Why-picked + Good-to-know. */
  const showTrailDetail = (trail) => {
    setSelectedTrail(trail);
    appendUserMessage(trail.name);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      appendJosephineMessage({
        type: 'trail-card', trail,
        chips: [t('chipStartOver')],
      });
    }, 500);
  };

  /* Save → persist to savedTrails + emit an itinerary timeline. */
  const saveHike = (trail) => {
    if (!trail) return;
    setSavedIds(prev => {
      const next = prev.includes(trail.id) ? prev : [...prev, trail.id];
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    appendJosephineMessage({ type: 'itinerary', trail, steps: buildItinerary(trail) });
  };

  const buildItinerary = (trail) => {
    const dur = trail.duration_hours || 3;
    const fmt = (h) => `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h - Math.floor(h)) * 60)).padStart(2,'0')}`;
    const start = 9;
    const stopName = trail.pois?.[0]?.name || t('itinStop', 'Rest & refuel');
    return [
      { time: fmt(start),            label: t('itinStart',  'Set off'),     place: trail.region || '' },
      { time: fmt(start + 0.2),      label: t('itinTrail',  'On the trail'),place: trail.name },
      { time: fmt(start + dur * 0.55), label: t('itinStop', 'Rest & refuel'), place: stopName },
      { time: fmt(start + dur),      label: t('itinReturn', 'Head home'),   place: '' },
    ];
  };

  /* Build the Good-to-know rows from whatever fields the trail carries. */
  const goodToKnowRows = (trail) => {
    const rows = [];
    if (trail.best_season?.length) {
      const s = trail.best_season;
      rows.push([t('gtkBestTime', 'Best time'), s.length > 1 ? `${s[0]}–${s[s.length - 1]}` : s[0]]);
    }
    if (trail.trail_type)  rows.push([t('gtkTrailType', 'Trail type'), String(trail.trail_type).replace(/_/g, ' ')]);
    const parking = trail.trailhead_info?.parking || trail.transport?.car;
    if (parking)           rows.push([t('gtkParking', 'Parking'), parking]);
    const fac = Array.isArray(trail.facilities) ? trail.facilities : [];
    if (fac.length)        rows.push([t('gtkFacilities', 'Facilities'), fac.slice(0, 3).join(', ')]);
    if (trail.crowding?.level) rows.push([t('gtkCrowds', 'Crowds'), String(trail.crowding.level)]);
    if (trail.dog_friendly)    rows.push([t('gtkDog', 'Dogs'), '✓']);
    if (trail.family_friendly) rows.push([t('gtkFamily', 'Family'), '✓']);
    return rows.slice(0, 6);
  };

  /* ── Chip handler ────────────────────────────────────────────────────── */
  const handleChip = (chip) => {
    // Navigation
    if ([t('chipShowMap'), 'Open map', 'Show me on the map', 'Show me the map'].includes(chip)) {
      appendUserMessage(chip);
      setCurrentView?.('catalog');
      return;
    }

    // Mood selection
    if (planningStep === 1 && moodByLabel[chip]) {
      appendUserMessage(chip);
      const bundle = moodByLabel[chip];
      setPlanningData(bundle);
      runConditionsThenOptions(bundle);
      return;
    }

    // Entry points
    if (chip === t('chipPlanMyDay')) { appendUserMessage(chip); startPlanningFlow(); return; }

    if (chip === t('chipSameVibe')) {
      appendUserMessage(chip);
      const prev = loadSession();
      if (prev) {
        const d = { duration_hours: prev.duration_hours, difficulty: prev.difficulty,
                    interests: prev.interests || [], withDog: false, family_friendly: false, startArea: '' };
        setPlanningData(d);
        runConditionsThenOptions(d);
      } else { startPlanningFlow(); }
      return;
    }
    if (chip === t('chipSomethingDifferent')) { appendUserMessage(chip); startPlanningFlow(); return; }

    if (chip === t('chipSurpriseMe') || chip === 'Surprise me' || chip === 'Yes, surprise me') {
      appendUserMessage(chip);
      const d = { duration_hours: 3, difficulty: 'medium', interests: [], withDog: false, family_friendly: false, startArea: '' };
      setPlanningData(d);
      runConditionsThenOptions(d);
      return;
    }

    // Save this hike
    if (chip === t('chipSaveHike')) {
      appendUserMessage(chip);
      saveHike(selectedTrail);
      return;
    }
    if (chip === t('viewDetails')) {
      if (selectedTrail) viewTrail?.(selectedTrail);
      return;
    }

    // Refinement
    if (chip === t('chipTooLong')) {
      appendUserMessage(chip); setRefining(true);
      setTimeout(() => {
        appendJosephineMessage({ type: 'text', text: t('refineShorter'), chips: null });
        callRecommendAPI(planningData, { durationDown: true });
      }, 400);
      return;
    }
    if (chip === t('chipTooHard')) {
      appendUserMessage(chip); setRefining(true);
      setTimeout(() => {
        appendJosephineMessage({ type: 'text', text: t('refineEasier'), chips: null });
        callRecommendAPI(planningData, { difficultyDown: true });
      }, 400);
      return;
    }

    // Start over
    if (chip === t('chipStartOver')) {
      appendUserMessage(chip);
      setPlanningStep(0); setPlanningData({}); setApiResults([]);
      setSelectedTrail(null); setRefining(false); setChatHistory([]);
      setTimeout(() => {
        appendJosephineMessage({
          type: 'text', text: t('weatherPrompt'),
          chips: [t('chipPlanMyDay'), t('chipSurpriseMe'), t('chipShowMap')],
        });
      }, 400);
      return;
    }

    if (chip === t('retryChip')) { appendUserMessage(chip); runConditionsThenOptions(planningData); return; }

    // Fallback → freeform
    sendMessage(chip);
  };

  /* ── Freeform send ───────────────────────────────────────────────────── */
  const parseRecommendIntent = (text) => {
    const tl = text.toLowerCase();
    const TRIGGERS = [
      'give me a hike', 'find me a hike', 'suggest a hike', 'recommend a hike',
      'give me a trail', 'find me a trail', 'suggest a trail',
      'give me something', 'find something', 'show me a hike', 'show me a trail',
      'any hike', 'a hike from', 'a trail from', 'hike starting from',
      'trail starting from', 'hike near', 'trail near', 'something near',
      'where can i hike', 'where should i hike', 'what trail',
    ];
    if (!TRIGGERS.some(x => tl.includes(x))) return null;
    const loc = text.match(/(?:from|near|around|starting from|starting at|close to)\s+([A-Za-zÀ-ÿ\s]+?)(?:\s*$|\s*[,.])/i);
    const startArea = loc ? loc[1].trim() : '';
    let difficulty = 'medium';
    if (/\b(easy|beginner|gentle|relaxed)\b/i.test(text)) difficulty = 'easy';
    if (/\b(hard|difficult|challenging|strenuous|expert)\b/i.test(text)) difficulty = 'hard';
    const interests = [];
    if (/\blake|lakes\b/i.test(text)) interests.push('alpine lakes');
    if (/\bview|panoram|summit\b/i.test(text)) interests.push('panoramic views');
    if (/\bforest|wood\b/i.test(text)) interests.push('forests');
    if (/\bloop\b/i.test(text)) interests.push('loop');
    if (/\bdog\b/i.test(text)) interests.push('dog-friendly');
    return { startArea, difficulty, interests };
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const trimmed = text.trim();

    const intent = parseRecommendIntent(trimmed);
    if (intent) {
      appendUserMessage(trimmed);
      setInput('');
      const d = {
        duration_hours: 3, difficulty: intent.difficulty, interests: intent.interests,
        withDog: intent.interests.includes('dog-friendly'), family_friendly: false, startArea: intent.startArea,
      };
      setPlanningData(d);
      appendJosephineMessage({
        type: 'text',
        text: intent.startArea
          ? t('searchingNear', `On it — let me find something near ${intent.startArea}…`)
          : t('searching', 'Let me find you something…'),
        chips: null,
      });
      callRecommendAPI(d);
      return;
    }

    appendUserMessage(trimmed);
    setInput('');
    setTyping(true);
    try {
      const res = await axios.post('/api/chat', { message: trimmed, history: chatHistory.slice(-10), lang });
      setTyping(false);
      setChatHistory(prev => [...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: res.data.reply },
      ]);
      appendJosephineMessage({ type: 'text', text: res.data.reply, chips: [t('chipPlanMyDay'), t('chipSurpriseMe')] });
    } catch {
      setTyping(false);
      appendJosephineMessage({ type: 'text', text: t('windError'), chips: [t('chipPlanMyDay'), t('chipSurpriseMe')] });
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  const statusText =
    planningStep === 1 ? t('statusPlanning', 'Planning your day…') :
    planningStep === 2 ? t('statusFinding', 'Finding your trail…') :
    refining ? t('statusRefining', 'Refining your pick…') :
    t('statusOnline', 'Online · Alpine guide');

  return (
    <div className="jc-page">

      {/* Header */}
      <div className="jc-header">
        <button className="jc-back-btn" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="jc-header__identity">
          <div className="jc-header__avatar">
            <img src="/josephine-portrait.png" alt="" className="jc-header__mark" onError={e => { e.currentTarget.src='/logo.png'; }} />
          </div>
          <div>
            <p className="jc-header__name">Josephine</p>
            <p className="jc-header__status"><span className="jc-header__online-dot" />{statusText}</p>
          </div>
        </div>
        <button className="jc-menu-btn" aria-label="More options"><span /><span /><span /></button>
      </div>

      {/* Portrait — warm photographic Josephine (falls back to the brand mark) */}
      <div className="jc-portrait">
        <img
          src="/josephine-portrait.png"
          alt="Josephine"
          className="jc-portrait__img"
          onError={e => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/logo.png';
            e.currentTarget.classList.add('jc-portrait__img--fallback');
          }}
        />
        <div className="jc-portrait__gradient" />
      </div>

      {/* Messages */}
      <div className="jc-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`jc-msg jc-msg--${msg.from}${(msg.type === 'trail-card' || msg.type === 'options' || msg.type === 'conditions' || msg.type === 'itinerary' || msg.type === 'mood-grid') ? ' jc-msg--card' : ''}`}>

            {msg.from === 'josephine' && (
              <div className="jc-msg__avatar">
                <img src="/josephine-portrait.png" alt="" onError={e => { e.currentTarget.src='/logo.png'; }} />
              </div>
            )}

            <div className="jc-msg__content">

              {/* Text bubble */}
              {msg.type === 'text' && msg.text && (
                <div className="jc-bubble"><p className="jc-bubble__text">{msg.text}</p></div>
              )}

              {/* Voice */}
              {msg.type === 'voice' && (
                <div className="jc-voice">
                  <span className="jc-voice__dot" />
                  <div className="jc-voice__bars">
                    {(msg.bars || []).map((h, i) => (
                      <span key={i} className="jc-voice__bar" style={{ height: `${h * 2.2}px`, animationDelay: `${i * 0.08}s` }} />
                    ))}
                  </div>
                  <span className="jc-voice__time">{msg.duration}</span>
                </div>
              )}

              {/* Conditions card */}
              {msg.type === 'conditions' && msg.conditions && (
                <div className="jc-conditions">
                  <div className="jc-conditions__head">
                    <span className="jc-conditions__emoji">{msg.conditions.emoji}</span>
                    <div>
                      <p className="jc-conditions__title">{t('conditionsTitle', 'Conditions look great today!')}</p>
                      <p className="jc-conditions__temp">{msg.conditions.temp}°C · {msg.conditions.sky}</p>
                    </div>
                  </div>
                  <ul className="jc-conditions__list">
                    <li>✦ {msg.conditions.sky}</li>
                    <li>✦ {msg.conditions.vis}</li>
                    {msg.conditions.wind != null && <li>✦ {msg.conditions.wind} km/h wind</li>}
                  </ul>
                </div>
              )}

              {/* Three options — full-width photo cards */}
              {msg.type === 'options' && msg.trails?.length > 0 && (
                <div className="jc-options">
                  {msg.trails.map((tr, i) => (
                    <button key={tr.id || i} className="jc-option" onClick={() => showTrailDetail(tr)}>
                      <img className="jc-option__img" src={trailImg(tr, 'card')} alt={tr.name}
                           onError={e => e.currentTarget.style.opacity='0.2'} />
                      <div className="jc-option__overlay" />
                      <div className="jc-option__body">
                        <p className="jc-option__name">{tr.name}</p>
                        <p className="jc-option__stats">{tr.distance_km} km · {tr.duration_hours}h · <span className="jc-option__diff">{tr.difficulty}</span></p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Mood tile grid */}
              {msg.type === 'mood-grid' && msg.moods?.length > 0 && (
                <div className="jc-mood-grid">
                  {msg.moods.map((mood) => (
                    <button
                      key={mood.label}
                      className="jc-mood-tile"
                      onClick={() => {
                        appendUserMessage(mood.label);
                        setPlanningData(mood.bundle);
                        runConditionsThenOptions(mood.bundle);
                      }}
                    >
                      <span className="jc-mood-tile__icon">{mood.icon}</span>
                      <span className="jc-mood-tile__label">{mood.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Trail detail card — Why picked + Good to know */}
              {msg.type === 'trail-card' && msg.trail && (
                <div className="jc-trail-card">
                  <div className="jc-trail-card__photo-wrap">
                    <img src={trailImg(msg.trail, 'card')} alt={msg.trail.name} className="jc-trail-card__photo"
                         onError={e => e.currentTarget.style.opacity='0.2'} />
                    <div className="jc-trail-card__photo-overlay" />
                    {msg.trail.in_season === false && (
                      <span className="jc-trail-card__season-warn">⚠ Check season</span>
                    )}
                    <span className="jc-trail-card__pick-badge">
                      <img src="/logo.png" alt="" className="jc-trail-card__mark" onError={e => e.currentTarget.style.display='none'} />
                      {t('josephinePickBadge', "Josephine's Pick")}
                    </span>
                  </div>
                  <div className="jc-trail-card__body">
                    <p className="jc-trail-card__region">{msg.trail.region}</p>
                    <h3 className="jc-trail-card__name">{msg.trail.name}</h3>
                    <div className="jc-trail-card__stats">
                      <span>{msg.trail.distance_km} km</span><span className="jc-trail-card__dot">·</span>
                      <span>{msg.trail.duration_hours}h</span><span className="jc-trail-card__dot">·</span>
                      <span>{msg.trail.elevation_gain_m}m ↑</span>
                    </div>

                    {msg.trail.josephine_note && (
                      <div className="jc-why">
                        <p className="jc-why__label">{t('whyPicked', 'Why I picked this')}</p>
                        <p className="jc-why__text">{msg.trail.josephine_note}</p>
                      </div>
                    )}

                    {goodToKnowRows(msg.trail).length > 0 && (
                      <div className="jc-gtk">
                        <p className="jc-gtk__label">{t('goodToKnow', 'Good to know')}</p>
                        <div className="jc-gtk__grid">
                          {goodToKnowRows(msg.trail).map(([k, v]) => (
                            <div className="jc-gtk__cell" key={k}>
                              <span className="jc-gtk__key">{k}</span>
                              <span className="jc-gtk__val">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="jc-trail-card__actions">
                      <button
                        className={`jc-trail-card__save-btn${savedIds.includes(msg.trail.id) ? ' jc-trail-card__save-btn--saved' : ''}`}
                        onClick={(e) => { e.stopPropagation(); saveHike(msg.trail); }}
                      >
                        {savedIds.includes(msg.trail.id) ? '✓ Saved' : t('chipSaveHike', 'Save this hike')}
                      </button>
                      <button className="jc-trail-card__cta" onClick={() => viewTrail?.(msg.trail)}>
                        {t('viewDetails', 'View full details →')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Saved itinerary */}
              {msg.type === 'itinerary' && msg.steps?.length > 0 && (
                <div className="jc-itinerary">
                  <div className="jc-itinerary__head">
                    <span className="jc-itinerary__check">✓</span>
                    <p className="jc-itinerary__title">{t('savedTitle', 'All set! Your day is saved. ✦')}</p>
                  </div>
                  <ul className="jc-itinerary__list">
                    {msg.steps.map((s, i) => (
                      <li key={i} className="jc-itinerary__step">
                        <span className="jc-itinerary__time">{s.time}</span>
                        <span className="jc-itinerary__dot" />
                        <span className="jc-itinerary__label">{s.label}{s.place ? ` · ${s.place}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Chips */}
              {msg.chips?.length > 0 && (
                <div className="jc-chips">
                  {msg.chips.map(chip => (
                    <button
                      key={chip}
                      className={`jc-chip${chip === t('chipBack') ? ' jc-chip--back' : ''}${chip === t('chipSaveHike') ? ' jc-chip--save' : ''}`}
                      onClick={() => handleChip(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div className="jc-msg jc-msg--josephine">
            <div className="jc-msg__avatar">
              <img src="/josephine-portrait.png" alt="" onError={e => { e.currentTarget.src='/logo.png'; }} />
            </div>
            <div className="jc-bubble jc-bubble--typing"><span /><span /><span /></div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="jc-input-bar">
        <div className="jc-input-wrap">
          <input
            ref={inputRef}
            className="jc-input"
            placeholder={t('inputPlaceholder', 'Ask Josephine anything…')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          />
          <button className="jc-mic-btn" aria-label="Voice input">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="13" rx="3" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M5 10a7 7 0 0014 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <button className="jc-send-btn" onClick={() => sendMessage(input)} disabled={!input.trim()} aria-label="Send">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default React.memo(JosephineChat);
