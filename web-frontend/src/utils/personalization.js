/**
 * personalization.js — client helpers for Phase 17B.
 *
 * Dual-write by design: behaviour and saved-trail changes are mirrored to the
 * backend (for cross-device sync + the recommendation engine) AND kept in
 * localStorage so the app keeps working offline / for guests. Every network
 * call is fire-and-forget — a tracking failure must never break the UI.
 */
import axios from 'axios';
import { API_URL } from '../api';

const LS_BEHAVIOUR = 'behaviourLog';     // local ring buffer (offline fallback)
const MAX_LOCAL_EVENTS = 200;

/** Append an event to the local ring buffer (best-effort, swallows errors). */
function logLocal(trailId, action) {
  try {
    const log = JSON.parse(localStorage.getItem(LS_BEHAVIOUR) || '[]');
    log.push({ trail_id: trailId, action, at: Date.now() });
    if (log.length > MAX_LOCAL_EVENTS) log.splice(0, log.length - MAX_LOCAL_EVENTS);
    localStorage.setItem(LS_BEHAVIOUR, JSON.stringify(log));
  } catch { /* storage full / disabled — ignore */ }
}

/**
 * Record a trail VIEW. Reuses the existing analytics endpoint, which doubles as
 * a per-user behaviour signal when an email is supplied.
 */
export function trackTrailView(trailId, email) {
  if (!trailId) return;
  logLocal(trailId, 'view');
  axios.post(`${API_URL}/analytics/trail/view`, {
    trail_id: trailId, ...(email ? { user_email: email } : {}),
  }).catch(() => {});
}

/**
 * Record a SAVE / UNSAVE. Mirrors to the per-user server list (cross-device)
 * via the analytics/save endpoint when signed in; always logs locally.
 */
export function trackTrailSave(trailId, email, action = 'save') {
  if (!trailId) return;
  logLocal(trailId, action);
  axios.post(`${API_URL}/analytics/trail/save`, {
    trail_id: trailId, action, ...(email ? { user_email: email } : {}),
  }).catch(() => {});
}

/** Record a generic behaviour signal (e.g. 'plan', 'review'). */
export function trackBehaviour(trailId, action, email, metadata) {
  if (!trailId || !email) return;
  logLocal(trailId, action);
  axios.post(`${API_URL}/behaviour`, {
    trail_id: trailId, action, user_email: email, metadata,
  }).catch(() => {});
}

/**
 * "Recommended for you" row. Pass an email for history-driven picks; omit it
 * and guests get the popularity-led cold-start row. [] on any failure.
 */
export async function fetchRecommendations(email, limit = 6) {
  try {
    const res = await axios.get(`${API_URL}/recommendations/for-you`, {
      params: email ? { email, limit } : { limit },
    });
    return res.data || { results: [], cold_start: true };
  } catch {
    return { results: [], cold_start: true };
  }
}

/** Read a user's notification preferences (defaults all-on). */
export async function fetchNotificationPrefs(email) {
  if (!email) return { weekly_recs: true, weather_alerts: true };
  try {
    const res = await axios.get(`${API_URL}/me/notification-prefs`, { params: { email } });
    return res.data?.prefs || { weekly_recs: true, weather_alerts: true };
  } catch {
    return { weekly_recs: true, weather_alerts: true };
  }
}

/** Persist a user's notification preferences. Returns the stored prefs. */
export async function saveNotificationPrefs(email, prefs) {
  if (!email) return prefs;
  try {
    const res = await axios.post(`${API_URL}/me/notification-prefs`, { user_email: email, prefs });
    return res.data?.prefs || prefs;
  } catch {
    return prefs;
  }
}
