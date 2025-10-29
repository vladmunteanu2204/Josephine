import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './MediaGallery.css';

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
            📸 {t('trail.photos')} ({photos.length})
          </button>
          <button 
            className={`media-tab ${activeTab === 'videos' ? 'active' : ''}`}
            onClick={() => setActiveTab('videos')}
            disabled={!hasVideos}
          >
            🎥 {t('trail.videos')} ({videos.length})
          </button>
        </div>
      </div>

      {activeTab === 'photos' && (
        <div className="media-content">
          {hasPhotos ? (
            <div className="photo-grid">
              {photos.map((photo, index) => (
                <div 
                  key={index} 
                  className="photo-card"
                  onClick={() => openLightbox(index)}
                >
                  <img 
                    src={photo} 
                    alt={`${trail.name} - ${t('trail.photo')} ${index + 1}`}
                    loading="lazy"
                  />
                  <div className="photo-overlay">
                    <span className="photo-expand-icon">🔍</span>
                  </div>
                </div>
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
    </div>
  );
}

export default MediaGallery;
