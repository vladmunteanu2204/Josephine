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
- **Internationalization (i18n):** Full support for English, Italian, and German using `i18next` with browser language detection, covering all pages and over 240 strings.
- **Smart Recommendations:** A local, scoring-based algorithm provides personalized trail suggestions based on difficulty, tags, duration, and other preferences.
- **User Authentication:** Firebase Authentication (email/password, Google OAuth) is integrated for secure user management, including profile editing and password changes.
- **Persistent State:** User preferences (language, units, notifications) and saved trails are persisted using `localStorage`.
- **Media Galleries:** A `MediaGallery` component supports photo and video display with a full-screen lightbox viewer.
- **Interactive Maps:** `Mapbox GL` is integrated for interactive trail route visualization and point-of-interest (POI) markers.
- **Review System:** A comprehensive user review system allows submissions, displays star ratings, and calculates real-time statistics.
- **Trail Catalog:** Features a sticky filters sidebar, live search, multi-filter support (difficulty, tags, search), and a grid/map view toggle.
- **Navigation:** A component-based routing system manages bidirectional navigation throughout the application without using React Router.

### Feature Specifications
- **Core Pages:** Home, Catalog, Recommendations, Trail Detail, User Profile, Saved Trails, and Settings.
- **Trail Data:** Enhanced schema includes taglines, galleries, thumbnails, and tags for categorization.
- **Responsiveness:** All components and pages are designed to be mobile-responsive.
- **Accessibility:** Features like ARIA labels and focus management are integrated.

### System Design Choices
- **Backend:** Flask API (Python) running on port 8000, serving trail data and recommendations.
- **Frontend:** React 18 web application built with Vite, running on port 5000 for Replit webview preview.
- **Database:** Local JSON files (`trails.json`, `reviews.json`) store verified trail data and reviews.
- **API URL Handling:** Dynamically constructed using `window.location.protocol` + hostname + `:8000` for Replit environment compatibility.

## External Dependencies
- **Firebase:** For user authentication (email/password, Google OAuth).
- **Mapbox GL:** For interactive map functionalities and trail visualization.
- **Axios:** HTTP client for API requests in the frontend.
- **i18next, react-i18next, i18next-browser-languagedetector:** For internationalization.
- **Flask, Flask-CORS:** Python libraries for the backend API.