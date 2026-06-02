import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import axios from 'axios';
import { trailImg } from '../utils/trailImage';
import WeatherWidget from './WeatherWidget';
import ReviewsSection from './ReviewsSection';
import './RifugioDetail.css';

const API_URL = import.meta.env.PROD
  ? '/api'
  : `${window.location.protocol}//${window.location.hostname}:8000/api`;

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function RifugioDetail({ rifugioId, onNavigate, onShowLogin }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const toast = useToast();
  const [rifugio, setRifugio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    name: '',
    email: '',
    phone: '',
    check_in: '',
    check_out: '',
    adults: 2,
    children: 0,
    meal_preference: 'half_board',
    special_requests: '',
    dogs: false,
    contact_method: 'email'
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [nearbyTrails, setNearbyTrails] = useState([]);

  useEffect(() => {
    loadRifugio();
  }, [rifugioId]);

  useEffect(() => {
    if (currentUser) {
      setBookingForm(prev => ({
        ...prev,
        name: currentUser.displayName || '',
        email: currentUser.email || ''
      }));
    }
  }, [currentUser]);

  useEffect(() => {
    if (rifugioId) {
      const saved = JSON.parse(localStorage.getItem('savedRifugios') || '[]');
      setIsSaved(saved.includes(rifugioId));
    }
  }, [rifugioId]);

  const loadRifugio = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/rifugios/${rifugioId}`);
      setRifugio(response.data);
      // Load nearby trails from dedicated endpoint (haversine-based, no manual IDs)
      axios.get(`${API_URL}/rifugios/${rifugioId}/nearby-trails`)
        .then(r => setNearbyTrails(r.data.trails || []))
        .catch(() => {});
    } catch (error) {
      console.error('Error loading rifugio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToggle = () => {
    const saved = JSON.parse(localStorage.getItem('savedRifugios') || '[]');
    let next;
    if (isSaved) {
      next = saved.filter(id => id !== rifugioId);
      toast.info('Hut removed from saved');
    } else {
      next = [...saved, rifugioId];
      toast.success('Hut saved!');
    }
    localStorage.setItem('savedRifugios', JSON.stringify(next));
    setIsSaved(!isSaved);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!bookingForm.check_in || !bookingForm.check_out) {
      alert(t('rifugio.bookingDateRequired'));
      return;
    }
    try {
      setSubmitting(true);
      await axios.post(`${API_URL}/booking-inquiries`, {
        rifugio_id: rifugio.id,
        rifugio_name: rifugio.name,
        ...bookingForm
      });
      setSubmitSuccess(true);
      setShowBookingForm(false);
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (error) {
      console.error('Error submitting booking inquiry:', error);
      alert(t('rifugio.bookingError'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return { dot: 'status-dot--open', text: t('rifugio.statusOpen') || 'Open' };
      case 'opening_soon':
        return { dot: 'status-dot--soon', text: t('rifugio.statusOpeningSoon') || 'Opening soon' };
      case 'closed':
        return { dot: 'status-dot--closed', text: t('rifugio.statusClosed') || 'Closed for season' };
      default:
        return { dot: 'status-dot--closed', text: t('rifugio.statusSeasonal') || 'Seasonal' };
    }
  };

  const getTypeLabel = (type) => {
    const labels = { rifugio: 'Rifugio', malga: 'Malga', bivacco: 'Bivacco' };
    return labels[type] || type;
  };

  if (loading) {
    return <div className="rd-loading">{t('common.loading')}</div>;
  }
  if (!rifugio) {
    return <div className="rd-error">{t('rifugio.notFound')}</div>;
  }

  const status = getStatusBadge(rifugio.current_status);
  const coords = rifugio.coordinates;
  const lat = coords?.lat;
  const lon = coords?.lng;

  return (
    <div className="rd-page">

      {/* ── Hero ── */}
      <div className="rd-hero">
        <img
          src={rifugio.photos?.[0] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200'}
          alt={rifugio.name}
          className="rd-hero__img"
        />
        <div className="rd-hero__overlay" />

        {/* Controls row */}
        <div className="rd-hero__controls">
          <button className="rd-back-btn" onClick={() => onNavigate('rifugios')} aria-label="Back">
            ←
          </button>
          <button
            className={`rd-save-btn${isSaved ? ' rd-save-btn--saved' : ''}`}
            onClick={handleSaveToggle}
            aria-label={isSaved ? 'Unsave' : 'Save'}
          >
            {isSaved ? '♥' : '♡'}
          </button>
        </div>

        {/* Title */}
        <div className="rd-hero__content">
          <h1 className="rd-hero__title">{rifugio.name}</h1>
          <div className="rd-hero__status">
            <span className={`rd-status-dot ${status.dot}`} />
            <span>{status.text}</span>
          </div>
        </div>
      </div>

      {/* ── Stat strip ── */}
      <div className="rd-stats">
        <div className="rd-stat">
          <span className="rd-stat__icon">⛰</span>
          <span className="rd-stat__value">{rifugio.altitude}m</span>
          <span className="rd-stat__label">altitude</span>
        </div>
        <div className="rd-stat rd-stat--divider" />
        <div className="rd-stat">
          <span className="rd-stat__icon">📍</span>
          <span className="rd-stat__value rd-stat__value--region">{rifugio.region}</span>
          <span className="rd-stat__label">region</span>
        </div>
        <div className="rd-stat rd-stat--divider" />
        <div className="rd-stat">
          <span className="rd-stat__icon">🏔</span>
          <span className="rd-stat__value">{getTypeLabel(rifugio.type)}</span>
          <span className="rd-stat__label">type</span>
        </div>
        {rifugio.facilities?.beds > 0 && (
          <>
            <div className="rd-stat rd-stat--divider" />
            <div className="rd-stat">
              <span className="rd-stat__icon">🛏</span>
              <span className="rd-stat__value">{rifugio.facilities.beds}</span>
              <span className="rd-stat__label">beds</span>
            </div>
          </>
        )}
      </div>

      {/* ── Main content + sidebar ── */}
      <div className="rd-body">
        <div className="rd-main">

          {submitSuccess && (
            <div className="rd-success-alert">✅ {t('rifugio.bookingSuccess')}</div>
          )}

          {/* About */}
          <section className="rd-section">
            <h2 className="rd-section__title">{t('rifugio.about')}</h2>
            <p className="rd-prose">{rifugio.description}</p>
          </section>

          {/* Highlights */}
          {rifugio.highlights?.length > 0 && (
            <section className="rd-section">
              <h2 className="rd-section__title">Highlights</h2>
              <ul className="rd-highlights">
                {rifugio.highlights.map((h, i) => (
                  <li key={i} className="rd-highlight-item">
                    <span className="rd-highlight-dot">✦</span>
                    {h}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Josephine's Note */}
          {rifugio.josephine_note && (
            <div className="rd-josephine-note">
              <img src="/josephine-portrait.webp" alt="Josephine" className="rd-josephine-note__portrait" />
              <div className="rd-josephine-note__body">
                <p className="rd-josephine-note__label">Josephine's tip</p>
                <p className="rd-josephine-note__text">"{rifugio.josephine_note}"</p>
              </div>
            </div>
          )}

          {/* Access */}
          {rifugio.access_info && (
            <section className="rd-section">
              <h2 className="rd-section__title">{t('rifugio.accessInfo')}</h2>
              <p className="rd-prose">{rifugio.access_info}</p>
            </section>
          )}

          {/* Weather */}
          {lat && lon && (
            <section className="rd-section">
              <h2 className="rd-section__title">Weather at {rifugio.altitude}m</h2>
              <WeatherWidget lat={lat} lon={lon} />
            </section>
          )}

          {/* Facilities */}
          <section className="rd-section">
            <h2 className="rd-section__title">{t('rifugio.facilities')}</h2>
            <div className="rd-facilities">
              {rifugio.facilities?.beds > 0 && (
                <div className="rd-facility">🛏 {rifugio.facilities.beds} {t('rifugio.beds')}</div>
              )}
              {rifugio.facilities?.meals && (
                <div className="rd-facility">🍽 {t('rifugio.meals')}</div>
              )}
              {rifugio.facilities?.showers && (
                <div className="rd-facility">🚿 {t('rifugio.showers')}</div>
              )}
              {rifugio.facilities?.wifi && (
                <div className="rd-facility">📶 {t('rifugio.wifi')}</div>
              )}
              {rifugio.facilities?.dogs && (
                <div className="rd-facility">🐕 {t('rifugio.dogs')}</div>
              )}
              {rifugio.facilities?.payment_methods?.length > 0 && (
                <div className="rd-facility">💳 {rifugio.facilities.payment_methods.join(', ')}</div>
              )}
            </div>
          </section>

          {/* Gallery */}
          {rifugio.photos?.length > 1 && (
            <section className="rd-section">
              <h2 className="rd-section__title">{t('rifugio.gallery')}</h2>
              <div className="rd-gallery">
                {rifugio.photos.slice(1).map((photo, i) => (
                  <img key={i} src={photo} alt={`${rifugio.name} ${i + 1}`} className="rd-gallery__img" loading="lazy" />
                ))}
              </div>
            </section>
          )}

          {/* Reviews */}
          <section className="rd-section">
            <ReviewsSection rifugioId={rifugioId} onShowLogin={onShowLogin} />
          </section>
        </div>

        {/* ── Sidebar ── */}
        <aside className="rd-sidebar">

          {/* Opening season */}
          {rifugio.opening_season?.start_date && (
            <div className="rd-sidebar-card">
              <h3 className="rd-sidebar-card__title">{t('rifugio.openingSeason')}</h3>
              <div className="rd-season-dates">
                <span className="rd-season-label">{t('rifugio.opens')}</span>
                <span className="rd-season-value">{formatDate(rifugio.opening_season.start_date)}</span>
              </div>
              <div className="rd-season-dates">
                <span className="rd-season-label">{t('rifugio.closes')}</span>
                <span className="rd-season-value">{formatDate(rifugio.opening_season.end_date)}</span>
              </div>
              {rifugio.booking_note && (
                <p className="rd-booking-note">{rifugio.booking_note}</p>
              )}
            </div>
          )}

          {/* Pricing */}
          {rifugio.prices && Object.values(rifugio.prices).some(v => v > 0) && (
            <div className="rd-sidebar-card">
              <h3 className="rd-sidebar-card__title">{t('rifugio.pricing')}</h3>
              <div className="rd-prices">
                {rifugio.prices.overnight > 0 && (
                  <div className="rd-price-row">
                    <span>{t('rifugio.overnight')}</span>
                    <span className="rd-price">€{rifugio.prices.overnight}</span>
                  </div>
                )}
                {rifugio.prices.breakfast > 0 && (
                  <div className="rd-price-row">
                    <span>{t('rifugio.breakfast')}</span>
                    <span className="rd-price">€{rifugio.prices.breakfast}</span>
                  </div>
                )}
                {rifugio.prices.dinner > 0 && (
                  <div className="rd-price-row">
                    <span>{t('rifugio.dinner')}</span>
                    <span className="rd-price">€{rifugio.prices.dinner}</span>
                  </div>
                )}
                {rifugio.prices.half_board > 0 && (
                  <div className="rd-price-row">
                    <span>{t('rifugio.halfBoard')}</span>
                    <span className="rd-price">€{rifugio.prices.half_board}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact */}
          {rifugio.contact && (
            <div className="rd-sidebar-card">
              <h3 className="rd-sidebar-card__title">{t('rifugio.contact')}</h3>
              <div className="rd-contacts">
                {rifugio.contact.phone && (
                  <a href={`tel:${rifugio.contact.phone}`} className="rd-contact">
                    📞 {rifugio.contact.phone}
                  </a>
                )}
                {rifugio.contact.email && (
                  <a href={`mailto:${rifugio.contact.email}`} className="rd-contact">
                    ✉️ {rifugio.contact.email}
                  </a>
                )}
                {rifugio.contact.website && (
                  <a href={rifugio.contact.website} target="_blank" rel="noopener noreferrer" className="rd-contact">
                    🌐 {t('rifugio.website')}
                  </a>
                )}
                {rifugio.contact.whatsapp && (
                  <a
                    href={`https://wa.me/${rifugio.contact.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="rd-contact"
                  >
                    💬 WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Nearby Trails ── */}
      {nearbyTrails.length > 0 && (
        <div className="rd-nearby">
          <h3 className="rd-nearby__title">Trails from this hut</h3>
          <div className="rd-nearby__scroll">
            {nearbyTrails.map(trail => (
              <button
                key={trail.id}
                className="rd-trail-card"
                onClick={() => onNavigate('detail', trail.id)}
              >
                <div className="rd-trail-card__img-wrap">
                  <img src={trailImg(trail, 'thumb')} alt={trail.name} className="rd-trail-card__img" />
                </div>
                <div className="rd-trail-card__body">
                  <p className="rd-trail-card__region">{trail.region}</p>
                  <p className="rd-trail-card__name">{trail.name}</p>
                  <p className="rd-trail-card__meta">
                    {trail.distance_km} km · {trail.duration_hours}h · {trail.difficulty}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Booking modal ── */}
      {showBookingForm && (
        <div className="rd-modal-overlay" onClick={() => setShowBookingForm(false)}>
          <div className="rd-modal" onClick={e => e.stopPropagation()}>
            <div className="rd-modal__header">
              <h2>{t('rifugio.bookingInquiry')}</h2>
              <button className="rd-modal__close" onClick={() => setShowBookingForm(false)}>×</button>
            </div>
            <form onSubmit={handleBookingSubmit} className="rd-booking-form">
              <div className="rd-form-row">
                <div className="rd-form-group">
                  <label>{t('rifugio.name')} *</label>
                  <input type="text" required value={bookingForm.name}
                    onChange={e => setBookingForm({...bookingForm, name: e.target.value})} />
                </div>
                <div className="rd-form-group">
                  <label>{t('rifugio.email')} *</label>
                  <input type="email" required value={bookingForm.email}
                    onChange={e => setBookingForm({...bookingForm, email: e.target.value})} />
                </div>
              </div>
              <div className="rd-form-group">
                <label>{t('rifugio.phone')}</label>
                <input type="tel" value={bookingForm.phone}
                  onChange={e => setBookingForm({...bookingForm, phone: e.target.value})} />
              </div>
              <div className="rd-form-row">
                <div className="rd-form-group">
                  <label>{t('rifugio.checkIn')} *</label>
                  <input type="date" required value={bookingForm.check_in}
                    onChange={e => setBookingForm({...bookingForm, check_in: e.target.value})} />
                </div>
                <div className="rd-form-group">
                  <label>{t('rifugio.checkOut')} *</label>
                  <input type="date" required value={bookingForm.check_out}
                    onChange={e => setBookingForm({...bookingForm, check_out: e.target.value})} />
                </div>
              </div>
              <div className="rd-form-row">
                <div className="rd-form-group">
                  <label>{t('rifugio.adults')} *</label>
                  <input type="number" min="1" max="20" required value={bookingForm.adults}
                    onChange={e => setBookingForm({...bookingForm, adults: parseInt(e.target.value)})} />
                </div>
                <div className="rd-form-group">
                  <label>{t('rifugio.children')}</label>
                  <input type="number" min="0" max="10" value={bookingForm.children}
                    onChange={e => setBookingForm({...bookingForm, children: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="rd-form-group">
                <label>{t('rifugio.mealPreference')}</label>
                <select value={bookingForm.meal_preference}
                  onChange={e => setBookingForm({...bookingForm, meal_preference: e.target.value})}>
                  <option value="half_board">{t('rifugio.halfBoard')}</option>
                  <option value="breakfast">{t('rifugio.breakfast')}</option>
                  <option value="dinner">{t('rifugio.dinner')}</option>
                  <option value="none">{t('rifugio.noMeals')}</option>
                </select>
              </div>
              <div className="rd-form-group">
                <label>{t('rifugio.specialRequests')}</label>
                <textarea rows="3" value={bookingForm.special_requests}
                  onChange={e => setBookingForm({...bookingForm, special_requests: e.target.value})}
                  placeholder={t('rifugio.specialRequestsPlaceholder')} />
              </div>
              <div className="rd-form-checkbox">
                <input type="checkbox" id="dogs" checked={bookingForm.dogs}
                  onChange={e => setBookingForm({...bookingForm, dogs: e.target.checked})} />
                <label htmlFor="dogs">{t('rifugio.bringingDogs')}</label>
              </div>
              <button type="submit" className="rd-submit-btn" disabled={submitting}>
                {submitting ? t('common.loading') : t('rifugio.submitInquiry')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RifugioDetail;
