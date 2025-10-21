# Alpenvia Project State

## Overview
Alpenvia is a premium React Native hiking app for the South Tyrol and Trentino Alps regions. This is a complete MVP implementation featuring AI-powered trail generation, Firebase authentication, and an immersive dark alpine-inspired UI.

## Project Structure
```
alpenvia/
├── backend/          # Flask API (Python)
├── frontend/         # React Native app
├── data/            # Mock trail data (GeoJSON)
└── assets/          # Images and assets
```

## Current State
**Status**: ✅ Complete MVP Implementation

All core features have been implemented:
- ✅ Flask backend API running on port 8000
- ✅ OpenAI integration via Replit AI Integrations
- ✅ Mock trail database with 4 South Tyrol trails
- ✅ React Native app with complete navigation
- ✅ All 9 screens implemented
- ✅ Dark alpine-inspired theme
- ✅ Firebase authentication setup
- ✅ Premium subscription page

## Backend Status
**Running**: Backend API workflow on port 8000
**Endpoints**: All working correctly
- GET /api/health - Health check
- GET /api/trails - Fetch all trails with filtering
- GET /api/trails/{id} - Get specific trail
- POST /api/trails/generate - AI trail generation
- POST /api/recommendations - Get personalized recommendations

**Dependencies**: Flask, OpenAI (via Replit AI Integrations), Flask-CORS

## Frontend Status
**Framework**: React Native with Expo
**Screens Implemented**:
1. AuthScreen - Email/password and social login
2. OnboardingScreen - User preferences
3. HomeScreen - Dashboard with CTAs
4. ExploreScreen - Trail catalog with collections
5. AIGeneratorScreen - Multi-step trail wizard
6. TrailDetailScreen - Detailed trail view
7. SavedTrailsScreen - Saved trails
8. ProfileScreen - User profile
9. PremiumScreen - Subscription page

**Navigation**: Bottom tabs + Stack navigation
**Theme**: Dark alpine-inspired design (#0a0a0a background, #d4a574 amber accents)

## Environment Variables
Automatically configured via Replit:
- AI_INTEGRATIONS_OPENAI_API_KEY
- AI_INTEGRATIONS_OPENAI_BASE_URL

## User Setup Required
Users need to configure:
1. Firebase project credentials in `frontend/src/config/firebase.js`
2. Firebase Authentication providers (Email, Google, Apple)
3. Firestore database
4. Install frontend dependencies: `cd frontend && npm install`
5. Run React Native app: `npm start` then use Expo Go app

## Technical Notes
- Backend runs from `backend/` directory but loads data from `../data/`
- File paths are resolved using `BASE_DIR` for portability
- React Native app is for mobile devices, not web preview
- API tested and confirmed working on all endpoints
- Mock data includes 4 authentic South Tyrol trails

## Recent Changes
- Fixed file path loading in Flask backend to use absolute paths
- Configured workflow to run on port 8000 (backend API)
- Updated .gitignore for React Native and Firebase
- Created comprehensive README with setup instructions

## Next Steps for Users
1. Set up Firebase project and update config
2. Install frontend dependencies
3. Test mobile app with Expo
4. (Optional) Deploy backend to production
5. (Optional) Implement actual Stripe integration
6. (Optional) Add real map tiles and offline support

## Architecture
- **Backend**: Flask API serves trail data and AI generation
- **Frontend**: React Native mobile app (iOS/Android)
- **AI**: OpenAI GPT-4 via Replit AI Integrations
- **Auth**: Firebase Authentication
- **Database**: Mock JSON files (production would use PostgreSQL/Firestore)
- **Maps**: React Native Maps (Mapbox or Google Maps)

## User Preferences
None specified yet. This is a new project.
