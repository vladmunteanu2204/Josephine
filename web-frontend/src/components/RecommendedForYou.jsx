import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, MapPin, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ENABLE_RECOMMENDATIONS } from '../featureFlags';
import { fetchRecommendations } from '../utils/personalization';
import { trailImg, onImgError } from '../utils/trailImage';
import './RecommendedForYou.css';

const fmtDist = (km) =>
  km == null ? '' : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
const fmtDur = (h) => {
  if (!h) return '';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return hh > 0 ? `${hh}h${mm ? ` ${mm}m` : ''}` : `${mm}m`;
};

/**
 * Turn a recommender reason code (+ params) into a short, localised "why" chip.
 * Reasons arrive as { code, ...params } so the server never ships prose.
 */
function reasonLabel(t, reason) {
  if (!reason) return null;
  switch (reason.code) {
    case 'matchesDifficulty':
      return t(`recsForYou.reasonDifficulty.${reason.difficulty}`,
        t('recsForYou.reasonDifficultyGeneric', 'Your kind of trail'));
    case 'sharedInterest':
      return t('recsForYou.reasonInterest', 'You love {{tag}}', { tag: reason.tag });
    case 'sameRegion':
      return t('recsForYou.reasonRegion', 'Near your favourites');
    case 'fitsDuration':
      return t('recsForYou.reasonDuration', '~{{hours}}h, your pace', { hours: reason.hours });
    case 'rifugioNearby':
      return t('recsForYou.reasonRifugio', 'Has a mountain hut');
    case 'dogFriendly':
      return t('recsForYou.reasonDog', 'Dog-friendly');
    case 'highlyRated':
      return t('recsForYou.reasonRated', 'Highly rated');
    case 'popularPick':
      return t('recsForYou.reasonPopular', 'Popular right now');
    default:
      return null;
  }
}

/**
 * RecommendedForYou — a personalised, horizontally scrollable trail row on the
 * homepage. Renders nothing for guests, when the flag is off, or when the
 * backend has no suggestions (keeps the page clean rather than showing an empty
 * shell). On a cold start it softens the heading to "Popular right now".
 */
export default function RecommendedForYou({ viewTrail }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const email = currentUser?.email || null;

  const [results, setResults] = useState([]);
  const [coldStart, setColdStart] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!ENABLE_RECOMMENDATIONS || !email) {
      setResults([]); setLoaded(true);
      return;
    }
    setLoaded(false);
    fetchRecommendations(email, 8).then((data) => {
      if (cancelled) return;
      setResults(Array.isArray(data.results) ? data.results : []);
      setColdStart(!!data.cold_start);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [email]);

  if (!ENABLE_RECOMMENDATIONS || !email) return null;
  if (!loaded || results.length === 0) return null;

  const heading = coldStart
    ? t('recsForYou.titleCold', 'Popular right now')
    : t('recsForYou.title', 'Recommended for you');
  const subtitle = coldStart
    ? t('recsForYou.subtitleCold', "Loved by hikers across South Tyrol — a place to start.")
    : t('recsForYou.subtitle', "Hand-picked from the trails and moments you’ve loved.");

  return (
    <section className="rfy">
      <div className="rfy__head">
        <div className="rfy__title-wrap">
          <Sparkles size={18} className="rfy__spark" strokeWidth={2.2} />
          <h2 className="rfy__title">{heading}</h2>
        </div>
        <p className="rfy__subtitle">{subtitle}</p>
      </div>

      <div className="rfy__rail" role="list">
        {results.map((trail) => {
          const reason = reasonLabel(t, trail.reasons?.[0]);
          return (
            <button
              type="button"
              role="listitem"
              key={trail.id}
              className="rfy__card"
              onClick={() => viewTrail?.(trail)}
            >
              <div className="rfy__media">
                <img
                  src={trailImg(trail, 'card')}
                  alt={trail.name}
                  onError={onImgError}
                  loading="lazy"
                />
                {reason && <span className="rfy__chip">{reason}</span>}
              </div>
              <div className="rfy__body">
                <h3 className="rfy__name">{trail.name}</h3>
                {trail.region && (
                  <p className="rfy__region">
                    <MapPin size={12} strokeWidth={2} /> {trail.region}
                  </p>
                )}
                <div className="rfy__meta">
                  {trail.distance_km != null && (
                    <span><MapPin size={12} strokeWidth={2} /> {fmtDist(trail.distance_km)}</span>
                  )}
                  {trail.duration_hours != null && (
                    <span><Clock size={12} strokeWidth={2} /> {fmtDur(trail.duration_hours)}</span>
                  )}
                  {trail.elevation_gain_m != null && (
                    <span><TrendingUp size={12} strokeWidth={2} /> {Math.round(trail.elevation_gain_m)} m</span>
                  )}
                </div>
                <span className="rfy__open">
                  {t('recsForYou.view', 'View trail')} <ArrowRight size={13} strokeWidth={2.2} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
