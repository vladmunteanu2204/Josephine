import React, { useState } from 'react';
import axios from 'axios';
import Map, { Source, Layer } from 'react-map-gl';
import './GPXUploader.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function GPXUploader({ adminPassword }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [gpxData, setGpxData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    difficulty: 'medium',
    region: ''
  });

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.gpx')) {
      setSelectedFile(file);
      parseGPX(file);
    } else {
      alert('Please select a valid GPX file');
    }
  };

  const parseGPX = async (file) => {
    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const gpxText = e.target.result;
        const headers = { 'X-Admin-Password': adminPassword };
        const response = await axios.post('/api/admin/gpx/parse', { gpxContent: gpxText }, { headers });
        setGpxData(response.data);
        setPreview(response.data.route);
        setLoading(false);
      } catch (error) {
        console.error('Error parsing GPX:', error);
        alert('Failed to parse GPX file: ' + (error.response?.data?.error || error.message));
        setLoading(false);
      }
    };
    
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!gpxData || !formData.name || !formData.region) {
      alert('Please fill in all required fields and upload a GPX file');
      return;
    }

    try {
      const trailData = {
        ...formData,
        ...gpxData,
        coordinates: gpxData.route.geometry.coordinates,
        distance_km: gpxData.distance,
        elevation_gain_m: gpxData.elevation_gain
      };

      const headers = { 'X-Admin-Password': adminPassword };
      await axios.post('/api/admin/trails', trailData, { headers });
      alert('Trail created successfully from GPX!');
      
      setSelectedFile(null);
      setGpxData(null);
      setPreview(null);
      setFormData({ name: '', difficulty: 'medium', region: '' });
    } catch (error) {
      console.error('Error creating trail:', error);
      alert('Failed to create trail: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="gpx-uploader">
      <div className="uploader-header">
        <h2>GPX Upload & Auto-Parse</h2>
        <p>Upload a GPX file to automatically create a trail with coordinates</p>
      </div>

      <div className="upload-section">
        <div className="file-input-wrapper">
          <input
            type="file"
            accept=".gpx"
            onChange={handleFileSelect}
            id="gpx-file"
            className="file-input"
          />
          <label htmlFor="gpx-file" className="file-label">
            📂 {selectedFile ? selectedFile.name : 'Choose GPX File'}
          </label>
        </div>

        {loading && <div className="loading-indicator">Parsing GPX file...</div>}

        {gpxData && (
          <div className="gpx-info">
            <h3>✅ GPX Parsed Successfully</h3>
            <div className="gpx-stats">
              <div className="stat-item">
                <span className="stat-label">Points:</span>
                <span className="stat-value">{gpxData.total_points}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Distance:</span>
                <span className="stat-value">{gpxData.distance.toFixed(2)} km</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Elevation Gain:</span>
                <span className="stat-value">{gpxData.elevation_gain.toFixed(0)} m</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Min Elevation:</span>
                <span className="stat-value">{gpxData.min_elevation.toFixed(0)} m</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Max Elevation:</span>
                <span className="stat-value">{gpxData.max_elevation.toFixed(0)} m</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {preview && (
        <div className="map-preview">
          <h3>Route Preview</h3>
          <div className="map-container">
            <Map
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{
                longitude: preview.geometry.coordinates[0][0],
                latitude: preview.geometry.coordinates[0][1],
                zoom: 12
              }}
              style={{ width: '100%', height: 400 }}
              mapStyle="mapbox://styles/mapbox/outdoors-v12"
            >
              <Source id="route" type="geojson" data={preview}>
                <Layer
                  id="route-line"
                  type="line"
                  paint={{
                    'line-color': '#ff6b35',
                    'line-width': 4
                  }}
                />
              </Source>
            </Map>
          </div>
        </div>
      )}

      {gpxData && (
        <div className="trail-metadata">
          <h3>Trail Metadata</h3>
          <div className="metadata-form">
            <div className="form-group">
              <label>Trail Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Tre Cime Loop"
              />
            </div>
            <div className="form-group">
              <label>Region *</label>
              <input
                type="text"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="e.g. Dolomites, South Tyrol"
              />
            </div>
            <div className="form-group">
              <label>Difficulty *</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <button className="btn-submit" onClick={handleSubmit}>
              Create Trail from GPX
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GPXUploader;
