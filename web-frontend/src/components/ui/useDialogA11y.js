import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * useDialogA11y — adds dialog accessibility to a hand-rolled overlay WITHOUT
 * forcing it onto the centered-card <Modal> primitive. Use this where the
 * overlay has bespoke layout/stacking the primitive can't host (the fullscreen
 * celebration, the full-bleed photo lightbox). Attach the returned ref to the
 * dialog element and set role="dialog" aria-modal="true" + a label on it
 * yourself.
 *
 * Handles: save focus → move focus inside on open → restore on close; a Tab
 * focus trap; and (optionally) Escape-to-close. Body scroll lock is left to the
 * caller, since these components already manage / animate it.
 *
 * @param {boolean}  isOpen
 * @param {function} onClose
 * @param {{escClose?: boolean}} [opts]  escClose default true
 * @returns {React.RefObject} ref for the dialog container
 */
export default function useDialogA11y(isOpen, onClose, { escClose = true } = {}) {
  const ref = useRef(null);
  const prevFocused = useRef(null);

  // Save the trigger, move focus inside on open, restore it on close.
  useEffect(() => {
    if (!isOpen) return;
    prevFocused.current = document.activeElement;
    const node = ref.current;
    if (node) {
      const first = node.querySelector(FOCUSABLE);
      (first || node).focus?.();
    }
    return () => {
      const el = prevFocused.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, [isOpen]);

  // Escape-to-close + Tab focus trap (capture phase so it wins over the page).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (escClose && e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const node = ref.current;
      if (!node) return;
      const items = Array.from(node.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) { e.preventDefault(); node.focus?.(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose, escClose]);

  return ref;
}
