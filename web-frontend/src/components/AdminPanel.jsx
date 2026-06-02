import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { ENABLE_GAMIFICATION } from '../featureFlags';
import axios from 'axios';
import Dashboard from './admin/Dashboard';
import TrailManager from './admin/TrailManager';
import ReviewsModeration from './admin/ReviewsModeration';
import ChallengesManager from './admin/ChallengesManager';
import BookingInquiries from './admin/BookingInquiries';
import RifugiosManager from './admin/RifugiosManager';
import UserPlansManager from './UserPlansManager';
import UserManagement from './UserManagement';
import TrailAnalytics from './TrailAnalytics';
import GamificationStats from './GamificationStats';
import MultiDayTrailsManager from './admin/MultiDayTrailsManager';
import './AdminPanel.css';

const ADMIN_EMAIL = 'vladmunteanu2204@gmail.com';
const ADMIN_TOKEN_KEY = 'jph_admin_token';

const TABS = [
  { id: 'dashboard',  label: '🎯 Dashboard' },
  { id: 'trails',     label: '🗺️ Trails' },
  { id: 'multiday',   label: '🏔️ Multi-Day' },
  { id: 'rifugios',   label: '🏠 Rifugios' },
  { id: 'bookings',   label: '📋 Bookings' },
  { id: 'reviews',    label: '💬 Reviews' },
  { id: 'plans',      label: '📅 User Plans' },
  { id: 'users',      label: '👥 Users' },
  { id: 'analytics',  label: '📊 Analytics' },
  ...(ENABLE_GAMIFICATION ? [
    { id: 'challenges',  label: '🏆 Challenges' },
    { id: 'gamification',label: '🎮 Gamification' },
  ] : []),
];

function AdminPanel({ onNavigate }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  // The admin JWT obtained from /api/admin/login. Persisted in sessionStorage
  // so a reload within the session keeps you logged in. The password is NEVER
  // stored or bundled — it's typed at runtime and exchanged for this token.
  const [token, setToken] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const isAdminUser = currentUser?.email === ADMIN_EMAIL;

  // Attach the admin JWT only to admin requests (admin endpoints + the
  // ?_admin=1 draft loaders), so normal public requests stay untouched.
  useEffect(() => {
    if (!token) return;
    const id = axios.interceptors.request.use((cfg) => {
      const url = cfg.url || '';
      const p = cfg.params || {};
      // `_admin` can arrive in the query string (TrailManager) or via axios
      // `params` (RifugiosManager) — match both so draft loaders authenticate.
      const adminParam = p._admin === 1 || p._admin === '1' || p._admin === true;
      if (url.includes('/api/admin') || url.includes('_admin=1') || url.includes('_admin=true') || adminParam) {
        cfg.headers = cfg.headers || {};
        cfg.headers['Authorization'] = `Bearer ${token}`;
      }
      return cfg;
    });
    return () => axios.interceptors.request.eject(id);
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await axios.post('/api/admin/login', { password });
      const tok = res.data?.token;
      if (!tok) throw new Error('No token returned');
      try { sessionStorage.setItem(ADMIN_TOKEN_KEY, tok); } catch {}
      setToken(tok);
      setPassword('');
    } catch (err) {
      setLoginError(err?.response?.data?.error || 'Login failed. Check the password and try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    try { sessionStorage.removeItem(ADMIN_TOKEN_KEY); } catch {}
    setToken('');
  };

  const handleNavigateToTrail = () => setActiveTab('trails');

  // Not the admin account → no access at all.
  if (!isAdminUser) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-container">
          <div className="admin-login-card">
            <div className="admin-login-header">
              <h1>🚫 Access Denied</h1>
              <p>You do not have permission to access the admin panel.</p>
              <p style={{ marginTop: '20px', fontSize: '14px', opacity: 0.7 }}>
                Only the site administrator can access this area.
              </p>
            </div>
            <button className="admin-login-btn" onClick={() => onNavigate('home')} style={{ marginTop: '20px' }}>
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin account but no valid session token yet → ask for the password,
  // which is exchanged for a short-lived JWT (never stored client-side).
  if (!token) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-container">
          <div className="admin-login-card">
            <div className="admin-login-header">
              <h1>🔐 Admin Panel</h1>
              <p>Enter the admin password to continue.</p>
            </div>
            <form onSubmit={handleLogin} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                autoFocus
                style={{
                  padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.05)', color: '#f0ece6', fontSize: 15, outline: 'none',
                }}
              />
              {loginError && <p style={{ color: '#f3a3a3', fontSize: 13, margin: 0 }}>{loginError}</p>}
              <button className="admin-login-btn" type="submit" disabled={loggingIn || !password}>
                {loggingIn ? 'Signing in…' : 'Sign in'}
              </button>
              <button type="button" className="admin-login-btn" onClick={() => onNavigate('home')}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.18)' }}>
                ← Back to Home
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-header-content">
          <button className="back-button" onClick={() => onNavigate('home')}>
            ← Back to Site
          </button>
          <div className="admin-title-section">
            <h1>⚙️ Josephine Admin</h1>
            <button className="logout-btn" onClick={handleLogout}>
              🔒 Logout
            </button>
          </div>
        </div>
      </div>

      <div className="admin-container">
        <div className="admin-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="admin-content">
          {activeTab === 'dashboard'    && <Dashboard adminPassword={token} onNavigateToTrail={handleNavigateToTrail} />}
          {activeTab === 'trails'       && <TrailManager adminPassword={token} />}
          {activeTab === 'multiday'     && <MultiDayTrailsManager adminPassword={token} />}
          {activeTab === 'rifugios'     && <RifugiosManager adminPassword={token} />}
          {activeTab === 'bookings'     && <BookingInquiries adminPassword={token} />}
          {activeTab === 'reviews'      && <ReviewsModeration adminPassword={token} />}
          {activeTab === 'plans'        && <UserPlansManager adminPassword={token} />}
          {activeTab === 'users'        && <UserManagement adminPassword={token} />}
          {activeTab === 'analytics'    && <TrailAnalytics adminPassword={token} />}
          {ENABLE_GAMIFICATION && activeTab === 'challenges'   && <ChallengesManager adminPassword={token} />}
          {ENABLE_GAMIFICATION && activeTab === 'gamification' && <GamificationStats adminPassword={token} />}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
