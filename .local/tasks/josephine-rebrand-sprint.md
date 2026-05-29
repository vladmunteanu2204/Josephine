# Josephine Full Rebrand Sprint

## What & Why
Rebrand the app from Alpenvia to Josephine — repositioning from a heavy adventure/gamification hiking platform into a warm, premium, local alpine companion that helps people choose a beautiful mountain day in South Tyrol, Trentino and the Dolomites. This sprint covers brand identity, homepage, guide presence, theme cards, navigation hierarchy, onboarding tone and documentation. No backend, routing, auth or feature removal.

## Done looks like
- Every visible instance of "Alpenvia" in the UI, PWA metadata and docs reads "Josephine"
- The hero shows the new copy and tagline; CTAs read "Plan My Day" and "Explore Places"
- A premium Josephine guide card (glassmorphic, asset-ready, intentional placeholder) appears in the hero — not a cheap CSS circle
- The homepage mascot area added in the previous step is replaced/upgraded with this premium guide card
- ThemeCards show 9 editorial "what kind of day?" cards with warm copy in EN/IT/DE
- "Smart Recommendations" reads "Plan My Day" everywhere in the visible UI
- HamburgerMenu demotes Challenges and Leaderboards to secondary (with a brief code comment)
- Onboarding slides describe choosing a mountain day and discovering local places — no XP/leaderboard language
- README.md, ROADMAP.md, replit.md, BUSINESS_ANALYSIS.md describe Josephine with the new positioning
- All new/changed i18n strings exist in EN, IT and DE with no missing key warnings
- No backend files, routes, auth, data JSON files or existing feature components were removed

## Out of scope
- Actual 3D/illustration assets for Josephine guide (only the placeholder card is in scope)
- Implementing tag-based filtering from ThemeCard clicks (known limitation; navigation to catalog is fine)
- GPS, TrailDetail, TrailCatalog, Rifugios, AdminPanel, MultiDayTrails internal changes
- Gamification feature removal (only demote from main nav)
- Firebase, Mapbox, backend endpoint changes

## Steps

1. **Brand identity** — Replace all hardcoded "Alpenvia" strings in SplashScreen.jsx (logo text + splash.tagline i18n key), Header.jsx (logo text), Footer.jsx (copyright string). Update `web-frontend/index.html` title, `<meta name="description">` and apple-mobile-web-app-title. Update `web-frontend/public/manifest.json` name, short_name, description and remove gamification-forward features list. Update `footer.madeIn` key and add `splash.tagline` / `splash.footer` i18n values in all three locales to use new brand lines.

2. **Hero copy and CTAs** — Update i18n keys `hero.title`, `hero.subtitle`, `hero.tagline`, `hero.scrollToExplore` in all three locales with the approved copy. Update `home.smartRecommendations` → "Plan My Day", `home.browseTrailCatalog` → "Explore Places", and their *Desc variants. Add `hero.originLine` key with the South Tyrol origin line. Update the two CTA buttons in Home.jsx to use the new keys and navigate correctly ("Plan My Day" → `recommendations`, "Explore Places" → `catalog`).

3. **Josephine guide card (premium hero element)** — Remove the cheap compass-circle mascot added in the previous step (`.mascot-row`, `.mascot-avatar`, `.mascot-emoji`, `.mascot-highlight`, `.mascot-bubble`, `mascotBounce` keyframe from Home.css; the `.mascot-row` block from Home.jsx). Replace with a premium glassmorphic "Josephine guide card" component inline in Home.jsx. The card should contain: a portrait-ready left area (soft gradient placeholder with a subtle silhouette/aurora effect and a clear `/* TODO: insert Josephine illustration asset here */` comment), a right side with the guide copy, and the origin line. CSS should use atmospheric gradients, warm gold rim lighting, backdrop blur, and layered shadows — no primitive circles or faces. Respect `prefers-reduced-motion`. Mobile: card stacks to single column. Rename/repurpose the `home.mascotPrompt` key already in all three locales to `home.josephineGuide` with the new approved guide copy ("Let's find the right mountain day for you." / IT / DE).

4. **ThemeCards — "What kind of day?" editorial refactor** — Expand ThemeCards from 6 to 9 editorial cards using the approved copy and new mood categories: Lake day, Malga & food, Easy scenic walk, Dog-friendly, Romantic view, Rainy day idea, With parents, Half-day escape, Hut-to-hut inspiration. Add i18n keys for all 9 cards (`home.themeLakeDay`, `home.themeMalga`, `home.themeEasyWalk`, `home.themeDogFriendly`, `home.themeRomantic`, `home.themeRainyDay`, `home.themeParents`, `home.themeHalfDay`, `home.themeHutToHut`) with title and description variants in EN/IT/DE. Use warm editorial copy from the brief. Assign representative icons. Each card navigates to `catalog` on click — tag-filtering is out of scope but noted as a known limitation. Update ThemeCards.css if needed for the 9-card grid layout.

5. **"Plan My Day" flow rename** — Update SmartRecommendations.jsx header to use the new i18n key. Update `recommendations.title`, `recommendations.subtitle`, `nav.smartRecommendations` in all three locales. Add a supporting line key (`recommendations.supportingLine`: "Answer a few questions and Josephine will suggest a trail, rifugio or mountain idea." / IT / DE). Remove algorithm/platform language from visible copy.

6. **Navigation hierarchy** — In HamburgerMenu.jsx, move Challenges and Leaderboards out of the primary `userMenuItems` array into a `secondaryMenuItems` array that is only rendered when the user menu is open AND the user is logged in. Add a brief comment: `// Demoted from primary navigation for Josephine MVP; feature remains available via user menu`. Do not delete the routes. Keep admin access unchanged.

7. **Onboarding tone** — Update the four `onboarding.slide1–4` i18n key groups in all three locales. Slide 1: introduce Josephine and choosing a mountain day. Slide 2: local curation, rifugios and malgas. Slide 3: save favorites and easy discovery. Slide 4: South Tyrol origin and invitation to explore. Remove XP/leaderboard/performance language from all four slides. Note in the response that existing users who already dismissed onboarding will not see the updated copy (keyed off `onboardingCompleted` in localStorage).

8. **Documentation rebrand** — Rewrite README.md, ROADMAP.md, replit.md and BUSINESS_ANALYSIS.md per the brief. README: describe Josephine as a friendly local alpine companion, include "Crafted in the heart of South Tyrol, Italy." ROADMAP: reframe around 5 months (Brand+UX, Homepage+PlanMyDay, Experience detail, Content+monetisation, Polish+beta). replit.md: document current architecture, new product direction, MVP-visible vs demoted features, and Josephine's South Tyrol origin as brand trust element. BUSINESS_ANALYSIS.md: remove "Strava meets" positioning, add casual/tourist/local companion angle, keep competitor analysis and risk sections.

## Relevant files
- `web-frontend/index.html`
- `web-frontend/public/manifest.json`
- `web-frontend/src/components/SplashScreen.jsx`
- `web-frontend/src/components/SplashScreen.css`
- `web-frontend/src/components/Header.jsx`
- `web-frontend/src/components/Footer.jsx`
- `web-frontend/src/components/Home.jsx`
- `web-frontend/src/components/Home.css`
- `web-frontend/src/components/HamburgerMenu.jsx`
- `web-frontend/src/components/SmartRecommendations.jsx`
- `web-frontend/src/components/SmartRecommendations.css`
- `web-frontend/src/components/ThemeCards.jsx`
- `web-frontend/src/components/ThemeCards.css`
- `web-frontend/src/components/OnboardingWizard.jsx`
- `web-frontend/src/components/OnboardingWizard.css`
- `web-frontend/src/locales/en.json`
- `web-frontend/src/locales/it.json`
- `web-frontend/src/locales/de.json`
- `README.md`
- `ROADMAP.md`
- `replit.md`
- `BUSINESS_ANALYSIS.md`
