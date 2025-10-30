import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './UserPlansManager.css';

function UserPlansManager({ adminPassword }) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTrail, setFilterTrail] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterUser, setFilterUser] = useState('');

  useEffect(() => {
    loadPlans();
  }, [filterTrail, filterDate, filterUser]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterTrail) params.append('trail', filterTrail);
      if (filterDate) params.append('date', filterDate);
      if (filterUser) params.append('user', filterUser);

      const response = await axios.get(`/api/admin/hike-plans?${params.toString()}`, {
        headers: { 'X-Admin-Password': adminPassword }
      });
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="user-plans-manager">
      <h2>{t('admin.userPlans')}</h2>
      <p className="section-description">{t('admin.userPlansDescription')}</p>

      <div className="filters-row">
        <input
          type="text"
          placeholder={t('admin.filterByUser')}
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="filter-input"
        />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="filter-input"
        />
        <button onClick={() => { setFilterUser(''); setFilterDate(''); setFilterTrail(''); }} className="clear-filters-btn">
          {t('admin.clearFilters')}
        </button>
      </div>

      {loading ? (
        <div className="loading-state">{t('common.loading')}</div>
      ) : (
        <div className="plans-grid">
          {plans.length === 0 ? (
            <div className="empty-state">
              <p>{t('admin.noPlansFound')}</p>
            </div>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="plan-card">
                <div className="plan-header">
                  <h3>{plan.name}</h3>
                  <span className="plan-user">{plan.user_email}</span>
                </div>
                <div className="plan-details">
                  <div className="detail-row">
                    <span className="label">{t('planner.startDate')}:</span>
                    <span>{formatDate(plan.startDate)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{t('planner.endDate')}:</span>
                    <span>{formatDate(plan.endDate)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{t('planner.trails')}:</span>
                    <span>{plan.trails?.length || 0}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{t('trail.distance')}:</span>
                    <span>{plan.totalDistance?.toFixed(1) || 0} km</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{t('trail.elevation')}:</span>
                    <span>{plan.totalElevation?.toFixed(0) || 0} m</span>
                  </div>
                </div>
                {plan.trails && plan.trails.length > 0 && (
                  <div className="trails-list">
                    <strong>{t('planner.selectedTrails')}:</strong>
                    <ul>
                      {plan.trails.map((trail, idx) => (
                        <li key={idx}>{trail.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default UserPlansManager;
