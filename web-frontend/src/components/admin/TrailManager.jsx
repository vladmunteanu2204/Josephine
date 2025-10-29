import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Map, { Source, Layer } from 'react-map-gl';
import './TrailManager.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function TrailManager({ adminPassword }) {
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTrail, setEditingTrail] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [gpxData, setGpxData] = useState(null);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    region: '',
    difficulty: 'medium',
    distance_km: 0,
    duration_hours: 0,
    elevation_gain_m: 0,
    description: '',
    thumbnail: '',
    image_url: '',
    tags: [],
    interests: [],
    best_season: [],
    trail_type: 'loop',
    dog_friendly: false,
    coordinates: null
  });

  useEffect(() => {
    loadTrails();
  }, []);

  const loadTrails = async () => {
    try {
      const response = await axios.get('/api/trails');
      setTrails(response.data.trails || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading trails:', error);
      setLoading(false);
    }
  };

  const handleEdit = (trail) => {
    setEditingTrail(trail.id);
    setFormData({
      ...trail,
      tags: trail.tags || trail.interests || [],
      interests: trail.interests || trail.tags || [],
      best_season: trail.best_season || []
    });
    setShowCreateForm(false);
  };

  const handleCreate = () => {
    setShowCreateForm(true);
    setEditingTrail(null);
    setSelectedFile(null);
    setGpxData(null);
    setPreview(null);
    setFormData({
      id: '',
      name: '',
      region: '',
      difficulty: 'medium',
      distance_km: 0,
      duration_hours: 0,
      elevation_gain_m: 0,
      description: '',
      thumbnail: '',
      image_url: '',
      tags: [],
      interests: [],
      best_season: [],
      trail_type: 'loop',
      dog_friendly: false,
      coordinates: null
    });
  };

  const handleGPXFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.gpx')) {
      setSelectedFile(file);
      parseGPX(file);
    } else {
      alert('Please select a valid GPX file');
    }
  };

  const parseGPX = async (file) => {
    setGpxLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const gpxText = e.target.result;
        const headers = { 'X-Admin-Password': adminPassword };
        const response = await axios.post('/api/admin/gpx/parse', { gpxContent: gpxText }, { headers });
        const data = response.data;
        
        setGpxData(data);
        setPreview(data.route);
        
        // Auto-populate form data from GPX
        setFormData(prev => ({
          ...prev,
          distance_km: data.distance,
          elevation_gain_m: data.elevation_gain,
          coordinates: data.route.geometry.coordinates
        }));
        
        setGpxLoading(false);
      } catch (error) {
        console.error('Error parsing GPX:', error);
        alert('Failed to parse GPX file: ' + (error.response?.data?.error || error.message));
        setGpxLoading(false);
      }
    };
    
    reader.readAsText(file);
  };

  const clearGPX = () => {
    setSelectedFile(null);
    setGpxData(null);
    setPreview(null);
    setFormData(prev => ({
      ...prev,
      coordinates: null
    }));
  };

  const handleSave = async () => {
    try {
      const headers = { 'X-Admin-Password': adminPassword };
      if (editingTrail) {
        await axios.put(`/api/admin/trails/${editingTrail}`, formData, { headers });
        alert('Trail updated successfully!');
      } else {
        await axios.post('/api/admin/trails', formData, { headers });
        alert('Trail created successfully!');
      }
      setEditingTrail(null);
      setShowCreateForm(false);
      loadTrails();
    } catch (error) {
      console.error('Error saving trail:', error);
      alert('Failed to save trail: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (trailId) => {
    if (!confirm('Are you sure you want to delete this trail?')) return;
    
    try {
      const headers = { 'X-Admin-Password': adminPassword };
      await axios.delete(`/api/admin/trails/${trailId}`, { headers });
      alert('Trail deleted successfully!');
      loadTrails();
    } catch (error) {
      console.error('Error deleting trail:', error);
      alert('Failed to delete trail: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCancel = () => {
    setEditingTrail(null);
    setShowCreateForm(false);
  };

  const handleArrayInput = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setFormData({ ...formData, [field]: array });
  };

  if (loading) {
    return <div className="admin-loading">Loading trails...</div>;
  }

  return (
    <div className="trail-manager">
      <div className="manager-header">
        <h2>Trail Management</h2>
        <button className="btn-create" onClick={handleCreate}>
          ➕ Create New Trail
        </button>
      </div>

      {(editingTrail || showCreateForm) && (
        <div className="trail-form-overlay">
          <div className="trail-form">
            <h3>{editingTrail ? 'Edit Trail' : 'Create New Trail'}</h3>
            
            {/* GPX Upload Section */}
            <div className="gpx-upload-section">
              <div className="gpx-upload-header">
                <h4>📍 GPX File Upload (Optional)</h4>
                <p style={{ fontSize: '13px', opacity: 0.8, margin: '5px 0' }}>
                  Upload a GPX file to auto-populate distance, elevation, and route coordinates
                </p>
              </div>
              
              <div className="file-input-wrapper">
                <input
                  type="file"
                  accept=".gpx"
                  onChange={handleGPXFileSelect}
                  id="gpx-file-input"
                  className="file-input"
                />
                <label htmlFor="gpx-file-input" className="file-label">
                  📂 {selectedFile ? selectedFile.name : 'Choose GPX File'}
                </label>
                {selectedFile && (
                  <button className="btn-clear-gpx" onClick={clearGPX}>
                    ✖ Clear
                  </button>
                )}
              </div>

              {gpxLoading && <div className="loading-indicator">Parsing GPX file...</div>}

              {gpxData && (
                <div className="gpx-info">
                  <h4 style={{ color: '#4ade80', marginBottom: '10px' }}>✅ GPX Parsed Successfully</h4>
                  <div className="gpx-stats-grid">
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

                  {preview && MAPBOX_TOKEN && (
                    <div className="gpx-map-preview">
                      <h4 style={{ marginBottom: '10px' }}>Route Preview</h4>
                      <Map
                        mapboxAccessToken={MAPBOX_TOKEN}
                        initialViewState={{
                          longitude: preview.geometry.coordinates[0][0],
                          latitude: preview.geometry.coordinates[0][1],
                          zoom: 12
                        }}
                        style={{ width: '100%', height: '300px', borderRadius: '8px' }}
                        mapStyle="mapbox://styles/mapbox/outdoors-v12"
                      >
                        <Source id="gpx-route" type="geojson" data={preview}>
                          <Layer
                            id="route-line"
                            type="line"
                            paint={{
                              'line-color': '#3b82f6',
                              'line-width': 3
                            }}
                          />
                        </Source>
                      </Map>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-divider"></div>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Trail ID *</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  disabled={!!editingTrail}
                  placeholder="tre_cime"
                />
              </div>

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Tre Cime di Lavaredo Loop"
                />
              </div>

              <div className="form-group">
                <label>Region *</label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="Dolomites, South Tyrol"
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

              <div className="form-group">
                <label>Distance (km) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.distance_km}
                  onChange={(e) => setFormData({ ...formData, distance_km: parseFloat(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Duration (hours) *</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.duration_hours}
                  onChange={(e) => setFormData({ ...formData, duration_hours: parseFloat(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Elevation Gain (m) *</label>
                <input
                  type="number"
                  value={formData.elevation_gain_m}
                  onChange={(e) => setFormData({ ...formData, elevation_gain_m: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Trail Type</label>
                <select
                  value={formData.trail_type}
                  onChange={(e) => setFormData({ ...formData, trail_type: e.target.value })}
                >
                  <option value="loop">Loop</option>
                  <option value="out_and_back">Out and Back</option>
                  <option value="point_to_point">Point to Point</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="4"
                  placeholder="Detailed trail description..."
                />
              </div>

              <div className="form-group">
                <label>Thumbnail URL</label>
                <input
                  type="text"
                  value={formData.thumbnail}
                  onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="text"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formData.tags.join(', ')}
                  onChange={(e) => handleArrayInput('tags', e.target.value)}
                  placeholder="panoramic, alpine lakes, via ferrata"
                />
              </div>

              <div className="form-group">
                <label>Best Seasons (comma-separated)</label>
                <input
                  type="text"
                  value={formData.best_season.join(', ')}
                  onChange={(e) => handleArrayInput('best_season', e.target.value)}
                  placeholder="June, July, August, September"
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.dog_friendly}
                    onChange={(e) => setFormData({ ...formData, dog_friendly: e.target.checked })}
                  />
                  Dog Friendly
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
              <button className="btn-save" onClick={handleSave}>
                {editingTrail ? 'Update Trail' : 'Create Trail'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="trails-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Region</th>
              <th>Difficulty</th>
              <th>Distance</th>
              <th>Duration</th>
              <th>Elevation</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {trails.map(trail => (
              <tr key={trail.id}>
                <td className="trail-name">{trail.name}</td>
                <td>{trail.region}</td>
                <td>
                  <span className={`difficulty-badge diff-${trail.difficulty}`}>
                    {trail.difficulty}
                  </span>
                </td>
                <td>{trail.distance_km} km</td>
                <td>{trail.duration_hours}h</td>
                <td>{trail.elevation_gain_m}m</td>
                <td className="actions-cell">
                  <button 
                    className="btn-edit"
                    onClick={() => handleEdit(trail)}
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className="btn-delete"
                    onClick={() => handleDelete(trail.id)}
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TrailManager;
