import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';
import './i18n';
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

function ErrorScreen() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh',
      background: '#080e08', color: '#f0ece6', fontFamily: 'Inter, sans-serif',
      gap: 16, padding: 32, textAlign: 'center',
    }}>
      <img src="/josephine-mark.svg" alt="" style={{ width: 56, opacity: 0.6 }} />
      <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
                   fontSize: 28, margin: 0, color: '#c9a84c' }}>
        Something went wrong
      </h2>
      <p style={{ opacity: 0.6, maxWidth: 360, margin: 0 }}>
        The mountain winds interfered. Reload the page to continue.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ background: '#c9a84c', color: '#1a1a0e', border: 'none',
                 borderRadius: 100, padding: '12px 28px', fontWeight: 700,
                 cursor: 'pointer', fontSize: 14 }}
      >
        Reload
      </button>
    </div>
  );
}

reportWebVitals();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorScreen />} showDialog>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
