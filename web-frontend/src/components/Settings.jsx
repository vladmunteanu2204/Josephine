import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeft, Settings as SettingsIcon, Globe, Ruler, Bell, User, Check } from 'lucide-react';
import './Settings.css';

function Settings({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const { currentUser: user, logout } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState({
    language: i18n.language || 'en',
    units: localStorage.getItem('units') || 'metric',
    emailNotifications: localStorage.getItem('emailNotifications') === 'true',
    trailAlerts: localStorage.getItem('trailAlerts') === 'true',
    newsletter: localStorage.getItem('newsletter') === 'true',
  });
  const [saved, setSaved] = useState(false);

  const handleLanguageChange = (lang) => {
    setSettings({ ...settings, language: lang });
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUnitsChange = (units) => {
    setSettings({ ...settings, units });
    localStorage.setItem('units', units);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleNotificationToggle = (key) => {
    const newValue = !settings[key];
    setSettings({ ...settings, [key]: newValue });
    localStorage.setItem(key, newValue.toString());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteAccount = () => {
    if (window.confirm(t('settings.deleteAccountConfirm'))) {
      // In a real app, this would call a backend API to delete the account
      toast.info(t('settings.deleteAccountNote'));
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <button onClick={() => onNavigate('home')} className="back-button">
          <ArrowLeft size={16} strokeWidth={2} /> {t('common.backToHome')}
        </button>

        <div className="settings-header">
          <h1 className="settings-title"><SettingsIcon size={24} strokeWidth={1.75} aria-hidden="true" /> {t('settings.title')}</h1>
          <p className="settings-subtitle">{t('settings.subtitle')}</p>
        </div>

        {saved && (
          <div className="settings-success">
            <Check size={16} strokeWidth={2.5} aria-hidden="true" /> {t('settings.saved')}
          </div>
        )}

        {/* Language Settings */}
        <div className="settings-section">
          <div className="section-header">
            <h2><Globe size={20} strokeWidth={1.75} aria-hidden="true" /> {t('settings.language')}</h2>
            <p className="section-description">{t('settings.languageDescription')}</p>
          </div>

          <div className="settings-options">
            <div 
              className={`option-card ${settings.language === 'en' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('en')}
            >
              <div className="option-icon">🇬🇧</div>
              <div className="option-content">
                <div className="option-title">English</div>
                <div className="option-subtitle">English (United States)</div>
              </div>
              {settings.language === 'en' && <div className="check-mark"><Check size={18} strokeWidth={2.5} aria-hidden="true" /></div>}
            </div>

            <div 
              className={`option-card ${settings.language === 'it' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('it')}
            >
              <div className="option-icon">🇮🇹</div>
              <div className="option-content">
                <div className="option-title">Italiano</div>
                <div className="option-subtitle">Italian</div>
              </div>
              {settings.language === 'it' && <div className="check-mark"><Check size={18} strokeWidth={2.5} aria-hidden="true" /></div>}
            </div>

            <div 
              className={`option-card ${settings.language === 'de' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('de')}
            >
              <div className="option-icon">🇩🇪</div>
              <div className="option-content">
                <div className="option-title">Deutsch</div>
                <div className="option-subtitle">German</div>
              </div>
              {settings.language === 'de' && <div className="check-mark"><Check size={18} strokeWidth={2.5} aria-hidden="true" /></div>}
            </div>
          </div>
        </div>

        {/* Units Settings */}
        <div className="settings-section">
          <div className="section-header">
            <h2><Ruler size={20} strokeWidth={1.75} aria-hidden="true" /> {t('settings.units')}</h2>
            <p className="section-description">{t('settings.unitsDescription')}</p>
          </div>

          <div className="settings-options">
            <div 
              className={`option-card ${settings.units === 'metric' ? 'active' : ''}`}
              onClick={() => handleUnitsChange('metric')}
            >
              <div className="option-content">
                <div className="option-title">{t('settings.metric')}</div>
                <div className="option-subtitle">km, meters, °C</div>
              </div>
              {settings.units === 'metric' && <div className="check-mark"><Check size={18} strokeWidth={2.5} aria-hidden="true" /></div>}
            </div>

            <div 
              className={`option-card ${settings.units === 'imperial' ? 'active' : ''}`}
              onClick={() => handleUnitsChange('imperial')}
            >
              <div className="option-content">
                <div className="option-title">{t('settings.imperial')}</div>
                <div className="option-subtitle">miles, feet, °F</div>
              </div>
              {settings.units === 'imperial' && <div className="check-mark"><Check size={18} strokeWidth={2.5} aria-hidden="true" /></div>}
            </div>
          </div>
        </div>

        {/* Notifications Settings */}
        <div className="settings-section">
          <div className="section-header">
            <h2><Bell size={20} strokeWidth={1.75} aria-hidden="true" /> {t('settings.notifications')}</h2>
            <p className="section-description">{t('settings.notificationsDescription')}</p>
          </div>

          <div className="toggle-list">
            <div className="toggle-item">
              <div className="toggle-content">
                <div className="toggle-title">{t('settings.emailNotifications')}</div>
                <div className="toggle-subtitle">{t('settings.emailNotificationsDescription')}</div>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={settings.emailNotifications}
                  onChange={() => handleNotificationToggle('emailNotifications')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-content">
                <div className="toggle-title">{t('settings.trailAlerts')}</div>
                <div className="toggle-subtitle">{t('settings.trailAlertsDescription')}</div>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={settings.trailAlerts}
                  onChange={() => handleNotificationToggle('trailAlerts')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-content">
                <div className="toggle-title">{t('settings.newsletter')}</div>
                <div className="toggle-subtitle">{t('settings.newsletterDescription')}</div>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={settings.newsletter}
                  onChange={() => handleNotificationToggle('newsletter')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Account Management */}
        <div className="settings-section">
          <div className="section-header">
            <h2><User size={20} strokeWidth={1.75} aria-hidden="true" /> {t('settings.account')}</h2>
            <p className="section-description">{t('settings.accountDescription')}</p>
          </div>

          {user && (
            <div className="account-info">
              <div className="account-info-row">
                <span className="account-info-label">{t('auth.email', 'Email')}</span>
                <span className="account-info-value">{user.email}</span>
              </div>
              {user.displayName && (
                <div className="account-info-row">
                  <span className="account-info-label">{t('profile.displayName', 'Name')}</span>
                  <span className="account-info-value">{user.displayName}</span>
                </div>
              )}
            </div>
          )}

          <div className="account-actions">
            <button onClick={logout} className="btn-logout">
              {t('common.logout')}
            </button>
            <button onClick={handleDeleteAccount} className="btn-delete">
              {t('settings.deleteAccount')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
