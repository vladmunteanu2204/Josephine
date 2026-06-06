// ── Guest access policy ──────────────────────────────────────────────────
// Logged-out visitors can only reach a small set of views: the Home page as a
// locked teaser, the Josephine chat (a "taste" of the product), the public
// legal pages, and Settings (for the language picker). Every other section —
// Explore/catalog, trail & rifugio detail, multi-day trails, planner, saved,
// profile, leaderboards, challenges, donate, admin — requires an account.
//
// 'recommendations' is the legacy hash alias for the Josephine view, so it is
// allowed alongside 'josephine'.
export const GUEST_VIEWS = [
  'home',
  'josephine',
  'recommendations',
  'terms',
  'privacy',
  'settings',
];

// True when `view` is reachable without being signed in.
export function isGuestAllowed(view) {
  return GUEST_VIEWS.includes(view);
}
