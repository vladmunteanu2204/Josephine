# Alpenvia Project State

## Overview
Alpenvia is a production-ready, premium multilingual hiking platform for the South Tyrol and Trentino Alps. Its core purpose is to provide smart trail recommendations, comprehensive user reviews, and full internationalization (EN/IT/DE). The platform features an immersive dark alpine-inspired glassmorphic UI, designed for optimal viewing in Replit's browser preview. The project aims to offer a high-quality, curated hiking experience based on verified trail data.

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
- **User Authentication:** Firebase Authentication (email/password, Google OAuth) is integrated for secure user management, including profile editing and password changes.
- **Persistent State:** User preferences (language, units, notifications), saved trails, gamification data (badges, XP, levels), and hike plans are persisted using `localStorage`. Saved trails store only trail IDs (not full objects) for optimal storage and data freshness.
- **Media Galleries:** A `MediaGallery` component supports photo and video display with a full-screen lightbox viewer.
- **Interactive Maps:** `Mapbox GL` is integrated for interactive trail route visualization and point-of-interest (POI) markers.
- **GPS Tracking:** Real-time GPS tracking during hikes with 20-second position updates, automatic hike end after 6 hours of inactivity, POI checkpoint alerts, and live stats display via floating panel. GPS testing requires opening app URL in new browser tab on mobile (not Replit iframe) for location permissions.
- **Gamification System:** Badge/achievement system with 18 badges across distance, peaks, and trail completion categories. XP/levels system with 10 tiers from Beginner to Legend of the Alps. Monthly and all-time leaderboards tracking user rankings and hiking statistics. Profile displays earned badges, current level, XP progress, and comprehensive hiking stats.
- **Weather Integration:** OpenWeatherMap API integration providing current conditions, 7-day forecasts, hiking suitability scores, and weather-based safety alerts. Weather widget displays on trail detail pages with temperature, wind, humidity, visibility, and precipitation forecasts. Mock data fallback for development/testing.
- **Hike Planning:** Multi-day trip planner with trail selection, itinerary builder, and trip summary calculations. Dynamic equipment checklist generator (12-20 items) adapting to difficulty, duration, and weather conditions. Personalized safety tips system with alpine-specific advice. Save/load/export functionality for trip itineraries.
- **Review System:** A comprehensive user review system allows submissions, displays star ratings, and calculates real-time statistics.
- **Trail Catalog:** Features a sticky filters sidebar, live search, multi-filter support (difficulty, tags, search), and a grid/map view toggle.
- **Navigation:** A component-based routing system manages bidirectional navigation throughout the application without using React Router.
- **Admin Panel:** Secure, password-protected admin interface for content management with backend authentication middleware. Features include: Trail CRUD operations with full metadata editor; GPX file upload with automatic parsing using Haversine formula for distance/elevation calculation; Interactive map preview for GPX routes using Mapbox; Reviews moderation panel with filtering; Challenges creation/edit/delete system. Admin endpoints (`/api/admin/*`) protected by custom `@require_admin_auth` decorator validating `X-Admin-Password` header. Frontend login validates credentials via `/api/admin/login` endpoint. Admin password stored in `ADMIN_PASSWORD` environment variable (default: `alpenvia_admin_2025`). All admin child components (TrailManager, GPXUploader, ReviewsModeration, ChallengesManager) receive and forward admin password in request headers for backend authentication.
- **Challenges System:** User-facing challenges page with progress tracking, XP rewards, completion detection, and reward claiming. Integrates with gamification system for automatic progress calculation based on hiking stats (distance, elevation, hikes). Admin can create custom challenges with configurable types (distance, elevation, hikes, specific trails), difficulty levels, XP rewards, and durations.

### Feature Specifications
- **Core Pages:** Home, Catalog, Recommendations, Trail Detail, User Profile, Saved Trails, Settings, Leaderboards, and Hike Planner.
- **Trail Data:** Enhanced schema includes taglines, galleries, thumbnails, tags, and GPS coordinates for categorization and tracking.
- **Responsiveness:** All components and pages are designed to be mobile-responsive.
- **Accessibility:** Features like ARIA labels and focus management are integrated.

### System Design Choices
- **Backend:** Flask API (Python) running on port 8000, serving trail data, recommendations, and weather data.
- **Frontend:** React 18 web application built with Vite, running on port 5000 for Replit webview preview.
- **Database:** Local JSON files (`trails.json`, `reviews.json`) store verified trail data and reviews.
- **API URL Handling:** Dynamically constructed using conditional pattern: `window.location.hostname.includes('replit.dev') ? https://${hostname} : http://localhost:8000` for cross-environment compatibility.

## External Dependencies
- **Firebase:** For user authentication (email/password, Google OAuth).
- **Mapbox GL:** For interactive map functionalities and trail visualization.
- **OpenWeatherMap API:** For real-time weather data, forecasts, and hiking suitability calculations.
- **Axios:** HTTP client for API requests in the frontend.
- **i18next, react-i18next, i18next-browser-languagedetector:** For internationalization.
- **Flask, Flask-CORS, Requests:** Python libraries for the backend API and external API calls.