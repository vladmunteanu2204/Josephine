import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl';
import SafetyDisclaimerModal from './SafetyDisclaimerModal';
import CelebrationModal from './CelebrationModal';
import { checkNewBadges } from '../utils/gamification';
import './ActiveHikeTracker.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const GPS_UPDATE_INTERVAL = 20000; // 20 seconds
const INACTIVITY_TIMEOUT = 6 * 60 * 60 * 1000; // 6 hours
const OFF_TRAIL_DISTANCE = 30; // meters
const POI_ALERT_DISTANCES = [500, 200]; // Alert at 500m and 200m

function ActiveHikeTracker({ trail, onEnd }) {
  const { t } = useTranslation();
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [gpsTrack, setGpsTrack] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [stats, setStats] = useState({
    distance: 0,
    elevation: 0,
    duration: 0,
    pace: 0
  });
  const [offTrailWarning, setOffTrailWarning] = useState(false);
  const [alertedPOIs, setAlertedPOIs] = useState(new Set());
  const [shareLink, setShareLink] = useState(null);
  const [completedHikeData, setCompletedHikeData] = useState(null);
  
  const watchIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastMoveTimeRef = useRef(null);
  const wakeLockRef = useRef(null);
  const intervalRef = useRef(null);

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

  // Calculate distance from point to line segment (for off-trail detection)
  const distanceToTrail = (point, trailCoordinates) => {
    if (!trailCoordinates || trailCoordinates.length < 2) return Infinity;
    
    let minDistance = Infinity;
    for (let i = 0; i < trailCoordinates.length - 1; i++) {
      const [lon1, lat1] = trailCoordinates[i];
      const [lon2, lat2] = trailCoordinates[i + 1];
      const dist = calculateDistance(point.lat, point.lon, (lat1 + lat2) / 2, (lon1 + lon2) / 2);
      minDistance = Math.min(minDistance, dist);
    }
    return minDistance;
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
    lastMoveTimeRef.current = Date.now();

    if (!isPaused) {
      // Update GPS track and calculate stats using the previous track value
      setGpsTrack(prev => {
        const updatedTrack = [...prev, newPoint];
        
        // Calculate stats if we have at least one previous point
        if (prev.length > 0) {
          const lastPoint = prev[prev.length - 1];
          const segmentDistance = calculateDistance(
            lastPoint.lat,
            lastPoint.lon,
            latitude,
            longitude
          );

          // Filter elevation noise: only count changes >= 5m to reduce GPS altitude error
          const elevationChange = altitude && lastPoint.alt ? (altitude - lastPoint.alt) : 0;
          const significantElevation = Math.abs(elevationChange) >= 5 ? Math.max(0, elevationChange) : 0;

          setStats(prevStats => ({
            distance: prevStats.distance + segmentDistance,
            elevation: prevStats.elevation + significantElevation,
            duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
            pace: speed || prevStats.pace
          }));
        }
        
        return updatedTrack;
      });

      // Check if off trail
      if (trail.coordinates || trailRoute?.geometry?.coordinates) {
        const distToTrail = distanceToTrail(newPoint, trail.coordinates || trailRoute.geometry.coordinates);
        if (distToTrail > OFF_TRAIL_DISTANCE) {
          if (!offTrailWarning) {
            sendNotification(
              'Off Trail Alert',
              'You are off the trail. Please return to the highlighted route.'
            );
            setOffTrailWarning(true);
          }
        } else {
          setOffTrailWarning(false);
        }
      }

      // Check POI proximity
      checkPOIProximity(position.coords);
    }
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
    if (gpsTrack.length === 0) return;

    const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Alpenvia">
  <metadata>
    <name>${trail.name}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${trail.name}</name>
    <trkseg>`;

    const gpxPoints = gpsTrack.map(point => 
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

    // Save hike data
    const hikeData = {
      trail_id: trail.id,
      trail_name: trail.name,
      start_time: new Date(startTimeRef.current).toISOString(),
      end_time: new Date().toISOString(),
      gps_track: gpsTrack,
      stats: {
        distance_km: stats.distance / 1000,
        elevation_gain_m: stats.elevation,
        duration_hours: stats.duration / 3600,
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

    // Check for badges and award XP
    const gamificationData = {
      distance: stats.distance,
      elevation: stats.elevation,
      duration: stats.duration,
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
    // Export GPX automatically
    if (gpsTrack.length > 0) {
      exportGPX();
    }
    
    setShowCelebration(false);
    onEnd(completedHikeData);
  };

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
              <div className={`user-marker ${offTrailWarning ? 'off-trail' : ''}`}>
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
          <span>{Math.min(100, Math.round((stats.distance / 1000 / trail.distance_km) * 100))}%</span>
        </div>
        <div className="stat-row">
          <span>⏱️</span>
          <span>{Math.floor(stats.duration / 3600)}:{String(Math.floor((stats.duration % 3600) / 60)).padStart(2, '0')}</span>
        </div>
        <div className="stat-row" style={{color: offTrailWarning ? '#ef4444' : '#4ade80'}}>
          <span>{offTrailWarning ? '⚠️' : '✓'}</span>
          <span>{offTrailWarning ? 'OFF' : 'ON'}</span>
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
      {offTrailWarning && (
        <div className="warning-banner">
          ⚠️ You are off the trail. Please return to the highlighted route.
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
    </div>
  );
}

export default ActiveHikeTracker;
