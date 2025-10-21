# Alpenvia Project State

## Overview
Alpenvia is a premium web hiking app for the South Tyrol and Trentino Alps regions. This is a complete MVP implementation featuring smart trail recommendations from a verified routes database, an immersive dark alpine-inspired UI, and a React web frontend that works perfectly in Replit's browser preview.

## Project Structure
```
alpenvia/
├── backend/          # Flask API (Python) - Port 8000
├── web-frontend/     # React web app (Vite) - Port 5000
└── data/            # Verified trail database (GeoJSON)
```

## Current State
**Status**: ✅ Complete Web MVP Implementation

All core features have been implemented:
- ✅ Flask backend API running on port 8000
- ✅ Smart local recommendation engine (no external AI)
- ✅ Verified trail database with 4 South Tyrol trails
- ✅ React web app with complete navigation
- ✅ All screens implemented (Home, Recommendations, Catalog, Detail)
- ✅ Dark alpine-inspired theme
- ✅ Works in Replit browser preview

## Recent Refactoring (October 21, 2025)
**What Changed:**
- ❌ Removed OpenAI API integration and all dependencies
- ❌ Deprecated AI route generation endpoint (now returns HTTP 410)
- ❌ Removed React Native mobile app
- ✅ Created React web frontend for browser preview
- ✅ Implemented local scoring-based recommendation algorithm
- ✅ Updated all documentation and workflows

**Why:**
- User required app to be previewable in Replit web browser
- User requested removal of OpenAI integration (use local DB only)
- Cost reduction: No external API dependencies
- Quality: Verified routes only, no AI-generated content

## Backend Status
**Running**: Backend API workflow on port 8000
**Endpoints**:
- GET /api/health - Health check ✅
- GET /api/trails - Fetch all trails with filtering ✅
- GET /api/trails/{id} - Get specific trail ✅
- POST /api/ai/recommend - Smart recommendations from DB ✅
- POST /api/trails/generate - DEPRECATED (returns 410) ⚠️

**Dependencies**: Flask, Flask-CORS
**Database**: JSON files (trails.json, trail_segments.json)

**Recommendation Algorithm:**
Scores trails based on:
- Difficulty match (+3 points)
- Interest tags (+2 per match)
- Duration proximity (+2 if within 1 hour)
- Loop preference (+1)
- Start area match (+1)

## Frontend Status
**Framework**: React 18 + Vite
**Port**: 5000 (webview preview)
**Screens Implemented**:
1. Home - Dashboard with featured trail and CTAs
2. SmartRecommendations - Multi-step wizard for personalized suggestions
3. TrailCatalog - Browse all trails with difficulty filters
4. TrailDetail - Detailed trail view with stats and POIs

**Navigation**: Component-based routing (no React Router)
**Theme**: Dark alpine-inspired (#0a0a0a background, #d4a574 amber accents)
**Dependencies**: React, Vite, Axios

## Environment Variables
None required! App works out of the box.

## Technical Notes
- Backend runs from `backend/` directory, loads data from `../data/`
- File paths resolved using `BASE_DIR` for portability
- Web frontend configured for Replit preview (host: 0.0.0.0, port: 5000)
- API tested and confirmed working on all endpoints
- Mock data includes 4 authentic South Tyrol trails
- No external API dependencies (fully local)

## Architecture
- **Backend**: Flask API serves trail data and smart recommendations
- **Frontend**: React web app for browser preview
- **Recommendations**: Local scoring algorithm over verified database
- **Database**: JSON files with GeoJSON trail data
- **No Auth**: Authentication removed for MVP simplicity
- **No Payments**: Stripe integration removed for MVP

## User Preferences
- Must be previewable in Replit web browser (not mobile-only)
- Use only local database for recommendations (no OpenAI)
- Dark alpine-inspired design theme
- Verified routes only (no AI generation)

## Next Steps for Users
1. ✅ App is ready to use in Replit preview!
2. (Optional) Add more verified trails to `data/trails.json`
3. (Optional) Implement user authentication
4. (Optional) Deploy to production (Replit Deployments)
5. (Optional) Add Firebase or PostgreSQL database
6. (Optional) Add real map tiles and interactive maps
