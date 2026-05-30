from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import os
import json
import random
import io
import fcntl
from datetime import datetime
from functools import wraps
from weather_service import weather_service
from replit.object_storage import Client as ObjectStorageClient
from PIL import Image
import subprocess
import tempfile
import uuid

# Configure Flask to serve static files from the built React frontend
app = Flask(__name__, 
            static_folder='../web-frontend/dist',
            static_url_path='')
CORS(app)

# Initialize Object Storage client
try:
    storage_client = ObjectStorageClient()
except Exception as e:
    print(f"Warning: Object Storage not initialized: {e}")
    storage_client = None

# Admin authentication — no fallback; server refuses to start without this env var
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')
if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD environment variable must be set before starting the server")

def require_admin_auth(f):
    """Decorator to require admin authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('X-Admin-Password')
        if not auth_header or auth_header != ADMIN_PASSWORD:
            return jsonify({'error': 'Unauthorized - Invalid admin credentials'}), 401
        return f(*args, **kwargs)
    return decorated_function

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def atomic_json_write(path, data):
    """Write JSON to path with an exclusive file lock to prevent corruption."""
    with open(path, 'a+') as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            with open(path, 'w') as f:
                json.dump(data, f, indent=2)
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)
MULTI_DAY_TRAILS_FILE = os.path.join(BASE_DIR, 'backend', 'data', 'multi_day_trails.json')

def load_trail_segments():
    """Load trail segments from the mock database"""
    segments_path = os.path.join(BASE_DIR, 'data', 'trail_segments.json')
    with open(segments_path, 'r') as f:
        return json.load(f)

def load_complete_trails():
    """Load complete trail data"""
    trails_path = os.path.join(BASE_DIR, 'data', 'trails.json')
    with open(trails_path, 'r') as f:
        return json.load(f)

def load_reviews():
    """Load reviews data"""
    reviews_path = os.path.join(BASE_DIR, 'data', 'reviews.json')
    with open(reviews_path, 'r') as f:
        return json.load(f)

def compress_image(file_data, filename):
    """
    Compress image to WebP format with 85% quality.
    Returns compressed image data and new filename with .webp extension.
    """
    try:
        # Open image from bytes
        img = Image.open(io.BytesIO(file_data))
        
        # Convert RGBA to RGB if necessary (WebP doesn't support transparency well)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
            img = background
        
        # Compress to WebP
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=85, method=6)
        output.seek(0)
        
        # Change extension to .webp
        base_name = os.path.splitext(filename)[0]
        new_filename = f"{base_name}.webp"
        
        return output.read(), new_filename
    except Exception as e:
        print(f"Image compression error: {str(e)}")
        # Return original if compression fails
        return file_data, filename

def compress_video(file_data, filename):
    """
    Compress video using FFmpeg with H.264 codec, CRF 23 for high quality.
    Returns compressed video data and filename.
    """
    try:
        # Create temporary files for input and output
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as input_file:
            input_path = input_file.name
            input_file.write(file_data)
        
        # Output file with .mp4 extension
        output_path = tempfile.mktemp(suffix='.mp4')
        
        # FFmpeg command for high-quality compression
        # CRF 23 is visually lossless, lower = better quality but larger file
        # preset 'medium' balances speed and compression
        command = [
            'ffmpeg',
            '-i', input_path,
            '-c:v', 'libx264',       # H.264 video codec
            '-crf', '23',            # Quality (18-28, 23 is high quality)
            '-preset', 'medium',     # Encoding speed vs compression
            '-c:a', 'aac',           # AAC audio codec
            '-b:a', '128k',          # Audio bitrate
            '-movflags', '+faststart',  # Enable web streaming
            '-y',                    # Overwrite output
            output_path
        ]
        
        # Run FFmpeg
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr.decode()}")
            os.unlink(input_path)
            return file_data, filename
        
        # Read compressed video
        with open(output_path, 'rb') as f:
            compressed_data = f.read()
        
        # Cleanup
        os.unlink(input_path)
        os.unlink(output_path)
        
        # Change extension to .mp4
        base_name = os.path.splitext(filename)[0]
        new_filename = f"{base_name}.mp4"
        
        return compressed_data, new_filename
        
    except Exception as e:
        print(f"Video compression error: {str(e)}")
        # Cleanup on error
        try:
            os.unlink(input_path)
            if os.path.exists(output_path):
                os.unlink(output_path)
        except:
            pass
        # Return original if compression fails
        return file_data, filename

def process_trail_media(trail):
    """
    Process trail media fields:
    - Convert comma-separated 'photos' string to 'gallery' array
    - Convert comma-separated 'videos' string to array
    - Preserve existing arrays if already present
    - Keep 'wallpaper' as single string
    - Populate 'thumbnail' if empty (use wallpaper or first photo)
    """
    if not trail:
        return trail
    
    # Parse photos into gallery array (or keep existing array)
    photos_field = trail.get('photos', '')
    if isinstance(photos_field, list):
        # Already an array, use as gallery
        trail['gallery'] = photos_field
    elif isinstance(photos_field, str) and photos_field.strip():
        # Comma-separated string, parse it
        trail['gallery'] = [url.strip() for url in photos_field.split(',') if url.strip()]
    elif 'gallery' not in trail:
        # No photos field and no existing gallery, default to empty
        trail['gallery'] = []
    # else: gallery already exists, leave it unchanged
    
    # Parse videos into array (or keep existing array)
    videos_field = trail.get('videos', '')
    if isinstance(videos_field, list):
        # Already an array, keep it
        trail['videos'] = videos_field
    elif isinstance(videos_field, str) and videos_field.strip():
        # Comma-separated string, parse it
        trail['videos'] = [url.strip() for url in videos_field.split(',') if url.strip()]
    elif 'videos' not in trail:
        # No videos field, default to empty
        trail['videos'] = []
    # else: videos already exists as array, leave it unchanged
    
    # Ensure thumbnail is set (fallback to wallpaper or first photo)
    if not trail.get('thumbnail'):
        if trail.get('wallpaper'):
            trail['thumbnail'] = trail['wallpaper']
        elif trail.get('gallery') and len(trail['gallery']) > 0:
            trail['thumbnail'] = trail['gallery'][0]
    
    return trail

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'ok': True, 'service': 'alpenvia', 'status': 'healthy'})

@app.route('/api/trails', methods=['GET'])
def get_trails():
    """Get all trails with optional filtering"""
    trails = load_complete_trails()
    
    difficulty = request.args.get('difficulty')
    duration_max = request.args.get('duration_max', type=float)
    interest = request.args.get('interest')
    
    filtered_trails = trails['trails']
    
    if difficulty:
        filtered_trails = [t for t in filtered_trails if t['difficulty'].lower() == difficulty.lower()]
    
    if duration_max:
        filtered_trails = [t for t in filtered_trails if t['duration_hours'] <= duration_max]
    
    if interest:
        filtered_trails = [t for t in filtered_trails if interest.lower() in [i.lower() for i in t['interests']]]
    
    # Process media fields for all trails
    processed_trails = [process_trail_media(t) for t in filtered_trails]
    
    return jsonify({'trails': processed_trails, 'count': len(processed_trails)})

@app.route('/api/trails/<trail_id>', methods=['GET'])
def get_trail(trail_id):
    """Get a specific trail by ID"""
    trails = load_complete_trails()
    trail = next((t for t in trails['trails'] if t['id'] == trail_id), None)
    
    if not trail:
        return jsonify({'error': 'Trail not found'}), 404
    
    # Process media fields
    trail = process_trail_media(trail)
    
    return jsonify(trail)

@app.route('/api/trails/generate', methods=['POST'])
def generate_trail():
    """
    DEPRECATED: AI route generation has been retired.
    Alpenvia now recommends only verified routes from our database.
    Use POST /api/ai/recommend instead for smart recommendations.
    """
    return jsonify({
        'error': 'route_generation_deprecated',
        'message': 'Alpenvia now recommends only verified routes from our database. Please use /api/ai/recommend for personalized trail suggestions.'
    }), 410

@app.route('/api/ai/recommend', methods=['POST'])
@app.route('/api/recommendations', methods=['POST'])
def get_recommendations():
    """
    Smart recommendation engine using local database scoring.
    Scores trails based on difficulty, interests, duration, dog-friendly and location.
    Returns top 3-5 verified trails with Josephine reasoning text.
    """
    try:
        data = request.json or {}

        duration_hours = data.get('duration_hours', data.get('duration', 3))
        difficulty = data.get('difficulty', 'medium')
        interests = data.get('interests', [])
        with_dog = 'dog-friendly' in interests
        mood_interests = [i for i in interests if i != 'dog-friendly']
        start_area = data.get('start_area', data.get('starting_area', ''))

        trails = load_complete_trails()['trails']

        scored_trails = []
        for trail in trails:
            score = 0
            reasons = []

            # Difficulty match — highest weight
            if trail['difficulty'].lower() == difficulty.lower():
                score += 4
                reasons.append(f"{difficulty} difficulty")
            elif (difficulty == 'medium' and trail['difficulty'] == 'easy') or \
                 (difficulty == 'hard'   and trail['difficulty'] == 'medium'):
                score += 1  # adjacent difficulty partial credit

            # Duration match — penalise large gaps
            duration_diff = abs(trail['duration_hours'] - duration_hours)
            if duration_diff <= 0.5:
                score += 3
                reasons.append(f"fits your {duration_hours}h window perfectly")
            elif duration_diff <= 1.5:
                score += 2
                reasons.append(f"close to your {duration_hours}h window")

            # Interest / mood matching against trail interests array
            trail_interests = [i.lower() for i in trail.get('interests', [])]
            for interest in mood_interests:
                if interest.lower() in trail_interests:
                    score += 2
                    reasons.append(interest)

            # Loop type
            if 'loop' in mood_interests and trail.get('trail_type', '').lower() == 'loop':
                score += 2

            # Dog-friendly — hard filter: exclude if requested but not available
            if with_dog:
                if trail.get('dog_friendly'):
                    score += 3
                    reasons.append("dog-friendly")
                else:
                    score -= 10  # effectively excludes it

            # Location / start area — raised weight so it actually matters
            if start_area:
                region_match = start_area.lower() in trail.get('region', '').lower()
                name_match   = start_area.lower() in trail.get('name', '').lower()
                if region_match or name_match:
                    score += 4
                    reasons.append(f"near {start_area}")

            scored_trails.append({'trail': trail, 'score': score, 'reasons': reasons})

        scored_trails.sort(key=lambda x: x['score'], reverse=True)
        top_scored = scored_trails[:5]

        results = []
        for i, item in enumerate(top_scored):
            trail = process_trail_media(item['trail'])
            reasons = item['reasons']

            # Build Josephine's reasoning blurb
            if i == 0:
                if reasons:
                    reason_str = " · ".join(dict.fromkeys(reasons))  # deduplicate, keep order
                    josephine_note = f"My top pick for you — {reason_str}. You're going to love it."
                else:
                    josephine_note = "This one just feels right for today. Trust me on this."
            else:
                if reasons:
                    reason_str = " · ".join(dict.fromkeys(reasons))
                    josephine_note = f"Also great — {reason_str}."
                else:
                    josephine_note = "A solid alternative worth considering."

            coords_list = trail.get('coordinates', [])
            pois_formatted = [
                {
                    'type': poi.get('type', 'viewpoint'),
                    'name': poi.get('name', ''),
                    'coord': poi.get('coordinates', [0, 0]),
                    'message': poi.get('description', '')
                }
                for poi in trail.get('pois', [])
            ]

            # Resolve best image: wallpaper > gallery[0] > image_url
            best_image = (
                trail.get('wallpaper') or
                (trail.get('gallery') or [None])[0] or
                trail.get('image_url') or
                trail.get('thumbnail') or
                ''
            )

            results.append({
                'id': trail['id'],
                'name': trail['name'],
                'distance_km': trail['distance_km'],
                'duration_hours': trail['duration_hours'],
                'elevation_gain_m': trail['elevation_gain_m'],
                'difficulty': trail['difficulty'],
                'geometry': {'type': 'LineString', 'coordinates': coords_list},
                'pois': pois_formatted,
                'tags': trail.get('interests', []),
                'description': trail.get('description', ''),
                'wallpaper': best_image,
                'thumbnail': best_image,
                'image_url': trail.get('image_url', ''),
                'region': trail.get('region', ''),
                'rating': trail.get('rating', 0),
                'trail_type': trail.get('trail_type', ''),
                'dog_friendly': trail.get('dog_friendly', False),
                'josephine_note': josephine_note,
            })

        return jsonify({'results': results})

    except Exception as e:
        print(f"Error in recommendations: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/trails/<trail_id>/reviews', methods=['GET'])
def get_trail_reviews(trail_id):
    """Get reviews for a specific trail"""
    try:
        reviews_data = load_reviews()
        trail_reviews = reviews_data['reviews'].get(trail_id, [])
        trail_stats = reviews_data['statistics'].get(trail_id, {
            'average_rating': 0,
            'total_reviews': 0
        })
        
        return jsonify({
            'reviews': trail_reviews,
            'statistics': trail_stats
        })
    except Exception as e:
        print(f"Error loading reviews: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/trails/<trail_id>/reviews', methods=['POST'])
def add_trail_review(trail_id):
    """Add a new review for a trail (mock implementation)"""
    try:
        data = request.json or {}
        
        new_review = {
            'id': f"rev_{trail_id}_{datetime.now().timestamp()}",
            'trail_id': trail_id,
            'user_name': data.get('user_name', 'Anonymous'),
            'rating': data.get('rating', 5),
            'comment': data.get('comment', ''),
            'date': datetime.now().strftime('%Y-%m-%d'),
            'helpful_count': 0
        }
        
        return jsonify({
            'success': True,
            'review': new_review,
            'message': 'Review submitted successfully'
        }), 201
    except Exception as e:
        print(f"Error adding review: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/hikes/save', methods=['POST'])
def save_hike():
    """Save a completed hike"""
    try:
        hike_data = request.json
        
        if not hike_data:
            print("❌ No hike data received")
            return jsonify({'error': 'No hike data provided'}), 400
        
        data_dir = os.path.join(BASE_DIR, 'data')
        hikes_path = os.path.join(data_dir, 'completed_hikes.json')
        
        # Ensure data directory exists
        os.makedirs(data_dir, exist_ok=True)
        print(f"✅ Data directory ensured: {data_dir}")
        
        # Load existing hikes or create new structure
        if os.path.exists(hikes_path):
            print(f"📂 Loading existing hikes from: {hikes_path}")
            with open(hikes_path, 'r') as f:
                hikes = json.load(f)
        else:
            print(f"📝 Creating new hikes file: {hikes_path}")
            hikes = {'hikes': []}
        
        # Add new hike
        hike_entry = {
            'id': f"hike-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            'trail_id': hike_data.get('trail_id'),
            'trail_name': hike_data.get('trail_name'),
            'start_time': hike_data.get('start_time'),
            'end_time': hike_data.get('end_time'),
            'stats': hike_data.get('stats'),
            'gps_track': hike_data.get('gps_track', []),
            'visited_checkpoints': hike_data.get('visited_checkpoints', [])
        }
        
        hikes['hikes'].append(hike_entry)
        print(f"✅ Added hike: {hike_entry['id']} for trail: {hike_entry['trail_name']}")
        
        # Save back to file
        atomic_json_write(hikes_path, hikes)
        
        print(f"💾 Saved {len(hikes['hikes'])} total hikes to: {hikes_path}")
        
        return jsonify({'success': True, 'hike_id': hike_entry['id']})
    
    except Exception as e:
        error_msg = f"Error saving hike: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': error_msg}), 500

@app.route('/api/hikes', methods=['GET'])
def get_hikes():
    """Get all completed hikes"""
    try:
        hikes_path = os.path.join(BASE_DIR, 'data', 'completed_hikes.json')
        
        if not os.path.exists(hikes_path):
            return jsonify({'hikes': [], 'count': 0})
        
        with open(hikes_path, 'r') as f:
            hikes = json.load(f)
        
        return jsonify({'hikes': hikes.get('hikes', []), 'count': len(hikes.get('hikes', []))})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/weather/current', methods=['GET'])
def get_current_weather():
    """Get current weather for trail coordinates"""
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        
        if not lat or not lon:
            return jsonify({'error': 'Latitude and longitude required'}), 400
        
        weather = weather_service.get_current_weather(lat, lon)
        return jsonify(weather)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/weather/forecast', methods=['GET'])
def get_weather_forecast():
    """Get 7-day forecast for trail coordinates"""
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        
        if not lat or not lon:
            return jsonify({'error': 'Latitude and longitude required'}), 400
        
        forecast = weather_service.get_forecast(lat, lon)
        return jsonify({'forecast': forecast})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/weather/suitability', methods=['GET'])
def get_weather_suitability():
    """Get weather suitability for hiking"""
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        difficulty = request.args.get('difficulty', 'moderate')
        
        if not lat or not lon:
            return jsonify({'error': 'Latitude and longitude required'}), 400
        
        current_weather = weather_service.get_current_weather(lat, lon)
        forecast = weather_service.get_forecast(lat, lon)
        alerts = weather_service.get_weather_alerts(current_weather, forecast)
        suitability = weather_service.get_trail_suitability(current_weather, difficulty)
        
        return jsonify({
            'current': current_weather,
            'forecast': forecast,
            'alerts': alerts,
            'suitability': suitability
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== ADMIN API ENDPOINTS =====

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Verify admin password"""
    password = request.json.get('password')
    if password == ADMIN_PASSWORD:
        return jsonify({'success': True, 'message': 'Login successful'})
    return jsonify({'success': False, 'message': 'Invalid password'}), 401

@app.route('/api/admin/trails', methods=['POST'])
@require_admin_auth
def create_trail():
    """Create a new trail (Admin)"""
    try:
        trail_data = request.json
        trails = load_complete_trails()
        
        if any(t['id'] == trail_data['id'] for t in trails['trails']):
            return jsonify({'error': 'Trail ID already exists'}), 400
        
        trails['trails'].append(trail_data)
        
        trails_path = os.path.join(BASE_DIR, 'data', 'trails.json')
        atomic_json_write(trails_path, trails)
        
        return jsonify({'success': True, 'trail': trail_data}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/trails/<trail_id>', methods=['PUT'])
@require_admin_auth
def update_trail(trail_id):
    """Update an existing trail (Admin)"""
    try:
        trail_data = request.json
        trails = load_complete_trails()
        
        trail_index = next((i for i, t in enumerate(trails['trails']) if t['id'] == trail_id), None)
        if trail_index is None:
            return jsonify({'error': 'Trail not found'}), 404
        
        trails['trails'][trail_index] = trail_data
        
        trails_path = os.path.join(BASE_DIR, 'data', 'trails.json')
        atomic_json_write(trails_path, trails)
        
        return jsonify({'success': True, 'trail': trail_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/trails/<trail_id>', methods=['DELETE'])
@require_admin_auth
def delete_trail(trail_id):
    """Delete a trail (Admin)"""
    try:
        trails = load_complete_trails()
        original_count = len(trails['trails'])
        trails['trails'] = [t for t in trails['trails'] if t['id'] != trail_id]
        
        if len(trails['trails']) == original_count:
            return jsonify({'error': 'Trail not found'}), 404
        
        trails_path = os.path.join(BASE_DIR, 'data', 'trails.json')
        atomic_json_write(trails_path, trails)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/gpx/parse', methods=['POST'])
@require_admin_auth
def parse_gpx():
    """Parse GPX file and extract trail data (Admin)"""
    try:
        import xml.etree.ElementTree as ET
        from math import radians, sin, cos, sqrt, atan2
        
        gpx_content = request.json.get('gpxContent')
        if not gpx_content:
            return jsonify({'error': 'No GPX content provided'}), 400
        
        root = ET.fromstring(gpx_content)
        ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}
        
        track_points = []
        for trkpt in root.findall('.//gpx:trkpt', ns):
            lat = float(trkpt.get('lat'))
            lon = float(trkpt.get('lon'))
            ele = trkpt.find('gpx:ele', ns)
            elevation = float(ele.text) if ele is not None else 0
            track_points.append({'lat': lat, 'lon': lon, 'ele': elevation})
        
        if not track_points:
            return jsonify({'error': 'No track points found in GPX'}), 400
        
        coordinates = [[pt['lon'], pt['lat']] for pt in track_points]
        
        total_distance = 0
        elevation_gain = 0
        elevations = [pt['ele'] for pt in track_points]
        
        for i in range(1, len(track_points)):
            lat1, lon1 = radians(track_points[i-1]['lat']), radians(track_points[i-1]['lon'])
            lat2, lon2 = radians(track_points[i]['lat']), radians(track_points[i]['lon'])
            dlat, dlon = lat2 - lat1, lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            total_distance += 6371 * c
            
            if track_points[i]['ele'] > track_points[i-1]['ele']:
                elevation_gain += track_points[i]['ele'] - track_points[i-1]['ele']
        
        return jsonify({
            'total_points': len(track_points),
            'distance': round(total_distance, 2),
            'elevation_gain': round(elevation_gain, 0),
            'min_elevation': round(min(elevations), 0),
            'max_elevation': round(max(elevations), 0),
            'route': {
                'type': 'Feature',
                'geometry': {
                    'type': 'LineString',
                    'coordinates': coordinates
                }
            }
        })
    except Exception as e:
        return jsonify({'error': f'GPX parsing failed: {str(e)}'}), 500

@app.route('/api/admin/reviews/<review_id>', methods=['DELETE'])
@require_admin_auth
def delete_review(review_id):
    """Delete a review (Admin)"""
    try:
        trail_id = request.json.get('trail_id')
        if not trail_id:
            return jsonify({'error': 'trail_id required'}), 400
        
        return jsonify({'success': True, 'message': 'Review deletion not yet implemented in backend persistence'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Challenges Management
challenges_data = {
    'challenges': []
}

@app.route('/api/challenges', methods=['GET'])
def get_challenges():
    """Get all challenges"""
    return jsonify(challenges_data)

@app.route('/api/admin/challenges', methods=['POST'])
@require_admin_auth
def create_challenge():
    """Create a new challenge (Admin)"""
    try:
        challenge_data = request.json
        if any(c['id'] == challenge_data['id'] for c in challenges_data['challenges']):
            return jsonify({'error': 'Challenge ID already exists'}), 400
        
        challenges_data['challenges'].append(challenge_data)
        return jsonify({'success': True, 'challenge': challenge_data}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/challenges/<challenge_id>', methods=['PUT'])
@require_admin_auth
def update_challenge(challenge_id):
    """Update a challenge (Admin)"""
    try:
        challenge_data = request.json
        idx = next((i for i, c in enumerate(challenges_data['challenges']) if c['id'] == challenge_id), None)
        if idx is None:
            return jsonify({'error': 'Challenge not found'}), 404
        
        challenges_data['challenges'][idx] = challenge_data
        return jsonify({'success': True, 'challenge': challenge_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/challenges/<challenge_id>', methods=['DELETE'])
@require_admin_auth
def delete_challenge(challenge_id):
    """Delete a challenge (Admin)"""
    try:
        original_count = len(challenges_data['challenges'])
        challenges_data['challenges'] = [c for c in challenges_data['challenges'] if c['id'] != challenge_id]
        if len(challenges_data['challenges']) == original_count:
            return jsonify({'error': 'Challenge not found'}), 404
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Hike Plans Management
def load_plans():
    """Load hike plans from JSON file"""
    plans_path = os.path.join(BASE_DIR, 'data', 'plans.json')
    try:
        with open(plans_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {'plans': []}

def save_plans(plans_data):
    """Save hike plans to JSON file"""
    plans_path = os.path.join(BASE_DIR, 'data', 'plans.json')
    atomic_json_write(plans_path, plans_data)

@app.route('/api/hike-plans', methods=['GET'])
def get_user_plans():
    """Get all hike plans for a user"""
    try:
        user_email = request.args.get('email')
        if not user_email:
            return jsonify({'error': 'Email parameter required'}), 400
        
        plans_data = load_plans()
        user_plans = [p for p in plans_data['plans'] if p.get('user_email') == user_email]
        return jsonify({'plans': user_plans})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/hike-plans', methods=['POST'])
def save_hike_plan():
    """Save a new hike plan"""
    try:
        plan_data = request.json
        if not plan_data.get('user_email'):
            return jsonify({'error': 'user_email required'}), 400
        
        plans_data = load_plans()
        plan_data['id'] = f"plan-{datetime.now().strftime('%Y%m%d%H%M%S')}-{len(plans_data['plans'])}"
        plan_data['created_at'] = datetime.now().isoformat()
        plans_data['plans'].append(plan_data)
        save_plans(plans_data)
        
        return jsonify({'success': True, 'plan': plan_data}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/hike-plans', methods=['GET'])
@require_admin_auth
def get_all_plans():
    """Get all hike plans with filtering (Admin)"""
    try:
        plans_data = load_plans()
        plans = plans_data['plans']
        
        # Apply filters
        trail_id = request.args.get('trail')
        date = request.args.get('date')
        user = request.args.get('user')
        
        if trail_id:
            plans = [p for p in plans if any(t.get('id') == trail_id for t in p.get('trails', []))]
        if date:
            plans = [p for p in plans if p.get('startDate') == date]
        if user:
            plans = [p for p in plans if user.lower() in p.get('user_email', '').lower()]
        
        # Sort by date (newest first)
        plans.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return jsonify({'plans': plans})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# User Analytics & Management
def load_user_analytics():
    """Load user analytics from JSON file"""
    analytics_path = os.path.join(BASE_DIR, 'data', 'user_analytics.json')
    try:
        with open(analytics_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {'trail_views': {}, 'trail_saves': {}, 'users': {}}

def save_user_analytics(analytics_data):
    """Save user analytics to JSON file"""
    analytics_path = os.path.join(BASE_DIR, 'data', 'user_analytics.json')
    atomic_json_write(analytics_path, analytics_data)

@app.route('/api/analytics/trail/view', methods=['POST'])
def track_trail_view():
    """Track trail view for analytics"""
    try:
        trail_id = request.json.get('trail_id')
        if not trail_id:
            return jsonify({'error': 'trail_id required'}), 400
        
        analytics = load_user_analytics()
        trail_views = analytics.get('trail_views', {})
        trail_views[trail_id] = trail_views.get(trail_id, 0) + 1
        analytics['trail_views'] = trail_views
        save_user_analytics(analytics)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analytics/trail/save', methods=['POST'])
def track_trail_save():
    """Track trail save for analytics"""
    try:
        trail_id = request.json.get('trail_id')
        action = request.json.get('action', 'save')  # 'save' or 'unsave'
        
        if not trail_id:
            return jsonify({'error': 'trail_id required'}), 400
        
        analytics = load_user_analytics()
        trail_saves = analytics.get('trail_saves', {})
        
        if action == 'save':
            trail_saves[trail_id] = trail_saves.get(trail_id, 0) + 1
        elif action == 'unsave' and trail_id in trail_saves:
            trail_saves[trail_id] = max(0, trail_saves[trail_id] - 1)
        
        analytics['trail_saves'] = trail_saves
        save_user_analytics(analytics)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Rifugio Management
def load_rifugios():
    """Load rifugios from JSON file"""
    rifugios_path = os.path.join(BASE_DIR, 'data', 'rifugios.json')
    try:
        with open(rifugios_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def save_rifugios(rifugios_data):
    """Save rifugios to JSON file"""
    rifugios_path = os.path.join(BASE_DIR, 'data', 'rifugios.json')
    atomic_json_write(rifugios_path, rifugios_data)

def load_booking_inquiries():
    """Load booking inquiries from JSON file"""
    inquiries_path = os.path.join(BASE_DIR, 'data', 'booking_inquiries.json')
    try:
        with open(inquiries_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def save_booking_inquiries(inquiries_data):
    """Save booking inquiries to JSON file"""
    inquiries_path = os.path.join(BASE_DIR, 'data', 'booking_inquiries.json')
    atomic_json_write(inquiries_path, inquiries_data)

def get_rifugio_status(rifugio):
    """Determine current status of rifugio based on dates"""
    from datetime import datetime, timedelta
    
    today = datetime.now().date()
    opening_season = rifugio.get('opening_season', {})
    
    try:
        start_date_str = opening_season.get('start_date', '')
        end_date_str = opening_season.get('end_date', '')
        
        if not start_date_str or not end_date_str:
            # Bivacco or always open
            if rifugio.get('type') == 'bivacco':
                return 'open'
            return rifugio.get('status', 'closed')
        
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        
        # Check special closures
        special_closures = rifugio.get('special_closures', [])
        for closure in special_closures:
            closure_start = datetime.strptime(closure['start'], '%Y-%m-%d').date()
            closure_end = datetime.strptime(closure['end'], '%Y-%m-%d').date()
            if closure_start <= today <= closure_end:
                return 'closed'
        
        # Check if currently in season
        if start_date <= today <= end_date:
            return 'open'
        
        # Check if opening soon (within 2 weeks)
        two_weeks = timedelta(days=14)
        if start_date > today and (start_date - today) <= two_weeks:
            return 'opening_soon'
        
        return 'closed'
    except:
        return rifugio.get('status', 'closed')

@app.route('/api/rifugios', methods=['GET'])
def get_rifugios():
    """Get all rifugios with optional filtering"""
    try:
        rifugios = load_rifugios()
        
        # Get query parameters for filtering
        type_filter = request.args.get('type')  # rifugio, malga, bivacco
        region_filter = request.args.get('region')
        min_altitude = request.args.get('min_altitude', type=int)
        max_altitude = request.args.get('max_altitude', type=int)
        status_filter = request.args.get('status')  # open, closed, opening_soon
        search_query = request.args.get('search', '').lower()
        
        # Apply filters
        filtered_rifugios = rifugios
        
        if type_filter:
            filtered_rifugios = [r for r in filtered_rifugios if r.get('type') == type_filter]
        
        if region_filter:
            filtered_rifugios = [r for r in filtered_rifugios if r.get('region') == region_filter]
        
        if min_altitude is not None:
            filtered_rifugios = [r for r in filtered_rifugios if r.get('altitude', 0) >= min_altitude]
        
        if max_altitude is not None:
            filtered_rifugios = [r for r in filtered_rifugios if r.get('altitude', 0) <= max_altitude]
        
        if search_query:
            filtered_rifugios = [
                r for r in filtered_rifugios 
                if search_query in r.get('name', '').lower() or 
                   search_query in r.get('region', '').lower() or
                   search_query in r.get('description', '').lower()
            ]
        
        # Update status for each rifugio
        for rifugio in filtered_rifugios:
            rifugio['current_status'] = get_rifugio_status(rifugio)
        
        # Apply status filter after calculating current status
        if status_filter:
            filtered_rifugios = [r for r in filtered_rifugios if r.get('current_status') == status_filter]
        
        return jsonify({'rifugios': filtered_rifugios})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/rifugios/<rifugio_id>', methods=['GET'])
def get_rifugio_detail(rifugio_id):
    """Get detailed information for a single rifugio"""
    try:
        rifugios = load_rifugios()
        rifugio = next((r for r in rifugios if r['id'] == rifugio_id), None)
        
        if not rifugio:
            return jsonify({'error': 'Rifugio not found'}), 404
        
        # Add current status
        rifugio['current_status'] = get_rifugio_status(rifugio)
        
        return jsonify(rifugio)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/booking-inquiries', methods=['POST'])
def submit_booking_inquiry():
    """Submit a booking inquiry for a rifugio"""
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['rifugio_id', 'rifugio_name', 'name', 'email', 'check_in', 'check_out', 'adults']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Load and prepare inquiry
        inquiries = load_booking_inquiries()
        
        inquiry = {
            'id': f"inq-{len(inquiries) + 1:04d}",
            'rifugio_id': data['rifugio_id'],
            'rifugio_name': data['rifugio_name'],
            'user_name': data['name'],
            'user_email': data['email'],
            'user_phone': data.get('phone', ''),
            'check_in': data['check_in'],
            'check_out': data['check_out'],
            'adults': data['adults'],
            'children': data.get('children', 0),
            'meal_preference': data.get('meal_preference', 'half_board'),
            'special_requests': data.get('special_requests', ''),
            'dogs': data.get('dogs', False),
            'status': 'pending',
            'created_at': datetime.utcnow().isoformat() + 'Z',
            'contact_method': data.get('contact_method', 'email')
        }
        
        inquiries.append(inquiry)
        save_booking_inquiries(inquiries)
        
        # TODO: Send email/WhatsApp notification
        # For now, just log the inquiry
        print(f"Booking inquiry submitted: {inquiry['id']} for {inquiry['rifugio_name']}")
        
        return jsonify({
            'success': True,
            'inquiry_id': inquiry['id'],
            'message': 'Your booking inquiry has been submitted successfully!'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/booking-inquiries', methods=['GET'])
@require_admin_auth
def get_all_booking_inquiries():
    """Get all booking inquiries (Admin)"""
    try:
        inquiries = load_booking_inquiries()
        
        # Sort by date (newest first)
        inquiries.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return jsonify({'inquiries': inquiries})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/rifugios', methods=['POST'])
@require_admin_auth
def create_rifugio():
    """Create new rifugio (Admin)"""
    try:
        data = request.json
        rifugios = load_rifugios()
        
        # Generate ID
        new_id = f"rif-{len(rifugios) + 1:03d}"
        
        rifugio = {
            'id': data.get('id', new_id),
            'name': data['name'],
            'type': data.get('type', 'rifugio'),
            'region': data['region'],
            'altitude': data['altitude'],
            'coordinates': data['coordinates'],
            'contact': data.get('contact', {}),
            'facilities': data.get('facilities', {}),
            'description': data.get('description', ''),
            'access_info': data.get('access_info', ''),
            'opening_season': data.get('opening_season', {}),
            'prices': data.get('prices', {}),
            'photos': data.get('photos', []),
            'status': data.get('status', 'seasonal'),
            'special_closures': data.get('special_closures', []),
            'created_at': datetime.utcnow().isoformat() + 'Z',
            'updated_at': datetime.utcnow().isoformat() + 'Z'
        }
        
        rifugios.append(rifugio)
        save_rifugios(rifugios)
        
        return jsonify({'success': True, 'rifugio': rifugio})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/rifugios/<rifugio_id>', methods=['PUT'])
@require_admin_auth
def update_rifugio(rifugio_id):
    """Update rifugio (Admin)"""
    try:
        data = request.json
        rifugios = load_rifugios()
        
        rifugio_index = next((i for i, r in enumerate(rifugios) if r['id'] == rifugio_id), None)
        if rifugio_index is None:
            return jsonify({'error': 'Rifugio not found'}), 404
        
        # Update fields
        rifugios[rifugio_index].update(data)
        rifugios[rifugio_index]['updated_at'] = datetime.utcnow().isoformat() + 'Z'
        
        save_rifugios(rifugios)
        
        return jsonify({'success': True, 'rifugio': rifugios[rifugio_index]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/rifugios/<rifugio_id>', methods=['DELETE'])
@require_admin_auth
def delete_rifugio(rifugio_id):
    """Delete rifugio (Admin)"""
    try:
        rifugios = load_rifugios()
        
        rifugios = [r for r in rifugios if r['id'] != rifugio_id]
        save_rifugios(rifugios)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/analytics/trails', methods=['GET'])
@require_admin_auth
def get_trail_analytics():
    """Get trail popularity analytics (Admin)"""
    try:
        analytics = load_user_analytics()
        hikes_data = load_completed_hikes()
        trails = load_complete_trails()['trails']
        
        # Calculate metrics for each trail
        trail_stats = []
        for trail in trails:
            trail_id = trail['id']
            views = analytics.get('trail_views', {}).get(trail_id, 0)
            saves = analytics.get('trail_saves', {}).get(trail_id, 0)
            completions = len([h for h in hikes_data['hikes'] if h.get('trail_id') == trail_id])
            
            # Calculate average duration
            completed_hikes = [h for h in hikes_data['hikes'] if h.get('trail_id') == trail_id]
            avg_duration = 0
            if completed_hikes:
                durations = [h['stats']['duration_hours'] for h in completed_hikes if h['stats']['duration_hours'] > 0]
                avg_duration = sum(durations) / len(durations) if durations else 0
            
            trail_stats.append({
                'id': trail_id,
                'name': trail['name'],
                'views': views,
                'saves': saves,
                'completions': completions,
                'avg_duration': round(avg_duration, 2),
                'estimated_duration': trail.get('duration', 0),
                'difficulty': trail.get('difficulty', 'unknown')
            })
        
        # Sort by views
        trail_stats.sort(key=lambda x: x['views'], reverse=True)
        
        return jsonify({
            'trails': trail_stats,
            'total_views': sum(analytics.get('trail_views', {}).values()),
            'total_saves': sum(analytics.get('trail_saves', {}).values()),
            'total_completions': len(hikes_data['hikes'])
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def load_completed_hikes():
    """Load completed hikes from JSON file"""
    hikes_path = os.path.join(BASE_DIR, 'data', 'completed_hikes.json')
    try:
        with open(hikes_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {'hikes': []}

# ============================================
# Multi-Day Trails Endpoints
# ============================================

def load_multi_day_trails():
    """Load multi-day trails from JSON file"""
    try:
        with open(MULTI_DAY_TRAILS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {'trails': []}
    except Exception as e:
        print(f"Error loading multi-day trails: {e}")
        return {'trails': []}

def save_multi_day_trails(data):
    """Save multi-day trails to JSON file"""
    atomic_json_write(MULTI_DAY_TRAILS_FILE, data)

@app.route('/api/multi-day-trails', methods=['GET'])
def get_multi_day_trails():
    """Get all published multi-day trails with filtering"""
    try:
        data = load_multi_day_trails()
        trails = data.get('trails', [])
        
        # Filter to only published trails for non-admin users
        trails = [t for t in trails if t.get('status') == 'published']
        
        # Apply filters
        difficulty = request.args.get('difficulty')
        region = request.args.get('region')
        duration_min = request.args.get('duration_min', type=int)
        duration_max = request.args.get('duration_max', type=int)
        trail_type = request.args.get('type')
        
        if difficulty:
            trails = [t for t in trails if t.get('difficulty') == difficulty]
        if region:
            trails = [t for t in trails if t.get('region') == region]
        if duration_min:
            trails = [t for t in trails if t.get('duration_days', 0) >= duration_min]
        if duration_max:
            trails = [t for t in trails if t.get('duration_days', 0) <= duration_max]
        if trail_type:
            trails = [t for t in trails if t.get('type') == trail_type]
        
        return jsonify({'trails': trails})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/multi-day-trails/<trail_id>', methods=['GET'])
def get_multi_day_trail(trail_id):
    """Get a single multi-day trail by ID"""
    try:
        data = load_multi_day_trails()
        trail = next((t for t in data.get('trails', []) if t['id'] == trail_id), None)
        
        if not trail:
            return jsonify({'error': 'Trail not found'}), 404
        
        # Only show published trails to non-admin users
        if trail.get('status') != 'published':
            return jsonify({'error': 'Trail not found'}), 404
        
        return jsonify(trail)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/multi-day-trails', methods=['GET'])
@require_admin_auth
def admin_get_all_multi_day_trails():
    """Get all multi-day trails (including drafts) for admin"""
    try:
        data = load_multi_day_trails()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/multi-day-trails', methods=['POST'])
@require_admin_auth
def admin_create_multi_day_trail():
    """Create a new multi-day trail (Admin)"""
    try:
        new_trail = request.json
        data = load_multi_day_trails()
        
        # Validate required fields
        required_fields = ['id', 'name', 'description', 'type', 'duration_days', 'difficulty', 'region']
        for field in required_fields:
            if field not in new_trail:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Check for duplicate ID
        if any(t['id'] == new_trail['id'] for t in data['trails']):
            return jsonify({'error': 'Trail ID already exists'}), 400
        
        # Set timestamps
        from datetime import datetime
        timestamp = datetime.utcnow().isoformat() + 'Z'
        new_trail['created_at'] = timestamp
        new_trail['updated_at'] = timestamp
        
        # Set default status
        if 'status' not in new_trail:
            new_trail['status'] = 'draft'
        
        data['trails'].append(new_trail)
        save_multi_day_trails(data)
        
        return jsonify(new_trail), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/multi-day-trails/<trail_id>', methods=['PUT'])
@require_admin_auth
def admin_update_multi_day_trail(trail_id):
    """Update a multi-day trail (Admin)"""
    try:
        updated_trail = request.json
        data = load_multi_day_trails()
        
        trail_index = next((i for i, t in enumerate(data['trails']) if t['id'] == trail_id), None)
        
        if trail_index is None:
            return jsonify({'error': 'Trail not found'}), 404
        
        # Update timestamp
        from datetime import datetime
        updated_trail['updated_at'] = datetime.utcnow().isoformat() + 'Z'
        
        # Preserve created_at
        updated_trail['created_at'] = data['trails'][trail_index].get('created_at')
        
        data['trails'][trail_index] = updated_trail
        save_multi_day_trails(data)
        
        return jsonify(updated_trail)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/multi-day-trails/<trail_id>', methods=['DELETE'])
@require_admin_auth
def admin_delete_multi_day_trail(trail_id):
    """Delete a multi-day trail (Admin)"""
    try:
        data = load_multi_day_trails()
        
        trail_index = next((i for i, t in enumerate(data['trails']) if t['id'] == trail_id), None)
        
        if trail_index is None:
            return jsonify({'error': 'Trail not found'}), 404
        
        deleted_trail = data['trails'].pop(trail_index)
        save_multi_day_trails(data)
        
        return jsonify({'message': 'Trail deleted successfully', 'trail': deleted_trail})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/analytics/users', methods=['GET'])
@require_admin_auth
def get_user_analytics():
    """Get user management data (Admin)"""
    try:
        analytics = load_user_analytics()
        hikes_data = load_completed_hikes()
        
        # Get all unique users from completed hikes
        user_stats = {}
        for hike in hikes_data['hikes']:
            user_email = hike.get('user_email', 'anonymous')
            if user_email not in user_stats:
                user_stats[user_email] = {
                    'email': user_email,
                    'hikes_completed': 0,
                    'total_distance': 0,
                    'total_elevation': 0,
                    'total_duration': 0,
                    'first_hike': hike.get('start_time'),
                    'last_hike': hike.get('end_time')
                }
            
            stats = user_stats[user_email]
            stats['hikes_completed'] += 1
            stats['total_distance'] += hike['stats'].get('distance_km', 0)
            stats['total_elevation'] += hike['stats'].get('elevation_gain_m', 0)
            stats['total_duration'] += hike['stats'].get('duration_hours', 0)
            
            # Update first/last hike dates
            if hike.get('start_time', '') < stats['first_hike']:
                stats['first_hike'] = hike.get('start_time')
            if hike.get('end_time', '') > stats['last_hike']:
                stats['last_hike'] = hike.get('end_time')
        
        # Convert to list and sort by hikes completed
        users_list = list(user_stats.values())
        users_list.sort(key=lambda x: x['hikes_completed'], reverse=True)
        
        return jsonify({
            'users': users_list,
            'total_users': len(users_list)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/analytics/gamification', methods=['GET'])
@require_admin_auth
def get_gamification_analytics():
    """Get gamification statistics (Admin)"""
    try:
        hikes_data = load_completed_hikes()
        
        # Calculate badge unlock statistics
        # This is a simplified version - in real app would check localStorage for each user
        total_hikes = len(hikes_data['hikes'])
        
        # Calculate total distance and elevation
        total_distance = sum(h['stats'].get('distance_km', 0) for h in hikes_data['hikes'])
        total_elevation = sum(h['stats'].get('elevation_gain_m', 0) for h in hikes_data['hikes'])
        
        # Estimate badge unlocks based on thresholds
        badge_stats = {
            'first_steps': {'unlocks': min(total_hikes, 10), 'total_users': 10},  # Mock data
            'distance_10km': {'unlocks': int(total_distance / 10), 'total_users': 10},
            'distance_50km': {'unlocks': int(total_distance / 50), 'total_users': 10},
            'distance_100km': {'unlocks': int(total_distance / 100), 'total_users': 10},
            'elevation_1000m': {'unlocks': int(total_elevation / 1000), 'total_users': 10},
            'elevation_5000m': {'unlocks': int(total_elevation / 5000), 'total_users': 10}
        }
        
        # Challenge statistics
        challenge_stats = {
            'active_challenges': len(challenges_data['challenges']),
            'total_participants': min(total_hikes * 2, 50),  # Mock data
            'completion_rate': 35.5  # Mock data
        }
        
        # Level distribution (mock data)
        level_distribution = {
            'beginner': 45,
            'novice': 25,
            'explorer': 15,
            'adventurer': 8,
            'expert': 5,
            'legend': 2
        }
        
        return jsonify({
            'badge_stats': badge_stats,
            'challenge_stats': challenge_stats,
            'level_distribution': level_distribution,
            'total_hikes': total_hikes,
            'total_distance': round(total_distance, 2),
            'total_elevation': round(total_elevation, 0)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/upload/media', methods=['POST'])
@require_admin_auth
def upload_media():
    """Upload media file to Object Storage (Admin)"""
    try:
        if not storage_client:
            return jsonify({'error': 'Object Storage not available'}), 503
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        
        file_type = request.form.get('type', 'media')
        
        import mimetypes
        import uuid
        
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        # File size validation
        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)
        
        MAX_PHOTO_SIZE = 16 * 1024 * 1024
        MAX_VIDEO_SIZE = 100 * 1024 * 1024
        
        if file_type in ['wallpaper', 'photos']:
            if file_size > MAX_PHOTO_SIZE:
                return jsonify({'error': f'Photo size exceeds 16MB limit. Your file: {file_size / 1024 / 1024:.1f}MB'}), 400
        elif file_type == 'videos':
            if file_size > MAX_VIDEO_SIZE:
                return jsonify({'error': f'Video size exceeds 100MB limit. Your file: {file_size / 1024 / 1024:.1f}MB'}), 400
        
        # File type validation
        image_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        video_extensions = ['.mp4', '.webm', '.mov', '.avi']
        
        if file_type in ['wallpaper', 'photos'] and file_ext not in image_extensions:
            return jsonify({'error': f'Invalid image format. Allowed: {", ".join(image_extensions)}'}), 400
        elif file_type == 'videos' and file_ext not in video_extensions:
            return jsonify({'error': f'Invalid video format. Allowed: {", ".join(video_extensions)}'}), 400
        
        # Read file content
        file_content = file.read()
        original_size = len(file_content)
        
        # Compress based on file type
        compressed_content = file_content
        final_filename = file.filename
        
        if file_type in ['wallpaper', 'photos']:
            # Compress images to WebP
            print(f"Compressing image: {file.filename} ({original_size / 1024:.1f}KB)")
            compressed_content, final_filename = compress_image(file_content, file.filename)
            print(f"Compressed to: {final_filename} ({len(compressed_content) / 1024:.1f}KB)")
        elif file_type == 'videos':
            # Compress videos with FFmpeg
            print(f"Compressing video: {file.filename} ({original_size / 1024 / 1024:.1f}MB)")
            compressed_content, final_filename = compress_video(file_content, file.filename)
            print(f"Compressed to: {final_filename} ({len(compressed_content) / 1024 / 1024:.1f}MB)")
        
        # Generate unique filename with correct extension
        file_ext = os.path.splitext(final_filename)[1]
        unique_filename = f"{file_type}/{uuid.uuid4()}{file_ext}"
        
        # Upload compressed file
        storage_client.upload_from_bytes(unique_filename, compressed_content)
        
        file_url = f"/api/media/{unique_filename}"
        compression_ratio = (1 - len(compressed_content) / original_size) * 100 if original_size > 0 else 0
        
        return jsonify({
            'success': True,
            'url': file_url,
            'filename': unique_filename,
            'size': len(compressed_content),
            'originalSize': original_size,
            'compressionRatio': f"{compression_ratio:.1f}%"
        }), 201
    
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@app.route('/api/media/<path:filename>', methods=['GET'])
def serve_media(filename):
    """Serve media files from Object Storage"""
    try:
        if not storage_client:
            return jsonify({'error': 'Object Storage not available'}), 503
        
        if not storage_client.exists(filename):
            return jsonify({'error': 'File not found'}), 404
        
        file_content = storage_client.download_as_bytes(filename)
        
        import mimetypes
        mime_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        
        return send_file(
            io.BytesIO(file_content),
            mimetype=mime_type,
            as_attachment=False,
            download_name=os.path.basename(filename)
        )
    
    except Exception as e:
        print(f"Serve error: {str(e)}")
        return jsonify({'error': f'File retrieval failed: {str(e)}'}), 500

# Serve React frontend (catch-all route for SPA)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve React frontend static files or index.html for SPA routing"""
    if not app.static_folder:
        return jsonify({'error': 'Frontend not available'}), 503
    
    # If path is a file that exists in the static folder, serve it
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    # Otherwise, serve index.html (for React Router)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    # Use port from environment variable, default to 8000 for development
    # Deployment will set PORT=5000
    port = int(os.environ.get('PORT', 8000))
    # Disable debug mode in production (PORT=5000)
    debug_mode = port != 5000
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
