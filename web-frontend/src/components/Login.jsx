import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

function Login({ onClose, switchToSignup }) {
  const { t } = useTranslation();
  const { login, loginWithGoogle, resetPassword, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Clear auth errors when component unmounts
  React.useEffect(() => {
    return () => {
      if (clearAuthError) clearAuthError();
    };
  }, [clearAuthError]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email || !password) {
      setError(t('auth.allFieldsRequired'));
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      onClose();
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/invalid-credential') {
        setError(t('auth.invalidCredentials'));
      } else if (error.code === 'auth/user-not-found') {
        setError(t('auth.userNotFound'));
      } else if (error.code === 'auth/wrong-password') {
        setError(t('auth.wrongPassword'));
      } else if (error.code === 'auth/too-many-requests') {
        setError(t('auth.tooManyRequests'));
      } else if (error.code === 'auth/user-disabled') {
        setError(t('auth.userDisabled'));
      } else if (error.code === 'auth/network-request-failed') {
        setError(t('auth.networkError'));
      } else {
        setError(t('auth.loginFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      onClose();
    } catch (error) {
      console.error('Google login error:', error);
      // Don't set local error - context already has user-friendly message
      // If context doesn't have it, fall back to generic message
      if (!authError) {
        setError(t('auth.googleLoginFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();

    if (!email) {
      setError('Te rog introdu adresa de email pentru resetarea parolei.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setLoading(true);
      await resetPassword(email);
      setSuccess('Email de resetare parolă trimis! Verifică inbox-ul și urmează instrucțiunile.');
      // Keep reset form visible with success message for 3 seconds, then return to login
      setTimeout(() => {
        setShowResetPassword(false);
        setSuccess('');
      }, 3000);
    } catch (error) {
      console.error('Password reset error:', error);
      if (error.code === 'auth/user-not-found') {
        setError('Nu există cont cu această adresă de email.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Adresa de email este invalidă.');
      } else {
        setError('Eroare la trimiterea email-ului. Încearcă din nou.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label={t('common.close')}>✕</button>
        
        <div className="auth-header">
          <h2 id="login-title" className="auth-title">{t('auth.login')}</h2>
          <p className="auth-subtitle">{t('auth.loginSubtitle')}</p>
        </div>

        {(authError || error) && <div className="auth-error">{authError || error}</div>}
        {success && <div className="auth-success">{success}</div>}

        {!showResetPassword ? (
          <form onSubmit={handleSubmit} className="auth-form">
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

            <div style={{ textAlign: 'right', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setShowResetPassword(true)}
                className="auth-link"
                style={{ fontSize: '14px', textDecoration: 'underline' }}
              >
                Ai uitat parola?
              </button>
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? t('auth.loggingIn') : t('auth.loginButton')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email pentru resetare parolă</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="adresa@email.com"
                disabled={loading}
              />
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Se trimite...' : 'Trimite email de resetare'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowResetPassword(false)}
                className="auth-link"
                style={{ fontSize: '14px' }}
              >
                Înapoi la login
              </button>
            </div>
          </form>
        )}

        <div className="auth-divider">
          <span>{t('auth.or')}</span>
        </div>

        <button 
          type="button" 
          className="google-btn" 
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <span className="google-icon">G</span>
          {t('auth.continueWithGoogle')}
        </button>

        <p className="auth-switch">
          {t('auth.noAccount')}{' '}
          <button type="button" onClick={switchToSignup} className="auth-link">
            {t('auth.signupLink')}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
