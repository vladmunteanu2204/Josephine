import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './FeaturedCarousel.css';

function FeaturedCarousel({ trails, onViewTrail }) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const resumeTimerRef = useRef(null);

  useEffect(() => {
    if (!isAutoPlaying || !trails || trails.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % trails.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, trails]);

  if (!trails || trails.length === 0) return null;

  const pauseAndResume = () => {
    setIsAutoPlaying(false);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setIsAutoPlaying(true), 5000);
  };

  const nextSlide = () => {
    pauseAndResume();
    setCurrentIndex((prev) => (prev + 1) % trails.length);
  };

  const prevSlide = () => {
    pauseAndResume();
    setCurrentIndex((prev) => (prev - 1 + trails.length) % trails.length);
  };

  const goToSlide = (index) => {
    pauseAndResume();
    setCurrentIndex(index);
  };

  const currentTrail = trails[currentIndex];

  return (
    <div className="featured-carousel">
      <div className="carousel-container">
        <div className="carousel-slide">
          <div className="carousel-hero-section">
            <img 
              src={currentTrail.image_url} 
              alt={`${currentTrail.name} - ${currentTrail.region}`}
              className="carousel-hero-image"
            />
            <div className="carousel-hero-gradient"></div>
            <span className="region-badge-floating">{currentTrail.region}</span>
            
            <button 
              className="carousel-nav carousel-prev" 
              onClick={prevSlide}
              aria-label={t('home.previousTrail') || 'Previous trail'}
            >
              ‹
            </button>
            <button 
              className="carousel-nav carousel-next" 
              onClick={nextSlide}
              aria-label={t('home.nextTrail') || 'Next trail'}
            >
              ›
            </button>
          </div>

          <div className="carousel-glass-panel">
            <div className="carousel-info">
              <h2 className="carousel-title">{currentTrail.name}</h2>
              <p className="carousel-tagline">{currentTrail.tagline}</p>
            </div>
            
            <div className="carousel-stats-grid">
              <div className="stat-chip">
                <span className="stat-icon">📏</span>
                <div className="stat-content">
                  <span className="stat-value">{currentTrail.distance_km}</span>
                  <span className="stat-unit">km</span>
                </div>
              </div>
              <div className="stat-chip">
                <span className="stat-icon">⏱️</span>
                <div className="stat-content">
                  <span className="stat-value">{currentTrail.duration_hours}</span>
                  <span className="stat-unit">h</span>
                </div>
              </div>
              <div className="stat-chip">
                <span className="stat-icon">⛰️</span>
                <div className="stat-content">
                  <span className="stat-value">{currentTrail.elevation_gain_m}</span>
                  <span className="stat-unit">m</span>
                </div>
              </div>
              <div className={`stat-chip difficulty-chip difficulty-${currentTrail.difficulty}`}>
                <span className="difficulty-label">{t(`catalog.${currentTrail.difficulty}`)}</span>
              </div>
            </div>

            <button className="carousel-cta-pill" onClick={() => onViewTrail(currentTrail)}>
              <span className="cta-text">{t('home.exploreTrail')}</span>
              <span className="cta-arrow">→</span>
            </button>
          </div>
        </div>
      </div>

      <div className="carousel-aurora-indicators">
        {trails.map((trail, index) => (
          <button
            key={index}
            className={`aurora-dot ${index === currentIndex ? 'active' : ''}`}
            onClick={() => goToSlide(index)}
            aria-label={`${t('home.goTo') || 'Go to'} ${trail.name}`}
          />
        ))}
      </div>
    </div>
  );
}

export default FeaturedCarousel;
