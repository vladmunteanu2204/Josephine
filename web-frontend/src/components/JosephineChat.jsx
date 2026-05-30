import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './JosephineChat.css';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&auto=format&fit=crop&q=70';

/* ── Planning step config ─────────────────────────────────────────────── */
const PLANNING_STEPS = {
  1: {
    text: "How much time do you have today?",
    chips: ["< 2h", "Half a day", "Full day"],
    dataKey: 'duration_hours',
    chipMap: { "< 2h": 1.5, "Half a day": 3, "Full day": 8 },
  },
  2: {
    text: "How are you feeling today?",
    chips: ["Take it easy", "Good energy", "Push hard"],
    dataKey: 'difficulty',
    chipMap: { "Take it easy": 'easy', "Good energy": 'medium', "Push hard": 'hard' },
  },
  3: {
    text: "What's calling you? (or skip)",
    chips: ["Alpine lakes", "Panoramic views", "Forests", "Something cultural", "Loop trail", "Skip"],
    dataKey: 'interests',
    chipMap: {
      "Alpine lakes": 'alpine lakes',
      "Panoramic views": 'panoramic views',
      "Forests": 'forests',
      "Something cultural": 'cultural routes',
      "Loop trail": 'loop',
    },
  },
  4: {
    text: "Are you hiking with your dog?",
    chips: ["Yes, bringing her!", "No dog today"],
    dataKey: 'withDog',
    chipMap: { "Yes, bringing her!": true, "No dog today": false },
  },
  5: {
    text: "Where are you starting from? (or tap skip)",
    chips: ["Skip"],
    dataKey: 'startArea',
  },
};

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
    text: "The weather is perfect today for a panoramic hike. Visibility is exceptional — you'll see all the way to the Marmolada glacier. What kind of adventure are you after?",
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

/* ── Component ────────────────────────────────────────────────────────── */
function JosephineChat({ onBack, setCurrentView, viewTrail }) {
  const [messages, setMessages]         = useState(INITIAL_MESSAGES);
  const [input, setInput]               = useState('');
  const [typing, setTyping]             = useState(false);

  // Planning state machine
  const [planningStep, setPlanningStep] = useState(0);
  const [planningData, setPlanningData] = useState({});
  const [resultIndex,  setResultIndex]  = useState(0);
  const [apiResults,   setApiResults]   = useState([]);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  /* ── Helpers ── */
  const appendJosephineMessage = (partial) => {
    setMessages(prev => [...prev, { id: Date.now(), from: 'josephine', ...partial }]);
  };

  const appendUserMessage = (text) => {
    setMessages(prev => [...prev, { id: Date.now(), from: 'user', type: 'text', text, chips: null }]);
  };

  /* ── Planning flow ── */
  const startPlanningFlow = () => {
    setPlanningStep(1);
    setPlanningData({});
    setResultIndex(0);
    setApiResults([]);
    // Small delay so it feels like she's thinking
    setTimeout(() => {
      const step = PLANNING_STEPS[1];
      appendJosephineMessage({ type: 'text', text: step.text, chips: step.chips });
    }, 600);
  };

  const advancePlanningStep = (dataUpdate) => {
    const newData = { ...planningData, ...dataUpdate };
    setPlanningData(newData);
    const next = planningStep + 1;
    setPlanningStep(next);

    if (next <= 5) {
      const step = PLANNING_STEPS[next];
      setTimeout(() => {
        appendJosephineMessage({ type: 'text', text: step.text, chips: step.chips });
      }, 600);
    } else {
      // next === 6 → call API
      callRecommendAPI(newData);
    }
  };

  const callRecommendAPI = async (data, startIdx = 0) => {
    setPlanningStep(6);
    setTyping(true);

    const interests = [
      ...(data.interests || []),
      ...(data.withDog ? ['dog-friendly'] : []),
    ];

    try {
      const response = await axios.post('/api/ai/recommend', {
        duration_hours: data.duration_hours ?? 3,
        difficulty:     data.difficulty ?? 'medium',
        interests,
        start_area:     data.startArea ?? '',
      });
      const results = response.data.results || [];
      setApiResults(results);
      setResultIndex(startIdx);
      setTyping(false);
      setPlanningStep(7);

      const trail = results[startIdx % Math.max(results.length, 1)];
      if (trail) {
        setTimeout(() => {
          appendJosephineMessage({
            type: 'trail-card',
            trail,
            chips: ['Show me something else', 'Start over'],
          });
        }, 400);
      } else {
        setTimeout(() => {
          appendJosephineMessage({
            type: 'text',
            text: "Hmm, I couldn't find a trail matching those exactly. Want to try adjusting your preferences?",
            chips: ['Start over'],
          });
        }, 400);
      }
    } catch (e) {
      setTyping(false);
      setPlanningStep(0);
      setTimeout(() => {
        appendJosephineMessage({
          type: 'text',
          text: "I couldn't reach the mountain spirits right now. Try again?",
          chips: ['Try again', 'Start over'],
        });
      }, 400);
    }
  };

  /* ── Chip handler ── */
  const handleChip = (chip) => {
    // Navigation
    if (chip === 'Open map' || chip === 'Show me on the map' || chip === 'Show me the map') {
      appendUserMessage(chip);
      setCurrentView?.('catalog');
      return;
    }

    // Plan entry
    if (chip === 'Plan my day') {
      appendUserMessage(chip);
      startPlanningFlow();
      return;
    }

    if (chip === 'Surprise me' || chip === 'Yes, surprise me') {
      appendUserMessage(chip);
      const defaults = { duration_hours: 3, difficulty: 'medium', interests: [], withDog: false, startArea: '' };
      setPlanningData(defaults);
      callRecommendAPI(defaults, 0);
      return;
    }

    // Post-result
    if (chip === 'Show me something else') {
      appendUserMessage(chip);
      const nextIdx = resultIndex + 1;
      setResultIndex(nextIdx);
      if (apiResults.length > 0) {
        const trail = apiResults[nextIdx % apiResults.length];
        setTimeout(() => {
          appendJosephineMessage({
            type: 'trail-card',
            trail,
            chips: ['Show me something else', 'Start over'],
          });
        }, 300);
      } else {
        callRecommendAPI(planningData, nextIdx);
      }
      return;
    }

    if (chip === 'Start over') {
      appendUserMessage(chip);
      setPlanningStep(0);
      setPlanningData({});
      setResultIndex(0);
      setApiResults([]);
      setTimeout(() => {
        appendJosephineMessage({
          type: 'text',
          text: "Of course! What kind of adventure are you after today?",
          chips: ['Plan my day', 'Surprise me', 'Show me the map'],
        });
      }, 500);
      return;
    }

    if (chip === 'Try again') {
      appendUserMessage(chip);
      callRecommendAPI(planningData, resultIndex);
      return;
    }

    // Mid-flow planning chips (steps 1–5)
    if (planningStep >= 1 && planningStep <= 5) {
      appendUserMessage(chip);
      const step = PLANNING_STEPS[planningStep];

      if (planningStep === 3) {
        if (chip === 'Skip') {
          advancePlanningStep({ interests: [] });
        } else {
          const mapped = step.chipMap?.[chip] ?? chip;
          advancePlanningStep({ interests: [mapped] });
        }
        return;
      }

      if (planningStep === 5 && chip === 'Skip') {
        advancePlanningStep({ startArea: '' });
        return;
      }

      const mapped = step.chipMap?.[chip] ?? chip;
      advancePlanningStep({ [step.dataKey]: mapped });
      return;
    }

    // Fallback: treat chip as freeform input
    sendMessage(chip);
  };

  /* ── Send message (freeform) ── */
  const sendMessage = (text) => {
    if (!text.trim()) return;

    // Step 5: capture location input
    if (planningStep === 5) {
      appendUserMessage(text.trim());
      setInput('');
      advancePlanningStep({ startArea: text.trim() });
      return;
    }

    const userMsg = { id: Date.now(), from: 'user', type: 'text', text: text.trim(), chips: null };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      setTyping(false);
      let reply;
      const lower = text.toLowerCase();
      if (lower.includes('map') || lower.includes('show')) {
        reply = {
          type: 'text',
          text: "I'll pull up the map for you right away!",
          chips: ['Open map', 'Back to chat'],
        };
      } else if (lower.includes('surprise') || lower.includes('yes') || lower.includes('plan')) {
        reply = {
          type: 'text',
          text: "Great! Let me plan the perfect day for you.",
          chips: ['Plan my day', 'Surprise me'],
        };
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

  /* ── Render ── */
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
            <img src="/josephine-mark.svg" alt="" className="jc-header__mark" onError={e => e.currentTarget.style.opacity = '0'} />
          </div>
          <div>
            <p className="jc-header__name">Josephine</p>
            <p className="jc-header__status">
              <span className="jc-header__online-dot" />
              {planningStep >= 1 && planningStep <= 5 ? 'Planning your day…' :
               planningStep === 6 ? 'Finding your trail…' :
               'Online · Alpine guide'}
            </p>
          </div>
        </div>

        <button className="jc-menu-btn" aria-label="More options">
          <span /><span /><span />
        </button>
      </div>

      {/* Portrait */}
      <div className="jc-portrait">
        <img
          src="/josephine-pose-neutral.png"
          alt="Josephine"
          className="jc-portrait__img"
          onError={e => e.currentTarget.style.display = 'none'}
        />
        <div className="jc-portrait__gradient" />
      </div>

      {/* Messages */}
      <div className="jc-messages">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`jc-msg jc-msg--${msg.from}${msg.type === 'trail-card' ? ' jc-msg--card' : ''}`}
          >
            {msg.from === 'josephine' && (
              <div className="jc-msg__avatar">
                <img src="/josephine-mark.svg" alt="" onError={e => e.currentTarget.style.opacity = '0'} />
              </div>
            )}

            <div className="jc-msg__content">
              {/* Text bubble */}
              {msg.type === 'text' && msg.text && (
                <div className="jc-bubble">
                  <p className="jc-bubble__text">{msg.text}</p>
                </div>
              )}

              {/* Voice bubble */}
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
                    <span className="jc-trail-card__pick-badge">
                      <img
                        src="/josephine-mark.svg"
                        alt=""
                        className="jc-trail-card__mark"
                        onError={e => e.currentTarget.style.display = 'none'}
                      />
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
                    {msg.trail.josephine_note && (
                      <p className="jc-trail-card__note">{msg.trail.josephine_note}</p>
                    )}
                    <button
                      className="jc-trail-card__cta"
                      onClick={() => viewTrail?.(msg.trail)}
                    >
                      View full details →
                    </button>
                  </div>
                </div>
              )}

              {/* Chips */}
              {msg.chips?.length > 0 && (
                <div className="jc-chips">
                  {msg.chips.map(chip => (
                    <button key={chip} className="jc-chip" onClick={() => handleChip(chip)}>
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="jc-msg jc-msg--josephine">
            <div className="jc-msg__avatar">
              <img src="/josephine-mark.svg" alt="" onError={e => e.currentTarget.style.opacity = '0'} />
            </div>
            <div className="jc-bubble jc-bubble--typing">
              <span /><span /><span />
            </div>
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
            placeholder={planningStep === 5 ? 'Type a location…' : 'Ask Josephine anything…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
          />
          <button className="jc-mic-btn" aria-label="Voice input">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="13" rx="3" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M5 10a7 7 0 0014 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <button
          className="jc-send-btn"
          onClick={() => sendMessage(input)}
          disabled={!input.trim()}
          aria-label="Send"
        >
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
