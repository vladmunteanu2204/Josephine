# Josephine 🏔️

**Your local alpine companion for South Tyrol, Trentino and the Dolomites**

*"Your local companion in the mountains." — a warm, premium, human-first alpine experience crafted in the heart of South Tyrol.*

[![Made with React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask)](https://flask.palletsprojects.com/)
[![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20IT%20%7C%20DE-blue)](https://www.i18next.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8)](https://web.dev/progressive-web-apps/)

---

## 🌟 Overview

Josephine is a production-ready alpine companion platform featuring:
- ✨ **Smart trail recommendations** based on verified routes
- 🏔️ **Comprehensive rifugio (alpine hut) directory** with booking system
- 🥾 **Multi-day hut-to-hut trekking** with stage-by-stage planning
- 📍 **Real-time GPS tracking** with dynamic checkpoints and mountain bell alerts
- 🎬 **Cinematic trip summaries** with altitude-gradient maps and image export
- 🎮 **Gamification system** with badges, XP levels, and challenges
- 🌦️ **Weather integration** with hiking suitability scoring
- 🗺️ **Interactive maps** powered by Mapbox GL
- 🌍 **Full internationalization** (English, Italian, German)
- 📱 **Progressive Web App** with offline support
- 🎨 **Dark alpine-inspired glassmorphic UI** with cinematic design

---

## 🎯 Key Features

### Trail Discovery & Planning
- **Smart Recommendations** - Personalized trail suggestions based on preferences
- **Verified Routes** - Curated trails for South Tyrol & Trentino Alps
- **Trail Catalog** - Browse with advanced filters (difficulty, region, features)
- **Detailed Trail Pages** - Cinematic design with parallax scrolling, elevation profiles, POIs
- **Multi-Day Treks** - Plan hut-to-hut adventures with stage-by-stage breakdown
- **Hike Planner** - Multi-day itinerary builder with equipment checklists

### Alpine Hut Ecosystem
- **Rifugio Directory** - Comprehensive database of alpine huts (rifugios, malgas, bivaccos)
- **Smart Filtering** - Filter by type, region, altitude, facilities, availability
- **Detailed Hut Pages** - Facilities, pricing, contact info, seasonal status
- **Booking System** - Inquiry forms with email delivery to rifugio operators
- **Integrated Experience** - Seamless connection between trails and rifugios

### GPS & Tracking
- **Live GPS Tracking** - Real-time position updates every 20 seconds
- **Dynamic Checkpoints** - Admin-controlled waypoints with custom alert distances
- **Proximity Alerts** - Mountain bell sound effects when approaching checkpoints
- **Stats Dashboard** - Live distance, elevation, duration, progress tracking
- **Auto-pause Detection** - Intelligent pause/resume for breaks
- **Celebration Modals** - 3D confetti animations on hike completion
- **Trip Summary** - Cinematic post-hike page with altitude-gradient map, stats, badges, and image export
- **Hike History** - All completed hikes saved to profile

### Gamification & Social
- **Badge System** - 18 achievement badges (distance, peaks, trails)
- **XP & Levels** - 10 progression tiers (Beginner → Legend of the Alps)
- **Challenges** - Admin-created events with XP rewards
- **Leaderboards** - Monthly and all-time rankings (opt-in)
- **User Profiles** - Stats dashboard with total distance, elevation, hikes

### Weather & Safety
- **OpenWeatherMap Integration** - Current conditions + 7-day forecasts
- **Suitability Scoring** - AI-powered hiking safety recommendations
- **Weather Alerts** - Real-time warnings for dangerous conditions
- **Safety Disclaimers** - Legal protection before GPS tracking

### Admin Panel
- **Trail Management** - Create/edit trails, upload GPX routes
- **Checkpoint System** - Add custom waypoints with GPS coordinates, types, and alert distances
- **Rifugio CMS** - Manage alpine hut database
- **Multi-Day Trail Builder** - Visual stage creator with per-day details
- **User Management** - View all users, stats, analytics
- **Review Moderation** - Approve/reject user reviews
- **Challenge Creation** - Design and deploy gamification events
- **Analytics Dashboard** - Trail popularity, user engagement metrics
- **Booking Monitor** - Track rifugio booking inquiries

---

## 🛠 Tech Stack

### Frontend
- **React 18** - Modern hooks-based architecture
- **Vite** - Lightning-fast build tool and dev server
- **i18next** - Full internationalization (EN/IT/DE)
- **Mapbox GL** - Interactive trail and POI maps
- **Firebase Auth** - Secure user authentication (email + Google OAuth)
- **Axios** - HTTP client for API communication
- **CSS3** - Custom dark alpine glassmorphic design system

### Backend
- **Flask** - Python web framework (Python 3.11+)
- **Flask-CORS** - Cross-origin resource sharing
- **JSON Database** - Local data storage (trails, rifugios, reviews, bookings, multi-day trails)
- **OpenWeatherMap API** - Weather data integration
- **Pillow** - Image processing and compression
- **Replit Object Storage** - Persistent media file hosting

### Infrastructure
- **Progressive Web App** - Service worker with offline caching
- **Responsive Design** - Mobile-first, works on all devices
- **Component-based Navigation** - Custom state-machine routing
- **localStorage Persistence** - User preferences, saved trails, gamification data

---

## 📁 Project Structure

```
alpenvia/
├── backend/                    # Flask API (port 8000 dev, 5000 prod)
│   ├── app.py                 # Main application with all API endpoints
│   ├── requirements.txt       # Python dependencies
│   └── data/                  # JSON databases
│       ├── trails.json        # Trail catalog
│       ├── reviews.json       # User reviews
│       ├── plans.json         # Hike plans
│       ├── user_analytics.json # User stats
│       ├── rifugios.json      # Alpine huts directory
│       ├── booking_inquiries.json # Rifugio booking requests
│       └── multi_day_trails.json # Multi-day trek database
├── web-frontend/              # React app (port 5000)
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Home.jsx
│   │   │   ├── SmartRecommendations.jsx
│   │   │   ├── TrailCatalog.jsx
│   │   │   ├── TrailDetail.jsx
│   │   │   ├── Rifugios.jsx
│   │   │   ├── RifugioDetail.jsx
│   │   │   ├── MultiDayTrails.jsx
│   │   │   ├── MultiDayTrailDetail.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Challenges.jsx
│   │   │   ├── Leaderboards.jsx
│   │   │   ├── HikePlanner.jsx
│   │   │   ├── AdminPanel.jsx
│   │   │   └── admin/
│   │   │       ├── TrailManager.jsx
│   │   │       ├── RifugioManager.jsx
│   │   │       ├── MultiDayTrailsManager.jsx
│   │   │       └── ...
│   │   ├── contexts/         # React contexts
│   │   │   ├── AuthContext.jsx
│   │   │   └── ToastContext.jsx
│   │   ├── locales/          # i18n translations
│   │   │   ├── en.json
│   │   │   ├── it.json
│   │   │   └── de.json
│   │   ├── App.jsx           # Main app component
│   │   └── main.jsx          # Entry point
│   ├── public/
│   │   ├── manifest.json     # PWA manifest
│   │   └── sw.js            # Service worker
│   ├── vite.config.js        # Vite configuration
│   └── package.json          # Node dependencies
├── replit.md                 # Project state documentation
├── ROADMAP.md               # Development roadmap
└── README.md                # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### Development (Replit)

Both workflows are pre-configured:
- **Frontend**: `http://localhost:5000` (visible in preview)
- **Backend API**: `http://localhost:8000`

Just click **Run** to start both servers! 🎉

### Local Development

1. **Start Backend:**
   ```bash
   cd backend
   pip install -r requirements.txt
   python app.py
   ```

2. **Start Frontend:**
   ```bash
   cd web-frontend
   npm install
   npm run dev
   ```

3. **Open browser:**
   Navigate to `http://localhost:5000`

---

## 🔗 API Endpoints

### Core Trails
- `GET /api/health` - Health check
- `GET /api/trails` - Get all trails (filter by difficulty)
- `GET /api/trails/:id` - Get trail details
- `GET /api/trails/:id/reviews` - Get trail reviews
- `POST /api/trails/:id/reviews` - Submit review
- `POST /api/ai/recommend` - Get smart recommendations

### Rifugios (Alpine Huts)
- `GET /api/rifugios` - Get all rifugios (filter by type, region, facilities)
- `GET /api/rifugios/:id` - Get rifugio details
- `POST /api/rifugios/booking-inquiry` - Submit booking inquiry

### Multi-Day Trails
- `GET /api/multi-day-trails` - Get all multi-day treks
- `GET /api/multi-day-trails/:id` - Get trek details
- `POST /api/admin/multi-day-trails` - Create trek (admin only)
- `PUT /api/admin/multi-day-trails/:id` - Update trek (admin only)
- `DELETE /api/admin/multi-day-trails/:id` - Delete trek (admin only)

### User & Analytics
- `GET /api/user-analytics/:firebase_uid` - Get user stats
- `POST /api/user-analytics/:firebase_uid` - Update user stats
- `GET /api/hike-plans` - Get hike plans
- `POST /api/hike-plans` - Create hike plan

### Weather
- `GET /api/weather/suitability` - Get weather + hiking suitability

### Admin (Requires X-Admin-Password header)
- `POST /api/admin/trails` - Create trail
- `PUT /api/admin/trails/:id` - Update trail
- `DELETE /api/admin/trails/:id` - Delete trail
- `GET /api/admin/users` - Get all users
- `GET /api/admin/analytics` - Get platform analytics

---

## 🎨 Design Philosophy

**Dark Alpine Glassmorphism**
- Deep blacks (#0a0a0a) and dark grays evoke evening mountains
- Warm amber (#d4a574) represents alpine sunsets
- Forest greens (#2d4a3e) connect to nature
- Frosted glass cards with backdrop blur
- Subtle shadows and glowing accents
- Smooth animations and micro-interactions

**Cinematic Experience**
- Parallax scrolling hero sections
- Fade-in animations with Intersection Observer
- Dynamic elevation profile SVG drawings
- Breathing pulse animations on CTAs
- 3D celebration modals with confetti

**Mobile-First Responsive**
- Minimalist hamburger navigation
- Bottom sheets for language selection
- Touch-optimized tap targets (44x44px)
- Swipe gestures for carousels
- Optimized for Replit browser preview

---

## 🌍 Internationalization

Full support for 3 languages with **870+ translation strings**:
- 🇬🇧 **English** - Primary language
- 🇮🇹 **Italiano** - Italian
- 🇩🇪 **Deutsch** - German

**Note:** No Romanian language support (intentionally excluded per user requirements)

Auto-detection based on browser language, with manual language switcher in header.

---

## 📱 Progressive Web App

- **Installable** - Add to home screen on mobile and desktop
- **Offline Support** - Service worker with caching strategies
- **App-like Experience** - Full-screen mode, no browser chrome
- **Background Sync** - Ready for push notifications (future)
- **Fast Performance** - Optimized assets and lazy loading

---

## 🔐 Authentication & Admin

### User Authentication
- **Firebase Auth** - Email/password + Google OAuth
- **Persistent Sessions** - Auto-login on return visits
- **Protected Routes** - User-specific features (profile, saved trails)

### Admin Access
- **Email Restriction** - Only `vladmunteanu2204@gmail.com`
- **Custom Password** - Environment variable `SESSION_SECRET`
- **Admin Panel** - Full CMS for trails, rifugios, multi-day trails, users, analytics

---

## 📊 Sample Data

### Trails (10+ verified routes)
- Tre Cime di Lavaredo Loop
- Lago di Braies Circular Trail
- Sentiero del Viel del Pan
- Alpe di Siusi Meadow Walk
- Maso Corto Glacier Trail
- Seceda Ridge Walk
- And more...

### Rifugios (Sample alpine huts)
- Rifugio Auronzo
- Rifugio Bolzano
- Rifugio Puez
- Malga Fane
- And more...

### Multi-Day Trails
- **Alta Via 1** - 6-day classic Dolomites trek (Lago di Braies → Belluno)

---

## 🚀 Deployment

### Production Build

```bash
cd web-frontend
npm run build
```

Built files → `web-frontend/dist/`

### Replit Deployment
Use Replit's **Autoscale** deployment:
- Build: `npm run build`
- Run: `npm run start`
- Single Flask server serves built React app on port 5000

### Environment Variables
Required secrets:
- `SESSION_SECRET` - Admin password
- `OPENWEATHER_API_KEY` - Weather data
- `VITE_FIREBASE_*` - Firebase config
- `VITE_MAPBOX_TOKEN` - Mapbox API key

---

## 📝 Development Notes

### Admin Password
Default admin password is stored in `SESSION_SECRET` environment variable.

### Database
All data stored in JSON files under `backend/data/`. No SQL database required for MVP.

### Navigation System
Custom component-based navigation (no React Router). State managed via `currentView` in App.jsx.

### Image Storage
Replit Object Storage for persistent media files with automatic WebP compression.

---

## 🗺️ Roadmap

See [ROADMAP.md](ROADMAP.md) for detailed development plan.

**Current Status: 52% Complete**

Completed phases include:
- ✅ Core features, UI, and trail catalog
- ✅ GPS tracking with checkpoint alerts and proximity notifications
- ✅ Gamification (badges, XP, challenges, leaderboards)
- ✅ Weather integration with suitability scoring
- ✅ Full internationalization (EN/IT/DE)
- ✅ PWA capabilities
- ✅ Admin panel with analytics
- ✅ Rifugio directory with booking system
- ✅ Multi-day hut-to-hut trail system
- ✅ Dynamic checkpoints & cinematic trip summaries

**Next phases:**
- SEO optimization
- Analytics integration
- Enhanced gamification 2.0
- Social sharing features

---

## 📄 License

This project is a demonstration MVP for educational purposes.

---

## 🙏 Acknowledgments

- Trail data inspired by real South Tyrol and Trentino hiking routes
- Design inspired by premium outdoor apps (AllTrails, Komoot, Strava)
- Built for alpine hiking enthusiasts worldwide 🏔️

---

**Made with ❤️ for the Dolomites**

*Discover. Save. Plan. Book. Track. Review. Share.*
