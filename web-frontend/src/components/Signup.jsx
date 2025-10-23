import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

function Signup({ onClose, switchToLogin }) {
  const { t } = useTranslation();
  const { signup, loginWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      setError(t('auth.allFieldsRequired'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    try {
      setError('');
      setLoading(true);
      await signup(email, password, name);
      onClose();
    } catch (error) {
      console.error('Signup error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError(t('auth.emailInUse'));
      } else if (error.code === 'auth/invalid-email') {
        setError(t('auth.invalidEmail'));
      } else if (error.code === 'auth/weak-password') {
        setError(t('auth.weakPassword'));
      } else {
        setError(t('auth.signupFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      onClose();
    } catch (error) {
      console.error('Google signup error:', error);
      setError(t('auth.googleLoginFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>✕</button>
        
        <div className="auth-header">
          <h2 className="auth-title">{t('auth.signup')}</h2>
          <p className="auth-subtitle">{t('auth.signupSubtitle')}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">{t('auth.name')}</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.namePlaceholder')}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">{t('auth.email')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('auth.password')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              disabled={loading}
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? t('auth.creatingAccount') : t('auth.signupButton')}
          </button>
        </form>

        <div className="auth-divider">
          <span>{t('auth.or')}</span>
        </div>

        <button 
          type="button" 
          className="google-btn" 
          onClick={handleGoogleSignup}
          disabled={loading}
        >
          <span className="google-icon">G</span>
          {t('auth.continueWithGoogle')}
        </button>

        <p className="auth-switch">
          {t('auth.hasAccount')}{' '}
          <button type="button" onClick={switchToLogin} className="auth-link">
            {t('auth.loginLink')}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Signup;
