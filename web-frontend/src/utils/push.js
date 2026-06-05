/**
 * Web Push opt-in — subscribe the browser to Josephine's proactive "moments".
 *
 * Reality check (surfaced honestly in the UI):
 *  - Needs an active service worker (production only; dev unregisters it).
 *  - iOS only delivers web-push to an INSTALLED (home-screen) PWA, iOS 16.4+.
 *  - Disabled entirely until VAPID keys are configured on the server.
 * Everything degrades gracefully — never throws into the UI.
 */
import axios from 'axios';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/** Is web-push configured on the server? → { enabled, key } */
export async function pushServerConfig() {
  try {
    const res = await axios.get('/api/push/vapid-public');
    return res.data || { enabled: false };
  } catch {
    return { enabled: false };
  }
}

/** Current state: 'unsupported' | 'disabled' | 'denied' | 'subscribed' | 'idle' */
export async function pushStatus() {
  if (!pushSupported()) return 'unsupported';
  const cfg = await pushServerConfig();
  if (!cfg.enabled) return 'disabled';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    return sub ? 'subscribed' : 'idle';
  } catch {
    return 'idle';
  }
}

/** Ask permission + subscribe + register with the server. Returns true on success. */
export async function enablePush(lang = 'en') {
  if (!pushSupported()) return false;
  try {
    const cfg = await pushServerConfig();
    if (!cfg.enabled || !cfg.key) return false;

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.key),
      });
    }
    await axios.post('/api/push/subscribe', { subscription: sub.toJSON(), lang });
    return true;
  } catch (e) {
    console.warn('[push] enable failed:', e);
    return false;
  }
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      await axios.post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
    return true;
  } catch {
    return false;
  }
}
