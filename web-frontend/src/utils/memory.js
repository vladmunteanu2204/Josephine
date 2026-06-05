/**
 * Josephine's memory of you — on-device, structured signals only.
 *
 * Persists in localStorage (per device, survives across sessions). We store ONLY
 * deterministic, structured signals the user actually gave us — never invented
 * facts, never free-text scraped by an LLM. This is the hook the proactive
 * "welcome back" opener reads from.
 *
 * Privacy: nothing leaves the device. No server profile. Clearable via clearMemory().
 */
const KEY = 'josephine_memory_v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function write(m) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); }
  catch { /* storage full / blocked — memory is best-effort */ }
}

export function getMemory() { return read(); }
export function clearMemory() { try { localStorage.removeItem(KEY); } catch { /* no-op */ } }

/** Count a visit; remember the PREVIOUS visit time so we can say "last week". */
export function recordVisit() {
  const m = read();
  m.visits = (m.visits || 0) + 1;
  m.prevVisit = m.lastVisit || null;
  m.lastVisit = Date.now();
  write(m);
  return m;
}

/** Learn from a delivered plan: the trail's region/difficulty + the parsed intent. */
export function rememberFromPlan(plan) {
  if (!plan) return;
  const m = read();
  const t = plan.trail || {};
  if (t.region) m.lastRegion = t.region;
  if (t.difficulty) m.lastDifficulty = t.difficulty;
  if (t.name) m.lastTrailName = t.name;
  const i = plan.intent_summary || {};
  if (i.mood) m.lastMood = i.mood;
  if (i.difficulty) m.lastDifficulty = i.difficulty;
  if (i.with_dog) m.withDog = true;
  if (i.family) m.family = true;
  if (Array.isArray(i.interests) && i.interests.length) {
    m.interests = [...new Set([...(m.interests || []), ...i.interests])].slice(0, 8);
  }
  m.lastPlanAt = Date.now();
  write(m);
}

/** Learn from a finished hike (region, summit, how the legs felt). */
export function rememberCompletedHike({ trailName, region, isSummit, rating } = {}) {
  const m = read();
  m.completedCount = (m.completedCount || 0) + 1;
  if (isSummit) m.summitsCount = (m.summitsCount || 0) + 1;
  if (region) m.regionsHiked = [...new Set([...(m.regionsHiked || []), region])].slice(0, 12);
  m.lastCompleted = {
    trailName: trailName || null,
    region: region || null,
    isSummit: !!isSummit,
    rating: rating || null,   // 1 easy · 2 just right · 3 tough
    at: Date.now(),
  };
  write(m);
}

/** Is this a returning user we actually remember something about? */
export function isReturning() {
  const m = read();
  return (m.visits || 0) > 1 && !!(m.lastMood || m.lastDifficulty || m.lastCompleted || m.lastRegion);
}

/** Coarse, localizable recency bucket since a timestamp. */
export function recencyBucket(ts) {
  if (!ts) return null;
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 10) return 'recently';
  if (days <= 45) return 'lastMonth';
  return 'aWhile';
}
