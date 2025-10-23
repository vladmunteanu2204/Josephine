import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import './Profile.css';

function Profile({ onNavigate }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await updateProfile(user, { displayName });
      setSuccess(t('profile.nameUpdated'));
      setIsEditingName(false);
    } catch (error) {
      console.error('Update name error:', error);
      setError(t('profile.updateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError(t('auth.weakPassword'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);

    try {
      // Re-authenticate user before changing password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      setSuccess(t('profile.passwordUpdated'));
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Change password error:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError(t('profile.wrongCurrentPassword'));
      } else if (error.code === 'auth/too-many-requests') {
        setError(t('auth.tooManyRequests'));
      } else {
        setError(t('profile.passwordChangeFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const getUserInitials = () => {
    if (user?.displayName) {
      return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return t('profile.notAvailable');
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <button onClick={() => onNavigate('home')} className="back-button">
          ← {t('common.backToHome')}
        </button>

        <div className="profile-header">
          <div className="profile-avatar-large">
            {getUserInitials()}
          </div>
          <h1 className="profile-title">{user?.displayName || t('profile.user')}</h1>
          <p className="profile-email">{user?.email}</p>
        </div>

        {error && <div className="profile-error">{error}</div>}
        {success && <div className="profile-success">{success}</div>}

        <div className="profile-section">
          <div className="profile-section-header">
            <h2>{t('profile.accountInfo')}</h2>
          </div>
          
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <label>{t('profile.displayName')}</label>
              {isEditingName ? (
                <form onSubmit={handleUpdateName} className="profile-edit-form">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('profile.enterName')}
                    required
                    className="profile-input"
                  />
                  <div className="profile-edit-buttons">
                    <button type="submit" disabled={loading} className="btn-save">
                      {loading ? t('common.loading') : t('common.save')}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsEditingName(false);
                        setDisplayName(user?.displayName || '');
                        setError('');
                      }}
                      className="btn-cancel"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="profile-info-value">
                  <span>{user?.displayName || t('profile.notSet')}</span>
                  <button onClick={() => setIsEditingName(true)} className="btn-edit">
                    {t('common.edit')}
                  </button>
                </div>
              )}
            </div>

            <div className="profile-info-item">
              <label>{t('profile.email')}</label>
              <div className="profile-info-value">
                <span>{user?.email}</span>
              </div>
            </div>

            <div className="profile-info-item">
              <label>{t('profile.accountCreated')}</label>
              <div className="profile-info-value">
                <span>{formatDate(user?.metadata?.creationTime)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-section">
          <div className="profile-section-header">
            <h2>{t('profile.security')}</h2>
          </div>

          {!isChangingPassword ? (
            <button 
              onClick={() => setIsChangingPassword(true)} 
              className="btn-change-password"
            >
              {t('profile.changePassword')}
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="profile-password-form">
              <div className="form-group">
                <label>{t('profile.currentPassword')}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('profile.enterCurrentPassword')}
                  required
                  className="profile-input"
                />
              </div>

              <div className="form-group">
                <label>{t('profile.newPassword')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('profile.enterNewPassword')}
                  required
                  minLength={6}
                  className="profile-input"
                />
              </div>

              <div className="form-group">
                <label>{t('profile.confirmNewPassword')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('profile.confirmPasswordPlaceholder')}
                  required
                  minLength={6}
                  className="profile-input"
                />
              </div>

              <div className="profile-edit-buttons">
                <button type="submit" disabled={loading} className="btn-save">
                  {loading ? t('common.loading') : t('profile.updatePassword')}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsChangingPassword(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                  }}
                  className="btn-cancel"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
