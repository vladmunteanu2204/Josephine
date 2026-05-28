import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './SplashScreen.css';

function SplashScreen({ onComplete }) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const minDisplayTime = 2000;
    const startTime = Date.now();

    const checkIfReady = () => {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);

      setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => {
          setIsLoading(false);
          if (onComplete) onComplete();
        }, 800);
      }, remainingTime);
    };

    if (document.readyState === 'complete') {
      checkIfReady();
    } else {
      window.addEventListener('load', checkIfReady);
      return () => window.removeEventListener('load', checkIfReady);
    }
  }, [onComplete]);

  if (!isLoading) return null;

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      <div className="splash-background">
        <div className="aurora-gradient"></div>
        <div className="mountain-silhouette mountain-1"></div>
        <div className="mountain-silhouette mountain-2"></div>
        <div className="mountain-silhouette mountain-3"></div>
      </div>

      <div className="splash-content">
        <div className="splash-logo">
          <div className="logo-icon">
            <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="logo-svg-mark">
              <defs>
                <radialGradient id="splashBg" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#1a2235"/>
                  <stop offset="100%" stopColor="#0a0c12"/>
                </radialGradient>
                <linearGradient id="splashGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e8c285"/>
                  <stop offset="50%" stopColor="#d4a574"/>
                  <stop offset="100%" stopColor="#b8854a"/>
                </linearGradient>
                <linearGradient id="splashPeak" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#d4a574" stopOpacity="0.9"/>
                  <stop offset="100%" stopColor="#4a90e2" stopOpacity="0.5"/>
                </linearGradient>
                <filter id="splashGlow">
                  <feGaussianBlur stdDeviation="1.5" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <circle cx="60" cy="60" r="60" fill="url(#splashBg)"/>
              <path d="M 18 80 L 33 56 L 41 62 L 52 46 L 60 50 L 70 39 L 81 47 L 92 54 L 101 80 Z"
                    fill="url(#splashPeak)" opacity="0.2"/>
              <rect x="47" y="27" width="29" height="9" rx="3" fill="url(#splashGold)"/>
              <rect x="53" y="27" width="16" height="47" rx="3" fill="url(#splashGold)" filter="url(#splashGlow)"/>
              <path d="M 53 71 Q 53 89 47 93 Q 40 96 35 93 Q 29 89 29 83"
                    fill="none" stroke="url(#splashGold)" strokeWidth="9" strokeLinecap="round"
                    filter="url(#splashGlow)"/>
              <path d="M 60 21 L 65 27 L 55 27 Z" fill="#d4a574" opacity="0.65"/>
            </svg>
          </div>
          <h1 className="logo-text">Josephine</h1>
          <p className="logo-tagline">{t('splash.tagline')}</p>
        </div>

        <div className="splash-loader">
          <div className="loader-track">
            <div className="loader-progress"></div>
          </div>
          <div className="loader-dots">
            <span className="dot dot-1"></span>
            <span className="dot dot-2"></span>
            <span className="dot dot-3"></span>
          </div>
        </div>
      </div>

      <div className="splash-footer">
        <p className="splash-footer-text">{t('splash.footer')}</p>
      </div>
    </div>
  );
}

export default SplashScreen;
