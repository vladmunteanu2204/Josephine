import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  ArrowLeft, Heart, Share2, Footprints, MapPin, Star, Ruler, TrendingUp,
  Clock, BarChart3, CalendarDays, Car, Utensils, Users, Dog, Sun,
  Map as MapIcon, ChevronRight, Mountain, Eye, Home, Droplet, Church,
  Trees, Flag, Sparkles, X, Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { trailImg, trailGallery, onImgError } from '../utils/trailImage';
import { buildStaticRouteMapUrl } from '../utils/itineraryPdf';
import { trackTrailView, trackTrailSave } from '../utils/personalization';
import { ENABLE_HIKE_TRACKING } from '../featureFlags';
import { Sheet } from './ui';
import TrailMap from './TrailMap';
import { ElevationProfile } from './TrailDetail';
import WeatherWidget from './WeatherWidget';
import ReviewsSection from './ReviewsSection';
import MediaGallery from './MediaGallery';
import TrailheadDirections from './TrailheadDirections';
import OfflineDownload from './OfflineDownload';
import ItineraryDownload from './ItineraryDownload';
import AuthPromptModal from './AuthPromptModal';
import './TrailDetailV2.css';

const DIFFICULTY = {
  easy:      { color: '#5fb87a', label: 'Easy' },
  medium:    { color: '#c9a84c', label: 'Moderate' },
  moderate:  { color: '#c9a84c', label: 'Moderate' },
  hard:      { color: '#e0794f', label: 'Challenging' },
  difficult: { color: '#e0794f', label: 'Challenging' },
  expert:    { color: '#e05a4f', label: 'Expert' },
};

const TRAIL_TYPE_LABEL = {
  loop: 'Loop', out_and_back: 'Out & back', point_to_point: 'Point to point',
};

const POI_ICON = {
  viewpoint: Eye, summit: Mountain, peak: Mountain, refuge: Home, rifugio: Home,
  hut: Home, cabin: Home, food: Utensils, restaurant: Utensils, lake: Droplet,
  water: Droplet, cultural: Church, church: Church, forest: Trees, park: Trees,
};
const poiIcon = (type) => POI_ICON[(type || '').toLowerCase()] || Flag;

/* ── small helpers ─────────────────────────────────────────── */
function fmtSeason(s) {
  if (Array.isArray(s) && s.length) return s.length > 1 ? `${s[0]} – ${s[s.length - 1]}` : s[0];
  if (typeof s === 'string' && s) return s;
  return null;
}

function TrailDetailV2({
  trail, onBack, setIsGPSActive, viewRifugio, onShowLogin,
  onPlanWithJosephine, autoStartHike, onAutoStartConsumed, onStartHike,
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { currentUser } = useAuth();
  const lang = (i18n.language || 'en').split('-')[0];

  const [full, setFull] = useState(trail);
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [insights, setInsights] = useState([]);
  const [drivingRoute, setDrivingRoute] = useState(null);
  const [sheet, setSheet] = useState(null); // 'map' | 'pois' | 'gallery' | 'reviews' | null

  /* Fetch full trail if only an id/stub was passed */
  useEffect(() => {
    if (trail && trail.id && !trail.name) {
      setLoading(true);
      axios.get('/api/trails')
        .then((res) => {
          const found = (res.data.trails || res.data).find((tr) => tr.id === trail.id);
          if (found) setFull(found);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setFull(trail);
    }
  }, [trail]);

  /* Saved state + personalisation view ping */
  useEffect(() => {
    if (!full?.id) return;
    const saved = JSON.parse(localStorage.getItem('savedTrails') || '[]');
    setIsSaved(saved.includes(full.id));
    trackTrailView(full.id, currentUser?.email);
  }, [full?.id, currentUser?.email]);

  /* Public insider insights */
  useEffect(() => {
    if (!full?.id) return;
    axios.get(`/api/trails/${full.id}/insights`, { params: { lang } })
      .then((res) => setInsights(res.data?.insights || []))
      .catch(() => setInsights([]));
  }, [full?.id, lang]);

  /* Cleanup GPS on unmount */
  useEffect(() => () => { if (setIsGPSActive) setIsGPSActive(false); }, [setIsGPSActive]);

  /* Auto-start hike (launched from elsewhere) */
  useEffect(() => {
    if (autoStartHike && ENABLE_HIKE_TRACKING && full?.name) {
      onStartHike?.(full);
      onAutoStartConsumed?.();
    }
  }, [autoStartHike, full?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSave = () => {
    if (!currentUser) { setShowAuthPrompt(true); return; }
    const saved = JSON.parse(localStorage.getItem('savedTrails') || '[]');
    const next = isSaved ? saved.filter((id) => id !== full.id) : [...saved, full.id];
    localStorage.setItem('savedTrails', JSON.stringify(next));
    setIsSaved(!isSaved);
    toast[isSaved ? 'info' : 'success'](isSaved ? t('trail.trailUnsaved') : t('trail.trailSaved'));
    trackTrailSave(full.id, currentUser?.email, isSaved ? 'unsave' : 'save');
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: full.name, url });
      else { await navigator.clipboard.writeText(url); toast.success(t('trail.linkCopied', 'Link copied')); }
    } catch { /* user cancelled */ }
  };

  if (loading) {
    return (
      <div className="tdx">
        <button className="tdx-floatback" onClick={onBack}><ArrowLeft size={18} /> {t('trail.backToTrails', 'Back')}</button>
        <div className="tdx-state">{t('common.loading', 'Loading…')}</div>
      </div>
    );
  }
  if (!full?.name) {
    return (
      <div className="tdx">
        <button className="tdx-floatback" onClick={onBack}><ArrowLeft size={18} /> {t('trail.backToTrails', 'Back')}</button>
        <div className="tdx-state tdx-state--error">{t('common.error', 'Something went wrong')}</div>
      </div>
    );
  }

  const diff = DIFFICULTY[(full.difficulty || 'moderate').toLowerCase()] || DIFFICULTY.moderate;
  const typeLabel = TRAIL_TYPE_LABEL[full.trail_type] || '';
  const heroImg = trailImg(full, 'hero');
  const note = (full.josephineNote && (full.josephineNote[lang] || full.josephineNote.en)) || full.tagline || '';
  const gallery = trailGallery(full) || [];
  // Only a *real* gallery (explicit images/gallery data) — trailGallery otherwise
  // falls back to the hero image, which we don't want to show as a fake gallery.
  const hasGallery = (Array.isArray(full.images) && full.images.length > 0)
    || (Array.isArray(full.gallery) && full.gallery.length > 0);
  const pois = Array.isArray(full.pois) ? full.pois : [];
  const season = fmtSeason(full.best_season);
  const parking = full.trailhead_info?.parking || full.transport?.car;
  const facilities = Array.isArray(full.facilities) ? full.facilities : [];
  const crowd = full.crowding?.level;
  const mapThumb = buildStaticRouteMapUrl(full, { width: 560, height: 300 });
  const hasCoords = Array.isArray(full.coordinates) && full.coordinates.length > 1;

  // Bento cards before the itinerary: Map + Reviews (always) + the conditional
  // ones. If that count is even, the itinerary would start a lonely row → span
  // it full-width; if odd, it pairs with the trailing card (no empty corner).
  const cardsBeforeItin = 2 + (hasCoords ? 1 : 0)
    + (pois.length > 0 || insights.length > 0 ? 1 : 0)
    + (hasGallery ? 1 : 0) + (full.dog_friendly ? 1 : 0);
  const itineraryFull = cardsBeforeItin % 2 === 0;

  const gtk = [
    season && { icon: CalendarDays, label: t('trail.gtkBestTime', 'Best season'), value: season },
    parking && { icon: Car, label: t('trail.gtkParking', 'Parking'), value: parking },
    facilities.length && { icon: Utensils, label: t('trail.gtkFacilities', 'Facilities'), value: facilities.slice(0, 3).join(', ') },
    crowd && { icon: Users, label: t('trail.gtkCrowds', 'Crowds'), value: crowd },
    full.dog_friendly && { icon: Dog, label: t('trail.gtkDog', 'Dog friendly'), value: full.dog_note ? t('trail.onLeash', 'On leash') : t('pdf.yes', 'Yes') },
  ].filter(Boolean);

  const startHike = () => {
    if (!ENABLE_HIKE_TRACKING) return;
    if (!currentUser) { setShowAuthPrompt(true); return; }
    onStartHike?.(full);
  };

  return (
    <div className="tdx">
      {/* ── HERO ── */}
      <header className="tdx-hero">
        <img className="tdx-hero__img" src={heroImg} alt={full.name} onError={onImgError} />
        <div className="tdx-hero__scrim" />
        <button className="tdx-hero__back" onClick={onBack} aria-label={t('trail.backToTrails', 'Back')}>
          <ArrowLeft size={20} strokeWidth={2} />
        </button>

        <div className="tdx-hero__inner">
          <div className="tdx-hero__main">
            <div className="tdx-chips">
              {full.rating != null && <span className="tdx-chip tdx-chip--star"><Star size={13} fill="currentColor" strokeWidth={0} /> {full.rating}</span>}
              {typeLabel && <span className="tdx-chip">{diff.label} {typeLabel.toLowerCase()}</span>}
              {full.distance_km != null && <span className="tdx-chip">{full.distance_km} km</span>}
            </div>
            <h1 className="tdx-title">{full.name}</h1>
            {full.region && <p className="tdx-loc"><MapPin size={16} strokeWidth={2} /> {full.region}</p>}

            <div className="tdx-actions">
              {ENABLE_HIKE_TRACKING && (
                <button className="tdx-btn tdx-btn--primary" onClick={startHike}>
                  <Footprints size={18} strokeWidth={2} /> {t('trail.startHike', 'Start this Hike')}
                </button>
              )}
              <button className={`tdx-btn tdx-btn--ghost${isSaved ? ' is-saved' : ''}`} onClick={toggleSave}>
                <Heart size={17} strokeWidth={2} fill={isSaved ? 'currentColor' : 'none'} /> {t('recommendations.saveTrail', 'Save')}
              </button>
              <button className="tdx-btn tdx-btn--ghost" onClick={share}>
                <Share2 size={17} strokeWidth={2} /> {t('trail.share', 'Share')}
              </button>
            </div>
          </div>

          {note && (
            <aside className="tdx-jph">
              <div className="tdx-jph__head">
                <img src="/josephine/portrait.png" alt="Josephine" className="tdx-jph__avatar"
                  onError={(e) => { e.currentTarget.src = '/josephine-portrait.webp'; }} />
                <span className="tdx-jph__label">{t('trail.whyPicked', 'Why Josephine picked this')}</span>
              </div>
              <p className="tdx-jph__text">{note}</p>
              {onPlanWithJosephine && (
                <button className="tdx-jph__cta" onClick={() => onPlanWithJosephine(full)}>
                  <Sparkles size={15} strokeWidth={2} /> {t('trail.planCta', 'Plan this hike with Josephine')}
                </button>
              )}
            </aside>
          )}
        </div>
      </header>

      <div className="tdx-body">
        {/* ── OVERVIEW + STATS ── */}
        <section className="tdx-overview">
          <div className="tdx-overview__text">
            <h2 className="tdx-h2">{t('trail.trailOverview', 'Trail Overview')}</h2>
            <p>{full.description}</p>
          </div>
          <div className="tdx-stats">
            <Stat icon={Ruler} value={`${full.distance_km ?? '—'} km`} label={typeLabel || t('pdf.distance', 'Distance')} />
            <Stat icon={TrendingUp} value={`${full.elevation_gain_m ?? '—'} m`} label={t('pdf.elevGain', 'Gain')} />
            <Stat icon={Clock} value={full.duration_hours ? `${full.duration_hours} h` : '—'} label={t('pdf.duration', 'Duration')} />
            <Stat icon={BarChart3} value={diff.label} label={t('pdf.difficulty', 'Difficulty')} valueColor={diff.color} />
          </div>
        </section>

        {/* ── GOOD TO KNOW ── */}
        {gtk.length > 0 && (
          <section className="tdx-gtk">
            <h2 className="tdx-h2">{t('trail.goodToKnowTitle', 'Good to Know')}</h2>
            <div className="tdx-gtk__row">
              {gtk.map((g, i) => (
                <div className="tdx-gtk__item" key={i}>
                  <g.icon size={20} strokeWidth={1.75} className="tdx-gtk__icon" />
                  <div>
                    <div className="tdx-gtk__label">{g.label}</div>
                    <div className="tdx-gtk__value">{g.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── BENTO GRID ── */}
        <section className="tdx-grid">
          {/* Map & Route */}
          <article className="tdx-card tdx-card--map">
            <h3 className="tdx-card__title"><MapIcon size={15} /> {t('trail.mapRoute', 'Map & Route')}</h3>
            <button className="tdx-mapthumb" onClick={() => hasCoords && setSheet('map')} disabled={!hasCoords}>
              {mapThumb
                ? <img src={mapThumb} alt="" loading="lazy" />
                : <div className="tdx-mapthumb__empty"><MapIcon size={28} /></div>}
              <span className="tdx-mapthumb__cta">{t('trail.viewMapRoute', 'View Map & Route')} <ChevronRight size={16} /></span>
            </button>
          </article>

          {/* Weather */}
          {hasCoords && (
            <article className="tdx-card tdx-card--weather">
              <h3 className="tdx-card__title"><Sun size={15} /> {t('weather.title', 'Weather')}</h3>
              <WeatherWidget lat={full.coordinates[0][1]} lon={full.coordinates[0][0]} difficulty={full.difficulty} compact />
            </article>
          )}

          {/* Points of interest */}
          {(pois.length > 0 || insights.length > 0) && (
            <article className="tdx-card tdx-card--rail">
              <div className="tdx-card__head">
                <h3 className="tdx-card__title"><MapPin size={15} /> {t('trail.pointsOfInterest', 'Points of Interest')}</h3>
                {pois.length > 3 && <button className="tdx-seeall" onClick={() => setSheet('pois')}>{t('trail.seeAll', 'See all')} ({pois.length})</button>}
              </div>
              <div className="tdx-rail">
                {pois.slice(0, 6).map((p, i) => {
                  const Icon = poiIcon(p.type);
                  return (
                    <div className="tdx-poi" key={i}>
                      <div className="tdx-poi__tile"><Icon size={22} strokeWidth={1.75} /></div>
                      <div className="tdx-poi__name">{p.name}</div>
                      {p.type && <div className="tdx-poi__sub">{String(p.type).replace(/_/g, ' ')}</div>}
                    </div>
                  );
                })}
              </div>
            </article>
          )}

          {/* Gallery */}
          {hasGallery && (
            <article className="tdx-card tdx-card--rail">
              <div className="tdx-card__head">
                <h3 className="tdx-card__title"><ImageIcon size={15} /> {t('trail.gallery', 'Gallery')}</h3>
                <button className="tdx-seeall" onClick={() => setSheet('gallery')}>{t('trail.seeAll', 'See all')} ({gallery.length})</button>
              </div>
              <div className="tdx-rail">
                {gallery.slice(0, 6).map((g, i) => (
                  <button className="tdx-shot" key={i} onClick={() => setSheet('gallery')}>
                    <img src={g.card || g.thumb || g.hero} alt={g.alt || ''} loading="lazy" onError={onImgError} />
                  </button>
                ))}
              </div>
            </article>
          )}

          {/* Dog notes */}
          {full.dog_friendly && (
            <article className="tdx-card tdx-card--dog">
              <h3 className="tdx-card__title"><Dog size={15} /> {t('trail.dogNotes', 'Dog Notes')}</h3>
              <p className="tdx-dog__text">{full.dog_note || t('trail.dogGeneric', 'This trail is dog friendly. Keep dogs on a leash around livestock and grazed areas.')}</p>
            </article>
          )}

          {/* Reviews */}
          <article className="tdx-card tdx-card--reviews">
            <div className="tdx-card__head">
              <h3 className="tdx-card__title"><Star size={15} /> {t('trail.userReviews', 'User Reviews')}</h3>
              <button className="tdx-seeall" onClick={() => setSheet('reviews')}>{t('trail.seeAll', 'See all')}</button>
            </div>
            <button className="tdx-reviews__peek" onClick={() => setSheet('reviews')}>
              {full.rating != null
                ? <span className="tdx-reviews__score"><Star size={18} fill="currentColor" strokeWidth={0} /> {full.rating}</span>
                : <span className="tdx-reviews__score tdx-reviews__score--muted">{t('trail.noRatingYet', 'No ratings yet')}</span>}
              <span className="tdx-reviews__cta">{t('trail.readReviews', 'Read & write reviews')} <ChevronRight size={15} /></span>
            </button>
          </article>

          {/* Itinerary PDF */}
          <article className={`tdx-card tdx-card--itin${itineraryFull ? ' tdx-card--full' : ''}`}>
            <ItineraryDownload trail={full} />
          </article>
        </section>
      </div>

      {/* ── Mobile sticky action bar ── */}
      <div className="tdx-stickybar">
        {ENABLE_HIKE_TRACKING && (
          <button className="tdx-btn tdx-btn--primary tdx-btn--block" onClick={startHike}>
            <Footprints size={18} strokeWidth={2} /> {t('trail.startHike', 'Start this Hike')}
          </button>
        )}
        <button className={`tdx-btn tdx-btn--ghost${isSaved ? ' is-saved' : ''}`} onClick={toggleSave} aria-label={t('recommendations.saveTrail', 'Save')}>
          <Heart size={18} strokeWidth={2} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
        <button className="tdx-btn tdx-btn--ghost" onClick={share} aria-label={t('trail.share', 'Share')}>
          <Share2 size={18} strokeWidth={2} />
        </button>
      </div>

      {/* ── OVERLAY SHEETS ── */}
      <Sheet isOpen={sheet === 'map'} onClose={() => setSheet(null)} ariaLabel={t('trail.mapRoute', 'Map & Route')}>
        <div className="tdx-sheet">
          <SheetHead title={t('trail.mapRoute', 'Map & Route')} onClose={() => setSheet(null)} />
          <div className="tdx-sheet__body">
            <div className="tdx-sheet__map">{hasCoords && <TrailMap trail={full} drivingRoute={drivingRoute} />}</div>
            {hasCoords && <ElevationProfile trail={full} />}
            <TrailheadDirections trail={full} onRoute={setDrivingRoute} />
            <OfflineDownload trail={full} />
          </div>
        </div>
      </Sheet>

      <Sheet isOpen={sheet === 'pois'} onClose={() => setSheet(null)} ariaLabel={t('trail.pointsOfInterest', 'Points of Interest')}>
        <div className="tdx-sheet">
          <SheetHead title={t('trail.pointsOfInterest', 'Points of Interest')} onClose={() => setSheet(null)} />
          <div className="tdx-sheet__body">
            <ul className="tdx-poilist">
              {pois.map((p, i) => {
                const Icon = poiIcon(p.type);
                return (
                  <li className="tdx-poilist__item" key={i}>
                    <div className="tdx-poi__tile"><Icon size={20} strokeWidth={1.75} /></div>
                    <div>
                      <div className="tdx-poi__name">{p.name}</div>
                      {p.type && <div className="tdx-poi__sub">{String(p.type).replace(/_/g, ' ')}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {insights.length > 0 && (
              <div className="tdx-insights">
                <h4 className="tdx-insights__title">{t('trail.localSecretsTitle', 'Local notes')}</h4>
                <ul>{insights.map((ins) => <li key={ins.id}>{ins.text}</li>)}</ul>
              </div>
            )}
          </div>
        </div>
      </Sheet>

      <Sheet isOpen={sheet === 'gallery'} onClose={() => setSheet(null)} ariaLabel={t('trail.gallery', 'Gallery')}>
        <div className="tdx-sheet">
          <SheetHead title={t('trail.gallery', 'Gallery')} onClose={() => setSheet(null)} />
          <div className="tdx-sheet__body"><MediaGallery trail={full} /></div>
        </div>
      </Sheet>

      <Sheet isOpen={sheet === 'reviews'} onClose={() => setSheet(null)} ariaLabel={t('trail.userReviews', 'User Reviews')}>
        <div className="tdx-sheet">
          <SheetHead title={t('trail.userReviews', 'User Reviews')} onClose={() => setSheet(null)} />
          <div className="tdx-sheet__body"><ReviewsSection trailId={full.id} onShowLogin={onShowLogin} /></div>
        </div>
      </Sheet>

      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        onLogin={() => onShowLogin?.()}
        message={t('trail.signInToSave', 'Sign in to save and track your hikes.')}
      />
    </div>
  );
}

function Stat({ icon: Icon, value, label, valueColor }) {
  return (
    <div className="tdx-stat">
      <Icon size={24} strokeWidth={1.75} className="tdx-stat__icon" />
      <div className="tdx-stat__text">
        <div className="tdx-stat__value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
        <div className="tdx-stat__label">{label}</div>
      </div>
    </div>
  );
}

function SheetHead({ title, onClose }) {
  return (
    <div className="tdx-sheet__head">
      <h3>{title}</h3>
      <button className="tdx-sheet__close" onClick={onClose} aria-label="Close"><X size={20} strokeWidth={2} /></button>
    </div>
  );
}

export default TrailDetailV2;
