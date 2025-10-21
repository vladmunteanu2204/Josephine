# Alpenvia 🏔️

A premium React Native hiking app for the South Tyrol and Trentino Alps regions, featuring AI-powered trail generation, Firebase authentication, and immersive dark alpine-inspired design.

## 🌟 Features

### Core MVP Features
- **🔐 Firebase Authentication** - Email/password, Google, and Apple login with hiking preferences onboarding
- **🏠 Home Dashboard** - Dark immersive UI with alpine-inspired design, CTAs for AI trail generation and exploration
- **🤖 AI Trail Generator** - Multi-step wizard that creates custom trails using OpenAI GPT-4
- **📚 Trail Catalog** - Themed collections (Alpine Lakes, Via Ferrata, Family-Friendly, etc.) with advanced filtering
- **📍 Trail Details** - Hero images, stats, interactive maps, elevation profiles, and POIs
- **👤 User Profile** - Saved trails, completed trails, personal stats, and preferences management
- **💳 Premium Subscription** - Feature comparison with Stripe checkout integration and free trial

### Premium Features (UI Implemented)
- Offline maps for all trails
- Voice navigation with turn-by-turn guidance
- Wrong-turn haptic and visual alerts
- Unlimited AI trail generation
- Live location sharing with trusted contacts
- Premium-only trail collections

## 🛠 Tech Stack

### Frontend (React Native)
- **React Native** with Expo
- **React Navigation** - Stack and bottom tab navigation
- **Firebase** - Authentication and Firestore for user data
- **React Native Maps** - Interactive trail maps
- **React Native Chart Kit** - Elevation profile visualization
- **Axios** - API communication
- **Expo Vector Icons** - Beautiful iconography

### Backend (Flask)
- **Flask** - Lightweight Python web framework
- **OpenAI API** - AI-powered trail descriptions (via Replit AI Integrations)
- **Flask-CORS** - Cross-origin resource sharing
- **SQLite/JSON** - Mock trail database

### Design System
- **Dark Theme** - Deep grays (#0a0a0a), forest greens, amber accents (#d4a574)
- **Typography** - Clear hierarchy with bold headings and readable body text
- **Smooth Animations** - React Native Reanimated for fluid transitions

## 📁 Project Structure

```
alpenvia/
├── backend/                    # Flask API server
│   ├── app.py                 # Main Flask application with API endpoints
│   └── requirements.txt       # Python dependencies
├── frontend/                   # React Native mobile app
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── TrailCard.js
│   │   │   └── CTACard.js
│   │   ├── screens/           # App screens
│   │   │   ├── AuthScreen.js
│   │   │   ├── OnboardingScreen.js
│   │   │   ├── HomeScreen.js
│   │   │   ├── ExploreScreen.js
│   │   │   ├── AIGeneratorScreen.js
│   │   │   ├── TrailDetailScreen.js
│   │   │   ├── SavedTrailsScreen.js
│   │   │   ├── ProfileScreen.js
│   │   │   └── PremiumScreen.js
│   │   ├── navigation/        # Navigation configuration
│   │   │   └── MainNavigator.js
│   │   ├── services/          # API services
│   │   │   └── api.js
│   │   ├── theme/             # Design system
│   │   │   ├── colors.js
│   │   │   └── typography.js
│   │   └── config/            # Configuration
│   │       └── firebase.js
│   ├── App.js                 # Root component
│   └── package.json           # Node dependencies
├── data/                       # Mock trail data
│   ├── trails.json            # Complete trail database (4 South Tyrol trails)
│   └── trail_segments.json    # Trail segments for AI generation
└── README.md                  # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Studio (for emulator)
- Firebase account
- Replit account (for OpenAI integration)

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables:**
   The OpenAI integration is already set up via Replit AI Integrations. The following environment variables are automatically available:
   - `AI_INTEGRATIONS_OPENAI_API_KEY`
   - `AI_INTEGRATIONS_OPENAI_BASE_URL`

4. **Start the Flask backend:**
   ```bash
   python app.py
   ```
   The backend will run on `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Firebase:**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication with Email/Password, Google, and Apple providers
   - Create a Firestore database
   - Copy your Firebase config and update `frontend/src/config/firebase.js`

4. **Update API URL (if needed):**
   If running the backend on a different host, update `frontend/src/services/api.js`:
   ```javascript
   const API_BASE_URL = 'http://YOUR_BACKEND_URL:8000/api';
   ```

5. **Start the Expo development server:**
   ```bash
   npm start
   ```

6. **Run on device/emulator:**
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app on your physical device

## 🔗 API Endpoints

### Health Check
```
GET /api/health
```
Returns the API health status.

### Get All Trails
```
GET /api/trails?difficulty=medium&duration_max=4&interest=alpine%20lakes
```
Fetch trails with optional filtering by difficulty, duration, and interests.

### Get Trail by ID
```
GET /api/trails/{trail_id}
```
Fetch detailed information for a specific trail.

### Generate AI Trail
```
POST /api/trails/generate
Content-Type: application/json

{
  "duration": 3,
  "difficulty": "medium",
  "interests": ["alpine lakes", "panoramic views"],
  "starting_area": "Bolzano"
}
```
Generates a custom trail using AI based on user preferences.

### Get Recommendations
```
POST /api/recommendations
Content-Type: application/json

{
  "preferences": {
    "skill_level": "intermediate",
    "interests": ["panoramic views"]
  },
  "location": {}
}
```
Returns personalized trail recommendations.

## 🎨 Design Philosophy

Alpenvia features a dark, immersive design inspired by the alpine environment:

- **Background Colors**: Deep blacks (#0a0a0a) and dark grays (#1a1a1a) evoke evening mountain landscapes
- **Accent Colors**: Warm amber (#d4a574) represents alpine sunsets, forest greens (#2d4a3e) connect to nature
- **Typography**: Clear hierarchy ensures readability while maintaining elegance
- **Imagery**: High-quality alpine photography creates emotional connection
- **Animations**: Smooth, subtle transitions enhance the premium feel

## 📱 User Journey

1. **Authentication** → Sign up with email or social login
2. **Onboarding** → Select skill level and interests
3. **Home Dashboard** → View recommended trail and main CTAs
4. **Explore or Generate** → Browse curated collections or create custom AI trail
5. **Trail Details** → View comprehensive trail information with maps and elevation
6. **Save & Track** → Bookmark favorites and track completed hikes
7. **Premium Upgrade** → Unlock offline maps, navigation, and more

## 🗺️ Mock Trail Data

The app includes 4 authentic South Tyrol trails:

1. **Tre Cime di Lavaredo Loop** - Iconic Dolomites circuit (Medium, 10.2km)
2. **Lago di Braies Circular Trail** - Stunning turquoise lake walk (Easy, 3.5km)
3. **Sentiero del Viel del Pan** - Historic WWI trail (Medium, 8.5km)
4. **Alpe di Siusi Meadow Walk** - Europe's largest alpine meadow (Easy, 5.8km)

## 🔮 Future Enhancements

- Live GPS navigation with turn-by-turn guidance
- Offline map downloads for Premium users
- User-generated content (reviews, photos, trail conditions)
- Achievement system and hiking statistics
- Social features (share trails, location sharing)
- Weather integration and trail condition updates
- Multi-language support (German, Italian, English)

## 🛡️ Security & Privacy

- Firebase Authentication handles secure user credentials
- API keys managed via Replit AI Integrations (no keys committed to repo)
- User data stored securely in Firestore with proper access rules
- Payment processing via Stripe (PCI compliant)

## 📝 Environment Variables

The following environment variables are automatically configured via Replit:
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API access
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL

For Firebase, update `frontend/src/config/firebase.js` with your own credentials.

## 🤝 Contributing

This is an MVP demonstration project. For production deployment:
1. Replace Firebase config with production credentials
2. Implement proper error handling and validation
3. Add comprehensive testing (Jest, Detox)
4. Set up CI/CD pipeline
5. Implement actual Stripe payment integration
6. Add proper logging and monitoring

## 📄 License

This project is a demonstration MVP for educational purposes.

## 🙏 Acknowledgments

- Trail data inspired by real South Tyrol hiking routes
- Design inspired by premium outdoor apps like AllTrails and Komoot
- OpenAI integration powered by Replit AI Integrations

---

Built with ❤️ for alpine hiking enthusiasts
