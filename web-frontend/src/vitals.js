/**
 * vitals.js — report Core Web Vitals to the console (and optionally Sentry).
 * Imported once from main.jsx; tree-shaken in unsupported browsers.
 */
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

function sendToAnalytics({ name, value, rating }) {
  // Log to console in dev; send to Sentry perf in prod
  if (import.meta.env.DEV) {
    console.debug(`[vitals] ${name}: ${Math.round(value)}ms — ${rating}`);
    return;
  }
  // Optionally push to Sentry as measurement
  try {
    const Sentry = window.__SENTRY__;
    if (Sentry && Sentry.metrics) {
      Sentry.metrics.distribution(`web_vitals.${name.toLowerCase()}`, value, { unit: 'millisecond' });
    }
  } catch (_) { /* non-critical */ }
}

export function reportWebVitals() {
  onLCP(sendToAnalytics);
  onINP(sendToAnalytics);
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
