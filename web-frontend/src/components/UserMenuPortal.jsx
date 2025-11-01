import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import './UserMenuPortal.css';

export default function UserMenuPortal({ 
  isOpen, 
  onClose, 
  anchorRef, 
  userEmail, 
  isAdmin,
  onNavigate 
}) {
  const { t } = useTranslation();
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Calculate position based on anchor element
  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 12,
        left: rect.right - 220, // Align right edge with avatar
      });
    }
  }, [isOpen, anchorRef]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && menuRef.current && !menuRef.current.contains(e.target) && !anchorRef.current?.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const menuItems = [
    { key: 'profile', label: t('header.profile'), iconType: 'lucide', iconName: 'User' },
    { key: 'saved', label: t('header.savedTrails'), iconType: 'lucide', iconName: 'Heart' },
    { key: 'challenges', label: t('header.challenges'), iconType: 'lucide', iconName: 'Target' },
    { key: 'leaderboards', label: t('header.leaderboards'), iconType: '3d', iconName: 'trophy' },
    { key: 'planner', label: t('header.hikePlanner'), iconType: 'lucide', iconName: 'Calendar' },
    ...(isAdmin ? [{ key: 'admin', label: t('header.adminPanel'), iconType: 'lucide', iconName: 'Settings' }] : []),
    { key: 'settings', label: t('header.settings'), iconType: 'lucide', iconName: 'Settings' },
    { key: 'logout', label: t('header.logout'), iconType: 'lucide', iconName: 'LogOut', danger: true }
  ];

  return createPortal(
    <div 
      ref={menuRef}
      className="user-menu-portal"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`
      }}
    >
      <div className="portal-menu-header">
        <span className="portal-user-email">{userEmail}</span>
      </div>
      
      <div className="portal-menu-items">
        {menuItems.map(item => (
          <button
            key={item.key}
            className={`portal-menu-item ${item.danger ? 'danger' : ''}`}
            onClick={() => {
              onNavigate(item.key);
              onClose();
            }}
          >
            <span className="portal-item-icon">
              <Icon type={item.iconType} name={item.iconName} size={18} tone="alpine" />
            </span>
            <span className="portal-item-label">{item.label}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
