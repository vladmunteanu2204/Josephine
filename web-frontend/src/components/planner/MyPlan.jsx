import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ArrowLeft, Footprints, Mountain, FolderOpen, Trash2, ChevronRight } from 'lucide-react';
import { Card } from '../ui';
import DayByDayPlanner from './DayByDayPlanner';
import HutToHutPlanner from './HutToHutPlanner';
import './MyPlan.css';

import { API_URL } from '../../api';
const LS_KEY = 'josephine_hike_plans';

/* "My Plan" — top-level container. Lists saved plans and lets the user start
   a new plan in one of two modes (day-by-day bucket / hut-to-hut trek).
   Persistence is per logged-in user via /api/hike-plans, with a localStorage
   mirror as an offline safety-net. The route is already login-gated. */
export default function MyPlan({ onNavigate }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const toast = useToast();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');   // 'list' | 'edit'
  const [draft, setDraft] = useState(null);    // plan envelope being edited

  const email = currentUser?.email || '';

  const mirrorLocal = (list) => { try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {} };

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/hike-plans`, { params: { email } });
      const list = res.data.plans || [];
      setPlans(list);
      mirrorLocal(list);
    } catch {
      try { setPlans(JSON.parse(localStorage.getItem(LS_KEY) || '[]')); } catch { setPlans([]); }
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => { if (email) loadPlans(); else setLoading(false); }, [email, loadPlans]);

  // Save (create or update) — returns the persisted envelope (with id) or null.
  const savePlan = async (envelope) => {
    const base = {
      ...envelope,
      user_email: email,
      user_uid: currentUser?.uid || '',
      user_name: currentUser?.displayName || '',
    };
    try {
      const res = base.id
        ? await axios.put(`${API_URL}/hike-plans/${base.id}`, base)
        : await axios.post(`${API_URL}/hike-plans`, base);
      toast.success(t('planner.saved', 'Plan saved!'));
      await loadPlans();
      return res.data.plan;
    } catch {
      // Offline / failure: keep a local copy so edits are never lost.
      const local = base.id ? base : { ...base, id: `local-${Date.now()}` };
      const next = [local, ...plans.filter(p => p.id !== local.id)];
      setPlans(next); mirrorLocal(next);
      toast.error(t('planner.saveFailed', 'Could not reach the server — kept a local copy.'));
      return local;
    }
  };

  const deletePlan = async (id) => {
    try { await axios.delete(`${API_URL}/hike-plans/${id}`, { params: { email } }); } catch { /* still remove locally */ }
    const next = plans.filter(p => p.id !== id);
    setPlans(next); mirrorLocal(next);
    toast.info(t('planner.deleted', 'Plan deleted'));
  };

  const startNew = (mode) => { setDraft({ version: 1, mode, name: '' }); setView('edit'); };
  const editPlan = (plan) => { setDraft({ ...plan, mode: plan.mode || 'day_by_day' }); setView('edit'); };
  const backToList = () => { setDraft(null); setView('list'); loadPlans(); };

  // ── Editing a plan ──────────────────────────────────────────────────────
  if (view === 'edit' && draft) {
    const handleSave = async (env) => {
      const saved = await savePlan(env);
      if (saved) setDraft(saved);   // capture the new id so further saves update
      return saved;
    };
    if (draft.mode === 'hut_to_hut') {
      return <HutToHutPlanner initial={draft} onSave={handleSave} onBack={backToList} />;
    }
    return <DayByDayPlanner initial={draft} onSave={handleSave} onBack={backToList} />;
  }

  // ── List + new-plan chooser ─────────────────────────────────────────────
  const planSummary = (plan) => {
    if ((plan.mode || 'day_by_day') === 'hut_to_hut') {
      const nights = plan.trek?.nights || [];
      return `${plan.trek?.trek_name || ''} · ${nights.length} ${t('planner.nights', 'nights')}`;
    }
    const items = plan.bucket?.items || plan.trails || [];
    const dist = plan.bucket?.totals?.distance_km ?? plan.totalDistance ?? 0;
    return `${items.length} ${t('planner.trails', 'hikes')} · ${Number(dist).toFixed(1)} km`;
  };

  return (
    <div className="myplan-page">
      <div className="container">
        <button className="myplan-back" onClick={() => onNavigate('home')}>
          <ArrowLeft size={16} strokeWidth={2} /> {t('common.backToHome', 'Back')}
        </button>

        <header className="myplan-head">
          <h1 className="myplan-title">{t('planner.myPlanTitle', 'My Plan')}</h1>
          <p className="myplan-sub">{t('planner.chooseMode', 'Plan day-hikes for a trip, or a hut-to-hut trek.')}</p>
        </header>

        {/* New-plan mode chooser */}
        <div className="myplan-modes">
          <Card as="button" interactive className="myplan-mode" onClick={() => startNew('day_by_day')}>
            <span className="myplan-mode__icon"><Footprints size={26} strokeWidth={1.75} /></span>
            <span className="myplan-mode__body">
              <span className="myplan-mode__title">{t('planner.modeDayByDay', 'Day-by-day trip')}</span>
              <span className="myplan-mode__desc">{t('planner.modeDayByDayDesc', 'A bucket of separate day-hikes for your trip.')}</span>
            </span>
            <ChevronRight size={18} strokeWidth={2} className="myplan-mode__chev" />
          </Card>

          <Card as="button" interactive className="myplan-mode" onClick={() => startNew('hut_to_hut')}>
            <span className="myplan-mode__icon"><Mountain size={26} strokeWidth={1.75} /></span>
            <span className="myplan-mode__body">
              <span className="myplan-mode__title">{t('planner.modeHutToHut', 'Hut-to-hut trek')}</span>
              <span className="myplan-mode__desc">{t('planner.modeHutToHutDesc', 'A multi-day route sleeping in mountain huts.')}</span>
            </span>
            <ChevronRight size={18} strokeWidth={2} className="myplan-mode__chev" />
          </Card>
        </div>

        {/* Saved plans */}
        <h2 className="myplan-section-title">{t('planner.savedItineraries', 'Saved plans')}</h2>
        {loading ? (
          <div className="myplan-state">{t('common.loading', 'Loading…')}</div>
        ) : plans.length === 0 ? (
          <div className="myplan-empty">
            <FolderOpen size={40} strokeWidth={1.25} />
            <p>{t('planner.noPlans', 'No saved plans yet — start one above.')}</p>
          </div>
        ) : (
          <div className="myplan-list">
            {plans.map(plan => {
              const mode = plan.mode || 'day_by_day';
              const Icon = mode === 'hut_to_hut' ? Mountain : Footprints;
              return (
                <Card key={plan.id} className="myplan-row">
                  <button className="myplan-row__main" onClick={() => editPlan(plan)}>
                    <span className="myplan-row__icon"><Icon size={18} strokeWidth={2} /></span>
                    <span className="myplan-row__text">
                      <span className="myplan-row__name">{plan.name || t('planner.untitled', 'Untitled plan')}</span>
                      <span className="myplan-row__meta">{planSummary(plan)}</span>
                    </span>
                  </button>
                  <button
                    className="myplan-row__del"
                    aria-label={t('planner.delete', 'Delete')}
                    onClick={() => { if (window.confirm(t('planner.deleteConfirm', 'Delete this plan?'))) deletePlan(plan.id); }}
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
