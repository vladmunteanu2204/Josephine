// Feature flags — set to true to re-enable a feature group
// All related code is still present in the codebase; only the UI is gated.

export const ENABLE_HIKE_TRACKING = true; // GPS tracking, Start Hike, ActiveHikeTracker + Live Trail Companion
export const ENABLE_GAMIFICATION = false;  // XP, levels, badges, challenges, leaderboards

// Redesigned trail detail page — compact bento-grid layout (hero + cards +
// on-demand overlay sheets) replacing the long single-column scroll. Built as a
// parallel component (TrailDetailV2) behind this switch so the old page stays
// intact for side-by-side comparison. Flip to false to fall back instantly.
export const NEW_TRAIL_DETAIL = true;

// Perk #1 — "get me to the trailhead" (in-app preview + native-maps handoff).
// Built OPEN for testing; this is the single switch the future host/subscription
// gate will wrap so it can become a paid-host perk without code changes.
export const PERK_TURN_BY_TURN = true;

// Perk — "download for offline" (GPX track export for no-signal stretches).
// Generated client-side from the trail's coordinates + POIs ($0, works offline).
// Built OPEN for testing; the single switch the future host/subscription gate wraps.
export const PERK_OFFLINE_DOWNLOAD = true;

// Perk — "itinerary postcard" (a designed Day Hike Guide PDF, branded
// "Josephine — Your Alpine Companion"). Built fully client-side: static route
// map (Mapbox Static Images) + terrain-sampled elevation profile, rasterised
// to a one-page A4 PDF. Built OPEN for testing; the future host/subscription
// gate wraps this single switch.
export const PERK_PDF_ITINERARY = true;

// Phase 17B — "Recommended for you": a personalised trail row on the homepage
// for signed-in users, driven by their own behaviour (views, saves, completed
// hikes). Self-hides for guests / when the backend has nothing to suggest.
export const ENABLE_RECOMMENDATIONS = true;

// Phase 17B — personalised push (weekly pick + saved-trail weather watch).
// BUILT BUT GATED OFF: the opt-in/out UI lives behind this switch, and the
// server only sends when ENABLE_PERSONALIZED_PUSH is set in its environment.
export const ENABLE_PERSONALIZED_PUSH = false;
