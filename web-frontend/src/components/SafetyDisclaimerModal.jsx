import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SafetyDisclaimerModal.css';

function SafetyDisclaimerModal({ onAccept, onCancel, trailName }) {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    if (accepted) {
      onAccept();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="safety-modal">
        <div className="modal-header">
          <h2 className="modal-title">⚠️ {t('safety.title')}</h2>
        </div>

        <div className="modal-content">
          <div className="trail-info">
            <p className="preparing-for">{t('safety.preparingFor')}</p>
            <p className="trail-name-highlight">{trailName}</p>
          </div>

          <div className="safety-checklist">
            <h3>{t('safety.beforeYouStart')}</h3>
            
            <div className="checklist-item">
              <span className="icon">🌤️</span>
              <div>
                <strong>{t('safety.checkWeather')}</strong>
                <p>{t('safety.checkWeatherDesc')}</p>
              </div>
            </div>

            <div className="checklist-item">
              <span className="icon">📱</span>
              <div>
                <strong>{t('safety.informSomeone')}</strong>
                <p>{t('safety.informSomeoneDesc')}</p>
              </div>
            </div>

            <div className="checklist-item">
              <span className="icon">🎒</span>
              <div>
                <strong>{t('safety.properEquipment')}</strong>
                <p>{t('safety.properEquipmentDesc')}</p>
              </div>
            </div>

            <div className="checklist-item">
              <span className="icon">🗺️</span>
              <div>
                <strong>{t('safety.backupNavigation')}</strong>
                <p>{t('safety.backupNavigationDesc')}</p>
              </div>
            </div>

            <div className="checklist-item">
              <span className="icon">💪</span>
              <div>
                <strong>{t('safety.knowLimits')}</strong>
                <p>{t('safety.knowLimitsDesc')}</p>
              </div>
            </div>
          </div>

          <div className="emergency-info">
            <h3>🆘 {t('safety.emergencyNumbers')}</h3>
            <div className="emergency-numbers">
              <div className="emergency-number">
                <strong>Europe:</strong> 112
              </div>
              <div className="emergency-number">
                <strong>Italy Medical:</strong> 118
              </div>
              <div className="emergency-number">
                <strong>Mountain Rescue (South Tyrol):</strong> +39 0471 797 397
              </div>
            </div>
          </div>

          <div className="disclaimer-box">
            <h3>{t('safety.disclaimer')}</h3>
            <p>{t('safety.disclaimerText')}</p>
          </div>

          <div className="acceptance-checkbox">
            <label>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>{t('safety.iUnderstand')}</span>
            </label>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            className={`btn-start-hike ${!accepted ? 'disabled' : ''}`}
            onClick={handleAccept}
            disabled={!accepted}
          >
            {t('safety.startHike')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SafetyDisclaimerModal;
