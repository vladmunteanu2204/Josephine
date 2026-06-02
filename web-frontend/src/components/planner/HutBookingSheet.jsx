import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

// Match RifugioDetail's base so booking reaches the backend in dev too.
const API_URL = import.meta.env.PROD
  ? '/api'
  : `${window.location.protocol}//${window.location.hostname}:8000/api`;

/* Reusable hut booking-inquiry modal. Used by RifugioDetail and the
   hut-to-hut planner. Calls POST /api/booking-inquiries and returns the
   created inquiry_id via onSubmitted so callers can track booking status. */
export default function HutBookingSheet({ rifugioId, rifugioName, prefill = {}, onClose, onSubmitted }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: prefill.name || '',
    email: prefill.email || '',
    phone: prefill.phone || '',
    check_in: prefill.check_in || '',
    check_out: prefill.check_out || '',
    adults: prefill.adults || 2,
    children: prefill.children || 0,
    meal_preference: 'half_board',
    special_requests: '',
    dogs: false,
    contact_method: 'email',
  });

  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.check_in || !form.check_out) {
      toast.warning(t('rifugio.bookingDateRequired', 'Please pick check-in and check-out dates.'));
      return;
    }
    if (!rifugioId) {
      toast.error(t('planner.bookingUnavailable', 'Booking is not available for this hut.'));
      return;
    }
    try {
      setSubmitting(true);
      const res = await axios.post(`${API_URL}/booking-inquiries`, {
        rifugio_id: rifugioId,
        rifugio_name: rifugioName,
        ...form,
      });
      const inquiryId = res.data?.inquiry_id || null;
      toast.success(t('rifugio.bookingSuccess', 'Your booking inquiry was sent!'));
      onSubmitted?.(inquiryId);
      onClose?.();
    } catch (err) {
      console.error('Booking inquiry failed:', err);
      toast.error(t('rifugio.bookingError', 'Could not send the inquiry. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rd-modal-overlay" onClick={onClose}>
      <div className="rd-modal" onClick={e => e.stopPropagation()}>
        <div className="rd-modal__header">
          <h2>{t('rifugio.bookingInquiry', 'Booking inquiry')}{rifugioName ? ` — ${rifugioName}` : ''}</h2>
          <button className="rd-modal__close" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <form onSubmit={submit} className="rd-booking-form">
          <div className="rd-form-row">
            <div className="rd-form-group">
              <label>{t('rifugio.name', 'Name')} *</label>
              <input type="text" required value={form.name} onChange={e => set({ name: e.target.value })} />
            </div>
            <div className="rd-form-group">
              <label>{t('rifugio.email', 'Email')} *</label>
              <input type="email" required value={form.email} onChange={e => set({ email: e.target.value })} />
            </div>
          </div>
          <div className="rd-form-group">
            <label>{t('rifugio.phone', 'Phone')}</label>
            <input type="tel" value={form.phone} onChange={e => set({ phone: e.target.value })} />
          </div>
          <div className="rd-form-row">
            <div className="rd-form-group">
              <label>{t('rifugio.checkIn', 'Check-in')} *</label>
              <input type="date" required value={form.check_in} onChange={e => set({ check_in: e.target.value })} />
            </div>
            <div className="rd-form-group">
              <label>{t('rifugio.checkOut', 'Check-out')} *</label>
              <input type="date" required value={form.check_out} min={form.check_in} onChange={e => set({ check_out: e.target.value })} />
            </div>
          </div>
          <div className="rd-form-row">
            <div className="rd-form-group">
              <label>{t('rifugio.adults', 'Adults')} *</label>
              <input type="number" min="1" max="20" required value={form.adults} onChange={e => set({ adults: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="rd-form-group">
              <label>{t('rifugio.children', 'Children')}</label>
              <input type="number" min="0" max="10" value={form.children} onChange={e => set({ children: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="rd-form-group">
            <label>{t('rifugio.mealPreference', 'Meal preference')}</label>
            <select value={form.meal_preference} onChange={e => set({ meal_preference: e.target.value })}>
              <option value="half_board">{t('rifugio.halfBoard', 'Half board')}</option>
              <option value="breakfast">{t('rifugio.breakfast', 'Breakfast')}</option>
              <option value="dinner">{t('rifugio.dinner', 'Dinner')}</option>
              <option value="none">{t('rifugio.noMeals', 'No meals')}</option>
            </select>
          </div>
          <div className="rd-form-group">
            <label>{t('rifugio.specialRequests', 'Special requests')}</label>
            <textarea rows="3" value={form.special_requests}
              onChange={e => set({ special_requests: e.target.value })}
              placeholder={t('rifugio.specialRequestsPlaceholder', 'Dietary needs, group details…')} />
          </div>
          <div className="rd-form-checkbox">
            <input type="checkbox" id="hbs-dogs" checked={form.dogs} onChange={e => set({ dogs: e.target.checked })} />
            <label htmlFor="hbs-dogs">{t('rifugio.bringingDogs', "I'm bringing a dog")}</label>
          </div>
          <button type="submit" className="rd-submit-btn" disabled={submitting}>
            {submitting ? t('common.loading', 'Sending…') : t('rifugio.submitInquiry', 'Send inquiry')}
          </button>
        </form>
      </div>
    </div>
  );
}
