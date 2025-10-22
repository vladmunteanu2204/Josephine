import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './FeaturedCarousel.css';

function FeaturedCarousel({ trails, onViewTrail }) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying || !trails || trails.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % trails.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, trails]);

  if (!trails || trails.length === 0) return null;

  const nextSlide = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % trails.length);
  };

  const prevSlide = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + trails.length) % trails.length);
  };

  const goToSlide = (index) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  };

  const currentTrail = trails[currentIndex];

  return (
    <div className="featured-carousel">
      <div className="carousel-container">
        <div className="carousel-slide">
          <img 
            src={currentTrail.image_url} 
            alt={`${currentTrail.name} - ${currentTrail.region}`}
            className="carousel-background-image"
          />
          <div className="carousel-overlay"></div>
          <div className="carousel-content">
            <span className="region-badge-carousel">{currentTrail.region}</span>
            <h2 className="carousel-title">{currentTrail.name}</h2>
            <p className="carousel-tagline">{currentTrail.tagline}</p>
            
            <div className="carousel-stats">
              <div className="carousel-stat">
                <span className="stat-icon">📏</span>
                <span>{currentTrail.distance_km} km</span>
              </div>
              <div className="carousel-stat">
                <span className="stat-icon">⏱️</span>
                <span>{currentTrail.duration_hours}h</span>
              </div>
              <div className="carousel-stat">
                <span className="stat-icon">⛰️</span>
                <span>{currentTrail.elevation_gain_m}m</span>
              </div>
              <div className="carousel-stat">
                <span className={`difficulty-badge-carousel badge-${currentTrail.difficulty}`}>
                  {t(`catalog.${currentTrail.difficulty}`)}
                </span>
              </div>
            </div>

            <button className="carousel-cta" onClick={() => onViewTrail(currentTrail)}>
              {t('home.exploreTrail')} →
            </button>
          </div>

          <button 
            className="carousel-nav carousel-prev" 
            onClick={prevSlide}
            aria-label="Previous trail"
          >
            ‹
          </button>
          <button 
            className="carousel-nav carousel-next" 
            onClick={nextSlide}
            aria-label="Next trail"
          >
            ›
          </button>
        </div>

        <div className="carousel-indicators">
          {trails.map((trail, index) => (
            <button
              key={index}
              className={`indicator ${index === currentIndex ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`Go to ${trail.name}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default FeaturedCarousel;
