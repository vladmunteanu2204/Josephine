import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './JosephineWidget.css';

function JosephineWidget({ setCurrentView, isOpen: externalOpen, onClose: externalClose }) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const [hasPortrait, setHasPortrait] = useState(true);

  // Support both self-managed (floating trigger) and externally controlled (BottomNav)
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const close = () => {
    setInternalOpen(false);
    if (externalClose) externalClose();
  };

  // Time-aware greeting
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return { emoji: '☀️', text: 'Good morning!' };
    if (h >= 12 && h < 17) return { emoji: '⛰️', text: 'Good afternoon!' };
    if (h >= 17 && h < 21) return { emoji: '🌄', text: 'Good evening!' };
    return { emoji: '🌙', text: 'Still planning?' };
  };

  const greeting = getGreeting();

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleSurprise = () => {
    close();
    setCurrentView('recommendations');
  };

  const handleOwn = () => {
    close();
    setCurrentView('planner');
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="jph-widget__backdrop" onClick={close} aria-hidden="true" />
      )}

      {/* Panel */}
      {isOpen && (
        <div className="jph-widget__panel" role="dialog" aria-label="Josephine companion">

          {/* Character portrait */}
          <div className="jph-widget__portrait-wrap">
            {hasPortrait ? (
              <img
                src="/josephine-pose-neutral.png"
                alt="Josephine"
                className="jph-widget__portrait-img"
                onError={() => setHasPortrait(false)}
                draggable="false"
              />
            ) : (
              <div className="jph-widget__portrait-fallback">
                <img src="/josephine-mark.svg" alt="Josephine" className="jph-widget__mark-fallback" />
              </div>
            )}
          </div>

          {/* Name + waveform badge */}
          <div className="jph-widget__name-row">
            <span className="jph-widget__name">Josephine</span>
            <span className="jph-widget__wave" aria-hidden="true">
              {[3,5,8,5,9,6,4,7,5,3].map((h, i) => (
                <span key={i} className="jph-widget__bar" style={{ height: `${h * 1.8}px`, animationDelay: `${i * 0.08}s` }} />
              ))}
            </span>
          </div>

          {/* Message bubble */}
          <div className="jph-widget__bubble">
            <p className="jph-widget__msg-line">
              <strong>{greeting.text} {greeting.emoji}</strong>
            </p>
            <p className="jph-widget__msg-line">
              The weather looks perfect for a mountain day. Want me to suggest something special?
            </p>
          </div>

          {/* Response buttons */}
          <div className="jph-widget__responses">
            <button className="jph-widget__btn jph-widget__btn--primary" onClick={handleSurprise}>
              Yes, surprise me
            </button>
            <button className="jph-widget__btn jph-widget__btn--ghost" onClick={handleOwn}>
              I have something in mind
            </button>
          </div>

          {/* Close */}
          <button className="jph-widget__close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
      )}

      {/* Trigger button */}
      <button
        className={`jph-widget__trigger ${isOpen ? 'jph-widget__trigger--open' : ''}`}
        onClick={() => setInternalOpen(o => !o)}
        aria-label="Talk to Josephine"
        aria-expanded={isOpen}
      >
        <img src="/josephine-mark.svg" alt="" className="jph-widget__trigger-mark" />
        {!isOpen && <span className="jph-widget__pulse" aria-hidden="true" />}
      </button>
    </>
  );
}

export default JosephineWidget;
