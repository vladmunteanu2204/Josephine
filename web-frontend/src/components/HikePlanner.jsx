import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import EquipmentChecklist from './EquipmentChecklist';
import SafetyTips from './SafetyTips';
import { ArrowLeft } from 'lucide-react';
import './HikePlanner.css';

const API_URL = '/api';

function HikePlanner({ onNavigate }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { currentUser } = useAuth();
  const [trails, setTrails] = useState([]);
  const [selectedTrails, setSelectedTrails] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [savedItineraries, setSavedItineraries] = useState([]);
  const [itineraryName, setItineraryName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportText, setExportText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrails();
    loadSavedItineraries();
  }, []);

  const loadTrails = async () => {
    try {
      const response = await axios.get(`${API_URL}/trails`);
      setTrails(response.data.trails || []);
    } catch (error) {
      console.error('Error loading trails:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedItineraries = () => {
    const saved = localStorage.getItem('josephine_hike_plans');
    if (saved) {
      setSavedItineraries(JSON.parse(saved));
    }
  };

  const addTrailToItinerary = (trail) => {
    if (!selectedTrails.find(t => t.id === trail.id)) {
      setSelectedTrails([...selectedTrails, trail]);
    }
  };

  const removeTrailFromItinerary = (trailId) => {
    setSelectedTrails(selectedTrails.filter(t => t.id !== trailId));
  };

  const calculateTotals = () => {
    const totalDistance = selectedTrails.reduce((sum, trail) => {
      const distance = parseFloat(trail.distance_km) || parseFloat(trail.distance) || 0;
      return sum + distance;
    }, 0);

    const totalElevation = selectedTrails.reduce((sum, trail) => {
      const elevation = parseFloat(trail.elevation_gain_m) || parseFloat(trail.elevation) || 0;
      return sum + elevation;
    }, 0);

    const totalDuration = selectedTrails.reduce((sum, trail) => {
      const duration = parseFloat(trail.duration_hours) || parseFloat(trail.duration) || 0;
      return sum + duration;
    }, 0);

    return { totalDistance, totalElevation, totalDuration };
  };

  const getMaxDifficulty = () => {
    if (selectedTrails.length === 0) return 'easy';
    const difficulties = { 'easy': 1, 'medium': 2, 'hard': 3 };
    const maxDiff = Math.max(...selectedTrails.map(t => difficulties[t.difficulty?.toLowerCase()] || 1));
    return Object.keys(difficulties).find(key => difficulties[key] === maxDiff);
  };

  const saveItinerary = async () => {
    if (!itineraryName.trim()) {
      toast.warning(t('planner.nameRequired'));
      return;
    }

    const newItinerary = {
      id: Date.now().toString(),
      name: itineraryName,
      trails: selectedTrails,
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
      ...calculateTotals()
    };

    // Save to localStorage for offline support
    const updated = [...savedItineraries, newItinerary];
    localStorage.setItem('josephine_hike_plans', JSON.stringify(updated));
    setSavedItineraries(updated);

    // Save to backend if user is logged in
    if (currentUser && currentUser.email) {
      try {
        await axios.post(`${API_URL}/hike-plans`, {
          ...newItinerary,
          user_email: currentUser.email,
          user_name: currentUser.displayName || currentUser.email.split('@')[0]
        });
        console.log('Plan saved to backend');
      } catch (error) {
        console.error('Error saving plan to backend:', error);
        // Still show success since it's saved locally
      }
    }

    setShowSaveModal(false);
    setItineraryName('');
    toast.success(t('planner.saved') || 'Hike plan saved successfully!');
  };

  const loadItinerary = (itinerary) => {
    setSelectedTrails(itinerary.trails);
    setStartDate(itinerary.startDate);
    setEndDate(itinerary.endDate);
  };

  const deleteItinerary = (id) => {
    const updated = savedItineraries.filter(i => i.id !== id);
    localStorage.setItem('josephine_hike_plans', JSON.stringify(updated));
    setSavedItineraries(updated);
  };

  const generateExport = () => {
    const { totalDistance, totalElevation, totalDuration } = calculateTotals();
    
    let text = `🏔️ ${t('planner.title')}\n\n`;
    if (startDate) text += `${t('planner.startDate')}: ${new Date(startDate).toLocaleDateString()}\n`;
    if (endDate) text += `${t('planner.endDate')}: ${new Date(endDate).toLocaleDateString()}\n`;
    text += `\n${t('planner.summary')}:\n`;
    text += `- ${t('trail.distance')}: ${totalDistance.toFixed(1)} km\n`;
    text += `- ${t('trail.elevation')}: ${totalElevation.toFixed(0)} m\n`;
    text += `- ${t('planner.estimatedDuration')}: ${totalDuration.toFixed(1)} ${t('recommendations.hours')}\n`;
    text += `\n${t('planner.trails')}:\n`;
    selectedTrails.forEach((trail, idx) => {
      text += `\n${idx + 1}. ${trail.name}\n`;
      text += `   - ${t('trail.difficulty')}: ${t(`catalog.${trail.difficulty?.toLowerCase()}`)}\n`;
      text += `   - ${t('trail.distance')}: ${trail.distance_km || trail.distance} km\n`;
      text += `   - ${t('trail.elevation')}: ${trail.elevation_gain_m || trail.elevation} m\n`;
    });

    setExportText(text);
    setShowExport(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exportText);
    toast.success(t('planner.copied'));
  };

  const { totalDistance, totalElevation, totalDuration } = calculateTotals();
  const tripDays = startDate && endDate ? 
    Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1 : 0;

  return (
    <div className="planner-page">
      <div className="planner-container">
        <button onClick={() => onNavigate('home')} className="back-button">
          <ArrowLeft size={16} strokeWidth={2} /> {t('common.backToHome')}
        </button>

        <div className="planner-header">
          <h1 className="planner-title">🗺️ {t('planner.title')}</h1>
          <p className="planner-subtitle">{t('planner.subtitle')}</p>
        </div>

        <div className="planner-grid">
          <div className="planner-main">
            <div className="planner-section">
              <h2 className="section-title">{t('planner.tripDates')}</h2>
              <div className="date-selector">
                <div className="date-input-group">
                  <label>{t('planner.startDate')}</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="date-input"
                  />
                </div>
                <div className="date-input-group">
                  <label>{t('planner.endDate')}</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="date-input"
                  />
                </div>
                {tripDays > 0 && (
                  <div className="trip-duration">
                    {tripDays} {tripDays === 1 ? t('planner.day') : t('planner.days')}
                  </div>
                )}
              </div>
            </div>

            <div className="planner-section">
              <h2 className="section-title">{t('planner.selectTrails')}</h2>
              {loading ? (
                <p>{t('common.loading')}</p>
              ) : (
                <div className="trail-selection-grid">
                  {trails.map(trail => (
                    <div key={trail.id} className="trail-select-card">
                      <div className="trail-select-info">
                        <h3>{trail.name}</h3>
                        <div className="trail-select-meta">
                          <span className={`difficulty-badge ${trail.difficulty?.toLowerCase()}`}>
                            {t(`catalog.${trail.difficulty?.toLowerCase()}`)}
                          </span>
                          <span>{trail.distance_km || trail.distance} km</span>
                          <span>{trail.elevation_gain_m || trail.elevation} m</span>
                        </div>
                      </div>
                      <button
                        onClick={() => addTrailToItinerary(trail)}
                        disabled={selectedTrails.find(t => t.id === trail.id)}
                        className="btn-add-trail"
                      >
                        {selectedTrails.find(t => t.id === trail.id) ? '✓' : '+'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <EquipmentChecklist 
              difficulty={getMaxDifficulty()}
              duration={totalDuration}
              tripDays={tripDays}
            />

            <SafetyTips 
              difficulty={getMaxDifficulty()}
              tripDays={tripDays}
            />
          </div>

          <aside className="planner-sidebar">
            <div className="itinerary-summary">
              <h2 className="section-title">{t('planner.itinerary')}</h2>
              
              {selectedTrails.length === 0 ? (
                <p className="empty-message">{t('planner.noTrailsSelected')}</p>
              ) : (
                <>
                  <div className="selected-trails-list">
                    {selectedTrails.map((trail, idx) => (
                      <div key={trail.id} className="selected-trail-item">
                        <div className="trail-order">{idx + 1}</div>
                        <div className="trail-info-compact">
                          <h4>{trail.name}</h4>
                          <p className="trail-stats-compact">
                            {trail.distance_km || trail.distance} km • 
                            {trail.elevation_gain_m || trail.elevation} m
                          </p>
                        </div>
                        <button
                          onClick={() => removeTrailFromItinerary(trail.id)}
                          className="btn-remove-trail"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="totals-summary">
                    <h3>{t('planner.summary')}</h3>
                    <div className="total-item">
                      <span>{t('trail.distance')}:</span>
                      <strong>{totalDistance.toFixed(1)} km</strong>
                    </div>
                    <div className="total-item">
                      <span>{t('trail.elevation')}:</span>
                      <strong>{totalElevation.toFixed(0)} m</strong>
                    </div>
                    <div className="total-item">
                      <span>{t('planner.estimatedDuration')}:</span>
                      <strong>{totalDuration.toFixed(1)} {t('recommendations.hours')}</strong>
                    </div>
                  </div>

                  <div className="itinerary-actions">
                    <button onClick={() => setShowSaveModal(true)} className="btn-primary">
                      {t('planner.saveItinerary')}
                    </button>
                    <button onClick={generateExport} className="btn-secondary">
                      {t('planner.exportItinerary')}
                    </button>
                  </div>
                </>
              )}
            </div>

            {savedItineraries.length > 0 && (
              <div className="saved-itineraries">
                <h3 className="section-title">{t('planner.savedItineraries')}</h3>
                <div className="saved-list">
                  {savedItineraries.map(itinerary => (
                    <div key={itinerary.id} className="saved-item">
                      <div className="saved-info">
                        <h4>{itinerary.name}</h4>
                        <p className="saved-meta">
                          {itinerary.trails.length} {t('planner.trails')} • 
                          {itinerary.totalDistance.toFixed(1)} km
                        </p>
                      </div>
                      <div className="saved-actions">
                        <button onClick={() => loadItinerary(itinerary)} className="btn-icon" title={t('planner.load')}>
                          📂
                        </button>
                        <button onClick={() => deleteItinerary(itinerary.id)} className="btn-icon" title={t('planner.delete')}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t('planner.saveItinerary')}</h3>
            <input
              type="text"
              value={itineraryName}
              onChange={(e) => setItineraryName(e.target.value)}
              placeholder={t('planner.itineraryNamePlaceholder')}
              className="modal-input"
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={saveItinerary} className="btn-primary">
                {t('common.save')}
              </button>
              <button onClick={() => setShowSaveModal(false)} className="btn-secondary">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <div className="modal-overlay" onClick={() => setShowExport(false)}>
          <div className="modal-content export-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('planner.exportItinerary')}</h3>
            <textarea
              value={exportText}
              readOnly
              className="export-textarea"
              rows={15}
            />
            <div className="modal-actions">
              <button onClick={copyToClipboard} className="btn-primary">
                {t('planner.copyToClipboard')}
              </button>
              <button onClick={() => setShowExport(false)} className="btn-secondary">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HikePlanner;
