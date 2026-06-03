import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield, ChevronDown, ChevronRight, ClipboardList, Footprints, LifeBuoy,
  AlertTriangle, Map, Smartphone, Clock, Backpack, Droplet, Users, Zap,
  Camera, Siren, MapPin, Cross, Tent, Utensils, Moon, Mountain, Pickaxe,
  CloudLightning,
} from 'lucide-react';
import './SafetyTips.css';

function SafetyTips({ difficulty, tripDays }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const getSafetyTips = () => {
    const isMultiDay = tripDays > 1;
    const isDifficult = difficulty === 'hard' || difficulty === 'medium';

    const tips = {
      beforeYouGo: [
        { icon: Map, text: t('safety.checkWeather') },
        { icon: Smartphone, text: t('safety.tellSomeone') },
        { icon: Clock, text: t('safety.startEarly') },
        { icon: Backpack, text: t('safety.checkGear') },
      ],
      onTheTrail: [
        { icon: Droplet, text: t('safety.stayHydrated') },
        { icon: Users, text: t('safety.stayOnPath') },
        { icon: Zap, text: t('safety.paceYourself') },
        { icon: Camera, text: t('safety.takeBreaks') },
      ],
      emergency: [
        { icon: Siren, text: t('safety.emergencyNumber') },
        { icon: MapPin, text: t('safety.knowLocation') },
        { icon: LifeBuoy, text: t('safety.signalHelp') },
        { icon: Cross, text: t('safety.firstAid') },
      ]
    };

    if (isMultiDay) {
      tips.beforeYouGo.push(
        { icon: Tent, text: t('safety.planCampsites') },
        { icon: Utensils, text: t('safety.foodStorage') }
      );
      tips.onTheTrail.push(
        { icon: Moon, text: t('safety.setupBeforeDark') }
      );
    }

    if (isDifficult) {
      tips.beforeYouGo.push(
        { icon: Mountain, text: t('safety.knowRoute') },
        { icon: Pickaxe, text: t('safety.technicalSkills') }
      );
      tips.onTheTrail.push(
        { icon: CloudLightning, text: t('safety.weatherChanges') },
        { icon: AlertTriangle, text: t('safety.turnBackIfNeeded') }
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
          <Shield size={20} strokeWidth={1.75} aria-hidden="true" /> {t('safety.title')}
        </h2>
        <button className="expand-btn" aria-label={t('common.toggle', 'Toggle')}>
          {isExpanded ? <ChevronDown size={18} strokeWidth={2} aria-hidden="true" /> : <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>

      {isExpanded && (
        <div className="safety-content">
          <div className="safety-categories">
            <div className="safety-category">
              <h3 className="safety-category-title">
                <ClipboardList size={18} strokeWidth={1.75} aria-hidden="true" /> {t('safety.beforeYouGo')}
              </h3>
              <div className="safety-tips-list">
                {tips.beforeYouGo.map((tip, idx) => {
                  const Icon = tip.icon;
                  return (
                    <div key={idx} className="safety-tip-card">
                      <span className="tip-icon"><Icon size={18} strokeWidth={1.75} aria-hidden="true" /></span>
                      <p className="tip-text">{tip.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="safety-category">
              <h3 className="safety-category-title">
                <Footprints size={18} strokeWidth={1.75} aria-hidden="true" /> {t('safety.onTheTrail')}
              </h3>
              <div className="safety-tips-list">
                {tips.onTheTrail.map((tip, idx) => {
                  const Icon = tip.icon;
                  return (
                    <div key={idx} className="safety-tip-card">
                      <span className="tip-icon"><Icon size={18} strokeWidth={1.75} aria-hidden="true" /></span>
                      <p className="tip-text">{tip.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="safety-category emergency">
              <h3 className="safety-category-title">
                <LifeBuoy size={18} strokeWidth={1.75} aria-hidden="true" /> {t('safety.emergency')}
              </h3>
              <div className="safety-tips-list">
                {tips.emergency.map((tip, idx) => {
                  const Icon = tip.icon;
                  return (
                    <div key={idx} className="safety-tip-card">
                      <span className="tip-icon"><Icon size={18} strokeWidth={1.75} aria-hidden="true" /></span>
                      <p className="tip-text">{tip.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="alpine-warning">
            <div className="warning-icon"><AlertTriangle size={22} strokeWidth={2} aria-hidden="true" /></div>
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
