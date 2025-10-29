import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TrailManager.css';

function TrailManager({ adminPassword }) {
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTrail, setEditingTrail] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
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
    dog_friendly: false
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
      dog_friendly: false
    });
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
