import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl';
import SafetyDisclaimerModal from './SafetyDisclaimerModal';
import CelebrationModal from './CelebrationModal';
import TripSummary from './TripSummary';
import { checkNewBadges } from '../utils/gamification';
import { useToast } from '../contexts/ToastContext';
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
const ELEVATION_NOISE_THRESHOLD = 5; // 5m threshold to filter GPS altitude noise
const ELEVATION_SMOOTHING_WINDOW = 5; // Use last 5 altitude readings for median filter
const CHECKPOINT_ARRIVAL_RADIUS = 30; // meters to mark as reached
const CHECKPOINT_PASSED_RADIUS = 40; // meters to mark as passed after reaching

function ActiveHikeTracker({ trail, onEnd }) {
  const { t } = useTranslation();
  const toast = useToast();
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
  
  const watchIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastMoveTimeRef = useRef(null);
  const lastPositionForMovementRef = useRef(null); // Track position for movement detection
  const autoPausedRef = useRef(false); // Track if auto-paused
  const wakeLockRef = useRef(null);
  const intervalRef = useRef(null);
  const elevationGainBufferRef = useRef(0); // Accumulate positive elevation changes
  const elevationLossBufferRef = useRef(0); // Accumulate negative elevation changes
  const offTrailStartTimeRef = useRef(null); // Track when user went off trail
  const totalOffTrailTimeRef = useRef(0); // Accumulate total off-trail time
  const lastOnTrailPointRef = useRef(null); // Track last on-trail GPS point for stat calculations
  
  // NEW: Enhanced checkpoint tracking with state machine
  const checkpointStatesRef = useRef({}); // { [checkpointIndex]: { state: 'approaching'|'reached'|'passed', lastDistance: number } }
  const lastNotificationRef = useRef({}); // { [checkpointIndex]: { time: number, position: {lat, lon} } }
  const altitudeHistoryRef = useRef([]); // Sliding window for median filtering
  const lastValidAltitudeRef = useRef(null); // Last validated altitude reading
  
  // CRITICAL FIX: Use refs for gpsTrack and stats to ensure persistence captures latest data
  const gpsTrackRef = useRef([]);
  const statsRef = useRef({ distance: 0, elevation: 0, duration: 0, pace: 0 });

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

  // Median filter for altitude smoothing
  const medianFilter = (values) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  // Find nearest point on polyline and calculate distance along trail
  const findNearestPointOnPolyline = (userLat, userLon, polylineCoords) => {
    if (!polylineCoords || polylineCoords.length < 2) {
      return { segmentIndex: 0, distanceToLine: Infinity, distanceAlongTrail: 0, projectedPoint: null };
    }

    let minDistanceToLine = Infinity;
    let bestSegmentIndex = 0;
    let bestProjectedPoint = null;
    let distanceAlongTrail = 0;

    for (let i = 0; i < polylineCoords.length - 1; i++) {
      const [lon1, lat1] = polylineCoords[i];
      const [lon2, lat2] = polylineCoords[i + 1];

      // Project user position onto line segment
      const dx = lon2 - lon1;
      const dy = lat2 - lat1;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      
      if (segmentLength === 0) continue;

      const t = Math.max(0, Math.min(1, 
        ((userLon - lon1) * dx + (userLat - lat1) * dy) / (segmentLength * segmentLength)
      ));

      const projectedLon = lon1 + t * dx;
      const projectedLat = lat1 + t * dy;
      const distToSegment = calculateDistance(userLat, userLon, projectedLat, projectedLon);

      if (distToSegment < minDistanceToLine) {
        minDistanceToLine = distToSegment;
        bestSegmentIndex = i;
        bestProjectedPoint = { lat: projectedLat, lon: projectedLon };
      }
    }

    // Calculate cumulative distance along trail up to projected point
    for (let i = 0; i < bestSegmentIndex; i++) {
      const [lon1, lat1] = polylineCoords[i];
      const [lon2, lat2] = polylineCoords[i + 1];
      distanceAlongTrail += calculateDistance(lat1, lon1, lat2, lon2);
    }

    // Add partial distance within the segment
    if (bestProjectedPoint) {
      const [lon1, lat1] = polylineCoords[bestSegmentIndex];
      distanceAlongTrail += calculateDistance(lat1, lon1, bestProjectedPoint.lat, bestProjectedPoint.lon);
    }

    return {
      segmentIndex: bestSegmentIndex,
      distanceToLine: minDistanceToLine,
      distanceAlongTrail,
      projectedPoint: bestProjectedPoint
    };
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

  // Calculate progress percentage along trail
  const calculateTrailProgress = (userLat, userLon, polylineCoords) => {
    if (!polylineCoords || polylineCoords.length < 2) return 0;

    // Calculate total trail length
    let totalLength = 0;
    for (let i = 0; i < polylineCoords.length - 1; i++) {
      const [lon1, lat1] = polylineCoords[i];
      const [lon2, lat2] = polylineCoords[i + 1];
      totalLength += calculateDistance(lat1, lon1, lat2, lon2);
    }

    // Find user's distance along trail
    const { distanceAlongTrail } = findNearestPointOnPolyline(userLat, userLon, polylineCoords);

    return Math.min(100, Math.max(0, (distanceAlongTrail / totalLength) * 100));
  };

  // Calculate accurate distance from point to trail polyline (for off-trail detection)
  const distanceToTrail = (point, trailCoordinates) => {
    if (!trailCoordinates || trailCoordinates.length < 2) return Infinity;
    
    // Use existing findNearestPointOnPolyline for accurate projection-based distance
    const projection = findNearestPointOnPolyline(point.lat, point.lon, trailCoordinates);
    return projection.distanceToLine;
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

  // Check POI proximity and send alerts
  const checkPOIProximity = (position) => {
    const pois = trail.points_of_interest || trail.pois;
    if (!pois) return;

    pois.forEach((poi, index) => {
      const distance = calculateDistance(
        position.latitude,
        position.longitude,
        poi.coordinates[1],
        poi.coordinates[0]
      );

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
        const icon = checkpoint.type === 'summit' ? '⛰️' : checkpoint.type === 'refuge' ? '🏠' : '📍';
        toast.success(t('gps.checkpointReachedToast', { icon, name: checkpoint.name }));
        sendNotification(
          t('gps.checkpointReachedNotification', { icon }),
          t('gps.checkpointReachedNotificationBody', { name: checkpoint.name })
        );
        playMountainBell(); // Play sound cue for arrival

        // Track visited checkpoint
        setVisitedCheckpoints(prev => [...prev, {
          index,
          name: checkpoint.name,
          type: checkpoint.type,
          timestamp: Date.now(),
          coordinates: checkpoint.coordinates
        }]);
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
        
        // Auto-resume if was auto-paused
        if (autoPausedRef.current && isPaused) {
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

    // Auto-pause detection: if no significant movement for 60+ seconds and not manually paused
    if (!hasMoved && !isPaused && !autoPausedRef.current) {
      const timeSinceLastMove = Date.now() - lastMoveTimeRef.current;
      if (timeSinceLastMove > AUTO_PAUSE_THRESHOLD) {
        console.log('No movement detected for 60 seconds, auto-pausing tracking');
        setIsPaused(true);
        autoPausedRef.current = true;
        toast.warning(`⏸️ ${t('gps.trackingPaused')}`);
        sendNotification(t('gps.trackingPaused'), t('gps.noMovementDetected'));
      }
    }

    if (!isPaused) {
      // Check if user is off trail FIRST (before updating any stats)
      let currentlyOffTrail = false;
      if (trail.coordinates || trailRoute?.geometry?.coordinates) {
        const distToTrail = distanceToTrail(newPoint, trail.coordinates || trailRoute.geometry.coordinates);
        currentlyOffTrail = distToTrail > OFF_TRAIL_DISTANCE;
        
        // Handle off-trail state transitions
        if (currentlyOffTrail && !isOffTrail) {
          // Just went off trail - clear last on-trail point so we don't bridge the gap when returning
          offTrailStartTimeRef.current = Date.now();
          lastOnTrailPointRef.current = null; // CRITICAL: Clear to prevent bridging off-trail distance
          setIsOffTrail(true);
          setOffTrailWarning(true);
          sendNotification(
            t('gps.offTrailAlert') || 'Off Trail Alert',
            t('gps.offTrailMessage') || 'You are off the trail. Stats recording paused until you return to the route.'
          );
          toast.warning(`⚠️ ${t('gps.offTrailAlert') || 'Off Trail - Stats Paused'}`);
        } else if (!currentlyOffTrail && isOffTrail) {
          // Just returned to trail
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
      let elevationToAdd = 0;
      let segmentDistance = 0;
      
      if (!currentlyOffTrail) {
        // When on trail, use last on-trail point for calculations
        const referencePoint = lastOnTrailPointRef.current;
        
        if (referencePoint) {
          // We have a previous on-trail point - calculate distance and elevation
          segmentDistance = calculateDistance(
            referencePoint.lat,
            referencePoint.lon,
            latitude,
            longitude
          );

          // IMPROVED elevation calculation with median filtering and noise threshold
          const accuracy = position.coords.accuracy;
          const isAccurate = !accuracy || accuracy <= 20; // Skip if accuracy > 20m
        
        if (altitude && isAccurate) {
          // Add to rolling history for median filter
          altitudeHistoryRef.current.push(altitude);
          if (altitudeHistoryRef.current.length > ELEVATION_SMOOTHING_WINDOW) {
            altitudeHistoryRef.current.shift();
          }

          // Apply median filter to smooth GPS noise
          const smoothedAltitude = medianFilter(altitudeHistoryRef.current);

          // Only process elevation if we have valid previous altitude
          if (lastValidAltitudeRef.current !== null) {
            const elevationChange = smoothedAltitude - lastValidAltitudeRef.current;

            // Apply noise threshold: ignore changes smaller than 5m
            if (Math.abs(elevationChange) >= ELEVATION_NOISE_THRESHOLD) {
              if (elevationChange > 0) {
                // Positive change: cancel any pending loss first, then add remainder to gain
                if (elevationLossBufferRef.current > 0) {
                  const cancellation = Math.min(elevationLossBufferRef.current, elevationChange);
                  elevationLossBufferRef.current -= cancellation;
                  const netChange = elevationChange - cancellation;
                  if (netChange > 0) {
                    elevationGainBufferRef.current += netChange;
                  }
                } else {
                  elevationGainBufferRef.current += elevationChange;
                }

                // When accumulated gain exceeds threshold, count it and reset
                if (elevationGainBufferRef.current >= ELEVATION_NOISE_THRESHOLD) {
                  elevationToAdd = elevationGainBufferRef.current;
                  elevationGainBufferRef.current = 0;
                }
              } else if (elevationChange < 0) {
                // Negative change: cancel any pending gain first, then add remainder to loss
                const absChange = Math.abs(elevationChange);
                if (elevationGainBufferRef.current > 0) {
                  const cancellation = Math.min(elevationGainBufferRef.current, absChange);
                  elevationGainBufferRef.current -= cancellation;
                  const netChange = absChange - cancellation;
                  if (netChange > 0) {
                    elevationLossBufferRef.current += netChange;
                  }
                } else {
                  elevationLossBufferRef.current += absChange;
                }

                // If accumulated loss exceeds threshold, it's a real descent - reset both buffers
                if (elevationLossBufferRef.current >= ELEVATION_NOISE_THRESHOLD) {
                  elevationGainBufferRef.current = 0;
                  elevationLossBufferRef.current = 0;
                }
              }

              // Update last valid altitude after processing
              lastValidAltitudeRef.current = smoothedAltitude;
            }
          } else {
            // First valid altitude reading
            lastValidAltitudeRef.current = smoothedAltitude;
          }
        }

        // Calculate duration excluding off-trail time
        let totalElapsedTime = Date.now() - startTimeRef.current;
        let onTrailTime = totalElapsedTime - totalOffTrailTimeRef.current;
        
        // If currently off trail, also subtract current off-trail period
        if (currentlyOffTrail && offTrailStartTimeRef.current) {
          onTrailTime -= (Date.now() - offTrailStartTimeRef.current);
        }
        
        // Update stats ref synchronously (ONLY when on trail)
        const updatedStats = {
          distance: statsRef.current.distance + segmentDistance,
          elevation: statsRef.current.elevation + elevationToAdd,
          duration: Math.floor(onTrailTime / 1000),
          pace: speed || statsRef.current.pace
        };
        statsRef.current = updatedStats;
        
        // Update state for UI (async is fine here)
        setStats(updatedStats);
        }
        
        // Update last on-trail point after successful stat calculation
        lastOnTrailPointRef.current = newPoint;
      } else if (currentlyOffTrail) {
        // Still update duration even when off-trail, but exclude off-trail time
        let totalElapsedTime = Date.now() - startTimeRef.current;
        let onTrailTime = totalElapsedTime - totalOffTrailTimeRef.current;
        
        if (offTrailStartTimeRef.current) {
          onTrailTime -= (Date.now() - offTrailStartTimeRef.current);
        }
        
        const updatedStats = {
          ...statsRef.current,
          duration: Math.floor(onTrailTime / 1000)
        };
        statsRef.current = updatedStats;
        setStats(updatedStats);
      }
      
      // Update state for UI (async is fine here)
      setGpsTrack(updatedTrack);

      // Check POI proximity
      checkPOIProximity(position.coords);
      
      // Check checkpoint proximity
      checkCheckpointProximity(position.coords);

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
      lastPosition: lastPositionForMovementRef.current,
      lastMoveTime: lastMoveTimeRef.current,
      totalOffTrailTime: totalOffTrailTimeRef.current,
      offTrailStartTime: offTrailStartTimeRef.current,
      lastOnTrailPoint: lastOnTrailPointRef.current,
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
      lastPositionForMovementRef.current = session.lastPosition;
      lastMoveTimeRef.current = session.lastMoveTime || Date.now();
      totalOffTrailTimeRef.current = session.totalOffTrailTime || 0;
      offTrailStartTimeRef.current = session.offTrailStartTime || null;
      lastOnTrailPointRef.current = session.lastOnTrailPoint || null;
      
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
<gpx version="1.1" creator="Alpenvia">
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

  // End hike
  const endHike = async (autoEnded = false) => {
    // Prevent duplicate saves
    if (isEnding) {
      console.log('Already ending hike, ignoring duplicate click');
      return;
    }
    
    setIsEnding(true);
    
    // Stop tracking
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    releaseWakeLock();

    // Save hike data (use refs for latest data)
    const hikeData = {
      trail_id: trail.id,
      trail_name: trail.name,
      start_time: new Date(startTimeRef.current).toISOString(),
      end_time: new Date().toISOString(),
      gps_track: gpsTrackRef.current,
      visited_checkpoints: visitedCheckpoints,
      stats: {
        distance_km: statsRef.current.distance / 1000,
        elevation_gain_m: statsRef.current.elevation,
        duration_hours: statsRef.current.duration / 3600,
        auto_ended: autoEnded
      }
    };

    try {
      await fetch('/api/hikes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hikeData)
      });
    } catch (error) {
      console.error('Failed to save hike:', error);
    }

    // Check for badges and award XP (use refs for latest data)
    const gamificationData = {
      distance: statsRef.current.distance,
      elevation: statsRef.current.elevation,
      duration: statsRef.current.duration,
      trailId: trail.id,
      startTime: startTimeRef.current,
      endTime: Date.now(),
      completed: !autoEnded
    };
    
    const gamificationResult = checkNewBadges(gamificationData);
    
    // Show celebration modal instead of immediately calling onEnd
    const completeData = { ...hikeData, gamification: gamificationResult };
    setCompletedHikeData(completeData);
    setShowCelebration(true);
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
      } else if (document.visibilityState === 'hidden' && isTracking) {
        console.log('[GPS] Page hidden - GPS may pause on some devices');
        sendNotification(
          'GPS Tracking Active',
          'Keep Alpenvia open to continue tracking your hike'
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
        >
          {/* Navigation controls - positioned top-left to avoid stats panel */}
          <NavigationControl position="top-left" showCompass={true} showZoom={true} />

          {/* Trail route - highlighted when tracking */}
          {trailRoute && (
            <Source id="route" type="geojson" data={trailRoute}>
              <Layer
                id="route-line"
                type="line"
                paint={{
                  'line-color': isTracking ? '#60a5fa' : '#3b82f6',
                  'line-width': isTracking ? 6 : 4,
                  'line-opacity': isTracking ? 1 : 0.8
                }}
              />
              {isTracking && (
                <Layer
                  id="route-line-glow"
                  type="line"
                  paint={{
                    'line-color': '#60a5fa',
                    'line-width': 12,
                    'line-opacity': 0.3,
                    'line-blur': 4
                  }}
                />
              )}
            </Source>
          )}

          {/* User's GPS track */}
          {gpsTrack.length > 1 && (
            <Source
              id="gps-track"
              type="geojson"
              data={{
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: gpsTrack.map(p => [p.lon, p.lat])
                }
              }}
            >
              <Layer
                id="gps-track-line"
                type="line"
                paint={{
                  'line-color': '#ef4444',
                  'line-width': 3,
                  'line-opacity': 0.9
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
          <span>{currentPosition ? Math.round(calculateTrailProgress(currentPosition.lat, currentPosition.lon, trailRoute?.geometry?.coordinates || trail.coordinates)) : 0}%</span>
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

      {/* Controls */}
      <div className="tracker-controls">
        <button 
          className="control-btn pause-btn"
          onClick={togglePause}
        >
          {isPaused ? '▶️ Resume' : '⏸️ Pause'}
        </button>

        <button 
          className="control-btn emergency-btn"
          onClick={generateShareLink}
        >
          🆘 Share Live Location
        </button>

        <button 
          className="control-btn end-btn"
          onClick={() => endHike(false)}
          disabled={isEnding}
        >
          {isEnding ? '⌛ Ending...' : '🏁 End Hike'}
        </button>
      </div>

      {/* Off-trail warning banner */}
      {isOffTrail && (
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

      {/* Celebration Modal */}
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
