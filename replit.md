# Alpenvia Project State

## Overview
Alpenvia is a production-ready, premium multilingual hiking platform for the South Tyrol and Trentino Alps. Its core purpose is to provide smart trail recommendations, comprehensive user reviews, and full internationalization (EN/IT/DE). The platform features an immersive dark alpine-inspired glassmorphic UI with cinematic trail detail pages, designed for optimal viewing in Replit's browser preview. The project aims to offer a high-quality, curated hiking experience based on verified trail data.

## User Preferences
- Must be previewable in Replit web browser (not mobile-only)
- Use only local database for recommendations (no OpenAI)
- Dark alpine-inspired design theme
- Verified routes only (no AI generation)

## System Architecture
Alpenvia consists of a Flask backend API and a React web-frontend.

### UI/UX Decisions
The design system employs a premium dark alpine theme with glassmorphism effects, featuring frosted glass cards and backdrop blur. It incorporates dramatic hero sections with mountain silhouettes and aurora gradients, enhanced shadows for layered depth, and glowing accent colors. Smooth animations, micro-interactions, premium typography with text shadows, and topographic patterns contribute to an immersive user experience. The mobile UI is minimalist, mobile-first, and fully internationalized.

**3D Icon System:** All UI icons follow a cohesive "realistic alpine" visual language with sunset/golden hour aesthetic. The complete icon suite (15 assets) features 3D-rendered mountains, UI elements, and navigation symbols with warm orange-pink gradients, consistent drop-shadow effects (0 2px 6px rgba(0,0,0,0.35)), and standardized sizing (32-48px). Icons are stored in `/web-frontend/public/assets/icons/3d/` with the naming pattern `icon-[feature]-3d.png`. This replaces all previous emoji-based icons across Header, HamburgerMenu, and SplashScreen components, creating a unified premium brand identity aligned with the alpine sunset theme.

### Technical Implementations
- **Internationalization (i18n):** Full support for English, Italian, and German using `i18next` with browser language detection.
- **Smart Recommendations:** A local, scoring-based algorithm provides personalized trail suggestions.
- **User Authentication:** Firebase Authentication (email/password, Google OAuth) for secure user management.
- **Persistent State:** User preferences, saved trails, gamification data, and hike plans are persisted using `localStorage`.
- **Media Galleries:** `MediaGallery` component with performance optimizations like lazy loading and progressive image loading.
- **Interactive Maps:** `Mapbox GL` for interactive trail route visualization and POI markers.
- **GPS Tracking:** Real-time GPS tracking with position updates, checkpoint proximity alerts with mountain bell sound, and live stats display.
- **Progressive Web App (PWA):** Full PWA support with installable app experience, offline capability, and background sync readiness.
- **Gamification System:** Badge/achievement system, XP/levels system, and leaderboards.
- **Weather Integration:** OpenWeatherMap API for current conditions, forecasts, and safety alerts.
- **Hike Planning:** Multi-day trip planner with itinerary builder, equipment checklist, and safety tips.
- **Review System:** Comprehensive user review system with star ratings.
- **Trail Catalog:** Sticky filters sidebar, live search, multi-filter support, and grid/map view toggle.
- **Cinematic Trail Detail Pages:** Immersive design with parallax scrolling, fade-in animations, dynamic SVG elevation profile, and interactive elements.
- **Admin Panel:** Secure interface for trail management (with GPX upload), review moderation, challenges creation, user plan management, user management, trail analytics, and gamification statistics. Protected by custom authentication.
- **Media Storage:** Replit Object Storage integration for persistent media file hosting with automatic compression (WebP for images, H.264 for videos).
- **Challenges System:** User-facing challenges with progress tracking, XP rewards, and integration with the gamification system.
- **Rifugio Directory:** Comprehensive alpine hut database with browse/filter interface, detail pages with facilities/pricing/contact, and booking inquiry system with email delivery. Supports rifugio, malga, and bivacco types with seasonal status tracking (open/closed/opening soon).
- **Multi-Day Trails System (Hut-to-Hut):** Complete system for managing and browsing multi-day alpine treks. Admin panel includes visual stage builder with per-day details (distance, elevation, duration, difficulty, overnight rifugio). User-facing features include browse catalog with filters, detailed trail pages with day-by-day breakdown, integrated equipment checklists, and seamless rifugio booking integration. Supports point-to-point, loop, and out-and-back trail types. Fully internationalized with complete EN/IT/DE translations.
- **Dynamic Checkpoints & Trip Summary:** Admin-controlled trail checkpoints with GPS proximity alerts and mountain bell audio cues. Cinematic post-hike trip summary page with altitude-gradient route map (green→yellow→red), stats cards, badges earned, visited checkpoints with timestamps, journal notes, and image export functionality. Fully internationalized with complete EN/IT/DE translations.

### Feature Specifications
- **Core Pages:** Home, Catalog, Recommendations, Trail Detail, User Profile, Saved Trails, Settings, Leaderboards, Hike Planner, Rifugios Directory, Rifugio Detail, Multi-Day Trails Catalog, and Multi-Day Trail Detail.
- **Trail Data:** Enhanced schema including taglines, galleries, thumbnails, wallpaper, photos, videos, tags, and GPS coordinates.
- **Multi-Day Trail Data:** Stage-based schema with per-day distance, elevation, duration, difficulty, overnight rifugio, and descriptions. Supports trail type classification (point-to-point, loop, out-and-back).
- **Responsiveness:** All components are mobile-responsive.
- **Accessibility:** ARIA labels and focus management integrated.

### System Design Choices
- **Backend:** Flask API (Python).
- **Frontend:** React 18 web application built with Vite.
- **Database:** Local JSON files (`trails.json`, `reviews.json`, `plans.json`, `user_analytics.json`, `rifugios.json`, `booking_inquiries.json`, `multi_day_trails.json`) for data storage.
- **API URL Handling:** Dynamically constructed for cross-environment compatibility.
- **Port Configuration:** Development: Frontend on 5000, Backend on 8000. Production: Single Flask server on 5000.
- **Deployment Configuration:** Autoscale deployment with `npm run build` and `npm run start` commands. Flask serves built React app.

## External Dependencies
- **Firebase:** User authentication.
- **Mapbox GL:** Interactive maps.
- **OpenWeatherMap API:** Weather data and forecasts.
- **Axios:** HTTP client for frontend.
- **i18next, react-i18next, i18next-browser-languagedetector:** Internationalization.
- **Flask, Flask-CORS, Requests:** Backend API and external API calls.
- **Pillow:** Image processing (compression, format conversion).
- **FFmpeg:** Video processing (compression).