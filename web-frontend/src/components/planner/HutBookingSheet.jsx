import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { X, MessageCircle, Mail, Phone, Copy } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import './HutBookingSheet.css';

// Match RifugioDetail's base so booking reaches the backend in dev too.
const API_URL = import.meta.env.PROD
  ? '/api'
  : `${window.location.protocol}//${window.location.hostname}:8000/api`;

/* Reusable hut booking-inquiry modal. Self-contained styling (works from both
   RifugioDetail and the planner). POSTs to /api/booking-inquiries; the backend
   auto-emails verified huts and returns a `delivery` object. On auto-send we
   close with a success toast; otherwise we show a one-tap fallback panel so the
   hiker sends the inquiry themselves. Always reports inquiry_id via onSubmitted. */
export default function HutBookingSheet({ rifugioId, rifugioName, prefill = {}, onClose, onSubmitted }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);   // delivery object for fallback panel
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
      const delivery = res.data?.delivery || { status: 'fallback' };
      onSubmitted?.(inquiryId);

      if (delivery.status === 'emailed') {
        toast.success(t('rifugio.bookingEmailed', "We've emailed the hut — they'll reply to you directly."));
        onClose?.();
      } else {
        // fallback / failed → show one-tap send options
        setResult(delivery);
      }
    } catch (err) {
      console.error('Booking inquiry failed:', err);
      toast.error(t('rifugio.bookingError', 'Could not send the inquiry. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const copyMessage = () => {
    if (!result?.prefilled_message) return;
    navigator.clipboard.writeText(result.prefilled_message);
    toast.success(t('rifugio.messageCopied', 'Message copied — paste it to the hut.'));
  };

  const waDigits = (result?.hut_whatsapp || '').replace(/[^0-9]/g, '');
  const msg = result?.prefilled_message || '';
  const subject = `${t('rifugio.bookingInquiry', 'Booking inquiry')} — ${rifugioName || ''}`;

  return (
    <div className="hbs-overlay" onClick={onClose}>
      <div className="hbs-modal" onClick={e => e.stopPropagation()}>
        <div className="hbs-header">
          <h2>{t('rifugio.bookingInquiry', 'Booking inquiry')}{rifugioName ? ` — ${rifugioName}` : ''}</h2>
          <button className="hbs-close" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {result ? (
          /* ── Fallback / failed: hiker sends it themselves ── */
          <div className="hbs-outcome">
            <p className="hbs-outcome__intro">
              {result.status === 'failed'
                ? t('rifugio.bookingFailedIntro', "Saved — but we couldn't email the hut automatically. Send it in one tap:")
                : t('rifugio.bookingFallbackIntro', 'Saved! Now send your inquiry to the hut in one tap:')}
            </p>
            <div className="hbs-actions">
              {waDigits && (
                <a className="hbs-action hbs-action--wa" href={`https://wa.me/${waDigits}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={18} strokeWidth={2} /> {t('rifugio.sendViaWhatsApp', 'Send via WhatsApp')}
                </a>
              )}
              {result.hut_email && (
                <a className="hbs-action" href={`mailto:${result.hut_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`}>
                  <Mail size={18} strokeWidth={2} /> {t('rifugio.emailTheHut', 'Email the hut')}
                </a>
              )}
              {result.hut_phone && (
                <a className="hbs-action" href={`tel:${result.hut_phone}`}>
                  <Phone size={18} strokeWidth={2} /> {t('rifugio.callTheHut', 'Call the hut')}
                </a>
              )}
              <button className="hbs-action" onClick={copyMessage}>
                <Copy size={18} strokeWidth={2} /> {t('rifugio.copyMessage', 'Copy message')}
              </button>
            </div>
            <button className="hbs-done" onClick={onClose}>{t('common.close', 'Done')}</button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={submit} className="hbs-form">
            <div className="hbs-row">
              <div className="hbs-group">
                <label>{t('rifugio.name', 'Name')} *</label>
                <input type="text" required value={form.name} onChange={e => set({ name: e.target.value })} />
              </div>
              <div className="hbs-group">
                <label>{t('rifugio.email', 'Email')} *</label>
                <input type="email" required value={form.email} onChange={e => set({ email: e.target.value })} />
              </div>
            </div>
            <div className="hbs-group">
              <label>{t('rifugio.phone', 'Phone')}</label>
              <input type="tel" value={form.phone} onChange={e => set({ phone: e.target.value })} />
            </div>
            <div className="hbs-row">
              <div className="hbs-group">
                <label>{t('rifugio.checkIn', 'Check-in')} *</label>
                <input type="date" required value={form.check_in} onChange={e => set({ check_in: e.target.value })} />
              </div>
              <div className="hbs-group">
                <label>{t('rifugio.checkOut', 'Check-out')} *</label>
                <input type="date" required value={form.check_out} min={form.check_in} onChange={e => set({ check_out: e.target.value })} />
              </div>
            </div>
            <div className="hbs-row">
              <div className="hbs-group">
                <label>{t('rifugio.adults', 'Adults')} *</label>
                <input type="number" min="1" max="20" required value={form.adults} onChange={e => set({ adults: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="hbs-group">
                <label>{t('rifugio.children', 'Children')}</label>
                <input type="number" min="0" max="10" value={form.children} onChange={e => set({ children: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="hbs-group">
              <label>{t('rifugio.mealPreference', 'Meal preference')}</label>
              <select value={form.meal_preference} onChange={e => set({ meal_preference: e.target.value })}>
                <option value="half_board">{t('rifugio.halfBoard', 'Half board')}</option>
                <option value="breakfast">{t('rifugio.breakfast', 'Breakfast')}</option>
                <option value="dinner">{t('rifugio.dinner', 'Dinner')}</option>
                <option value="none">{t('rifugio.noMeals', 'No meals')}</option>
              </select>
            </div>
            <div className="hbs-group">
              <label>{t('rifugio.specialRequests', 'Special requests')}</label>
              <textarea rows="3" value={form.special_requests}
                onChange={e => set({ special_requests: e.target.value })}
                placeholder={t('rifugio.specialRequestsPlaceholder', 'Dietary needs, group details…')} />
            </div>
            <div className="hbs-checkbox">
              <input type="checkbox" id="hbs-dogs" checked={form.dogs} onChange={e => set({ dogs: e.target.checked })} />
              <label htmlFor="hbs-dogs">{t('rifugio.bringingDogs', "I'm bringing a dog")}</label>
            </div>
            <button type="submit" className="hbs-submit" disabled={submitting}>
              {submitting ? t('common.loading', 'Sending…') : t('rifugio.submitInquiry', 'Send inquiry')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
