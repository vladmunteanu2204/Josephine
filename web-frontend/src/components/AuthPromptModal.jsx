import React from 'react';
import { X } from 'lucide-react';
import { Modal } from './ui';
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
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledby="apm-title">
      <div className="apm-card">
        <button className="apm-close" onClick={onClose} aria-label="Close">
          <X size={20} strokeWidth={2} />
        </button>

        <div className="apm-mark-wrap">
          <img src="/logo.webp" alt="" className="apm-mark" />
        </div>

        <h2 className="apm-title" id="apm-title">Members only</h2>
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
    </Modal>
  );
}
