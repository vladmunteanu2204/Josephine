import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ReviewsModeration.css';

function ReviewsModeration({ adminPassword }) {
  const [reviews, setReviews] = useState([]);
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const trailsResponse = await axios.get('/api/trails');
      const trailsList = trailsResponse.data.trails || [];
      setTrails(trailsList);

      const allReviews = [];
      for (const trail of trailsList) {
        try {
          const reviewsResponse = await axios.get(`/api/trails/${trail.id}/reviews`);
          const trailReviews = reviewsResponse.data.reviews || [];
          trailReviews.forEach(review => {
            allReviews.push({
              ...review,
              trail_name: trail.name,
              trail_id: trail.id
            });
          });
        } catch (error) {
          console.error(`Error loading reviews for ${trail.id}:`, error);
        }
      }
      
      setReviews(allReviews);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const handleDelete = async (reviewId, trailId) => {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      const headers = { 'X-Admin-Password': adminPassword };
      await axios.delete(`/api/admin/reviews/${reviewId}`, {
        data: { trail_id: trailId },
        headers
      });
      alert('Review deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Error deleting review:', error);
      alert('Failed to delete review: ' + (error.response?.data?.error || error.message));
    }
  };

  const getFilteredReviews = () => {
    if (filter === 'all') return reviews;
    if (filter === 'recent') {
      return reviews.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    if (filter === 'low_rating') {
      return reviews.filter(r => r.rating <= 2);
    }
    if (filter === 'high_rating') {
      return reviews.filter(r => r.rating >= 4);
    }
    return reviews;
  };

  const filteredReviews = getFilteredReviews();

  if (loading) {
    return <div className="admin-loading">Loading reviews...</div>;
  }

  return (
    <div className="reviews-moderation">
      <div className="moderation-header">
        <h2>Reviews Moderation</h2>
        <div className="filter-section">
          <label>Filter:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Reviews ({reviews.length})</option>
            <option value="recent">Most Recent</option>
            <option value="low_rating">Low Rating (≤2)</option>
            <option value="high_rating">High Rating (≥4)</option>
          </select>
        </div>
      </div>

      {filteredReviews.length === 0 ? (
        <div className="empty-state">
          <p>No reviews found</p>
        </div>
      ) : (
        <div className="reviews-list">
          {filteredReviews.map(review => (
            <div key={review.id} className="review-card">
              <div className="review-header">
                <div className="trail-info">
                  <h4>{review.trail_name}</h4>
                  <span className="trail-id">ID: {review.trail_id}</span>
                </div>
                <div className="review-rating">
                  {'⭐'.repeat(review.rating)}
                  <span className="rating-number">{review.rating}/5</span>
                </div>
              </div>
              
              <div className="review-body">
                <div className="review-meta">
                  <span className="reviewer-name">👤 {review.user_name}</span>
                  <span className="review-date">📅 {review.date}</span>
                  {review.helpful_count > 0 && (
                    <span className="helpful-count">👍 {review.helpful_count} helpful</span>
                  )}
                </div>
                <p className="review-comment">{review.comment}</p>
              </div>

              <div className="review-actions">
                <button
                  className="btn-delete-review"
                  onClick={() => handleDelete(review.id, review.trail_id)}
                >
                  🗑️ Delete Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReviewsModeration;
