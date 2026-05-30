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
      setError(t('admin.failedToLoadMultiDay') + ': ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    const newTrail = {
      id: '',
      name: '',
      description: '',
      josephineNote: { en: '', it: '', de: '' },
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
        setError(t('admin.trailIdRequired'));
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
        setSuccessMessage(t('admin.trailCreatedSuccess'));
      } else {
        await axios.put(`${API_URL}/api/admin/multi-day-trails/${editingTrail.id}`, trailToSave, {
          headers: { 'X-Admin-Password': adminPassword }
        });
        setSuccessMessage(t('admin.trailUpdatedSuccess'));
      }

      await fetchTrails();
      setEditingTrail(null);
      setIsCreating(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(t('admin.failedToSaveTrail') + ': ' + err.message);
    }
  };

  const handleDelete = async (trailId) => {
    if (!confirm(t('admin.confirmDelete'))) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/admin/multi-day-trails/${trailId}`, {
        headers: { 'X-Admin-Password': adminPassword }
      });
      setSuccessMessage(t('admin.trailDeletedSuccess'));
      await fetchTrails();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(t('admin.failedToDeleteTrail') + ': ' + err.message);
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
      photos: [],
      stops: [],
      exit_routes: [],
      weather_risk: ''
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
    return <div className="multiday-manager-loading">{t('admin.loadingMultiDayTrails')}</div>;
  }

  return (
    <div className="multiday-trails-manager">
      <div className="multiday-header">
        <h2>🏔️ {t('multiday.availableTrails')}</h2>
        <button className="create-btn" onClick={handleCreateNew}>
          + {t('admin.createNewTrail')}
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
                <th>{t('admin.trailName')}</th>
                <th>{t('multiday.days')}</th>
                <th>{t('multiday.stages')}</th>
                <th>{t('multiday.difficulty')}</th>
                <th>{t('multiday.region')}</th>
                <th>{t('admin.status')}</th>
                <th>{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {trails.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                    {t('admin.noTrailsYet')}
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
                        {t(`difficulty.${trail.difficulty}`, trail.difficulty)}
                      </span>
                    </td>
                    <td>{trail.region}</td>
                    <td>
                      <span className={`status-badge ${trail.status}`}>
                        {t(`admin.${trail.status}`, trail.status)}
                      </span>
                    </td>
                    <td className="actions">
                      <button onClick={() => { setEditingTrail(trail); setIsCreating(false); }}>
                        ✏️ {t('admin.edit')}
                      </button>
                      <button onClick={() => handleDelete(trail.id)} className="delete-btn">
                        🗑️ {t('admin.delete')}
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
            <h3>{isCreating ? t('admin.createNewMultiDay') : `${t('admin.editing')}: ${editingTrail.name}`}</h3>
            <div className="editor-actions">
              <button onClick={handleSave} className="save-btn">
                💾 {t('admin.saveTrail')}
              </button>
              <button onClick={() => { setEditingTrail(null); setIsCreating(false); }} className="cancel-btn">
                {t('admin.cancel')}
              </button>
            </div>
          </div>

          <div className="editor-sections">
            {/* Basic Info Section */}
            <div className="editor-section">
              <h4>📋 {t('admin.basicInfo')}</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('admin.trailId')} *</label>
                  <input
                    type="text"
                    value={editingTrail.id}
                    onChange={(e) => updateField('id', e.target.value)}
                    disabled={!isCreating}
                    placeholder={t('admin.trailIdPlaceholder')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('admin.trailName')} *</label>
                  <input
                    type="text"
                    value={editingTrail.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder={t('admin.trailNamePlaceholder')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('admin.type')}</label>
                  <select value={editingTrail.type} onChange={(e) => updateField('type', e.target.value)}>
                    <option value="point-to-point">{t('admin.pointToPoint')}</option>
                    <option value="loop">{t('admin.loop')}</option>
                    <option value="out-and-back">{t('admin.outAndBack')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('admin.durationDays')}</label>
                  <input
                    type="number"
                    value={editingTrail.duration_days}
                    onChange={(e) => updateField('duration_days', parseInt(e.target.value))}
                    min="2"
                  />
                </div>
                <div className="form-group">
                  <label>{t('admin.durationNights')}</label>
                  <input
                    type="number"
                    value={editingTrail.duration_nights}
                    onChange={(e) => updateField('duration_nights', parseInt(e.target.value))}
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label>{t('multiday.difficulty')}</label>
                  <select value={editingTrail.difficulty} onChange={(e) => updateField('difficulty', e.target.value)}>
                    <option value="easy">{t('difficulty.easy')}</option>
                    <option value="moderate">{t('difficulty.moderate')}</option>
                    <option value="challenging">{t('difficulty.challenging')}</option>
                    <option value="expert">{t('difficulty.expert')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('multiday.region')}</label>
                  <input
                    type="text"
                    value={editingTrail.region}
                    onChange={(e) => updateField('region', e.target.value)}
                    placeholder={t('admin.regionPlaceholder')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('admin.status')}</label>
                  <select value={editingTrail.status} onChange={(e) => updateField('status', e.target.value)}>
                    <option value="draft">{t('admin.draft')}</option>
                    <option value="published">{t('admin.published')}</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>{t('admin.description')}</label>
                <textarea
                  value={editingTrail.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows="4"
                  placeholder={t('admin.descriptionPlaceholder')}
                />
              </div>
              <div className="form-group">
                <label>🏔️ {t('trail.josephineNote', 'Josephine says')} (EN)</label>
                <textarea
                  value={editingTrail.josephineNote?.en || ''}
                  onChange={(e) => updateField('josephineNote', { ...(editingTrail.josephineNote || {}), en: e.target.value })}
                  rows="3"
                  placeholder="A warm personal note in English..."
                />
              </div>
              <div className="form-group">
                <label>🏔️ {t('trail.josephineNote', 'Josephine dice')} (IT)</label>
                <textarea
                  value={editingTrail.josephineNote?.it || ''}
                  onChange={(e) => updateField('josephineNote', { ...(editingTrail.josephineNote || {}), it: e.target.value })}
                  rows="3"
                  placeholder="Una nota personale in italiano..."
                />
              </div>
              <div className="form-group">
                <label>🏔️ {t('trail.josephineNote', 'Josephine sagt')} (DE)</label>
                <textarea
                  value={editingTrail.josephineNote?.de || ''}
                  onChange={(e) => updateField('josephineNote', { ...(editingTrail.josephineNote || {}), de: e.target.value })}
                  rows="3"
                  placeholder="Eine persönliche Notiz auf Deutsch..."
                />
              </div>
            </div>

            {/* Media Section */}
            <div className="editor-section">
              <h4>🖼️ {t('admin.media')}</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('admin.heroImageUrl')}</label>
                  <input
                    type="text"
                    value={editingTrail.hero_image}
                    onChange={(e) => updateField('hero_image', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="form-group">
                  <label>{t('admin.thumbnailUrl')}</label>
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
                <h4>🥾 {t('admin.trailStages')} ({editingTrail.stages?.length || 0})</h4>
                <button onClick={handleAddStage} className="add-stage-btn">
                  + {t('admin.addStage')}
                </button>
              </div>

              {editingTrail.stages?.map((stage, index) => (
                <div key={index} className="stage-card">
                  <div className="stage-header">
                    <h5>{t('admin.stage')} {stage.stage_number}: {stage.name || t('admin.unnamed')}</h5>
                    <button onClick={() => handleRemoveStage(index)} className="remove-stage-btn">
                      🗑️ {t('admin.remove')}
                    </button>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>{t('admin.stageName')}</label>
                      <input
                        type="text"
                        value={stage.name}
                        onChange={(e) => updateStage(index, 'name', e.target.value)}
                        placeholder={t('admin.stagePlaceholder')}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('admin.distanceKm')}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={stage.distance_km}
                        onChange={(e) => updateStage(index, 'distance_km', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('admin.elevationGainM')}</label>
                      <input
                        type="number"
                        value={stage.elevation_gain_m}
                        onChange={(e) => updateStage(index, 'elevation_gain_m', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('admin.elevationLossM')}</label>
                      <input
                        type="number"
                        value={stage.elevation_loss_m}
                        onChange={(e) => updateStage(index, 'elevation_loss_m', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('admin.durationHours')}</label>
                      <input
                        type="number"
                        step="0.5"
                        value={stage.estimated_duration_hours}
                        onChange={(e) => updateStage(index, 'estimated_duration_hours', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('multiday.difficulty')}</label>
                      <select
                        value={stage.difficulty}
                        onChange={(e) => updateStage(index, 'difficulty', e.target.value)}
                      >
                        <option value="easy">{t('difficulty.easy')}</option>
                        <option value="moderate">{t('difficulty.moderate')}</option>
                        <option value="challenging">{t('difficulty.challenging')}</option>
                        <option value="expert">{t('difficulty.expert')}</option>
                      </select>
                    </div>
                    <div className="form-group full-width">
                      <label>{t('admin.overnightRifugioName')}</label>
                      <input
                        type="text"
                        value={stage.overnight_rifugio_name}
                        onChange={(e) => updateStage(index, 'overnight_rifugio_name', e.target.value)}
                        placeholder={t('admin.overnightRifugioPlaceholder')}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>{t('admin.stageDescription')}</label>
                    <textarea
                      value={stage.description}
                      onChange={(e) => updateStage(index, 'description', e.target.value)}
                      rows="3"
                      placeholder={t('admin.stageDescriptionPlaceholder')}
                    />
                  </div>

                  {/* Weather Risk */}
                  <div className="form-group">
                    <label>⛈ Weather Risk Note</label>
                    <input
                      type="text"
                      value={stage.weather_risk || ''}
                      onChange={(e) => updateStage(index, 'weather_risk', e.target.value)}
                      placeholder="e.g. Exposed ridge — descend if thunder approaches"
                    />
                  </div>

                  {/* Food/Drink Stops */}
                  <div className="form-group">
                    <label>🍺 Food & Drink Stops (JSON array)</label>
                    <textarea
                      rows={4}
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      value={Array.isArray(stage.stops) ? JSON.stringify(stage.stops, null, 2) : (stage.stops || '[]')}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          updateStage(index, 'stops', parsed);
                        } catch {
                          /* ignore parse errors while typing */
                        }
                      }}
                      placeholder={'[\n  {"name":"Malga X","type":"food_drink","km_from_start":3.5,"what":"drinks, cheese","open_months":"Jun–Sep"}\n]'}
                    />
                    <small style={{ opacity: 0.5, fontSize: '11px' }}>Fields: name, type, km_from_start, what, open_months</small>
                  </div>

                  {/* Exit Routes */}
                  <div className="form-group">
                    <label>🚨 Exit Routes / Emergency Descents (JSON array)</label>
                    <textarea
                      rows={6}
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      value={Array.isArray(stage.exit_routes) ? JSON.stringify(stage.exit_routes, null, 2) : (stage.exit_routes || '[]')}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          updateStage(index, 'exit_routes', parsed);
                        } catch {
                          /* ignore parse errors while typing */
                        }
                      }}
                      placeholder={'[\n  {\n    "name":"Descent to Corvara",\n    "urgency":"emergency_or_planned",\n    "description":"From Passo X, take trail 11 south…",\n    "duration_minutes":120,\n    "transport":"SAD bus 442 from Corvara (hourly)",\n    "nearest_town":"Corvara in Badia",\n    "rejoining_options":[\n      {"description":"Return to yesterday\'s endpoint","how":"Bus 442 to La Villa…"}\n    ]\n  }\n]'}
                    />
                    <small style={{ opacity: 0.5, fontSize: '11px' }}>Fields: name, urgency, description, duration_minutes, transport, nearest_town, rejoining_options[]</small>
                  </div>
                </div>
              ))}

              {(!editingTrail.stages || editingTrail.stages.length === 0) && (
                <div className="empty-stages">
                  {t('admin.noStagesYet')}
                </div>
              )}
            </div>

            {/* Summary Section */}
            <div className="editor-section stats-section">
              <h4>📊 {t('admin.trailSummary')}</h4>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">{t('admin.totalDistance')}</div>
                  <div className="stat-value">
                    {editingTrail.stages?.reduce((sum, s) => sum + (parseFloat(s.distance_km) || 0), 0).toFixed(1)} km
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">{t('admin.totalElevationGain')}</div>
                  <div className="stat-value">
                    {editingTrail.stages?.reduce((sum, s) => sum + (parseInt(s.elevation_gain_m) || 0), 0)} m
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">{t('admin.totalElevationLoss')}</div>
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
