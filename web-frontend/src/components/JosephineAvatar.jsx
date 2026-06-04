import React, { useState } from 'react';
import './JosephineAvatar.css';

// Living-avatar clip library. Add states here as clips are produced.
const CLIPS = {
  idle: '/josephine/idle.webm',
  thinking: '/josephine/thinking.webm',
  walking: '/josephine/walking.webm',
  peaceful: '/josephine/peaceful.webm',
  celebrate: '/josephine/celebrate.webm',          // meadow joy (non-summit hikes)
  celebrateSummit: '/josephine/celebrate-summit.webm', // flag on the summit
  hero: '/josephine/hero.webm',
};

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Josephine (and Narya) as a living avatar. Plays the looping clip for `state`,
 * and falls back to the static portrait when: no clip for that state, reduced
 * motion, or the video errors. Fills its parent unless given an explicit `size`.
 */
export default function JosephineAvatar({
  state = 'idle',
  size,
  className = '',
  feather = true,
  poster = '/josephine-portrait.webp',
}) {
  const [failed, setFailed] = useState(false);
  const clip = CLIPS[state] || CLIPS.idle;
  const useVideo = clip && !reducedMotion && !failed;
  const style = size ? { width: size, height: size } : undefined;

  return (
    <span className={`jph-av ${size ? '' : 'jph-av--fill'} ${feather ? 'jph-av--feather' : ''} ${className}`} style={style}>
      {useVideo ? (
        <video
          className="jph-av__media"
          src={clip}
          poster={poster}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          className="jph-av__media"
          src={poster}
          alt=""
          onError={(e) => { e.currentTarget.src = '/logo.webp'; }}
        />
      )}
    </span>
  );
}
