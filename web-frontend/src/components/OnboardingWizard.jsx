import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './OnboardingWizard.css';

function OnboardingWizard({ onComplete }) {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      icon: '🏔️',
      title: t('onboarding.slide1.title'),
      description: t('onboarding.slide1.description'),
      features: [
        t('onboarding.slide1.feature1'),
        t('onboarding.slide1.feature2'),
        t('onboarding.slide1.feature3')
      ]
    },
    {
      icon: '📍',
      title: t('onboarding.slide2.title'),
      description: t('onboarding.slide2.description'),
      features: [
        t('onboarding.slide2.feature1'),
        t('onboarding.slide2.feature2'),
        t('onboarding.slide2.feature3')
      ]
    },
    {
      icon: '🏆',
      title: t('onboarding.slide3.title'),
      description: t('onboarding.slide3.description'),
      features: [
        t('onboarding.slide3.feature1'),
        t('onboarding.slide3.feature2'),
        t('onboarding.slide3.feature3')
      ]
    },
    {
      icon: '📋',
      title: t('onboarding.slide4.title'),
      description: t('onboarding.slide4.description'),
      features: [
        t('onboarding.slide4.feature1'),
        t('onboarding.slide4.feature2'),
        t('onboarding.slide4.feature3')
      ]
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      completeOnboarding();
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    if (onComplete) {
      onComplete();
    }
  };

  const slide = slides[currentSlide];

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-container glass-card">
        {/* Skip button */}
        <button className="onboarding-skip" onClick={handleSkip} aria-label={t('onboarding.skip')}>
          {t('onboarding.skip')}
        </button>

        {/* Slide content */}
        <div className="onboarding-slide">
          <div className="onboarding-icon">{slide.icon}</div>
          <h2 className="onboarding-title">{slide.title}</h2>
          <p className="onboarding-description">{slide.description}</p>

          <ul className="onboarding-features">
            {slide.features.map((feature, index) => (
              <li key={index} className="onboarding-feature">
                <span className="feature-check">✓</span>
                <span className="feature-text">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Progress indicators */}
        <div className="onboarding-progress">
          {slides.map((_, index) => (
            <button
              key={index}
              className={`progress-dot ${index === currentSlide ? 'active' : ''} ${index < currentSlide ? 'completed' : ''}`}
              onClick={() => setCurrentSlide(index)}
              aria-label={`${t('onboarding.goToSlide')} ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="onboarding-navigation">
          <button
            className="btn-onboarding btn-onboarding-secondary"
            onClick={handlePrevious}
            disabled={currentSlide === 0}
            aria-label={t('onboarding.previous')}
          >
            {t('onboarding.previous')}
          </button>
          <button
            className="btn-onboarding btn-onboarding-primary"
            onClick={handleNext}
            aria-label={currentSlide === slides.length - 1 ? t('onboarding.getStarted') : t('onboarding.next')}
          >
            {currentSlide === slides.length - 1 
              ? t('onboarding.getStarted')
              : t('onboarding.next')
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingWizard;
