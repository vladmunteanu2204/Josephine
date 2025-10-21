# Alpenvia 🏔️

A premium hiking web app for the South Tyrol and Trentino Alps regions, featuring smart trail recommendations, verified routes, and immersive dark alpine-inspired design.

## 🌟 Features

### Core Features
- **🏠 Home Dashboard** - Dark immersive UI with alpine-inspired design and featured trail
- **✨ Smart Recommendations** - Multi-step wizard for personalized trail suggestions from verified routes
- **📚 Trail Catalog** - Browse all verified trails with filtering by difficulty
- **📍 Detailed Trail Pages** - Hero images, stats, points of interest, and comprehensive descriptions
- **🗺️ Verified Routes Only** - All trails curated and verified for South Tyrol & Trentino Alps

### Design System
- **Dark Theme** - Deep grays (#0a0a0a), forest greens, amber accents (#d4a574)
- **Typography** - Clear hierarchy with bold headings and readable body text
- **Responsive Layout** - Works perfectly in Replit's web preview

## 🛠 Tech Stack

### Web Frontend (React + Vite)
- **React 18** - Modern React with hooks
- **Vite** - Lightning-fast development server
- **Axios** - API communication
- **CSS3** - Custom styling with CSS variables

### Backend (Flask)
- **Flask** - Lightweight Python web framework
- **Smart Recommendation Engine** - Local scoring algorithm over verified trails database
- **Flask-CORS** - Cross-origin resource sharing
- **JSON Database** - Mock trail data with 4 authentic South Tyrol trails

## 📁 Project Structure

```
alpenvia/
├── backend/                    # Flask API server (port 8000)
│   ├── app.py                 # Main Flask application with API endpoints
│   └── requirements.txt       # Python dependencies
├── web-frontend/              # React web app (port 5000)
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Header.jsx
│   │   │   ├── Home.jsx
│   │   │   ├── SmartRecommendations.jsx
│   │   │   ├── TrailCatalog.jsx
│   │   │   └── TrailDetail.jsx
│   │   ├── App.jsx            # Main app component
│   │   ├── main.jsx           # React entry point
│   │   └── index.css          # Global styles
│   ├── index.html             # HTML template
│   ├── vite.config.js         # Vite configuration
│   └── package.json           # Node dependencies
├── data/                       # Mock trail database
│   ├── trails.json            # Complete trail database (4 South Tyrol trails)
│   └── trail_segments.json    # Trail segments for recommendations
└── README.md                  # This file
```

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### Quick Start (Replit)

Both servers are already running in Replit:
- **Web Frontend**: Port 5000 (visible in preview)
- **Backend API**: Port 8000 (console only)

Just open the preview to see the app! 🎉

### Local Development

1. **Start the Backend:**
   ```bash
   cd backend
   pip install -r requirements.txt
   python app.py
   ```
   Backend runs on `http://localhost:8000`

2. **Start the Frontend:**
   ```bash
   cd web-frontend
   npm install
   npm run dev
   ```
   Frontend runs on `http://localhost:5000`

3. **Open in browser:**
   Navigate to `http://localhost:5000`

## 🔗 API Endpoints

### Health Check
```
GET /api/health
```
Returns API health status.

**Response:**
```json
{
  "ok": true,
  "service": "alpenvia",
  "status": "healthy"
}
```

### Get All Trails
```
GET /api/trails?difficulty=medium
```
Fetch trails with optional filtering by difficulty.

**Response:**
```json
{
  "trails": [...],
  "count": 4
}
```

### Get Trail by ID
```
GET /api/trails/{trail_id}
```
Fetch detailed information for a specific trail.

### Smart Recommendations (New!)
```
POST /api/ai/recommend
Content-Type: application/json

{
  "duration_hours": 4,
  "difficulty": "medium",
  "interests": ["alpine lakes", "panoramic views"],
  "start_area": "Bolzano"
}
```
Returns 3-5 recommended trails from verified routes based on user preferences.

**Scoring Algorithm:**
- +3 if trail difficulty matches request
- +2 per matching interest tag
- +2 if duration within 1 hour of request
- +1 if loop requested and trail is loop type
- +1 if start area matches trail region/name

**Response:**
```json
{
  "results": [
    {
      "id": "tre_cime",
      "name": "Tre Cime di Lavaredo Loop",
      "distance_km": 10.2,
      "duration_hours": 4.0,
      "elevation_gain_m": 450,
      "difficulty": "medium",
      "geometry": {
        "type": "LineString",
        "coordinates": [[12.2975, 46.6189], ...]
      },
      "pois": [...],
      "tags": ["panoramic views", "alpine lakes"],
      "description": "One of the most iconic hikes...",
      "thumbnail": "https://...",
      "region": "South Tyrol",
      "rating": 4.8,
      "trail_type": "loop"
    }
  ]
}
```

### Deprecated Endpoints

#### AI Route Generation (DEPRECATED)
```
POST /api/trails/generate
```
**Returns HTTP 410 Gone:**
```json
{
  "error": "route_generation_deprecated",
  "message": "Alpenvia now recommends only verified routes from our database. Please use /api/ai/recommend for personalized trail suggestions."
}
```

## 🎨 Design Philosophy

Alpenvia features a dark, immersive design inspired by the alpine environment:

- **Background Colors**: Deep blacks (#0a0a0a) and dark grays (#1a1a1a) evoke evening mountain landscapes
- **Accent Colors**: Warm amber (#d4a574) represents alpine sunsets, forest greens (#2d4a3e) connect to nature
- **Typography**: Clear hierarchy ensures readability while maintaining elegance
- **Imagery**: High-quality alpine photography creates emotional connection

## 🗺️ Mock Trail Data

The app includes 4 authentic South Tyrol trails:

1. **Tre Cime di Lavaredo Loop** - Iconic Dolomites circuit (Medium, 10.2km, 4h)
2. **Lago di Braies Circular Trail** - Stunning turquoise lake walk (Easy, 3.5km, 1.5h)
3. **Sentiero del Viel del Pan** - Historic WWI trail (Medium, 8.5km, 3.5h)
4. **Alpe di Siusi Meadow Walk** - Europe's largest alpine meadow (Easy, 5.8km, 2h)

## 🔮 Architecture Changes

### What Changed from Original Version

**Removed:**
- ❌ OpenAI API integration and dependencies
- ❌ AI route generation endpoint
- ❌ Replit AI Integrations usage
- ❌ React Native mobile app (replaced with web app)

**Added:**
- ✅ Smart recommendation engine with local scoring
- ✅ React web frontend (works in Replit preview!)
- ✅ Verified routes only approach
- ✅ HTTP 410 deprecation for AI generation

**Why the Change:**
- **Predictability**: Verified routes only, no AI-generated content
- **Cost**: No OpenAI API costs
- **Preview**: Web app works in Replit's browser preview
- **Quality**: Curated, authentic South Tyrol trails

## 📝 Environment Variables

No environment variables required! The app works out of the box.

## 🤝 Development Notes

### Testing the API

```bash
# Health check
curl http://localhost:8000/api/health

# Get recommendations
curl -X POST http://localhost:8000/api/ai/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "duration_hours": 4,
    "difficulty": "medium",
    "interests": ["alpine lakes", "panoramic views"]
  }'

# Get all trails
curl http://localhost:8000/api/trails

# Test deprecated endpoint (should return 410)
curl -X POST http://localhost:8000/api/trails/generate
```

### Building for Production

```bash
cd web-frontend
npm run build
```

The built files will be in `web-frontend/dist/`

## 🚀 Deployment

### Backend
Deploy the Flask backend to your preferred Python hosting:
- Replit Deployments
- Heroku
- Google Cloud Run
- AWS Elastic Beanstalk

### Frontend
Build and deploy the static frontend to:
- Replit Static Deployments
- Netlify
- Vercel
- GitHub Pages

## 📄 License

This project is a demonstration MVP for educational purposes.

## 🙏 Acknowledgments

- Trail data inspired by real South Tyrol hiking routes
- Design inspired by premium outdoor apps like AllTrails and Komoot
- No OpenAI integration required!

---

**Built for alpine hiking enthusiasts** 🏔️

**Now featuring:**
✓ Verified routes only
✓ Smart local recommendations
✓ Works in Replit preview
✓ No API costs
