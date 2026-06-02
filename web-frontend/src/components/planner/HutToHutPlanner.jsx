import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Mountain } from 'lucide-react';
import './MyPlan.css';

/* Placeholder — the full hut-to-hut planner (trek picker, nightly schedule,
   hut booking) is built in a later phase. */
export default function HutToHutPlanner({ onBack }) {
  const { t } = useTranslation();
  return (
    <div className="myplan-page">
      <div className="container">
        <button className="myplan-back" onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={2} /> {t('planner.savedItineraries', 'My plans')}
        </button>
        <div className="myplan-empty">
          <Mountain size={40} strokeWidth={1.25} />
          <p>{t('planner.hutComingSoon', 'Hut-to-hut planning is coming together — check back shortly.')}</p>
        </div>
      </div>
    </div>
  );
}
