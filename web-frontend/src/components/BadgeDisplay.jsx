import React from 'react';
import { useTranslation } from 'react-i18next';
import './BadgeDisplay.css';

function BadgeDisplay({ badge, earned = false, showDetails = true }) {
  const { t } = useTranslation();
  
  if (!badge) return null;
  
  return (
    <div className={`badge-display ${earned ? 'earned' : 'locked'}`}>
      <div className="badge-icon">{badge.icon}</div>
      {showDetails && (
        <>
          <div className="badge-name">{t(`badges.${badge.id}.name`, badge.name)}</div>
          <div className="badge-description">
            {t(`badges.${badge.id}.description`, badge.description)}
          </div>
          <div className="badge-xp">{badge.xp} XP</div>
        </>
      )}
      {!earned && <div className="badge-lock">🔒</div>}
    </div>
  );
}

export default BadgeDisplay;
