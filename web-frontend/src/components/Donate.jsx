import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './Donate.css';

const API_URL = '/api';

/* "Buy me a coffee" style donation page — powered by Lemon Squeezy.
   Anyone can donate (no login required). The amount is computed server-side
   as coffees × unit price; we just collect the count + an optional note and
   then hand off to Lemon Squeezy's hosted checkout. */
function Donate({ onBack }) {
  const { t } = useTranslation();

  const [config, setConfig]   = useState(null);   // { enabled, coffee_price, currency, presets, max_coffees }
  const [loading, setLoading] = useState(true);
  const [coffees, setCoffees] = useState(3);
  const [name, setName]       = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    let alive = true;
    axios.get(`${API_URL}/donate/config`)
      .then(r => { if (alive) { setConfig(r.data); if (r.data?.presets?.length) setCoffees(r.data.presets[Math.floor(r.data.presets.length / 2)] || 1); } })
      .catch(() => { if (alive) setConfig({ enabled: false }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const currency   = config?.currency || 'EUR';
  const unitCents  = config?.coffee_price || 300;
  const maxCoffees = config?.max_coffees || 50;
  const presets    = config?.presets || [1, 3, 5];

  const fmt = (cents) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
    } catch {
      return `${((cents || 0) / 100).toFixed(2)} ${currency}`;
    }
  };

  const clamp = (n) => Math.max(1, Math.min(maxCoffees, n || 1));
  const totalCents = coffees * unitCents;

  const handleDonate = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/donate/checkout`, {
        coffees,
        name: name.trim() || undefined,
        message: message.trim() || undefined,
      });
      const url = res.data?.checkout_url;
      if (url) {
        window.location.href = url;   // hand off to Lemon Squeezy hosted checkout
      } else {
        setError(t('donate.error', 'Something went wrong starting checkout. Please try again.'));
        setSubmitting(false);
      }
    } catch (err) {
      const msg = err?.response?.data?.message;
      setError(msg || t('donate.error', 'Something went wrong starting checkout. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="donate-page">
      <div className="donate-card">
        {onBack && (
          <button className="donate-back" onClick={onBack} aria-label={t('donate.back', 'Back')}>
            ← {t('donate.back', 'Back')}
          </button>
        )}

        <div className="donate-mark" aria-hidden="true">☕</div>
        <h1 className="donate-title">{t('donate.title', 'Buy Josephine a coffee')}</h1>
        <p className="donate-sub">
          {t('donate.subtitle', 'Josephine is a small, independent labour of love. A coffee or two helps keep the trails mapped, the rifugios up to date, and the lights on. Thank you for your support.')}
        </p>

        {loading ? (
          <div className="donate-state">{t('common.loading', 'Loading…')}</div>
        ) : !config?.enabled ? (
          <div className="donate-state donate-state--soon">
            <p>{t('donate.comingSoon', 'Donations are coming soon — thank you for wanting to support the cause! Please check back shortly.')}</p>
          </div>
        ) : (
          <>
            {/* Coffee quantity */}
            <div className="donate-coffees">
              <button
                className="donate-step"
                onClick={() => setCoffees(c => clamp(c - 1))}
                disabled={coffees <= 1}
                aria-label={t('donate.fewer', 'Fewer coffees')}
              >−</button>

              <div className="donate-coffees__display">
                <span className="donate-coffees__icons" aria-hidden="true">
                  {'☕'.repeat(Math.min(coffees, 5))}
                </span>
                <span className="donate-coffees__count">
                  {coffees} {coffees === 1 ? t('donate.coffee', 'coffee') : t('donate.coffees', 'coffees')}
                </span>
              </div>

              <button
                className="donate-step"
                onClick={() => setCoffees(c => clamp(c + 1))}
                disabled={coffees >= maxCoffees}
                aria-label={t('donate.more', 'More coffees')}
              >+</button>
            </div>

            {/* Quick presets */}
            <div className="donate-presets">
              {presets.map(p => (
                <button
                  key={p}
                  className={`donate-preset ${coffees === p ? 'active' : ''}`}
                  onClick={() => setCoffees(clamp(p))}
                >
                  ×{p}
                </button>
              ))}
            </div>

            {/* Optional name + message */}
            <input
              className="donate-input"
              type="text"
              value={name}
              maxLength={100}
              onChange={e => setName(e.target.value)}
              placeholder={t('donate.namePlaceholder', 'Your name (optional)')}
            />
            <textarea
              className="donate-input donate-textarea"
              value={message}
              maxLength={500}
              rows={3}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('donate.messagePlaceholder', 'Leave a message (optional)')}
            />

            {error && <p className="donate-error">{error}</p>}

            <button
              className="donate-submit"
              onClick={handleDonate}
              disabled={submitting}
            >
              {submitting
                ? t('donate.redirecting', 'Taking you to checkout…')
                : `${t('donate.support', 'Support')} · ${fmt(totalCents)}`}
            </button>

            <p className="donate-secure">
              🔒 {t('donate.secure', 'Secure checkout via Lemon Squeezy. We never see your card details.')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default Donate;
