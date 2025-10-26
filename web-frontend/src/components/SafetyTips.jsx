import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SafetyTips.css';

function SafetyTips({ difficulty, tripDays }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const getSafetyTips = () => {
    const isMultiDay = tripDays > 1;
    const isDifficult = difficulty === 'hard' || difficulty === 'medium';

    const tips = {
      beforeYouGo: [
        { icon: '🗺️', text: t('safety.checkWeather') },
        { icon: '📱', text: t('safety.tellSomeone') },
        { icon: '⏰', text: t('safety.startEarly') },
        { icon: '🎒', text: t('safety.checkGear') },
      ],
      onTheTrail: [
        { icon: '💧', text: t('safety.stayHydrated') },
        { icon: '👥', text: t('safety.stayOnPath') },
        { icon: '⚡', text: t('safety.paceYourself') },
        { icon: '📸', text: t('safety.takeBreaks') },
      ],
      emergency: [
        { icon: '🚨', text: t('safety.emergencyNumber') },
        { icon: '📍', text: t('safety.knowLocation') },
        { icon: '🆘', text: t('safety.signalHelp') },
        { icon: '🏥', text: t('safety.firstAid') },
      ]
    };

    if (isMultiDay) {
      tips.beforeYouGo.push(
        { icon: '🏕️', text: t('safety.planCampsites') },
        { icon: '🍽️', text: t('safety.foodStorage') }
      );
      tips.onTheTrail.push(
        { icon: '🌙', text: t('safety.setupBeforeDark') }
      );
    }

    if (isDifficult) {
      tips.beforeYouGo.push(
        { icon: '⛰️', text: t('safety.knowRoute') },
        { icon: '🧗', text: t('safety.technicalSkills') }
      );
      tips.onTheTrail.push(
        { icon: '🌩️', text: t('safety.weatherChanges') },
        { icon: '⚠️', text: t('safety.turnBackIfNeeded') }
      );
    }

    return tips;
  };

  const tips = getSafetyTips();

  return (
    <div className="safety-tips-section planner-section">
      <div 
        className="safety-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="section-title">
          🛡️ {t('safety.title')}
        </h2>
        <button className="expand-btn">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="safety-content">
          <div className="safety-categories">
            <div className="safety-category">
              <h3 className="safety-category-title">
                📋 {t('safety.beforeYouGo')}
              </h3>
              <div className="safety-tips-list">
                {tips.beforeYouGo.map((tip, idx) => (
                  <div key={idx} className="safety-tip-card">
                    <span className="tip-icon">{tip.icon}</span>
                    <p className="tip-text">{tip.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="safety-category">
              <h3 className="safety-category-title">
                🥾 {t('safety.onTheTrail')}
              </h3>
              <div className="safety-tips-list">
                {tips.onTheTrail.map((tip, idx) => (
                  <div key={idx} className="safety-tip-card">
                    <span className="tip-icon">{tip.icon}</span>
                    <p className="tip-text">{tip.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="safety-category emergency">
              <h3 className="safety-category-title">
                🆘 {t('safety.emergency')}
              </h3>
              <div className="safety-tips-list">
                {tips.emergency.map((tip, idx) => (
                  <div key={idx} className="safety-tip-card">
                    <span className="tip-icon">{tip.icon}</span>
                    <p className="tip-text">{tip.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="alpine-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-content">
              <h4>{t('safety.alpineWarningTitle')}</h4>
              <p>{t('safety.alpineWarningText')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SafetyTips;
