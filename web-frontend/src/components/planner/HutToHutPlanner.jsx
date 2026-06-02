import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  ArrowLeft, Save, Mountain, Hotel, BedDouble, CalendarRange, Ruler, TrendingUp, Clock,
  Plus, Trash2, X, Coffee, Siren, AlertTriangle, ChevronRight, Phone, Check, Bus,
} from 'lucide-react';
import { trailImg } from '../../utils/trailImage';
import { resolveHut } from './hutResolver';
import HutBookingSheet from './HutBookingSheet';
import './HutToHutPlanner.css';

const API_URL = '/api';

/* ── Date helpers — UTC-noon anchored so day math never shifts across DST ── */
const todayYMD = () => new Date().toISOString().slice(0, 10);
function parseYMD(s) { const [y, m, d] = (s || todayYMD()).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); }
function fmtYMD(dt) { return dt.toISOString().slice(0, 10); }
function addDays(dt, n) { const d = new Date(dt.getTime()); d.setUTCDate(d.getUTCDate() + n); return d; }
function prettyDate(ymd) {
  try { return parseYMD(ymd).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch { return ymd; }
}

function jNote(note) {
  if (!note) return '';
  if (typeof note === 'string') return note;
  return note.en || note.it || note.de || '';
}

const BOOKING_STATUSES = ['none', 'pending', 'booked', 'declined'];

export default function HutToHutPlanner({ initial, onSave, onBack }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const toast = useToast();

  const editingTrekId = initial?.trek?.trek_id || null;

  const [treks, setTreks] = useState([]);
  const [rifugios, setRifugios] = useState([]);
  const [trek, setTrek] = useState(null);            // full trek object (with stages)
  const [loadingTrek, setLoadingTrek] = useState(!!editingTrekId);

  const [name, setName] = useState(initial?.name || '');
  const [startDate, setStartDate] = useState(initial?.trek?.start_date || initial?.start_date || todayYMD());
  const [restBefore, setRestBefore] = useState(new Set(initial?.trek?.customizations?.rest_before || []));
  const [skipped, setSkipped] = useState(new Set(initial?.trek?.customizations?.skipped || []));
  const [bookings, setBookings] = useState(() => {
    const m = {};
    (initial?.trek?.nights || []).forEach(n => { if (n.stage_number != null && n.booking) m[n.stage_number] = n.booking; });
    return m;
  });

  const [saving, setSaving] = useState(false);
  const [bookingNight, setBookingNight] = useState(null);   // night object being booked
  const [openExits, setOpenExits] = useState(null);          // stage_number whose exits are expanded

  // Load rifugios (for hut resolution) + trek catalogue once.
  useEffect(() => {
    axios.get(`${API_URL}/rifugios`).then(r => setRifugios(r.data.rifugios || [])).catch(() => {});
    if (!editingTrekId) {
      axios.get(`${API_URL}/multi-day-trails`).then(r => setTreks(r.data.trails || r.data || [])).catch(() => {});
    }
  }, [editingTrekId]);

  // If editing an existing plan, hydrate the full trek (for stages).
  useEffect(() => {
    if (!editingTrekId) return;
    setLoadingTrek(true);
    axios.get(`${API_URL}/multi-day-trails/${editingTrekId}`)
      .then(r => { setTrek(r.data); if (!name) setName(initial?.name || r.data?.name || ''); })
      .catch(() => toast.error(t('planner.trekLoadFailed', 'Could not load this trek.')))
      .finally(() => setLoadingTrek(false));
  }, [editingTrekId]); // eslint-disable-line

  const pickTrek = async (trekSummary) => {
    try {
      const r = await axios.get(`${API_URL}/multi-day-trails/${trekSummary.id}`);
      setTrek(r.data);
      setName(prev => prev || r.data?.name || '');
      setStartDate(todayYMD());
    } catch {
      toast.error(t('planner.trekLoadFailed', 'Could not load this trek.'));
    }
  };

  const stages = useMemo(
    () => [...(trek?.stages || [])].sort((a, b) => (a.stage_number || 0) - (b.stage_number || 0)),
    [trek]
  );

  // Derive the nightly schedule from stages + start date + customizations.
  const nights = useMemo(() => {
    if (!stages.length) return [];
    let date = parseYMD(startDate);
    const out = [];
    let ni = 0;
    for (const stage of stages) {
      const sn = stage.stage_number;
      if (restBefore.has(sn)) {
        out.push({ night_index: ni++, stage_number: null, rest_for: sn, stage_name: t('planner.restDay', 'Rest day'), date: fmtYMD(date), type: 'rest', hut: null, booking: { status: 'none', inquiry_id: null } });
        date = addDays(date, 1);
      }
      const skip = skipped.has(sn);
      out.push({
        night_index: ni++,
        stage_number: sn,
        stage_name: stage.name,
        date: fmtYMD(date),
        type: skip ? 'skipped' : 'stage',
        hut: resolveHut(stage, rifugios),
        booking: bookings[sn] || { status: 'none', inquiry_id: null },
        _stage: stage,
      });
      if (!skip) date = addDays(date, 1);
    }
    return out;
  }, [stages, startDate, restBefore, skipped, bookings, rifugios, t]);

  // ── Customization ops ───────────────────────────────────────────────────
  const toggleRest = (sn) => setRestBefore(prev => { const n = new Set(prev); n.has(sn) ? n.delete(sn) : n.add(sn); return n; });
  const toggleSkip = (sn) => setSkipped(prev => { const n = new Set(prev); n.has(sn) ? n.delete(sn) : n.add(sn); return n; });
  const setNightStatus = (sn, status) => setBookings(prev => ({ ...prev, [sn]: { ...(prev[sn] || {}), status, updated_at: new Date().toISOString() } }));

  const onBooked = (sn, inquiryId) =>
    setBookings(prev => ({ ...prev, [sn]: { status: 'pending', inquiry_id: inquiryId, updated_at: new Date().toISOString() } }));

  const buildEnvelope = () => ({
    ...(initial?.id ? { id: initial.id } : {}),
    version: 1,
    mode: 'hut_to_hut',
    name: name.trim() || trek?.name || t('planner.untitled', 'Untitled trek'),
    start_date: startDate,
    trek: {
      trek_id: trek.id,
      trek_name: trek.name,
      total_distance_km: trek.total_distance_km,
      total_elevation_gain_m: trek.total_elevation_gain_m,
      difficulty: trek.difficulty,
      start_date: startDate,
      customizations: { rest_before: [...restBefore], skipped: [...skipped] },
      nights: nights.map(({ _stage, ...n }) => n),
    },
  });

  const handleSave = useCallback(async () => {
    if (!trek) return;
    setSaving(true);
    await onSave(buildEnvelope());
    setSaving(false);
  }, [trek, name, startDate, restBefore, skipped, bookings, nights]); // eslint-disable-line

  const gear = trek?.equipment_checklist || trek?.gear_checklist || [];
  const tips = trek?.booking_tips || [];
  const ec = trek?.emergency_contacts || {};
  const note = jNote(trek?.josephineNote);

  // ── Trek picker (no trek chosen yet) ──────────────────────────────────────
  if (!trek) {
    return (
      <div className="hh-page">
        <div className="container">
          <button className="hh-back" onClick={onBack}><ArrowLeft size={16} strokeWidth={2} /> {t('planner.savedItineraries', 'My plans')}</button>
          <header className="hh-head">
            <h1 className="hh-title">{t('planner.pickTrek', 'Choose a trek')}</h1>
            <p className="hh-sub">{t('planner.pickTrekDesc', 'Pick a multi-day route — we’ll build the nightly schedule and help you book the huts.')}</p>
          </header>
          {loadingTrek ? (
            <div className="hh-state">{t('common.loading', 'Loading…')}</div>
          ) : treks.length === 0 ? (
            <div className="hh-empty"><Mountain size={40} strokeWidth={1.25} /><p>{t('planner.noTreks', 'No treks available yet.')}</p></div>
          ) : (
            <div className="hh-trek-grid">
              {treks.map(tk => (
                <button key={tk.id} className="hh-trek-card" onClick={() => pickTrek(tk)}>
                  <div className="hh-trek-card__media">
                    <img src={trailImg(tk, 'card')} alt="" loading="lazy" />
                    <div className="hh-trek-card__scrim" />
                  </div>
                  <div className="hh-trek-card__body">
                    <p className="hh-trek-card__region">{tk.region}</p>
                    <h3 className="hh-trek-card__name">{tk.name}</h3>
                    <p className="hh-trek-card__meta">
                      <span><CalendarRange size={13} strokeWidth={2} /> {tk.duration_days}d</span>
                      <span><Ruler size={13} strokeWidth={2} /> {tk.total_distance_km} km</span>
                      <span className="hh-trek-card__diff">{tk.difficulty}</span>
                    </p>
                  </div>
                  <ChevronRight size={18} strokeWidth={2} className="hh-trek-card__chev" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Schedule view ─────────────────────────────────────────────────────────
  return (
    <div className="hh-page">
      <div className="container">
        <button className="hh-back" onClick={onBack}><ArrowLeft size={16} strokeWidth={2} /> {t('planner.savedItineraries', 'My plans')}</button>

        <div className="hh-head">
          <input className="hh-name" value={name} onChange={e => setName(e.target.value)} placeholder={trek.name} aria-label={t('planner.tripName', 'Plan name')} />
          <p className="hh-trekline"><Mountain size={14} strokeWidth={2} /> {trek.name} · {trek.total_distance_km} km · {trek.difficulty}</p>
          <label className="hh-start">
            <CalendarRange size={15} strokeWidth={2} /> {t('planner.setStartDate', 'Start date')}
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </label>
        </div>

        {/* Nightly schedule */}
        <div className="hh-nights">
          {nights.map((n) => (
            <div key={n.night_index} className={`hh-night hh-night--${n.type}`}>
              <div className="hh-night__rail">
                <span className="hh-night__date">{prettyDate(n.date)}</span>
                <span className="hh-night__dot" />
              </div>

              {n.type === 'rest' ? (
                <div className="hh-night__card hh-night__card--rest">
                  <span className="hh-night__rest"><Coffee size={15} strokeWidth={2} /> {t('planner.restDay', 'Rest day')}</span>
                  <button className="hh-mini" onClick={() => toggleRest(n.rest_for)}><Trash2 size={14} strokeWidth={2} /> {t('planner.removeRest', 'Remove')}</button>
                </div>
              ) : (
                <div className="hh-night__card">
                  <div className="hh-night__top">
                    <div>
                      <p className="hh-night__stage">{t('planner.night', 'Night')} · {n.stage_name}</p>
                      {n._stage && (
                        <p className="hh-night__stats">
                          <span><Ruler size={12} strokeWidth={2} /> {n._stage.distance_km} km</span>
                          <span><TrendingUp size={12} strokeWidth={2} /> {n._stage.elevation_gain_m} m</span>
                          {n._stage.estimated_duration_hours != null && <span><Clock size={12} strokeWidth={2} /> {n._stage.estimated_duration_hours}h</span>}
                        </p>
                      )}
                    </div>
                    {n.type === 'skipped' && <span className="hh-skip-badge">{t('planner.skipped', 'Skipped')}</span>}
                  </div>

                  {/* Overnight hut */}
                  {n.hut ? (
                    <div className="hh-hut">
                      <span className="hh-hut__name"><Hotel size={14} strokeWidth={2} /> {n.hut.name}</span>
                      <span className="hh-hut__meta">
                        {n.hut.altitude != null && <span><Mountain size={12} strokeWidth={2} /> {n.hut.altitude} m</span>}
                        {n.hut.beds != null && <span><BedDouble size={12} strokeWidth={2} /> {n.hut.beds}</span>}
                      </span>
                      {n.hut.source === 'snapshot' && (
                        <span className="hh-hut__warn"><AlertTriangle size={12} strokeWidth={2} /> {t('planner.hutNotMatched', 'Not in our hut directory — book via contact below.')}</span>
                      )}
                    </div>
                  ) : (
                    <p className="hh-hut hh-hut--none">{t('planner.noOvernight', 'No overnight (valley / exit)')}</p>
                  )}

                  {/* Booking row */}
                  {n.hut && (
                    <div className="hh-book-row">
                      <span className={`hh-status hh-status--${n.booking.status}`}>
                        {n.booking.status === 'booked' && <Check size={12} strokeWidth={2.5} />}
                        {t(`planner.booking_${n.booking.status}`, n.booking.status)}
                      </span>
                      {n.hut.rifugio_id ? (
                        <button className="hh-mini hh-mini--accent" onClick={() => setBookingNight(n)}>
                          {t('planner.bookHut', 'Book hut')}
                        </button>
                      ) : n.hut.contact ? (
                        <a className="hh-mini" href={`tel:${n.hut.contact}`}><Phone size={13} strokeWidth={2} /> {n.hut.contact}</a>
                      ) : null}
                      <select className="hh-status-select" value={n.booking.status} onChange={e => setNightStatus(n.stage_number, e.target.value)} aria-label={t('planner.bookingStatus', 'Booking status')}>
                        {BOOKING_STATUSES.map(s => <option key={s} value={s}>{t(`planner.booking_${s}`, s)}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Weather risk */}
                  {n._stage?.weather_risk && (
                    <p className="hh-weather-risk"><AlertTriangle size={12} strokeWidth={2} /> {n._stage.weather_risk}</p>
                  )}

                  {/* Exit routes */}
                  {n._stage?.exit_routes?.length > 0 && (
                    <div className="hh-exits">
                      <button className="hh-exits__toggle" onClick={() => setOpenExits(openExits === n.stage_number ? null : n.stage_number)}>
                        <Siren size={13} strokeWidth={2} /> {t('planner.exitRoutes', 'Emergency exits')} ({n._stage.exit_routes.length})
                        <ChevronRight size={14} strokeWidth={2} className={`hh-exits__chev${openExits === n.stage_number ? ' is-open' : ''}`} />
                      </button>
                      {openExits === n.stage_number && (
                        <ul className="hh-exits__list">
                          {n._stage.exit_routes.map((ex, i) => (
                            <li key={ex.id || i}>
                              <strong>{ex.name}</strong>
                              {ex.description && <span> — {ex.description}</span>}
                              {ex.transport && <span className="hh-exits__transport"><Bus size={12} strokeWidth={2} /> {ex.transport}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Per-stage customization */}
                  <div className="hh-night__ops">
                    {!restBefore.has(n.stage_number) && (
                      <button className="hh-mini" onClick={() => toggleRest(n.stage_number)}><Plus size={13} strokeWidth={2} /> {t('planner.addRestDay', 'Rest day before')}</button>
                    )}
                    <button className="hh-mini" onClick={() => toggleSkip(n.stage_number)}>
                      {n.type === 'skipped' ? t('planner.unskip', 'Un-skip') : t('planner.skipNight', 'Skip')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Trek-level info */}
        {note && (
          <div className="hh-note"><Mountain size={16} strokeWidth={2} /><p>{note}</p></div>
        )}

        {gear.length > 0 && (
          <details className="hh-foldout" open>
            <summary>{t('planner.gearChecklist', 'Gear checklist')}</summary>
            <ul className="hh-gear">{gear.map((g, i) => <li key={i}>{g}</li>)}</ul>
          </details>
        )}

        {tips.length > 0 && (
          <details className="hh-foldout">
            <summary>{t('rifugio.bookingInquiry', 'Booking tips')}</summary>
            <ul className="hh-gear">{tips.map((tp, i) => <li key={i}>{tp}</li>)}</ul>
          </details>
        )}

        {(ec.mountain_rescue || ec.weather || ec.local_police) && (
          <details className="hh-foldout">
            <summary>{t('planner.emergencyContacts', 'Emergency contacts')}</summary>
            <ul className="hh-contacts">
              {ec.mountain_rescue && <li><Siren size={14} strokeWidth={2} /> {t('planner.mountainRescue', 'Mountain rescue')}: {ec.mountain_rescue}</li>}
              {ec.weather && <li><AlertTriangle size={14} strokeWidth={2} /> {t('planner.weather', 'Weather')}: {ec.weather}</li>}
              {ec.local_police && <li><Phone size={14} strokeWidth={2} /> {t('planner.localPolice', 'Local police')}: {ec.local_police}</li>}
            </ul>
          </details>
        )}

        <div className="hh-actions">
          <button className="hh-btn hh-btn--primary" onClick={handleSave} disabled={saving}>
            <Save size={16} strokeWidth={2} /> {saving ? t('planner.saving', 'Saving…') : t('planner.saveItinerary', 'Save plan')}
          </button>
        </div>
      </div>

      {bookingNight && bookingNight.hut?.rifugio_id && (
        <HutBookingSheet
          rifugioId={bookingNight.hut.rifugio_id}
          rifugioName={bookingNight.hut.name}
          prefill={{
            name: currentUser?.displayName || '',
            email: currentUser?.email || '',
            check_in: bookingNight.date,
            check_out: fmtYMD(addDays(parseYMD(bookingNight.date), 1)),
          }}
          onClose={() => setBookingNight(null)}
          onSubmitted={(inquiryId) => onBooked(bookingNight.stage_number, inquiryId)}
        />
      )}
    </div>
  );
}
