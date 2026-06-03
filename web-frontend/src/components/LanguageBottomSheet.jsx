import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Sheet } from './ui';
import './LanguageBottomSheet.css';

const languages = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' }
];

function LanguageBottomSheet({ isOpen, onClose }) {
  const { i18n, t } = useTranslation();

  const handleLanguageSelect = (langCode) => {
    i18n.changeLanguage(langCode);
    onClose();
  };

  const currentLanguage = languages.find(lang => i18n.language.startsWith(lang.code)) || languages[0];

  return (
    <Sheet isOpen={isOpen} onClose={onClose} ariaLabelledby="language-sheet-title">
      <div className="language-sheet">
        <div className="language-sheet-handle"></div>

        <div className="language-sheet-header">
          <h2 className="language-sheet-title" id="language-sheet-title">{t('language.selectLanguage')}</h2>
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
                {isActive && (
                  <span className="language-option-check">
                    <Check size={18} strokeWidth={2.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

export default LanguageBottomSheet;
