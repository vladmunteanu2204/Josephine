import React from 'react';
import { useTranslation } from 'react-i18next';
import './Footer.css';

function Footer({ setCurrentView }) {
  const { t } = useTranslation();

  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-logo">🏔️</span>
            <p className="footer-tagline">{t('footer.madeIn')}</p>
          </div>

          <div className="footer-links">
            <button 
              className="footer-link"
              onClick={() => setCurrentView('terms')}
            >
              {t('footer.terms')}
            </button>
            <span className="footer-separator">•</span>
            <button 
              className="footer-link"
              onClick={() => setCurrentView('privacy')}
            >
              {t('footer.privacy')}
            </button>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            © {new Date().getFullYear()} Josephine. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
