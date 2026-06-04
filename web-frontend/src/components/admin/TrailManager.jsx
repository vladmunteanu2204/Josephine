import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Map, { Source, Layer } from 'react-map-gl';
import { Plus, Pencil, Trash2, Check, MapPin, Mountain, Map as MapIcon, Home, Ruler, Undo2 } from 'lucide-react';
import './TrailManager.css';
import InsightsEditor from './InsightsEditor';

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
    family_friendly: false,
    coordinates: null,
    checkpoints: [],
    // ── Card-powering fields (drive the Daily Plan Card) ──
    crowding: { level: 'medium', peak_months: [], quiet_tip: { en: '', it: '', de: '' } },
    nearby_rifugios: [],
    transport: { car: '', bus: '' },
    trailhead_info: { parking: '' },
    difficulty_details: { technical: '', exposure: '', fitness: '' },
    highlights: [],
    insights: [],
    verification: { status: 'unverified', source_type: 'manual', source_url: '', last_verified_at: '' },
  });
  const [allRifugios, setAllRifugios] = useState([]);
  const [rifSearch, setRifSearch] = useState('');
  const [peakInput, setPeakInput] = useState('');
  const [highlightsInput, setHighlightsInput] = useState('');
  
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
    // Rifugio list powers the "nearby huts" picker.
    axios.get('/api/rifugios')
      .then(r => setAllRifugios(r.data?.rifugios || []))
      .catch(() => {});
  }, []);

  // Distance (km) between trail centroid and a rifugio, for the picker warning.
  const _hutDistanceKm = (rif) => {
    const co = formData.coordinates;
    const rc = rif.coordinates || {};
    if (!Array.isArray(co) || !co.length || rc.lat == null) return null;
    let la = 0, lo = 0;
    co.forEach(p => { lo += p[0]; la += p[1]; });
    la /= co.length; lo /= co.length;
    const R = 6371, dLat = (rc.lat - la) * Math.PI / 180, dLon = ((rc.lng ?? rc.lon) - lo) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(la * Math.PI / 180) * Math.cos(rc.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'published' | 'draft'

  const loadTrails = async () => {
    try {
      const response = await axios.get('/api/trails?_admin=1');
      setTrails(response.data.trails || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading trails:', error);
      setLoading(false);
    }
  };

  const handlePublish = async (trailId, newStatus) => {
    try {
      await axios.post(`/api/admin/trails/${trailId}/publish`,
        { status: newStatus },
        { headers: {  } }
      );
      loadTrails();
    } catch (error) {
      alert('Failed to update status: ' + (error.response?.data?.error || error.message));
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
      josephineNote: trail.josephineNote || { en: '', it: '', de: '' },
      family_friendly: trail.family_friendly ?? false,
      crowding: {
        level: (trail.crowding || {}).level || 'medium',
        peak_months: (trail.crowding || {}).peak_months || [],
        quiet_tip: typeof (trail.crowding || {}).quiet_tip === 'object'
          ? { en: '', it: '', de: '', ...((trail.crowding || {}).quiet_tip) }
          : { en: (trail.crowding || {}).quiet_tip || '', it: '', de: '' },
      },
      nearby_rifugios: (trail.nearby_rifugios || []).map(r =>
        typeof r === 'string' ? { id: r, name: r } : { id: r.id, name: r.name || r.id }),
      transport: { car: '', bus: '', ...(trail.transport || {}) },
      trailhead_info: { parking: '', ...(trail.trailhead_info || {}) },
      difficulty_details: { technical: '', exposure: '', fitness: '', ...(trail.difficulty_details || {}) },
      highlights: trail.highlights || [],
      insights: trail.insights || [],
      verification: { status: 'unverified', source_type: 'manual', source_url: '', last_verified_at: '', ...(trail.verification || {}) },
    });
    // Set the string inputs for editing
    setTagsInput((trail.tags || []).join(', '));
    setSeasonsInput((trail.best_season || []).join(', '));
    setPeakInput(((trail.crowding || {}).peak_months || []).join(', '));
    setHighlightsInput((trail.highlights || []).join(', '));
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
    setPeakInput('');
    setHighlightsInput('');
    setRifSearch('');
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
      family_friendly: false,
      coordinates: null,
      checkpoints: [],
      crowding: { level: 'medium', peak_months: [], quiet_tip: { en: '', it: '', de: '' } },
      nearby_rifugios: [],
      transport: { car: '', bus: '' },
      trailhead_info: { parking: '' },
      difficulty_details: { technical: '', exposure: '', fitness: '' },
      highlights: [],
      insights: [],
      verification: { status: 'unverified', source_type: 'manual', source_url: '', last_verified_at: '' },
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
        const headers = {  };
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
      const peakArray = peakInput.split(',').map(s => s.trim()).filter(Boolean);
      const highlightsArray = highlightsInput.split(',').map(s => s.trim()).filter(Boolean);
      const verif = { ...formData.verification };
      if (verif.status === 'verified' && !verif.last_verified_at) {
        verif.last_verified_at = new Date().toISOString().slice(0, 10);
      }
      const trailData = {
        ...formData,
        tags: tagsArray,
        interests: tagsArray,
        best_season: seasonsArray,
        crowding: { ...formData.crowding, peak_months: peakArray },
        highlights: highlightsArray,
        verification: verif,
        josephineNote: hasNote
          ? { en: (note.en || '').trim(), it: (note.it || '').trim(), de: (note.de || '').trim() }
          : undefined
      };
      
      const headers = {  };
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
      const headers = {  };
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
          <Plus size={16} strokeWidth={2} /> Create New Trail
        </button>
      </div>

      {(editingTrail || showCreateForm) && (
        <div className="trail-form-overlay">
          <div className="trail-form">
            <h3>{editingTrail ? 'Edit Trail' : 'Create New Trail'}</h3>
            
            {/* GPX Upload Section */}
            <div className="gpx-upload-section">
              <div className="gpx-upload-header">
                <h4 className="tm-h-icon"><MapPin size={16} strokeWidth={2} /> GPX File Upload (Optional)</h4>
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
                <label style={{ color: 'rgba(212,165,116,0.9)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mountain size={16} strokeWidth={2} /> Josephine's Note (editorial callout — shown on trail detail page)</label>
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

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.family_friendly ?? false}
                    onChange={(e) => setFormData({ ...formData, family_friendly: e.target.checked })}
                  />
                  Family Friendly
                </label>
              </div>
            </div>

            <div className="form-divider"></div>

            {/* ── What powers the Daily Plan Card ── */}
            <h3 style={{ color: '#d4a05a', margin: '0 0 4px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>✦ What Josephine puts on the card</h3>
            <p style={{ fontSize: 12, opacity: 0.6, margin: '0 0 14px', maxWidth: 640 }}>
              These power the live plan card — crowd signals, the lunch stop, “getting there”, and the local tip.
              Leave any blank and that line simply won't appear.
            </p>
            {(() => {
              const hint = { fontSize: 11, opacity: 0.55, fontWeight: 400 };
              const c = formData.crowding || {};
              const setC = (patch) => setFormData({ ...formData, crowding: { ...formData.crowding, ...patch } });
              const setQT = (lng, v) => setC({ quiet_tip: { ...(c.quiet_tip || {}), [lng]: v } });
              const setT = (patch) => setFormData({ ...formData, transport: { ...formData.transport, ...patch } });
              const setDD = (patch) => setFormData({ ...formData, difficulty_details: { ...formData.difficulty_details, ...patch } });
              const setV = (patch) => setFormData({ ...formData, verification: { ...formData.verification, ...patch } });
              return (
                <>
                  {/* Crowding */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Crowd level <span style={hint}>→ “quiet today / busy now” signal + dispersal</span></label>
                      <select value={c.level || 'medium'} onChange={(e) => setC({ level: e.target.value })}>
                        <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Peak months <span style={hint}>→ when it's busiest (comma-separated)</span></label>
                      <input type="text" value={peakInput} onChange={(e) => setPeakInput(e.target.value)} placeholder="July, August" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Quiet tip <span style={hint}>→ the 💡 local tip on the card</span></label>
                    <input type="text" placeholder="EN — e.g. Arrive before 8am or after 5pm to have it to yourself." value={(c.quiet_tip || {}).en || ''} onChange={(e) => setQT('en', e.target.value)} />
                    <input type="text" placeholder="IT" style={{ marginTop: 6 }} value={(c.quiet_tip || {}).it || ''} onChange={(e) => setQT('it', e.target.value)} />
                    <input type="text" placeholder="DE" style={{ marginTop: 6 }} value={(c.quiet_tip || {}).de || ''} onChange={(e) => setQT('de', e.target.value)} />
                  </div>

                  {/* Nearby huts picker */}
                  <div className="form-group">
                    <label>Nearby huts / malghe <span style={hint}>→ the lunch / hut stop (only huts within ~6 km appear on the card)</span></label>
                    {(formData.nearby_rifugios || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {formData.nearby_rifugios.map((r) => (
                          <span key={r.id} style={{ background: 'rgba(212,160,90,0.15)', color: '#e8c79a', borderRadius: 999, padding: '3px 8px', fontSize: 12 }}>
                            {r.name}{' '}
                            <button type="button" onClick={() => setFormData({ ...formData, nearby_rifugios: formData.nearby_rifugios.filter((x) => x.id !== r.id) })}
                              style={{ background: 'none', border: 'none', color: '#e8c79a', cursor: 'pointer', fontWeight: 700 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input type="text" placeholder="Search huts to add…" value={rifSearch} onChange={(e) => setRifSearch(e.target.value)} />
                    {rifSearch && (
                      <div style={{ marginTop: 6, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden' }}>
                        {allRifugios
                          .filter((r) => (r.name || '').toLowerCase().includes(rifSearch.toLowerCase()) && !(formData.nearby_rifugios || []).some((x) => x.id === r.id))
                          .slice(0, 6).map((r) => {
                            const d = _hutDistanceKm(r);
                            return (
                              <button key={r.id} type="button"
                                onClick={() => { setFormData({ ...formData, nearby_rifugios: [...(formData.nearby_rifugios || []), { id: r.id, name: r.name }] }); setRifSearch(''); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#f0ece6', cursor: 'pointer', fontSize: 13 }}>
                                {r.name}
                                {d != null && <span style={{ opacity: 0.6 }}> · {d.toFixed(1)} km</span>}
                                {d != null && d > 6 && <span style={{ color: '#f3a3a3' }}> ⚠ too far — won't show</span>}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Getting there */}
                  <div className="form-group">
                    <label>Parking / trailhead <span style={hint}>→ “Getting there” row + tip fallback</span></label>
                    <input type="text" value={(formData.trailhead_info || {}).parking || ''} onChange={(e) => setFormData({ ...formData, trailhead_info: { ...formData.trailhead_info, parking: e.target.value } })}
                      placeholder="Free car park beside the church, 60 spaces — fills by 9am" />
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>By car</label>
                      <input type="text" value={(formData.transport || {}).car || ''} onChange={(e) => setT({ car: e.target.value })} placeholder="From Bolzano, 45 min via the SS242" /></div>
                    <div className="form-group"><label>By bus / lift</label>
                      <input type="text" value={(formData.transport || {}).bus || ''} onChange={(e) => setT({ bus: e.target.value })} placeholder="SAD line 170; cable car from Ortisei" /></div>
                  </div>

                  {/* Difficulty details */}
                  <div className="form-row">
                    <div className="form-group"><label>Technical <span style={hint}>→ “how hard” answer</span></label>
                      <input type="text" value={(formData.difficulty_details || {}).technical || ''} onChange={(e) => setDD({ technical: e.target.value })} placeholder="low / some scrambling" /></div>
                    <div className="form-group"><label>Exposure</label>
                      <input type="text" value={(formData.difficulty_details || {}).exposure || ''} onChange={(e) => setDD({ exposure: e.target.value })} placeholder="none / moderate" /></div>
                    <div className="form-group"><label>Fitness</label>
                      <input type="text" value={(formData.difficulty_details || {}).fitness || ''} onChange={(e) => setDD({ fitness: e.target.value })} placeholder="low / high" /></div>
                  </div>

                  {/* Highlights */}
                  <div className="form-group">
                    <label>Highlights <span style={hint}>→ fallback local tip (comma-separated)</span></label>
                    <input type="text" value={highlightsInput} onChange={(e) => setHighlightsInput(e.target.value)} placeholder="Turquoise lake, panoramic ridge, larch forest" />
                  </div>

                  {/* Verification (never-fabricate) */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Verification <span style={hint}>→ trust status (never-fabricate)</span></label>
                      <select value={(formData.verification || {}).status || 'unverified'} onChange={(e) => setV({ status: e.target.value })}>
                        <option value="unverified">unverified</option>
                        <option value="editorial">editorial</option>
                        <option value="verified">verified</option>
                        <option value="stale">stale</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Source <span style={hint}>→ where it's confirmed</span></label>
                      <input type="text" value={(formData.verification || {}).source_url || ''} onChange={(e) => setV({ source_url: e.target.value })} placeholder="URL, or who confirmed it" />
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Insider insights — public + chat-only secrets */}
            <InsightsEditor
              value={formData.insights}
              onChange={(next) => setFormData({ ...formData, insights: next })}
              facts={[
                formData.name && `Trail: ${formData.name}`,
                formData.region && `Region: ${formData.region}`,
                formData.difficulty && `Difficulty: ${formData.difficulty}`,
                formData.distance_km && `Distance: ${formData.distance_km} km`,
                formData.elevation_gain_m && `Ascent: ${formData.elevation_gain_m} m`,
                (formData.best_season || []).length && `Best season: ${(formData.best_season || []).join(', ')}`,
              ].filter(Boolean).join('. ')}
            />

            <div className="form-divider"></div>

            {/* Checkpoints Section */}
            <div className="checkpoints-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={16} strokeWidth={2} /> Trail Checkpoints</h3>
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
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={15} strokeWidth={2} /> Add Checkpoint
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
                          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {checkpoint.type === 'summit' ? <Mountain size={15} strokeWidth={2} /> : checkpoint.type === 'refuge' ? <Home size={15} strokeWidth={2} /> : <MapPin size={15} strokeWidth={2} />} {checkpoint.name}
                          </div>
                          {checkpoint.description && (
                            <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '6px' }}>{checkpoint.description}</div>
                          )}
                          <div style={{ fontSize: '12px', opacity: 0.6, display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Ruler size={12} strokeWidth={2} /> Alert Distance: {checkpoint.alert_distance}m |
                            <MapIcon size={12} strokeWidth={2} /> Coords: [{checkpoint.coordinates[0].toFixed(4)}, {checkpoint.coordinates[1].toFixed(4)}]
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
                            <Pencil size={14} strokeWidth={2} /> Edit
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
                            <Trash2 size={14} strokeWidth={2} /> Delete
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

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: `All (${trails.length})` },
          { key: 'published', label: `✓ Published (${trails.filter(t => (t.status || 'published') === 'published').length})` },
          { key: 'draft', label: `📝 Drafts (${trails.filter(t => t.status === 'draft').length})` },
        ].map(p => (
          <button key={p.key} onClick={() => setStatusFilter(p.key)} style={{
            padding: '6px 14px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer',
            background: statusFilter === p.key ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
            border: statusFilter === p.key ? '1px solid rgba(201,168,76,0.5)' : '1px solid rgba(255,255,255,0.1)',
            color: statusFilter === p.key ? '#c9a84c' : 'rgba(240,236,230,0.6)',
          }}>{p.label}</button>
        ))}
      </div>

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
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {trails
              .filter(t => statusFilter === 'all' || (statusFilter === 'draft' ? t.status === 'draft' : (t.status || 'published') === 'published'))
              .map(trail => {
              const isDraft = trail.status === 'draft';
              return (
                <tr key={trail.id} style={isDraft ? { opacity: 0.75 } : {}}>
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
                  <td>
                    <span style={{
                      padding: '2px 9px', borderRadius: '100px', fontSize: '11px', fontWeight: 600,
                      background: isDraft ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)',
                      color: isDraft ? '#fbbf24' : '#4ade80',
                      border: `1px solid ${isDraft ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'}`,
                    }}>{isDraft ? 'Draft' : 'Published'}</span>
                  </td>
                  <td className="actions-cell">
                    {isDraft ? (
                      <button
                        style={{ padding: '5px 10px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '6px', color: '#4ade80', fontSize: '12px', cursor: 'pointer', marginRight: '4px' }}
                        onClick={() => handlePublish(trail.id, 'published')}
                      ><Check size={13} strokeWidth={2.5} /> Publish</button>
                    ) : (
                      <button
                        style={{ padding: '5px 10px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '6px', color: '#fbbf24', fontSize: '12px', cursor: 'pointer', marginRight: '4px' }}
                        onClick={() => handlePublish(trail.id, 'draft')}
                      ><Undo2 size={13} strokeWidth={2} /> Unpublish</button>
                    )}
                    <button
                      className="btn-edit"
                      onClick={() => handleEdit(trail)}
                    >
                      <Pencil size={14} strokeWidth={2} /> Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(trail.id)}
                    >
                      <Trash2 size={14} strokeWidth={2} /> Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TrailManager;
