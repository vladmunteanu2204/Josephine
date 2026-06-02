import React, { useState, useRef, useEffect, useCallback } from 'react';
import { trailImg } from '../utils/trailImage';
import i18nInstance from '../i18n';
import axios from 'axios';
import { detectSeason, getSeasonConfig } from '../hooks/useSeason';
import { checkDistanceFromGPS, checkDistanceWarning, buildTransportNote } from '../utils/geoAwareness';
import './JosephineChat.css';

const _seasonOverride = new URLSearchParams(window.location.search).get('season');
const _seasonConfig   = getSeasonConfig(_seasonOverride || detectSeason());

const SESSION_KEY   = 'josephine_session';
const SAVED_KEY     = 'savedTrails';
const CHAT_SAVE_KEY = 'josephine_chat_state';
const WX_LAT = 46.5, WX_LON = 11.35;

// Mutable: updated when geolocation resolves so the planning-flow weather
// card uses the user's real position rather than the Dolomites fallback.
let userLat = WX_LAT, userLon = WX_LON;

/* ── Weather → Josephine opening message ─────────────────────────────── */
function buildWeatherGreeting(w) {
  const desc = (w?.description || '').toLowerCase();
  const temp = w?.temperature ?? 14;
  const wind = w?.wind_speed ?? 0;

  if (/thunder|storm/.test(desc))
    return "Afternoon thunderstorms are forecast over the peaks today. The mountains are still worth it — but I'd plan a short morning window and be back in the valley before 13:00. Half-day itinerary?";

  if (/rain|shower|drizzle/.test(desc))
    return "It's raining in the Dolomites today — that moody, cinematic kind of beautiful. Forest paths and rifugios are your friends. I know sheltered routes that are magical in the wet. Want one?";

  if (/snow/.test(desc))
    return `Fresh snow on the upper routes today (${temp}°C). Snowshoe trails and mountain huts are at their best — a completely different kind of Dolomites. Want me to find something?`;

  if (/fog|mist/.test(desc))
    return "Mist is drifting through the valleys this morning — that rare atmospheric light that makes the Dolomites look like a painting. Perfect for a low-altitude walk. Shall I find one?";

  if (wind > 45)
    return `Strong wind on the exposed ridges today — up to ${wind} km/h. I'd steer you toward sheltered forest trails and valley paths rather than the high routes. Want a recommendation?`;

  if (/clear|sun/.test(desc)) {
    if (temp > 27)
      return `Blue skies today, but warm — ${temp}°C in the valley. Worth starting early or heading to altitude for cooler air. I know some trails near water too. What sounds right?`;
    return `Perfect conditions today — ${temp}°C, clear skies, excellent visibility. The Dolomites are putting on a show. What kind of adventure are you after?`;
  }

  if (/overcast|cloud/.test(desc)) {
    if (/few|scattered|partly/.test(desc))
      return `Sun and cloud today, ${temp}°C — classic Dolomites light. Not too hot, great for walking. What kind of adventure are you after?`;
    return `Overcast today — dramatic skies, quieter trails, beautiful diffused light. ${temp}°C and no crowds. A great day to go somewhere new. What sounds right?`;
  }

  return `The weather is looking good for a mountain day. ${temp > 0 ? temp + '°C, ' : ''}what kind of adventure are you after?`;
}

/* ── Trail preference session ────────────────────────────────────────── */
function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
function saveSession(data) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
  catch {}
}

/* ── Full chat state persistence (survives view navigation) ──────────── */
function saveChatState(state) {
  try { sessionStorage.setItem(CHAT_SAVE_KEY, JSON.stringify(state)); }
  catch {}
}
function loadChatState() {
  try { return JSON.parse(sessionStorage.getItem(CHAT_SAVE_KEY)); }
  catch { return null; }
}

/* ── Component ───────────────────────────────────────────────────────── */
function JosephineChat({ onBack, setCurrentView, viewTrail }) {
  const [lang, setLang] = useState(() => i18nInstance.language?.slice(0, 2) || 'en');
  useEffect(() => {
    const handler = (lng) => setLang((lng || i18nInstance.language || 'en').slice(0, 2));
    i18nInstance.on('languageChanged', handler);
    return () => i18nInstance.off('languageChanged', handler);
  }, []);

  // Reset page scroll on mount so entering the chat never lands at the footer
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const t = useCallback(
    (key, fallback) => {
      const full = `josephineChat.${key}`;
      const val = i18nInstance.t(full);
      return (val && val !== full) ? val : (fallback ?? key);
    },
    [lang],
  );

  const MOODS = (_seasonConfig.moodTiles ?? []).map(m => ({ ...m }));
  const moodByLabel = Object.fromEntries(MOODS.map(m => [m.label, m.bundle]));

  /* Build initial messages using i18nInstance directly (no hook needed) */
  const _t0 = (k, fb) => {
    const full = `josephineChat.${k}`;
    const v = i18nInstance.t(full);
    return (v && v !== full) ? v : (fb ?? k);
  };
  const makeInitialMessages = useCallback(() => [
    { id: 1, from: 'josephine', type: 'text', text: t('greeting'), chips: null },
  ], [t]);

  /* ── State ──────────────────────────────────────────────────────────── */
  const savedChatRef = useRef(loadChatState());

  const [messages, setMessages] = useState(() => {
    const saved = savedChatRef.current;
    if (saved?.messages?.length > 1) return saved.messages;
    return [
      { id: 1, from: 'josephine', type: 'text', text: _t0('greeting'), chips: null },
    ];
  });

  const [input, setInput]             = useState('');
  const [typing, setTyping]           = useState(false);
  const [planningStep, setPlanningStep] = useState(() => savedChatRef.current?.planningStep ?? 0);
  const [planningData, setPlanningData] = useState(() => savedChatRef.current?.planningData ?? {});
  const [apiResults, setApiResults]   = useState([]);
  const [selectedTrail, setSelectedTrail] = useState(null);
  const [savedIds, setSavedIds]       = useState(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
  });
  const [refining, setRefining]           = useState(false);
  const [awaitingRefinement, setAwaitingRefinement] = useState(null); // 'length' | 'difficulty' | null
  const [chatHistory, setChatHistory]     = useState([]);
  const [showMenu, setShowMenu]       = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isListening, setIsListening] = useState(false);

  /* ── Chip freezing: chips in messages older than the latest user msg ── */
  const lastUserMsgId = messages.reduce(
    (max, m) => m.from === 'user' ? Math.max(max, m.id) : max, 0
  );
  const isChipActive = (msg) => msg.id > lastUserMsgId;

  /* ── Refs ───────────────────────────────────────────────────────────── */
  const bottomRef        = useRef(null);
  const messagesRef      = useRef(null);
  const greetingShownRef = useRef(false);
  const inputRef         = useRef(null);
  const menuRef          = useRef(null);
  const prevLangRef      = useRef(lang);
  const recognitionRef   = useRef(null);
  const sendMsgRef       = useRef(null); // keeps sendMessage fresh for mic closure

  /* ── Web Speech API ─────────────────────────────────────────────────── */
  const SpeechRecognitionAPI =
    (typeof window !== 'undefined' &&
     (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

  /* ── Persist chat state on every change ─────────────────────────────── */
  useEffect(() => {
    saveChatState({ messages, planningStep, planningData });
  }, [messages, planningStep, planningData]);

  /* ── Reset on language change ────────────────────────────────────────── */
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;
    setMessages(makeInitialMessages());
    setPlanningStep(0); setPlanningData({}); setApiResults([]);
    setSelectedTrail(null); setChatHistory([]); setAwaitingRefinement(null);
    try { sessionStorage.removeItem(CHAT_SAVE_KEY); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  /* ── Opening message: live weather or welcome-back ──────────────────── */
  useEffect(() => {
    if (greetingShownRef.current) return;
    greetingShownRef.current = true;

    // Restoring a saved conversation — nothing to do
    if (savedChatRef.current?.messages?.length > 1) return;

    const prev = loadSession();

    // Returning user: show personalised welcome-back (no weather needed)
    if (prev?.lastTrail && prev?.lastDifficulty) {
      const region = prev.lastRegion || 'the mountains';
      const diff   = prev.lastDifficulty;
      const text   = t('welcomeBack', 'Welcome back! Ready for another adventure?')
        .replace('{{difficulty}}', diff)
        .replace('{{region}}', region);
      setMessages([
        { id: 1, from: 'josephine', type: 'text', text: t('greeting'), chips: null },
        { id: Date.now(), from: 'josephine', type: 'text', text,
          chips: [t('chipSameVibe'), t('chipSomethingDifferent'), t('chipSurpriseMe')] },
      ]);
      return;
    }

    // Fresh start: request location → fetch weather → craft message 2
    setTyping(true);

    const showMessage = async (lat, lon) => {
      userLat = lat; userLon = lon;
      let weatherData = null;
      try {
        const res = await axios.get('/api/weather/current', { params: { lat, lon } });
        weatherData = res.data;
      } catch { /* fall through — null gives a generic message */ }
      const text = buildWeatherGreeting(weatherData);
      setTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now(),
        from: 'josephine',
        type: 'text',
        text,
        chips: [t('chipPlanMyDay'), t('chipSurpriseMe'), t('chipShowMap')],
      }]);
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => showMessage(pos.coords.latitude, pos.coords.longitude),
        ()  => showMessage(WX_LAT, WX_LON),
        { timeout: 5000, maximumAge: 300000 },
      );
    } else {
      showMessage(WX_LAT, WX_LON);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    if (!showMenu) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  const appendJosephineMessage = (partial) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), from: 'josephine', ...partial }]);
  };
  const appendUserMessage = (text) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), from: 'user', type: 'text', text, chips: null }]);
  };

  /* ── Clear conversation ─────────────────────────────────────────────── */
  const clearConversation = () => {
    setMessages(makeInitialMessages());
    setPlanningStep(0); setPlanningData({}); setApiResults([]);
    setSelectedTrail(null); setRefining(false); setChatHistory([]);
    setAwaitingRefinement(null); setInput(''); setShowMenu(false);
    try { sessionStorage.removeItem(CHAT_SAVE_KEY); } catch {}
  };

  /* ── Share ──────────────────────────────────────────────────────────── */
  const shareConversation = () => {
    const lines = ['🏔 My plan with Josephine\n'];
    messages.forEach(m => {
      if (m.from === 'user' && m.type === 'text') lines.push(`You: ${m.text}`);
      else if (m.from === 'josephine' && m.type === 'text' && m.text) lines.push(`Josephine: ${m.text}`);
      else if (m.type === 'trail' && m.trail) lines.push(`📍 Trail: ${m.trail.name}`);
    });
    lines.push('\nPlanned with Josephine — your alpine companion in South Tyrol.');
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyFeedback(true);
      setShowMenu(false);
      setTimeout(() => setCopyFeedback(false), 2000);
    }).catch(() => {});
  };

  /* ── Conditions builder (adaptive title) ────────────────────────────── */
  const buildConditions = (w) => {
    const desc = (w?.description || '').toLowerCase();
    let sky, emoji, condTitle;
    if (/thunder|storm/.test(desc)) {
      sky = t('skyRain', 'Showers possible'); emoji = '⛈';
      condTitle = t('conditionsStorm', 'Afternoon storms — start early!');
    } else if (/rain|shower|drizzle/.test(desc)) {
      sky = t('skyRain', 'Showers possible'); emoji = '🌦️';
      condTitle = t('conditionsRain', 'Pack your waterproofs today.');
    } else if (/clear|sun/.test(desc)) {
      sky = t('skyClear', 'Clear skies'); emoji = '☀️';
      condTitle = t('conditionsClear', 'Perfect hiking weather today!');
    } else if (/cloud|overcast/.test(desc)) {
      const few = /few|scattered|partly/.test(desc);
      sky = few ? t('skyPartly', 'Partly cloudy') : t('skyCloudy', 'Cloudy');
      emoji = few ? '⛅' : '☁️';
      condTitle = t('conditionsGood', 'Good conditions today');
    } else {
      sky = t('skyPartly', 'Partly cloudy'); emoji = '⛅';
      condTitle = t('conditionsClear', 'Perfect hiking weather today!');
    }
    const vis = (w?.visibility ?? 10) >= 9
      ? t('visExcellent', 'Excellent visibility')
      : t('visGood', 'Good visibility');
    return { temp: w?.temperature ?? 14, sky, emoji, vis, wind: w?.wind_speed ?? null, condTitle };
  };

  /* ── Plan flow ───────────────────────────────────────────────────────── */
  const startPlanningFlow = () => {
    setPlanningStep(1);
    setPlanningData({});
    setApiResults([]);
    setSelectedTrail(null);
    setRefining(false);
    setTimeout(() => {
      // Combined intro text + mood grid in one message (removes the visual gap between them)
      appendJosephineMessage({ type: 'mood-intro', text: t('moodIntro'), moods: MOODS });
    }, 450);
  };

  const runConditionsThenOptions = async (data) => {
    setPlanningStep(2);
    setTyping(true);
    let conditions;
    try {
      const w = await axios.get('/api/weather/current', { params: { lat: userLat, lon: userLon } });
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

    const interests = [...(data.interests || []), ...(data.withDog ? ['dog-friendly'] : [])];

    try {
      const response = await axios.post('/api/ai/recommend', {
        duration_hours: duration, difficulty, interests,
        family_friendly: data.family_friendly ?? false,
        start_area: data.startArea ?? '',
        ...(data.max_distance_km ? { max_distance_km: data.max_distance_km } : {}),
      });
      // Backend signals no trails near the requested area
      if (response.data.area_not_found) {
        const area = response.data.area || data.startArea || 'that area';
        setTyping(false);
        setTimeout(() => {
          appendJosephineMessage({
            type: 'text',
            text: `I don't have any trails near ${area} in my database yet. Try a nearby valley or village — or let me suggest something in the wider Dolomites region?`,
            chips: [t('chipPlanMyDay'), t('chipStartOver')],
          });
        }, 350);
        return;
      }

      const results = (response.data.results || []).slice(0, 3);
      setApiResults(results);
      setTyping(false);

      if (results.length) {
        const first = results[0];
        saveSession({
          duration_hours: duration, difficulty, interests,
          lastTrail: first.id, lastDifficulty: first.difficulty, lastRegion: first.region,
        });
        const optionsIntros = [
          "I found three beautiful options for you. Each one fits what you're after. ✦",
          "Here are three trails I think you'll love. Take a look. ✦",
          "Three picks — all curated for today. Let me know which speaks to you. ✦",
          "I've pulled three routes that match perfectly. Which feels right? ✦",
        ];

        // ── Geographic awareness: warn if trail region is far from user ──────
        // Primary: compare against user's actual GPS position (most accurate).
        // Fallback: if GPS is unavailable, compare against their typed start area.
        const distWarning =
          checkDistanceFromGPS(userLat, userLon, first.region) ??
          (data.startArea ? checkDistanceWarning(data.startArea, first.region) : null);

        setTimeout(() => {
          appendJosephineMessage({ type: 'text', text: optionsIntros[Math.floor(Math.random() * optionsIntros.length)], chips: null });
          appendJosephineMessage({
            type: 'options', trails: results,
            chips: [t('chipTooLong'), t('chipTooHard'), t('chipStartOver')],
          });
          if (distWarning) {
            setTimeout(() => {
              appendJosephineMessage({
                type: 'text',
                text: buildTransportNote(distWarning, Date.now()),
                chips: ['Yes, this works', 'Find something closer'],
              });
            }, 600);
          }
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

  /* Trail option tapped → expanded card in chat */
  const showTrailDetail = (trail) => {
    setSelectedTrail(trail);
    appendUserMessage(trail.name);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      appendJosephineMessage({
        type: 'trail-card', trail,
        chips: [t('chipTooLong'), t('chipTooHard'), t('chipStartOver')],
      });
    }, 500);
  };

  /* Save → persist + itinerary timeline with "View saved" CTA */
  const saveHike = (trail) => {
    if (!trail) return;
    setSavedIds(prev => {
      const next = prev.includes(trail.id) ? prev : [...prev, trail.id];
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    appendJosephineMessage({
      type: 'itinerary', trail, steps: buildItinerary(trail),
      chips: [t('chipViewSaved'), t('chipStartOver')],
    });
  };

  const buildItinerary = (trail) => {
    const dur = trail.duration_hours || 3;
    const fmt = (h) => `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h - Math.floor(h)) * 60)).padStart(2,'0')}`;
    const start = 9;
    const stopName = trail.pois?.[0]?.name || t('itinStop', 'Rest & refuel');
    return [
      { time: fmt(start),              label: t('itinStart',  'Set off'),      place: trail.region || '' },
      { time: fmt(start + 0.2),        label: t('itinTrail',  'On the trail'), place: trail.name },
      { time: fmt(start + dur * 0.55), label: t('itinStop',   'Rest & refuel'), place: stopName },
      { time: fmt(start + dur),        label: t('itinReturn', 'Head home'),    place: '' },
    ];
  };

  const goodToKnowRows = (trail) => {
    const rows = [];
    if (trail.best_season?.length) {
      const s = trail.best_season;
      rows.push([t('gtkBestTime', 'Best time'), s.length > 1 ? `${s[0]}–${s[s.length-1]}` : s[0]]);
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

  /* ── Freeform intent parser ──────────────────────────────────────────── */
  const parseRecommendIntent = (text) => {
    const tl = text.toLowerCase();
    const TRIGGERS = [
      'give me a hike','find me a hike','suggest a hike','recommend a hike',
      'give me a trail','find me a trail','suggest a trail',
      'give me something','find something','show me a hike','show me a trail',
      'any hike','a hike from','a trail from','hike starting from',
      'trail starting from','hike near','trail near','something near',
      'where can i hike','where should i hike','what trail',
    ];
    // Also trigger on "a hike in [place]" / "hike in [place]"
    const hasInPlace = /\bhike\b.*\bin\b|\btrail\b.*\bin\b|\bsomething\b.*\bin\b|\bwalk\b.*\bin\b/i.test(tl);
    if (!TRIGGERS.some(x => tl.includes(x)) && !hasInPlace) return null;

    // Match explicit prepositions first; fall back to "in" for place names
    const loc = text.match(/(?:from|near|around|starting from|starting at|close to)\s+([A-Za-zÀ-ÿ\s]+?)(?:\s*$|\s*[,.])/i)
             ?? text.match(/\bin\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,24})(?:\s*$|\s*[,?.])/i);
    // For "in [place]" matches, filter out non-geographic phrases
    const NON_PLACES = /^(the |a |an |my |this |that |summer|winter|spring|autumn|morning|afternoon|evening|july|june|august)/i;
    const rawArea = loc ? loc[1].trim() : '';
    const startArea = (rawArea && NON_PLACES.test(rawArea)) ? '' : rawArea;
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

  /* ── Freeform send ───────────────────────────────────────────────────── */
  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;
    const trimmed = text.trim();
    const tl = trimmed.toLowerCase();

    // ── Refinement follow-up: length ────────────────────────────────────
    if (awaitingRefinement === 'length') {
      const kmMatch = tl.match(/(?:under|below|less than|max|maximum)?\s*(\d+(?:\.\d+)?)\s*km?/i);
      const maxKm = kmMatch ? parseFloat(kmMatch[1])
        : tl.includes('5') ? 5
        : tl.includes('8') ? 8
        : tl.includes('12') ? 12
        : null;
      if (maxKm) {
        appendUserMessage(trimmed);
        setInput('');
        setAwaitingRefinement(null);
        setRefining(true);
        const d = { ...planningData, max_distance_km: maxKm };
        setPlanningData(d);
        const acks = [
          `Perfect — finding trails under ${maxKm} km for you.`,
          `On it — I'll keep it under ${maxKm} km.`,
          `Got it. Looking for something under ${maxKm} km now.`,
        ];
        appendJosephineMessage({ type: 'text', text: acks[Math.floor(Math.random() * acks.length)], chips: null });
        callRecommendAPI(d);
        return;
      }
    }

    // ── Refinement follow-up: difficulty ────────────────────────────────
    if (awaitingRefinement === 'difficulty') {
      let newDifficulty = null;
      if (/easy|gentle|relaxed|beginner|stroll|simple/i.test(tl)) newDifficulty = 'easy';
      else if (/moderate|medium|normal|manageable/i.test(tl)) newDifficulty = 'medium';
      else if (/any|whatever|don.t mind|surprise/i.test(tl)) newDifficulty = planningData.difficulty ?? 'medium';
      if (newDifficulty) {
        appendUserMessage(trimmed);
        setInput('');
        setAwaitingRefinement(null);
        setRefining(true);
        const d = { ...planningData, difficulty: newDifficulty, max_distance_km: undefined };
        setPlanningData(d);
        const acks = {
          easy: ["Perfect — finding something easy and scenic.", "On it — a relaxed trail, coming up.", "Easy it is. Looking now."],
          medium: ["Great — looking for a moderate route.", "On it — something balanced, coming up.", "Moderate works. Searching now."],
        };
        const pool = acks[newDifficulty] || acks.medium;
        appendJosephineMessage({ type: 'text', text: pool[Math.floor(Math.random() * pool.length)], chips: null });
        callRecommendAPI(d);
        return;
      }
    }

    // ── Detect "too long / too hard" typed as free text ─────────────────
    if (planningStep > 0 && /too long|too far|too many km|too much/i.test(tl)) {
      setAwaitingRefinement('length');
      const refDist = apiResults[0]?.distance_km;
      const hint = refDist ? ` The shortest I suggested was ${refDist} km.` : '';
      appendUserMessage(trimmed);
      setInput('');
      appendJosephineMessage({
        type: 'text',
        text: `How long would you like?${hint} Tell me a distance and I'll find it.`,
        chips: ['Under 5 km', 'Under 8 km', 'Under 12 km'],
      });
      return;
    }
    if (planningStep > 0 && /too hard|too difficult|too steep|too challenging|too strenuous/i.test(tl)) {
      setAwaitingRefinement('difficulty');
      appendUserMessage(trimmed);
      setInput('');
      appendJosephineMessage({
        type: 'text',
        text: "What difficulty works for you today?",
        chips: ['Easy walk', 'Moderate', 'Any level'],
      });
      return;
    }

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
          ? `On it — let me find something near ${intent.startArea}…`
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
      // Structured knowledge answers (gear, food, bus, emergency…) stand alone —
      // no planning CTAs. LLM / open-ended answers offer to continue the conversation.
      const knowledgeChips = res.data.mode === 'structured' ? null : [t('chipPlanMyDay'), t('chipSurpriseMe')];
      appendJosephineMessage({ type: 'text', text: res.data.reply, chips: knowledgeChips });
    } catch {
      setTyping(false);
      appendJosephineMessage({ type: 'text', text: t('windError'), chips: [t('chipPlanMyDay'), t('chipSurpriseMe')] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory, lang, t, awaitingRefinement, apiResults, planningData, planningStep]);

  // Keep ref fresh so mic closure can call the latest version
  sendMsgRef.current = sendMessage;

  /* ── Mic toggle (Web Speech API) ────────────────────────────────────── */
  const toggleMic = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = lang === 'de' ? 'de-DE' : lang === 'it' ? 'it-IT' : 'en-GB';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      setTimeout(() => sendMsgRef.current?.(transcript), 200);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend  = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [SpeechRecognitionAPI, isListening, lang]);

  /* ── Chip handler ────────────────────────────────────────────────────── */
  const handleChip = (chip) => {
    if ([t('chipShowMap'), 'Open map', 'Show me on the map', 'Show me the map'].includes(chip)) {
      appendUserMessage(chip);
      setCurrentView?.('catalog');
      return;
    }
    if (chip === t('chipViewSaved')) {
      appendUserMessage(chip);
      setCurrentView?.('savedTrails');
      return;
    }
    if (planningStep === 1 && moodByLabel[chip]) {
      appendUserMessage(chip);
      const bundle = moodByLabel[chip];
      setPlanningData(bundle);
      runConditionsThenOptions(bundle);
      return;
    }
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
    if ([t('chipSurpriseMe'), 'Surprise me', 'Yes, surprise me'].includes(chip)) {
      appendUserMessage(chip);
      const d = { duration_hours: 3, difficulty: 'medium', interests: [], withDog: false, family_friendly: false, startArea: '' };
      setPlanningData(d);
      runConditionsThenOptions(d);
      return;
    }
    if (chip === t('chipSaveHike')) {
      appendUserMessage(chip);
      saveHike(selectedTrail);
      return;
    }
    if (chip === t('viewDetails')) {
      if (selectedTrail) viewTrail?.(selectedTrail);
      return;
    }
    if (chip === t('chipTooLong')) {
      appendUserMessage(chip);
      setAwaitingRefinement('length');
      const refDist = apiResults[0]?.distance_km;
      const hint = refDist ? ` The shortest I suggested was ${refDist} km.` : '';
      const questions = [
        `How long would you like?${hint} I can look for under 5 km, under 8 km — or tell me your preference.`,
        `Good to know. What distance works for you?${hint} Pick below or just tell me.`,
        `Noted. How far is comfortable for you?${hint} Give me a number and I'll find it.`,
      ];
      setTimeout(() => {
        appendJosephineMessage({
          type: 'text',
          text: questions[Math.floor(Math.random() * questions.length)],
          chips: ['Under 5 km', 'Under 8 km', 'Under 12 km'],
        });
      }, 400);
      return;
    }
    if (chip === t('chipTooHard')) {
      appendUserMessage(chip);
      setAwaitingRefinement('difficulty');
      const questions = [
        "How challenging would you like it? I can find something easy, moderate — or you tell me.",
        "Understood. What difficulty works for you today?",
        "Of course. What level are you comfortable with?",
      ];
      setTimeout(() => {
        appendJosephineMessage({
          type: 'text',
          text: questions[Math.floor(Math.random() * questions.length)],
          chips: ['Easy walk', 'Moderate', 'Any level'],
        });
      }, 400);
      return;
    }
    if (chip === t('chipStartOver')) {
      appendUserMessage(chip);
      setPlanningStep(0); setPlanningData({}); setApiResults([]);
      setSelectedTrail(null); setRefining(false); setChatHistory([]);
      setTimeout(() => {
        appendJosephineMessage({
          type: 'text',
          text: t('startOver', 'Let\'s start fresh. What kind of adventure are you after today?'),
          chips: [t('chipPlanMyDay'), t('chipSurpriseMe'), t('chipShowMap')],
        });
      }, 400);
      return;
    }
    if (chip === t('retryChip')) { appendUserMessage(chip); runConditionsThenOptions(planningData); return; }

    // ── Geographic awareness chips ─────────────────────────────────────────
    if (chip === 'Yes, this works') {
      appendUserMessage(chip);
      appendJosephineMessage({
        type: 'text',
        text: "Perfect — enjoy the journey there too. Let me know if you need any other info.",
        chips: null,
      });
      return;
    }
    if (chip === 'Find something closer') {
      appendUserMessage(chip);
      // Re-search with the same params but drop startArea so the backend
      // returns trails from the wider region without a distance penalty
      const d = { ...planningData, startArea: '' };
      setPlanningData(d);
      appendJosephineMessage({
        type: 'text',
        text: "Of course — let me find something closer to you.",
        chips: null,
      });
      setTimeout(() => callRecommendAPI(d), 400);
      return;
    }

    sendMessage(chip);
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  const statusText =
    planningStep === 1 ? t('statusPlanning', 'Planning your day…') :
    planningStep === 2 ? t('statusFinding',  'Finding your trail…') :
    refining           ? t('statusRefining', 'Refining your pick…') :
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
            <img src="/josephine-portrait.png" alt="" className="jc-header__mark"
              onError={e => { e.currentTarget.src='/logo.png'; }} />
          </div>
          <div>
            <p className="jc-header__name">Josephine</p>
            <p className="jc-header__status"><span className="jc-header__online-dot" />{statusText}</p>
          </div>
        </div>
        <div className="jc-menu-wrap" ref={menuRef}>
          <button className="jc-menu-btn" aria-label="More options" onClick={() => setShowMenu(v => !v)}>
            <span /><span /><span />
          </button>
          {showMenu && (
            <div className="jc-menu-dropdown">
              <button className="jc-menu-item" onClick={shareConversation}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M11 9.5a2.5 2.5 0 1 1 0 2.5M4 7.5l7-3.5M4 7.5l7 3.5M4 7.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 4 7.5Z"
                    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('menuShare', 'Share conversation')}
              </button>
              <button className="jc-menu-item" onClick={() => { setShowMenu(false); setCurrentView?.('savedTrails'); }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M3 2h9a1 1 0 0 1 1 1v10l-4.5-2.5L4 13V3a1 1 0 0 1 1-1z"
                    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('menuSaved', 'View saved trails')}
              </button>
              <button className="jc-menu-item jc-menu-item--danger" onClick={clearConversation}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M2 4h11M5 4V2h5v2M6 7v5M9 7v5M3 4l1 9h7l1-9"
                    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('menuClear', 'Clear conversation')}
              </button>
            </div>
          )}
        </div>
        {copyFeedback && <div className="jc-copy-toast">{t('copied', 'Copied ✓')}</div>}
      </div>

      {/* Messages */}
      <div className="jc-messages" ref={messagesRef}>
        {messages.map((msg, idx) => {
          const active = isChipActive(msg);
          const prevMsg = messages[idx - 1];
          const isFirstInRun = msg.from === 'josephine' && prevMsg?.from !== 'josephine';
          const isGrouped    = msg.from === 'josephine' && !isFirstInRun;
          return (
            <div key={msg.id}
              className={`jc-msg jc-msg--${msg.from}${
                (msg.type === 'trail-card' || msg.type === 'options' || msg.type === 'conditions' ||
                 msg.type === 'itinerary' || msg.type === 'mood-intro') ? ' jc-msg--card' : ''}${
                isGrouped ? ' jc-msg--grouped' : ''}`}
            >
              {msg.from === 'josephine' && (
                <div className="jc-msg__avatar" style={isFirstInRun ? {} : { visibility: 'hidden' }}>
                  <img src="/josephine-portrait.png" alt=""
                    onError={e => { e.currentTarget.src='/logo.png'; }} />
                </div>
              )}

              <div className="jc-msg__content">

                {/* Text bubble */}
                {msg.type === 'text' && msg.text && (
                  <div className="jc-bubble"><p className="jc-bubble__text">{msg.text}</p></div>
                )}

                {/* Mood intro: text bubble + grid in one message (fix 16) */}
                {msg.type === 'mood-intro' && (
                  <>
                    <div className="jc-bubble">
                      <p className="jc-bubble__text">{msg.text}</p>
                    </div>
                    <div className={`jc-mood-grid${!active ? ' jc-mood-grid--spent' : ''}`}>
                      {(msg.moods || []).map(mood => (
                        <button
                          key={mood.label}
                          className="jc-mood-tile"
                          disabled={!active}
                          onClick={() => {
                            if (!active) return;
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
                  </>
                )}

                {/* Conditions card (adaptive title, deduped bullets — fixes 3 & 12) */}
                {msg.type === 'conditions' && msg.conditions && (
                  <div className="jc-conditions">
                    <div className="jc-conditions__head">
                      <span className="jc-conditions__emoji">{msg.conditions.emoji}</span>
                      <div>
                        <p className="jc-conditions__title">{msg.conditions.condTitle}</p>
                        <p className="jc-conditions__temp">{msg.conditions.temp}°C · {msg.conditions.sky}</p>
                      </div>
                    </div>
                    <ul className="jc-conditions__list">
                      <li>✦ {msg.conditions.vis}</li>
                      {msg.conditions.wind != null && <li>✦ {msg.conditions.wind} km/h wind</li>}
                      <li>✦ {t('conditionsTip', 'Start by 09:00 to beat afternoon storms')}</li>
                    </ul>
                  </div>
                )}

                {/* Three options (disabled when spent — fix 9) */}
                {msg.type === 'options' && msg.trails?.length > 0 && (
                  <div className={`jc-options${!active ? ' jc-options--spent' : ''}`}>
                    {msg.trails.map((tr, i) => (
                      <button key={tr.id || i} className="jc-option"
                        disabled={!active}
                        onClick={() => { if (active) showTrailDetail(tr); }}>
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

                {/* Trail card — View details primary, Save secondary (fix 5); label removed (fix 10) */}
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
                        <img src="/logo.png" alt="" className="jc-trail-card__mark"
                          onError={e => e.currentTarget.style.display='none'} />
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

                      {/* Note shown as italic quote without a label (fix 10) */}
                      {msg.trail.josephine_note && (
                        <div className="jc-why">
                          <p className="jc-why__text">"{msg.trail.josephine_note}"</p>
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

                      {/* Hierarchy: View details (primary gold) → Save (secondary outlined) */}
                      <div className="jc-trail-card__actions">
                        <button className="jc-trail-card__cta" onClick={() => viewTrail?.(msg.trail)}>
                          {t('viewDetails', 'View full details →')}
                        </button>
                        <button
                          className={`jc-trail-card__save-btn${savedIds.includes(msg.trail.id) ? ' jc-trail-card__save-btn--saved' : ''}`}
                          onClick={(e) => { e.stopPropagation(); saveHike(msg.trail); }}
                        >
                          {savedIds.includes(msg.trail.id) ? '✓ Saved' : t('chipSaveHike', 'Save this hike')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Itinerary */}
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

                {/* Chips — disabled when conversation has moved on (fix 9) */}
                {msg.chips?.length > 0 && (
                  <div className="jc-chips">
                    {msg.chips.map(chip => (
                      <button
                        key={chip}
                        disabled={!active}
                        className={`jc-chip${chip === t('chipBack') ? ' jc-chip--back' : ''}${!active ? ' jc-chip--spent' : ''}`}
                        onClick={() => { if (active) handleChip(chip); }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

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
            placeholder={isListening ? t('listeningLabel', 'Listening…') : t('inputPlaceholder', 'Ask Josephine anything…')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          />
          {SpeechRecognitionAPI && (
            <button
              className={`jc-mic-btn${isListening ? ' jc-mic-btn--listening' : ''}`}
              aria-label={isListening ? t('listeningLabel', 'Listening…') : 'Voice input'}
              onClick={toggleMic}
            >
              {isListening ? (
                <span className="jc-mic-pulse" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="13" rx="3" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M5 10a7 7 0 0014 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          )}
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
