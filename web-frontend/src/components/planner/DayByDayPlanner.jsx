import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useToast } from '../../contexts/ToastContext';
import {
  ArrowLeft, Plus, X, Trash2, Download, Save, Search,
  ChevronUp, ChevronDown, Ruler, TrendingUp, Clock,
} from 'lucide-react';
import { trailImg } from '../../utils/trailImage';
import EquipmentChecklist from '../EquipmentChecklist';
import SafetyTips from '../SafetyTips';
import './DayByDayPlanner.css';

import { API_URL } from '../../api';
const DIFF_RANK = { easy: 1, medium: 2, hard: 3 };

const num = (v) => (parseFloat(v) || 0);

function itemFromTrail(tr, order) {
  return {
    trail_id: tr.id,
    name: tr.name,
    distance_km: num(tr.distance_km ?? tr.distance),
    elevation_gain_m: num(tr.elevation_gain_m ?? tr.elevation),
    duration_hours: num(tr.duration_hours ?? tr.duration),
    difficulty: (tr.difficulty || 'medium').toLowerCase(),
    day: null,
    order,
  };
}

function calcTotals(items) {
  return items.reduce((acc, it) => {
    acc.distance_km += num(it.distance_km);
    acc.elevation_gain_m += num(it.elevation_gain_m);
    acc.duration_hours += num(it.duration_hours);
    const r = DIFF_RANK[it.difficulty] || 1;
    if (r > acc._rank) { acc._rank = r; acc.max_difficulty = it.difficulty; }
    return acc;
  }, { distance_km: 0, elevation_gain_m: 0, duration_hours: 0, max_difficulty: 'easy', _rank: 0 });
}

/* Day-by-day mode: a flexible bucket of day-hikes for a trip. Each hike can
   optionally be pinned to a day, but order/scheduling is loose by design. */
export default function DayByDayPlanner({ initial, onSave, onBack }) {
  const { t } = useTranslation();
  const toast = useToast();

  const [name, setName] = useState(initial?.name || '');
  const [startDate, setStartDate] = useState(initial?.start_date || '');
  const [endDate, setEndDate] = useState(initial?.end_date || '');
  const [items, setItems] = useState(initial?.bucket?.items || []);
  const [saving, setSaving] = useState(false);

  const [allTrails, setAllTrails] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const [showExport, setShowExport] = useState(false);
  const [exportText, setExportText] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/trails`)
      .then(r => setAllTrails(r.data.trails || []))
      .catch(() => setAllTrails([]));
  }, []);

  const totals = useMemo(() => calcTotals(items), [items]);
  const tripDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const d = Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
    return d > 0 ? d : 0;
  }, [startDate, endDate]);
  const maxDays = tripDays || Math.max(items.length, 1);
  const addedIds = useMemo(() => new Set(items.map(i => i.trail_id)), [items]);

  const addTrail = (tr) => {
    if (addedIds.has(tr.id)) return;
    setItems(prev => [...prev, itemFromTrail(tr, prev.length)]);
  };
  const removeItem = (id) => setItems(prev => prev.filter(i => i.trail_id !== id));
  const setItemDay = (id, day) => setItems(prev => prev.map(i => i.trail_id === id ? { ...i, day } : i));
  const moveItem = (idx, dir) => setItems(prev => {
    const next = [...prev];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return prev;
    [next[idx], next[j]] = [next[j], next[idx]];
    return next.map((it, k) => ({ ...it, order: k }));
  });

  const buildEnvelope = () => ({
    ...(initial?.id ? { id: initial.id } : {}),
    version: 1,
    mode: 'day_by_day',
    name: name.trim() || t('planner.untitled', 'Untitled plan'),
    start_date: startDate || null,
    end_date: endDate || null,
    bucket: { items: items.map((it, k) => ({ ...it, order: k })), totals: calcTotals(items) },
  });

  const handleSave = async () => {
    if (!name.trim()) { toast.warning(t('planner.nameRequired', 'Please name your trip first.')); return; }
    setSaving(true);
    await onSave(buildEnvelope());
    setSaving(false);
  };

  const generateExport = () => {
    let txt = `${name || t('planner.myPlanTitle', 'My Plan')}\n\n`;
    if (startDate) txt += `${t('planner.startDate', 'Start')}: ${new Date(startDate).toLocaleDateString()}\n`;
    if (endDate) txt += `${t('planner.endDate', 'End')}: ${new Date(endDate).toLocaleDateString()}\n`;
    txt += `\n${t('planner.summary', 'Summary')}:\n`;
    txt += `- ${t('trail.distance', 'Distance')}: ${totals.distance_km.toFixed(1)} km\n`;
    txt += `- ${t('trail.elevation', 'Elevation')}: ${totals.elevation_gain_m.toFixed(0)} m\n`;
    txt += `- ${t('planner.estimatedDuration', 'Duration')}: ${totals.duration_hours.toFixed(1)} h\n`;
    txt += `\n${t('planner.trails', 'Hikes')}:\n`;
    items.forEach((it, i) => {
      const dayLabel = it.day ? ` (${t('planner.day', 'Day')} ${it.day})` : '';
      txt += `${i + 1}. ${it.name}${dayLabel} — ${num(it.distance_km)} km, ${num(it.elevation_gain_m)} m\n`;
    });
    setExportText(txt);
    setShowExport(true);
  };

  const copyExport = () => { navigator.clipboard.writeText(exportText); toast.success(t('planner.copied', 'Copied to clipboard!')); };

  const pickerTrails = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return allTrails
      .filter(tr => !q || `${tr.name} ${tr.region}`.toLowerCase().includes(q))
      .slice(0, 60);
  }, [allTrails, pickerSearch]);

  return (
    <div className="ddp-page">
      <div className="container">
        <button className="ddp-back" onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={2} /> {t('planner.savedItineraries', 'My plans')}
        </button>

        {/* Header: name + dates */}
        <div className="ddp-head">
          <input
            className="ddp-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('planner.tripNamePlaceholder', 'Name your trip…')}
            aria-label={t('planner.tripName', 'Trip name')}
          />
          <div className="ddp-dates">
            <label>{t('planner.startDate', 'Start')}
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </label>
            <label>{t('planner.endDate', 'End')}
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
            </label>
            {tripDays > 0 && <span className="ddp-tripdays">{tripDays} {tripDays === 1 ? t('planner.day', 'day') : t('planner.days', 'days')}</span>}
          </div>
        </div>

        {/* Bucket */}
        <div className="ddp-bucket">
          <div className="ddp-bucket__head">
            <h2>{t('planner.itinerary', 'Your hikes')}</h2>
            <button className="ddp-add-btn" onClick={() => setShowPicker(true)}>
              <Plus size={16} strokeWidth={2} /> {t('planner.addHike', 'Add a hike')}
            </button>
          </div>

          {items.length === 0 ? (
            <p className="ddp-empty">{t('planner.noTrailsSelected', 'No hikes added yet — add a few to build your trip.')}</p>
          ) : (
            <ul className="ddp-items">
              {items.map((it, idx) => (
                <li key={it.trail_id} className="ddp-item">
                  <div className="ddp-item__reorder">
                    <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} aria-label={t('planner.moveUp', 'Move up')}><ChevronUp size={15} strokeWidth={2} /></button>
                    <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} aria-label={t('planner.moveDown', 'Move down')}><ChevronDown size={15} strokeWidth={2} /></button>
                  </div>
                  <div className="ddp-item__body">
                    <p className="ddp-item__name">{it.name}</p>
                    <p className="ddp-item__stats">
                      <span><Ruler size={13} strokeWidth={2} /> {num(it.distance_km)} km</span>
                      <span><TrendingUp size={13} strokeWidth={2} /> {num(it.elevation_gain_m)} m</span>
                      <span><Clock size={13} strokeWidth={2} /> {num(it.duration_hours)}h</span>
                    </p>
                  </div>
                  <select
                    className="ddp-item__day"
                    value={it.day ?? ''}
                    onChange={e => setItemDay(it.trail_id, e.target.value ? Number(e.target.value) : null)}
                    aria-label={t('planner.assignDay', 'Assign a day')}
                  >
                    <option value="">{t('planner.unassigned', 'Unscheduled')}</option>
                    {Array.from({ length: maxDays }).map((_, d) => (
                      <option key={d + 1} value={d + 1}>{t('planner.day', 'Day')} {d + 1}</option>
                    ))}
                  </select>
                  <button className="ddp-item__del" onClick={() => removeItem(it.trail_id)} aria-label={t('planner.delete', 'Remove')}>
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Totals */}
        {items.length > 0 && (
          <div className="ddp-totals">
            <div><span>{t('trail.distance', 'Distance')}</span><strong>{totals.distance_km.toFixed(1)} km</strong></div>
            <div><span>{t('trail.elevation', 'Elevation')}</span><strong>{totals.elevation_gain_m.toFixed(0)} m</strong></div>
            <div><span>{t('planner.estimatedDuration', 'Duration')}</span><strong>{totals.duration_hours.toFixed(1)} h</strong></div>
          </div>
        )}

        {items.length > 0 && (
          <>
            <EquipmentChecklist difficulty={totals.max_difficulty} duration={totals.duration_hours} tripDays={tripDays} />
            <SafetyTips difficulty={totals.max_difficulty} tripDays={tripDays} />
          </>
        )}

        {/* Actions */}
        <div className="ddp-actions">
          <button className="ddp-btn ddp-btn--primary" onClick={handleSave} disabled={saving}>
            <Save size={16} strokeWidth={2} /> {saving ? t('planner.saving', 'Saving…') : t('planner.saveItinerary', 'Save plan')}
          </button>
          <button className="ddp-btn ddp-btn--ghost" onClick={generateExport} disabled={!items.length}>
            <Download size={16} strokeWidth={2} /> {t('planner.exportItinerary', 'Export')}
          </button>
        </div>
      </div>

      {/* Trail picker bottom sheet */}
      {showPicker && (
        <>
          <div className="ddp-sheet-backdrop" onClick={() => setShowPicker(false)} aria-hidden="true" />
          <div className="ddp-sheet" role="dialog" aria-modal="true" aria-label={t('planner.addHike', 'Add a hike')}>
            <div className="ddp-sheet__handle" />
            <div className="ddp-sheet__head">
              <h3>{t('planner.addHike', 'Add a hike')}</h3>
              <button onClick={() => setShowPicker(false)} aria-label={t('common.close', 'Close')}><X size={20} strokeWidth={2} /></button>
            </div>
            <div className="ddp-sheet__search">
              <Search size={18} strokeWidth={2} />
              <input
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                placeholder={t('catalog.searchPlaceholder', 'Search trails…')}
                autoFocus
              />
            </div>
            <ul className="ddp-picker-list">
              {pickerTrails.map(tr => {
                const added = addedIds.has(tr.id);
                return (
                  <li key={tr.id} className="ddp-picker-item">
                    <img src={trailImg(tr, 'thumb')} alt="" className="ddp-picker-item__img" loading="lazy" />
                    <div className="ddp-picker-item__body">
                      <p className="ddp-picker-item__name">{tr.name}</p>
                      <p className="ddp-picker-item__meta">{tr.region} · {num(tr.distance_km ?? tr.distance)} km · {(tr.difficulty || '')}</p>
                    </div>
                    <button className={`ddp-picker-item__add${added ? ' is-added' : ''}`} onClick={() => addTrail(tr)} disabled={added} aria-label={t('planner.addHike', 'Add')}>
                      <Plus size={16} strokeWidth={2} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      {/* Export modal */}
      {showExport && (
        <div className="ddp-modal-overlay" onClick={() => setShowExport(false)}>
          <div className="ddp-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('planner.exportItinerary', 'Export')}</h3>
            <textarea readOnly value={exportText} rows={14} />
            <div className="ddp-modal__actions">
              <button className="ddp-btn ddp-btn--primary" onClick={copyExport}>{t('planner.copyToClipboard', 'Copy')}</button>
              <button className="ddp-btn ddp-btn--ghost" onClick={() => setShowExport(false)}>{t('common.close', 'Close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
