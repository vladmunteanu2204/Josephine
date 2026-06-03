import React, { useEffect } from 'react';
import { Check, X, AlertTriangle, Medal, Trophy, Mountain, Info } from 'lucide-react';
import './Toast.css';

function Toast({ id, message, type = 'info', duration = 3000, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const getIcon = () => {
    const sz = { size: 18, strokeWidth: 2.25, 'aria-hidden': true };
    switch (type) {
      case 'success':   return <Check {...sz} />;
      case 'error':     return <X {...sz} />;
      case 'warning':   return <AlertTriangle {...sz} />;
      case 'badge':     return <Medal {...sz} />;
      case 'challenge': return <Trophy {...sz} />;
      case 'rifugio':   return <Mountain {...sz} />;
      default:          return <Info {...sz} />;
    }
  };

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-icon">{getIcon()}</div>
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={() => onClose(id)} aria-label="Close">
        <X size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

export default Toast;
