import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ENABLE_GAMIFICATION } from '../featureFlags';
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

  const icons = {
    profile: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
    saved: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
    challenges: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 21h8M12 21v-4"/>
        <path d="M6 4h12v8a6 6 0 0 1-12 0V4z"/>
        <path d="M6 7H3a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4M18 7h3a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4"/>
      </svg>
    ),
    leaderboards: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="13" width="4" height="8" rx="1"/>
        <rect x="9" y="8" width="4" height="13" rx="1"/>
        <rect x="16" y="3" width="4" height="18" rx="1"/>
      </svg>
    ),
    planner: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2.5"/>
        <path d="M8 2v4M16 2v4M3 10h18"/>
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
      </svg>
    ),
    admin: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l7 4v6c0 4.42-3.13 8.57-7 9.93C8.13 20.57 5 16.42 5 12V6l7-4z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
    ),
    settings: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    logout: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    ),
  };

  const menuItems = [
    { key: 'profile', label: t('header.profile') },
    { key: 'saved', label: t('header.savedTrails') },
    ...(ENABLE_GAMIFICATION ? [
      { key: 'challenges', label: t('header.challenges') },
      { key: 'leaderboards', label: t('header.leaderboards') },
    ] : []),
    { key: 'planner', label: t('header.hikePlanner') },
    ...(isAdmin ? [{ key: 'admin', label: t('header.adminPanel') }] : []),
    { key: 'settings', label: t('header.settings') },
    { key: 'logout', label: t('header.logout'), danger: true }
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
        {menuItems.map((item, i) => (
          <React.Fragment key={item.key}>
            {/* Divider before logout */}
            {item.key === 'logout' && <div className="portal-divider" />}
            <button
              className={`portal-menu-item ${item.danger ? 'danger' : ''}`}
              onClick={() => { onNavigate(item.key); onClose(); }}
            >
              <span className="portal-item-icon">{icons[item.key]}</span>
              <span className="portal-item-label">{item.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>,
    document.body
  );
}
