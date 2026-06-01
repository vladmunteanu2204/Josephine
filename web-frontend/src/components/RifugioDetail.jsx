import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { trailImg } from '../utils/trailImage';
import './RifugioDetail.css';

const API_URL = import.meta.env.PROD 
  ? '/api' 
  : `${window.location.protocol}//${window.location.hostname}:8000/api`;

function RifugioDetail({ rifugioId, onNavigate }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [rifugio, setRifugio] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const loadRifugio = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/rifugios/${rifugioId}`);
      const rif = response.data;
      setRifugio(rif);
      // Load nearby trails if IDs are provided
      if (rif.nearby_trails?.length > 0) {
        axios.get(`${API_URL}/trails`).then(r => {
          const ids = new Set(rif.nearby_trails);
          setNearbyTrails((r.data.trails || []).filter(t => ids.has(t.id)));
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error loading rifugio:', error);
    } finally {
      setLoading(false);
    }
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
      
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 5000);
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
        return { icon: '🟢', text: t('rifugio.statusOpen'), class: 'status-open' };
      case 'closed':
        return { icon: '🔴', text: t('rifugio.statusClosed'), class: 'status-closed' };
      case 'opening_soon':
        return { icon: '🟡', text: t('rifugio.statusOpeningSoon'), class: 'status-opening-soon' };
      default:
        return { icon: '⚪', text: t('rifugio.statusSeasonal'), class: 'status-seasonal' };
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      rifugio: t('rifugio.typeRifugio'),
      malga: t('rifugio.typeMalga'),
      bivacco: t('rifugio.typeBivacco')
    };
    return labels[type] || type;
  };

  if (loading) {
    return <div className="rifugio-detail-loading">{t('common.loading')}</div>;
  }

  if (!rifugio) {
    return <div className="rifugio-detail-error">{t('rifugio.notFound')}</div>;
  }

  const status = getStatusBadge(rifugio.status);

  return (
    <div className="rifugio-detail-page">
      {/* Hero Section */}
      <div className="rifugio-hero">
        <img
          src={rifugio.photos?.[0] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200'}
          alt={rifugio.name}
          className="hero-image"
        />
        <div className="hero-overlay"></div>
        <button className="back-button-hero" onClick={() => onNavigate('rifugios')}>
          ← {t('common.back')}
        </button>
        <div className="hero-content">
          <h1 className="rifugio-title">{rifugio.name}</h1>
          <div className={`status-badge-large ${status.class}`}>
            {status.icon} {status.text}
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="quick-stats-bar">
        <div className="stat-item">
          <div className="stat-icon">⛰️</div>
          <div className="stat-info">
            <div className="stat-value">{rifugio.altitude}m</div>
            <div className="stat-label">{t('rifugio.altitude')}</div>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon">📍</div>
          <div className="stat-info">
            <div className="stat-value">{rifugio.region}</div>
            <div className="stat-label">{t('rifugio.region')}</div>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon">🏔️</div>
          <div className="stat-info">
            <div className="stat-value">{getTypeLabel(rifugio.type)}</div>
            <div className="stat-label">{t('rifugio.type')}</div>
          </div>
        </div>
        {rifugio.facilities?.beds > 0 && (
          <div className="stat-item">
            <div className="stat-icon">🛏️</div>
            <div className="stat-info">
              <div className="stat-value">{rifugio.facilities.beds}</div>
              <div className="stat-label">{t('rifugio.beds')}</div>
            </div>
          </div>
        )}
      </div>

      <div className="rifugio-content-container">
        {/* Main Content */}
        <div className="rifugio-main-content">
          {/* Success Message */}
          {submitSuccess && (
            <div className="booking-success-alert">
              ✅ {t('rifugio.bookingSuccess')}
            </div>
          )}

          {/* About Section */}
          <section className="content-section">
            <h2 className="section-title">{t('rifugio.about')}</h2>
            <p className="rifugio-description">{rifugio.description}</p>
          </section>

          {/* Access Information */}
          {rifugio.access_info && (
            <section className="content-section">
              <h2 className="section-title">{t('rifugio.accessInfo')}</h2>
              <p className="rifugio-description">{rifugio.access_info}</p>
            </section>
          )}

          {/* Facilities */}
          <section className="content-section">
            <h2 className="section-title">{t('rifugio.facilities')}</h2>
            <div className="facilities-grid">
              {rifugio.facilities?.beds > 0 && (
                <div className="facility-item">
                  <span className="facility-icon">🛏️</span>
                  <span>{rifugio.facilities.beds} {t('rifugio.beds')}</span>
                </div>
              )}
              {rifugio.facilities?.meals && (
                <div className="facility-item">
                  <span className="facility-icon">🍽️</span>
                  <span>{t('rifugio.meals')}</span>
                </div>
              )}
              {rifugio.facilities?.showers && (
                <div className="facility-item">
                  <span className="facility-icon">🚿</span>
                  <span>{t('rifugio.showers')}</span>
                </div>
              )}
              {rifugio.facilities?.wifi && (
                <div className="facility-item">
                  <span className="facility-icon">📶</span>
                  <span>{t('rifugio.wifi')}</span>
                </div>
              )}
              {rifugio.facilities?.dogs && (
                <div className="facility-item">
                  <span className="facility-icon">🐕</span>
                  <span>{t('rifugio.dogs')}</span>
                </div>
              )}
              {rifugio.facilities?.payment_methods && rifugio.facilities.payment_methods.length > 0 && (
                <div className="facility-item">
                  <span className="facility-icon">💳</span>
                  <span>{rifugio.facilities.payment_methods.join(', ')}</span>
                </div>
              )}
            </div>
          </section>

          {/* Photo Gallery */}
          {rifugio.photos && rifugio.photos.length > 1 && (
            <section className="content-section">
              <h2 className="section-title">{t('rifugio.gallery')}</h2>
              <div className="photo-gallery-grid">
                {rifugio.photos.slice(1).map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`${rifugio.name} ${index + 1}`}
                    className="gallery-photo"
                    loading="lazy"
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="rifugio-sidebar">
          {/* Opening Season */}
          {rifugio.opening_season && rifugio.opening_season.start_date && (
            <div className="sidebar-card">
              <h3 className="sidebar-title">{t('rifugio.openingSeason')}</h3>
              <div className="season-dates">
                <div className="season-date-item">
                  <span className="date-label">{t('rifugio.opens')}</span>
                  <span className="date-value">{rifugio.opening_season.start_date}</span>
                </div>
                <div className="season-date-item">
                  <span className="date-label">{t('rifugio.closes')}</span>
                  <span className="date-value">{rifugio.opening_season.end_date}</span>
                </div>
              </div>
            </div>
          )}

          {/* Pricing */}
          {rifugio.prices && Object.keys(rifugio.prices).some(k => rifugio.prices[k] > 0) && (
            <div className="sidebar-card">
              <h3 className="sidebar-title">{t('rifugio.pricing')}</h3>
              <div className="pricing-list">
                {rifugio.prices.overnight > 0 && (
                  <div className="price-item">
                    <span>{t('rifugio.overnight')}</span>
                    <span className="price">€{rifugio.prices.overnight}</span>
                  </div>
                )}
                {rifugio.prices.breakfast > 0 && (
                  <div className="price-item">
                    <span>{t('rifugio.breakfast')}</span>
                    <span className="price">€{rifugio.prices.breakfast}</span>
                  </div>
                )}
                {rifugio.prices.dinner > 0 && (
                  <div className="price-item">
                    <span>{t('rifugio.dinner')}</span>
                    <span className="price">€{rifugio.prices.dinner}</span>
                  </div>
                )}
                {rifugio.prices.half_board > 0 && (
                  <div className="price-item">
                    <span>{t('rifugio.halfBoard')}</span>
                    <span className="price">€{rifugio.prices.half_board}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact */}
          {rifugio.contact && (
            <div className="sidebar-card">
              <h3 className="sidebar-title">{t('rifugio.contact')}</h3>
              <div className="contact-list">
                {rifugio.contact.phone && (
                  <a href={`tel:${rifugio.contact.phone}`} className="contact-item">
                    📞 {rifugio.contact.phone}
                  </a>
                )}
                {rifugio.contact.email && (
                  <a href={`mailto:${rifugio.contact.email}`} className="contact-item">
                    ✉️ {rifugio.contact.email}
                  </a>
                )}
                {rifugio.contact.website && (
                  <a href={rifugio.contact.website} target="_blank" rel="noopener noreferrer" className="contact-item">
                    🌐 {t('rifugio.website')}
                  </a>
                )}
                {rifugio.contact.whatsapp && (
                  <a href={`https://wa.me/${rifugio.contact.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="contact-item">
                    💬 WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Booking Button */}
          {rifugio.facilities?.beds > 0 && (
            <button
              className="booking-cta-btn"
              onClick={() => setShowBookingForm(!showBookingForm)}
            >
              📅 {t('rifugio.bookingInquiry')}
            </button>
          )}
        </aside>
      </div>

      {/* Booking Inquiry Form Modal */}
      {showBookingForm && (
        <div className="booking-modal-overlay" onClick={() => setShowBookingForm(false)}>
          <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="booking-modal-header">
              <h2>{t('rifugio.bookingInquiry')}</h2>
              <button className="modal-close-btn" onClick={() => setShowBookingForm(false)}>×</button>
            </div>

            <form onSubmit={handleBookingSubmit} className="booking-form">
              <div className="form-row">
                <div className="form-group">
                  <label>{t('rifugio.name')} *</label>
                  <input
                    type="text"
                    required
                    value={bookingForm.name}
                    onChange={(e) => setBookingForm({...bookingForm, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>{t('rifugio.email')} *</label>
                  <input
                    type="email"
                    required
                    value={bookingForm.email}
                    onChange={(e) => setBookingForm({...bookingForm, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t('rifugio.phone')}</label>
                <input
                  type="tel"
                  value={bookingForm.phone}
                  onChange={(e) => setBookingForm({...bookingForm, phone: e.target.value})}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('rifugio.checkIn')} *</label>
                  <input
                    type="date"
                    required
                    value={bookingForm.check_in}
                    onChange={(e) => setBookingForm({...bookingForm, check_in: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>{t('rifugio.checkOut')} *</label>
                  <input
                    type="date"
                    required
                    value={bookingForm.check_out}
                    onChange={(e) => setBookingForm({...bookingForm, check_out: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('rifugio.adults')} *</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={bookingForm.adults}
                    onChange={(e) => setBookingForm({...bookingForm, adults: parseInt(e.target.value)})}
                  />
                </div>
                <div className="form-group">
                  <label>{t('rifugio.children')}</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={bookingForm.children}
                    onChange={(e) => setBookingForm({...bookingForm, children: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t('rifugio.mealPreference')}</label>
                <select
                  value={bookingForm.meal_preference}
                  onChange={(e) => setBookingForm({...bookingForm, meal_preference: e.target.value})}
                >
                  <option value="half_board">{t('rifugio.halfBoard')}</option>
                  <option value="breakfast">{t('rifugio.breakfast')}</option>
                  <option value="dinner">{t('rifugio.dinner')}</option>
                  <option value="none">{t('rifugio.noMeals')}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t('rifugio.specialRequests')}</label>
                <textarea
                  rows="3"
                  value={bookingForm.special_requests}
                  onChange={(e) => setBookingForm({...bookingForm, special_requests: e.target.value})}
                  placeholder={t('rifugio.specialRequestsPlaceholder')}
                />
              </div>

              <div className="form-checkbox">
                <input
                  type="checkbox"
                  id="dogs"
                  checked={bookingForm.dogs}
                  onChange={(e) => setBookingForm({...bookingForm, dogs: e.target.checked})}
                />
                <label htmlFor="dogs">{t('rifugio.bringingDogs')}</label>
              </div>

              <button type="submit" className="booking-submit-btn" disabled={submitting}>
                {submitting ? t('common.loading') : t('rifugio.submitInquiry')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Nearby Trails ── */}
      {nearbyTrails.length > 0 && (
        <div className="rif-nearby-trails">
          <div className="container">
            <h3 className="rif-nearby-trails__title">Trails from this hut</h3>
            <div className="rif-nearby-trails__scroll">
              {nearbyTrails.map(trail => (
                <button
                  key={trail.id}
                  className="rif-trail-card"
                  onClick={() => onNavigate('detail', trail.id)}
                >
                  <div className="rif-trail-card__img-wrap">
                    <img
                      src={trailImg(trail, 'thumb')}
                      alt={trail.name}
                      className="rif-trail-card__img"
                    />
                  </div>
                  <div className="rif-trail-card__body">
                    <p className="rif-trail-card__region">{trail.region}</p>
                    <p className="rif-trail-card__name">{trail.name}</p>
                    <p className="rif-trail-card__meta">
                      {trail.distance_km} km · {trail.duration_hours}h · {trail.difficulty}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RifugioDetail;
