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
  const [uploadProgress, setUploadProgress] = useState({});
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    region: '',
    difficulty: 'medium',
    distance_km: 0,
    duration_hours: 0,
    elevation_gain_m: 0,
    description: '',
    josephineNote: { en: '', it: '', de: '' },
    thumbnail: '',
    image_url: '',
    wallpaper: '',
    photos: '',
    videos: '',
    tags: [],
    interests: [],
    best_season: [],
    trail_type: 'loop',
    dog_friendly: false,
    coordinates: null,
    checkpoints: []
  });
  
  // Temporary string states for comma-separated inputs
  const [tagsInput, setTagsInput] = useState('');
  const [seasonsInput, setSeasonsInput] = useState('');
  const [showCheckpointForm, setShowCheckpointForm] = useState(false);
  const [editingCheckpointIndex, setEditingCheckpointIndex] = useState(null);
  const [checkpointFormData, setCheckpointFormData] = useState({
    name: '',
    type: 'poi',
    description: '',
    coordinates: [0, 0],
    alert_distance: 200,
    photo: ''
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
      best_season: trail.best_season || [],
      wallpaper: trail.wallpaper || '',
      photos: trail.photos || '',
      videos: trail.videos || '',
      checkpoints: trail.checkpoints || [],
      josephineNote: trail.josephineNote || { en: '', it: '', de: '' }
    });
    // Set the string inputs for editing
    setTagsInput((trail.tags || []).join(', '));
    setSeasonsInput((trail.best_season || []).join(', '));
    setShowCreateForm(false);
  };

  const handleCreate = () => {
    setShowCreateForm(true);
    setEditingTrail(null);
    setSelectedFile(null);
    setGpxData(null);
    setPreview(null);
    setTagsInput('');
    setSeasonsInput('');
    setFormData({
      id: '',
      name: '',
      region: '',
      difficulty: 'medium',
      distance_km: 0,
      duration_hours: 0,
      elevation_gain_m: 0,
      description: '',
      josephineNote: { en: '', it: '', de: '' },
      thumbnail: '',
      image_url: '',
      wallpaper: '',
      photos: '',
      videos: '',
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

  const uploadMediaFile = async (file, fieldType) => {
    const uploadKey = `${fieldType}-${Date.now()}`;
    setUploadProgress(prev => ({ ...prev, [uploadKey]: { uploading: true, progress: 0, filename: file.name } }));
    
    // File size validation on frontend
    const MAX_PHOTO_SIZE = 16 * 1024 * 1024; // 16MB
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
    
    if (fieldType === 'wallpaper' || fieldType === 'photos') {
      if (file.size > MAX_PHOTO_SIZE) {
        throw new Error(`Photo exceeds 16MB limit. File size: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      }
    } else if (fieldType === 'videos') {
      if (file.size > MAX_VIDEO_SIZE) {
        throw new Error(`Video exceeds 100MB limit. File size: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      }
    }
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('type', fieldType);
      
      const headers = { 
        'X-Admin-Password': adminPassword
      };
      
      const response = await axios.post('/api/admin/upload/media', formDataUpload, { 
        headers,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(prev => ({ 
            ...prev, 
            [uploadKey]: { uploading: true, progress: percentCompleted, filename: file.name, compressing: percentCompleted === 100 } 
          }));
        }
      });
      
      // Extract compression info from response
      const compressionInfo = response.data.compressionRatio ? ` (${response.data.compressionRatio} saved)` : '';
      
      setUploadProgress(prev => ({ 
        ...prev, 
        [uploadKey]: { 
          uploading: false, 
          success: true, 
          progress: 100, 
          filename: file.name,
          compressionInfo 
        } 
      }));
      
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[uploadKey];
          return newProgress;
        });
      }, 2000);
      
      return response.data.url;
    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress(prev => ({ ...prev, [uploadKey]: { uploading: false, error: true, filename: file.name } }));
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[uploadKey];
          return newProgress;
        });
      }, 3000);
      throw error;
    }
  };

  const handleFileUpload = async (e, fieldName) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    try {
      if (fieldName === 'photos' || fieldName === 'videos') {
        const uploadedUrls = await Promise.all(
          files.map(file => uploadMediaFile(file, fieldName))
        );
        
        // Handle both string (comma-separated) and array formats
        let currentUrls = [];
        if (formData[fieldName]) {
          if (Array.isArray(formData[fieldName])) {
            currentUrls = formData[fieldName].filter(u => u);
          } else if (typeof formData[fieldName] === 'string') {
            currentUrls = formData[fieldName].split(',').map(u => u.trim()).filter(u => u);
          }
        }
        
        const newUrls = [...currentUrls, ...uploadedUrls];
        
        setFormData(prev => ({
          ...prev,
          [fieldName]: newUrls.join(', ')
        }));
        
        alert(`✅ ${files.length} file(s) uploaded successfully!`);
      } else {
        const uploadedUrl = await uploadMediaFile(files[0], fieldName);
        setFormData(prev => ({
          ...prev,
          [fieldName]: uploadedUrl
        }));
        alert('✅ File uploaded successfully!');
      }
    } catch (error) {
      alert('❌ Upload failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSave = async () => {
    try {
      // Convert string inputs to arrays
      const tagsArray = tagsInput.split(',').map(item => item.trim()).filter(item => item);
      const seasonsArray = seasonsInput.split(',').map(item => item.trim()).filter(item => item);
      
      const note = formData.josephineNote || {};
      const hasNote = (note.en || '').trim() || (note.it || '').trim() || (note.de || '').trim();
      const trailData = {
        ...formData,
        tags: tagsArray,
        interests: tagsArray,
        best_season: seasonsArray,
        josephineNote: hasNote
          ? { en: (note.en || '').trim(), it: (note.it || '').trim(), de: (note.de || '').trim() }
          : undefined
      };
      
      const headers = { 'X-Admin-Password': adminPassword };
      if (editingTrail) {
        await axios.put(`/api/admin/trails/${editingTrail}`, trailData, { headers });
        alert('Trail updated successfully!');
      } else {
        await axios.post('/api/admin/trails', trailData, { headers });
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

            {/* Upload Progress Indicators */}
            {Object.keys(uploadProgress).length > 0 && (
              <div style={{ 
                marginBottom: '20px', 
                padding: '15px', 
                background: 'rgba(59, 130, 246, 0.1)', 
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.3)'
              }}>
                <h4 style={{ marginBottom: '10px', color: '#3b82f6' }}>📤 Uploading Files...</h4>
                {Object.entries(uploadProgress).map(([key, progress]) => (
                  <div key={key} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px' }}>
                      <span style={{ opacity: 0.9 }}>{progress.filename}</span>
                      <span style={{ fontWeight: 'bold' }}>
                        {progress.uploading ? (
                          progress.compressing ? '🗜️ Compressing...' : `${progress.progress}%`
                        ) : progress.success ? (
                          `✅ Done${progress.compressionInfo || ''}`
                        ) : '❌ Failed'}
                      </span>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '6px', 
                      background: 'rgba(255,255,255,0.1)', 
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${progress.progress}%`, 
                        height: '100%', 
                        background: progress.error ? '#ef4444' : progress.success ? '#10b981' : '#3b82f6',
                        transition: 'width 0.3s ease',
                        borderRadius: '3px'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            
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

              <div className="form-group full-width" style={{ borderTop: '1px solid rgba(212,165,116,0.2)', paddingTop: '16px', marginTop: '4px' }}>
                <label style={{ color: 'rgba(212,165,116,0.9)', fontWeight: 700 }}>🏔️ Josephine's Note (editorial callout — shown on trail detail page)</label>
                <textarea
                  value={(formData.josephineNote && formData.josephineNote.en) || ''}
                  onChange={(e) => setFormData({ ...formData, josephineNote: { ...(formData.josephineNote || {}), en: e.target.value } })}
                  rows="2"
                  placeholder="EN — e.g. Come in early morning before the tour buses arrive..."
                  style={{ marginBottom: '8px', borderColor: 'rgba(212,165,116,0.25)' }}
                />
                <textarea
                  value={(formData.josephineNote && formData.josephineNote.it) || ''}
                  onChange={(e) => setFormData({ ...formData, josephineNote: { ...(formData.josephineNote || {}), it: e.target.value } })}
                  rows="2"
                  placeholder="IT — e.g. Vieni di mattina presto..."
                  style={{ marginBottom: '8px', borderColor: 'rgba(212,165,116,0.25)' }}
                />
                <textarea
                  value={(formData.josephineNote && formData.josephineNote.de) || ''}
                  onChange={(e) => setFormData({ ...formData, josephineNote: { ...(formData.josephineNote || {}), de: e.target.value } })}
                  rows="2"
                  placeholder="DE — e.g. Komm früh morgens..."
                  style={{ borderColor: 'rgba(212,165,116,0.25)' }}
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
                <label>Wallpaper (Hero Image)</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <input
                    type="text"
                    value={formData.wallpaper}
                    onChange={(e) => setFormData({ ...formData, wallpaper: e.target.value })}
                    placeholder="Enter URL or upload file..."
                    style={{ flex: 1 }}
                  />
                  <div style={{ position: 'relative' }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'wallpaper')}
                      id="wallpaper-upload"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="wallpaper-upload" className="btn-upload" style={{
                      display: 'inline-block',
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: 'white',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      whiteSpace: 'nowrap'
                    }}>
                      📤 Upload
                    </label>
                  </div>
                </div>
                <small style={{ opacity: 0.7, fontSize: '12px' }}>Background/hero image for the trail</small>
              </div>

              <div className="form-group">
                <label>Photos (Gallery Images)</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <input
                    type="text"
                    value={formData.photos}
                    onChange={(e) => setFormData({ ...formData, photos: e.target.value })}
                    placeholder="Enter URLs or upload files..."
                    style={{ flex: 1 }}
                  />
                  <div style={{ position: 'relative' }}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileUpload(e, 'photos')}
                      id="photos-upload"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="photos-upload" className="btn-upload" style={{
                      display: 'inline-block',
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: 'white',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      whiteSpace: 'nowrap'
                    }}>
                      📸 Upload
                    </label>
                  </div>
                </div>
                <small style={{ opacity: 0.7, fontSize: '12px' }}>Photo gallery images (multiple files allowed)</small>
              </div>

              <div className="form-group">
                <label>Videos (Gallery Videos)</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <input
                    type="text"
                    value={formData.videos}
                    onChange={(e) => setFormData({ ...formData, videos: e.target.value })}
                    placeholder="Enter URLs or upload files..."
                    style={{ flex: 1 }}
                  />
                  <div style={{ position: 'relative' }}>
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={(e) => handleFileUpload(e, 'videos')}
                      id="videos-upload"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="videos-upload" className="btn-upload" style={{
                      display: 'inline-block',
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: 'white',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      whiteSpace: 'nowrap'
                    }}>
                      🎥 Upload
                    </label>
                  </div>
                </div>
                <small style={{ opacity: 0.7, fontSize: '12px' }}>Video gallery files (multiple files allowed)</small>
              </div>

              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="panoramic, alpine lakes, via ferrata"
                />
              </div>

              <div className="form-group">
                <label>Best Seasons (comma-separated)</label>
                <input
                  type="text"
                  value={seasonsInput}
                  onChange={(e) => setSeasonsInput(e.target.value)}
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

            <div className="form-divider"></div>

            {/* Checkpoints Section */}
            <div className="checkpoints-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#4ade80' }}>📍 Trail Checkpoints</h3>
                <button 
                  type="button"
                  className="btn-add-checkpoint"
                  onClick={() => {
                    setShowCheckpointForm(true);
                    setEditingCheckpointIndex(null);
                    setCheckpointFormData({
                      name: '',
                      type: 'poi',
                      description: '',
                      coordinates: formData.coordinates && formData.coordinates.length > 0 
                        ? [formData.coordinates[0][0], formData.coordinates[0][1]] 
                        : [0, 0],
                      alert_distance: 200,
                      photo: ''
                    });
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ➕ Add Checkpoint
                </button>
              </div>

              {formData.checkpoints && formData.checkpoints.length > 0 && (
                <div className="checkpoints-list" style={{ marginBottom: '15px' }}>
                  {formData.checkpoints.map((checkpoint, index) => (
                    <div key={index} style={{
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                            {checkpoint.type === 'summit' ? '⛰️' : checkpoint.type === 'refuge' ? '🏠' : '📍'} {checkpoint.name}
                          </div>
                          {checkpoint.description && (
                            <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '6px' }}>{checkpoint.description}</div>
                          )}
                          <div style={{ fontSize: '12px', opacity: 0.6 }}>
                            📏 Alert Distance: {checkpoint.alert_distance}m | 
                            🗺️ Coords: [{checkpoint.coordinates[0].toFixed(4)}, {checkpoint.coordinates[1].toFixed(4)}]
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCheckpointIndex(index);
                              setCheckpointFormData(checkpoint);
                              setShowCheckpointForm(true);
                            }}
                            style={{
                              padding: '6px 12px',
                              background: 'rgba(59, 130, 246, 0.2)',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              borderRadius: '4px',
                              color: '#60a5fa',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = formData.checkpoints.filter((_, i) => i !== index);
                              setFormData({ ...formData, checkpoints: updated });
                            }}
                            style={{
                              padding: '6px 12px',
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              borderRadius: '4px',
                              color: '#f87171',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showCheckpointForm && (
                <div style={{
                  padding: '16px',
                  background: 'rgba(74, 222, 128, 0.1)',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#4ade80' }}>
                    {editingCheckpointIndex !== null ? 'Edit Checkpoint' : 'New Checkpoint'}
                  </h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Checkpoint Name *</label>
                      <input
                        type="text"
                        value={checkpointFormData.name}
                        onChange={(e) => setCheckpointFormData({ ...checkpointFormData, name: e.target.value })}
                        placeholder="Rifugio Auronzo"
                      />
                    </div>
                    <div className="form-group">
                      <label>Type</label>
                      <select
                        value={checkpointFormData.type}
                        onChange={(e) => setCheckpointFormData({ ...checkpointFormData, type: e.target.value })}
                      >
                        <option value="poi">Point of Interest</option>
                        <option value="summit">Summit/Peak</option>
                        <option value="refuge">Refuge/Hut</option>
                        <option value="viewpoint">Viewpoint</option>
                        <option value="waterfall">Waterfall</option>
                        <option value="lake">Lake</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Latitude *</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={checkpointFormData.coordinates[1]}
                        onChange={(e) => setCheckpointFormData({ 
                          ...checkpointFormData, 
                          coordinates: [checkpointFormData.coordinates[0], parseFloat(e.target.value)] 
                        })}
                        placeholder="46.6186"
                      />
                    </div>
                    <div className="form-group">
                      <label>Longitude *</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={checkpointFormData.coordinates[0]}
                        onChange={(e) => setCheckpointFormData({ 
                          ...checkpointFormData, 
                          coordinates: [parseFloat(e.target.value), checkpointFormData.coordinates[1]] 
                        })}
                        placeholder="12.3027"
                      />
                    </div>
                    <div className="form-group">
                      <label>Alert Distance (meters)</label>
                      <input
                        type="number"
                        value={checkpointFormData.alert_distance}
                        onChange={(e) => setCheckpointFormData({ ...checkpointFormData, alert_distance: parseInt(e.target.value) })}
                        placeholder="200"
                      />
                    </div>
                    <div className="form-group">
                      <label>Photo URL (optional)</label>
                      <input
                        type="text"
                        value={checkpointFormData.photo}
                        onChange={(e) => setCheckpointFormData({ ...checkpointFormData, photo: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Description</label>
                      <textarea
                        value={checkpointFormData.description}
                        onChange={(e) => setCheckpointFormData({ ...checkpointFormData, description: e.target.value })}
                        placeholder="Brief description of this checkpoint..."
                        rows="2"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!checkpointFormData.name.trim()) {
                          alert('Please enter a checkpoint name');
                          return;
                        }
                        const updated = [...(formData.checkpoints || [])];
                        if (editingCheckpointIndex !== null) {
                          updated[editingCheckpointIndex] = checkpointFormData;
                        } else {
                          updated.push(checkpointFormData);
                        }
                        setFormData({ ...formData, checkpoints: updated });
                        setShowCheckpointForm(false);
                        setEditingCheckpointIndex(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      {editingCheckpointIndex !== null ? 'Update Checkpoint' : 'Add Checkpoint'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCheckpointForm(false);
                        setEditingCheckpointIndex(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
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
