// ─── Season Detection & Config ────────────────────────────────────────────────
// Northern-hemisphere seasons aligned with the South Tyrol / Dolomites calendar.
// All photographic assets follow the naming convention:
//   hero-alpine-{season}.png  |  splash-{season}.png  |  josephine-portrait-{season}.png
// Missing season-specific assets fall back to the summer equivalents so the CSS
// palette still changes even before photos arrive.

export const SEASONS = {
  summer: {
    heroImage:    '/hero-alpine-summer.png',
    splashImage:  '/splash-summer.png',
    portrait:     '/josephine-portrait.png',
    heroPosition: '72% 50%',

    tokens: {
      '--accent-primary':  '#c9a84c',
      '--accent-warm':     '#d8a25a',
      '--bg-primary':      '#080e08',
      '--bg-secondary':    '#0f180f',
      '--season-overlay':  'rgba(5,12,5,0.62)',
      '--season-vignette': 'rgba(5,12,5,0.80)',
    },

    messages: [
      "The Dolomites are in full bloom — let me find you the perfect trail.",
      "Golden hour in the mountains is something else. Shall I find you a sunset hike?",
      "Best time of year to be outside. What kind of adventure are you after?",
      "Some of the best trails are crowd-free if you know when to go. Let me help.",
      "A perfect mountain day starts with the right trail. Want a recommendation?",
    ],

    moodTiles: [
      { icon: '🏔', label: 'Lake day',         bundle: { interests: ['alpine lakes'],    duration_hours: 4,   difficulty: 'medium' } },
      { icon: '🧀', label: 'Malga & food',     bundle: { interests: ['cultural routes'], duration_hours: 3,   difficulty: 'easy'   } },
      { icon: '🌿', label: 'Easy scenic walk', bundle: { interests: ['panoramic views'], duration_hours: 2,   difficulty: 'easy'   } },
      { icon: '🌄', label: 'Romantic view',    bundle: { interests: ['panoramic views'], duration_hours: 3,   difficulty: 'easy'   } },
      { icon: '🐕', label: 'Dog-friendly',     bundle: { interests: [],   withDog: true, duration_hours: 3,   difficulty: 'easy'   } },
      { icon: '☀️', label: 'Half-day escape',  bundle: { interests: [],                  duration_hours: 4,   difficulty: 'medium' } },
    ],

    splashTagline:    'Summer in the Dolomites',
    splashLoadingText: 'Preparing your mountain day…',
  },

  autumn: {
    // Seasonal photos not yet provided — remove keys so seasonAsset falls back to summer.
    // Add heroImage/splashImage/portrait here once you drop the files into public/.
    heroPosition: '72% 50%',
    fallbackHeroImage:   '/hero-alpine-summer.png',
    fallbackSplashImage: '/splash-summer.png',
    fallbackPortrait:    '/josephine-portrait.png',

    tokens: {
      '--accent-primary':  '#c8782a',
      '--accent-warm':     '#e09a48',
      '--bg-primary':      '#0c0906',
      '--bg-secondary':    '#180e09',
      '--season-overlay':  'rgba(14,8,3,0.65)',
      '--season-vignette': 'rgba(12,6,2,0.82)',
    },

    messages: [
      "The larches are turning gold in the Val di Funes — magical timing for a walk.",
      "Autumn light in the Dolomites is unlike anything else. Let me find you a trail.",
      "Crisp air, quiet paths, golden trees. Want a trail recommendation?",
      "The rifugios are quieter now — and the views are unforgettable.",
      "One of the best-kept secrets: the Dolomites in October. Let me build your day.",
    ],

    moodTiles: [
      { icon: '🍂', label: 'Foliage walk',   bundle: { interests: ['panoramic views'], duration_hours: 3, difficulty: 'easy'   } },
      { icon: '🧀', label: 'Malga & cheese', bundle: { interests: ['cultural routes'], duration_hours: 3, difficulty: 'easy'   } },
      { icon: '🌄', label: 'Golden hour',    bundle: { interests: ['panoramic views'], duration_hours: 4, difficulty: 'medium' } },
      { icon: '🏔', label: 'Ridge walk',     bundle: { interests: ['summit routes'],   duration_hours: 5, difficulty: 'hard'   } },
      { icon: '🐕', label: 'Dog-friendly',   bundle: { interests: [], withDog: true,   duration_hours: 3, difficulty: 'easy'   } },
      { icon: '☁️', label: 'Misty morning',  bundle: { interests: ['panoramic views'], duration_hours: 2, difficulty: 'easy'   } },
    ],

    splashTagline:    'Autumn in the Dolomites',
    splashLoadingText: 'Finding the golden paths…',
  },

  winter: {
    heroPosition: '72% 40%',
    fallbackHeroImage:   '/hero-alpine-summer.png',
    fallbackSplashImage: '/splash-summer.png',
    fallbackPortrait:    '/josephine-portrait.png',

    tokens: {
      '--accent-primary':  '#a0bcd0',
      '--accent-warm':     '#c8d8e8',
      '--bg-primary':      '#060810',
      '--bg-secondary':    '#0a0e18',
      '--season-overlay':  'rgba(4,6,14,0.68)',
      '--season-vignette': 'rgba(4,6,14,0.84)',
    },

    messages: [
      "The mountains are draped in white — snowshoe routes and winter rifugios are open.",
      "A different kind of Dolomites magic is waiting. Let me find your winter trail.",
      "Silence, snow, and starlit huts. Ready for something special?",
      "Winter light here is extraordinary. I know just the path for you.",
      "Whether you have two hours or a full day, the mountains are beautiful right now.",
    ],

    moodTiles: [
      { icon: '❄️', label: 'Snowshoe route',   bundle: { interests: ['winter trails'],   duration_hours: 3, difficulty: 'medium' } },
      { icon: '🏔', label: 'Rifugio day',      bundle: { interests: ['mountain huts'],   duration_hours: 4, difficulty: 'medium' } },
      { icon: '🌨', label: 'Easy winter walk', bundle: { interests: ['panoramic views'], duration_hours: 2, difficulty: 'easy'   } },
      { icon: '🌄', label: 'Sunrise summit',   bundle: { interests: ['summit routes'],   duration_hours: 5, difficulty: 'hard'   } },
      { icon: '🐕', label: 'Dog in snow',      bundle: { interests: [], withDog: true,   duration_hours: 2, difficulty: 'easy'   } },
      { icon: '🫖', label: 'Warm-up hut',      bundle: { interests: ['cultural routes'], duration_hours: 2, difficulty: 'easy'   } },
    ],

    splashTagline:    'Winter in the Dolomites',
    splashLoadingText: 'Lighting the winter path…',
  },

  spring: {
    heroPosition: '72% 50%',
    fallbackHeroImage:   '/hero-alpine-summer.png',
    fallbackSplashImage: '/splash-summer.png',
    fallbackPortrait:    '/josephine-portrait.png',

    tokens: {
      '--accent-primary':  '#6abf6a',
      '--accent-warm':     '#a0d090',
      '--bg-primary':      '#060d06',
      '--bg-secondary':    '#0d1a0d',
      '--season-overlay':  'rgba(4,10,4,0.60)',
      '--season-vignette': 'rgba(4,10,4,0.80)',
    },

    messages: [
      "The meadows below the Alpe di Siusi are just waking up — ideal for a spring hike.",
      "Wildflowers, waterfalls, and almost no crowds. Let me pick you a trail.",
      "Spring in the mountains is short and precious. Make the most of it today.",
      "The first malghe are reopening. Perfect time to visit before the summer crowds.",
      "Everything is fresh and green right now — the best kept secret in the Dolomites.",
    ],

    moodTiles: [
      { icon: '🌸', label: 'Wildflower walk',  bundle: { interests: ['panoramic views'], duration_hours: 3, difficulty: 'easy'   } },
      { icon: '💧', label: 'Waterfall route',  bundle: { interests: ['alpine lakes'],    duration_hours: 4, difficulty: 'medium' } },
      { icon: '🌿', label: 'Easy green trail', bundle: { interests: ['panoramic views'], duration_hours: 2, difficulty: 'easy'   } },
      { icon: '🧀', label: 'Malga reopening',  bundle: { interests: ['cultural routes'], duration_hours: 3, difficulty: 'easy'   } },
      { icon: '🐕', label: 'Dog-friendly',     bundle: { interests: [], withDog: true,   duration_hours: 3, difficulty: 'easy'   } },
      { icon: '🌄', label: 'First summit',     bundle: { interests: ['summit routes'],   duration_hours: 5, difficulty: 'hard'   } },
    ],

    splashTagline:    'Spring in the Dolomites',
    splashLoadingText: 'Waking the mountain paths…',
  },
};

// ─── Season detection ──────────────────────────────────────────────────────────
export function detectSeason(date = new Date()) {
  const m = date.getMonth() + 1; // 1–12
  const d = date.getDate();
  if ((m === 12 && d >= 21) || m <= 2 || (m === 3 && d <= 20)) return 'winter';
  if ((m === 3 && d >= 21) || m <= 5 || (m === 6 && d <= 20)) return 'spring';
  if ((m === 6 && d >= 21) || m <= 8 || (m === 9 && d <= 22)) return 'summer';
  return 'autumn';
}

export function getSeasonConfig(season) {
  return SEASONS[season] ?? SEASONS.summer;
}

// Resolves an asset key with season-specific fallback → summer fallback
export function seasonAsset(config, key) {
  const val = config[key];
  if (val) return val;
  const fallbackKey = `fallback${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  return config[fallbackKey] ?? SEASONS.summer[key];
}
