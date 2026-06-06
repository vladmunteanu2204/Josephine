// Feature flags — set to true to re-enable a feature group
// All related code is still present in the codebase; only the UI is gated.

export const ENABLE_HIKE_TRACKING = true; // GPS tracking, Start Hike, ActiveHikeTracker + Live Trail Companion
export const ENABLE_GAMIFICATION = false;  // XP, levels, badges, challenges, leaderboards

// Perk #1 — "get me to the trailhead" (in-app preview + native-maps handoff).
// Built OPEN for testing; this is the single switch the future host/subscription
// gate will wrap so it can become a paid-host perk without code changes.
export const PERK_TURN_BY_TURN = true;
