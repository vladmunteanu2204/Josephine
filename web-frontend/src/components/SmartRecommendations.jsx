import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useToast } from '../contexts/ToastContext';
import './SmartRecommendations.css';

const API_URL = '/api';

const DURATION_OPTIONS = [
  { label: '< 2h',     value: 1.5 },
  { label: '2–4h',     value: 3   },
  { label: '4–6h',     value: 5   },
  { label: 'Full day', value: 8   },
];

const DIFFICULTY_OPTIONS = [
  { key: 'easy',   dots: 1, label: 'Easy'     },
  { key: 'medium', dots: 2, label: 'Moderate' },
  { key: 'hard',   dots: 3, label: 'Hard'     },
];

const MOOD_OPTIONS = [
  { id: 'alpine lakes',    label: 'Alpine lakes'    },
  { id: 'panoramic views', label: 'Panoramic views' },
  { id: 'via ferrata',     label: 'Via ferrata'     },
  { id: 'forests',         label: 'Forests'         },
  { id: 'cultural routes', label: 'Culture'         },
  { id: 'loop',            label: 'Loop trails'     },
];

const DIFF_COLOR = { easy: '#4ade80', medium: '#c9a84c', hard: '#ef4444' };

const LOADING_PHRASES = [
  'Reading the mountain winds…',
  'Checking trail conditions…',
  'Asking the locals…',
  'Almost there…',
];

function DifficultyDots({ count }) {
  return (
    <span className="sr-diff-dots" aria-hidden="true">
      {[1, 2, 3].map(i => (
        <span key={i} className={`sr-diff-dot ${i <= count ? 'filled' : ''}`} />
      ))}
    </span>
  );
}

function LoadingScreen() {
  const [phraseIdx, setPhraseIdx] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setPhraseIdx(i => (i + 1) % LOADING_PHRASES.length);
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="sr-loading-screen">
      <div className="sr-loading-mark">
        <img src="/josephine-mark.svg" alt="" className="sr-loading-mark-img" onError={e => e.currentTarget.style.opacity = '0'} />
        <div className="sr-loading-pulse" />
      </div>
      <p className="sr-loading-phrase">{LOADING_PHRASES[phraseIdx]}</p>
      <div className="sr-loading-bars">
        {[4,7,5,9,6,8,5,7,4,6].map((h, i) => (
          <span key={i} className="sr-loading-bar" style={{ height: `${h * 3}px`, animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    </div>
  );
}

function SmartRecommendations({ viewTrail, onBack }) {
  const { t } = useTranslation();
  const toast = useToast();

  // Form state — persisted across back-from-results
  const [duration, setDuration]     = useState(3);
  const [difficulty, setDifficulty] = useState('medium');
  const [moods, setMoods]           = useState([]);
  const [withDog, setWithDog]       = useState(false);
  const [startArea, setStartArea]   = useState('');

  // Results state
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [showResults, setShowResults] = useState(false);

  const [savedTrailIds, setSavedTrailIds] = useState(() => {
    const saved = localStorage.getItem('savedTrails');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (parsed.length > 0 && typeof parsed[0] === 'object') {
      const ids = parsed.map(t => t.id);
      localStorage.setItem('savedTrails', JSON.stringify(ids));
      return ids;
    }
    return parsed;
  });

  const toggleMood = (id) =>
    setMoods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const allInterests = [...moods, ...(withDog ? ['dog-friendly'] : [])];
      const response = await axios.post(`${API_URL}/ai/recommend`, {
        duration_hours: duration,
        difficulty,
        interests: allInterests,
        start_area: startArea,
      });
      setResults(response.data.results || []);
      setShowResults(true);
    } catch (err) {
      setError(t('recommendations.failedToLoad'));
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Go back to form — keep all selections intact, just hide results
  const goBackToForm = () => {
    setShowResults(false);
    setResults([]);
    setError('');
  };

  // Adaptive CTA label — reflects whether the user made intentional choices
  const hasFilters = moods.length > 0 || withDog || startArea.trim().length > 0;
  const isDefault  = duration === 3 && difficulty === 'medium' && !hasFilters;
  const ctaLabel   = isDefault ? 'Surprise me, Josephine' : 'Find my trail →';

  const toggleSave = (trail, e) => {
    e.stopPropagation();
    const isSaved = savedTrailIds.includes(trail.id);
    const next = isSaved
      ? savedTrailIds.filter(id => id !== trail.id)
      : [...savedTrailIds, trail.id];
    setSavedTrailIds(next);
    localStorage.setItem('savedTrails', JSON.stringify(next));
    isSaved
      ? toast.info(`${trail.name} removed from saved trails`)
      : toast.success(`${trail.name} saved!`);
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen />;

  // ── Results view ──────────────────────────────────────────────────────────
  if (showResults) {
    const [hero, ...rest] = results;
    return (
      <div className="sr-results-page">

        <div className="sr-results-nav">
          {onBack && (
            <button className="sr-back-btn" onClick={onBack}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <button className="sr-refine-btn" onClick={goBackToForm}>
            ↺ Refine search
          </button>
        </div>

        {error && <p className="sr-error" style={{ padding: '0 20px 16px' }}>{error}</p>}

        {results.length === 0 ? (
          <div className="sr-empty">
            <div className="sr-empty-icon">◈</div>
            <p>{t('recommendations.noResults')}</p>
          </div>
        ) : (
          <>
            {/* ── Hero card — Josephine's pick ── */}
            {hero && (
              <div className="sr-hero-card" onClick={() => viewTrail(hero)}>
                <div className="sr-hero-card__img-wrap">
                  <img
                    src={hero.wallpaper || hero.image_url || hero.thumbnail ||
                      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop&q=70'}
                    alt={hero.name}
                    className="sr-hero-card__img"
                  />
                  <div className="sr-hero-card__overlay" />

                  <span className="sr-hero-card__pick-badge">
                    <img src="/josephine-mark.svg" alt="" className="sr-pick-badge-mark" onError={e => e.currentTarget.style.display = 'none'} />
                    Josephine's Pick
                  </span>

                  <button
                    className={`sr-hero-save-btn ${savedTrailIds.includes(hero.id) ? 'saved' : ''}`}
                    onClick={e => toggleSave(hero, e)}
                    aria-label="Save trail"
                  >
                    {savedTrailIds.includes(hero.id) ? '♥' : '♡'}
                  </button>
                </div>

                <div className="sr-hero-card__body">
                  <div className="sr-hero-card__meta">
                    <span className="sr-hero-region">{hero.region}</span>
                    <span
                      className="sr-hero-diff"
                      style={{ color: DIFF_COLOR[hero.difficulty] || '#c9a84c', borderColor: DIFF_COLOR[hero.difficulty] || '#c9a84c' }}
                    >
                      {hero.difficulty}
                    </span>
                  </div>
                  <h2 className="sr-hero-card__name">{hero.name}</h2>
                  <div className="sr-hero-card__stats">
                    <span>{hero.distance_km} km</span>
                    <span className="sr-hero-dot">·</span>
                    <span>{hero.duration_hours}h</span>
                    <span className="sr-hero-dot">·</span>
                    <span>{hero.elevation_gain_m}m ↑</span>
                  </div>

                  {/* Josephine's reasoning */}
                  {hero.josephine_note && (
                    <div className="sr-josephine-reason">
                      <img src="/josephine-mark.svg" alt="" className="sr-reason-mark" onError={e => e.currentTarget.style.display = 'none'} />
                      <p className="sr-reason-text">{hero.josephine_note}</p>
                    </div>
                  )}

                  <button className="sr-hero-cta" onClick={e => { e.stopPropagation(); viewTrail(hero); }}>
                    View Details →
                  </button>
                </div>
              </div>
            )}

            {/* ── Rest of results ── */}
            {rest.length > 0 && (
              <div className="sr-rest-list">
                <p className="sr-rest-label">More suggestions</p>
                {rest.map(trail => (
                  <div key={trail.id} className="sr-list-card" onClick={() => viewTrail(trail)}>
                    <div className="sr-list-card__img-wrap">
                      <img
                        src={trail.wallpaper || trail.thumbnail || trail.image_url ||
                          'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&auto=format&fit=crop&q=60'}
                        alt={trail.name}
                        className="sr-list-card__img"
                      />
                    </div>
                    <div className="sr-list-card__body">
                      <p className="sr-list-card__region">{trail.region}</p>
                      <h3 className="sr-list-card__name">{trail.name}</h3>
                      <p className="sr-list-card__reason">{trail.josephine_note}</p>
                      <div className="sr-list-card__stats">
                        <span>{trail.distance_km} km</span>
                        <span>·</span>
                        <span>{trail.duration_hours}h</span>
                        <span>·</span>
                        <span style={{ color: DIFF_COLOR[trail.difficulty] }}>{trail.difficulty}</span>
                      </div>
                    </div>
                    <button
                      className={`sr-list-save-btn ${savedTrailIds.includes(trail.id) ? 'saved' : ''}`}
                      onClick={e => toggleSave(trail, e)}
                      aria-label="Save"
                    >
                      {savedTrailIds.includes(trail.id) ? '♥' : '♡'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div style={{ height: 60 }} />
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="sr-page">

      <div className="sr-header">
        <div className="sr-header-inner">
          <div className="sr-josephine-mark">
            <img src="/josephine-mark.svg" alt="" className="sr-mark-img" />
          </div>
          <div>
            <h1 className="sr-title">Plan my day</h1>
            <p className="sr-subtitle">Tell Josephine what you're in the mood for</p>
          </div>
        </div>
      </div>

      <div className="sr-form">

        {/* Duration */}
        <div className="sr-section">
          <p className="sr-label">How long do you have?</p>
          <div className="sr-segment">
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`sr-segment-btn ${duration === opt.value ? 'active' : ''}`}
                onClick={() => setDuration(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="sr-section">
          <p className="sr-label">Difficulty</p>
          <div className="sr-diff-row">
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={opt.key}
                className={`sr-diff-btn ${difficulty === opt.key ? 'active' : ''}`}
                onClick={() => setDifficulty(opt.key)}
              >
                <DifficultyDots count={opt.dots} />
                <span className="sr-diff-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mood */}
        <div className="sr-section">
          <p className="sr-label">I'm in the mood for… <span className="sr-label-hint">(pick any)</span></p>
          <div className="sr-mood-grid">
            {MOOD_OPTIONS.map(m => (
              <button
                key={m.id}
                className={`sr-mood-btn ${moods.includes(m.id) ? 'active' : ''}`}
                onClick={() => toggleMood(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dog toggle */}
        <div className="sr-section sr-dog-row">
          <div className="sr-dog-info">
            <span className="sr-dog-icon">🐾</span>
            <div>
              <p className="sr-dog-label">With my dog</p>
              <p className="sr-dog-hint">Filter for dog-friendly trails</p>
            </div>
          </div>
          <button
            className={`sr-toggle ${withDog ? 'active' : ''}`}
            onClick={() => setWithDog(d => !d)}
            aria-pressed={withDog}
            aria-label="With my dog"
          >
            <span className="sr-toggle-thumb" />
          </button>
        </div>

        {/* Start area */}
        <div className="sr-section">
          <p className="sr-label">Starting from <span className="sr-label-hint">(optional)</span></p>
          <input
            type="text"
            className="sr-input"
            placeholder="e.g. Cortina, Innsbruck, Bolzano…"
            value={startArea}
            onChange={e => setStartArea(e.target.value)}
          />
        </div>

        {error && <p className="sr-error">{error}</p>}

        {/* CTA */}
        <div className="sr-cta-wrap">
          <button className="sr-cta" onClick={handleSubmit}>
            <span className="sr-cta-text">{ctaLabel}</span>
            {isDefault && <span className="sr-cta-arrow">↓</span>}
          </button>
        </div>

      </div>
    </div>
  );
}

export default SmartRecommendations;
