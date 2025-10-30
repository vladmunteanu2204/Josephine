import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './LanguageBottomSheet.css';

const languages = [
  { code: 'en', label: 'English', flag: '🇬🇧', name: 'English' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', name: 'Italiano' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', name: 'Deutsch' }
];

function LanguageBottomSheet({ isOpen, onClose }) {
  const { i18n } = useTranslation();
  const sheetRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      // Focus the close button when sheet opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
      
      // Handle Escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const sheetContent = (
    <div 
      className="language-bottom-sheet-overlay" 
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-sheet-title"
    >
      <div className="language-bottom-sheet" ref={sheetRef}>
        <div className="bottom-sheet-header">
          <h3 id="language-sheet-title" className="bottom-sheet-title">Select Language</h3>
          <button 
            ref={closeButtonRef}
            className="bottom-sheet-close" 
            onClick={onClose} 
            aria-label="Close language selector"
          >
            ✕
          </button>
        </div>
        
        <div className="language-grid">
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`language-option ${i18n.language.startsWith(lang.code) ? 'active' : ''}`}
              onClick={() => changeLanguage(lang.code)}
            >
              <span className="language-flag">{lang.flag}</span>
              <span className="language-name">{lang.name}</span>
              {i18n.language.startsWith(lang.code) && (
                <span className="language-check">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(sheetContent, document.body);
}

export default LanguageBottomSheet;
