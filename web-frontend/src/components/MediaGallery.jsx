import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { onImgError } from '../utils/trailImage';
import './MediaGallery.css';

// Lazy Image Component with Intersection Observer and Blur-up
function LazyImage({ src, alt, onClick, className }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before image enters viewport
        threshold: 0.01
      }
    );

    observer.observe(imgRef.current);

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={imgRef} 
      className={className}
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
      }}
    >
      {/* Blur-up placeholder */}
      {!isLoaded && isInView && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
          animation: 'pulse 2s ease-in-out infinite',
          backdropFilter: 'blur(20px)'
        }} />
      )}
      
      {/* Actual image */}
      {isInView && (
        <img 
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={onImgError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out'
          }}
        />
      )}
      
      {/* Photo overlay - only show when loaded */}
      {isLoaded && (
        <div className="photo-overlay">
          <span className="photo-expand-icon">🔍</span>
        </div>
      )}
      
      {/* Loading indicator */}
      {!isLoaded && isInView && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '12px'
        }}>
          Loading...
        </div>
      )}
    </div>
  );
}

function MediaGallery({ trail }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('photos');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const photos = trail.gallery || [];
  const videos = trail.videos || [];
  const hasPhotos = photos.length > 0;
  const hasVideos = videos.length > 0;

  const openLightbox = (index) => {
    setLightboxIndex(index);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    document.body.style.overflow = 'auto';
  };

  const navigateLightbox = (direction) => {
    if (lightboxIndex === null) return;
    const newIndex = direction === 'next' 
      ? (lightboxIndex + 1) % photos.length
      : (lightboxIndex - 1 + photos.length) % photos.length;
    setLightboxIndex(newIndex);
  };

  const handleKeyDown = (e) => {
    if (lightboxIndex === null) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') navigateLightbox('next');
    if (e.key === 'ArrowLeft') navigateLightbox('prev');
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex]);

  return (
    <div className="media-gallery">
      <div className="media-gallery-header">
        <h2 className="section-title">{t('trail.mediaGallery')}</h2>
        <div className="media-tabs">
          <button 
            className={`media-tab ${activeTab === 'photos' ? 'active' : ''}`}
            onClick={() => setActiveTab('photos')}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:'inline',verticalAlign:'middle',marginRight:'6px'}}>
              <rect x="1" y="2" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="7.5" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            {t('trail.photos')} ({photos.length})
          </button>
          <button
            className={`media-tab ${activeTab === 'videos' ? 'active' : ''}`}
            onClick={() => setActiveTab('videos')}
            disabled={!hasVideos}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:'inline',verticalAlign:'middle',marginRight:'6px'}}>
              <rect x="1" y="2" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M11 5.5L14 3.5V11.5L11 9.5V5.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            {t('trail.videos')} ({videos.length})
          </button>
        </div>
      </div>

      {activeTab === 'photos' && (
        <div className="media-content">
          {hasPhotos ? (
            <div className="photo-grid">
              {photos.map((photo, index) => (
                <LazyImage
                  key={index}
                  src={photo}
                  alt={`${trail.name} - ${t('trail.photo')} ${index + 1}`}
                  onClick={() => openLightbox(index)}
                  className="photo-card"
                />
              ))}
            </div>
          ) : (
            <div className="media-empty">
              <span className="empty-icon">📷</span>
              <p>{t('trail.noPhotos')}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'videos' && (
        <div className="media-content">
          {hasVideos ? (
            <div className="photo-grid">
              {videos.map((video, index) => (
                <div 
                  key={index} 
                  className="photo-card video-card"
                >
                  <video 
                    src={video} 
                    controls
                    preload="metadata"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  >
                    {t('trail.videoNotSupported')}
                  </video>
                </div>
              ))}
            </div>
          ) : (
            <div className="media-empty">
              <span className="empty-icon">🎬</span>
              <p>{t('trail.noVideos')}</p>
            </div>
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox}>
              ✕
            </button>
            
            <button 
              className="lightbox-nav lightbox-prev" 
              onClick={() => navigateLightbox('prev')}
            >
              ‹
            </button>
            
            <img
              src={photos[lightboxIndex]}
              alt={`${trail.name} - ${t('trail.photo')} ${lightboxIndex + 1}`}
              onError={onImgError}
            />
            
            <button 
              className="lightbox-nav lightbox-next" 
              onClick={() => navigateLightbox('next')}
            >
              ›
            </button>

            <div className="lightbox-counter">
              {lightboxIndex + 1} / {photos.length}
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default MediaGallery;
