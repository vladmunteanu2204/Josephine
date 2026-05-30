import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './JosephineChat.css';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&auto=format&fit=crop&q=70';
const SESSION_KEY  = 'josephine_session';

/* ── Conversation steps ─────────────────────────────────────────────── */
const PLANNING_STEPS = {
  1: {
    text: "How much time do you have today?",
    chips: ["1–2h", "3–4h", "5–6h", "Full day"],
    dataKey: 'duration_hours',
    chipMap: { "1–2h": 1.5, "3–4h": 3, "5–6h": 5, "Full day": 8 },
  },
  2: {
    text: "How are you feeling today?",
    chips: ["Take it easy", "Good energy", "Push hard"],
    dataKey: 'difficulty',
    chipMap: { "Take it easy": 'easy', "Good energy": 'medium', "Push hard": 'hard' },
  },
  3: {
    // multi-select — handled specially in handleChip
    text: "What's calling you? Pick as many as you like, then tap Done ✓",
    chips: ["Alpine lakes", "Panoramic views", "Forests", "Cultural routes", "Loop trail", "Waterfalls", "Done ✓"],
    dataKey: 'interests',
  },
  4: {
    text: "Are you hiking with your dog?",
    chips: ["Yes, bringing her!", "No dog today"],
    dataKey: 'withDog',
    chipMap: { "Yes, bringing her!": true, "No dog today": false },
  },
  // Fix 3: family-friendly step
  5: {
    text: "Is this for the whole family?",
    chips: ["Yes, kids coming!", "Just adults"],
    dataKey: 'family_friendly',
    chipMap: { "Yes, kids coming!": true, "Just adults": false },
  },
  6: {
    text: "Where are you starting from? (type below or skip)",
    chips: ["Skip"],
    dataKey: 'startArea',
  },
};

const LAST_STEP = 6;

const MOOD_VALUE_MAP = {
  "Alpine lakes":    'alpine lakes',
  "Panoramic views": 'panoramic views',
  "Forests":         'forests',
  "Cultural routes": 'cultural routes',
  "Loop trail":      'loop',
  "Waterfalls":      'waterfalls',
};

/* ── Session memory ─────────────────────────────────────────────────── */
function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
function saveSession(data) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
  catch {}
}

const INITIAL_MESSAGES = [
  {
    id: 1,
    from: 'josephine',
    type: 'text',
    text: "Ciao! ✦ I'm Josephine, your alpine companion. I know these mountains inside out — the hidden paths, the best rifugios, the moments that take your breath away.",
    chips: null,
  },
  {
    id: 2,
    from: 'josephine',
    type: 'text',
    text: "The weather is perfect today for a panoramic hike. What kind of adventure are you after?",
    chips: ['Plan my day', 'Surprise me', 'Show me the map'],
  },
  {
    id: 3,
    from: 'josephine',
    type: 'voice',
    text: null,
    duration: '0:08',
    bars: [3,5,8,6,9,5,7,4,6,8,5,3,7,5,9],
    chips: null,
  },
];

/* ── Component ───────────────────────────────────────────────────────── */
function JosephineChat({ onBack, setCurrentView, viewTrail }) {
  const [messages, setMessages]           = useState(INITIAL_MESSAGES);
  const [input, setInput]                 = useState('');
  const [typing, setTyping]               = useState(false);

  const [planningStep, setPlanningStep]   = useState(0);
  const [planningData, setPlanningData]   = useState({});
  const [resultIndex,  setResultIndex]    = useState(0);
  const [apiResults,   setApiResults]     = useState([]);
  const [selectedMoods, setSelectedMoods] = useState([]);
  const [refining, setRefining]           = useState(false);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  /* Session memory greeting ─────────────────────────────────────────── */
  useEffect(() => {
    const prev = loadSession();
    if (prev?.lastTrail && prev?.lastDifficulty) {
      setTimeout(() => {
        appendJosephineMessage({
          type: 'text',
          text: `Welcome back! Last time you went for a ${prev.lastDifficulty} trail near ${prev.lastRegion || 'the mountains'}. Same vibe today, or something different?`,
          chips: ['Same vibe', 'Something different', 'Surprise me'],
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
      setTimeout(() => {
        appendJosephineMessage({ type: 'text', text: step.text, chips: step.chips });
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
            chips: ['Tell me more', 'Show me something else', 'Too long', 'Too hard', 'Start over'],
          });
        }, 400);
      } else {
        setTyping(false);
        setTimeout(() => {
          appendJosephineMessage({
            type:  'text',
            text:  "Hmm, I couldn't find a trail matching those exactly. Want to try adjusting your preferences?",
            chips: ['Start over'],
          });
        }, 400);
      }
    } catch {
      setTyping(false);
      setPlanningStep(0);
      setTimeout(() => {
        appendJosephineMessage({
          type:  'text',
          text:  "I couldn't reach the mountain spirits right now. Try again?",
          chips: ['Try again', 'Start over'],
        });
      }, 400);
    }
  };

  /* ── Chip handler ────────────────────────────────────────────────────── */
  const handleChip = (chip) => {
    // Navigation
    if (['Open map', 'Show me on the map', 'Show me the map'].includes(chip)) {
      appendUserMessage(chip);
      setCurrentView?.('catalog');
      return;
    }

    // Entry
    if (chip === 'Plan my day') {
      appendUserMessage(chip);
      startPlanningFlow();
      return;
    }
    if (chip === 'Same vibe') {
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
    if (chip === 'Something different') {
      appendUserMessage(chip);
      startPlanningFlow(null);
      return;
    }
    if (chip === 'Surprise me' || chip === 'Yes, surprise me') {
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
    if (chip === 'Show me something else') {
      appendUserMessage(chip);
      const nextIdx = resultIndex + 1;
      setResultIndex(nextIdx);
      if (apiResults.length > 0) {
        const trail = apiResults[nextIdx % apiResults.length];
        setTimeout(() => {
          appendJosephineMessage({
            type:  'trail-card',
            trail,
            chips: ['Tell me more', 'Show me something else', 'Too long', 'Too hard', 'Start over'],
          });
        }, 300);
      } else {
        callRecommendAPI(planningData, nextIdx);
      }
      return;
    }

    // Fix 5: Tell me more — inline detail bubble
    if (chip === 'Tell me more') {
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
            chips: ['View full details', 'Show me something else', 'Start over'],
          });
        }, 500);
      }
      return;
    }

    if (chip === 'View full details') {
      const trail = apiResults[resultIndex % Math.max(apiResults.length, 1)];
      if (trail) viewTrail?.(trail);
      return;
    }

    // Refinement
    if (chip === 'Too long') {
      appendUserMessage(chip);
      setRefining(true);
      setTimeout(() => {
        appendJosephineMessage({ type: 'text', text: "Got it — looking for something shorter for you.", chips: null });
        callRecommendAPI(planningData, 0, { durationDown: true });
      }, 400);
      return;
    }
    if (chip === 'Too hard') {
      appendUserMessage(chip);
      setRefining(true);
      setTimeout(() => {
        appendJosephineMessage({ type: 'text', text: "No problem — I'll find something gentler.", chips: null });
        callRecommendAPI(planningData, 0, { difficultyDown: true });
      }, 400);
      return;
    }

    // Start over
    if (chip === 'Start over') {
      appendUserMessage(chip);
      setPlanningStep(0);
      setPlanningData({});
      setResultIndex(0);
      setApiResults([]);
      setSelectedMoods([]);
      setRefining(false);
      setTimeout(() => {
        appendJosephineMessage({
          type:  'text',
          text:  "Of course! What kind of adventure are you after today?",
          chips: ['Plan my day', 'Surprise me', 'Show me the map'],
        });
      }, 400);
      return;
    }

    if (chip === 'Try again') {
      appendUserMessage(chip);
      callRecommendAPI(planningData, resultIndex);
      return;
    }

    // Multi-select mood (step 3)
    if (planningStep === 3) {
      if (chip === 'Done ✓') {
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
      if (planningStep === LAST_STEP && chip === 'Skip') {
        appendUserMessage('Skip');
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
  const sendMessage = (text) => {
    if (!text.trim()) return;

    // Step 6 (location)
    if (planningStep === LAST_STEP) {
      appendUserMessage(text.trim());
      setInput('');
      advancePlanningStep({ startArea: text.trim() });
      return;
    }

    const userMsg = { id: Date.now() + Math.random(), from: 'user', type: 'text', text: text.trim(), chips: null };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      setTyping(false);
      const lower = text.toLowerCase();
      let reply;
      if (lower.includes('map') || lower.includes('show')) {
        reply = { type: 'text', text: "I'll pull up the map for you!", chips: ['Open map'] };
      } else if (lower.includes('plan') || lower.includes('hike') || lower.includes('trail')) {
        reply = { type: 'text', text: "Let's find your perfect trail!", chips: ['Plan my day', 'Surprise me'] };
      } else {
        reply = {
          type: 'text',
          text: "That's a great question! Want me to help you find the perfect trail for today?",
          chips: ['Plan my day', 'Surprise me', 'Show me the map'],
        };
      }
      appendJosephineMessage(reply);
    }, 1200);
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  const statusText =
    planningStep >= 1 && planningStep <= LAST_STEP ? 'Planning your day…' :
    planningStep === LAST_STEP + 1 ? 'Finding your trail…' :
    refining ? 'Refining your pick…' :
    'Online · Alpine guide';

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
                      Josephine's Pick
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
                      View full details →
                    </button>
                  </div>
                </div>
              )}

              {/* Chips */}
              {msg.chips?.length > 0 && (
                <div className="jc-chips">
                  {msg.chips.map(chip => {
                    const isMoodChip = planningStep === 3 && chip !== 'Done ✓';
                    const isSelected = isMoodChip && selectedMoods.includes(chip);
                    return (
                      <button
                        key={chip}
                        className={`jc-chip${isSelected ? ' selected' : ''}${chip === 'Done ✓' && selectedMoods.length > 0 ? ' jc-chip--done' : ''}`}
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
            placeholder={planningStep === LAST_STEP ? 'Type a location…' : 'Ask Josephine anything…'}
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
