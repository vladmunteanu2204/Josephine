import React, { useEffect } from 'react';
import Icon from './Icon';
import './Toast.css';

function Toast({ id, message, type = 'info', duration = 3000, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return { type: 'lucide', name: 'Check', tone: 'gold' };
      case 'error':
        return { type: 'lucide', name: 'X', tone: 'neutral' };
      case 'warning':
        return { type: 'lucide', name: 'AlertTriangle', tone: 'sunset' };
      case 'badge':
        return { type: 'lucide', name: 'Award', tone: 'gold' };
      case 'challenge':
        return { type: '3d', name: 'trophy', tone: 'gold' };
      case 'rifugio':
        return { type: '3d', name: 'mountain-logo', tone: 'alpine' };
      default:
        return { type: 'lucide', name: 'Info', tone: 'neutral' };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-icon">
        <Icon type={iconConfig.type} name={iconConfig.name} size={20} tone={iconConfig.tone} />
      </div>
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={() => onClose(id)} aria-label="Close">
        <Icon type="lucide" name="X" size={16} tone="neutral" />
      </button>
    </div>
  );
}

export default Toast;
