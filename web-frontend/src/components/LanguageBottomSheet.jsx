import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageBottomSheet.css';

const languages = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' }
];

function LanguageBottomSheet({ isOpen, onClose }) {
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLanguageSelect = (langCode) => {
    i18n.changeLanguage(langCode);
    onClose();
  };

  const currentLanguage = languages.find(lang => i18n.language.startsWith(lang.code)) || languages[0];

  return (
    <>
      <div 
        className="language-sheet-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div 
        className="language-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('language.selectLanguage')}
      >
        <div className="language-sheet-handle"></div>
        
        <div className="language-sheet-header">
          <h2 className="language-sheet-title">{t('language.selectLanguage')}</h2>
        </div>

        <div className="language-sheet-grid">
          {languages.map((lang) => {
            const isActive = currentLanguage.code === lang.code;
            return (
              <button
                key={lang.code}
                className={`language-option ${isActive ? 'active' : ''}`}
                onClick={() => handleLanguageSelect(lang.code)}
                aria-pressed={isActive}
              >
                <span className="language-option-flag">{lang.flag}</span>
                <span className="language-option-label">{lang.label}</span>
                {isActive && <span className="language-option-check">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default LanguageBottomSheet;
