import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useToast } from '../contexts/ToastContext';
import './ReviewsSection.css';

const API_URL = '/api';

function ReviewsSection({ trailId, rifugioId }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [reviews, setReviews] = useState([]);
  const [statistics, setStatistics] = useState({ average_rating: 0, total_reviews: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    user_name: '',
    rating: 5,
    comment: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const entityId = rifugioId || trailId;
  const reviewsUrl = rifugioId
    ? `${API_URL}/rifugios/${rifugioId}/reviews`
    : `${API_URL}/trails/${trailId}/reviews`;

  useEffect(() => {
    loadReviews();
  }, [entityId]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const response = await axios.get(reviewsUrl);
      setReviews(response.data.reviews || []);
      setStatistics(response.data.statistics || { average_rating: 0, total_reviews: 0 });
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.user_name.trim() || !formData.comment.trim()) {
      toast.warning(t('trail.reviewFieldsRequired') || 'Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const response = await axios.post(reviewsUrl, formData);
      
      setReviews([response.data.review, ...reviews]);
      
      setStatistics({
        average_rating: ((statistics.average_rating * statistics.total_reviews) + formData.rating) / (statistics.total_reviews + 1),
        total_reviews: statistics.total_reviews + 1
      });

      setFormData({ user_name: '', rating: 5, comment: '' });
      setShowForm(false);
      toast.success(t('trail.reviewSubmitted') || 'Thank you for your review!');
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error(t('trail.reviewError') || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`star ${i < rating ? 'filled' : ''}`}>
        ★
      </span>
    ));
  };

  return (
    <div className="reviews-section">
      <div className="reviews-header">
        <div className="reviews-title-row">
          <h2 className="reviews-title">{t('trail.userReviews')}</h2>
          <div className="reviews-summary">
            <div className="rating-display">
              {renderStars(Math.round(statistics.average_rating))}
              <span className="rating-number">{statistics.average_rating.toFixed(1)}</span>
            </div>
            <span className="reviews-count">
              {statistics.total_reviews} {t('trail.reviewsCount')}
            </span>
          </div>
        </div>
        
        <button 
          className="btn-write-review"
          onClick={() => setShowForm(!showForm)}
        >
          ✍️ {t('trail.writeReview')}
        </button>
      </div>

      {showForm && (
        <form className="review-form glass-card" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="user_name">{t('trail.yourName')}</label>
            <input
              type="text"
              id="user_name"
              value={formData.user_name}
              onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
              required
              className="form-input"
              placeholder={t('trail.yourNamePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="rating">{t('trail.yourRating')}</label>
            <div className="rating-input">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  className={`star-btn ${formData.rating >= star ? 'active' : ''}`}
                  onClick={() => setFormData({ ...formData, rating: star })}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="comment">{t('trail.yourComment')}</label>
            <textarea
              id="comment"
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              required
              className="form-textarea"
              placeholder={t('trail.yourCommentPlaceholder')}
              rows="4"
            />
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn-cancel"
              onClick={() => setShowForm(false)}
            >
              {t('trail.cancel')}
            </button>
            <button 
              type="submit" 
              className="btn-submit"
              disabled={submitting}
            >
              {submitting ? t('trail.submittingReview') : t('trail.submitReview')}
            </button>
          </div>
        </form>
      )}

      <div className="reviews-list">
        {loading ? (
          <div className="loading">{t('common.loading')}</div>
        ) : reviews.length > 0 ? (
          reviews.map((review) => (
            <div key={review.id} className="review-card glass-card">
              <div className="review-header">
                <div className="review-author">
                  <div className="author-avatar">
                    {review.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="author-info">
                    <h4 className="author-name">{review.user_name}</h4>
                    <span className="review-date">{review.date}</span>
                  </div>
                </div>
                <div className="review-rating">
                  {renderStars(review.rating)}
                </div>
              </div>
              <p className="review-comment">{review.comment}</p>
              <div className="review-footer">
                <button className="helpful-btn">
                  👍 {t('trail.helpful')} ({review.helpful_count})
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="no-reviews">
            <div className="no-reviews-icon">💬</div>
            <p>{t('trail.noReviewsYet')}</p>
            <button className="btn-write-review" onClick={() => setShowForm(true)}>
              ✍️ {t('trail.writeReview')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReviewsSection;
