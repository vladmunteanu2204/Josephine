import React, { useState } from 'react';
import './JosephineAvatar.css';

// Living-avatar clip library — base paths; the player serves .mp4 first (iOS
// Safari) then .webm. Add states here as clips are produced.
const CLIPS = {
  idle: '/josephine/idle',
  thinking: '/josephine/thinking',
  walking: '/josephine/walking',
  peaceful: '/josephine/peaceful',
  celebrate: '/josephine/celebrate',            // meadow joy (non-summit hikes)
  celebrateSummit: '/josephine/celebrate-summit', // flag on the summit
  hero: '/josephine/hero',
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
  const base = CLIPS[state] || CLIPS.idle;
  const useVideo = base && !reducedMotion && !failed;
  const style = size ? { width: size, height: size } : undefined;

  return (
    <span className={`jph-av ${size ? '' : 'jph-av--fill'} ${feather ? 'jph-av--feather' : ''} ${className}`} style={style}>
      {useVideo ? (
        <video
          key={base}
          className="jph-av__media"
          poster={poster}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onError={() => setFailed(true)}
        >
          <source src={`${base}.mp4`} type="video/mp4" />
          <source src={`${base}.webm`} type="video/webm" />
        </video>
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
