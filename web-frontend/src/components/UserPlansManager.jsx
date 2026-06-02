import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Mountain, Footprints } from 'lucide-react';
import './UserPlansManager.css';

// Admin view of user trip plans. Auth is handled by the AdminPanel axios
// interceptor (Authorization: Bearer) — this component must NOT send the
// removed X-Admin-Password header.
function UserPlansManager() {
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

      const response = await axios.get(`/api/admin/hike-plans?${params.toString()}`);
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

  // Normalise legacy + new plan shapes into one view model.
  const summarise = (plan) => {
    const mode = plan.mode || 'day_by_day';
    if (mode === 'hut_to_hut') {
      const trek = plan.trek || {};
      const nights = trek.nights || [];
      const booked = nights.filter(n => n.booking?.status === 'booked' || n.booking?.status === 'pending').length;
      return {
        mode,
        label: t('admin.planHutToHut', 'Hut-to-hut'),
        Icon: Mountain,
        title: trek.trek_name || plan.name,
        rows: [
          [t('planner.startDate'), formatDate(trek.start_date || plan.start_date)],
          [t('planner.nights', 'Nights'), nights.length],
          [t('admin.bookedNights', 'Booked/pending'), `${booked}/${nights.length}`],
          [t('trail.distance'), `${(trek.total_distance_km || 0).toFixed?.(1) ?? trek.total_distance_km} km`],
        ],
      };
    }
    // day_by_day (new bucket shape OR legacy flat shape)
    const items = plan.bucket?.items || plan.trails || [];
    const totals = plan.bucket?.totals || {};
    const dist = totals.distance_km ?? plan.totalDistance ?? 0;
    const elev = totals.elevation_gain_m ?? plan.totalElevation ?? 0;
    return {
      mode,
      label: t('admin.planDayByDay', 'Day-by-day'),
      Icon: Footprints,
      title: plan.name,
      rows: [
        [t('planner.startDate'), formatDate(plan.start_date || plan.startDate)],
        [t('planner.trails'), items.length],
        [t('trail.distance'), `${Number(dist).toFixed(1)} km`],
        [t('trail.elevation'), `${Number(elev).toFixed(0)} m`],
      ],
      items: items.map(i => i.name).filter(Boolean),
    };
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
            plans.map((plan) => {
              const v = summarise(plan);
              return (
                <div key={plan.id} className="plan-card">
                  <div className="plan-header">
                    <h3>{v.title}</h3>
                    <span className="plan-user">{plan.user_email}</span>
                  </div>
                  <span className={`plan-mode-badge plan-mode-badge--${v.mode}`}>
                    <v.Icon size={13} strokeWidth={2} /> {v.label}
                  </span>
                  <div className="plan-details">
                    {v.rows.map(([label, value]) => (
                      <div className="detail-row" key={label}>
                        <span className="label">{label}:</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                  {v.items && v.items.length > 0 && (
                    <div className="trails-list">
                      <strong>{t('planner.selectedTrails')}:</strong>
                      <ul>
                        {v.items.map((name, idx) => (
                          <li key={idx}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default UserPlansManager;
