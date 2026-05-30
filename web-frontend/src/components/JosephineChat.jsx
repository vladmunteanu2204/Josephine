import React, { useState, useRef, useEffect } from 'react';
import './JosephineChat.css';

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
    text: "The weather is perfect today for a panoramic hike. Visibility is exceptional — you'll see all the way to the Marmolada glacier. Want me to suggest something special?",
    chips: ['Yes, surprise me', 'Show me on the map', 'Tell me more'],
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

function JosephineChat({ onBack, setCurrentView }) {
  const [messages, setMessages]   = useState(INITIAL_MESSAGES);
  const [input, setInput]         = useState('');
  const [typing, setTyping]       = useState(false);
  const bottomRef                 = useRef(null);
  const inputRef                  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = (text) => {
    if (!text.trim()) return;
    const userMsg = { id: Date.now(), from: 'user', type: 'text', text: text.trim(), chips: null };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // Simulate Josephine replying
    setTimeout(() => {
      setTyping(false);
      let reply;
      const lower = text.toLowerCase();
      if (lower.includes('map') || lower.includes('show')) {
        reply = {
          id: Date.now() + 1,
          from: 'josephine',
          type: 'text',
          text: "I'll pull up the map for you right away! You can see the full trail network from there.",
          chips: ['Open map', 'Back to chat'],
        };
      } else if (lower.includes('surprise') || lower.includes('yes') || lower.includes('plan')) {
        reply = {
          id: Date.now() + 1,
          from: 'josephine',
          type: 'text',
          text: "Wonderful! Let me build your perfect day — I'm thinking the Tre Cime loop for that 360° view. Should I adjust for difficulty or time?",
          chips: ['That sounds perfect', 'Make it easier', 'Show alternatives'],
        };
      } else {
        reply = {
          id: Date.now() + 1,
          from: 'josephine',
          type: 'text',
          text: "Great question! Let me look that up for you. In the meantime, is there anything specific about the trail conditions I can help with?",
          chips: ['Trail conditions', 'Best time to go', 'What to bring'],
        };
      }
      setMessages(prev => [...prev, reply]);
    }, 1200);
  };

  const handleChip = (chip) => {
    if (chip === 'Open map' || chip === 'Show me on the map') {
      setCurrentView?.('catalog');
      return;
    }
    if (chip === 'Yes, surprise me' || chip === 'That sounds perfect') {
      setCurrentView?.('recommendations');
      return;
    }
    sendMessage(chip);
  };

  return (
    <div className="jc-page">

      {/* ── Header ── */}
      <div className="jc-header">
        <button className="jc-back-btn" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="jc-header__identity">
          <div className="jc-header__avatar">
            <img
              src="/josephine-mark.svg"
              alt=""
              className="jc-header__mark"
              onError={e => e.currentTarget.style.opacity = '0'}
            />
          </div>
          <div>
            <p className="jc-header__name">Josephine</p>
            <p className="jc-header__status">
              <span className="jc-header__online-dot" />
              Online · Alpine guide
            </p>
          </div>
        </div>

        <button className="jc-menu-btn" aria-label="More options">
          <span /><span /><span />
        </button>
      </div>

      {/* ── Portrait area ── */}
      <div className="jc-portrait">
        <img
          src="/josephine-pose-neutral.png"
          alt="Josephine"
          className="jc-portrait__img"
          onError={e => e.currentTarget.style.display = 'none'}
        />
        <div className="jc-portrait__gradient" />
      </div>

      {/* ── Messages ── */}
      <div className="jc-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`jc-msg jc-msg--${msg.from}`}>

            {msg.from === 'josephine' && (
              <div className="jc-msg__avatar">
                <img src="/josephine-mark.svg" alt="" onError={e => e.currentTarget.style.opacity='0'} />
              </div>
            )}

            <div className="jc-msg__content">
              {msg.type === 'text' && msg.text && (
                <div className="jc-bubble">
                  <p className="jc-bubble__text">{msg.text}</p>
                </div>
              )}

              {msg.type === 'voice' && (
                <div className="jc-voice">
                  <span className="jc-voice__dot" />
                  <div className="jc-voice__bars">
                    {(msg.bars || []).map((h, i) => (
                      <span
                        key={i}
                        className="jc-voice__bar"
                        style={{ height: `${h * 2.2}px`, animationDelay: `${i * 0.08}s` }}
                      />
                    ))}
                  </div>
                  <span className="jc-voice__time">{msg.duration}</span>
                </div>
              )}

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

        {typing && (
          <div className="jc-msg jc-msg--josephine">
            <div className="jc-msg__avatar">
              <img src="/josephine-mark.svg" alt="" onError={e => e.currentTarget.style.opacity='0'} />
            </div>
            <div className="jc-bubble jc-bubble--typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="jc-input-bar">
        <div className="jc-input-wrap">
          <input
            ref={inputRef}
            className="jc-input"
            placeholder="Ask Josephine anything…"
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
