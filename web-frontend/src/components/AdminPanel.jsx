import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { ENABLE_GAMIFICATION } from '../featureFlags';
import axios from 'axios';
import TrailManager from './admin/TrailManager';
import ReviewsModeration from './admin/ReviewsModeration';
import ChallengesManager from './admin/ChallengesManager';
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

function AdminPanel({ onNavigate }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTab, setActiveTab] = useState('trails');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is admin
    if (currentUser?.email === ADMIN_EMAIL) {
      // Auto-authenticate admin user
      setIsAuthenticated(true);
      setAdminPassword(ADMIN_PASSWORD);
    }
    setIsCheckingAuth(false);
  }, [currentUser]);

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
            <h1>⚙️ Josephine Admin Panel</h1>
            <button className="logout-btn" onClick={() => { setIsAuthenticated(false); setAdminPassword(''); }}>
              🔒 Logout
            </button>
          </div>
        </div>
      </div>

      <div className="admin-container">
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'trails' ? 'active' : ''}`}
            onClick={() => setActiveTab('trails')}
          >
            🗺️ Trails
          </button>
          <button
            className={`admin-tab ${activeTab === 'multiday' ? 'active' : ''}`}
            onClick={() => setActiveTab('multiday')}
          >
            🏔️ Multi-Day Trails
          </button>
          <button
            className={`admin-tab ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            💬 Reviews
          </button>
          {ENABLE_GAMIFICATION && (
            <button
              className={`admin-tab ${activeTab === 'challenges' ? 'active' : ''}`}
              onClick={() => setActiveTab('challenges')}
            >
              🏆 Challenges
            </button>
          )}
          <button
            className={`admin-tab ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveTab('plans')}
          >
            📅 User Plans
          </button>
          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Users
          </button>
          <button
            className={`admin-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            📊 Analytics
          </button>
          {ENABLE_GAMIFICATION && (
            <button
              className={`admin-tab ${activeTab === 'gamification' ? 'active' : ''}`}
              onClick={() => setActiveTab('gamification')}
            >
              🎮 Gamification
            </button>
          )}
        </div>

        <div className="admin-content">
          {activeTab === 'trails' && <TrailManager adminPassword={adminPassword} />}
          {activeTab === 'multiday' && <MultiDayTrailsManager adminPassword={adminPassword} />}
          {activeTab === 'reviews' && <ReviewsModeration adminPassword={adminPassword} />}
          {ENABLE_GAMIFICATION && activeTab === 'challenges' && <ChallengesManager adminPassword={adminPassword} />}
          {activeTab === 'plans' && <UserPlansManager adminPassword={adminPassword} />}
          {activeTab === 'users' && <UserManagement adminPassword={adminPassword} />}
          {activeTab === 'analytics' && <TrailAnalytics adminPassword={adminPassword} />}
          {ENABLE_GAMIFICATION && activeTab === 'gamification' && <GamificationStats adminPassword={adminPassword} />}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
