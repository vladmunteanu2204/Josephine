import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './ui';
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
    <Modal isOpen onClose={onCancel} closeOnBackdrop={false} ariaLabelledby="safety-modal-title">
      <div className="safety-modal">
        <div className="modal-header">
          <h2 className="modal-title" id="safety-modal-title">⚠️ {t('safetyDisclaimer.title')}</h2>
        </div>

        <div className="modal-content">
          <div className="trail-info">
            <p className="preparing-for">{t('safetyDisclaimer.preparingFor')}</p>
            <p className="trail-name-highlight">{trailName}</p>
          </div>

          <div className="safety-checklist">
            <h3>{t('safetyDisclaimer.beforeYouStart')}</h3>
            
            <div className="checklist-item">
              <span className="icon">🌤️</span>
              <div>
                <strong>{t('safetyDisclaimer.checkWeather')}</strong>
                <p>{t('safetyDisclaimer.checkWeatherDesc')}</p>
              </div>
            </div>

            <div className="checklist-item">
              <span className="icon">📱</span>
              <div>
                <strong>{t('safetyDisclaimer.informSomeone')}</strong>
                <p>{t('safetyDisclaimer.informSomeoneDesc')}</p>
              </div>
            </div>

            <div className="checklist-item">
              <span className="icon">🎒</span>
              <div>
                <strong>{t('safetyDisclaimer.properEquipment')}</strong>
                <p>{t('safetyDisclaimer.properEquipmentDesc')}</p>
              </div>
            </div>

            <div className="checklist-item">
              <span className="icon">🗺️</span>
              <div>
                <strong>{t('safetyDisclaimer.backupNavigation')}</strong>
                <p>{t('safetyDisclaimer.backupNavigationDesc')}</p>
              </div>
            </div>

            <div className="checklist-item">
              <span className="icon">💪</span>
              <div>
                <strong>{t('safetyDisclaimer.knowLimits')}</strong>
                <p>{t('safetyDisclaimer.knowLimitsDesc')}</p>
              </div>
            </div>
          </div>

          <div className="emergency-info">
            <h3>🆘 {t('safetyDisclaimer.emergencyNumbers')}</h3>
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
            <h3>{t('safetyDisclaimer.disclaimer')}</h3>
            <p>{t('safetyDisclaimer.disclaimerText')}</p>
          </div>

          <div className="acceptance-checkbox">
            <label>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>{t('safetyDisclaimer.iUnderstand')}</span>
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
            {t('safetyDisclaimer.startHike')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default SafetyDisclaimerModal;
