import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl';
import SafetyDisclaimerModal from './SafetyDisclaimerModal';
import CelebrationModal from './CelebrationModal';
import TripSummary from './TripSummary';
import HikeComplete from './HikeComplete';
import { rememberCompletedHike } from '../utils/memory';
import { ENABLE_GAMIFICATION } from '../featureFlags';
import { checkNewBadges } from '../utils/gamification';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import './ActiveHikeTracker.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const GPS_UPDATE_INTERVAL = 20000; // 20 seconds
const INACTIVITY_TIMEOUT = 6 * 60 * 60 * 1000; // 6 hours
const AUTO_PAUSE_THRESHOLD = 60000; // 60 seconds (1 minute)
const MOVEMENT_THRESHOLD = 10; // 10 meters minimum to consider as movement
const OFF_TRAIL_DISTANCE = 30; // meters
const POI_ALERT_DISTANCES = [500, 200]; // Alert at 500m and 200m
const NOTIFICATION_THROTTLE_INTERVAL = 60000; // 60 seconds between checkpoint notifications
const NOTIFICATION_DISTANCE_THRESHOLD = 50; // 50m movement to allow new notification
const CHECKPOINT_ARRIVAL_RADIUS = 30; // meters to mark as reached
const CHECKPOINT_PASSED_RADIUS = 40; // meters to mark as passed after reaching
const RESUME_PROMPT_THRESHOLD = 60000; // backgrounded ≥60s (phone in pocket) → ask "still on the trail?"
// Completion is judged by *distance actually walked* vs the route length, NOT by
// how close you are to the last polyline point. On a loop the last point sits on
// top of the first, so a position-based check would "finish" you at the trailhead
// the moment you start. Walked-distance is monotonic and immune to that.
const TRAIL_COMPLETE_DISTANCE_FRACTION = 0.9; // walked ≥ 90% of the route length = done
// Fixes worse than this (metres of reported accuracy) don't drive stats / off-trail
// /completion — they're usually drift while the phone is pocketed or just-resumed.
const GPS_ACCURACY_MAX = 50;
// A single-fix jump bigger than this is a teleport (resume after a background gap),
// not a walked segment — rebaseline instead of bridging a bogus straight line.
const TELEPORT_GAP = 150;
// ── Elevation / distance accuracy ──
// GPS *vertical* error is ±10–20m, so we don't trust GPS altitude. Instead we
// read ground elevation from Mapbox's terrain DEM at each (accurate) horizontal
// fix; GPS+Kalman is only an offline fallback when no DEM tiles are loaded.
const DEM_DEADBAND = 2;        // m — DEM is smooth; small dead-band for gain/loss
const GPS_DEADBAND = 4;        // m — Kalman-filtered GPS is still noisier
const DISTANCE_MIN_MOVE = 5;   // m — ignore sub-5m GPS jitter for distance
const DEM_COVERAGE_MIN = 0.6;  // use DEM as the primary source if ≥60% of fixes had it
const ELEV_SMOOTH_WINDOW = 5;  // moving-average window for the final (batch) recompute

// ── Elevation / distance helpers (pure) ──────────────────────────────────────

// 1D Kalman filter for GPS altitude — only used as an offline fallback when the
// terrain DEM isn't available. `accStd` is coords.altitudeAccuracy (m).
function makeAltKalman() {
  let x = null;   // estimate
  let p = 1;      // estimate variance
  const q = 0.6;  // process noise (m² per step)
  return {
    update(z, accStd) {
      if (z == null || !isFinite(z)) return x;
      const r = Math.pow(Math.max(4, accStd || 18), 2); // vertical variance
      if (x == null) { x = z; p = r; return x; }
      p += q;
      const k = p / (p + r);
      x += k * (z - x);
      p = (1 - k) * p;
      return x;
    }
  };
}

// Cumulative gain/loss from an elevation series, ratcheting only once the move
// from the last reference clears a dead-band. Nulls are skipped, so the
// reference holds across gaps (no fake jump when data resumes).
function computeGainLoss(series, deadband) {
  let gain = 0, loss = 0, ref = null;
  for (let i = 0; i < series.length; i++) {
    const e = series[i];
    if (e == null || !isFinite(e)) continue;
    if (ref == null) { ref = e; continue; }
    const d = e - ref;
    if (d >= deadband) { gain += d; ref = e; }
    else if (d <= -deadband) { loss += -d; ref = e; }
  }
  return { gain, loss };
}

// Moving-average smoother that ignores nulls (used for the final recompute).
function smoothSeries(series, win) {
  const half = Math.floor(win / 2);
  const out = new Array(series.length).fill(null);
  for (let i = 0; i < series.length; i++) {
    let sum = 0, n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j < 0 || j >= series.length) continue;
      const v = series[j];
      if (v != null && isFinite(v)) { sum += v; n++; }
    }
    if (n > 0) out[i] = sum / n;
  }
  return out;
}

// Split the walked track into separate segments at every `break` point (a resume
// after a background gap). Returns an array of [lon,lat][] for a MultiLineString,
// so we never draw a straight bridge across a teleport.
function buildTrackSegments(track) {
  const segments = [];
  let current = [];
  for (const p of track) {
    if (p.break && current.length > 0) {
      segments.push(current);
      current = [];
    }
    current.push([p.lon, p.lat]);
  }
  if (current.length > 0) segments.push(current);
  return segments.filter(seg => seg.length > 1);
}

function ActiveHikeTracker({ trail, onEnd }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { currentUser } = useAuth();
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [gpsTrack, setGpsTrack] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [stats, setStats] = useState({
    distance: 0,
    elevation: 0,
    duration: 0,
    pace: 0
  });
  const [offTrailWarning, setOffTrailWarning] = useState(false);
  const [isOffTrail, setIsOffTrail] = useState(false);
  const [alertedPOIs, setAlertedPOIs] = useState(new Set());
  const [visitedCheckpoints, setVisitedCheckpoints] = useState([]);
  const [shareLink, setShareLink] = useState(null);
  const [completedHikeData, setCompletedHikeData] = useState(null);
  const [activeMoment, setActiveMoment] = useState(null);   // current Josephine "moment" (avatar bubble)
  const [showRecap, setShowRecap] = useState(false);        // "how were the legs?" prompt
  const [showComplete, setShowComplete] = useState(false);  // on-brand Josephine close
  const [showResumePrompt, setShowResumePrompt] = useState(false); // "still on the trail?" after pocket/background
  const [completeLine, setCompleteLine] = useState('');
  const [audioMuted, setAudioMuted] = useState(() => {
    try { return localStorage.getItem('companionMuted') === '1'; } catch { return false; }
  });
  
  const watchIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastMoveTimeRef = useRef(null);
  const lastPositionForMovementRef = useRef(null); // Track position for movement detection
  const autoPausedRef = useRef(false); // Track if auto-paused
  const wakeLockRef = useRef(null);
  const intervalRef = useRef(null);
  // Elevation is read from the terrain DEM at each horizontal fix (preferred),
  // with a Kalman-filtered GPS-altitude series kept as an offline fallback.
  const demSeriesRef = useRef([]);       // ground elevation per on-trail fix (null if no DEM)
  const kalmanSeriesRef = useRef([]);    // Kalman-filtered GPS altitude per on-trail fix
  const demCoverageRef = useRef({ have: 0, total: 0 });
  const altKalmanRef = useRef(makeAltKalman());
  const mapRef = useRef(null);           // underlying mapbox-gl Map (for DEM queries)
  const mapReadyRef = useRef(false);     // DEM source added + terrain set
  const offTrailStartTimeRef = useRef(null); // Track when user went off trail
  const totalOffTrailTimeRef = useRef(0); // Accumulate total off-trail time
  const lastOnTrailPointRef = useRef(null); // Track last on-trail GPS point for stat calculations
  
  // NEW: Enhanced checkpoint tracking with state machine
  const checkpointStatesRef = useRef({}); // { [checkpointIndex]: { state: 'approaching'|'reached'|'passed', lastDistance: number } }
  const lastNotificationRef = useRef({}); // { [checkpointIndex]: { time: number, position: {lat, lon} } }

  // Live Trail Companion — geofenced "moments" (insights/secrets + checkpoints + POIs)
  const momentsRef = useRef([]);          // fetched from /api/trails/<id>/moments
  const momentStatesRef = useRef({});     // { [moment.id]: { state, lastDistance } }
  const momentNotifRef = useRef({});      // { [moment.id]: { time, position } } throttle
  const momentBubbleTimerRef = useRef(null);

  // CRITICAL FIX: Use refs for gpsTrack and stats to ensure persistence captures latest data
  const gpsTrackRef = useRef([]);
  const statsRef = useRef({ distance: 0, elevation: 0, duration: 0, pace: 0 });
  
  // CRITICAL FIX: Use refs for off-trail and paused state to fix GPS callback closure bug
  const isOffTrailRef = useRef(false);
  const isPausedRef = useRef(false);

  // Pocket/background + completion bookkeeping (read inside GPS/visibility closures)
  const hiddenAtRef = useRef(null);       // when the page was last backgrounded during a hike
  const completedFullRef = useRef(false); // user walked the whole route (≥ TRAIL_COMPLETE_DISTANCE_FRACTION)
  const lastAlongRef = useRef(null);      // user's last distance-along-trail (m) — continuity cursor so
                                          // loops don't snap the projection across the start/end overlap
  const teleportNextRef = useRef(false);  // next fix is a resume/teleport → rebaseline, don't bridge a line
  const totalTrailLengthRef = useRef(null); // memoised route length (m)
  const isEndingRef = useRef(false);      // guards against double-ending from async callbacks
  
  // Sync refs with state to fix closure bug in GPS callback
  useEffect(() => {
    isOffTrailRef.current = isOffTrail;
  }, [isOffTrail]);
  
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Stop any narration + bubble timer when the tracker goes away.
  useEffect(() => () => {
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch { /* no-op */ }
    if (momentBubbleTimerRef.current) clearTimeout(momentBubbleTimerRef.current);
  }, []);

  // Convert coordinates to GeoJSON route if needed
  const trailRoute = trail.route || (trail.coordinates ? {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: trail.coordinates
    }
  } : null);

  // Request wake lock to prevent screen sleep
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Wake Lock activated');
      }
    } catch (err) {
      console.error('Wake Lock error:', err);
    }
  };

  // Release wake lock
  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('Wake Lock released');
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  // Send notification
  const sendNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { 
        body,
        icon: '/favicon.ico',
        vibrate: [200, 100, 200]
      });
      
      // Vibrate if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    }
  };

  // Play mountain bell sound (optional audio cue for checkpoints)
  const playMountainBell = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Bell-like frequencies (fundamental + harmonics)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';

      // Envelope: quick attack, slow decay
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1.5);
    } catch (error) {
      console.log('Audio playback not supported:', error);
    }
  };

  // Calculate distance between two GPS coordinates (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Read ground elevation (m) from the terrain DEM at a horizontal position.
  // Returns null when the DEM isn't ready or the tile isn't loaded yet — the
  // caller then falls back to filtered GPS altitude. `exaggerated: false` gives
  // the true elevation regardless of the (visual) terrain exaggeration.
  const sampleDemElevation = (lon, lat) => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return null;
    try {
      const v = map.queryTerrainElevation([lon, lat], { exaggerated: false });
      return (v != null && isFinite(v)) ? v : null;
    } catch {
      return null;
    }
  };

  // Map onLoad: wire up the DEM (Digital Elevation Model) so we can read true
  // ground elevation at any lat/lon. We trust GPS horizontal accuracy and read
  // height from the terrain model — far steadier than GPS vertical (±10–20m).
  // exaggeration: 0 keeps the map flat (pitch is 0 anyway) while still loading
  // the DEM tiles that queryTerrainElevation reads from.
  const handleMapLoad = (evt) => {
    const map = evt?.target;
    if (!map) return;
    mapRef.current = map;
    try {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 0 });
      mapReadyRef.current = true;
    } catch (err) {
      // If terrain setup fails we simply fall back to GPS+Kalman elevation.
      console.warn('DEM terrain setup failed, using GPS altitude fallback', err);
      mapReadyRef.current = false;
    }
  };

  // Find nearest point on polyline and the distance ALONG the trail to it.
  //
  // `preferAlong` (metres) biases the choice toward candidates near a known
  // along-trail position. Without it, the globally-closest segment wins — which
  // on a LOOP is ambiguous (start and end coincide), so the projection can snap
  // from ~0 m to the full length and back. Passing the last known along-distance
  // keeps the projection continuous as the hiker walks the loop.
  const findNearestPointOnPolyline = (userLat, userLon, polylineCoords, preferAlong = null) => {
    if (!polylineCoords || polylineCoords.length < 2) {
      return { segmentIndex: 0, distanceToLine: Infinity, distanceAlongTrail: 0, projectedPoint: null };
    }

    const LAMBDA = 0.05; // line-distance penalty per metre of along-trail discontinuity
    let cum = 0;         // cumulative along-trail distance to the start of segment i
    let best = { cost: Infinity, distToLine: Infinity, segIdx: 0, along: 0, proj: null };

    for (let i = 0; i < polylineCoords.length - 1; i++) {
      const [lon1, lat1] = polylineCoords[i];
      const [lon2, lat2] = polylineCoords[i + 1];

      const dx = lon2 - lon1;
      const dy = lat2 - lat1;
      const segLenDeg = Math.sqrt(dx * dx + dy * dy);
      const segLenM = calculateDistance(lat1, lon1, lat2, lon2);
      if (segLenDeg === 0) { continue; }

      const t = Math.max(0, Math.min(1,
        ((userLon - lon1) * dx + (userLat - lat1) * dy) / (segLenDeg * segLenDeg)
      ));
      const projLon = lon1 + t * dx;
      const projLat = lat1 + t * dy;
      const distToSeg = calculateDistance(userLat, userLon, projLat, projLon);
      const along = cum + segLenM * t;

      const cost = distToSeg + (preferAlong != null ? LAMBDA * Math.abs(along - preferAlong) : 0);
      if (cost < best.cost) {
        best = { cost, distToLine: distToSeg, segIdx: i, along, proj: { lat: projLat, lon: projLon } };
      }
      cum += segLenM;
    }

    return {
      segmentIndex: best.segIdx,
      distanceToLine: best.distToLine,
      distanceAlongTrail: best.along,
      projectedPoint: best.proj
    };
  };

  // Total route length in metres (memoised).
  const getTotalTrailLength = () => {
    if (totalTrailLengthRef.current != null) return totalTrailLengthRef.current;
    const poly = trailRoute?.geometry?.coordinates || trail.coordinates || [];
    let L = 0;
    for (let i = 0; i < poly.length - 1; i++) {
      const [lon1, lat1] = poly[i];
      const [lon2, lat2] = poly[i + 1];
      L += calculateDistance(lat1, lon1, lat2, lon2);
    }
    totalTrailLengthRef.current = L;
    return L;
  };

  // Progress = how far the hiker has actually WALKED vs the route length.
  // Monotonic and loop-safe (see TRAIL_COMPLETE_DISTANCE_FRACTION note).
  const getProgressPercent = () => {
    const L = getTotalTrailLength();
    if (!L) return 0;
    return Math.min(100, Math.max(0, (statsRef.current.distance / L) * 100));
  };

  // Calculate distance along polyline to a checkpoint
  const calculatePolylineDistanceToCheckpoint = (userLat, userLon, checkpointLat, checkpointLon, polylineCoords) => {
    if (!polylineCoords || polylineCoords.length < 2) {
      // Fallback to straight-line distance if no polyline
      return calculateDistance(userLat, userLon, checkpointLat, checkpointLon);
    }

    // Find user's position on trail
    const userProjection = findNearestPointOnPolyline(userLat, userLon, polylineCoords);
    
    // Find checkpoint's position on trail
    const checkpointProjection = findNearestPointOnPolyline(checkpointLat, checkpointLon, polylineCoords);

    // Calculate distance along trail between the two projections
    const distanceAlongTrail = Math.abs(checkpointProjection.distanceAlongTrail - userProjection.distanceAlongTrail);

    return distanceAlongTrail;
  };

  // Find next POI and distance to it
  const getNextPOI = () => {
    const pois = trail.points_of_interest || trail.pois;
    if (!pois || !currentPosition) return null;

    let nearestPOI = null;
    let minDistance = Infinity;

    pois.forEach((poi) => {
      const distance = calculateDistance(
        currentPosition.lat,
        currentPosition.lon,
        poi.coordinates[1],
        poi.coordinates[0]
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestPOI = { ...poi, distance };
      }
    });

    return nearestPOI;
  };

  // ── Live Trail Companion: moments ──────────────────────────────────────────
  // Fetch the trail's geo-anchored, localized, Josephine-voiced moments.
  const fetchMoments = async () => {
    try {
      const lng = (i18n.language || 'en').split('-')[0];
      const res = await fetch(`/api/trails/${trail.id}/moments?lang=${lng}`);
      if (!res.ok) return;
      const data = await res.json();
      momentsRef.current = Array.isArray(data.moments) ? data.moments : [];
      console.log(`[companion] loaded ${momentsRef.current.length} moments`);
    } catch (e) {
      console.warn('[companion] moments fetch failed:', e);
    }
  };

  // Speak a line as Josephine — calm, Italian-accented female voice.
  const speakLine = (_text) => { /* voice disabled */ };

  // Surface a moment: bubble + toast + notification + chime + voice.
  const announceMoment = (moment) => {
    setActiveMoment(moment);
    if (momentBubbleTimerRef.current) clearTimeout(momentBubbleTimerRef.current);
    momentBubbleTimerRef.current = setTimeout(() => setActiveMoment(null), 12000);
    toast.info(`${moment.icon || '✦'} ${moment.line}`);
    sendNotification(`${moment.icon || '✦'} ${moment.title || ''}`.trim(), moment.line);
    playMountainBell();
    // chime first, then voice (avoid overlap)
    setTimeout(() => speakLine(moment.line), 700);
  };

  // Geofence loop over moments (mirrors the checkpoint state-machine + throttle).
  // Returns true if it handled proximity (so the caller can skip the legacy
  // checkpoint/POI checks); false when there are no moments (use fallback).
  const checkMomentProximity = (position, offTrail = false) => {
    const moments = momentsRef.current;
    if (!moments || moments.length === 0) return false;

    const poly = trailRoute?.geometry?.coordinates || trail.coordinates;
    // Project the hiker onto the route once (continuity-biased so loops don't snap
    // to the wrong lap). We measure proximity to each moment *along the trail*, not
    // as the crow flies — a waypoint 400m downslope but 2km away on the path must
    // NOT trigger. We also require the hiker to actually be ON the trail.
    const userProj = findNearestPointOnPolyline(
      position.latitude, position.longitude, poly, lastAlongRef.current
    );
    const userOnTrail = !offTrail && userProj.distanceToLine <= OFF_TRAIL_DISTANCE;

    moments.forEach((m) => {
      const key = m.id;
      // Cache each moment's own distance-along-trail once.
      if (m.__along == null) {
        m.__along = findNearestPointOnPolyline(m.lat, m.lon, poly).distanceAlongTrail;
      }
      const distance = Math.abs(m.__along - userProj.distanceAlongTrail);
      if (!momentStatesRef.current[key]) {
        momentStatesRef.current[key] = { state: 'approaching', lastDistance: Infinity };
      }
      const st = momentStatesRef.current[key];
      const radius = m.radius_m || 200;

      if (distance <= CHECKPOINT_ARRIVAL_RADIUS && st.state === 'approaching') {
        st.state = 'reached';
      } else if (st.state === 'reached' && distance > CHECKPOINT_PASSED_RADIUS && distance > st.lastDistance) {
        st.state = 'passed';
      }
      if (st.state === 'passed') { st.lastDistance = distance; return; }

      // throttle: time OR distance since last announce for this moment
      const now = Date.now();
      const last = momentNotifRef.current[key];
      let shouldNotify = !last;
      if (last) {
        const dt = now - last.time;
        const dd = calculateDistance(position.latitude, position.longitude, last.position.lat, last.position.lon);
        shouldNotify = dt > NOTIFICATION_THROTTLE_INTERVAL || dd > NOTIFICATION_DISTANCE_THRESHOLD;
      }

      if (st.state === 'approaching' && distance <= radius && userOnTrail && shouldNotify) {
        announceMoment(m);
        momentNotifRef.current[key] = { time: now, position: { lat: position.latitude, lon: position.longitude } };
      }
      st.lastDistance = distance;
    });
    return true;
  };

  // Check POI proximity and send alerts
  const checkPOIProximity = (position, offTrail = false) => {
    const pois = trail.points_of_interest || trail.pois;
    if (!pois) return;

    const poly = trailRoute?.geometry?.coordinates || trail.coordinates;
    const userProj = findNearestPointOnPolyline(
      position.latitude, position.longitude, poly, lastAlongRef.current
    );
    const userOnTrail = !offTrail && userProj.distanceToLine <= OFF_TRAIL_DISTANCE;
    // Off the trail → don't fire "approaching" alerts (a POI can be 400m straight-line
    // but kilometres away along the path). Arrival is also gated below.
    if (!userOnTrail) return;

    pois.forEach((poi, index) => {
      // Distance measured ALONG the trail, not straight-line.
      if (poi.__along == null) {
        poi.__along = findNearestPointOnPolyline(
          poi.coordinates[1], poi.coordinates[0], poly
        ).distanceAlongTrail;
      }
      const distance = Math.abs(poi.__along - userProj.distanceAlongTrail);

      POI_ALERT_DISTANCES.forEach(alertDist => {
        const poiKey = `${index}-${alertDist}`;

        if (distance <= alertDist && distance > alertDist - 50 && !alertedPOIs.has(poiKey)) {
          sendNotification(
            `${alertDist}m until ${poi.name}`,
            `You're approaching a point of interest!`
          );
          setAlertedPOIs(prev => new Set([...prev, poiKey]));
        }
      });

      // Arrival notification
      if (distance <= 20 && !alertedPOIs.has(`${index}-arrival`)) {
        sendNotification(
          `You've reached ${poi.name}! 🎯`,
          `Enjoy the view!`
        );
        setAlertedPOIs(prev => new Set([...prev, `${index}-arrival`]));
      }
    });
  };

  // Check checkpoint proximity and send alerts (IMPROVED with polyline distance and throttling)
  const checkCheckpointProximity = (position) => {
    const checkpoints = trail.checkpoints;
    if (!checkpoints || !Array.isArray(checkpoints) || checkpoints.length === 0) return;

    const polylineCoords = trailRoute?.geometry?.coordinates || trail.coordinates;

    checkpoints.forEach((checkpoint, index) => {
      // Calculate distance using polyline projection (more accurate for curved trails)
      const distance = calculatePolylineDistanceToCheckpoint(
        position.latitude,
        position.longitude,
        checkpoint.coordinates[1],
        checkpoint.coordinates[0],
        polylineCoords
      );

      // Initialize checkpoint state if not exists
      if (!checkpointStatesRef.current[index]) {
        checkpointStatesRef.current[index] = { state: 'approaching', lastDistance: Infinity };
      }

      const checkpointState = checkpointStatesRef.current[index];
      const alertDist = checkpoint.alert_distance || 200;

      // State machine: approaching → reached → passed
      if (distance <= CHECKPOINT_ARRIVAL_RADIUS && checkpointState.state === 'approaching') {
        checkpointState.state = 'reached';
      } else if (
        checkpointState.state === 'reached' && 
        distance > CHECKPOINT_PASSED_RADIUS &&
        distance > checkpointState.lastDistance // Moving away
      ) {
        checkpointState.state = 'passed';
      }

      // Skip notifications if checkpoint is passed
      if (checkpointState.state === 'passed') {
        checkpointState.lastDistance = distance;
        return;
      }

      // Throttling logic: check if we should send notification
      const now = Date.now();
      const lastNotif = lastNotificationRef.current[index];
      let shouldNotify = false;

      if (!lastNotif) {
        // First time approaching this checkpoint
        shouldNotify = true;
      } else {
        // Check throttle conditions
        const timeSinceLastNotif = now - lastNotif.time;
        const distanceSinceLastNotif = calculateDistance(
          position.latitude,
          position.longitude,
          lastNotif.position.lat,
          lastNotif.position.lon
        );

        // Allow notification if enough time passed OR enough distance traveled
        if (
          timeSinceLastNotif > NOTIFICATION_THROTTLE_INTERVAL ||
          distanceSinceLastNotif > NOTIFICATION_DISTANCE_THRESHOLD
        ) {
          shouldNotify = true;
        }
      }

      // Alert when approaching (within configured alert distance)
      if (
        checkpointState.state === 'approaching' &&
        distance <= alertDist &&
        shouldNotify
      ) {
        const icon = checkpoint.type === 'summit' ? '⛰️' : checkpoint.type === 'refuge' ? '🏠' : '📍';
        const roundedDistance = Math.round(distance);
        toast.info(t('gps.checkpointAheadToast', { icon, name: checkpoint.name, distance: roundedDistance }));
        sendNotification(
          t('gps.checkpointAheadNotification', { icon, name: checkpoint.name }),
          t('gps.checkpointAheadNotificationBody', { name: checkpoint.name, distance: roundedDistance })
        );
        playMountainBell(); // Play sound cue

        // Update last notification record
        lastNotificationRef.current[index] = {
          time: now,
          position: { lat: position.latitude, lon: position.longitude }
        };
      }

      // Arrival notification (only once when first reaching)
      if (checkpointState.state === 'reached' && !visitedCheckpoints.find(c => c.index === index)) {
        // CRITICAL: Check if we already sent arrival notification (prevent spam during async state update)
        const arrivalNotifKey = `${index}-arrival`;
        const lastArrivalNotif = lastNotificationRef.current[arrivalNotifKey];
        
        if (!lastArrivalNotif || (Date.now() - lastArrivalNotif.time) > 5000) {
          const icon = checkpoint.type === 'summit' ? '⛰️' : checkpoint.type === 'refuge' ? '🏠' : '📍';
          toast.success(t('gps.checkpointReachedToast', { icon, name: checkpoint.name }));
          sendNotification(
            t('gps.checkpointReachedNotification', { icon }),
            t('gps.checkpointReachedNotificationBody', { name: checkpoint.name })
          );
          playMountainBell(); // Play sound cue for arrival

          // CRITICAL: Immediately mark notification as sent (before async state update)
          lastNotificationRef.current[arrivalNotifKey] = {
            time: Date.now(),
            position: { lat: position.latitude, lon: position.longitude }
          };

          // Track visited checkpoint
          setVisitedCheckpoints(prev => [...prev, {
            index,
            name: checkpoint.name,
            type: checkpoint.type,
            timestamp: Date.now(),
            coordinates: checkpoint.coordinates
          }]);
        }
      }

      // Update last distance for trend detection
      checkpointState.lastDistance = distance;
    });
  };

  // Handle GPS position update
  const handlePositionUpdate = (position) => {
    const { latitude, longitude, altitude, speed } = position.coords;
    const newPoint = {
      lat: latitude,
      lon: longitude,
      alt: altitude || 0,
      timestamp: Date.now()
    };

    setCurrentPosition(newPoint);

    const acc = position.coords.accuracy || 0;

    // ── Bug #3a: reject low-confidence fixes ──
    // A fix with huge reported accuracy (phone pocketed, just resumed, indoors)
    // must not drive stats / off-trail / completion. We still moved the blue dot
    // above so the user sees *something*, but we don't trust this point.
    if (acc > GPS_ACCURACY_MAX && lastPositionForMovementRef.current && !teleportNextRef.current) {
      return;
    }

    // ── Bug #3b: detect a teleport (resume after a background gap) ──
    // Either we were explicitly told the next fix is a resume, or this single fix
    // jumped further than any real walk between updates. Rebaseline instead of
    // bridging a bogus straight line across the gap (which faked the huge
    // "off-trail" detour seen in the field).
    let isTeleport = teleportNextRef.current;
    if (!isTeleport && lastPositionForMovementRef.current) {
      const jump = calculateDistance(
        lastPositionForMovementRef.current.lat, lastPositionForMovementRef.current.lon,
        latitude, longitude
      );
      if (jump > TELEPORT_GAP) isTeleport = true;
    }
    if (isTeleport) {
      teleportNextRef.current = false;
      lastOnTrailPointRef.current = null;   // don't add the gap to walked distance
      lastAlongRef.current = null;          // re-acquire along-trail position fresh
      newPoint.break = true;                // split the drawn GPS track here (no bridge)
      lastPositionForMovementRef.current = newPoint;
      lastMoveTimeRef.current = Date.now();
      // fall through: record the point & re-detect off-trail from scratch.
    }

    // Check for movement (for auto-pause detection)
    let hasMoved = false;
    if (lastPositionForMovementRef.current) {
      const distanceMoved = calculateDistance(
        lastPositionForMovementRef.current.lat,
        lastPositionForMovementRef.current.lon,
        latitude,
        longitude
      );
      
      if (distanceMoved > MOVEMENT_THRESHOLD) {
        hasMoved = true;
        lastMoveTimeRef.current = Date.now();
        lastPositionForMovementRef.current = newPoint;
        
        // Auto-resume if was auto-paused (READ FROM REF to get current state)
        if (autoPausedRef.current && isPausedRef.current) {
          console.log('Movement detected, auto-resuming tracking');
          setIsPaused(false);
          autoPausedRef.current = false;
          toast.info(`▶️ ${t('gps.trackingResumed')}`);
          sendNotification(t('gps.trackingResumed'), t('gps.movementDetected'));
        }
      }
    } else {
      // First position, initialize
      lastPositionForMovementRef.current = newPoint;
      lastMoveTimeRef.current = Date.now();
      hasMoved = true;
    }

    // Auto-pause detection: if no significant movement for 60+ seconds and not manually paused (READ FROM REF)
    if (!hasMoved && !isPausedRef.current && !autoPausedRef.current) {
      const timeSinceLastMove = Date.now() - lastMoveTimeRef.current;
      if (timeSinceLastMove > AUTO_PAUSE_THRESHOLD) {
        console.log('No movement detected for 60 seconds, auto-pausing tracking');
        setIsPaused(true);
        autoPausedRef.current = true;
        toast.warning(`⏸️ ${t('gps.trackingPaused')}`);
        sendNotification(t('gps.trackingPaused'), t('gps.noMovementDetected'));
      }
    }

    // READ FROM REF to get current paused state
    if (!isPausedRef.current) {
      // Check if user is off trail FIRST (before updating any stats)
      let currentlyOffTrail = false;
      const poly = trailRoute?.geometry?.coordinates || trail.coordinates;
      if (poly && poly.length >= 2) {
        // Project once, continuity-biased, and advance the along-trail cursor while
        // on-trail (so loops & waypoint proximity track the correct lap).
        const proj = findNearestPointOnPolyline(newPoint.lat, newPoint.lon, poly, lastAlongRef.current);
        const distToTrail = proj.distanceToLine;
        currentlyOffTrail = distToTrail > OFF_TRAIL_DISTANCE;
        if (!currentlyOffTrail) lastAlongRef.current = proj.distanceAlongTrail;

        // Handle off-trail state transitions (READ FROM REF to get current state - fixes notification spam)
        if (currentlyOffTrail && !isOffTrailRef.current) {
          // Just went off trail - clear last on-trail point so we don't bridge the gap when returning
          console.log('🔴 OFF TRAIL: User went off trail');
          offTrailStartTimeRef.current = Date.now();
          lastOnTrailPointRef.current = null; // CRITICAL: Clear to prevent bridging off-trail distance
          setIsOffTrail(true);
          setOffTrailWarning(true);
          sendNotification(
            t('gps.offTrailAlert') || 'Off Trail Alert',
            t('gps.offTrailMessage') || 'You are off the trail. Stats recording paused until you return to the route.'
          );
          toast.warning(`⚠️ ${t('gps.offTrailAlert') || 'Off Trail - Stats Paused'}`);
        } else if (!currentlyOffTrail && isOffTrailRef.current) {
          // Just returned to trail
          console.log('✅ BACK ON TRAIL: User returned to trail');
          if (offTrailStartTimeRef.current) {
            const offTrailDuration = Date.now() - offTrailStartTimeRef.current;
            totalOffTrailTimeRef.current += offTrailDuration;
            offTrailStartTimeRef.current = null;
          }
          setIsOffTrail(false);
          setOffTrailWarning(false);
          toast.success(`✅ ${t('gps.backOnTrail') || 'Back on Trail - Stats Recording Resumed'}`);
        }
      }
      
      // CRITICAL FIX: Update refs synchronously FIRST, then update state
      const prevTrack = gpsTrackRef.current;
      const updatedTrack = [...prevTrack, newPoint];
      gpsTrackRef.current = updatedTrack;
      
      // Calculate stats ONLY if on trail
      let segmentDistance = 0;

      if (!currentlyOffTrail) {
        // ── Distance: gate out sub-threshold GPS jitter ──
        const referencePoint = lastOnTrailPointRef.current;
        if (referencePoint) {
          const seg = calculateDistance(referencePoint.lat, referencePoint.lon, latitude, longitude);
          const gate = Math.max(DISTANCE_MIN_MOVE, position.coords.accuracy || 0);
          if (seg >= gate) {
            segmentDistance = seg;
            lastOnTrailPointRef.current = newPoint; // advance reference only when the move counts
          }
          // else: jitter — keep the reference so a slow, real walk still accumulates
        } else {
          lastOnTrailPointRef.current = newPoint;   // first on-trail fix
        }

        // ── Elevation: read the ground from the terrain DEM at this horizontal
        //    position (GPS vertical is unreliable). Keep a Kalman-filtered GPS
        //    altitude series as the offline fallback. ──
        const demEle = sampleDemElevation(longitude, latitude);
        const gpsAlt = (altitude != null && isFinite(altitude)) ? altitude : null;
        const kEle = altKalmanRef.current.update(gpsAlt, position.coords.altitudeAccuracy);

        demSeriesRef.current.push(demEle != null ? demEle : null);
        kalmanSeriesRef.current.push(kEle != null ? kEle : null);
        demCoverageRef.current.total += 1;
        if (demEle != null) demCoverageRef.current.have += 1;

        // Stash on the point so a reload / end-of-hike recompute can reuse it
        newPoint.demEle = demEle;
        newPoint.kEle = kEle;
        newPoint.acc = position.coords.accuracy;

        // Live gain from whichever source has coverage — never mix the two
        // (their absolute datums differ, which would fake a huge jump).
        const cov = demCoverageRef.current.total
          ? demCoverageRef.current.have / demCoverageRef.current.total : 0;
        const liveSeries = cov >= DEM_COVERAGE_MIN ? demSeriesRef.current : kalmanSeriesRef.current;
        const liveBand = cov >= DEM_COVERAGE_MIN ? DEM_DEADBAND : GPS_DEADBAND;
        const liveGain = computeGainLoss(liveSeries, liveBand).gain;

        // Duration excluding off-trail time
        const onTrailTime = (Date.now() - startTimeRef.current) - totalOffTrailTimeRef.current;

        const updatedStats = {
          distance: statsRef.current.distance + segmentDistance,
          elevation: liveGain,
          duration: Math.floor(onTrailTime / 1000),
          pace: speed || statsRef.current.pace
        };
        statsRef.current = updatedStats;
        setStats(updatedStats);
      } else if (currentlyOffTrail) {
        // Off trail: keep the clock moving but pause distance/elevation
        let onTrailTime = (Date.now() - startTimeRef.current) - totalOffTrailTimeRef.current;
        if (offTrailStartTimeRef.current) {
          onTrailTime -= (Date.now() - offTrailStartTimeRef.current);
        }
        const updatedStats = { ...statsRef.current, duration: Math.floor(onTrailTime / 1000) };
        statsRef.current = updatedStats;
        setStats(updatedStats);
      }
      
      // Update state for UI (async is fine here)
      setGpsTrack(updatedTrack);

      // Auto-finish: the whole route has been walked. Only when genuinely on the
      // trail (an off-trail projection can read near-100% misleadingly). This is a
      // FULL completion → the celebratory close (vs. ending early).
      if (!currentlyOffTrail && !completedFullRef.current && !isEndingRef.current) {
        // Bug #2: judge completion by distance actually WALKED, not by how close
        // we are to the last polyline point. On a loop the last point sits on the
        // first, so a position check "finishes" you at the trailhead the moment
        // you start. Walked-distance is monotonic and loop-safe.
        const L = getTotalTrailLength();
        if (L && statsRef.current.distance >= TRAIL_COMPLETE_DISTANCE_FRACTION * L) {
          completedFullRef.current = true;
          toast.success(t('gps.routeComplete', 'You reached the end of the trail! 🎉'));
          sendNotification(t('gps.routeCompleteTitle', 'Trail complete! 🎉'), trail.name || '');
          endHike(false);
        }
      }

      // Live Trail Companion: run the unified moment geofence. If the trail has
      // no moments, fall back to the legacy POI + checkpoint checks. Pass the
      // off-trail flag so waypoint alerts only fire when we're actually on-path.
      if (!checkMomentProximity(position.coords, currentlyOffTrail)) {
        checkPOIProximity(position.coords, currentlyOffTrail);
        checkCheckpointProximity(position.coords);
      }

      // IMPORTANT: Save hike session to localStorage after every GPS update (persistence fix)
      saveHikeSession();
    }
  };

  // Save active hike session to localStorage (Fix #5: Persistence)
  // CRITICAL FIX: Read from refs to capture latest data synchronously
  const saveHikeSession = () => {
    if (!isTracking || !startTimeRef.current) return;

    const session = {
      trailId: trail.id,
      trailName: trail.name,
      startTime: startTimeRef.current,
      gpsTrack: gpsTrackRef.current, // Read from ref for latest data
      currentPosition,
      stats: statsRef.current, // Read from ref for latest data
      visitedCheckpoints,
      isPaused,
      isOffTrail,
      checkpointStates: checkpointStatesRef.current,
      moments: momentsRef.current,
      momentStates: momentStatesRef.current,
      lastPosition: lastPositionForMovementRef.current,
      lastMoveTime: lastMoveTimeRef.current,
      totalOffTrailTime: totalOffTrailTimeRef.current,
      offTrailStartTime: offTrailStartTimeRef.current,
      lastOnTrailPoint: lastOnTrailPointRef.current,
      demSeries: demSeriesRef.current,
      kalmanSeries: kalmanSeriesRef.current,
      demCoverage: demCoverageRef.current,
      timestamp: Date.now()
    };

    localStorage.setItem('activeHikeSession', JSON.stringify(session));
  };

  // Restore active hike session from localStorage (Fix #5: Persistence)
  const restoreHikeSession = () => {
    try {
      const saved = localStorage.getItem('activeHikeSession');
      if (!saved) return false;

      const session = JSON.parse(saved);
      
      // Check if session is for the same trail and not too old (> 12 hours)
      const sessionAge = Date.now() - session.timestamp;
      if (session.trailId !== trail.id || sessionAge > 12 * 60 * 60 * 1000) {
        localStorage.removeItem('activeHikeSession');
        return false;
      }

      // Restore refs FIRST (synchronous)
      startTimeRef.current = session.startTime;
      gpsTrackRef.current = session.gpsTrack || [];
      statsRef.current = session.stats || { distance: 0, elevation: 0, duration: 0, pace: 0 };
      checkpointStatesRef.current = session.checkpointStates || {};
      momentsRef.current = session.moments || [];
      momentStatesRef.current = session.momentStates || {};
      if (!momentsRef.current.length) fetchMoments();   // older session → refetch
      lastPositionForMovementRef.current = session.lastPosition;
      lastMoveTimeRef.current = session.lastMoveTime || Date.now();
      totalOffTrailTimeRef.current = session.totalOffTrailTime || 0;
      offTrailStartTimeRef.current = session.offTrailStartTime || null;
      lastOnTrailPointRef.current = session.lastOnTrailPoint || null;
      demSeriesRef.current = session.demSeries || [];
      kalmanSeriesRef.current = session.kalmanSeries || [];
      demCoverageRef.current = session.demCoverage || { have: 0, total: 0 };

      // Then restore state (async is fine)
      setGpsTrack(session.gpsTrack || []);
      setCurrentPosition(session.currentPosition);
      setStats(session.stats || { distance: 0, elevation: 0, duration: 0, pace: 0 });
      setVisitedCheckpoints(session.visitedCheckpoints || []);
      setIsPaused(session.isPaused || false);
      setIsOffTrail(session.isOffTrail || false);
      setIsTracking(true);

      console.log('✅ Active hike session restored from localStorage');
      toast.success('🔄 Active hike restored!');
      return true;
    } catch (error) {
      console.error('Failed to restore hike session:', error);
      localStorage.removeItem('activeHikeSession');
      return false;
    }
  };

  // Clear active hike session from localStorage
  const clearHikeSession = () => {
    localStorage.removeItem('activeHikeSession');
  };

  // Start tracking
  const startTracking = () => {
    requestNotificationPermission();
    requestWakeLock();
    fetchMoments();   // Live Trail Companion: load geo-anchored moments
    // Warm up speech voices (some browsers populate them lazily).
    try { if ('speechSynthesis' in window) window.speechSynthesis.getVoices(); } catch { /* no-op */ }
    // Web reality: tracking pauses if the screen locks — nudge to keep it open.
    toast.info(t('gps.keepOpenHint', 'Keep Josephine open on screen to stay on the trail.'));

    startTimeRef.current = Date.now();
    lastMoveTimeRef.current = Date.now();
    setIsTracking(true);
    setShowDisclaimer(false);

    // Set initial test position if coordinates available (for testing when GPS unavailable)
    if (!currentPosition && trailRoute?.geometry?.coordinates?.[0]) {
      const [lon, lat] = trailRoute.geometry.coordinates[0];
      const testPosition = {
        lat,
        lon,
        alt: 650,
        timestamp: Date.now()
      };
      setCurrentPosition(testPosition);
      console.log('Test GPS position set:', testPosition);
    }

    if ('geolocation' in navigator) {
      console.log('Starting GPS tracking...');
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          console.log('GPS UPDATE RECEIVED:', position.coords.latitude, position.coords.longitude);
          handlePositionUpdate(position);
        },
        (error) => {
          console.error('GPS Error:', error);
          console.error('GPS Error code:', error.code, 'Message:', error.message);
          
          // Show alert to user about GPS permission
          alert(`GPS Error (${error.code}): ${error.message}. Please enable location permission in your browser settings.`);
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0
        }
      );

      // Set interval to ensure updates every 20 seconds
      intervalRef.current = setInterval(() => {
        // Check for inactivity (6 hours)
        if (Date.now() - lastMoveTimeRef.current > INACTIVITY_TIMEOUT) {
          endHike(true); // Auto-end
        }
      }, GPS_UPDATE_INTERVAL);
    }
  };

  // Pause/Resume tracking
  const togglePause = () => {
    setIsPaused(!isPaused);
    // Clear auto-pause state when user manually pauses/resumes
    autoPausedRef.current = false;
    // Reset movement tracking when resuming
    if (isPaused && currentPosition) {
      lastPositionForMovementRef.current = currentPosition;
      lastMoveTimeRef.current = Date.now();
    }
  };

  // ── Pocket / background resume ─────────────────────────────────────────────
  // After the phone has been backgrounded for a while (GPS pauses while the
  // screen is locked), we ask whether the hiker is still on the trail.

  // "Yes, still going" → grab a fresh fix so the dot jumps to where they are now
  // and the stats absorb whatever distance was walked while pocketed.
  const handleStillOnTrail = () => {
    setShowResumePrompt(false);
    autoPausedRef.current = false;
    setIsPaused(false);
    lastMoveTimeRef.current = Date.now();
    teleportNextRef.current = true; // next fix is a resume → rebaseline, don't bridge the gap
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => handlePositionUpdate(position),
        (err) => { console.warn('Resume getCurrentPosition failed:', err); },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
    }
  };

  // "No, I've stopped" → end the hike quietly, no celebration.
  const handleNotOnTrail = () => {
    setShowResumePrompt(false);
    endHike(false, { silent: true });
  };

  // Generate emergency share link
  const generateShareLink = () => {
    if (!currentPosition) return;

    const shareId = `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const shareData = {
      trail: trail.name,
      position: currentPosition,
      timestamp: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    localStorage.setItem(shareId, JSON.stringify(shareData));
    
    const link = `${window.location.origin}/#/live/${shareId}`;
    setShareLink(link);

    // Copy to clipboard
    navigator.clipboard.writeText(link).then(() => {
      alert('Live location link copied to clipboard! Valid for 24 hours.');
    });
  };

  // Export GPX
  const exportGPX = () => {
    if (gpsTrackRef.current.length === 0) return;

    const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Josephine">
  <metadata>
    <name>${trail.name}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${trail.name}</name>
    <trkseg>`;

    const gpxPoints = gpsTrackRef.current.map(point => 
      `      <trkpt lat="${point.lat}" lon="${point.lon}">
        <ele>${point.alt}</ele>
        <time>${new Date(point.timestamp).toISOString()}</time>
      </trkpt>`
    ).join('\n');

    const gpxFooter = `
    </trkseg>
  </trk>
</gpx>`;

    const gpxContent = gpxHeader + '\n' + gpxPoints + gpxFooter;
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trail.id}-${new Date().toISOString().split('T')[0]}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // End hike. `opts.silent` saves and leaves with NO celebration (used when the
  // user says they're no longer on the trail after a pocket/background gap).
  const endHike = async (autoEnded = false, opts = {}) => {
    // Prevent duplicate saves (ref guard works inside async GPS callbacks too)
    if (isEndingRef.current) {
      console.log('Already ending hike, ignoring duplicate end');
      return;
    }
    isEndingRef.current = true;
    setIsEnding(true);

    // Stop tracking
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    releaseWakeLock();
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch { /* no-op */ }

    if (opts.silent) {
      // Quiet exit — record the hike, no recap, no celebration.
      finalizeHike(null, null, true, { silent: true });
    } else if (autoEnded) {
      // Auto-ended after long inactivity (user gone) → save straight away.
      finalizeHike(null, null, true);
    } else {
      // A deliberate end (or route fully walked) → ask "how were the legs?"
      // first so the rating rides along in the save payload.
      setShowRecap(true);
    }
  };

  // Did this hike conquer a summit? (drives meadow vs summit celebration —
  // we only "plant the flag" when a peak was genuinely part of the route.)
  const _isSummitHike = () => {
    const hasPeak = (arr) => (arr || []).some(x => /summit|peak/i.test(x.type || ''));
    return hasPeak(trail.checkpoints)
      || hasPeak(trail.pois || trail.points_of_interest)
      || /summit|peak|cima|vetta|gipfel|spitze|cir|sass|piz\b/i.test(trail.name || '');
  };

  // Did the hiker walk the whole route? Drives full vs. early-exit celebration.
  const _isRouteComplete = () => {
    if (completedFullRef.current) return true;
    // Walked-distance based (loop-safe) — see TRAIL_COMPLETE_DISTANCE_FRACTION.
    const L = getTotalTrailLength();
    if (!L) return false;
    return statsRef.current.distance >= TRAIL_COMPLETE_DISTANCE_FRACTION * L;
  };

  // Save the hike (with optional recap rating) → gamification → celebration.
  // `opts.silent` saves and leaves immediately with no celebration card.
  const finalizeHike = async (rating, note, autoEnded, opts = {}) => {
    const isComplete = _isRouteComplete();

    // ── Batch elevation recompute ──────────────────────────────────────────
    // Live gain is a running counter; here we recompute the whole track once,
    // cleanly. Pick ONE source for the entire hike (never mix datums): DEM if it
    // covered enough fixes, otherwise Kalman-filtered GPS altitude. Smooth, then
    // ratchet the ups past a small dead-band.
    const cov = demCoverageRef.current.total
      ? demCoverageRef.current.have / demCoverageRef.current.total : 0;
    const useDem = cov >= DEM_COVERAGE_MIN && demSeriesRef.current.length > 1;
    const rawSeries = useDem ? demSeriesRef.current : kalmanSeriesRef.current;
    let measuredGain;
    if (rawSeries && rawSeries.length > 1) {
      const smoothed = smoothSeries(rawSeries, ELEV_SMOOTH_WINDOW);
      measuredGain = computeGainLoss(smoothed, useDem ? DEM_DEADBAND : GPS_DEADBAND).gain;
    } else {
      // Restored session with no series, or too few points — keep the live value.
      measuredGain = statsRef.current.elevation;
    }
    const elevationSource = (rawSeries && rawSeries.length > 1)
      ? (useDem ? 'dem' : 'gps') : 'live';
    // Official planned-trail ascent (the headline for completed planned hikes).
    const trailGain = (trail?.elevation_gain_m != null && isFinite(trail.elevation_gain_m))
      ? trail.elevation_gain_m : null;

    const hikeData = {
      user_email: currentUser?.email || null,
      trail_id: trail.id,
      trail_name: trail.name,
      is_summit: _isSummitHike(),
      completed: isComplete,          // walked the whole route?
      start_time: new Date(startTimeRef.current).toISOString(),
      end_time: new Date().toISOString(),
      gps_track: gpsTrackRef.current,
      visited_checkpoints: visitedCheckpoints,
      rating: rating || null,         // "how were the legs?" 1–3 (easy/good/tough)
      note: (note || '').trim() || null,
      stats: {
        distance_km: statsRef.current.distance / 1000,
        elevation_gain_m: measuredGain,
        trail_elevation_gain_m: trailGain,   // official planned profile (if any)
        elevation_source: elevationSource,   // 'dem' | 'gps' | 'live'
        duration_hours: statsRef.current.duration / 3600,
        auto_ended: autoEnded,
        completed: isComplete
      }
    };

    try {
      // Attach the Firebase ID token so the backend can pin the hike to the
      // verified account when server-side verification is enabled.
      const saveHeaders = { 'Content-Type': 'application/json' };
      try {
        const idToken = currentUser && await currentUser.getIdToken();
        if (idToken) saveHeaders['Authorization'] = `Bearer ${idToken}`;
      } catch { /* token unavailable — guest/anon save proceeds unchanged */ }
      await fetch('/api/hikes/save', {
        method: 'POST',
        headers: saveHeaders,
        body: JSON.stringify(hikeData)
      });
    } catch (error) {
      console.error('Failed to save hike:', error);
    }

    // Gamification (XP/badges) is not launched → only compute when enabled.
    const gamificationResult = ENABLE_GAMIFICATION ? checkNewBadges({
      distance: statsRef.current.distance,
      elevation: measuredGain,
      duration: statsRef.current.duration,
      trailId: trail.id,
      startTime: startTimeRef.current,
      endTime: Date.now(),
      completed: isComplete
    }) : null;

    const fullData = { ...hikeData, gamification: gamificationResult };
    setCompletedHikeData(fullData);
    // Remember this hike on-device (region, summit, how the legs felt).
    rememberCompletedHike({ trailName: trail.name, region: trail.region,
                            isSummit: hikeData.is_summit, rating });
    setShowRecap(false);

    // Silent exit (e.g. "I'm no longer on the trail") — no celebration at all.
    if (opts.silent) {
      clearHikeSession();
      onEnd(fullData);
      return;
    }

    if (ENABLE_GAMIFICATION) {
      setShowCelebration(true);
    } else {
      // On-brand close: Josephine sees you off the trail (no gamification).
      // The line differs for a full finish vs. turning back early.
      const line = (isComplete
        ? t('gps.completeLineFull', 'You walked every step of {{trail}} — that air and that light stay with you.')
        : t('gps.completeLinePartial', 'You turned back on {{trail}} today — the mountain keeps. Come finish it when you can.')
      ).replace('{{trail}}', trail.name || '');
      setCompleteLine(line);
      speakLine(line);
      setShowComplete(true);
    }
  };
  
  // Handle celebration close
  const handleCelebrationClose = () => {
    setShowCelebration(false);
    setShowTripSummary(true); // Show trip summary after celebration
  };

  const handleTripSummaryClose = () => {
    // Export GPX automatically (use ref for latest data)
    if (gpsTrackRef.current.length > 0) {
      exportGPX();
    }
    
    // Clear active hike session from localStorage (Fix #5: Persistence)
    clearHikeSession();
    
    setShowTripSummary(false);
    onEnd(completedHikeData);
  };

  const handleAddReview = () => {
    setShowTripSummary(false);
    // Navigate to add review (will be handled by parent)
    onEnd({ ...completedHikeData, showReviewForm: true });
  };

  // Restore active hike session on component mount (Fix #5: Persistence)
  useEffect(() => {
    const restored = restoreHikeSession();
    if (restored) {
      // Resume GPS tracking after restoration
      requestNotificationPermission();
      requestWakeLock();
      
      if ('geolocation' in navigator) {
        console.log('Resuming GPS tracking from restored session...');
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            handlePositionUpdate(position);
          },
          (error) => {
            console.error('GPS Error:', error);
          },
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
          }
        );

        intervalRef.current = setInterval(() => {
          if (Date.now() - lastMoveTimeRef.current > INACTIVITY_TIMEOUT) {
            endHike(true);
          }
        }, GPS_UPDATE_INTERVAL);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      releaseWakeLock();
    };
  }, []);

  // Handle page visibility changes to maintain GPS tracking
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isTracking) {
        console.log('[GPS] Page visible - re-acquiring wake lock');
        await requestWakeLock();

        // If we were backgrounded long enough that GPS likely paused (phone in
        // pocket), confirm the hiker is still on the trail before trusting the
        // resumed track. Skip if the hike is already wrapping up.
        const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
        hiddenAtRef.current = null;
        if (
          hiddenFor >= RESUME_PROMPT_THRESHOLD &&
          !isEndingRef.current &&
          !completedFullRef.current
        ) {
          teleportNextRef.current = true; // first fix after a long background gap → rebaseline
          setShowResumePrompt(true);
        }
      } else if (document.visibilityState === 'hidden' && isTracking) {
        console.log('[GPS] Page hidden - GPS may pause on some devices');
        hiddenAtRef.current = Date.now();
        sendNotification(
          'GPS Tracking Active',
          'Keep Josephine open to continue tracking your hike'
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTracking]);

  if (showDisclaimer) {
    return (
      <SafetyDisclaimerModal
        trailName={trail.name}
        onAccept={startTracking}
        onCancel={() => onEnd(null)}
      />
    );
  }

  return (
    <div className="active-hike-tracker">
      <div className="tracker-map">
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{
            longitude: trailRoute?.geometry?.coordinates[0][0] || currentPosition?.lon || 11.35,
            latitude: trailRoute?.geometry?.coordinates[0][1] || currentPosition?.lat || 46.49,
            zoom: 13
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/outdoors-v12"
          onLoad={handleMapLoad}
        >
          {/* Navigation controls - positioned top-left to avoid stats panel */}
          <NavigationControl position="top-left" showCompass={true} showZoom={true} />

          {/* Trail route - highlighted when tracking */}
          {trailRoute && (
            <Source id="route" type="geojson" data={trailRoute}>
              <Layer
                id="route-line"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': '#c9a84c',
                  'line-width': isTracking ? 6 : 4,
                  'line-opacity': isTracking ? 1 : 0.85
                }}
              />
              {isTracking && (
                <Layer
                  id="route-line-glow"
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{
                    'line-color': '#c9a84c',
                    'line-width': 14,
                    'line-opacity': 0.25,
                    'line-blur': 6
                  }}
                />
              )}
              {/* Bug #1: which way do I go? Arrowheads ride along the route in the
                  direction the line is drawn (coordinate order = hiking direction),
                  so loops are no longer ambiguous. */}
              <Layer
                id="route-direction"
                type="symbol"
                layout={{
                  'symbol-placement': 'line',
                  'symbol-spacing': 90,
                  'text-field': '▶',
                  'text-size': 15,
                  'text-keep-upright': false,
                  'text-allow-overlap': true,
                  'text-rotation-alignment': 'map',
                  'text-pitch-alignment': 'map'
                }}
                paint={{
                  'text-color': '#0c160d',
                  'text-halo-color': '#c9a84c',
                  'text-halo-width': 1.6,
                  'text-opacity': 0.9
                }}
              />
            </Source>
          )}

          {/* User's GPS track — split at teleport/resume breaks (Bug #3) */}
          {gpsTrack.length > 1 && (
            <Source
              id="gps-track"
              type="geojson"
              data={{
                type: 'Feature',
                geometry: {
                  type: 'MultiLineString',
                  coordinates: buildTrackSegments(gpsTrack)
                }
              }}
            >
              <Layer
                id="gps-track-line"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': '#f0ece6',
                  'line-width': 3,
                  'line-opacity': 0.85,
                  'line-dasharray': [1, 1.5]
                }}
              />
            </Source>
          )}

          {/* Current position marker */}
          {currentPosition && (
            <Marker
              longitude={currentPosition.lon}
              latitude={currentPosition.lat}
              anchor="center"
            >
              <div className={`user-marker ${isOffTrail ? 'off-trail' : ''}`}>
                <div className="marker-pulse"></div>
                <div className="marker-dot"></div>
              </div>
            </Marker>
          )}

          {/* Josephine walking alongside */}
          {currentPosition && (
            <Marker
              longitude={currentPosition.lon}
              latitude={currentPosition.lat}
              anchor="bottom"
              offset={[26, -6]}
            >
              <div className={`jph-companion ${isOffTrail ? 'jph-companion--concerned' : ''}`}>
                {activeMoment && (
                  <div className="jph-bubble">
                    <span className="jph-bubble__icon">{activeMoment.icon || '✦'}</span>
                    <span className="jph-bubble__text">{activeMoment.line}</span>
                  </div>
                )}
                <img src="/josephine/portrait.png" alt="Josephine" className="jph-companion__avatar"
                  onError={e => { e.currentTarget.src='/josephine-portrait.webp'; }} />
              </div>
            </Marker>
          )}
        </Map>
      </div>

      {/* Floating Stats Panel */}
      <div className="floating-stats-panel">
        <div className="stat-row">
          <span>🥾</span>
          <span>{(stats.distance / 1000).toFixed(1)}km</span>
        </div>
        <div className="stat-row">
          <span>⛰️</span>
          <span>{Math.round(stats.elevation)}m</span>
        </div>
        <div className="stat-row">
          <span>📊</span>
          <span>{Math.round(getProgressPercent())}%</span>
        </div>
        <div className="stat-row">
          <span>⏱️</span>
          <span>{Math.floor(stats.duration / 3600)}:{String(Math.floor((stats.duration % 3600) / 60)).padStart(2, '0')}</span>
        </div>
        <div className="stat-row" style={{color: isOffTrail ? '#ef4444' : '#4ade80'}}>
          <span>{isOffTrail ? '⚠️' : '✓'}</span>
          <span>{isOffTrail ? 'OFF' : 'ON'}</span>
        </div>
      </div>

      {/* Controls — hidden once the hike is wrapping up so they don't bleed
          under the recap / celebration / completion card. */}
      {!showRecap && !showCelebration && !showComplete && !showResumePrompt && (
      <div className="tracker-controls">
        <button
          className="control-btn pause-btn"
          onClick={togglePause}
        >
          {isPaused ? '▶️ Resume' : '⏸️ Pause'}
        </button>

        <button
          className="control-btn mute-btn"
          onClick={() => {
            setAudioMuted(prev => {
              const next = !prev;
              try { localStorage.setItem('companionMuted', next ? '1' : '0'); } catch { /* no-op */ }
              if (next && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              return next;
            });
          }}
          aria-pressed={audioMuted}
          title={audioMuted ? t('gps.unmuteJosephine', 'Unmute Josephine') : t('gps.muteJosephine', 'Mute Josephine')}
        >
          {audioMuted ? '🔇' : '🔊'}
        </button>

        <button
          className="control-btn end-btn"
          onClick={() => endHike(false)}
          disabled={isEnding}
        >
          {isEnding ? '⌛ Ending...' : '🏁 End Hike'}
        </button>
      </div>
      )}

      {/* Off-trail warning banner */}
      {isOffTrail && !showRecap && !showCelebration && !showComplete && !showResumePrompt && (
        <div className="warning-banner off-trail-active">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <div className="warning-title">{t('gps.offTrailAlert') || 'Off Trail'}</div>
            <div className="warning-message">
              {t('gps.statsPausedMessage') || 'Stats recording paused. Return to trail to resume.'}
            </div>
          </div>
        </div>
      )}

      {/* "Still on the trail?" — shown after the app was backgrounded long
          enough that GPS likely paused (phone in pocket). */}
      {showResumePrompt && (
        <div className="recap-overlay">
          <div className="recap-card">
            <img src="/josephine-portrait.webp" alt="Josephine" className="recap-avatar" />
            <p className="recap-q">{t('gps.resumeQuestion', 'Welcome back — are you still on the trail?')}</p>
            <div className="recap-options">
              <button className="recap-opt" onClick={handleStillOnTrail}>
                <span>🥾</span>{t('gps.resumeYes', 'Still hiking')}
              </button>
              <button className="recap-opt" onClick={handleNotOnTrail}>
                <span>🏁</span>{t('gps.resumeNo', "I've stopped")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recap: "how were the legs?" — rides along in the save payload */}
      {showRecap && (
        <div className="recap-overlay">
          <div className="recap-card">
            <img src="/josephine-portrait.webp" alt="Josephine" className="recap-avatar" />
            <p className="recap-q">{t('gps.recapQuestion', 'How were the legs?')}</p>
            <div className="recap-options">
              <button className="recap-opt" onClick={() => finalizeHike(1, null, false)}>
                <span>🙂</span>{t('gps.recapEasy', 'Easy')}
              </button>
              <button className="recap-opt" onClick={() => finalizeHike(2, null, false)}>
                <span>💪</span>{t('gps.recapGood', 'Just right')}
              </button>
              <button className="recap-opt" onClick={() => finalizeHike(3, null, false)}>
                <span>😣</span>{t('gps.recapTough', 'Tough')}
              </button>
            </div>
            <button className="recap-skip" onClick={() => finalizeHike(null, null, false)}>
              {t('gps.recapSkip', 'Skip')}
            </button>
          </div>
        </div>
      )}

      {/* On-brand completion (gamification off) — Josephine sees you off */}
      {showComplete && completedHikeData && (
        <HikeComplete
          hikeData={completedHikeData}
          trail={trail}
          line={completeLine}
          completed={completedHikeData.completed !== false}
          onExportGpx={() => { if (gpsTrackRef.current.length > 0) exportGPX(); }}
          onAddReview={() => { clearHikeSession(); setShowComplete(false); onEnd({ ...completedHikeData, showReviewForm: true }); }}
          onDone={() => { clearHikeSession(); setShowComplete(false); onEnd(completedHikeData); }}
        />
      )}

      {/* Celebration Modal (only when gamification is enabled) */}
      {showCelebration && completedHikeData && (
        <CelebrationModal
          hikeData={completedHikeData}
          gamification={completedHikeData.gamification}
          onClose={handleCelebrationClose}
        />
      )}

      {/* Trip Summary */}
      {showTripSummary && completedHikeData && (
        <TripSummary
          hikeData={completedHikeData}
          onClose={handleTripSummaryClose}
          onAddReview={handleAddReview}
        />
      )}
    </div>
  );
}

export default ActiveHikeTracker;
