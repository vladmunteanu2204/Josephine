import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal — accessible dialog primitive. Handles the structural + a11y concerns
 * that the app's hand-rolled overlays were missing: a focus trap, Escape to
 * close, focus restore to the trigger, body scroll lock, and a portal so it
 * escapes parent stacking contexts. Children supply their own card markup, so
 * existing modal styling is preserved.
 *
 * Props:
 *   isOpen           {bool}
 *   onClose          {fn}
 *   ariaLabel        {string}  — accessible name (use this OR ariaLabelledby)
 *   ariaLabelledby   {string}  — id of an element labelling the dialog
 *   closeOnBackdrop  {bool}    — click the dim area to dismiss (default true)
 *   className        {string}  — extra class on the content wrapper
 */
export default function Modal({
  isOpen,
  onClose,
  children,
  ariaLabel,
  ariaLabelledby,
  closeOnBackdrop = true,
  className = '',
}) {
  const contentRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Escape closes (stopPropagation so it doesn't bubble to other handlers).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Lock background scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Save the trigger, move focus inside, and restore focus on close.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement;
    const node = contentRef.current;
    if (node) {
      const first = node.querySelector(FOCUSABLE);
      (first || node).focus();
    }
    return () => {
      const toRestore = previouslyFocused.current;
      if (toRestore && typeof toRestore.focus === 'function') toRestore.focus();
    };
  }, [isOpen]);

  // Trap Tab within the dialog.
  const onKeyDown = useCallback((e) => {
    if (e.key !== 'Tab') return;
    const node = contentRef.current;
    if (!node) return;
    const items = Array.from(node.querySelectorAll(FOCUSABLE))
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (items.length === 0) { e.preventDefault(); node.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }, []);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="ui-modal-overlay"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`ui-modal-content ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        tabIndex={-1}
        ref={contentRef}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
