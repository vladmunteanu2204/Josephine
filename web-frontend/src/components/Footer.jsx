import React from 'react';
import { useTranslation } from 'react-i18next';
import './Footer.css';

function Footer({ setCurrentView }) {
  const { t } = useTranslation();

  return (
    <footer className="app-footer">
      <div className="footer-container">

        {/* Brand + nav */}
        <div className="footer-mid">
          <div className="footer-wordmark">
            <span className="footer-wordmark__name">Josephine</span>
            <span className="footer-wordmark__sub">Crafted in South Tyrol, Italy</span>
          </div>

          <nav className="footer-nav">
            <button className="footer-nav__link" onClick={() => setCurrentView('home')}>Home</button>
            <button className="footer-nav__link" onClick={() => setCurrentView('josephine')}>Josephine</button>
            <button className="footer-nav__link" onClick={() => setCurrentView('donate')}>{t('footer.support', 'Support us ☕')}</button>
            <button className="footer-nav__link" onClick={() => setCurrentView('terms')}>{t('footer.terms')}</button>
            <button className="footer-nav__link" onClick={() => setCurrentView('privacy')}>{t('footer.privacy')}</button>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <p className="footer-copyright">© {new Date().getFullYear()} Josephine. All rights reserved.</p>
        </div>

      </div>
    </footer>
  );
}

export default Footer;
