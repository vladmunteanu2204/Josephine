# Alpenvia Project State

## Overview
Alpenvia is a production-ready, premium multilingual hiking platform for the South Tyrol and Trentino Alps. Its core purpose is to provide smart trail recommendations, comprehensive user reviews, and full internationalization (EN/IT/DE). The platform features an immersive dark alpine-inspired glassmorphic UI with cinematic trail detail pages, designed for optimal viewing in Replit's browser preview. The project aims to offer a high-quality, curated hiking experience based on verified trail data.

**See [ROADMAP.md](./ROADMAP.md) for complete development roadmap and phase plan (42% complete - Phase 17G of 44 phases).**

## User Preferences
- Must be previewable in Replit web browser (not mobile-only)
- Use only local database for recommendations (no OpenAI)
- Dark alpine-inspired design theme
- Verified routes only (no AI generation)

## System Architecture
Alpenvia consists of a Flask backend API and a React web-frontend.

### UI/UX Decisions
The design system employs a premium dark alpine theme with glassmorphism effects, featuring frosted glass cards and backdrop blur. It incorporates dramatic hero sections with mountain silhouettes and aurora gradients, enhanced shadows for layered depth, and glowing accent colors. Smooth animations, micro-interactions, premium typography with text shadows, and topographic patterns contribute to an immersive user experience.

### Technical Implementations
- **Internationalization (i18n):** Full support for English, Italian, and German using `i18next` with browser language detection, covering all pages and over 400 translation strings including gamification, weather, and planning features.
- **Smart Recommendations:** A local, scoring-based algorithm provides personalized trail suggestions based on difficulty, tags, duration, and other preferences.
- **User Authentication:** Firebase Authentication (email/password, Google OAuth) is integrated for secure user management, including profile editing and password changes. Google Sign-In features production-ready capability-based device detection using coarse pointer + touch points OR small screen + mobile UA (avoids misclassifying touch-enabled laptops), automatic flow selection (popup for desktop, redirect for mobile), comprehensive popup-to-redirect fallback on ANY error except user cancellation, coordinated loading state management, detailed console logging for debugging, and user-friendly error messaging. Requires Replit domain added to Firebase Console authorized domains. Mobile testing requires opening app URL in new browser tab (not Replit iframe) for proper OAuth redirect flow.
- **Persistent State:** User preferences (language, units, notifications), saved trails, gamification data (badges, XP, levels), and hike plans are persisted using `localStorage`. Saved trails store only trail IDs (not full objects) for optimal storage and data freshness.
- **Media Galleries:** A `MediaGallery` component supports photo and video display with a full-screen lightbox viewer. Features advanced performance optimizations including Intersection Observer-based lazy loading (100px rootMargin for preloading), blur-up placeholders with gradient animations, and progressive image loading for optimal UX. Images load only when approaching viewport, preventing unnecessary network requests and ensuring smooth navigation.
- **Interactive Maps:** `Mapbox GL` is integrated for interactive trail route visualization and point-of-interest (POI) markers.
- **GPS Tracking:** Real-time GPS tracking during hikes with 20-second position updates, automatic hike end after 6 hours of inactivity, POI checkpoint alerts, and live stats display via floating panel. Fixed critical bug where stats weren't incrementing by using functional state update pattern with `prev` to access correct previous GPS point. GPS stats panel is fully mobile-responsive with horizontal layout spanning full width in portrait mode. Main navigation header automatically hides during active GPS tracking to provide clean full-screen tracking experience, with state managed in App.jsx (isGPSActive) and controlled via TrailDetail callbacks. Cleanup effect ensures header reappears when navigating away during active hikes. GPS testing requires opening app URL in new browser tab on mobile (not Replit iframe) for location permissions.
- **Progressive Web App (PWA):** Full PWA support with installable app experience. Features include: manifest.json with app metadata and theme colors; service worker providing offline capability, static/dynamic caching, and background sync readiness; automatic wake lock re-acquisition when page becomes visible; visibility change handling to maintain GPS tracking when switching apps or receiving calls; user notifications when app goes to background during active hikes. Users can install Alpenvia as a standalone app on mobile/desktop for native-like experience. Note: Browser GPS tracking may pause when app is fully backgrounded on some mobile devices - users should keep app in foreground for continuous tracking.
- **Gamification System:** Badge/achievement system with 18 badges across distance, peaks, and trail completion categories. XP/levels system with 10 tiers from Beginner to Legend of the Alps. Monthly and all-time leaderboards tracking user rankings and hiking statistics. Profile displays earned badges, current level, XP progress, and comprehensive hiking stats.
- **Weather Integration:** OpenWeatherMap API integration providing current conditions, 7-day forecasts, hiking suitability scores, and weather-based safety alerts. Weather widget displays on trail detail pages with temperature, wind, humidity, visibility, and precipitation forecasts. Mock data fallback for development/testing.
- **Hike Planning:** Multi-day trip planner with trail selection, itinerary builder, and trip summary calculations. Dynamic equipment checklist generator (12-20 items) adapting to difficulty, duration, and weather conditions. Personalized safety tips system with alpine-specific advice. Save/load/export functionality for trip itineraries.
- **Review System:** A comprehensive user review system allows submissions, displays star ratings, and calculates real-time statistics.
- **Trail Catalog:** Features a sticky filters sidebar, live search, multi-filter support (difficulty, tags, search), and a grid/map view toggle.
- **Cinematic Trail Detail Pages:** Immersive alpine storytelling experience with hero parallax scrolling (0.5x scroll speed), fade-in animations, and colored difficulty badges (Easy🟢/Moderate🟠/Hard🔴). Stats transformed into elevated glassmorphism cards with glowing icons and staggered pop-in animations using Intersection Observer. Dynamic SVG elevation profile with progressive line drawing animation and gradient fill (green→yellow→red). Start Hike CTA with pulse breathing animation. Animated Save/Favorite floating action button with localStorage persistence and toast feedback. Full accessibility with prefers-reduced-motion support. Design philosophy: "Opening the door of an alpine refuge — quiet, glowing, and full of promise."
- **Navigation:** A component-based routing system manages bidirectional navigation throughout the application without using React Router.
- **Admin Panel:** Secure admin interface accessible only to the site administrator (vladmunteanu2204@gmail.com) via Firebase authentication. Admin Panel link appears in the user dropdown menu (profile icon) only when logged in as the admin user. Features include: Trail Management with integrated GPX upload (allows file upload, automatic parsing using Haversine formula for distance/elevation calculation, interactive map preview using Mapbox, and auto-population of trail data); Reviews moderation panel with filtering; Challenges creation/edit/delete system with optional GPX upload for route highlighting (allows uploading challenge route for map visualization, stores route coordinates, displays interactive map preview). Admin endpoints (`/api/admin/*`) protected by custom `@require_admin_auth` decorator validating `X-Admin-Password` header. Admin password automatically provided for the authorized admin user. All admin child components (TrailManager, ReviewsModeration, ChallengesManager) receive and forward admin password in request headers for backend authentication. Non-admin users see "Access Denied" message if they attempt to access the admin panel directly.
- **Media Storage:** Replit Object Storage integration for persistent media file hosting with automatic compression. Admin can upload wallpaper (hero images), photos, and videos directly from local files via upload buttons in Trail Manager. Backend uses `replit.object-storage` Python SDK with auto-authentication. Upload endpoint (`/api/admin/upload/media`) accepts file uploads, automatically compresses them (images to WebP at 85% quality using Pillow, videos to H.264 CRF 23 with AAC audio using FFmpeg), and stores only the compressed version with unique UUIDs organized by type (wallpaper/photos/videos)—no duplicate originals stored. Compression typically achieves 30-60% file size reduction while maintaining visual quality. Admin UI displays real-time compression progress and savings percentage. Media files are served via `/api/media/{filename}` endpoint with correct MIME types. Supports multiple file uploads for photo/video galleries. Cost: ~$0.03/GB/month storage + $0.10/GB data transfer. Files persist after deployment and are backed by Google Cloud Storage for high availability.
- **Challenges System:** User-facing challenges page accessible via user dropdown menu with progress tracking, XP rewards, completion detection, and reward claiming. Integrates with gamification system for automatic progress calculation based on hiking stats (distance, elevation, hikes). Admin can create custom challenges with configurable types (distance, elevation, hikes, specific trails), difficulty levels, XP rewards, and durations. Challenges and Leaderboards links added to user dropdown for better discoverability.

### Feature Specifications
- **Core Pages:** Home, Catalog, Recommendations, Trail Detail, User Profile, Saved Trails, Settings, Leaderboards, and Hike Planner.
- **Trail Data:** Enhanced schema includes taglines, galleries, thumbnails, wallpaper (hero image), photos (comma-separated URLs), videos (comma-separated URLs), tags, and GPS coordinates for categorization and tracking.
- **Responsiveness:** All components and pages are designed to be mobile-responsive.
- **Accessibility:** Features like ARIA labels and focus management are integrated.

### System Design Choices
- **Backend:** Flask API (Python) serving trail data, recommendations, and weather data.
- **Frontend:** React 18 web application built with Vite for Replit webview preview.
- **Database:** Local JSON files (`trails.json`, `reviews.json`) store verified trail data and reviews.
- **API URL Handling:** Dynamically constructed using conditional pattern: `window.location.hostname.includes('replit.dev') ? https://${hostname} : http://localhost:8000` for cross-environment compatibility.
- **Port Configuration:**
  - **Development:** Frontend (React dev server) on port 5000, Backend (Flask) on port 8000
  - **Production/Deployment:** Single Flask server on port 5000 (serves both API and built frontend)

### Deployment Configuration
- **Deployment Type:** Autoscale deployment (automatically scales with traffic, charges only when app is being used)
- **Build Command:** `npm run build` → Runs `cd web-frontend && npm install && npm run build` (builds React frontend to dist folder)
- **Run Command:** `npm run start` → Runs `cd backend && PORT=5000 python app.py` (starts Flask with PORT=5000)
- **Port:** Flask listens on port 5000 in production (mapped to external port 80), port 8000 in development
- **Debug Mode:** Automatically disabled when PORT=5000 (production), enabled for development
- **Static File Serving:** Flask configured with `static_folder='../web-frontend/dist'` to serve built React app. Catch-all route serves `index.html` for SPA routing while preserving API endpoints.
- **Post-Deployment:** Add production domain to Firebase Console authorized domains for authentication to work correctly.

## External Dependencies
- **Firebase:** For user authentication (email/password, Google OAuth).
- **Mapbox GL:** For interactive map functionalities and trail visualization.
- **OpenWeatherMap API:** For real-time weather data, forecasts, and hiking suitability calculations.
- **Axios:** HTTP client for API requests in the frontend.
- **i18next, react-i18next, i18next-browser-languagedetector:** For internationalization.
- **Flask, Flask-CORS, Requests:** Python libraries for the backend API and external API calls.
- **Pillow:** Python image processing library for WebP compression and format conversion.
- **FFmpeg:** System-level video processing tool for H.264 video compression with AAC audio.