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
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';
if (!import.meta.env.VITE_ADMIN_PASSWORD) {
  console.warn('[AdminPanel] VITE_ADMIN_PASSWORD env var is not set — admin API calls will be rejected by the server.');
}

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (currentUser?.email === ADMIN_EMAIL) {
      setIsAuthenticated(true);
      setAdminPassword(ADMIN_PASSWORD);
    }
    setIsCheckingAuth(false);
  }, [currentUser]);

  // Allow Dashboard to jump to the trails tab with a specific trail pre-selected
  const handleNavigateToTrail = (trailId) => {
    setActiveTab('trails');
    // TrailManager will need to handle this — for now just switch tab
  };

  if (isCheckingAuth) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-container">
          <div className="admin-login-card">
            <div className="admin-login-header">
              <h1>🔐 Admin Panel</h1>
              <p>Verifying access...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
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
            <button
              className="admin-login-btn"
              onClick={() => onNavigate('home')}
              style={{ marginTop: '20px' }}
            >
              ← Back to Home
            </button>
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
            <button className="logout-btn" onClick={() => { setIsAuthenticated(false); setAdminPassword(''); }}>
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
          {activeTab === 'dashboard'    && <Dashboard adminPassword={adminPassword} onNavigateToTrail={handleNavigateToTrail} />}
          {activeTab === 'trails'       && <TrailManager adminPassword={adminPassword} />}
          {activeTab === 'multiday'     && <MultiDayTrailsManager adminPassword={adminPassword} />}
          {activeTab === 'rifugios'     && <RifugiosManager adminPassword={adminPassword} />}
          {activeTab === 'bookings'     && <BookingInquiries adminPassword={adminPassword} />}
          {activeTab === 'reviews'      && <ReviewsModeration adminPassword={adminPassword} />}
          {activeTab === 'plans'        && <UserPlansManager adminPassword={adminPassword} />}
          {activeTab === 'users'        && <UserManagement adminPassword={adminPassword} />}
          {activeTab === 'analytics'    && <TrailAnalytics adminPassword={adminPassword} />}
          {ENABLE_GAMIFICATION && activeTab === 'challenges'   && <ChallengesManager adminPassword={adminPassword} />}
          {ENABLE_GAMIFICATION && activeTab === 'gamification' && <GamificationStats adminPassword={adminPassword} />}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
