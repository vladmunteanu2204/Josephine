import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './UserManagement.css';

function UserManagement({ adminPassword }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/analytics/users', {
        headers: {  }
      });
      setUsers(response.data.users || []);
      setTotalUsers(response.data.total_users || 0);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="user-management">
      <h2>{t('admin.userManagement')}</h2>
      <p className="section-description">{t('admin.userManagementDescription')}</p>

      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-value">{totalUsers}</div>
          <div className="stat-label">{t('admin.totalUsers')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.reduce((sum, u) => sum + u.hikes_completed, 0)}</div>
          <div className="stat-label">{t('admin.totalHikes')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.reduce((sum, u) => sum + u.total_distance, 0).toFixed(0)} km</div>
          <div className="stat-label">{t('admin.totalDistance')}</div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">{t('common.loading')}</div>
      ) : (
        <div className="users-table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>{t('admin.email')}</th>
                <th>{t('admin.hikesCompleted')}</th>
                <th>{t('admin.totalDistance')}</th>
                <th>{t('admin.totalElevation')}</th>
                <th>{t('admin.totalDuration')}</th>
                <th>{t('admin.firstHike')}</th>
                <th>{t('admin.lastHike')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={idx}>
                  <td className="user-email">{user.email}</td>
                  <td>{user.hikes_completed}</td>
                  <td>{user.total_distance.toFixed(1)} km</td>
                  <td>{user.total_elevation.toFixed(0)} m</td>
                  <td>{user.total_duration.toFixed(1)} h</td>
                  <td>{formatDate(user.first_hike)}</td>
                  <td>{formatDate(user.last_hike)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
