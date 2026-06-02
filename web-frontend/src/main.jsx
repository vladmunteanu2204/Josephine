import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import './index.css';
import i18n from './i18n';   // default export — pass concrete instance to provider
import { reportWebVitals } from './vitals';

// Initialise Sentry before rendering — only when DSN is configured
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
  });
}

function ErrorScreen({ error }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh',
      background: '#080e08', color: '#f0ece6', fontFamily: 'Inter, sans-serif',
      gap: 16, padding: 32, textAlign: 'center',
    }}>
      <img src="/logo.webp" alt="" style={{ width: 56, opacity: 0.6 }} />
      <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
                   fontSize: 28, margin: 0, color: '#c9a84c' }}>
        Something went wrong
      </h2>
      {error && (
        <p style={{ opacity: 0.5, maxWidth: 400, margin: 0, fontSize: 11,
                    fontFamily: 'monospace', wordBreak: 'break-all',
                    background: 'rgba(255,255,255,0.05)', padding: '8px 12px',
                    borderRadius: 8, textAlign: 'left' }}>
          {error.message}
        </p>
      )}
      <p style={{ opacity: 0.6, maxWidth: 360, margin: 0 }}>
        The mountain winds interfered. Tap below to return home.
      </p>
      {/* Plain <a> tag works in all contexts including embedded previews */}
      <a
        href="/"
        style={{ background: '#c9a84c', color: '#1a1a0e', border: 'none',
                 borderRadius: 100, padding: '12px 28px', fontWeight: 700,
                 cursor: 'pointer', fontSize: 14, textDecoration: 'none',
                 display: 'inline-block' }}
      >
        Go to Home
      </a>
    </div>
  );
}

reportWebVitals();

// Service Worker: register in production only.
// In dev mode actively unregister any lingering SW — it caches index.html and
// breaks Vite HMR, causing the page to reload in a loop.
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then(regs =>
      regs.forEach(r => r.unregister())
    );
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          reg.addEventListener('updatefound', () => {
            const w = reg.installing;
            w.addEventListener('statechange', () => {
              if (w.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version available — reload to update.');
              }
            });
          });
        })
        .catch(err => console.warn('[PWA] SW registration failed:', err));
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={(props) => <ErrorScreen error={props.error} />}>
      {/*
        I18nextProvider injects the i18n instance via React context.
        This is a safety net: even if Vite's dep optimiser somehow loads two
        copies of react-i18next (different ?v= hashes), both copies share the
        same React instance (guaranteed by resolve.dedupe), so this context
        value propagates correctly and useTranslation() never sees a null i18n.
      */}
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
