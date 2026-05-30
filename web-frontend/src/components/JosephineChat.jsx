import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './JosephineChat.css';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&auto=format&fit=crop&q=70';
const SESSION_KEY  = 'josephine_session';

const LAST_STEP = 6;

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
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.slice(0, 2) || 'en';

  /* Build translated planning steps (inside component so t() works) */
  const PLANNING_STEPS = {
    1: {
      text: t('josephineChat.step1Question'),
      chips: [t('josephineChat.step1_1'), t('josephineChat.step1_2'), t('josephineChat.step1_3'), t('josephineChat.step1_4')],
      dataKey: 'duration_hours',
      chipMap: {
        [t('josephineChat.step1_1')]: 1.5,
        [t('josephineChat.step1_2')]: 3,
        [t('josephineChat.step1_3')]: 5,
        [t('josephineChat.step1_4')]: 8,
      },
    },
    2: {
      text: t('josephineChat.step2Question'),
      chips: [t('josephineChat.step2_1'), t('josephineChat.step2_2'), t('josephineChat.step2_3')],
      dataKey: 'difficulty',
      chipMap: {
        [t('josephineChat.step2_1')]: 'easy',
        [t('josephineChat.step2_2')]: 'medium',
        [t('josephineChat.step2_3')]: 'hard',
      },
    },
    3: {
      text: t('josephineChat.step3Question'),
      chips: [
        t('josephineChat.step3_1'), t('josephineChat.step3_2'), t('josephineChat.step3_3'),
        t('josephineChat.step3_4'), t('josephineChat.step3_5'), t('josephineChat.step3_6'),
        t('josephineChat.step3Done'),
      ],
      dataKey: 'interests',
    },
    4: {
      text: t('josephineChat.step4Question'),
      chips: [t('josephineChat.step4_1'), t('josephineChat.step4_2')],
      dataKey: 'withDog',
      chipMap: {
        [t('josephineChat.step4_1')]: true,
        [t('josephineChat.step4_2')]: false,
      },
    },
    5: {
      text: t('josephineChat.step4Question', 'Is this for the whole family?'),
      chips: [t('josephineChat.step5_1', 'Yes, kids coming!'), t('josephineChat.step5_2', 'Just adults')],
      dataKey: 'family_friendly',
      chipMap: {
        [t('josephineChat.step5_1', 'Yes, kids coming!')]: true,
        [t('josephineChat.step5_2', 'Just adults')]: false,
      },
    },
    6: {
      text: t('josephineChat.step5Question'),
      chips: [t('josephineChat.step5Skip')],
      dataKey: 'startArea',
    },
  };

  /* Mood → semantic value map (translated chip → English value for API) */
  const MOOD_VALUE_MAP = {
    [t('josephineChat.step3_1')]: 'alpine lakes',
    [t('josephineChat.step3_2')]: 'panoramic views',
    [t('josephineChat.step3_3')]: 'forests',
    [t('josephineChat.step3_4')]: 'cultural routes',
    [t('josephineChat.step3_5')]: 'loop',
    [t('josephineChat.step3_6')]: 'waterfalls',
  };

  const INITIAL_MESSAGES = [
    {
      id: 1, from: 'josephine', type: 'text',
      text: t('josephineChat.greeting'),
      chips: null,
    },
    {
      id: 2, from: 'josephine', type: 'text',
      text: t('josephineChat.weatherPrompt'),
      chips: [t('josephineChat.chipPlanMyDay'), t('josephineChat.chipSurpriseMe'), t('josephineChat.chipShowMap')],
    },
    {
      id: 3, from: 'josephine', type: 'voice',
      text: null, duration: '0:08', bars: [3,5,8,6,9,5,7,4,6,8,5,3,7,5,9], chips: null,
    },
  ];

  const [messages, setMessages]           = useState(() => INITIAL_MESSAGES);
  const [input, setInput]                 = useState('');
  const [typing, setTyping]               = useState(false);

  const [planningStep, setPlanningStep]   = useState(0);
  const [planningData, setPlanningData]   = useState({});
  const [resultIndex,  setResultIndex]    = useState(0);
  const [apiResults,   setApiResults]     = useState([]);
  const [selectedMoods, setSelectedMoods] = useState([]);
  const [refining, setRefining]           = useState(false);
  const [chatHistory, setChatHistory]     = useState([]);

  const bottomRef = useRef(null);
  const greetingShownRef = useRef(false);
  const inputRef  = useRef(null);
  const prevLangRef = useRef(lang);

  /* Reset conversation when language changes ───────────────────────── */
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;
    // Rebuild initial messages in the new language
    setMessages([
      { id: 1, from: 'josephine', type: 'text', text: t('josephineChat.greeting'), chips: null },
      { id: 2, from: 'josephine', type: 'text', text: t('josephineChat.weatherPrompt'),
        chips: [t('josephineChat.chipPlanMyDay'), t('josephineChat.chipSurpriseMe'), t('josephineChat.chipShowMap')] },
      { id: 3, from: 'josephine', type: 'voice', text: null, duration: '0:08',
        bars: [3,5,8,6,9,5,7,4,6,8,5,3,7,5,9], chips: null },
    ]);
    setPlanningStep(0);
    setPlanningData({});
    setResultIndex(0);
    setApiResults([]);
    setSelectedMoods([]);
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
          text: t('josephineChat.welcomeBack', { difficulty: prev.lastDifficulty, region: prev.lastRegion || t('common.theMountains', 'the mountains') }),
          chips: [t('josephineChat.chipSameVibe'), t('josephineChat.chipSomethingDifferent'), t('josephineChat.chipSurpriseMe')],
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

  /* ── Planning flow ───────────────────────────────────────────────────── */
  const startPlanningFlow = (prefill = null) => {
    setPlanningStep(1);
    setPlanningData(prefill || {});
    setResultIndex(0);
    setApiResults([]);
    setSelectedMoods([]);
    setRefining(false);

    const prev = loadSession();
    if (!prefill && prev?.duration_hours) {
      const durationLabel = Object.entries(PLANNING_STEPS[1].chipMap)
        .find(([, v]) => v === prev.duration_hours)?.[0] || `${prev.duration_hours}h`;
      setTimeout(() => {
        appendJosephineMessage({
          type: 'text',
          text: `Last time you had ${durationLabel}. Same today?`,
          chips: [`Yes, ${durationLabel}`, 'No, different'],
        });
      }, 500);
    } else {
      setTimeout(() => {
        const step = PLANNING_STEPS[1];
        appendJosephineMessage({ type: 'text', text: step.text, chips: step.chips });
      }, 500);
    }
  };

  const advancePlanningStep = (dataUpdate) => {
    const newData = { ...planningData, ...dataUpdate };
    setPlanningData(newData);
    const next = planningStep + 1;
    setPlanningStep(next);

    if (next <= LAST_STEP) {
      const step = PLANNING_STEPS[next];
      // Add ← Back chip on steps 2+ so users can revise answers
      const chips = next > 1 ? [...step.chips, t('josephineChat.chipBack')] : step.chips;
      setTimeout(() => {
        appendJosephineMessage({ type: 'text', text: step.text, chips });
      }, 600);
    } else {
      callRecommendAPI(newData);
    }
  };

  const callRecommendAPI = async (data, startIdx = 0, adjustments = {}) => {
    setPlanningStep(LAST_STEP + 1);
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
      const results = response.data.results || [];
      setApiResults(results);
      setResultIndex(startIdx);
      setTyping(false);

      const trail = results[startIdx % Math.max(results.length, 1)];
      if (trail) {
        saveSession({
          duration_hours: duration,
          difficulty,
          interests,
          lastTrail:      trail.id,
          lastDifficulty: trail.difficulty,
          lastRegion:     trail.region,
        });
        setTimeout(() => {
          appendJosephineMessage({
            type:  'trail-card',
            trail,
            chips: [t('josephineChat.chipTellMore','Tell me more'), t('josephineChat.chipShowElse'), t('josephineChat.chipTooLong','Too long'), t('josephineChat.chipTooHard','Too hard'), t('josephineChat.chipStartOver','Start over')],
          });
        }, 400);
      } else {
        setTyping(false);
        setTimeout(() => {
          appendJosephineMessage({
            type:  'text',
            text:  t('josephineChat.noMatchIntro'),
            chips: [t('josephineChat.chipStartOver','Start over')],
          });
        }, 400);
      }
    } catch {
      setTyping(false);
      setPlanningStep(0);
      setTimeout(() => {
        appendJosephineMessage({
          type:  'text',
          text:  t('josephineChat.windError'),
          chips: [t('josephineChat.retryChip'), t('josephineChat.chipStartOver','Start over')],
        });
      }, 400);
    }
  };

  /* ── Chip handler ────────────────────────────────────────────────────── */
  const handleChip = (chip) => {
    // Navigation
    if ([t('josephineChat.chipShowMap'), 'Open map', 'Show me on the map', 'Show me the map'].includes(chip)) {
      appendUserMessage(chip);
      setCurrentView?.('catalog');
      return;
    }

    // Entry
    if (chip === t('josephineChat.chipPlanMyDay')) {
      appendUserMessage(chip);
      startPlanningFlow();
      return;
    }
    if (chip === t('josephineChat.chipSameVibe')) {
      appendUserMessage(chip);
      const prev = loadSession();
      if (prev) {
        const d = { duration_hours: prev.duration_hours, difficulty: prev.difficulty,
                    interests: prev.interests || [], withDog: false, family_friendly: false, startArea: '' };
        setPlanningData(d);
        callRecommendAPI(d, 0);
      } else {
        startPlanningFlow();
      }
      return;
    }
    if (chip === t('josephineChat.chipSomethingDifferent')) {
      appendUserMessage(chip);
      startPlanningFlow(null);
      return;
    }
    if (chip === t('josephineChat.chipSurpriseMe') || chip === 'Surprise me' || chip === 'Yes, surprise me') {
      appendUserMessage(chip);
      const d = { duration_hours: 3, difficulty: 'medium', interests: [], withDog: false, family_friendly: false, startArea: '' };
      setPlanningData(d);
      callRecommendAPI(d, 0);
      return;
    }

    // Quick-reuse duration from session
    if (chip.startsWith('Yes, ') && planningStep === 1) {
      const prev = loadSession();
      if (prev?.duration_hours) {
        appendUserMessage(chip);
        advancePlanningStep({ duration_hours: prev.duration_hours });
        return;
      }
    }
    if (chip === 'No, different' && planningStep === 1) {
      appendUserMessage(chip);
      setTimeout(() => {
        appendJosephineMessage({ type: 'text', text: PLANNING_STEPS[1].text, chips: PLANNING_STEPS[1].chips });
      }, 400);
      return;
    }

    // Post-result cycling
    if (chip === t('josephineChat.chipShowElse')) {
      appendUserMessage(chip);
      const nextIdx = resultIndex + 1;
      setResultIndex(nextIdx);
      if (apiResults.length > 0) {
        const trail = apiResults[nextIdx % apiResults.length];
        setTimeout(() => {
          appendJosephineMessage({
            type:  'trail-card',
            trail,
            chips: [t('josephineChat.chipTellMore','Tell me more'), t('josephineChat.chipShowElse'), t('josephineChat.chipTooLong','Too long'), t('josephineChat.chipTooHard','Too hard'), t('josephineChat.chipStartOver','Start over')],
          });
        }, 300);
      } else {
        callRecommendAPI(planningData, nextIdx);
      }
      return;
    }

    // Fix 5: Tell me more — inline detail bubble
    if (chip === t('josephineChat.chipTellMore','Tell me more')) {
      appendUserMessage(chip);
      const trail = apiResults[resultIndex % Math.max(apiResults.length, 1)];
      if (trail) {
        setTimeout(() => {
          const seasonText = trail.best_season?.length
            ? `Best visited ${trail.best_season[0]}–${trail.best_season[trail.best_season.length - 1]}.`
            : 'Open year-round.';
          const dogText  = trail.dog_friendly  ? '🐾 Dog-friendly.' : '';
          const famText  = trail.family_friendly ? '👨‍👩‍👧 Great for families.' : '';
          const extras   = [seasonText, dogText, famText].filter(Boolean).join(' ');
          appendJosephineMessage({
            type:  'text',
            text:  `${trail.name} — ${trail.distance_km}km, ${trail.elevation_gain_m}m elevation gain. ${extras}\n\n${trail.description || ''}`.trim(),
            chips: [t('josephineChat.viewDetails'), t('josephineChat.chipShowElse'), t('josephineChat.chipStartOver','Start over')],
          });
        }, 500);
      }
      return;
    }

    if (chip === t('josephineChat.viewDetails')) {
      const trail = apiResults[resultIndex % Math.max(apiResults.length, 1)];
      if (trail) viewTrail?.(trail);
      return;
    }

    // Refinement
    if (chip === t('josephineChat.chipTooLong','Too long')) {
      appendUserMessage(chip);
      setRefining(true);
      setTimeout(() => {
        appendJosephineMessage({ type: 'text', text: t('josephineChat.refineShorter',"Got it — looking for something shorter for you."), chips: null });
        callRecommendAPI(planningData, 0, { durationDown: true });
      }, 400);
      return;
    }
    if (chip === t('josephineChat.chipTooHard','Too hard')) {
      appendUserMessage(chip);
      setRefining(true);
      setTimeout(() => {
        appendJosephineMessage({ type: 'text', text: t('josephineChat.refineEasier',"No problem — I'll find something gentler."), chips: null });
        callRecommendAPI(planningData, 0, { difficultyDown: true });
      }, 400);
      return;
    }

    // Start over
    if (chip === t('josephineChat.chipStartOver','Start over')) {
      appendUserMessage(chip);
      setPlanningStep(0);
      setPlanningData({});
      setResultIndex(0);
      setApiResults([]);
      setSelectedMoods([]);
      setRefining(false);
      setChatHistory([]);
      setTimeout(() => {
        appendJosephineMessage({
          type:  'text',
          text:  t('josephineChat.weatherPrompt'),
          chips: [t('josephineChat.chipPlanMyDay'), t('josephineChat.chipSurpriseMe'), t('josephineChat.chipShowMap')],
        });
      }, 400);
      return;
    }

    if (chip === t('josephineChat.retryChip')) {
      appendUserMessage(chip);
      callRecommendAPI(planningData, resultIndex);
      return;
    }

    // ← Back — go one step back in planning flow
    if (chip === t('josephineChat.chipBack') && planningStep > 1) {
      const prevStep = planningStep - 1;
      setPlanningStep(prevStep);
      const step = PLANNING_STEPS[prevStep];
      const chips = prevStep > 1 ? [...step.chips, t('josephineChat.chipBack')] : step.chips;
      appendUserMessage(t('josephineChat.chipChangeAnswer'));
      setTimeout(() => {
        appendJosephineMessage({
          type: 'text',
          text: `No problem — ${step.text}`,
          chips,
        });
      }, 400);
      return;
    }

    // Multi-select mood (step 3)
    if (planningStep === 3) {
      if (chip === t('josephineChat.step3Done')) {
        appendUserMessage(selectedMoods.length > 0 ? selectedMoods.join(', ') : 'Skip');
        const interests = selectedMoods.map(m => MOOD_VALUE_MAP[m] ?? m.toLowerCase());
        setSelectedMoods([]);
        advancePlanningStep({ interests });
        return;
      }
      setSelectedMoods(prev => prev.includes(chip) ? prev.filter(m => m !== chip) : [...prev, chip]);
      return;
    }

    // Mid-flow single-select steps
    if (planningStep >= 1 && planningStep <= LAST_STEP) {
      if (planningStep === LAST_STEP && chip === t('josephineChat.step5Skip')) {
        appendUserMessage(t('josephineChat.step5Skip'));
        advancePlanningStep({ startArea: '' });
        return;
      }
      appendUserMessage(chip);
      const step   = PLANNING_STEPS[planningStep];
      const mapped = step.chipMap?.[chip] ?? chip;
      advancePlanningStep({ [step.dataKey]: mapped });
      return;
    }

    // Fallback
    sendMessage(chip);
  };

  /* ── Freeform send ───────────────────────────────────────────────────── */
  const sendMessage = async (text) => {
    if (!text.trim()) return;

    // Step 6 (location)
    if (planningStep === LAST_STEP) {
      appendUserMessage(text.trim());
      setInput('');
      advancePlanningStep({ startArea: text.trim() });
      return;
    }

    const trimmed = text.trim();
    appendUserMessage(trimmed);
    setInput('');
    setTyping(true);

    try {
      const res = await axios.post('/api/chat', {
        message: trimmed,
        history: chatHistory.slice(-10),
        lang,
      });
      setTyping(false);
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: res.data.reply },
      ]);
      appendJosephineMessage({
        type: 'text',
        text: res.data.reply,
        chips: [t('josephineChat.chipPlanMyDay'), t('josephineChat.chipSurpriseMe')],
      });
    } catch {
      setTyping(false);
      appendJosephineMessage({
        type: 'text',
        text: t('josephineChat.windError'),
        chips: [t('josephineChat.chipPlanMyDay'), t('josephineChat.chipSurpriseMe')],
      });
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  const statusText =
    planningStep >= 1 && planningStep <= LAST_STEP ? t('josephineChat.statusPlanning','Planning your day…') :
    planningStep === LAST_STEP + 1 ? t('josephineChat.statusFinding','Finding your trail…') :
    refining ? t('josephineChat.statusRefining','Refining your pick…') :
    t('josephineChat.statusOnline','Online · Alpine guide');

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
            <img src="/josephine-mark.svg" alt="" className="jc-header__mark" onError={e => e.currentTarget.style.opacity='0'} />
          </div>
          <div>
            <p className="jc-header__name">Josephine</p>
            <p className="jc-header__status"><span className="jc-header__online-dot" />{statusText}</p>
          </div>
        </div>
        <button className="jc-menu-btn" aria-label="More options"><span /><span /><span /></button>
      </div>

      {/* Portrait */}
      <div className="jc-portrait">
        <img src="/josephine-pose-neutral.png" alt="Josephine" className="jc-portrait__img" onError={e => e.currentTarget.style.display='none'} />
        <div className="jc-portrait__gradient" />
      </div>

      {/* Messages */}
      <div className="jc-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`jc-msg jc-msg--${msg.from}${msg.type === 'trail-card' ? ' jc-msg--card' : ''}`}>

            {msg.from === 'josephine' && (
              <div className="jc-msg__avatar">
                <img src="/josephine-mark.svg" alt="" onError={e => e.currentTarget.style.opacity='0'} />
              </div>
            )}

            <div className="jc-msg__content">

              {/* Text bubble */}
              {msg.type === 'text' && msg.text && (
                <div className="jc-bubble">
                  <p className="jc-bubble__text">{msg.text}</p>
                </div>
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

              {/* Trail card */}
              {msg.type === 'trail-card' && msg.trail && (
                <div className="jc-trail-card">
                  <div className="jc-trail-card__photo-wrap">
                    <img
                      src={msg.trail.wallpaper || msg.trail.image_url || msg.trail.thumbnail || FALLBACK_IMG}
                      alt={msg.trail.name}
                      className="jc-trail-card__photo"
                    />
                    <div className="jc-trail-card__photo-overlay" />
                    {/* Season warning badge */}
                    {msg.trail.in_season === false && (
                      <span className="jc-trail-card__season-warn">⚠ Check season</span>
                    )}
                    <span className="jc-trail-card__pick-badge">
                      <img src="/josephine-mark.svg" alt="" className="jc-trail-card__mark" onError={e => e.currentTarget.style.display='none'} />
                      {t('josephineChat.josephinePickBadge')}
                    </span>
                  </div>
                  <div className="jc-trail-card__body">
                    <p className="jc-trail-card__region">{msg.trail.region}</p>
                    <h3 className="jc-trail-card__name">{msg.trail.name}</h3>
                    <div className="jc-trail-card__stats">
                      <span>{msg.trail.distance_km} km</span>
                      <span className="jc-trail-card__dot">·</span>
                      <span>{msg.trail.duration_hours}h</span>
                      <span className="jc-trail-card__dot">·</span>
                      <span>{msg.trail.elevation_gain_m}m ↑</span>
                    </div>
                    {/* Fix 1: real josephine note, fix 4: no truncation */}
                    {msg.trail.josephine_note && (
                      <p className="jc-trail-card__note">{msg.trail.josephine_note}</p>
                    )}
                    <button className="jc-trail-card__cta" onClick={() => viewTrail?.(msg.trail)}>
                      {t('josephineChat.viewDetails')}
                    </button>
                  </div>
                </div>
              )}

              {/* Chips */}
              {msg.chips?.length > 0 && (
                <div className="jc-chips">
                  {msg.chips.map(chip => {
                    const isMoodChip = planningStep === 3 && chip !== t('josephineChat.step3Done');
                    const isSelected = isMoodChip && selectedMoods.includes(chip);
                    return (
                      <button
                        key={chip}
                        className={`jc-chip${isSelected ? ' selected' : ''}${chip === t('josephineChat.step3Done') && selectedMoods.length > 0 ? ' jc-chip--done' : ''}${chip === t('josephineChat.chipBack') ? ' jc-chip--back' : ''}`}
                        onClick={() => handleChip(chip)}
                      >
                        {isSelected ? `✓ ${chip}` : chip}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div className="jc-msg jc-msg--josephine">
            <div className="jc-msg__avatar">
              <img src="/josephine-mark.svg" alt="" onError={e => e.currentTarget.style.opacity='0'} />
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
            placeholder={planningStep === LAST_STEP ? t('josephineChat.step5Placeholder') : t('josephineChat.inputPlaceholder')}
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

export default JosephineChat;
