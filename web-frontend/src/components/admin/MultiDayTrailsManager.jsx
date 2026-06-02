import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Mountain, Pencil, Trash2, Save, Image, CalendarRange, Footprints, Sparkles, Siren, MapPin } from 'lucide-react';
import './MultiDayTrailsManager.css';

const API_URL = import.meta.env.VITE_API_URL || '';

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
      booking_strategy: '',
      emergency_contacts: { mountain_rescue: '', weather: '', local_police: '' },
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
        <h2 className="mdm-h-icon"><Mountain size={20} strokeWidth={2} /> {t('multiday.availableTrails')}</h2>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginTop: '16px' }}>
          {trails.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>
              {t('admin.noTrailsYet')}
            </div>
          ) : (
            trails.map(trail => (
              <div key={trail.id} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px', overflow: 'hidden',
              }}>
                {trail.hero_image && (
                  <img src={trail.hero_image} alt={trail.name} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                )}
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: '#f0ece6' }}>{trail.name}</h4>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px',
                      background: trail.status === 'published' ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
                      color: trail.status === 'published' ? '#4ade80' : '#fbbf24',
                      border: `1px solid ${trail.status === 'published' ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`,
                    }}>{trail.status}</span>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'rgba(240,236,230,0.45)' }}>
                    {trail.region} · {trail.duration_days} days · {trail.stages?.length || 0} stages · {trail.difficulty}
                  </p>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'rgba(240,236,230,0.35)' }}>
                    {trail.total_distance_km} km · {trail.total_elevation_gain_m?.toLocaleString()} m ↑
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setEditingTrail({ ...trail, emergency_contacts: trail.emergency_contacts || { mountain_rescue: '', weather: '', local_police: '' } }); setIsCreating(false); }} style={{
                      flex: 1, padding: '8px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
                      borderRadius: '8px', color: '#c9a84c', fontSize: '12px', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    }}><Pencil size={13} strokeWidth={2} /> Edit</button>
                    <button onClick={() => handleDelete(trail.id)} aria-label="Delete" style={{
                      padding: '8px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                      borderRadius: '8px', color: '#f87171', fontSize: '12px', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}><Trash2 size={13} strokeWidth={2} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {editingTrail && (
        <div className="trail-editor">
          <div className="editor-header">
            <h3>{isCreating ? t('admin.createNewMultiDay') : `${t('admin.editing')}: ${editingTrail.name}`}</h3>
            <div className="editor-actions">
              <button onClick={handleSave} className="save-btn">
                <Save size={15} strokeWidth={2} /> {t('admin.saveTrail')}
              </button>
              <button onClick={() => { setEditingTrail(null); setIsCreating(false); }} className="cancel-btn">
                {t('admin.cancel')}
              </button>
            </div>
          </div>

          {/* Live summary header */}
          <div style={{
            display: 'flex', gap: '24px', padding: '12px 16px', background: 'rgba(201,168,76,0.06)',
            border: '1px solid rgba(201,168,76,0.15)', borderRadius: '10px', marginBottom: '16px', flexWrap: 'wrap',
          }}>
            {[
              { label: 'Distance', value: `${editingTrail.stages?.reduce((s, x) => s + (parseFloat(x.distance_km) || 0), 0).toFixed(1)} km` },
              { label: 'Elev gain', value: `${editingTrail.stages?.reduce((s, x) => s + (parseInt(x.elevation_gain_m) || 0), 0)} m` },
              { label: 'Elev loss', value: `${editingTrail.stages?.reduce((s, x) => s + (parseInt(x.elevation_loss_m) || 0), 0)} m` },
              { label: 'Stages', value: editingTrail.stages?.length || 0 },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.6)' }}>{label}</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#c9a84c' }}>{value}</span>
              </div>
            ))}
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
                <label className="mdm-h-icon"><Mountain size={14} strokeWidth={2} /> {t('trail.josephineNote', 'Josephine says')} (EN)</label>
                <textarea
                  value={editingTrail.josephineNote?.en || ''}
                  onChange={(e) => updateField('josephineNote', { ...(editingTrail.josephineNote || {}), en: e.target.value })}
                  rows="3"
                  placeholder="A warm personal note in English..."
                />
              </div>
              <div className="form-group">
                <label className="mdm-h-icon"><Mountain size={14} strokeWidth={2} /> {t('trail.josephineNote', 'Josephine dice')} (IT)</label>
                <textarea
                  value={editingTrail.josephineNote?.it || ''}
                  onChange={(e) => updateField('josephineNote', { ...(editingTrail.josephineNote || {}), it: e.target.value })}
                  rows="3"
                  placeholder="Una nota personale in italiano..."
                />
              </div>
              <div className="form-group">
                <label className="mdm-h-icon"><Mountain size={14} strokeWidth={2} /> {t('trail.josephineNote', 'Josephine sagt')} (DE)</label>
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
              <h4 className="mdm-h-icon"><Image size={16} strokeWidth={2} /> {t('admin.media')}</h4>
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
              <div className="form-group">
                <label>Gallery photos (one URL per line)</label>
                <textarea
                  rows={4}
                  value={(editingTrail.photos || []).join('\n')}
                  onChange={e => updateField('photos', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                  placeholder="https://...&#10;https://..."
                />
                <small style={{ opacity: 0.5, fontSize: '11px' }}>These appear in the photo gallery on the trek detail page.</small>
              </div>
            </div>

            {/* Season & Planning */}
            <div className="editor-section">
              <h4 className="mdm-h-icon"><CalendarRange size={16} strokeWidth={2} /> Season &amp; Planning</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Season opens (MM-DD)</label>
                  <input type="text" value={editingTrail.best_season_start || ''} onChange={e => updateField('best_season_start', e.target.value)} placeholder="06-15" />
                </div>
                <div className="form-group">
                  <label>Season closes (MM-DD)</label>
                  <input type="text" value={editingTrail.best_season_end || ''} onChange={e => updateField('best_season_end', e.target.value)} placeholder="09-30" />
                </div>
              </div>
              <div className="form-group">
                <label>Booking strategy</label>
                <textarea rows={2} value={editingTrail.booking_strategy || ''} onChange={e => updateField('booking_strategy', e.target.value)} placeholder="Book all rifugios 4–6 weeks ahead in July–August…" />
              </div>
              <div className="form-group">
                <label>Booking tips (one per line)</label>
                <textarea rows={4} value={(editingTrail.booking_tips || []).join('\n')} onChange={e => updateField('booking_tips', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} placeholder="Book 2–3 weeks in advance&#10;Bring cash — not all rifugios accept cards" />
              </div>
              <div className="form-group">
                <label>Equipment checklist (one per line)</label>
                <textarea rows={5} value={(editingTrail.equipment_checklist || []).join('\n')} onChange={e => updateField('equipment_checklist', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} placeholder="40-50L backpack&#10;Sleeping bag liner&#10;Trekking poles" />
              </div>
              <div className="form-group">
                <label>Highlights (one per line)</label>
                <textarea rows={3} value={(editingTrail.highlights || []).join('\n')} onChange={e => updateField('highlights', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} placeholder="Traverse the legendary Dolomites peaks&#10;Stay in authentic rifugios" />
              </div>
              <div className="form-group">
                <label>Tags (one per line)</label>
                <textarea rows={2} value={(editingTrail.tags || []).join('\n')} onChange={e => updateField('tags', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} placeholder="multi-day&#10;hut-to-hut&#10;dolomites" />
              </div>
            </div>

            {/* Emergency contacts */}
            <div className="editor-section">
              <h4>🆘 Emergency Contacts</h4>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Mountain rescue</label>
                  <input value={(editingTrail.emergency_contacts || {}).mountain_rescue || ''} onChange={e => updateField('emergency_contacts', { ...(editingTrail.emergency_contacts || {}), mountain_rescue: e.target.value })} placeholder="118 (Italy) or +39 0471 797171" />
                </div>
                <div className="form-group">
                  <label>Weather service</label>
                  <input value={(editingTrail.emergency_contacts || {}).weather || ''} onChange={e => updateField('emergency_contacts', { ...(editingTrail.emergency_contacts || {}), weather: e.target.value })} placeholder="www.provincia.bz.it/meteo" />
                </div>
                <div className="form-group">
                  <label>Local police</label>
                  <input value={(editingTrail.emergency_contacts || {}).local_police || ''} onChange={e => updateField('emergency_contacts', { ...(editingTrail.emergency_contacts || {}), local_police: e.target.value })} placeholder="113" />
                </div>
              </div>
            </div>

            {/* Stages Section */}
            <div className="editor-section">
              <div className="section-header">
                <h4 className="mdm-h-icon"><Footprints size={16} strokeWidth={2} /> {t('admin.trailStages')} ({editingTrail.stages?.length || 0})</h4>
                <button onClick={handleAddStage} className="add-stage-btn">
                  + {t('admin.addStage')}
                </button>
              </div>

              {editingTrail.stages?.map((stage, index) => (
                <div key={index} className="stage-card">
                  <div className="stage-header">
                    <h5>{t('admin.stage')} {stage.stage_number}: {stage.name || t('admin.unnamed')}</h5>
                    <button onClick={() => handleRemoveStage(index)} className="remove-stage-btn">
                      <Trash2 size={14} strokeWidth={2} /> {t('admin.remove')}
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

                  {/* Stage highlights */}
                  <div className="form-group">
                    <label className="mdm-h-icon"><Sparkles size={14} strokeWidth={2} /> Stage highlights (one per line)</label>
                    <textarea
                      rows={3}
                      value={(stage.highlights || []).join('\n')}
                      onChange={e => updateStage(index, 'highlights', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                      placeholder="Stunning views of Lago di Braies&#10;Alpine meadows filled with wildflowers"
                    />
                  </div>

                  {/* Sleep / overnight booking */}
                  <div className="form-group">
                    <label>🛏 Overnight rifugio name</label>
                    <input
                      type="text"
                      value={stage.sleep?.rifugio_name || stage.overnight_rifugio_name || ''}
                      onChange={e => updateStage(index, 'sleep', { ...(stage.sleep || {}), rifugio_name: e.target.value })}
                      placeholder="Rifugio Sennes"
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 400 }}>
                      <input
                        type="checkbox"
                        checked={stage.sleep?.must_book ?? true}
                        onChange={e => updateStage(index, 'sleep', { ...(stage.sleep || {}), must_book: e.target.checked })}
                      />
                      Must book in advance
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 400 }}>
                      <input
                        type="checkbox"
                        checked={stage.sleep?.half_board_recommended ?? false}
                        onChange={e => updateStage(index, 'sleep', { ...(stage.sleep || {}), half_board_recommended: e.target.checked })}
                      />
                      Half-board recommended
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Booking note</label>
                    <input
                      type="text"
                      value={stage.sleep?.booking_note || ''}
                      onChange={e => updateStage(index, 'sleep', { ...(stage.sleep || {}), booking_note: e.target.value })}
                      placeholder="Book 3–4 weeks ahead in high season. Phone preferred."
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
                    <label className="mdm-h-icon"><Siren size={14} strokeWidth={2} /> Exit Routes / Emergency Descents (JSON array)</label>
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

          </div>
        </div>
      )}
    </div>
  );
}

export default MultiDayTrailsManager;
