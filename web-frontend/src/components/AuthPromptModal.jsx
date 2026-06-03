import React from 'react';
import './AuthPromptModal.css';

/**
 * AuthPromptModal — shown when a guest tries to use a members-only feature.
 *
 * Props:
 *   isOpen     {bool}   — controls visibility
 *   onClose    {fn}     — called when user dismisses
 *   onLogin    {fn}     — called when user clicks "Sign in"
 *   message    {string} — optional custom message line
 */
export default function AuthPromptModal({ isOpen, onClose, onLogin, message }) {
  if (!isOpen) return null;

  return (
    <div className="apm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="apm-card" onClick={e => e.stopPropagation()}>
        <button className="apm-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="apm-mark-wrap">
          <img src="/logo.webp" alt="" className="apm-mark" />
        </div>

        <h2 className="apm-title">Members only</h2>
        <p className="apm-msg">
          {message || 'Sign in to unlock this feature and save your favourite trails.'}
        </p>

        <button className="apm-signin-btn" onClick={() => { onClose(); onLogin(); }}>
          Sign in / Create account
        </button>

        <button className="apm-skip" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
