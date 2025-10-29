import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import TrailManager from './admin/TrailManager';
import GPXUploader from './admin/GPXUploader';
import ReviewsModeration from './admin/ReviewsModeration';
import ChallengesManager from './admin/ChallengesManager';
import './AdminPanel.css';

function AdminPanel({ onNavigate }) {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('trails');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');
    
    try {
      const response = await axios.post('/api/admin/login', { password });
      if (response.data.success) {
        setIsAuthenticated(true);
        setAdminPassword(password);
        setPassword('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid password');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-container">
          <div className="admin-login-card">
            <div className="admin-login-header">
              <h1>🔐 Admin Panel</h1>
              <p>Enter password to access admin functions</p>
            </div>
            <form onSubmit={handleLogin} className="admin-login-form">
              <input
                type="password"
                className="admin-password-input"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              {error && <div className="admin-login-error">{error}</div>}
              <button type="submit" className="admin-login-btn" disabled={isLoggingIn}>
                {isLoggingIn ? 'Verifying...' : 'Access Admin Panel'}
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
            <h1>⚙️ Alpenvia Admin Panel</h1>
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
            🗺️ Trail Management
          </button>
          <button
            className={`admin-tab ${activeTab === 'gpx' ? 'active' : ''}`}
            onClick={() => setActiveTab('gpx')}
          >
            📍 GPX Upload
          </button>
          <button
            className={`admin-tab ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            💬 Reviews Moderation
          </button>
          <button
            className={`admin-tab ${activeTab === 'challenges' ? 'active' : ''}`}
            onClick={() => setActiveTab('challenges')}
          >
            🏆 Challenges
          </button>
        </div>

        <div className="admin-content">
          {activeTab === 'trails' && <TrailManager adminPassword={adminPassword} />}
          {activeTab === 'gpx' && <GPXUploader adminPassword={adminPassword} />}
          {activeTab === 'reviews' && <ReviewsModeration adminPassword={adminPassword} />}
          {activeTab === 'challenges' && <ChallengesManager adminPassword={adminPassword} />}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
