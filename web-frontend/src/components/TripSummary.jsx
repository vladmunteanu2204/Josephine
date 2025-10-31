import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Map, { Source, Layer } from 'react-map-gl';
import './TripSummary.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function TripSummary({ hikeData, onClose, onAddReview }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const canvasRef = useRef(null);

  // Calculate center of route for map
  const getMapCenter = () => {
    if (!hikeData.gps_track || hikeData.gps_track.length === 0) {
      return { longitude: 11.35, latitude: 46.49, zoom: 10 };
    }
    const avgLon = hikeData.gps_track.reduce((sum, p) => sum + p.lon, 0) / hikeData.gps_track.length;
    const avgLat = hikeData.gps_track.reduce((sum, p) => sum + p.lat, 0) / hikeData.gps_track.length;
    return { longitude: avgLon, latitude: avgLat, zoom: 13 };
  };

  // Create gradient polyline based on altitude
  const createAltitudeGradient = () => {
    if (!hikeData.gps_track || hikeData.gps_track.length < 2) return null;

    // Filter out points without altitude and check if we have enough valid altitude data
    const validAltitudes = hikeData.gps_track.filter(p => p.alt != null && !isNaN(p.alt)).map(p => p.alt);
    const hasAltitudeData = validAltitudes.length > hikeData.gps_track.length * 0.5; // At least 50% have altitude
    
    const minAlt = hasAltitudeData ? Math.min(...validAltitudes) : 0;
    const maxAlt = hasAltitudeData ? Math.max(...validAltitudes) : 100;

    // Create GeoJSON with altitude-based colors
    const features = [];
    for (let i = 0; i < hikeData.gps_track.length - 1; i++) {
      const p1 = hikeData.gps_track[i];
      const p2 = hikeData.gps_track[i + 1];
      
      // Skip if coordinates are invalid
      if (!p1.lon || !p1.lat || !p2.lon || !p2.lat) continue;
      
      // Default color if no altitude data
      let color = '#60a5fa'; // Default blue
      
      if (hasAltitudeData && p1.alt != null && !isNaN(p1.alt)) {
        // Normalize altitude to 0-1 range
        const normAlt = (p1.alt - minAlt) / (maxAlt - minAlt || 1);
        
        // Color gradient: green (low) → yellow (mid) → red (high)
        if (normAlt < 0.5) {
          // Green to yellow
          const t = normAlt * 2;
          color = `rgb(${Math.round(76 + (255 - 76) * t)}, ${Math.round(175 + (193 - 175) * t)}, ${Math.round(80 + (7 - 80) * t)})`;
        } else {
          // Yellow to red
          const t = (normAlt - 0.5) * 2;
          color = `rgb(${255}, ${Math.round(193 - (193 - 68) * t)}, ${Math.round(7 - 7 * t)})`;
        }
      }

      features.push({
        type: 'Feature',
        properties: { color },
        geometry: {
          type: 'LineString',
          coordinates: [[p1.lon, p1.lat], [p2.lon, p2.lat]]
        }
      });
    }

    return features.length > 0 ? { type: 'FeatureCollection', features } : null;
  };

  // Export summary as image
  const exportSummaryImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      alert('Canvas not ready');
      return;
    }

    const ctx = canvas.getContext('2d');
    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0a0a0a');
    bgGradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(hikeData.trail_name, width / 2, 150);

    // Stats - handle both field name formats
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    const distance = (hikeData.stats.distance_km || hikeData.stats.distance / 1000 || 0).toFixed(1);
    const elevation = Math.round(hikeData.stats.elevation_gain_m || hikeData.stats.elevation || 0);
    const duration = (hikeData.stats.duration_hours || hikeData.stats.duration / 3600 || 0).toFixed(1);
    
    ctx.fillText(`${distance} km`, width / 2, 300);
    ctx.fillText(`↑ ${elevation}m`, width / 2, 400);
    ctx.fillText(`⏱ ${duration}h`, width / 2, 500);

    // Badges
    if (hikeData.gamification?.newBadges?.length > 0) {
      ctx.fillStyle = '#d4a574';
      ctx.font = '36px Arial';
      ctx.fillText('🏆 New Badges:', width / 2, 650);
      ctx.fillStyle = '#ffffff';
      ctx.font = '32px Arial';
      hikeData.gamification.newBadges.forEach((badge, i) => {
        ctx.fillText(`${badge.icon} ${badge.name}`, width / 2, 720 + i * 60);
      });
    }

    // Download
    const link = document.createElement('a');
    link.download = `alpenvia-${hikeData.trail_id}-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const mapCenter = getMapCenter();
  const altitudeGradient = createAltitudeGradient();

  return (
    <div className="trip-summary-overlay">
      <div className="trip-summary-container">
        <button className="close-summary-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="trip-summary-content">
          {/* Header */}
          <div className="summary-header">
            <h1>{hikeData.trail_name}</h1>
            <p className="summary-date">
              {new Date(hikeData.start_time).toLocaleDateString()} • {new Date(hikeData.start_time).toLocaleTimeString()}
            </p>
          </div>

          {/* Colored Route Map */}
          {hikeData.gps_track && hikeData.gps_track.length > 0 && (
            <div className="summary-map-container">
              <h3>{t('tripSummary.routeMap')}</h3>
              <div className="summary-map">
                <Map
                  mapboxAccessToken={MAPBOX_TOKEN}
                  initialViewState={mapCenter}
                  style={{ width: '100%', height: '100%' }}
                  mapStyle="mapbox://styles/mapbox/outdoors-v12"
                  interactive={true}
                >
                  {altitudeGradient && altitudeGradient.features.map((feature, i) => (
                    <Source key={i} id={`gradient-${i}`} type="geojson" data={feature}>
                      <Layer
                        id={`gradient-line-${i}`}
                        type="line"
                        paint={{
                          'line-color': feature.properties.color,
                          'line-width': 6,
                          'line-opacity': 0.9
                        }}
                      />
                    </Source>
                  ))}

                  {/* Start marker */}
                  {hikeData.gps_track[0] && (
                    <div style={{
                      position: 'absolute',
                      transform: 'translate(-50%, -50%)',
                      color: '#4ade80',
                      fontSize: '24px'
                    }}>
                      🚀
                    </div>
                  )}
                </Map>
                <div className="map-legend">
                  <div className="legend-item">
                    <div className="legend-color" style={{ background: '#4caf50' }}></div>
                    <span>{t('tripSummary.lowAltitude')}</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{ background: '#ffc107' }}></div>
                    <span>{t('tripSummary.midAltitude')}</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{ background: '#ff4444' }}></div>
                    <span>{t('tripSummary.highAltitude')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="summary-stats-grid">
            <div className="summary-stat-card">
              <div className="stat-icon">📏</div>
              <div className="stat-label">{t('tripSummary.distance')}</div>
              <div className="stat-value">{(hikeData.stats.distance_km || hikeData.stats.distance / 1000 || 0).toFixed(1)} km</div>
            </div>
            <div className="summary-stat-card">
              <div className="stat-icon">⛰️</div>
              <div className="stat-label">{t('tripSummary.elevationGain')}</div>
              <div className="stat-value">{Math.round(hikeData.stats.elevation_gain_m || hikeData.stats.elevation || 0)} m</div>
            </div>
            <div className="summary-stat-card">
              <div className="stat-icon">⏱️</div>
              <div className="stat-label">{t('tripSummary.duration')}</div>
              <div className="stat-value">{(hikeData.stats.duration_hours || hikeData.stats.duration / 3600 || 0).toFixed(1)} {t('tripSummary.hours')}</div>
            </div>
          </div>

          {/* Badges Earned */}
          {hikeData.gamification?.newBadges && hikeData.gamification.newBadges.length > 0 && (
            <div className="summary-badges-section">
              <h3>🏆 {t('tripSummary.badgesEarned')}</h3>
              <div className="summary-badges-grid">
                {hikeData.gamification.newBadges.map((badge, index) => (
                  <div key={index} className="summary-badge-card">
                    <div className="badge-icon">{badge.icon}</div>
                    <div className="badge-name">{badge.name}</div>
                    <div className="badge-desc">{badge.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checkpoints Visited */}
          {hikeData.visited_checkpoints && hikeData.visited_checkpoints.length > 0 && (
            <div className="summary-checkpoints-section">
              <h3>📍 {t('tripSummary.checkpointsVisited')}</h3>
              <div className="checkpoints-list">
                {hikeData.visited_checkpoints.map((checkpoint, index) => (
                  <div key={index} className="checkpoint-item">
                    <div className="checkpoint-icon">
                      {checkpoint.type === 'summit' ? '⛰️' : checkpoint.type === 'refuge' ? '🏠' : '📍'}
                    </div>
                    <div className="checkpoint-info">
                      <div className="checkpoint-name">{checkpoint.name}</div>
                      <div className="checkpoint-time">
                        {new Date(checkpoint.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className="summary-notes-section">
            <button
              className="toggle-notes-btn"
              onClick={() => setShowNotes(!showNotes)}
            >
              {showNotes ? '📝 ' + t('tripSummary.hideNotes') : '📝 ' + t('tripSummary.addNotes')}
            </button>
            {showNotes && (
              <div className="notes-container">
                <textarea
                  className="notes-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('tripSummary.notesPlaceholder')}
                  rows={6}
                />
                <button
                  className="save-notes-btn"
                  onClick={() => {
                    localStorage.setItem(`hike-notes-${hikeData.trail_id}-${Date.now()}`, notes);
                    alert(t('tripSummary.notesSaved'));
                  }}
                >
                  {t('tripSummary.saveNotes')}
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="summary-actions">
            <button className="action-btn review-btn" onClick={onAddReview}>
              ⭐ {t('tripSummary.addReview')}
            </button>
            <button className="action-btn share-btn" onClick={exportSummaryImage}>
              📤 {t('tripSummary.exportImage')}
            </button>
            <button className="action-btn close-btn" onClick={onClose}>
              {t('tripSummary.close')}
            </button>
          </div>
        </div>

        {/* Hidden canvas for image export */}
        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      </div>
    </div>
  );
}

export default TripSummary;
