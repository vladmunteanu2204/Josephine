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
          <div className="logo-icon">🏔️</div>
          <h1 className="logo-text">Alpenvia</h1>
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
