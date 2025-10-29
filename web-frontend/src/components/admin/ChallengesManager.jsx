import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ChallengesManager.css';

function ChallengesManager({ adminPassword }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    type: 'distance',
    goal: 0,
    difficulty: 'medium',
    reward_xp: 100,
    duration_days: 30,
    icon: '🏆',
    badge_icon: '🎖️'
  });

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const response = await axios.get('/api/challenges');
      setChallenges(response.data.challenges || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading challenges:', error);
      setLoading(false);
    }
  };

  const handleEdit = (challenge) => {
    setEditingChallenge(challenge.id);
    setFormData(challenge);
    setShowCreateForm(false);
  };

  const handleCreate = () => {
    setShowCreateForm(true);
    setEditingChallenge(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      type: 'distance',
      goal: 0,
      difficulty: 'medium',
      reward_xp: 100,
      duration_days: 30,
      icon: '🏆',
      badge_icon: '🎖️'
    });
  };

  const handleSave = async () => {
    try {
      const headers = { 'X-Admin-Password': adminPassword };
      if (editingChallenge) {
        await axios.put(`/api/admin/challenges/${editingChallenge}`, formData, { headers });
        alert('Challenge updated successfully!');
      } else {
        await axios.post('/api/admin/challenges', formData, { headers });
        alert('Challenge created successfully!');
      }
      setEditingChallenge(null);
      setShowCreateForm(false);
      loadChallenges();
    } catch (error) {
      console.error('Error saving challenge:', error);
      alert('Failed to save challenge: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (challengeId) => {
    if (!confirm('Are you sure you want to delete this challenge?')) return;
    
    try {
      const headers = { 'X-Admin-Password': adminPassword };
      await axios.delete(`/api/admin/challenges/${challengeId}`, { headers });
      alert('Challenge deleted successfully!');
      loadChallenges();
    } catch (error) {
      console.error('Error deleting challenge:', error);
      alert('Failed to delete challenge: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCancel = () => {
    setEditingChallenge(null);
    setShowCreateForm(false);
  };

  if (loading) {
    return <div className="admin-loading">Loading challenges...</div>;
  }

  return (
    <div className="challenges-manager">
      <div className="manager-header">
        <h2>Challenges Management</h2>
        <button className="btn-create" onClick={handleCreate}>
          ➕ Create New Challenge
        </button>
      </div>

      {(editingChallenge || showCreateForm) && (
        <div className="challenge-form-overlay">
          <div className="challenge-form">
            <h3>{editingChallenge ? 'Edit Challenge' : 'Create New Challenge'}</h3>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Challenge ID *</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  disabled={!!editingChallenge}
                  placeholder="march_madness_2025"
                />
              </div>

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="March Madness Challenge"
                />
              </div>

              <div className="form-group full-width">
                <label>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  placeholder="Complete 50km of hiking in March to earn this badge!"
                />
              </div>

              <div className="form-group">
                <label>Challenge Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="distance">Distance (km)</option>
                  <option value="elevation">Elevation (m)</option>
                  <option value="hikes">Number of Hikes</option>
                  <option value="trails">Specific Trails</option>
                </select>
              </div>

              <div className="form-group">
                <label>Goal *</label>
                <input
                  type="number"
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: parseFloat(e.target.value) })}
                  placeholder="50"
                />
                <small>{formData.type === 'distance' ? 'km' : formData.type === 'elevation' ? 'm' : 'count'}</small>
              </div>

              <div className="form-group">
                <label>Difficulty</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="extreme">Extreme</option>
                </select>
              </div>

              <div className="form-group">
                <label>Reward XP *</label>
                <input
                  type="number"
                  value={formData.reward_xp}
                  onChange={(e) => setFormData({ ...formData, reward_xp: parseInt(e.target.value) })}
                  placeholder="100"
                />
              </div>

              <div className="form-group">
                <label>Duration (days)</label>
                <input
                  type="number"
                  value={formData.duration_days}
                  onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) })}
                  placeholder="30"
                />
              </div>

              <div className="form-group">
                <label>Icon Emoji</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="🏆"
                  maxLength="2"
                />
              </div>

              <div className="form-group">
                <label>Badge Icon Emoji</label>
                <input
                  type="text"
                  value={formData.badge_icon}
                  onChange={(e) => setFormData({ ...formData, badge_icon: e.target.value })}
                  placeholder="🎖️"
                  maxLength="2"
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
              <button className="btn-save" onClick={handleSave}>
                {editingChallenge ? 'Update Challenge' : 'Create Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="challenges-grid">
        {challenges.length === 0 ? (
          <div className="empty-state">
            <p>No challenges created yet. Create your first challenge!</p>
          </div>
        ) : (
          challenges.map(challenge => (
            <div key={challenge.id} className="challenge-card">
              <div className="challenge-icon">{challenge.icon}</div>
              <h3>{challenge.name}</h3>
              <p className="challenge-description">{challenge.description}</p>
              <div className="challenge-details">
                <div className="detail-item">
                  <span className="label">Type:</span>
                  <span className="value">{challenge.type}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Goal:</span>
                  <span className="value">{challenge.goal} {challenge.type === 'distance' ? 'km' : challenge.type === 'elevation' ? 'm' : ''}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Difficulty:</span>
                  <span className={`value diff-${challenge.difficulty}`}>{challenge.difficulty}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Reward:</span>
                  <span className="value">{challenge.reward_xp} XP</span>
                </div>
                <div className="detail-item">
                  <span className="label">Duration:</span>
                  <span className="value">{challenge.duration_days} days</span>
                </div>
              </div>
              <div className="challenge-actions">
                <button className="btn-edit" onClick={() => handleEdit(challenge)}>
                  ✏️ Edit
                </button>
                <button className="btn-delete" onClick={() => handleDelete(challenge.id)}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ChallengesManager;
