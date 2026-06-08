import React, { useState, useRef, useCallback } from 'react';
import Map, { Marker, Source, Layer, NavigationControl, FullscreenControl } from 'react-map-gl';
import {
  Eye, Mountain, Home, Droplet, Trees, Waves, Church, MapPin, Flag,
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import './TrailMap.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Clean lucide icon per POI type (replaces the old emoji badges).
const POI_ICONS = {
  lake: Droplet,
  viewpoint: Eye,
  cabin: Home,
  cultural: Church,
  peak: Mountain,
  waterfall: Waves,
  forest: Trees,
  trailhead: Flag,
};

function TrailMap({ trail, drivingRoute }) {
  const mapRef = useRef();
  const [viewState, setViewState] = useState({
    longitude: trail.coordinates?.[0]?.[0] || 12.0,
    latitude: trail.coordinates?.[0]?.[1] || 46.5,
    zoom: 13
  });

  const getPoiIcon = (type) => POI_ICONS[type] || MapPin;

  const trailLineGeoJSON = trail.coordinates && trail.coordinates.length > 0 ? {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: trail.coordinates
    }
  } : null;

  const lineStyle = {
    id: 'trail-line',
    type: 'line',
    paint: {
      'line-color': '#d4a574',
      'line-width': 4,
      'line-opacity': 0.9
    }
  };

  const lineOutlineStyle = {
    id: 'trail-line-outline',
    type: 'line',
    paint: {
      'line-color': '#ffffff',
      'line-width': 6,
      'line-opacity': 0.4
    }
  };

  // Driving route to the trailhead (Perk #1) — dashed gold so it reads as
  // "approach by car" and stays distinct from the solid hiking line.
  const drivingRouteGeoJSON = drivingRoute && drivingRoute.coordinates?.length
    ? { type: 'Feature', geometry: drivingRoute }
    : null;

  const drivingLineStyle = {
    id: 'driving-line',
    type: 'line',
    paint: {
      'line-color': '#c9a84c',
      'line-width': 3,
      'line-opacity': 0.85,
      'line-dasharray': [2, 1.5]
    }
  };

  const handleFitBounds = useCallback(() => {
    if (!mapRef.current || !trail.coordinates || !trail.coordinates.length) return;

    const lngs = trail.coordinates.map(coord => coord[0]);
    const lats = trail.coordinates.map(coord => coord[1]);

    const bounds = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    ];

    mapRef.current.fitBounds(bounds, {
      padding: 60,
      duration: 1000
    });
  }, [trail.coordinates]);

  React.useEffect(() => {
    if (mapRef.current && trail.coordinates && trail.coordinates.length > 0) {
      setTimeout(() => handleFitBounds(), 500);
    }
  }, [handleFitBounds, trail.coordinates]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-error">
        <p>⚠️ Mapbox token not configured. Please add VITE_MAPBOX_TOKEN to environment variables.</p>
      </div>
    );
  }

  if (!trail.coordinates || trail.coordinates.length === 0) {
    return (
      <div className="map-error">
        <p>📍 No trail coordinates available for this route.</p>
      </div>
    );
  }

  return (
    <div className="trail-map-container">
      <div className="map-controls">
        <button className="map-btn-fit" onClick={handleFitBounds} title="Fit trail to view">
          🎯 Fit Trail
        </button>
      </div>

      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" />
        <FullscreenControl position="top-right" />

        {trailLineGeoJSON && (
          <Source id="trail-route" type="geojson" data={trailLineGeoJSON}>
            <Layer {...lineOutlineStyle} />
            <Layer {...lineStyle} />
          </Source>
        )}

        {drivingRouteGeoJSON && (
          <Source id="driving-route" type="geojson" data={drivingRouteGeoJSON}>
            <Layer {...drivingLineStyle} />
          </Source>
        )}

        {trail.pois && trail.pois.map((poi, index) => {
          if (!poi.coordinates || poi.coordinates.length < 2) return null;
          const Icon = getPoiIcon(poi.type);
          return (
            <Marker
              key={index}
              longitude={poi.coordinates[0]}
              latitude={poi.coordinates[1]}
              anchor="bottom"
            >
              <div className="poi-pin" title={poi.name}>
                <span className="poi-pin__label">{poi.name}</span>
                <div className="poi-pin__badge">
                  <Icon size={15} strokeWidth={2.25} aria-hidden="true" />
                </div>
                <div className="poi-pin__tip" />
              </div>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}

export default TrailMap;
