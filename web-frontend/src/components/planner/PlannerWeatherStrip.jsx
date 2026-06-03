import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Thermometer, Cloud, Wind } from 'lucide-react';

import { API_URL } from '../../api';

/* Compact, honest weather chip: shows CURRENT conditions at a coordinate,
   explicitly labelled "Now" so it's never mistaken for a future-date forecast
   (which the backend can't reliably give for arbitrary trek dates). Renders
   nothing until/unless data loads. */
export default function PlannerWeatherStrip({ lat, lon }) {
  const { t } = useTranslation();
  const [w, setW] = useState(null);

  useEffect(() => {
    if (lat == null || lon == null) return;
    let alive = true;
    axios.get(`${API_URL}/weather/current`, { params: { lat, lon } })
      .then(r => { if (alive) setW(r.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [lat, lon]);

  if (!w || w.temperature == null) return null;

  return (
    <div className="pws">
      <span className="pws__now">{t('planner.weatherNow', 'Now')}</span>
      <span className="pws__item"><Thermometer size={13} strokeWidth={2} /> {Math.round(w.temperature)}°</span>
      {w.description && <span className="pws__item"><Cloud size={13} strokeWidth={2} /> {w.description}</span>}
      {w.wind_speed != null && <span className="pws__item"><Wind size={13} strokeWidth={2} /> {Math.round(w.wind_speed)} km/h</span>}
    </div>
  );
}
