import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './Sheet.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Sheet — accessible slide-in panel (bottom sheet / side drawer). Unlike Modal
 * it does NOT centre its content: the single child element is the panel and
 * keeps its own anchored positioning (e.g. `.language-sheet`, `.hamburger-menu`).
 * The primitive adds the behaviour those panels were missing: a focus trap,
 * focus restore to the trigger, body scroll-lock, Escape, a dismiss backdrop,
 * and a portal so it escapes parent stacking contexts. It injects
 * role="dialog"/aria-modal/ref/onKeyDown onto the child via cloneElement, so the
 * child must be a single DOM element.
 *
 * Props:
 *   isOpen, onClose
 *   ariaLabel | ariaLabelledby — accessible name for the dialog
 *   closeOnBackdrop {bool} — default true
 */
export default function Sheet({
  isOpen,
  onClose,
  children,
  ariaLabel,
  ariaLabelledby,
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement;
    const node = panelRef.current;
    if (node) {
      const first = node.querySelector(FOCUSABLE);
      (first || node).focus();
    }
    return () => {
      const toRestore = previouslyFocused.current;
      if (toRestore && typeof toRestore.focus === 'function') toRestore.focus();
    };
  }, [isOpen]);

  const onKeyDown = useCallback((e) => {
    if (e.key !== 'Tab') return;
    const node = panelRef.current;
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

  const panel = React.cloneElement(children, {
    ref: panelRef,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    tabIndex: -1,
    onKeyDown,
  });

  return createPortal(
    <>
      <div
        className="ui-sheet-backdrop"
        aria-hidden="true"
        onClick={() => { if (closeOnBackdrop) onClose?.(); }}
      />
      {panel}
    </>,
    document.body,
  );
}
