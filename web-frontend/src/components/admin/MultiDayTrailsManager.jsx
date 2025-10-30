import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './MultiDayTrailsManager.css';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.origin.includes('replit') 
  ? `https://${window.location.host.split('--')[0].replace(/^webview-/, '')}--8000.${window.location.host.split('.').slice(1).join('.')}` 
  : 'http://localhost:8000');

function MultiDayTrailsManager({ adminPassword }) {
  const { t } = useTranslation();
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingTrail, setEditingTrail] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchTrails();
  }, []);

  const fetchTrails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/admin/multi-day-trails`, {
        headers: { 'X-Admin-Password': adminPassword }
      });
      setTrails(response.data.trails || []);
      setError(null);
    } catch (err) {
      setError('Failed to load multi-day trails: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    const newTrail = {
      id: '',
      name: '',
      description: '',
      type: 'point-to-point',
      duration_days: 3,
      duration_nights: 2,
      total_distance_km: 0,
      total_elevation_gain_m: 0,
      total_elevation_loss_m: 0,
      difficulty: 'moderate',
      best_season_start: '06-01',
      best_season_end: '09-30',
      region: 'Dolomites',
      hero_image: '',
      thumbnail: '',
      photos: [],
      highlights: [],
      tags: [],
      rifugio_ids: [],
      stages: [],
      equipment_checklist: [],
      booking_tips: [],
      status: 'draft'
    };
    setEditingTrail(newTrail);
    setIsCreating(true);
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!editingTrail.id || !editingTrail.name) {
        setError('Trail ID and Name are required');
        return;
      }

      // Calculate totals from stages
      const totalDistance = editingTrail.stages.reduce((sum, s) => sum + (parseFloat(s.distance_km) || 0), 0);
      const totalElevGain = editingTrail.stages.reduce((sum, s) => sum + (parseInt(s.elevation_gain_m) || 0), 0);
      const totalElevLoss = editingTrail.stages.reduce((sum, s) => sum + (parseInt(s.elevation_loss_m) || 0), 0);

      const trailToSave = {
        ...editingTrail,
        total_distance_km: totalDistance,
        total_elevation_gain_m: totalElevGain,
        total_elevation_loss_m: totalElevLoss
      };

      if (isCreating) {
        await axios.post(`${API_URL}/api/admin/multi-day-trails`, trailToSave, {
          headers: { 'X-Admin-Password': adminPassword }
        });
        setSuccessMessage('Trail created successfully!');
      } else {
        await axios.put(`${API_URL}/api/admin/multi-day-trails/${editingTrail.id}`, trailToSave, {
          headers: { 'X-Admin-Password': adminPassword }
        });
        setSuccessMessage('Trail updated successfully!');
      }

      await fetchTrails();
      setEditingTrail(null);
      setIsCreating(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to save trail: ' + err.message);
    }
  };

  const handleDelete = async (trailId) => {
    if (!confirm('Are you sure you want to delete this multi-day trail? This cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/admin/multi-day-trails/${trailId}`, {
        headers: { 'X-Admin-Password': adminPassword }
      });
      setSuccessMessage('Trail deleted successfully!');
      await fetchTrails();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to delete trail: ' + err.message);
    }
  };

  const handleAddStage = () => {
    const newStage = {
      stage_number: editingTrail.stages.length + 1,
      name: '',
      description: '',
      distance_km: 0,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
      estimated_duration_hours: 5,
      difficulty: 'moderate',
      start_point: { name: '', lat: 0, lon: 0, elevation_m: 0 },
      end_point: { name: '', lat: 0, lon: 0, elevation_m: 0 },
      overnight_rifugio_name: '',
      overnight_rifugio_details: null,
      waypoints: [],
      highlights: [],
      photos: []
    };
    
    setEditingTrail({
      ...editingTrail,
      stages: [...editingTrail.stages, newStage]
    });
  };

  const handleRemoveStage = (index) => {
    const newStages = editingTrail.stages.filter((_, i) => i !== index);
    // Renumber stages
    newStages.forEach((stage, i) => {
      stage.stage_number = i + 1;
    });
    setEditingTrail({
      ...editingTrail,
      stages: newStages
    });
  };

  const updateStage = (index, field, value) => {
    const newStages = [...editingTrail.stages];
    newStages[index] = { ...newStages[index], [field]: value };
    setEditingTrail({
      ...editingTrail,
      stages: newStages
    });
  };

  const updateField = (field, value) => {
    setEditingTrail({ ...editingTrail, [field]: value });
  };

  if (loading) {
    return <div className="multiday-manager-loading">Loading multi-day trails...</div>;
  }

  return (
    <div className="multiday-trails-manager">
      <div className="multiday-header">
        <h2>🏔️ Multi-Day Trails Management</h2>
        <button className="create-btn" onClick={handleCreateNew}>
          + Create New Trail
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {!editingTrail && (
        <div className="trails-list">
          <table className="trails-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Days</th>
                <th>Stages</th>
                <th>Difficulty</th>
                <th>Region</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trails.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                    No multi-day trails yet. Create your first one!
                  </td>
                </tr>
              ) : (
                trails.map(trail => (
                  <tr key={trail.id}>
                    <td>{trail.id}</td>
                    <td>{trail.name}</td>
                    <td>{trail.duration_days}D/{trail.duration_nights}N</td>
                    <td>{trail.stages?.length || 0}</td>
                    <td>
                      <span className={`difficulty-badge ${trail.difficulty}`}>
                        {trail.difficulty}
                      </span>
                    </td>
                    <td>{trail.region}</td>
                    <td>
                      <span className={`status-badge ${trail.status}`}>
                        {trail.status}
                      </span>
                    </td>
                    <td className="actions">
                      <button onClick={() => { setEditingTrail(trail); setIsCreating(false); }}>
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(trail.id)} className="delete-btn">
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingTrail && (
        <div className="trail-editor">
          <div className="editor-header">
            <h3>{isCreating ? 'Create New Multi-Day Trail' : `Editing: ${editingTrail.name}`}</h3>
            <div className="editor-actions">
              <button onClick={handleSave} className="save-btn">
                💾 Save Trail
              </button>
              <button onClick={() => { setEditingTrail(null); setIsCreating(false); }} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>

          <div className="editor-sections">
            {/* Basic Info Section */}
            <div className="editor-section">
              <h4>📋 Basic Information</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Trail ID *</label>
                  <input
                    type="text"
                    value={editingTrail.id}
                    onChange={(e) => updateField('id', e.target.value)}
                    disabled={!isCreating}
                    placeholder="e.g., alta-via-1"
                  />
                </div>
                <div className="form-group">
                  <label>Trail Name *</label>
                  <input
                    type="text"
                    value={editingTrail.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="e.g., Alta Via 1 - Classic Dolomites Trek"
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={editingTrail.type} onChange={(e) => updateField('type', e.target.value)}>
                    <option value="point-to-point">Point to Point</option>
                    <option value="loop">Loop</option>
                    <option value="out-and-back">Out and Back</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Duration (Days)</label>
                  <input
                    type="number"
                    value={editingTrail.duration_days}
                    onChange={(e) => updateField('duration_days', parseInt(e.target.value))}
                    min="2"
                  />
                </div>
                <div className="form-group">
                  <label>Duration (Nights)</label>
                  <input
                    type="number"
                    value={editingTrail.duration_nights}
                    onChange={(e) => updateField('duration_nights', parseInt(e.target.value))}
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label>Difficulty</label>
                  <select value={editingTrail.difficulty} onChange={(e) => updateField('difficulty', e.target.value)}>
                    <option value="easy">Easy</option>
                    <option value="moderate">Moderate</option>
                    <option value="challenging">Challenging</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Region</label>
                  <input
                    type="text"
                    value={editingTrail.region}
                    onChange={(e) => updateField('region', e.target.value)}
                    placeholder="e.g., Dolomites"
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={editingTrail.status} onChange={(e) => updateField('status', e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editingTrail.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows="4"
                  placeholder="Detailed description of the multi-day trek..."
                />
              </div>
            </div>

            {/* Media Section */}
            <div className="editor-section">
              <h4>🖼️ Media</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Hero Image URL</label>
                  <input
                    type="text"
                    value={editingTrail.hero_image}
                    onChange={(e) => updateField('hero_image', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="form-group">
                  <label>Thumbnail URL</label>
                  <input
                    type="text"
                    value={editingTrail.thumbnail}
                    onChange={(e) => updateField('thumbnail', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Stages Section */}
            <div className="editor-section">
              <div className="section-header">
                <h4>🥾 Trail Stages ({editingTrail.stages?.length || 0})</h4>
                <button onClick={handleAddStage} className="add-stage-btn">
                  + Add Stage
                </button>
              </div>

              {editingTrail.stages?.map((stage, index) => (
                <div key={index} className="stage-card">
                  <div className="stage-header">
                    <h5>Stage {stage.stage_number}: {stage.name || 'Unnamed'}</h5>
                    <button onClick={() => handleRemoveStage(index)} className="remove-stage-btn">
                      🗑️ Remove
                    </button>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Stage Name</label>
                      <input
                        type="text"
                        value={stage.name}
                        onChange={(e) => updateStage(index, 'name', e.target.value)}
                        placeholder="e.g., Lago di Braies to Rifugio Sennes"
                      />
                    </div>
                    <div className="form-group">
                      <label>Distance (km)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={stage.distance_km}
                        onChange={(e) => updateStage(index, 'distance_km', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Elevation Gain (m)</label>
                      <input
                        type="number"
                        value={stage.elevation_gain_m}
                        onChange={(e) => updateStage(index, 'elevation_gain_m', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Elevation Loss (m)</label>
                      <input
                        type="number"
                        value={stage.elevation_loss_m}
                        onChange={(e) => updateStage(index, 'elevation_loss_m', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Duration (hours)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={stage.estimated_duration_hours}
                        onChange={(e) => updateStage(index, 'estimated_duration_hours', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Difficulty</label>
                      <select
                        value={stage.difficulty}
                        onChange={(e) => updateStage(index, 'difficulty', e.target.value)}
                      >
                        <option value="easy">Easy</option>
                        <option value="moderate">Moderate</option>
                        <option value="challenging">Challenging</option>
                        <option value="expert">Expert</option>
                      </select>
                    </div>
                    <div className="form-group full-width">
                      <label>Overnight Rifugio Name</label>
                      <input
                        type="text"
                        value={stage.overnight_rifugio_name}
                        onChange={(e) => updateStage(index, 'overnight_rifugio_name', e.target.value)}
                        placeholder="e.g., Rifugio Sennes"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Stage Description</label>
                    <textarea
                      value={stage.description}
                      onChange={(e) => updateStage(index, 'description', e.target.value)}
                      rows="3"
                      placeholder="Describe this stage of the trek..."
                    />
                  </div>
                </div>
              ))}

              {(!editingTrail.stages || editingTrail.stages.length === 0) && (
                <div className="empty-stages">
                  No stages yet. Click "Add Stage" to create the first day of your multi-day trek!
                </div>
              )}
            </div>

            {/* Summary Section */}
            <div className="editor-section stats-section">
              <h4>📊 Trail Summary (Auto-calculated from stages)</h4>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Distance</div>
                  <div className="stat-value">
                    {editingTrail.stages?.reduce((sum, s) => sum + (parseFloat(s.distance_km) || 0), 0).toFixed(1)} km
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Elevation Gain</div>
                  <div className="stat-value">
                    {editingTrail.stages?.reduce((sum, s) => sum + (parseInt(s.elevation_gain_m) || 0), 0)} m
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Elevation Loss</div>
                  <div className="stat-value">
                    {editingTrail.stages?.reduce((sum, s) => sum + (parseInt(s.elevation_loss_m) || 0), 0)} m
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiDayTrailsManager;
