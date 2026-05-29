import React, { useState, useEffect } from 'react';
import './JosephineWidget.css';

function JosephineWidget({ setCurrentView }) {
  const [isOpen, setIsOpen] = useState(false);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return { text: 'Good morning!' };
    if (h >= 12 && h < 17) return { text: 'Good afternoon!' };
    if (h >= 17 && h < 21) return { text: 'Good evening!' };
    return { text: 'Still planning?' };
  };

  const greeting = getGreeting();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (view) => {
    setIsOpen(false);
    setCurrentView(view);
  };

  return (
    <>
      {isOpen && (
        <div className="jph-widget__backdrop" onClick={() => setIsOpen(false)} aria-hidden="true" />
      )}

      {isOpen && (
        <div className="jph-widget__panel" role="dialog" aria-label="Josephine companion">
          <div className="jph-widget__portrait-wrap">
            <div className="jph-widget__portrait-fallback">
              <img src="/josephine-mark.svg" alt="Josephine" className="jph-widget__mark-fallback" />
            </div>
          </div>

          <div className="jph-widget__name-row">
            <span className="jph-widget__name">Josephine</span>
            <span className="jph-widget__wave" aria-hidden="true">
              {[3,5,8,5,9,6,4,7,5,3].map((h, i) => (
                <span key={i} className="jph-widget__bar" style={{ height: `${h * 1.8}px`, animationDelay: `${i * 0.08}s` }} />
              ))}
            </span>
          </div>

          <div className="jph-widget__bubble">
            <p className="jph-widget__msg-line">
              <strong>{greeting.text}</strong>
            </p>
            <p className="jph-widget__msg-line">
              The mountains are waiting. Want me to find the perfect trail for you?
            </p>
          </div>

          <div className="jph-widget__responses">
            <button className="jph-widget__btn jph-widget__btn--primary" onClick={() => go('recommendations')}>
              Yes, surprise me
            </button>
            <button className="jph-widget__btn jph-widget__btn--ghost" onClick={() => go('planner')}>
              I have something in mind
            </button>
          </div>

          <button className="jph-widget__close" onClick={() => setIsOpen(false)} aria-label="Close">✕</button>
        </div>
      )}

      <button
        className={`jph-widget__trigger ${isOpen ? 'jph-widget__trigger--open' : ''}`}
        onClick={() => setIsOpen(o => !o)}
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
