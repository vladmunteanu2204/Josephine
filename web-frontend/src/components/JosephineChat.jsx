import React, { useState, useRef, useEffect, useCallback } from 'react';
import { trailImg, onImgError } from '../utils/trailImage';
import i18nInstance from '../i18n';
import axios from 'axios';
import { detectSeason, getSeasonConfig } from '../hooks/useSeason';
import { checkDistanceFromGPS, checkDistanceWarning, buildTransportNote } from '../utils/geoAwareness';
import { useAuth } from '../contexts/AuthContext';
import AuthPromptModal from './AuthPromptModal';
import DailyPlanCard from './DailyPlanCard';
import JosephineAvatar from './JosephineAvatar';
import { recordVisit, rememberFromPlan, isReturning } from '../utils/memory';
import './JosephineChat.css';

const _seasonOverride = new URLSearchParams(window.location.search).get('season');
const _seasonConfig   = getSeasonConfig(_seasonOverride || detectSeason());

const SESSION_KEY   = 'josephine_session';
const SAVED_KEY     = 'savedTrails';
const CHAT_SAVE_KEY = 'josephine_chat_state';
const WX_LAT = 46.5, WX_LON = 11.35;

// Mutable: updated when geolocation resolves so the planning-flow weather
// card uses the user's real position rather than the Dolomites fallback.
let userLat = WX_LAT, userLon = WX_LON;
// True only once we have the user's REAL position (not the Dolomites
// fallback) — so "X km away" is only shown when it's actually meaningful.
let userLocated = false;
// Last weather payload (description + sunset) — passed to the recommend engine
// so the dispersal layer can factor fair weather + daylight.
let lastWeather = null;

/* Module-level i18n helper for Josephine's hand-written copy. Reads
   josephineChat.<key> from the active locale, falls back to the English string
   when a key is missing, and does {{var}} interpolation (the namespaced
   useTranslation in this file has no interpolation of its own). */
function tj(key, fallback, vars) {
  const full = `josephineChat.${key}`;
  let v = i18nInstance.t(full);
  if (!v || v === full) v = fallback ?? key;
  if (vars) for (const [k, val] of Object.entries(vars)) v = v.split(`{{${k}}}`).join(String(val));
  return v;
}

/* ── Distance helpers (for "X km away" on recommended trails) ─────────── */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
// Best-effort trailhead coordinate from the recommend payload.
function trailStartLatLon(tr) {
  const c = tr?.geometry?.coordinates;            // GeoJSON LineString → [[lon,lat], …]
  if (Array.isArray(c) && Array.isArray(c[0]) && c[0].length >= 2) {
    return { lat: c[0][1], lon: c[0][0] };
  }
  const th = tr?.trailhead_info?.coordinates;
  if (th && typeof th.lat === 'number' && (typeof th.lng === 'number' || typeof th.lon === 'number')) {
    return { lat: th.lat, lon: th.lng ?? th.lon };
  }
  return null;
}
// Returns rounded km from the user to the trailhead, or null when unknown.
function distanceFromUserKm(tr) {
  if (!userLocated) return null;
  const s = trailStartLatLon(tr);
  if (!s) return null;
  const km = haversineKm(userLat, userLon, s.lat, s.lon);
  return (isFinite(km) && km >= 0.1) ? km : null;
}

/* ── Context-aware trail Q&A (offline, factual) ───────────────────────────
   Answers follow-up questions about the trail currently on screen STRICTLY
   from its own fields. Returns { text } to reply, { action:'view' } to open
   the trail, or null — and null deliberately lets the question fall through
   to Haiku (the LLM) rather than guessing. Never invents missing data. */
function _seasonRange(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr.length > 1 ? `${arr[0]}–${arr[arr.length - 1]}` : arr[0];
}
function answerAboutTrail(trail, tl) {
  if (!trail) return null;
  const name = trail.name || 'this trail';
  const has = (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);

  // Distance / length (must mention km / distance / far / length)
  if (/\b(how far|how many km|what'?s the distance|distance|how long is it in km|length)\b/i.test(tl)) {
    return has(trail.distance_km) ? { text: tj('qaDistance', '{{name}} is {{km}} km.', { name, km: trail.distance_km }) } : null;
  }
  // Duration / time
  if (/\b(how long|how many hours|how much time|how long does it take|duration|take to (do|hike|walk|complete))\b/i.test(tl)) {
    return has(trail.duration_hours) ? { text: tj('qaDuration', '{{name}} takes around {{h}}h at a steady pace.', { name, h: trail.duration_hours }) } : null;
  }
  // Elevation / climb
  if (/\b(elevation|ascent|vertical|height gain|how much (up|climb|climbing))\b/i.test(tl)) {
    return has(trail.elevation_gain_m) ? { text: tj('qaElevation', '{{name}} climbs about {{m}} m.', { name, m: trail.elevation_gain_m }) } : null;
  }
  // Difficulty
  if (/\b(how hard|how difficult|is it hard|is it easy|is it tough|is it steep|difficulty|how challenging)\b/i.test(tl)) {
    if (!has(trail.difficulty)) return null;
    const d = String(trail.difficulty).toLowerCase();
    const extra = d === 'easy' ? tj('qaDiffEasy', 'Suitable for most people.')
      : d === 'hard' ? tj('qaDiffHard', 'Best for fit, experienced hikers — good footwear matters.')
      : tj('qaDiffModerate', 'A moderate effort — steady fitness and proper shoes recommended.');
    return { text: tj('qaDifficulty', '{{name}} is rated {{difficulty}}. {{extra}}', { name, difficulty: trail.difficulty, extra }) };
  }
  // Season / when's it open
  if (/\b(when.*(best|to go)|best (time|season|month)|in season|what season|when (is it )?open|is it open)\b/i.test(tl)) {
    const s = _seasonRange(trail.best_season);
    return s ? { text: tj('qaSeason', '{{name}} is best {{season}}.', { name, season: s }) } : null;
  }
  // Getting there / transport / parking
  if (/\b(how (do|to)( i)? (get|reach)|getting there|by bus|by car|parking|how to reach|drive there|public transport)\b/i.test(tl)) {
    const car = trail.transport?.car;
    const bus = trail.transport?.bus;
    const parking = trail.trailhead_info?.parking;
    const parts = [];
    if (bus) parts.push(tj('qaByBus', 'By bus: {{bus}}', { bus }));
    if (car) parts.push(tj('qaByCar', 'By car: {{car}}', { car }));
    if (!parts.length && parking) parts.push(tj('qaParking', 'Parking: {{parking}}', { parking }));
    return parts.length ? { text: tj('qaGettingTo', 'Getting to {{name}} — {{parts}}', { name, parts: parts.join(' · ') }) } : null;
  }
  // Food / rifugio nearby
  if (/\b(eat|food|lunch|coffee|drink|refreshment|rifugio|hut|malga|somewhere to (eat|stop))\b/i.test(tl)) {
    const rifs = Array.isArray(trail.nearby_rifugios) ? trail.nearby_rifugios.map(r => r?.name).filter(Boolean) : [];
    return rifs.length ? { text: tj('qaFood', "Near {{name}} you've got {{rifs}} for a bite or a rest.", { name, rifs: rifs.slice(0, 3).join(', ') }) } : null;
  }
  // Family / kids
  if (/\b(family|kids|children|child|toddler|stroller|pushchair)\b/i.test(tl)) {
    if (trail.family_friendly === true)  return { text: tj('qaFamilyYes', 'Yes — {{name}} is family-friendly.', { name }) };
    if (trail.family_friendly === false) return { text: tj('qaFamilyNo', "{{name}} isn't marked family-friendly — probably better for older kids or adults.", { name }) };
    return null;
  }
  // Open it / show on map
  if (/\b(show .*(map|it)|on the map|open (it|the trail)|view details|see (details|more))\b/i.test(tl)) {
    return { action: 'view' };
  }
  return null;
}

// Compact factual context handed to Haiku so it can answer about "it"
// without inventing details. Only includes fields that are present.
function buildTrailContext(trail) {
  if (!trail) return '';
  const L = [];
  if (trail.name)            L.push(`Name: ${trail.name}`);
  if (trail.region)          L.push(`Region: ${trail.region}`);
  if (trail.difficulty)      L.push(`Difficulty: ${trail.difficulty}`);
  if (trail.duration_hours)  L.push(`Duration: ${trail.duration_hours}h`);
  if (trail.distance_km)     L.push(`Distance: ${trail.distance_km} km`);
  if (trail.elevation_gain_m) L.push(`Elevation gain: ${trail.elevation_gain_m} m`);
  if (trail.dog_friendly !== undefined)    L.push(`Dog-friendly: ${trail.dog_friendly ? 'yes' : 'no'}`);
  if (trail.family_friendly !== undefined) L.push(`Family-friendly: ${trail.family_friendly ? 'yes' : 'no'}`);
  const s = _seasonRange(trail.best_season);
  if (s) L.push(`Best season: ${s}`);
  const rifs = Array.isArray(trail.nearby_rifugios) ? trail.nearby_rifugios.map(r => r?.name).filter(Boolean) : [];
  if (rifs.length) L.push(`Nearby huts: ${rifs.slice(0, 4).join(', ')}`);
  return L.join('. ');
}

/* ── Weather → Josephine opening message ─────────────────────────────── */
function buildWeatherGreeting(w) {
  const desc = (w?.description || '').toLowerCase();
  const temp = w?.temperature ?? 14;
  const wind = w?.wind_speed ?? 0;

  if (/thunder|storm/.test(desc))
    return tj('wgStorm', "Afternoon thunderstorms are forecast over the peaks today. The mountains are still worth it — but I'd plan a short morning window and be back in the valley before 13:00. Half-day itinerary?");

  if (/rain|shower|drizzle/.test(desc))
    return tj('wgRain', "It's raining in South Tyrol today — that moody, cinematic kind of beautiful. Forest paths and rifugios are your friends. I know sheltered routes that are magical in the wet. Want one?");

  if (/snow/.test(desc))
    return tj('wgSnow', 'Fresh snow on the upper routes today ({{temp}}°C). Snowshoe trails and mountain huts are at their best — a completely different kind of mountain day. Want me to find something?', { temp });

  if (/fog|mist/.test(desc))
    return tj('wgFog', "Mist is drifting through the valleys this morning — that rare atmospheric light that makes the mountains look like a painting. Perfect for a low-altitude walk. Shall I find one?");

  if (wind > 45)
    return tj('wgWind', "Strong wind on the exposed ridges today — up to {{wind}} km/h. I'd steer you toward sheltered forest trails and valley paths rather than the high routes. Want a recommendation?", { wind });

  if (/clear|sun/.test(desc)) {
    if (temp > 27)
      return tj('wgClearHot', 'Blue skies today, but warm — {{temp}}°C in the valley. Worth starting early or heading to altitude for cooler air. I know some trails near water too. What sounds right?', { temp });
    return tj('wgClear', 'Perfect conditions today — {{temp}}°C, clear skies, excellent visibility. The mountains are putting on a show. What kind of adventure are you after?', { temp });
  }

  if (/overcast|cloud/.test(desc)) {
    if (/few|scattered|partly/.test(desc))
      return tj('wgCloudPartly', 'Sun and cloud today, {{temp}}°C — classic alpine light. Not too hot, great for walking. What kind of adventure are you after?', { temp });
    return tj('wgOvercast', 'Overcast today — dramatic skies, quieter trails, beautiful diffused light. {{temp}}°C and no crowds. A great day to go somewhere new. What sounds right?', { temp });
  }

  const tempPart = temp > 0 ? `${temp}°C, ` : '';
  return tj('wgDefault', 'The weather is looking good for a mountain day. {{tempPart}}what kind of adventure are you after?', { tempPart });
}

/* Map a remembered mood to a short, localized "vibe" word for the opener. */
function vibeWord(mood) {
  const m = (mood || '').toLowerCase();
  const key = {
    peaceful: 'memVibePeaceful', calm: 'memVibePeaceful',
    epic: 'memVibeEpic',
    food: 'memVibeFood',
    romantic: 'memVibeRomantic',
    challenge: 'memVibeChallenge', hard: 'memVibeChallenge',
    view: 'memVibeView', lake: 'memVibeWater', water: 'memVibeWater',
  }[m];
  if (!key) return null;
  return tj(key, { memVibePeaceful: 'something calm', memVibeEpic: 'something epic',
    memVibeFood: 'a good lunch stop', memVibeRomantic: 'something special',
    memVibeChallenge: 'a real challenge', memVibeView: 'big views',
    memVibeWater: 'lakes and water' }[key]);
}

/* A warm, memory-aware opener for a returning user — built only from structured
   signals we actually captured (never invented). */
function buildReturningOpener(mem) {
  const lc = mem?.lastCompleted;
  if (lc?.trailName) {
    if (lc.rating === 3) return tj('memLegsTough', 'Welcome back ✦ Those legs recover after {{trail}}? Ready for the next one?', { trail: lc.trailName });
    return tj('memLegs', 'Welcome back ✦ How were the legs after {{trail}}? Where to next?', { trail: lc.trailName });
  }
  const vibe = vibeWord(mem?.lastMood);
  if (vibe) return tj('memVibe', 'Welcome back ✦ Last time you were after {{vibe}} — same vibe today, or something different?', { vibe });
  if (mem?.lastRegion) return tj('memRegion', 'Welcome back ✦ Another day in {{region}}, or somewhere new today?', { region: mem.lastRegion });
  return tj('memGeneric', 'Welcome back ✦ Good to see you again — where are we headed today?');
}

/* ── Crowd dispersal note — voices the backend `dispersal` signal ────────
   Returns { text, chips } or null. The hotspot stays the pick; we lead with a
   quieter, quality-matched alternative ("discovered a secret"), nudge timing,
   and surface the access reality. Mirrors buildWeatherGreeting's branch model. */
function buildDispersalNote(d, pick, alt) {
  if (!d || d.reason_code === 'none') return null;
  const lang = (i18nInstance.language || 'en').slice(0, 2);
  const place = d.hotspot_name || pick?.name || 'there';
  const access = d.access_note ? ` (${d.access_note[lang] || d.access_note.en || ''})` : '';
  const now = new Date();
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  const altWhy = alt ? (alt.why?.[lang] || alt.why?.en || '') : '';
  const altPhrase = alt ? (altWhy ? `${alt.name} — ${altWhy}` : alt.name) : '';

  const altChip = alt ? [tj('chipShowAlternative', 'Show me the quieter option')] : [];
  const decideChips = [...altChip, tj('chipPlanTomorrow', 'Plan it for tomorrow'), tj('chipGoAnyway', 'Go anyway')];

  switch (d.reason_code) {
    case 'beat_crowds':
      return {
        text: tj('dispBeatCrowds', "Go now — you'll have {{place}} almost to yourself before the crowds arrive.{{access}}", { place, access }),
        chips: null,
      };
    case 'peak_today':
      return {
        text: tj('dispPeakToday', "{{place}} is at its busiest right now{{access}}. Honestly? {{alt}} is just as beautiful and far quieter today — want that instead, or catch {{place}} at sunrise tomorrow?", { place, access, alt: altPhrase }),
        chips: decideChips,
      };
    case 'plan_tomorrow':
      return {
        text: tj('dispPlanTomorrow', "It's {{time}} — for {{place}} you really want a morning to beat the crowds and the parking.{{access}} Shall I line it up for tomorrow, or take {{alt}} now instead?", { time, place, access, alt: altPhrase }),
        chips: decideChips,
      };
    case 'daylight_risk':
      return {
        text: tj('dispDaylightRisk', "That's a {{hours}}h route and it's already {{time}} — you'd be finishing in the dark. {{alt}} is a safer call for today, or do {{place}} fresh tomorrow.", { hours: pick?.duration_hours, time, place, alt: altPhrase }),
        chips: decideChips,
      };
    default:
      return null;
  }
}

/* ── Trail preference session ────────────────────────────────────────── */
function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
function saveSession(data) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
  catch {}
}

/* ── Full chat state persistence (survives view navigation) ──────────── */
function saveChatState(state) {
  try { sessionStorage.setItem(CHAT_SAVE_KEY, JSON.stringify(state)); }
  catch {}
}
function loadChatState() {
  try { return JSON.parse(sessionStorage.getItem(CHAT_SAVE_KEY)); }
  catch { return null; }
}

// ─── Trail Detail Card ────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES  = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];

function ElevationSparkline({ gain, loss }) {
  if (!gain) return null;
  const w = 120, h = 32;
  // Simple asymmetric mountain profile: flat start → climb → peak → descent
  const peakX = loss ? Math.round(w * (gain / (gain + (loss || gain)))) : Math.round(w * 0.6);
  const baseY = h - 4;
  const peakY = 4;
  const d = `M4,${baseY} C${Math.round(peakX * 0.4)},${baseY} ${Math.round(peakX * 0.7)},${peakY + 4} ${peakX},${peakY} C${Math.round(peakX + (w - peakX) * 0.3)},${peakY + 4} ${Math.round(w - 4)},${baseY - 6} ${w - 4},${baseY}`;
  return (
    <div className="jc-tc__elev">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
        <defs>
          <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.05"/>
          </linearGradient>
        </defs>
        <path d={`${d} L${w - 4},${baseY} L4,${baseY} Z`} fill="url(#elevGrad)"/>
        <path d={d} stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span className="jc-tc__elev-label">↑ {gain}m{loss ? ` ↓ ${loss}m` : ''}</span>
    </div>
  );
}

function SeasonStrip({ bestSeason }) {
  if (!bestSeason?.length) return null;
  const currentMonthName = MONTH_NAMES[new Date().getMonth()];
  return (
    <div className="jc-tc__season">
      {MONTHS_SHORT.map((m, i) => {
        const full = MONTH_NAMES[i];
        const isBest = bestSeason.includes(full);
        const isCurrent = full === currentMonthName;
        return (
          <span
            key={m}
            className={`jc-tc__month${isBest ? ' jc-tc__month--best' : ''}${isCurrent ? ' jc-tc__month--now' : ''}`}
          >{m}</span>
        );
      })}
    </div>
  );
}

function RifugioStops({ rifugios }) {
  if (!rifugios?.length) return null;
  const typeIcon = (type) => {
    if (type === 'bivacco' || type === 'bivouac') return '⛺';
    if (type === 'malga')   return '🧀';
    return '🏠';
  };
  return (
    <div className="jc-tc__section">
      <p className="jc-tc__section-label">On the way</p>
      {rifugios.map(r => (
        <div key={r.id} className="jc-tc__rifugio">
          <span className="jc-tc__rifugio-icon">{typeIcon(r.type)}</span>
          <div className="jc-tc__rifugio-info">
            <span className="jc-tc__rifugio-name">{r.name}</span>
            {r.altitude && <span className="jc-tc__rifugio-alt">{r.altitude}m</span>}
          </div>
          <div className="jc-tc__rifugio-status">
            {r.open_now === true  && <span className="jc-tc__open">open</span>}
            {r.open_now === false && <span className="jc-tc__closed">closed</span>}
            {r.booking_required   && r.open_now !== false && <span className="jc-tc__book">book ahead</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TransportRow({ transport }) {
  const bus = transport?.bus;
  const car = transport?.car;
  if (!bus && !car) return null;
  // Trim car text — just extract the key info (first sentence)
  const carShort = car ? car.split('.')[0] + '.' : null;
  return (
    <div className="jc-tc__section">
      <p className="jc-tc__section-label">Getting there</p>
      {bus && (
        <div className="jc-tc__transport-row">
          <span className="jc-tc__transport-icon">🚌</span>
          <span className="jc-tc__transport-text">{bus}</span>
        </div>
      )}
      {carShort && (
        <div className="jc-tc__transport-row">
          <span className="jc-tc__transport-icon">🚗</span>
          <span className="jc-tc__transport-text">{carShort}</span>
        </div>
      )}
    </div>
  );
}

function TrailDetailCard({ trail, saved, onSave, onView, t }) {
  const highlights = (trail.highlights || []).slice(0, 2);
  return (
    <div className="jc-trail-card">
      {/* Photo */}
      <div className="jc-trail-card__photo-wrap">
        <img
          src={trailImg(trail, 'card')}
          alt={trail.name}
          className="jc-trail-card__photo"
          onError={onImgError}
        />
        <div className="jc-trail-card__photo-overlay" />
        {trail.in_season === false && (
          <span className="jc-trail-card__season-warn">⚠ Check season</span>
        )}
        <span className="jc-trail-card__pick-badge">
          <img src="/logo.webp" alt="" className="jc-trail-card__mark"
            onError={e => { e.currentTarget.style.display = 'none'; }} />
          {t('josephinePickBadge', "Josephine's Pick")}
        </span>
      </div>

      {/* Body */}
      <div className="jc-trail-card__body">
        <p className="jc-trail-card__region">{trail.region}</p>
        <h3 className="jc-trail-card__name">{trail.name}</h3>

        {/* Core stats row */}
        <div className="jc-trail-card__stats">
          <span>{trail.distance_km} km</span>
          <span className="jc-trail-card__dot">·</span>
          <span>{trail.duration_hours}h</span>
          <span className="jc-trail-card__dot">·</span>
          <span style={{ textTransform: 'capitalize' }}>{trail.difficulty}</span>
        </div>

        {/* Elevation sparkline */}
        <ElevationSparkline gain={trail.elevation_gain_m} loss={trail.elevation_loss_m} />

        {/* Season strip */}
        <SeasonStrip bestSeason={trail.best_season} />

        {/* Getting there */}
        <TransportRow transport={trail.transport} />

        {/* Rifugio stops */}
        <RifugioStops rifugios={trail.nearby_rifugios} />

        {/* Highlights */}
        {highlights.length > 0 && (
          <div className="jc-tc__section">
            <p className="jc-tc__section-label">Highlights</p>
            <ul className="jc-tc__highlights">
              {highlights.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
        )}

        {/* Josephine's insider note */}
        {trail.josephine_note && (
          <div className="jc-tc__insider">
            <p className="jc-tc__insider-text">"{trail.josephine_note}"</p>
            <span className="jc-tc__insider-sig">— Josephine</span>
          </div>
        )}

        {/* Actions */}
        <div className="jc-trail-card__actions">
          <button className="jc-trail-card__cta" onClick={onView}>
            {t('viewDetails', 'View full details →')}
          </button>
          <button
            className={`jc-trail-card__save-btn${saved ? ' jc-trail-card__save-btn--saved' : ''}`}
            onClick={e => { e.stopPropagation(); onSave(); }}
          >
            {saved ? '✓ Saved' : t('chipSaveHike', 'Save this hike')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────────────── */
function JosephineChat({ onBack, setCurrentView, viewTrail, onShowLogin, seedTrail, onSeedConsumed, onStartHike }) {
  const { currentUser } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authPromptMsg, setAuthPromptMsg] = useState('Sign in to save this hike to your favourites.');
  const [lang, setLang] = useState(() => i18nInstance.language?.slice(0, 2) || 'en');
  useEffect(() => {
    const handler = (lng) => setLang((lng || i18nInstance.language || 'en').slice(0, 2));
    i18nInstance.on('languageChanged', handler);
    return () => i18nInstance.off('languageChanged', handler);
  }, []);

  // Reset page scroll on mount so entering the chat never lands at the footer
  useEffect(() => { window.scrollTo(0, 0); }, []);
  // Reset the module-level location/weather globals on unmount so a fresh chat
  // session never reuses a previous session's coordinates or weather.
  useEffect(() => () => {
    userLat = WX_LAT; userLon = WX_LON; userLocated = false; lastWeather = null;
  }, []);
  // Tracked timers: the conversation choreography schedules many delayed
  // messages; `after` registers each id so they're all cancelled on unmount —
  // no setState-on-unmounted warnings or stray messages after navigating away.
  const _timers = useRef([]);
  const after = useCallback((fn, ms) => {
    const id = window.setTimeout(fn, ms);
    _timers.current.push(id);
    return id;
  }, []);
  useEffect(() => () => {
    _timers.current.forEach(window.clearTimeout);
    _timers.current = [];
  }, []);
  const t = useCallback(
    (key, fallback) => {
      const full = `josephineChat.${key}`;
      const val = i18nInstance.t(full);
      return (val && val !== full) ? val : (fallback ?? key);
    },
    [lang],
  );

  const MOODS = (_seasonConfig.moodTiles ?? []).map(m => ({ ...m }));
  const moodByLabel = Object.fromEntries(MOODS.map(m => [m.label, m.bundle]));

  /* Build initial messages using i18nInstance directly (no hook needed) */
  const _t0 = (k, fb) => {
    const full = `josephineChat.${k}`;
    const v = i18nInstance.t(full);
    return (v && v !== full) ? v : (fb ?? k);
  };
  const makeInitialMessages = useCallback(() => [
    { id: 1, from: 'josephine', type: 'text', state: 'idle', text: t('greeting'), chips: null },
  ], [t]);

  /* ── State ──────────────────────────────────────────────────────────── */
  const savedChatRef = useRef(loadChatState());

  const [messages, setMessages] = useState(() => {
    const saved = savedChatRef.current;
    if (saved?.messages?.length > 1) {
      // The first josephine greeting must never restore in a sleeping pose —
      // older sessions persisted it as 'peaceful'. Normalize it back to idle.
      return saved.messages.map((m, i) =>
        i === 0 && m.from === 'josephine' && m.state === 'peaceful'
          ? { ...m, state: 'idle' }
          : m
      );
    }
    return [
      { id: 1, from: 'josephine', type: 'text', state: 'idle', text: _t0('greeting'), chips: null },
    ];
  });

  const [input, setInput]             = useState('');
  const [typing, setTyping]           = useState(false);
  const [planningStep, setPlanningStep] = useState(() => savedChatRef.current?.planningStep ?? 0);
  const [planningData, setPlanningData] = useState(() => savedChatRef.current?.planningData ?? {});
  const [apiResults, setApiResults]   = useState([]);
  const [selectedTrail, setSelectedTrail] = useState(null);
  const [savedIds, setSavedIds]       = useState(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
  });
  const [refining, setRefining]           = useState(false);
  const [awaitingRefinement, setAwaitingRefinement] = useState(null); // 'length' | 'difficulty' | null
  const [awaitingWiden, setAwaitingWiden] = useState(false); // offered to widen past an unknown area
  const [awaitingMoodPrompt, setAwaitingMoodPrompt] = useState(false); // mood-first: next msg → a plan
  const [chatHistory, setChatHistory]     = useState([]);
  const [showMenu, setShowMenu]       = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [headerAvatarState, setHeaderAvatarState] = useState('idle');

  /* ── Chip freezing: chips in messages older than the latest user msg ── */
  const lastUserMsgId = messages.reduce(
    (max, m) => m.from === 'user' ? Math.max(max, m.id) : max, 0
  );
  const isChipActive = (msg) => msg.id > lastUserMsgId;

  /* ── The latest Josephine run's avatar is the "live" one (avatars only show
        on the first message of a run), so it follows the idle/sleep timer. ── */
  const lastJosephineAvatarId = messages.reduce((id, m, i) => {
    const firstInRun = m.from === 'josephine' && messages[i - 1]?.from !== 'josephine';
    return firstInRun ? m.id : id;
  }, 0);

  /* ── Idle sleep timer — Josephine dozes after 20s of no interaction ── */
  const idleTimerRef = useRef(null);
  const wakeJosephine = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setHeaderAvatarState('idle');
    idleTimerRef.current = setTimeout(() => setHeaderAvatarState('peaceful'), 20000);
  }, []);
  // Start timer on mount, clear on unmount
  React.useEffect(() => {
    wakeJosephine();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Refs ───────────────────────────────────────────────────────────── */
  const bottomRef        = useRef(null);
  const messagesRef      = useRef(null);
  const greetingShownRef = useRef(false);
  const inputRef         = useRef(null);
  const menuRef          = useRef(null);
  const prevLangRef      = useRef(lang);
  const recognitionRef   = useRef(null);
  const sendMsgRef       = useRef(null); // keeps sendMessage fresh for mic closure
  const lastAlmanacRef   = useRef(null); // the almanac moment currently offered
  const almanacRestRef   = useRef([]);   // remaining moments for "what else?"
  const seedConsumedRef  = useRef(false); // trail-seeded plan fires once

  /* ── Web Speech API ─────────────────────────────────────────────────── */
  const SpeechRecognitionAPI =
    (typeof window !== 'undefined' &&
     (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

  /* ── Persist chat state on every change ─────────────────────────────── */
  useEffect(() => {
    saveChatState({ messages, planningStep, planningData });
  }, [messages, planningStep, planningData]);

  /* ── Reset on language change ────────────────────────────────────────── */
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;
    setMessages(makeInitialMessages());
    setPlanningStep(0); setPlanningData({}); setApiResults([]);
    setSelectedTrail(null); setChatHistory([]); setAwaitingRefinement(null);
    try { sessionStorage.removeItem(CHAT_SAVE_KEY); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  /* ── Opening message: live weather or welcome-back ──────────────────── */
  useEffect(() => {
    if (greetingShownRef.current) return;
    // Seeded from a trail page → the seed effect drives the opening instead.
    if (seedTrail?.id) return;
    greetingShownRef.current = true;

    // Restoring a saved conversation — nothing to do
    if (savedChatRef.current?.messages?.length > 1) return;

    // Count the visit; a returning user gets a memory-aware opener instead of
    // the generic weather greeting. Everyone still gets the live almanac moment.
    const mem = recordVisit();
    const returning = isReturning();
    setTyping(true);

    const showMessage = async (lat, lon) => {
      userLat = lat; userLon = lon;
      let text, chips;
      if (returning) {
        text = buildReturningOpener(mem);
        chips = [t('chipSameVibe'), t('chipSomethingDifferent'), tj('chipMoodPlan', 'Plan my perfect day ✦')];
      } else {
        let weatherData = null;
        try {
          const res = await axios.get('/api/weather/current', { params: { lat, lon } });
          weatherData = res.data;
        } catch { /* fall through — null gives a generic message */ }
        text = buildWeatherGreeting(weatherData);
        chips = [tj('chipMoodPlan', 'Plan my perfect day ✦'), t('chipPlanMyDay'), t('chipSurpriseMe'), t('chipShowMap')];
      }
      setTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now(), from: 'josephine', type: 'text', text, chips,
      }]);

      // Living Almanac: if something fleeting is happening on the mountain right
      // now, Josephine leads with it — the "told to you" soul moment.
      const moments = await fetchAlmanac(lat, lon, 3);
      if (moments.length) {
        almanacRestRef.current = moments.slice(1);
        // Append directly (not via the tracked `after` timer) so StrictMode's
        // mount/unmount cleanup can't clear it before it fires.
        showAlmanacMoment(moments[0]);
      }
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { userLocated = true; showMessage(pos.coords.latitude, pos.coords.longitude); },
        ()  => showMessage(WX_LAT, WX_LON),
        { timeout: 5000, maximumAge: 300000 },
      );
    } else {
      showMessage(WX_LAT, WX_LON);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Seeded from a trail page: open straight into a plan for that hike ── */
  useEffect(() => {
    if (!seedTrail?.id || seedConsumedRef.current) return;
    seedConsumedRef.current = true;
    greetingShownRef.current = true;
    const name = seedTrail.name || tj('seedThisHike', 'this hike');
    setMessages(prev => [...prev, {
      id: Date.now(), from: 'user', type: 'text',
      text: tj('seedUserMsg', 'Plan {{trail}} for me', { trail: name }),
    }]);
    requestPlan(tj('seedIntro', 'A perfect day on {{trail}}', { trail: name }),
                { seed_trail_id: seedTrail.id });
    onSeedConsumed && onSeedConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedTrail]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    if (!showMenu) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  // Infer the right avatar clip from message type when no state is given explicitly.
  const inferAvatarState = (partial) => {
    if (partial.state) return partial.state;
    switch (partial.type) {
      case 'trail-card':
      case 'options':    return 'hero';
      case 'almanac':
      case 'mood-intro':
      case 'conditions': return 'idle';
      default: {
        // Detect apology / error / no-result text → concerned
        const t = partial.text || '';
        if (/couldn.t|can.t find|no trail|sorry|error|unfortunately|didn.t|nothing|no result/i.test(t))
          return 'concerned';
        return 'idle';
      }
    }
  };

  const appendJosephineMessage = (partial) => {
    const state = inferAvatarState(partial);
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), from: 'josephine', state, ...partial }]);
  };
  const appendUserMessage = (text) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), from: 'user', type: 'text', text, chips: null }]);
  };

  /* ── Living Almanac — fleeting local moments Josephine *tells* you ────── */
  const buildAlmanacChips = (m) => {
    const chips = [];
    if (m?.cta?.interest) chips.push(tj('chipAlmanacPlan', 'Plan around it'));
    if (almanacRestRef.current.length) chips.push(tj('chipAlmanacMore', 'What else?'));
    return chips.length ? chips : null;
  };
  const showAlmanacMoment = (m) => {
    lastAlmanacRef.current = m;
    appendJosephineMessage({
      type: 'almanac',
      text: `${m.emoji ? m.emoji + ' ' : ''}${m.voice}`,
      validity: m.validity,
      chips: buildAlmanacChips(m),
    });
  };
  const fetchAlmanac = async (lat, lon, limit = 3) => {
    try {
      const params = { now: new Date().toISOString(), lang, limit };
      if (lat != null && lon != null) { params.lat = lat; params.lon = lon; }
      const res = await axios.get('/api/almanac', { params });
      return res.data?.moments || [];
    } catch { return []; }
  };

  /* ── Mood-first planning → the Daily Plan Card ───────────────────────── */
  const requestPlan = async (prompt, extra = {}) => {
    setTyping(true);
    try {
      const body = { prompt, lang, now: new Date().toISOString(), ...extra };
      if (userLat != null && userLon != null) { body.lat = userLat; body.lon = userLon; }
      const res = await axios.post('/api/josephine/plan', body);
      const plan = res.data?.plan;
      setTyping(false);
      if (plan?.trail) {
        setApiResults([plan.trail]);   // keeps follow-up Q&A grounded on the pick
        rememberFromPlan(plan);        // learn region/difficulty/mood for next visit
        appendJosephineMessage({ type: 'plan', plan, chips: null });
      } else {
        appendJosephineMessage({
          type: 'text',
          text: plan?.josephine_says || tj('windError', "The mountain winds are interfering with my signal — try again in a moment!"),
          chips: [t('chipPlanMyDay'), t('chipStartOver')],
        });
      }
    } catch {
      setTyping(false);
      appendJosephineMessage({ type: 'text', text: t('windError'), chips: [t('chipStartOver')] });
    }
  };

  const handlePlanAlt = (a) => {
    if (!a) return;
    if (a.kind === 'tomorrow') {
      appendJosephineMessage({
        type: 'text',
        text: tj('planTomorrowAck', 'Lovely — same place at sunrise tomorrow. You beat the crowds and catch the best light.'),
        chips: [t('chipStartOver')],
      });
      return;
    }
    if (a.trail_id) {
      setTyping(true);
      axios.get(`/api/trails/${a.trail_id}`).then(res => {
        setTyping(false);
        appendJosephineMessage({ type: 'options', trails: [res.data], chips: [t('chipStartOver')] });
      }).catch(() => setTyping(false));
    }
  };

  /* ── Clear conversation ─────────────────────────────────────────────── */
  const clearConversation = () => {
    setMessages(makeInitialMessages());
    setPlanningStep(0); setPlanningData({}); setApiResults([]);
    setSelectedTrail(null); setRefining(false); setChatHistory([]);
    setAwaitingRefinement(null); setInput(''); setShowMenu(false);
    try { sessionStorage.removeItem(CHAT_SAVE_KEY); } catch {}
  };

  /* ── Share ──────────────────────────────────────────────────────────── */
  const shareConversation = () => {
    const lines = ['🏔 My plan with Josephine\n'];
    messages.forEach(m => {
      if (m.from === 'user' && m.type === 'text') lines.push(`You: ${m.text}`);
      else if (m.from === 'josephine' && m.type === 'text' && m.text) lines.push(`Josephine: ${m.text}`);
      else if (m.type === 'trail' && m.trail) lines.push(`📍 Trail: ${m.trail.name}`);
    });
    lines.push('\nPlanned with Josephine — your alpine companion in South Tyrol.');
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyFeedback(true);
      setShowMenu(false);
      after(() => setCopyFeedback(false), 2000);
    }).catch(() => {});
  };

  /* ── Weather remark — short Josephine quip that follows the card ────────
     Rotates through variants so it never feels copy-pasted.                */
  const buildWeatherRemark = useCallback((conditions, seed = 0) => {
    const { temp, condTitle, wind } = conditions;

    let variants;
    if (/storm|morning window/i.test(condTitle)) {
      variants = [
        tj('remarkStorm1', "Waterproof jacket on, early start, off the ridge before noon. Those afternoon clouds aren't negotiating."),
        tj('remarkStorm2', "Pack a rain shell and move early. Once those storms build over the peaks, they mean it."),
        tj('remarkStorm3', "Get moving before 09:00. Rain layer on top, and keep an eye on the south sky."),
      ];
    } else if (/rain|waterproof/i.test(condTitle)) {
      variants = [
        tj('remarkRain1', "Grab a waterproof jacket — forest paths in the rain are stunning, you just need the right kit."),
        tj('remarkRain2', "It'll be moody and beautiful out there. Rain jacket, waterproof boots, and lean into it."),
        tj('remarkRain3', "Pack a proper rain layer. The mountains have a whole other mood when it's wet."),
      ];
    } else if (/fog|atmospheric|mist/i.test(condTitle)) {
      variants = [
        tj('remarkFog1', "Misty conditions — stick to marked paths and enjoy that rare light."),
        tj('remarkFog2', "The fog gives the valleys a completely different personality. Low routes, good footing, no rush."),
      ];
    } else if (temp > 27 || /heat/i.test(condTitle)) {
      variants = [
        tj('remarkHeat1', '{{temp}}°C today — sunscreen, sunglasses, and at least 2 litres of water before you set off.', { temp }),
        tj('remarkHeat2', "It's hot. Sunglasses, sunscreen, full water bottle. Start early or head straight to altitude."),
        tj('remarkHeat3', "Serious mountain sun today. Factor 50 above 2000m — the rock reflects more UV than you'd expect."),
      ];
    } else if (wind && wind > 30) {
      variants = [
        tj('remarkWind1', 'Wind up to {{wind}} km/h on the exposed sections — a windproof shell makes a real difference up high.', { wind }),
        tj('remarkWind2', "{{wind}} km/h on the ridges. Windproof layer on top and you're set.", { wind }),
      ];
    } else if (/perfect|clear/i.test(condTitle)) {
      variants = [
        tj('remarkPerfect1', "Sunglasses and sunscreen — the high-altitude sun is stronger than it looks."),
        tj('remarkPerfect2', "Perfect day. Sunscreen, camera, and don't forget a light layer for the descent when it cools."),
        tj('remarkPerfect3', "Clear skies, strong sun at altitude. Sunglasses aren't optional up here."),
      ];
    } else {
      variants = [
        tj('remarkDefault1', "Light jacket in the pack — temperature drops fast when cloud rolls over the peaks."),
        tj('remarkDefault2', "Lovely hiking weather. A thin layer in your bag and you're good to go."),
        tj('remarkDefault3', "No weather drama today. Pack light and enjoy it."),
      ];
    }

    return variants[seed % variants.length];
  }, []);

  /* ── Conditions builder (adaptive title + context-aware bullets) ──────── */
  const buildConditions = (w) => {
    const desc = (w?.description || '').toLowerCase();
    const temp = w?.temperature ?? 14;
    let sky, emoji, condTitle, vis, tip;

    if (/thunder|storm/.test(desc)) {
      sky      = t('skyRain', 'Showers possible');
      emoji    = '⛈';
      condTitle = t('conditionsStorm', 'Storm risk — short morning window only');
      vis      = t('visReduced', 'Reduced visibility at altitude');
      tip      = t('tipStorm', 'Be back in the valley before 13:00');
    } else if (/rain|shower|drizzle/.test(desc)) {
      sky      = t('skyRain', 'Rain expected');
      emoji    = '🌧️';
      condTitle = t('conditionsRain', 'Pack your waterproofs today.');
      vis      = t('visReduced', 'Limited visibility possible');
      tip      = t('tipRain', 'Rifugio hops and forest paths are ideal today');
    } else if (/fog|mist/.test(desc)) {
      sky      = t('skyFog', 'Misty');
      emoji    = '🌫️';
      condTitle = t('conditionsFog', 'Atmospheric morning — low routes best');
      vis      = t('visFog', 'Patchy fog at altitude');
      tip      = t('tipFog', 'Stick to marked paths — valley trails are magic today');
    } else if (/clear|sun/.test(desc)) {
      sky      = t('skyClear', 'Clear skies');
      emoji    = '☀️';
      condTitle = temp > 27
        ? t('conditionsHot', 'Great day — start early to beat the heat')
        : t('conditionsClear', 'Perfect hiking weather today!');
      vis      = (w?.visibility ?? 10) >= 9
        ? t('visExcellent', 'Excellent visibility')
        : t('visGood', 'Good visibility');
      tip      = temp > 27
        ? t('tipHot', 'Head to altitude or start before 09:00 — valley heat builds fast')
        : t('tipClear', 'Start by 09:00 for the best light and coolest air');
    } else if (/cloud|overcast/.test(desc)) {
      const few = /few|scattered|partly/.test(desc);
      sky      = few ? t('skyPartly', 'Partly cloudy') : t('skyCloudy', 'Overcast');
      emoji    = few ? '⛅' : '☁️';
      condTitle = t('conditionsGood', 'Good conditions today');
      vis      = (w?.visibility ?? 10) >= 7
        ? t('visGood', 'Good visibility')
        : t('visMod', 'Moderate visibility');
      tip      = t('tipCloud', 'No storm risk — great day for a long walk');
    } else {
      sky      = t('skyPartly', 'Partly cloudy');
      emoji    = '⛅';
      condTitle = t('conditionsGood', 'Good conditions today');
      vis      = t('visGood', 'Good visibility');
      tip      = t('tipCloud', 'Conditions look fine — enjoy the mountains');
    }

    return { temp, sky, emoji, vis, tip, wind: w?.wind_speed ?? null, condTitle };
  };

  /* ── Plan flow ───────────────────────────────────────────────────────── */
  const startPlanningFlow = () => {
    setPlanningStep(1);
    setPlanningData({});
    setApiResults([]);
    setSelectedTrail(null);
    setRefining(false);
    after(() => {
      // Combined intro text + mood grid in one message (removes the visual gap between them)
      appendJosephineMessage({ type: 'mood-intro', text: t('moodIntro'), moods: MOODS });
    }, 450);
  };

  const runConditionsThenOptions = async (data) => {
    setPlanningStep(2);
    setTyping(true);
    let conditions;
    try {
      const w = await axios.get('/api/weather/current', { params: { lat: userLat, lon: userLon } });
      lastWeather = w.data;
      conditions = buildConditions(w.data);
    } catch {
      conditions = buildConditions(null);
    }
    setTyping(false);
    appendJosephineMessage({ type: 'conditions', conditions });
    // Short weather remark — appears 900ms after card, before trail results
    after(() => {
      appendJosephineMessage({
        type: 'text',
        text: buildWeatherRemark(conditions, Date.now()),
        chips: null,
      });
    }, 900);
    after(() => callRecommendAPI(data), 1800);
  };

  const callRecommendAPI = async (data, adjustments = {}) => {
    setPlanningStep(2);
    setTyping(true);
    setRefining(false);

    let duration   = data.duration_hours ?? 3;
    let difficulty = data.difficulty ?? 'medium';
    if (adjustments.durationDown)   duration   = Math.max(1.5, duration - 1.5);
    if (adjustments.difficultyDown) difficulty = difficulty === 'hard' ? 'medium' : 'easy';

    const interests = [...(data.interests || []), ...(data.withDog ? ['dog-friendly'] : [])];

    try {
      const response = await axios.post('/api/ai/recommend', {
        duration_hours: duration, difficulty, interests,
        family_friendly: data.family_friendly ?? false,
        start_area: data.startArea ?? '',
        ...(data.max_distance_km ? { max_distance_km: data.max_distance_km } : {}),
        // Temporal/crowd-dispersal inputs (degrade gracefully server-side).
        now: new Date().toISOString(),
        ...(lastWeather ? { weather: { description: lastWeather.description, sunset: lastWeather.sunset } } : {}),
      });
      // Backend signals no trails near the requested area
      if (response.data.area_not_found) {
        const area = response.data.area || data.startArea || 'that area';
        setTyping(false);
        setAwaitingWiden(true); // a typed "yes" should trigger the wider search too
        after(() => {
          appendJosephineMessage({
            type: 'text',
            text: tj('noTrailsNearArea', "I don't have any trails near {{area}} in my database yet. Try a nearby valley or village — or let me suggest something in the wider South Tyrol region?", { area }),
            chips: [tj('chipSuggestWider', 'Yes, suggest something'), t('chipStartOver')],
          });
        }, 350);
        return;
      }
      // Backend signals no dog-friendly trail matched — be honest, don't
      // recommend a dog-hostile trail to someone hiking with a dog.
      if (response.data.no_dog_friendly) {
        setTyping(false);
        after(() => {
          appendJosephineMessage({
            type: 'text',
            text: tj('noDogFriendly', "I couldn't find a dog-friendly trail that fits here — I'd rather tell you than send you somewhere your dog isn't welcome. Want me to widen the search or drop the area?"),
            chips: [t('chipPlanMyDay'), t('chipStartOver')],
          });
        }, 350);
        return;
      }

      const results = (response.data.results || []).slice(0, 3);
      setApiResults(results);
      setTyping(false);

      if (results.length) {
        const first = results[0];
        saveSession({
          duration_hours: duration, difficulty, interests,
          lastTrail: first.id, lastDifficulty: first.difficulty, lastRegion: first.region,
        });
        // Intro copy must match the number of trails actually shown — promising
        // "three" when only one or two match (e.g. a specific area like Tirolo)
        // reads as a bug.
        const introsByCount = {
          1: [
            tj('introOne1', 'I found one that fits beautifully — here it is. ✦'),
            tj('introOne2', "One pick stands out for what you're after. Take a look. ✦"),
            tj('introOne3', "Here's the one I'd choose for you today. ✦"),
          ],
          2: [
            tj('introTwo1', 'I found two lovely options for you. Take a look. ✦'),
            tj('introTwo2', "Here are two trails I think you'll love. ✦"),
            tj('introTwo3', 'Two picks — both curated for today. Which speaks to you? ✦'),
          ],
          3: [
            tj('introThree1', "I found three beautiful options for you. Each one fits what you're after. ✦"),
            tj('introThree2', "Here are three trails I think you'll love. Take a look. ✦"),
            tj('introThree3', 'Three picks — all curated for today. Let me know which speaks to you. ✦'),
            tj('introThree4', "I've pulled three routes that match perfectly. Which feels right? ✦"),
          ],
        };
        const optionsIntros = introsByCount[results.length] || introsByCount[3];

        // ── Geographic awareness: warn if trail region is far from user ──────
        // Primary: compare against user's actual GPS position (most accurate).
        // Fallback: if GPS is unavailable, compare against their typed start area.
        const distWarning =
          checkDistanceFromGPS(userLat, userLon, first.region) ??
          (data.startArea ? checkDistanceWarning(data.startArea, first.region) : null);

        after(() => {
          appendJosephineMessage({ type: 'text', text: optionsIntros[Math.floor(Math.random() * optionsIntros.length)], chips: null });
          appendJosephineMessage({
            type: 'options', trails: results,
            chips: [t('chipTooLong'), t('chipTooHard'), t('chipStartOver')],
          });
          // Crowd-dispersal note takes priority over the generic distance note
          // (its access_note already covers the "how to get there" for hotspots)
          // — never stack both.
          const disp = first.dispersal
            ? buildDispersalNote(first.dispersal, first, first.dispersal.suggested_alternative)
            : null;
          if (disp) {
            after(() => {
              appendJosephineMessage({ type: 'text', text: disp.text, chips: disp.chips });
            }, 600);
          } else if (distWarning) {
            after(() => {
              appendJosephineMessage({
                type: 'text',
                text: buildTransportNote(distWarning, Date.now()),
                chips: [tj('chipYesWorks', 'Yes, this works'), tj('chipFindCloser', 'Find something closer')],
              });
            }, 600);
          }
        }, 350);
      } else {
        after(() => {
          appendJosephineMessage({
            type: 'text', text: t('noMatchIntro'),
            chips: [t('chipStartOver')],
          });
        }, 350);
      }
    } catch (err) {
      // Surface the real cause so production failures are diagnosable from
      // the browser console (status + server error body) instead of only the
      // generic "mountain winds" copy the user sees.
      console.error(
        '[recommend] request failed:',
        err?.response?.status,
        err?.response?.data || err?.message || err
      );
      setTyping(false);
      setPlanningStep(0);
      after(() => {
        appendJosephineMessage({
          type: 'text', text: t('windError'),
          chips: [t('retryChip'), t('chipStartOver')],
        });
      }, 350);
    }
  };

  /* Trail option tapped → expanded card in chat */
  const showTrailDetail = (trail) => {
    setSelectedTrail(trail);
    appendUserMessage(trail.name);
    setTyping(true);
    after(() => {
      setTyping(false);
      appendJosephineMessage({
        type: 'trail-card', trail,
        chips: [t('chipTooLong'), t('chipTooHard'), t('chipStartOver')],
      });
    }, 500);
  };

  /* "Go to this hike" → open full trail detail (guests are gated to a taste) */
  const gotoHike = (trail) => {
    if (!trail) return;
    // Opening the full hike page is members-only; guests stay in the chat
    // "taste" and get the sign-in prompt instead of navigating out.
    if (!currentUser) {
      setAuthPromptMsg('Sign in to open the full hike and start your adventure.');
      setShowAuthPrompt(true);
      return;
    }
    if (viewTrail) viewTrail(trail);
    else showTrailDetail(trail);
  };

  /* Save → persist + itinerary timeline with "View saved" CTA */
  const saveHike = (trail) => {
    if (!trail) return;
    // Saving is a members-only feature — guests get the sign-in prompt instead
    // of a silent localStorage write that never syncs to an account.
    if (!currentUser) {
      setAuthPromptMsg('Sign in to save this hike to your favourites.');
      setShowAuthPrompt(true);
      return;
    }
    setSavedIds(prev => {
      const next = prev.includes(trail.id) ? prev : [...prev, trail.id];
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    appendJosephineMessage({
      type: 'itinerary', trail, steps: buildItinerary(trail),
      chips: [t('chipViewSaved'), t('chipStartOver')],
    });
  };

  const buildItinerary = (trail) => {
    const dur = trail.duration_hours || 3;
    const fmt = (h) => `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h - Math.floor(h)) * 60)).padStart(2,'0')}`;
    const start = 9;
    const stopName = trail.pois?.[0]?.name || t('itinStop', 'Rest & refuel');
    return [
      { time: fmt(start),              label: t('itinStart',  'Set off'),      place: trail.region || '' },
      { time: fmt(start + 0.2),        label: t('itinTrail',  'On the trail'), place: trail.name },
      { time: fmt(start + dur * 0.55), label: t('itinStop',   'Rest & refuel'), place: stopName },
      { time: fmt(start + dur),        label: t('itinReturn', 'Head home'),    place: '' },
    ];
  };

  const goodToKnowRows = (trail) => {
    const rows = [];
    if (trail.best_season?.length) {
      const s = trail.best_season;
      rows.push([t('gtkBestTime', 'Best time'), s.length > 1 ? `${s[0]}–${s[s.length-1]}` : s[0]]);
    }
    if (trail.trail_type)  rows.push([t('gtkTrailType', 'Trail type'), String(trail.trail_type).replace(/_/g, ' ')]);
    const parking = trail.trailhead_info?.parking || trail.transport?.car;
    if (parking)           rows.push([t('gtkParking', 'Parking'), parking]);
    const fac = Array.isArray(trail.facilities) ? trail.facilities : [];
    if (fac.length)        rows.push([t('gtkFacilities', 'Facilities'), fac.slice(0, 3).join(', ')]);
    if (trail.crowding?.level) rows.push([t('gtkCrowds', 'Crowds'), String(trail.crowding.level)]);
    if (trail.dog_friendly)    rows.push([t('gtkDog', 'Dogs'), '✓']);
    if (trail.family_friendly) rows.push([t('gtkFamily', 'Family'), '✓']);
    return rows.slice(0, 6);
  };

  /* ── Freeform intent parser ──────────────────────────────────────────── */
  const parseRecommendIntent = (text) => {
    const tl = text.toLowerCase();

    // Theme / mood keywords → the real interest tags used by the trail
    // catalog (panoramic views, alpine lakes, forests, summits, waterfalls,
    // glaciers, wildlife, cultural routes). Matching one of these is what
    // lets discovery queries like "where can I see a waterfall?" or
    // "I want a moody hike" reach the free local recommend engine instead
    // of the generic chat fallback (which needs an API key).
    const THEMES = [
      [/\bwaterfalls?\b|\bcascad/i,                                   'waterfalls'],
      [/\blakes?\b|\btarns?\b|\bturquoise\b/i,                        'alpine lakes'],
      [/\bglaciers?\b|\bice\b|\bsnowfield/i,                          'glaciers'],
      [/\bforests?\b|\bwoods?\b|\bwoodland\b|\btrees?\b/i,            'forests'],
      [/\bsummits?\b|\bpeaks?\b|\bridge\b|\bscrambl|\bvia ferrata\b/i,'summits'],
      [/\bwildlife\b|\bmarmot|\banimals?\b|\bbirds?\b|\bdeer\b/i,     'wildlife'],
      [/\bcultur|\bhistor|\bheritage\b|\bchurch|\bcastle|\bvillage|\bmalga|\bfarm|\bcheese\b/i, 'cultural routes'],
      // light / atmosphere / mood → scenic panoramic trails
      [/\bsunset|\bsunrise|\bgolden hour|\balpenglow|\bstargaz|\bnight sky\b/i,                         'panoramic views'],
      [/\bmoody|\batmospher|\bmisty|\bmist\b|\bfoggy|\bfog\b|\bdramatic|\bwild\b|\bromantic|\bpeaceful|\bquiet|\bserene|\bmagical?\b/i, 'panoramic views'],
      [/\bview|\bpanoram|\bvista|\bscenic|\blookout|\boverlook|\bphoto\b/i,                             'panoramic views'],
      [/\bwildflower|\bbloom|\bmeadow|\bflowers?\b/i,                                                   'panoramic views'],
    ];
    const themeInterests = [];
    for (const [re, tag] of THEMES) {
      if (re.test(tl) && !themeInterests.includes(tag)) themeInterests.push(tag);
    }

    const TRIGGERS = [
      // explicit ask patterns
      'give me a hike','find me a hike','suggest a hike','recommend a hike',
      'give me a trail','find me a trail','suggest a trail',
      'give me something','find something','show me a hike','show me a trail',
      // "any hike / trail / walk"
      'any hike','any trail','any walk',
      // "a hike/trail from/near"
      'a hike from','a trail from','hike starting from','trail starting from',
      'hike near','trail near','something near','walk near',
      // "where / what"
      'where can i hike','where should i hike','where to hike',
      'what trail','what hike','what hikes','what trails','what walks',
      // "can I do / can I go"
      'can i do','can i go hiking','can i go for a hike',
      // "I want to hike / walk"
      'i want to hike','i want to walk','i want a hike','i want a trail',
      // "looking for a hike / trail"
      'looking for a hike','looking for a trail','looking for a walk',
    ];
    // "hike/hikes/trail/trails/walk in [place]" — handles plurals too
    const hasInPlace = /\bhikes?\b.*\bin\b|\btrails?\b.*\bin\b|\bwalks?\b.*\bin\b|\bsomething\b.*\bin\b/i.test(tl);
    // "do starting in / do in" patterns
    const hasDoIn = /\bdo\b.*\bstarting\s+in\b|\bdo\b.*\bin\b.*\??\s*$/i.test(tl);
    // Discovery verbs + a hike/theme word are enough on their own.
    const hasDiscoveryVerb = /\b(where can i|where should i|where to|i want|i'd like|i would like|i'm looking for|looking for|show me|take me|suggest|recommend|to see|go see|see (?:a|some|the)|how about|what about|got any|any good)\b/i.test(tl);
    const hasHikeWord = /\b(hike|hikes|trail|trails|walk|walks|route|routes|path|paths)\b/i.test(tl);
    const dogAsk = /\bdog|\bpup\b|\bpooch\b/i.test(tl);

    const triggered =
      TRIGGERS.some(x => tl.includes(x)) ||
      hasInPlace || hasDoIn ||
      (themeInterests.length > 0 && (hasDiscoveryVerb || hasHikeWord)) ||
      (dogAsk && hasHikeWord);

    if (!triggered) return null;

    // Match explicit prepositions first; fall back to "in"/"at" for place names.
    // "staying at / at <hotel>" lets a guest give their accommodation as origin
    // (the backend resolves hotels/POIs, not just towns).
    const loc = text.match(/(?:starting from|starting at|close to|staying at|stay at|coming from|from|near|around)\s+([A-Za-zÀ-ÿ\s'’.&-]+?)(?:\s*$|\s*[,.?!])/i)
             ?? text.match(/\bat\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'’.&-]{1,34})(?:\s*$|\s*[,.?!])/i)
             ?? text.match(/\bin\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'’.&-]{1,24})(?:\s*$|\s*[,?.])/i);
    // Filter out non-geographic phrases (times, seasons, filler).
    const NON_PLACES = /^(the |a |an |my |this |that |summer|winter|spring|autumn|fall|morning|afternoon|evening|night|noon|midday|altitude|home|july|june|august|mind|order|least|most|all)\b/i;
    const rawArea = loc ? loc[1].trim() : '';
    const startArea = (rawArea && NON_PLACES.test(rawArea)) ? '' : rawArea;
    // null = the user didn't name a difficulty → the engine shouldn't bias.
    let difficulty = null;
    if (/\b(easy|beginner|gentle|relaxed|stroll|leisurely|family)\b/i.test(text)) difficulty = 'easy';
    if (/\b(hard|difficult|challenging|strenuous|expert|tough|demanding)\b/i.test(text)) difficulty = 'hard';

    const interests = [...themeInterests];
    if (/\bloop\b/i.test(text) && !interests.includes('loop')) interests.push('loop');
    if (dogAsk) interests.push('dog-friendly');
    return { startArea, difficulty, interests };
  };

  /* ── Freeform send ───────────────────────────────────────────────────── */
  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;
    wakeJosephine();
    const trimmed = text.trim();
    const tl = trimmed.toLowerCase();
    // The trail the conversation is currently centred on (an opened trail, or
    // the top recommendation). Used for context-aware Q&A and to ground Haiku.
    const ctxTrail = selectedTrail || apiResults[0] || null;

    // ── Refinement follow-up: length ────────────────────────────────────
    if (awaitingRefinement === 'length') {
      const kmMatch = tl.match(/(?:under|below|less than|max|maximum)?\s*(\d+(?:\.\d+)?)\s*km?/i);
      const maxKm = kmMatch ? parseFloat(kmMatch[1])
        : tl.includes('5') ? 5
        : tl.includes('8') ? 8
        : tl.includes('12') ? 12
        : null;
      if (maxKm) {
        appendUserMessage(trimmed);
        setInput('');
        setAwaitingRefinement(null);
        setRefining(true);
        const d = { ...planningData, max_distance_km: maxKm };
        setPlanningData(d);
        const acks = [
          tj('refLenAck1', 'Perfect — finding trails under {{km}} km for you.', { km: maxKm }),
          tj('refLenAck2', "On it — I'll keep it under {{km}} km.", { km: maxKm }),
          tj('refLenAck3', 'Got it. Looking for something under {{km}} km now.', { km: maxKm }),
        ];
        appendJosephineMessage({ type: 'text', text: acks[Math.floor(Math.random() * acks.length)], chips: null });
        callRecommendAPI(d);
        return;
      }
    }

    // ── Refinement follow-up: difficulty ────────────────────────────────
    if (awaitingRefinement === 'difficulty') {
      let newDifficulty = null;
      // Keyword match across EN/IT/DE so the translated difficulty chips and
      // free-typed answers all resolve.
      if (/easy|gentle|relaxed|beginner|stroll|simple|facile|tranquill|leggera|principiant|leicht|gemütlich|einfach|anfänger/i.test(tl)) newDifficulty = 'easy';
      else if (/moderate|medium|normal|manageable|moderat|media|gestibile|mittel|machbar/i.test(tl)) newDifficulty = 'medium';
      else if (/any|whatever|don.t mind|surprise|qualsiasi|qualunque|non importa|sorprend|egal|beliebig|überrasch/i.test(tl)) newDifficulty = planningData.difficulty ?? 'medium';
      if (newDifficulty) {
        appendUserMessage(trimmed);
        setInput('');
        setAwaitingRefinement(null);
        setRefining(true);
        const d = { ...planningData, difficulty: newDifficulty, max_distance_km: undefined };
        setPlanningData(d);
        const acks = {
          easy: [tj('refDiffEasy1', 'Perfect — finding something easy and scenic.'), tj('refDiffEasy2', 'On it — a relaxed trail, coming up.'), tj('refDiffEasy3', 'Easy it is. Looking now.')],
          medium: [tj('refDiffMed1', 'Great — looking for a moderate route.'), tj('refDiffMed2', 'On it — something balanced, coming up.'), tj('refDiffMed3', 'Moderate works. Searching now.')],
        };
        const pool = acks[newDifficulty] || acks.medium;
        appendJosephineMessage({ type: 'text', text: pool[Math.floor(Math.random() * pool.length)], chips: null });
        callRecommendAPI(d);
        return;
      }
    }

    // ── Affirmative reply to the "suggest in the wider region?" offer ────
    // She offered to widen past an unknown area; a typed "yes/sure/please"
    // must actually deliver instead of falling through to the LLM fallback.
    if (awaitingWiden) {
      if (/\b(yes|yeah|yep|sure|ok|okay|please|go ahead|sounds good|do it|why not|suggest|you can|go for it|s[iì]|certo|va bene|certamente|ja|gerne|klar|bitte)\b/i.test(tl)) {
        appendUserMessage(trimmed);
        setInput('');
        widenToRegion();
        return;
      }
      setAwaitingWiden(false); // said something else — let the offer lapse
    }

    // ── Mood-first: "the day you want" → a Daily Plan Card ───────────────
    if (awaitingMoodPrompt) {
      setAwaitingMoodPrompt(false);
      appendUserMessage(trimmed);
      setInput('');
      requestPlan(trimmed);
      return;
    }

    // ── "What's happening / in season right now?" → the Living Almanac ───
    if (/\bwhat'?s (happening|on|good|special|in season|blooming)\b|\banything (special|happening|good|going on)\b|\bthis week\b|\bin season\b|\bseasonal\b|\bwhat should i see\b|\bwhat'?s the season\b/i.test(tl)) {
      appendUserMessage(trimmed);
      setInput('');
      setTyping(true);
      const moments = await fetchAlmanac(userLat, userLon, 3);
      setTyping(false);
      if (moments.length) {
        almanacRestRef.current = moments.slice(1);
        showAlmanacMoment(moments[0]);
      } else {
        appendJosephineMessage({
          type: 'text',
          text: tj('almanacNothing', "Nothing especially fleeting on the mountain this exact moment — but I can still plan you a perfect day. Want me to?"),
          chips: [t('chipPlanMyDay')],
        });
      }
      return;
    }

    // ── Detect "too long / too hard" typed as free text ─────────────────
    if (planningStep > 0 && /too long|too far|too many km|too much|troppo lung|troppo lontan|zu lang|zu weit/i.test(tl)) {
      setAwaitingRefinement('length');
      const refDist = apiResults[0]?.distance_km;
      const hint = refDist ? tj('refLenHint', ' The shortest I suggested was {{km}} km.', { km: refDist }) : '';
      appendUserMessage(trimmed);
      setInput('');
      appendJosephineMessage({
        type: 'text',
        text: tj('refLenQShort', "How long would you like?{{hint}} Tell me a distance and I'll find it.", { hint }),
        chips: [tj('chipUnder5', 'Under 5 km'), tj('chipUnder8', 'Under 8 km'), tj('chipUnder12', 'Under 12 km')],
      });
      return;
    }
    if (planningStep > 0 && /too hard|too difficult|too steep|too challenging|too strenuous|troppo difficile|troppo ripido|zu schwer|zu steil|zu anstrengend/i.test(tl)) {
      setAwaitingRefinement('difficulty');
      appendUserMessage(trimmed);
      setInput('');
      appendJosephineMessage({
        type: 'text',
        text: tj('refDiffQShort', 'What difficulty works for you today?'),
        chips: [tj('chipEasyWalk', 'Easy walk'), tj('chipModerate', 'Moderate'), tj('chipAnyLevel', 'Any level')],
      });
      return;
    }

    // ── Dog-policy question ("should I bring my dog?", "are dogs allowed?") ─
    // Answer about the trail currently in view if there is one; otherwise
    // offer to find dog-friendly trails. Routes locally — no API key needed.
    const isDogQuestion =
      /\bdog|\bpup\b|\bpooch\b/i.test(tl) &&
      /\b(bring|take|allow|ok|okay|welcome|fine|friendly|leash)\b/i.test(tl) &&
      /\?|should|can i|may i|is it|are dogs|do (?:they|you)|allowed/i.test(tl);
    if (isDogQuestion) {
      appendUserMessage(trimmed);
      setInput('');
      setTyping(true);
      after(() => {
        setTyping(false);
        if (selectedTrail) {
          const ok = selectedTrail.dog_friendly;
          appendJosephineMessage({
            type: 'text',
            text: ok
              ? tj('dogYes', 'Yes — {{name}} is marked dog-friendly, so your dog is welcome. Bring water and keep them on a leash near grazing pastures and any exposed sections.', { name: selectedTrail.name })
              : tj('dogNo', "{{name}} isn't marked dog-friendly — there may be exposed, protected or livestock areas where dogs aren't ideal. I'd play it safe. Want me to find a dog-friendly trail nearby instead?", { name: selectedTrail.name }),
            chips: ok ? [t('chipStartOver')] : [tj('chipFindDogTrail', 'Find me a dog-friendly trail'), t('chipStartOver')],
          });
        } else {
          const d = {
            duration_hours: 3, difficulty: 'easy', interests: ['dog-friendly'],
            withDog: true, family_friendly: false, startArea: '',
          };
          setPlanningData(d);
          appendJosephineMessage({
            type: 'text',
            text: tj('dogFindTrails', 'Happy to bring your dog along! Let me find dog-friendly trails for you…'),
            chips: null,
          });
          runConditionsThenOptions(d);
        }
      }, 400);
      return;
    }

    // ── "Why this one?" — explain the current recommendation locally ─────
    // Uses the pick's own Josephine note + stats, so it never falls through
    // to the offline fallback when there's a recommendation on screen.
    const askedWhy = /\bwhy\b/i.test(tl);
    const whyTarget = /(this|that|\bit\b|one|trail|hike|route|pick|chos|recommend|suggest)/i.test(tl);
    if (apiResults.length > 0 && askedWhy && (whyTarget || tl.replace(/[^a-z]/gi, '') === 'why')) {
      appendUserMessage(trimmed);
      setInput('');
      setTyping(true);
      const top = apiResults[0];
      // Describe the trail factually — never claim the user requested
      // parameters they didn't actually choose.
      const bits = [];
      if (top.difficulty)      bits.push(tj('whyBitDifficulty', 'a {{difficulty}} route', { difficulty: top.difficulty }));
      if (top.duration_hours)  bits.push(tj('whyBitDuration', 'around {{h}}h', { h: top.duration_hours }));
      if (top.distance_km)     bits.push(`${top.distance_km} km`);
      const factual = bits.length ? tj('whyFactual', "It's {{bits}}.", { bits: bits.join(', ') }) : '';
      const note = (top.josephine_note || '').trim();
      const text = [tj('whyPick', '{{name}} is my pick for today.', { name: top.name }), factual, note].filter(Boolean).join(' ');
      after(() => {
        setTyping(false);
        appendJosephineMessage({ type: 'text', text, chips: null });
        // Re-surface the trail right here so it's easy to open.
        appendJosephineMessage({ type: 'options', trails: [top], chips: [t('chipStartOver')] });
      }, 450);
      return;
    }

    // ── Context-aware Q&A about the trail on screen (offline, factual) ───
    // Answers only from the trail's own fields; if it can't, it returns null
    // and we fall through to Haiku rather than guessing.
    if (ctxTrail) {
      const ans = answerAboutTrail(ctxTrail, tl);
      if (ans?.action === 'view') {
        appendUserMessage(trimmed);
        setInput('');
        showTrailDetail(ctxTrail);
        return;
      }
      if (ans?.text) {
        appendUserMessage(trimmed);
        setInput('');
        setTyping(true);
        after(() => {
          setTyping(false);
          appendJosephineMessage({ type: 'text', text: ans.text, chips: [t('chipStartOver')] });
        }, 350);
        return;
      }
    }

    const intent = parseRecommendIntent(trimmed);
    if (intent) {
      appendUserMessage(trimmed);
      setInput('');
      const d = {
        duration_hours: 3, difficulty: intent.difficulty || 'any', interests: intent.interests,
        withDog: intent.interests.includes('dog-friendly'), family_friendly: false, startArea: intent.startArea,
      };
      setPlanningData(d);
      appendJosephineMessage({
        type: 'text',
        text: intent.startArea
          ? `On it — let me find something near ${intent.startArea}…`
          : t('searching', 'Let me find you something…'),
        chips: null,
      });
      // Run through conditions (weather card + remark) then trail results
      // — same path as mood-tile planning so the experience is consistent
      runConditionsThenOptions(d);
      return;
    }

    appendUserMessage(trimmed);
    setInput('');
    setTyping(true);
    try {
      const res = await axios.post('/api/chat', {
        message: trimmed,
        history: chatHistory.slice(-10),
        lang,
        ...(ctxTrail ? { context: buildTrailContext(ctxTrail) } : {}),
      });
      setTyping(false);
      setChatHistory(prev => [...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: res.data.reply },
      ]);
      // Structured knowledge answers (gear, food, bus, emergency…) stand alone —
      // no planning CTAs. LLM / open-ended answers offer to continue the conversation.
      const knowledgeChips = res.data.mode === 'structured' ? null : [t('chipPlanMyDay'), t('chipSurpriseMe')];
      appendJosephineMessage({ type: 'text', text: res.data.reply, chips: knowledgeChips });
    } catch {
      setTyping(false);
      appendJosephineMessage({ type: 'text', text: t('windError'), chips: [t('chipPlanMyDay'), t('chipSurpriseMe')] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory, lang, t, awaitingRefinement, awaitingWiden, awaitingMoodPrompt, apiResults, planningData, planningStep, selectedTrail]);

  // Keep ref fresh so mic closure can call the latest version
  sendMsgRef.current = sendMessage;

  /* ── Mic toggle (Web Speech API) ────────────────────────────────────── */
  const toggleMic = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = lang === 'de' ? 'de-DE' : lang === 'it' ? 'it-IT' : 'en-GB';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      after(() => sendMsgRef.current?.(transcript), 200);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend  = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [SpeechRecognitionAPI, isListening, lang]);

  /* ── Widen the search past an unknown start area (drop it, re-recommend) ── */
  const widenToRegion = () => {
    setAwaitingWiden(false);
    const d = { ...planningData, startArea: '', max_distance_km: undefined };
    setPlanningData(d);
    appendJosephineMessage({
      type: 'text',
      text: tj('widerRegionResp', 'Wonderful — let me pull a few of my favourites from across South Tyrol.'),
      chips: null,
    });
    after(() => callRecommendAPI(d), 400);
  };

  /* ── Chip handler ────────────────────────────────────────────────────── */
  const handleChip = (chip) => {
    if ([t('chipShowMap'), 'Open map', 'Show me on the map', 'Show me the map'].includes(chip)) {
      appendUserMessage(chip);
      setCurrentView?.('catalog');
      return;
    }
    if (chip === t('chipViewSaved')) {
      appendUserMessage(chip);
      setCurrentView?.('savedTrails');
      return;
    }
    if (planningStep === 1 && moodByLabel[chip]) {
      appendUserMessage(chip);
      const bundle = moodByLabel[chip];
      setPlanningData(bundle);
      runConditionsThenOptions(bundle);
      return;
    }
    if (chip === tj('chipMoodPlan', 'Plan my perfect day ✦')) {
      appendUserMessage(chip);
      setAwaitingMoodPrompt(true);
      appendJosephineMessage({
        type: 'text',
        text: tj('moodPlanPrompt', "Tell me the day you want — your mood, how much time you have, who's with you. Try: “a peaceful walk and a good lunch, I'm a bit tired.”"),
        chips: null,
      });
      return;
    }
    if (chip === t('chipPlanMyDay')) { appendUserMessage(chip); startPlanningFlow(); return; }
    if (chip === t('chipSameVibe')) {
      appendUserMessage(chip);
      const prev = loadSession();
      if (prev) {
        const d = { duration_hours: prev.duration_hours, difficulty: prev.difficulty,
                    interests: prev.interests || [], withDog: false, family_friendly: false, startArea: '' };
        setPlanningData(d);
        runConditionsThenOptions(d);
      } else { startPlanningFlow(); }
      return;
    }
    if (chip === t('chipSomethingDifferent')) { appendUserMessage(chip); startPlanningFlow(); return; }
    if ([t('chipSurpriseMe'), 'Surprise me', 'Yes, surprise me'].includes(chip)) {
      appendUserMessage(chip);
      const d = { duration_hours: 3, difficulty: 'any', interests: [], withDog: false, family_friendly: false, startArea: '' };
      setPlanningData(d);
      runConditionsThenOptions(d);
      return;
    }
    if (chip === t('chipSaveHike')) {
      appendUserMessage(chip);
      saveHike(selectedTrail);
      return;
    }
    if (chip === t('viewDetails')) {
      if (selectedTrail) viewTrail?.(selectedTrail);
      return;
    }
    if (chip === t('chipTooLong')) {
      appendUserMessage(chip);
      setAwaitingRefinement('length');
      const refDist = apiResults[0]?.distance_km;
      const hint = refDist ? tj('refLenHint', ' The shortest I suggested was {{km}} km.', { km: refDist }) : '';
      const questions = [
        tj('refLenQ1', 'How long would you like?{{hint}} I can look for under 5 km, under 8 km — or tell me your preference.', { hint }),
        tj('refLenQ2', 'Good to know. What distance works for you?{{hint}} Pick below or just tell me.', { hint }),
        tj('refLenQ3', "Noted. How far is comfortable for you?{{hint}} Give me a number and I'll find it.", { hint }),
      ];
      after(() => {
        appendJosephineMessage({
          type: 'text',
          text: questions[Math.floor(Math.random() * questions.length)],
          chips: [tj('chipUnder5', 'Under 5 km'), tj('chipUnder8', 'Under 8 km'), tj('chipUnder12', 'Under 12 km')],
        });
      }, 400);
      return;
    }
    if (chip === t('chipTooHard')) {
      appendUserMessage(chip);
      setAwaitingRefinement('difficulty');
      const questions = [
        tj('refDiffQ1', 'How challenging would you like it? I can find something easy, moderate — or you tell me.'),
        tj('refDiffQ2', 'Understood. What difficulty works for you today?'),
        tj('refDiffQ3', 'Of course. What level are you comfortable with?'),
      ];
      after(() => {
        appendJosephineMessage({
          type: 'text',
          text: questions[Math.floor(Math.random() * questions.length)],
          chips: [tj('chipEasyWalk', 'Easy walk'), tj('chipModerate', 'Moderate'), tj('chipAnyLevel', 'Any level')],
        });
      }, 400);
      return;
    }
    if (chip === t('chipStartOver')) {
      appendUserMessage(chip);
      setPlanningStep(0); setPlanningData({}); setApiResults([]);
      setSelectedTrail(null); setRefining(false); setChatHistory([]);
      after(() => {
        appendJosephineMessage({
          type: 'text',
          text: t('startOver', 'Let\'s start fresh. What kind of adventure are you after today?'),
          chips: [tj('chipMoodPlan', 'Plan my perfect day ✦'), t('chipPlanMyDay'), t('chipSurpriseMe'), t('chipShowMap')],
        });
      }, 400);
      return;
    }
    if (chip === t('retryChip')) { appendUserMessage(chip); callRecommendAPI(planningData); return; }

    // ── Geographic awareness chips ─────────────────────────────────────────
    if (chip === tj('chipYesWorks', 'Yes, this works')) {
      appendUserMessage(chip);
      appendJosephineMessage({
        type: 'text',
        text: tj('geoYesResp', 'Perfect — enjoy the journey there too. Let me know if you need any other info.'),
        chips: null,
      });
      return;
    }
    if (chip === tj('chipFindCloser', 'Find something closer')) {
      appendUserMessage(chip);
      // Re-search with the same params but drop startArea so the backend
      // returns trails from the wider region without a distance penalty
      const d = { ...planningData, startArea: '' };
      setPlanningData(d);
      appendJosephineMessage({
        type: 'text',
        text: tj('geoCloserResp', 'Of course — let me find something closer to you.'),
        chips: null,
      });
      after(() => callRecommendAPI(d), 400);
      return;
    }

    if (chip === tj('chipSuggestWider', 'Yes, suggest something')) {
      appendUserMessage(chip);
      widenToRegion();
      return;
    }

    if (chip === tj('chipFindDogTrail', 'Find me a dog-friendly trail')) {
      appendUserMessage(chip);
      const d = { duration_hours: 3, difficulty: 'easy', interests: ['dog-friendly'],
                  withDog: true, family_friendly: false, startArea: '' };
      setPlanningData(d);
      appendJosephineMessage({ type: 'text', text: tj('dogFindTrails', 'Happy to bring your dog along! Let me find dog-friendly trails for you…'), chips: null });
      runConditionsThenOptions(d);
      return;
    }

    // ── Crowd-dispersal chips ──────────────────────────────────────────────
    if (chip === tj('chipShowAlternative', 'Show me the quieter option')) {
      appendUserMessage(chip);
      const altId = apiResults[0]?.dispersal?.suggested_alternative?.id;
      if (!altId) {
        // Never leave the tap unanswered — offer a way forward instead.
        appendJosephineMessage({
          type: 'text',
          text: tj('dispAltError', "Hmm, I couldn't pull that one up — want to start over?"),
          chips: [t('chipStartOver')],
        });
        return;
      }
      setTyping(true);
      // Fetch the full trail so the card + View details behave like any other pick.
      axios.get(`/api/trails/${altId}`).then(res => {
        setTyping(false);
        const full = res.data;
        appendJosephineMessage({ type: 'text', text: tj('dispAltIntro', "Here it is — I think you'll be glad you went here instead. ✦"), chips: null });
        appendJosephineMessage({ type: 'options', trails: [full], chips: [t('chipStartOver')] });
      }).catch(() => {
        setTyping(false);
        appendJosephineMessage({ type: 'text', text: tj('dispAltError', "Hmm, I couldn't pull that one up — want to start over?"), chips: [t('chipStartOver')] });
      });
      return;
    }
    if (chip === tj('chipPlanTomorrow', 'Plan it for tomorrow')) {
      appendUserMessage(chip);
      const place = apiResults[0]?.dispersal?.hotspot_name || '';
      appendJosephineMessage({
        type: 'text',
        text: tj('dispPlanTomorrowAck', "Lovely — {{place}} at sunrise tomorrow. Beat the crowds, catch the best light, everything else stays the same.", { place }),
        chips: [t('chipStartOver')],
      });
      return;
    }
    if (chip === tj('chipGoAnyway', 'Go anyway')) {
      appendUserMessage(chip);
      const place = apiResults[0]?.dispersal?.hotspot_name || '';
      appendJosephineMessage({
        type: 'text',
        text: tj('dispGoAnywayAck', "You got it{{place}}. Go as early as you can, and enjoy every minute.", { place: place ? ` — ${place}` : '' }),
        chips: null,
      });
      return;
    }

    // ── Almanac chips ──────────────────────────────────────────────────────
    if (chip === tj('chipAlmanacPlan', 'Plan around it')) {
      appendUserMessage(chip);
      const interest = lastAlmanacRef.current?.cta?.interest;
      const d = { duration_hours: 3, difficulty: 'any', interests: interest ? [interest] : [],
                  withDog: false, family_friendly: false, startArea: '' };
      setPlanningData(d);
      appendJosephineMessage({
        type: 'text',
        text: tj('almanacPlanAck', 'Wonderful — let me find something that fits the moment…'),
        chips: null,
      });
      after(() => runConditionsThenOptions(d), 400);
      return;
    }
    if (chip === tj('chipAlmanacMore', 'What else?')) {
      appendUserMessage(chip);
      const next = almanacRestRef.current.shift();
      if (next) {
        showAlmanacMoment(next);
      } else {
        appendJosephineMessage({
          type: 'text',
          text: tj('almanacNoMore', "That's the lot for this week. Want me to plan your day around one of these?"),
          chips: [t('chipPlanMyDay')],
        });
      }
      return;
    }

    sendMessage(chip);
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  const statusText =
    planningStep === 1 ? t('statusPlanning', 'Planning your day…') :
    planningStep === 2 ? t('statusFinding',  'Finding your trail…') :
    refining           ? t('statusRefining', 'Refining your pick…') :
    t('statusOnline', 'Online · Alpine guide');

  return (
    <div className="jc-page">

      {/* Header */}
      <div className="jc-header">
        <button className="jc-back-btn" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="jc-header__identity">
          <div className="jc-header__avatar">
            <img className="jc-header__mark" src="/josephine-portrait.webp" alt="Josephine"
                 onError={e => { e.currentTarget.src = '/logo.webp'; }} />
          </div>
          <div>
            <p className="jc-header__name">Josephine</p>
            <p className="jc-header__status"><span className="jc-header__online-dot" />{statusText}</p>
          </div>
        </div>
        <div className="jc-menu-wrap" ref={menuRef}>
          <button className="jc-menu-btn" aria-label="More options" onClick={() => setShowMenu(v => !v)}>
            <span /><span /><span />
          </button>
          {showMenu && (
            <div className="jc-menu-dropdown">
              <button className="jc-menu-item" onClick={shareConversation}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M11 9.5a2.5 2.5 0 1 1 0 2.5M4 7.5l7-3.5M4 7.5l7 3.5M4 7.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 4 7.5Z"
                    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('menuShare', 'Share conversation')}
              </button>
              <button className="jc-menu-item" onClick={() => { setShowMenu(false); setCurrentView?.('savedTrails'); }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M3 2h9a1 1 0 0 1 1 1v10l-4.5-2.5L4 13V3a1 1 0 0 1 1-1z"
                    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('menuSaved', 'View saved trails')}
              </button>
              <button className="jc-menu-item jc-menu-item--danger" onClick={clearConversation}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M2 4h11M5 4V2h5v2M6 7v5M9 7v5M3 4l1 9h7l1-9"
                    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('menuClear', 'Clear conversation')}
              </button>
            </div>
          )}
        </div>
        {copyFeedback && <div className="jc-copy-toast">{t('copied', 'Copied ✓')}</div>}
      </div>

      {/* Messages — a polite live region so screen readers announce each new
          Josephine reply as it arrives (additions only, not the whole log). */}
      <div
        className="jc-messages"
        ref={messagesRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        aria-label={t('chatLogLabel', 'Conversation with Josephine')}
      >
        {messages.map((msg, idx) => {
          const active = isChipActive(msg);
          const prevMsg = messages[idx - 1];
          const isFirstInRun = msg.from === 'josephine' && prevMsg?.from !== 'josephine';
          const isGrouped    = msg.from === 'josephine' && !isFirstInRun;
          return (
            <div key={msg.id}
              className={`jc-msg jc-msg--${msg.from}${
                (msg.type === 'trail-card' || msg.type === 'options' || msg.type === 'conditions' ||
                 msg.type === 'itinerary' || msg.type === 'mood-intro' || msg.type === 'plan') ? ' jc-msg--card' : ''}${
                isGrouped ? ' jc-msg--grouped' : ''}${
                msg.id === lastJosephineAvatarId ? ' jc-msg--live' : ''}`}
            >
              {msg.from === 'josephine' && (
                <div className="jc-msg__avatar" style={isFirstInRun ? {} : { visibility: 'hidden' }}>
                  {isFirstInRun
                    ? <JosephineAvatar state={(msg.id === lastJosephineAvatarId && headerAvatarState === 'peaceful') ? 'peaceful' : (msg.state || 'idle')} />
                    : <img src="/josephine-portrait.webp" alt="" onError={e => { e.currentTarget.src='/logo.webp'; }} />}
                </div>
              )}

              <div className="jc-msg__content">

                {/* Text bubble */}
                {msg.type === 'text' && msg.text && (
                  <div className="jc-bubble"><p className="jc-bubble__text">{msg.text}</p></div>
                )}

                {/* Almanac moment — voiced, with an ephemerality tag */}
                {msg.type === 'almanac' && msg.text && (
                  <div className="jc-bubble jc-bubble--almanac">
                    {msg.validity && <span className="jc-almanac-tag">{msg.validity}</span>}
                    <p className="jc-bubble__text">{msg.text}</p>
                  </div>
                )}

                {/* Daily Plan Card — the composed plan output */}
                {msg.type === 'plan' && msg.plan && (
                  <DailyPlanCard
                    plan={msg.plan}
                    t={t}
                    saved={savedIds.includes(msg.plan?.trail?.id)}
                    onSave={(tr) => saveHike(tr)}
                    onViewTrail={(tr) => gotoHike(tr)}
                    onAlt={handlePlanAlt}
                    onStartHike={onStartHike}
                  />
                )}

                {/* Mood intro: text bubble + grid in one message (fix 16) */}
                {msg.type === 'mood-intro' && (
                  <>
                    <div className="jc-bubble">
                      <p className="jc-bubble__text">{msg.text}</p>
                    </div>
                    <div className={`jc-mood-grid${!active ? ' jc-mood-grid--spent' : ''}`}>
                      {(msg.moods || []).map(mood => (
                        <button
                          key={mood.label}
                          className="jc-mood-tile"
                          disabled={!active}
                          onClick={() => {
                            if (!active) return;
                            appendUserMessage(mood.label);
                            setPlanningData(mood.bundle);
                            runConditionsThenOptions(mood.bundle);
                          }}
                        >
                          <span className="jc-mood-tile__icon">{mood.icon}</span>
                          <span className="jc-mood-tile__label">{mood.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Conditions card (adaptive title, deduped bullets — fixes 3 & 12) */}
                {msg.type === 'conditions' && msg.conditions && (
                  <div className="jc-conditions">
                    <div className="jc-conditions__head">
                      <span className="jc-conditions__emoji">{msg.conditions.emoji}</span>
                      <div>
                        <p className="jc-conditions__title">{msg.conditions.condTitle}</p>
                        <p className="jc-conditions__temp">{msg.conditions.temp}°C · {msg.conditions.sky}</p>
                      </div>
                    </div>
                    <ul className="jc-conditions__list">
                      <li>✦ {msg.conditions.vis}</li>
                      {msg.conditions.wind != null && msg.conditions.wind > 0 && <li>✦ {msg.conditions.wind} km/h wind</li>}
                      <li>✦ {msg.conditions.tip}</li>
                    </ul>
                  </div>
                )}

                {/* Trail options — always tappable, even after the conversation
                    moves on, so a recommended hike never becomes inaccessible. */}
                {msg.type === 'options' && msg.trails?.length > 0 && (
                  <div className="jc-options">
                    {msg.trails.map((tr, i) => (
                      <button key={tr.id || i} className="jc-option"
                        onClick={() => showTrailDetail(tr)}>
                        <img className="jc-option__img" src={trailImg(tr, 'card')} alt={tr.name}
                          onError={e => {
                            e.currentTarget.style.display = 'none';
                            // hide overlay too — the gradient fallback on the button itself takes over
                            const overlay = e.currentTarget.nextElementSibling;
                            if (overlay?.classList.contains('jc-option__overlay')) overlay.style.display = 'none';
                            e.currentTarget.closest('.jc-option').classList.add('jc-option--no-img');
                          }} />
                        <div className="jc-option__overlay" />
                        <div className="jc-option__body">
                          <p className="jc-option__name">{tr.name}</p>
                          <p className="jc-option__stats">{tr.distance_km} km · {tr.duration_hours}h · <span className="jc-option__diff">{tr.difficulty}</span></p>
                          {(() => {
                            const km = distanceFromUserKm(tr);
                            if (km == null) return null;
                            const kmText = km < 10 ? km.toFixed(1) : String(Math.round(km));
                            return (
                              <p className="jc-option__away">
                                📍 {t('kmAway', '{{km}} km away').replace('{{km}}', kmText)}
                              </p>
                            );
                          })()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Trail card — View details primary, Save secondary (fix 5); label removed (fix 10) */}
                {msg.type === 'trail-card' && msg.trail && (
                  <TrailDetailCard
                    trail={msg.trail}
                    saved={savedIds.includes(msg.trail.id)}
                    onSave={() => saveHike(msg.trail)}
                    onView={() => gotoHike(msg.trail)}
                    t={t}
                  />
                )}

                {/* Itinerary */}
                {msg.type === 'itinerary' && msg.steps?.length > 0 && (
                  <div className="jc-itinerary">
                    <div className="jc-itinerary__head">
                      <span className="jc-itinerary__check">✓</span>
                      <p className="jc-itinerary__title">{t('savedTitle', 'All set! Your day is saved. ✦')}</p>
                    </div>
                    <ul className="jc-itinerary__list">
                      {msg.steps.map((s, i) => (
                        <li key={i} className="jc-itinerary__step">
                          <span className="jc-itinerary__time">{s.time}</span>
                          <span className="jc-itinerary__dot" />
                          <span className="jc-itinerary__label">{s.label}{s.place ? ` · ${s.place}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Chips — disabled when conversation has moved on (fix 9) */}
                {msg.chips?.length > 0 && (
                  <div className="jc-chips">
                    {msg.chips.map(chip => (
                      <button
                        key={chip}
                        disabled={!active}
                        className={`jc-chip${chip === t('chipBack') ? ' jc-chip--back' : ''}${!active ? ' jc-chip--spent' : ''}`}
                        onClick={() => { if (active) handleChip(chip); }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="jc-msg jc-msg--josephine">
            <div className="jc-msg__avatar">
              <img src="/josephine-portrait.webp" alt="" onError={e => { e.currentTarget.src='/logo.webp'; }} />
            </div>
            <div className="jc-bubble jc-bubble--typing" aria-label={t('typingLabel', 'Josephine is typing')}><span /><span /><span /></div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="jc-input-bar">
        <div className="jc-input-wrap">
          <input
            ref={inputRef}
            className="jc-input"
            placeholder={isListening ? t('listeningLabel', 'Listening…') : t('inputPlaceholder', 'Ask Josephine anything…')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          />
          {SpeechRecognitionAPI && (
            <button
              className={`jc-mic-btn${isListening ? ' jc-mic-btn--listening' : ''}`}
              aria-label={isListening ? t('listeningLabel', 'Listening…') : 'Voice input'}
              onClick={toggleMic}
            >
              {isListening ? (
                <span className="jc-mic-pulse" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="13" rx="3" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M5 10a7 7 0 0014 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          )}
        </div>
        <button className="jc-send-btn" onClick={() => sendMessage(input)} disabled={!input.trim()} aria-label="Send">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        onLogin={() => { setShowAuthPrompt(false); onShowLogin?.(); }}
        message={authPromptMsg}
      />
    </div>
  );
}

export default React.memo(JosephineChat);
