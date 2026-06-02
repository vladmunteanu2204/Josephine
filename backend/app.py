from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from flask_talisman import Talisman
import os
import json
import math
import random
import io
import fcntl
import hashlib
import time
import sqlite3
import threading
import jwt
from datetime import datetime, timedelta
from functools import wraps
import media as media_module  # image upload / R2 delivery
from weather_service import weather_service
from notifications import EMAIL_ENABLED, send_email, build_inquiry_text
try:
    from replit.object_storage import Client as ObjectStorageClient
except ImportError:
    ObjectStorageClient = None
from PIL import Image
import subprocess
import tempfile
import uuid

# ── Sentry — initialise before anything else so all errors are captured ──
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

SENTRY_DSN = os.environ.get('SENTRY_DSN')
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FlaskIntegration()],
        traces_sample_rate=0.1,
        environment=os.environ.get('FLASK_ENV', 'production'),
    )
    print(f"Sentry initialised (env={os.environ.get('FLASK_ENV', 'production')})")
else:
    print("Warning: SENTRY_DSN not set — error tracking disabled")

# Configure Flask to serve static files from the built React frontend
app = Flask(__name__,
            static_folder='../web-frontend/dist',
            static_url_path='')

# ── CORS — restrict to explicit origins in production ─────────────────────
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', '*').split(',')
CORS(app, origins=ALLOWED_ORIGINS)

# ── Security headers via flask-talisman ───────────────────────────────────
# force_https=False: TLS is terminated upstream by Cloudflare/Replit proxy
Talisman(
    app,
    force_https=False,
    strict_transport_security=True,
    strict_transport_security_max_age=31536000,
    frame_options='DENY',
    x_content_type_options=True,
    content_security_policy={
        'default-src': ["'self'"],
        'img-src':     ["'self'", 'data:', 'https:', 'blob:'],
        'script-src':  ["'self'", "'unsafe-inline'"],
        'style-src':   ["'self'", "'unsafe-inline'"],
        'connect-src': ["'self'", 'https://api.mapbox.com',
                        'https://events.mapbox.com', 'https://*.sentry.io'],
        'worker-src':  ["'self'", 'blob:'],
        'font-src':    ["'self'", 'data:', 'https:'],
    }
)

# Initialize Object Storage client
try:
    storage_client = ObjectStorageClient() if ObjectStorageClient else None
    if storage_client is None:
        print("Warning: Object Storage not available (replit package not installed)")
except Exception as e:
    print(f"Warning: Object Storage not initialized: {e}")
    storage_client = None

# Admin authentication — no fallback; server refuses to start without this env var
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')
if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD environment variable must be set before starting the server")

# Anthropic API key — optional; /api/chat degrades gracefully without it
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
if not ANTHROPIC_API_KEY:
    print("Warning: ANTHROPIC_API_KEY not set — /api/chat will use structured lookup only (no LLM)")

# Singleton Anthropic client — instantiated once, not per-request
_anthropic_client = None
if ANTHROPIC_API_KEY:
    try:
        import anthropic as _anthropic_module
        _anthropic_client = _anthropic_module.Anthropic(api_key=ANTHROPIC_API_KEY)
    except Exception as _e:
        print(f"Warning: Could not init Anthropic client: {_e}")

# ── Donations: Lemon Squeezy "buy me a coffee" (optional) ────────────────────
# Donations degrade gracefully: if these aren't set the donate UI shows a
# "coming soon" state instead of erroring. Set all three to go live.
LEMONSQUEEZY_API_KEY    = os.environ.get('LEMONSQUEEZY_API_KEY')
LEMONSQUEEZY_STORE_ID   = os.environ.get('LEMONSQUEEZY_STORE_ID')
LEMONSQUEEZY_VARIANT_ID = os.environ.get('LEMONSQUEEZY_VARIANT_ID')  # a "pay what you want" variant
# Price of a single "coffee" in the store's currency, in cents (default €3.00).
try:
    DONATION_COFFEE_PRICE_CENTS = int(os.environ.get('DONATION_COFFEE_PRICE_CENTS', '300'))
except ValueError:
    DONATION_COFFEE_PRICE_CENTS = 300
DONATION_CURRENCY = os.environ.get('DONATION_CURRENCY', 'EUR')
DONATION_MAX_COFFEES = 50  # safety cap on a single donation
# Optional: where Lemon Squeezy sends the buyer back after a successful payment.
APP_BASE_URL = os.environ.get('APP_BASE_URL', '').rstrip('/')
DONATIONS_ENABLED = bool(LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID and LEMONSQUEEZY_VARIANT_ID)
if not DONATIONS_ENABLED:
    print("Note: Lemon Squeezy env not fully set — donations run in 'coming soon' mode.")

# ── PostgreSQL (optional — falls back to JSON files if DATABASE_URL not set) ──
from db import DB_AVAILABLE, get_db, create_tables, row_to_trail, row_to_rifugio, row_to_mdt
from sqlalchemy import text as _sql

if DB_AVAILABLE:
    try:
        create_tables()
    except Exception as _dbe:
        print(f"[db] WARNING: Table creation failed: {_dbe}")

# ── JWT secret (derived from ADMIN_PASSWORD so no extra env var needed) ──
JWT_SECRET = hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest()
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_HOURS = 12

# ── Brute-force lockout: max 10 failed attempts per 15 min per IP ─────────
_failed_attempts: dict = {}   # ip → [timestamp, ...]
_failed_lock = threading.Lock()
MAX_FAILED = 10
LOCKOUT_WINDOW = 900   # 15 minutes

def _record_failed(ip: str):
    now = time.time()
    with _failed_lock:
        bucket = [t for t in _failed_attempts.get(ip, []) if now - t < LOCKOUT_WINDOW]
        bucket.append(now)
        _failed_attempts[ip] = bucket

def _is_locked_out(ip: str) -> bool:
    now = time.time()
    with _failed_lock:
        bucket = [t for t in _failed_attempts.get(ip, []) if now - t < LOCKOUT_WINDOW]
        _failed_attempts[ip] = bucket
        return len(bucket) >= MAX_FAILED

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Issue a short-lived JWT after verifying admin password."""
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '0.0.0.0').split(',')[0].strip()
    if _is_locked_out(ip):
        return jsonify({'error': 'Too many failed attempts. Try again in 15 minutes.'}), 429
    body = request.get_json(silent=True) or {}
    password = body.get('password', '')
    if not password or password != ADMIN_PASSWORD:
        _record_failed(ip)
        return jsonify({'error': 'Invalid credentials'}), 401
    payload = {
        'sub': 'admin',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return jsonify({'token': token, 'expires_in': JWT_EXPIRY_HOURS * 3600})

def _has_valid_admin_jwt() -> bool:
    """True if the request carries a valid admin Bearer JWT. Used both by the
    decorator and to gate the `_admin` content bypass on public read routes."""
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return False
    try:
        jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return True
    except jwt.InvalidTokenError:   # covers ExpiredSignatureError too
        return False

def require_admin_auth(f):
    """Decorator: require a valid admin JWT (Bearer token).

    The legacy X-Admin-Password header path was removed: any VITE_* value is
    bundled into the browser build, so accepting the raw password from a header
    turned it into a public secret. Admins now exchange the password for a
    short-lived JWT via /api/admin/login (which keeps the brute-force lockout)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            token = auth[7:]
            try:
                jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                return f(*args, **kwargs)
            except jwt.ExpiredSignatureError:
                return jsonify({'error': 'Token expired — please log in again'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'error': 'Invalid token'}), 401
        return jsonify({'error': 'Unauthorized - admin login required'}), 401
    return decorated_function

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAILS_PATH   = os.path.join(BASE_DIR, 'data', 'trails.json')
RIFUGIOS_PATH = os.path.join(BASE_DIR, 'backend', 'data', 'rifugios.json')

# ── Fix #2: in-process TTL cache for JSON file reads ─────────────────────
_FILE_CACHE: dict = {}          # path → (data, loaded_at)
_FILE_CACHE_LOCK = threading.Lock()
FILE_CACHE_TTL = 30             # seconds — live edits propagate in ≤30s

def _cached_json(path: str):
    """Read JSON from disk at most once per FILE_CACHE_TTL seconds."""
    now = time.time()
    with _FILE_CACHE_LOCK:
        entry = _FILE_CACHE.get(path)
        if entry and now - entry[1] < FILE_CACHE_TTL:
            return entry[0]
    with open(path, 'r') as f:
        data = json.load(f)
    with _FILE_CACHE_LOCK:
        _FILE_CACHE[path] = (data, now)
    return data

def _invalidate_cache(path: str):
    """Call after writing to a JSON file so the next read reflects changes."""
    with _FILE_CACHE_LOCK:
        _FILE_CACHE.pop(path, None)


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
    """Load trail segments from the mock database (TTL-cached)"""
    segments_path = os.path.join(BASE_DIR, 'data', 'trail_segments.json')
    return _cached_json(segments_path)

def load_complete_trails():
    """Load all trails — from PostgreSQL if available, else JSON file (TTL-cached).

    Falls back to the bundled JSON not only on a DB *error* but also when the
    DB returns *zero* trails. A freshly provisioned (but un-seeded) Postgres
    table is a valid, error-free query that returns no rows — without this
    guard the catalog and recommend endpoints would silently go empty.
    """
    if DB_AVAILABLE:
        try:
            with get_db() as conn:
                rows = conn.execute(_sql("SELECT * FROM trails ORDER BY rating DESC NULLS LAST")).fetchall()
            if rows:
                return {'trails': [row_to_trail(r) for r in rows]}
            print("[db] trails table is empty — falling back to bundled JSON")
        except Exception as e:
            print(f"[db] load_complete_trails fallback to JSON: {e}")
    trails_path = os.path.join(BASE_DIR, 'data', 'trails.json')
    return _cached_json(trails_path)

def save_trail(trail: dict):
    """Upsert a single trail to PostgreSQL (or write full JSON file as fallback)."""
    if DB_AVAILABLE:
        try:
            scalar_keys = {'id','name','region','difficulty','distance_km',
                           'duration_hours','elevation_gain_m','status',
                           'dog_friendly','family_friendly','rating'}
            jsonb_data = {k: v for k, v in trail.items() if k not in scalar_keys}
            with get_db() as conn:
                conn.execute(_sql("""
                    INSERT INTO trails (id, name, region, difficulty, distance_km,
                        duration_hours, elevation_gain_m, status, dog_friendly,
                        family_friendly, rating, data)
                    VALUES (:id, :name, :region, :difficulty, :distance_km,
                        :duration_hours, :elevation_gain_m, :status, :dog_friendly,
                        :family_friendly, :rating, :data::jsonb)
                    ON CONFLICT (id) DO UPDATE SET
                        name=EXCLUDED.name, region=EXCLUDED.region,
                        difficulty=EXCLUDED.difficulty, distance_km=EXCLUDED.distance_km,
                        duration_hours=EXCLUDED.duration_hours,
                        elevation_gain_m=EXCLUDED.elevation_gain_m,
                        status=EXCLUDED.status, dog_friendly=EXCLUDED.dog_friendly,
                        family_friendly=EXCLUDED.family_friendly,
                        rating=EXCLUDED.rating, data=EXCLUDED.data
                """), {
                    'id': trail.get('id', ''),
                    'name': trail.get('name', ''),
                    'region': trail.get('region'),
                    'difficulty': trail.get('difficulty'),
                    'distance_km': trail.get('distance_km'),
                    'duration_hours': trail.get('duration_hours'),
                    'elevation_gain_m': trail.get('elevation_gain_m'),
                    'status': trail.get('status', 'published'),
                    'dog_friendly': bool(trail.get('dog_friendly', False)),
                    'family_friendly': bool(trail.get('family_friendly', False)),
                    'rating': trail.get('rating'),
                    'data': json.dumps(jsonb_data),
                })
            return True
        except Exception as e:
            print(f"[db] save_trail fallback to JSON: {e}")
    return False   # caller must do JSON write as fallback

def _db_delete_row(table: str, row_id: str):
    """Delete a row by id from a known table when PostgreSQL is in use.
    `table` is always a fixed literal ('trails' / 'rifugios'), never user input."""
    if not DB_AVAILABLE:
        return
    try:
        with get_db() as conn:
            conn.execute(_sql(f"DELETE FROM {table} WHERE id = :id"), {'id': row_id})
    except Exception as e:
        print(f"[db] delete from {table} failed: {e}")

def load_reviews():
    """Load reviews data — from PostgreSQL if available, else JSON (TTL-cached)."""
    if DB_AVAILABLE:
        try:
            with get_db() as conn:
                rows = conn.execute(_sql(
                    "SELECT trail_id, user_email, rating, comment, created_at, data FROM reviews ORDER BY created_at DESC"
                )).fetchall()
            return [dict(r._mapping) for r in rows]
        except Exception as e:
            print(f"[db] load_reviews fallback to JSON: {e}")
    reviews_path = os.path.join(BASE_DIR, 'data', 'reviews.json')
    return _cached_json(reviews_path)

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
    return jsonify({
        'ok': True,
        'service': 'josephine',
        'status': 'healthy',
        'media': media_module.status(),
    })

@app.route('/api/trails', methods=['GET'])
def get_trails():
    """Get all trails with optional filtering"""
    trails = load_complete_trails()
    
    difficulty = request.args.get('difficulty')
    duration_max = request.args.get('duration_max', type=float)
    interest = request.args.get('interest')
    
    all_trails = trails['trails']
    # The `_admin` bypass (showing drafts) now requires a valid admin JWT —
    # previously anyone could append ?_admin=1 to read unpublished content.
    is_admin = request.args.get('_admin') == '1' and _has_valid_admin_jwt()

    # Public endpoint: only show published trails; admin bypass shows all
    if not is_admin:
        all_trails = [t for t in all_trails if t.get('status', 'published') == 'published']

    filtered_trails = all_trails

    if difficulty:
        filtered_trails = [t for t in filtered_trails if t['difficulty'].lower() == difficulty.lower()]
    
    if duration_max:
        filtered_trails = [t for t in filtered_trails if t['duration_hours'] <= duration_max]
    
    if interest:
        filtered_trails = [t for t in filtered_trails if interest.lower() in [i.lower() for i in t['interests']]]

    total = len(filtered_trails)

    # Pagination — ?page=1&per_page=20 (default: all for backwards-compat when per_page not set)
    page     = request.args.get('page', type=int)
    per_page = request.args.get('per_page', type=int)
    if per_page and per_page > 0:
        page = max(1, page or 1)
        start = (page - 1) * per_page
        filtered_trails = filtered_trails[start:start + per_page]

    # Process media fields
    processed_trails = [process_trail_media(t) for t in filtered_trails]

    resp = jsonify({'trails': processed_trails, 'count': len(processed_trails), 'total': total})
    resp.headers['Cache-Control'] = 'public, max-age=60'
    return resp

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
    Only verified routes from the database are recommended now.
    Use POST /api/ai/recommend instead for smart recommendations.
    """
    return jsonify({
        'error': 'route_generation_deprecated',
        'message': 'Route generation is retired. Please use /api/ai/recommend for personalised trail suggestions.'
    }), 410

@app.route('/api/ai/recommend', methods=['POST'])
@app.route('/api/recommendations', methods=['POST'])
def get_recommendations():
    """
    Smart recommendation engine using local database scoring.
    Scores trails based on difficulty, interests, duration, season,
    family-friendly, dog-friendly and location.
    Returns top 3-5 verified trails with Josephine's own words as notes.
    """
    try:
        data = request.json or {}

        duration_hours  = data.get('duration_hours', data.get('duration', 3))
        difficulty      = data.get('difficulty', 'medium')
        # 'any' = the user never chose a difficulty (e.g. a mood/discovery query)
        # → don't bias the score toward any difficulty level.
        difficulty_any  = str(difficulty).lower() == 'any'
        interests       = sorted(data.get('interests', []))
        with_dog        = 'dog-friendly' in interests
        family_friendly = data.get('family_friendly', False)
        start_area      = data.get('start_area', data.get('starting_area', ''))
        max_distance_km = data.get('max_distance_km')
        mood_interests  = [i for i in interests if i != 'dog-friendly']

        # Cache recommendations by params — stable within the same calendar day
        today_str = datetime.now().strftime('%Y-%m-%d')
        rec_cache_key = hashlib.sha256(
            f"{today_str}|{duration_hours}|{difficulty}|{','.join(interests)}|{family_friendly}|{start_area}|{max_distance_km or ''}".encode()
        ).hexdigest()
        if rec_cache_key in _chat_cache:
            cached_entry = _chat_cache[rec_cache_key]
            if time.time() - cached_entry[1] < 300:   # 5-min TTL
                return jsonify(json.loads(cached_entry[0]))

        # Fix 2: current month for season awareness
        current_month = datetime.now().strftime('%B')   # e.g. "June"
        trails = load_complete_trails()['trails']
        # Diagnostic: surfaces "loaded 0 trails" in production logs when the
        # deployed environment has no trail data (empty DB table or missing JSON).
        print(f"[recommend] loaded {len(trails)} trails "
              f"(source={'db' if DB_AVAILABLE else 'json'})")

        # Hard distance filter — only applied when user specified a max
        if max_distance_km:
            trails = [t for t in trails if (t.get('distance_km') or 999) <= float(max_distance_km)]

        scored_trails = []
        for trail in trails:
            score = 0
            reasons = []
            warnings = []

            # Safe-defaulted core fields — production DB rows may have NULLs or
            # missing keys, and a single KeyError/AttributeError here would 500
            # the whole endpoint (surfacing as "mountain winds" on the client).
            t_difficulty = (trail.get('difficulty') or 'medium')
            try:
                t_duration = float(trail.get('duration_hours') or 3)
            except (TypeError, ValueError):
                t_duration = 3.0

            # ── Difficulty ──────────────────────────────────────────────
            if difficulty_any:
                pass   # no difficulty preference → leave the score unbiased
            elif t_difficulty.lower() == difficulty.lower():
                score += 4
                reasons.append(t_difficulty)
            elif (difficulty == 'medium' and t_difficulty == 'easy') or \
                 (difficulty == 'hard'   and t_difficulty == 'medium'):
                score += 1

            # ── Duration ────────────────────────────────────────────────
            duration_diff = abs(t_duration - duration_hours)
            if duration_diff <= 0.5:
                score += 3
            elif duration_diff <= 1.5:
                score += 2
            elif duration_diff > 2.5:
                score -= 1   # penalise large mismatches

            # ── Interest / mood — interests + tags + partial keyword ────
            trail_keywords = set(
                [i.lower() for i in trail.get('interests', [])] +
                [t.lower() for t in trail.get('tags', [])]
            )
            for interest in mood_interests:
                interest_lower = interest.lower()
                if interest_lower in trail_keywords:
                    score += 2
                    reasons.append(interest)
                elif any(interest_lower.split()[0] in kw for kw in trail_keywords):
                    score += 1
                    reasons.append(interest)

            # Loop type
            if 'loop' in mood_interests and trail.get('trail_type', '').lower() == 'loop':
                score += 2

            # ── Dog-friendly ─────────────────────────────────────────────
            if with_dog:
                if trail.get('dog_friendly'):
                    score += 3
                    reasons.append("dog-friendly")
                else:
                    score -= 10   # effectively excludes it

            # ── Fix 3: Family-friendly ───────────────────────────────────
            if family_friendly:
                if trail.get('family_friendly'):
                    score += 3
                    reasons.append("family-friendly")
                elif t_difficulty == 'hard':
                    score -= 5    # hard trails are poor family choices

            # ── Location ─────────────────────────────────────────────────
            if start_area:
                area_l = start_area.lower()
                # Check region, name, access_info, trailhead_info, and description
                # so village names like "Tirolo" match trails in "Merano & Surroundings"
                # that mention Tirolo in their access or trailhead text.
                search_fields = ' '.join([
                    trail.get('region') or '',
                    trail.get('name') or '',
                    trail.get('access_info') or '',
                    str((trail.get('trailhead_info') or {}).get('parking', '')),
                    (trail.get('description') or '')[:200],  # first 200 chars of description
                    str((trail.get('transport') or {}).get('car', '')),
                ]).lower()
                if area_l in search_fields:
                    score += 6
                    reasons.append(f"near {start_area}")
                elif any(
                    word in search_fields
                    for word in area_l.split()
                    if len(word) > 3 and word not in {
                        'lago', 'lake', 'val', 'valle', 'tal', 'berg', 'alpe', 'alm',
                        'pass', 'passo', 'wald', 'forst', 'monte', 'mount', 'peak',
                        'nord', 'sud', 'west', 'east', 'alto', 'bassa', 'upper', 'lower',
                    }
                ):
                    # Partial word match (e.g. "merano" in "Merano & Surroundings")
                    score += 2

            # ── Fix 2: Season awareness ───────────────────────────────────
            best_season = trail.get('best_season', [])
            if best_season:
                if current_month in best_season:
                    score += 2   # boost in-season trails
                else:
                    score -= 2   # penalise out-of-season
                    warnings.append(f"best visited {best_season[0]}–{best_season[-1]}")
            # Trails with no season set are year-round — no penalty

            scored_trails.append({
                'trail': trail,
                'score': score,
                'reasons': reasons,
                'warnings': warnings,
            })

        # If a specific area was requested, hard-filter to only trails that
        # actually mention that area — don't let generic high-scorers slip through.
        if start_area:
            # Generic geographic words that appear in many trail descriptions
            # and must not be used as matching tokens on their own.
            _GEO_STOPWORDS = {
                'lago', 'lake', 'val', 'valle', 'tal', 'berg', 'alpe', 'alm',
                'pass', 'passo', 'wald', 'forst', 'monte', 'mount', 'peak',
                'nord', 'sud', 'west', 'east', 'alto', 'bassa', 'upper', 'lower',
            }
            # For multi-word areas (e.g. "Lago di Braies"), pick the most distinctive
            # token — the longest word that isn't a generic geo word.
            area_tokens = [w for w in start_area.lower().split() if len(w) > 3]
            specific_tokens = [w for w in area_tokens if w not in _GEO_STOPWORDS] or area_tokens

            area_matched = [
                item for item in scored_trails
                if f"near {start_area}" in item['reasons']
                or any(
                    word in ' '.join([
                        item['trail'].get('region') or '',
                        item['trail'].get('name') or '',
                        item['trail'].get('access_info') or '',
                        str((item['trail'].get('trailhead_info') or {}).get('parking', '')),
                        (item['trail'].get('description') or '')[:200],
                        str((item['trail'].get('transport') or {}).get('car', '')),
                    ]).lower()
                    for word in specific_tokens
                )
            ]
            # If we found area-matched trails use them; otherwise fall back to
            # all trails but signal to the caller that none were near the area.
            if area_matched:
                scored_trails = area_matched
            else:
                # Return empty so the frontend can show an honest "not found" message
                return jsonify({'results': [], 'area_not_found': True, 'area': start_area})

        # Daily jitter — stable within a day, rotates each morning
        daily_rng = random.Random(datetime.now().strftime('%Y-%m-%d'))
        for item in scored_trails:
            item['score'] += daily_rng.uniform(0, 0.8)

        scored_trails.sort(key=lambda x: x['score'], reverse=True)
        top_scored = scored_trails[:5]

        results = []
        for i, item in enumerate(top_scored):
            trail    = process_trail_media(item['trail'])
            warnings = item['warnings']

            # ── Fix 1: Use Josephine's own written note ──────────────────
            raw_note = trail.get('josephineNote') or trail.get('josephine_note') or {}
            if isinstance(raw_note, dict):
                josephine_note = raw_note.get('en') or raw_note.get('it') or ''
            else:
                josephine_note = str(raw_note)

            # Fallback if the trail has no note yet
            if not josephine_note.strip():
                josephine_note = (
                    "This one just feels right for today. Trust me on this."
                    if i == 0 else
                    "A solid choice worth considering."
                )

            # Append season warning naturally if needed
            if warnings:
                josephine_note = josephine_note.rstrip('.') + f" — note: {warnings[0]}."

            coords_list    = trail.get('coordinates', [])
            pois_formatted = [
                {
                    'type':    poi.get('type', 'viewpoint'),
                    'name':    poi.get('name', ''),
                    'coord':   poi.get('coordinates', [0, 0]),
                    'message': poi.get('description', ''),
                }
                for poi in trail.get('pois', [])
            ]

            best_image = (
                trail.get('wallpaper') or
                (trail.get('gallery') or [None])[0] or
                trail.get('image_url') or
                trail.get('thumbnail') or
                ''
            )

            results.append({
                'id':               trail.get('id'),
                'name':             trail.get('name', ''),
                'distance_km':      trail.get('distance_km'),
                'duration_hours':   trail.get('duration_hours'),
                'elevation_gain_m': trail.get('elevation_gain_m'),
                'difficulty':       trail.get('difficulty', 'medium'),
                'geometry':         {'type': 'LineString', 'coordinates': coords_list},
                'pois':             pois_formatted,
                'tags':             trail.get('interests', []),
                'description':      trail.get('description', ''),
                'wallpaper':        best_image,
                'thumbnail':        best_image,
                'image_url':        trail.get('image_url', ''),
                'region':           trail.get('region', ''),
                'rating':           trail.get('rating', 0),
                'trail_type':       trail.get('trail_type', ''),
                'dog_friendly':     trail.get('dog_friendly', False),
                'family_friendly':  trail.get('family_friendly', False),
                'best_season':      trail.get('best_season', []),
                'josephine_note':   josephine_note,
                'in_season':        current_month in trail.get('best_season', [current_month]),
                # Extra context for Josephine's "Good to know" grid (chat + detail).
                # Safe-defaulted so older/partial trail records don't break the response.
                'elevation_loss_m':  trail.get('elevation_loss_m'),
                'transport':         trail.get('transport', {}),
                'trailhead_info':    trail.get('trailhead_info', {}),
                'facilities':        trail.get('facilities', []),
                'crowding':          trail.get('crowding', {}),
                'highlights':        trail.get('highlights', []),
                'nearby_rifugios':   _resolve_nearby_rifugios(trail.get('nearby_rifugios', [])),
                'weather_notes':     trail.get('weather_notes', ''),
            })

        payload = {'results': results}
        # Cache the serialised result (reuse _chat_cache dict, different key prefix)
        _chat_cache[rec_cache_key] = (json.dumps(payload), time.time())
        return jsonify(payload)

    except Exception as e:
        import traceback
        print(f"Error in recommendations: {str(e)}")
        traceback.print_exc()
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
    """Add a new review for a trail (registered users only)."""
    try:
        data = request.json or {}

        # Reviews are restricted to registered users — the client sends the
        # authenticated Firebase uid. Reject anonymous submissions.
        if not str(data.get('user_id', '')).strip():
            return jsonify({'error': 'authentication_required',
                            'message': 'Please sign in to submit a review.'}), 401

        new_review = {
            'id': f"rev_{trail_id}_{datetime.now().timestamp()}",
            'trail_id': trail_id,
            'user_id': data.get('user_id'),
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

        trails_path = TRAILS_PATH
        atomic_json_write(trails_path, trails)
        _invalidate_cache(TRAILS_PATH)
        # Persist to Postgres too (the source of truth in prod); JSON above is
        # the safety-net mirror. save_trail no-ops when DB isn't configured.
        save_trail(trail_data)

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

        trails_path = TRAILS_PATH
        atomic_json_write(trails_path, trails)
        _invalidate_cache(TRAILS_PATH)
        save_trail(trail_data)   # mirror to Postgres when available

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

        trails_path = TRAILS_PATH
        atomic_json_write(trails_path, trails)
        _invalidate_cache(TRAILS_PATH)
        _db_delete_row('trails', trail_id)   # remove from Postgres too

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/trails/<trail_id>/publish', methods=['POST'])
@require_admin_auth
def publish_trail(trail_id):
    """Publish or unpublish a trail (Admin). Body: {status: 'published'|'draft'}"""
    try:
        new_status = (request.get_json(silent=True) or {}).get('status', 'published')
        if new_status not in ('published', 'draft'):
            return jsonify({'error': "status must be 'published' or 'draft'"}), 400
        trails = load_complete_trails()
        trail = next((t for t in trails['trails'] if t['id'] == trail_id), None)
        if not trail:
            return jsonify({'error': 'Trail not found'}), 404
        trail['status'] = new_status
        trails_path = TRAILS_PATH
        atomic_json_write(trails_path, trails)
        _invalidate_cache(TRAILS_PATH)
        save_trail(trail)   # mirror the status change to Postgres
        return jsonify({'success': True, 'status': new_status})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/rifugios/<rifugio_id>/publish', methods=['POST'])
@require_admin_auth
def publish_rifugio(rifugio_id):
    """Publish or unpublish a rifugio (Admin). Body: {status: 'published'|'draft'}"""
    try:
        new_status = (request.get_json(silent=True) or {}).get('status', 'published')
        if new_status not in ('published', 'draft'):
            return jsonify({'error': "status must be 'published' or 'draft'"}), 400
        rifugios = load_rifugios()
        rifugio = next((r for r in rifugios if r['id'] == rifugio_id), None)
        if not rifugio:
            return jsonify({'error': 'Rifugio not found'}), 404
        rifugio['status'] = new_status
        rifugios_path = os.path.join(BASE_DIR, 'backend', 'data', 'rifugios.json')
        atomic_json_write(rifugios_path, rifugios)
        save_rifugio(rifugio)   # mirror the status change to Postgres
        return jsonify({'success': True, 'status': new_status})
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
    """Delete a review and update trail statistics (Admin)"""
    try:
        body = request.get_json(silent=True) or {}
        trail_id = body.get('trail_id')
        if not trail_id:
            return jsonify({'error': 'trail_id required'}), 400

        reviews_path = os.path.join(BASE_DIR, 'data', 'reviews.json')
        with open(reviews_path, 'r') as f:
            reviews_data = json.load(f)

        trail_reviews = reviews_data.get('reviews', {}).get(trail_id, [])
        original_count = len(trail_reviews)
        trail_reviews = [r for r in trail_reviews if r.get('id') != review_id]

        if len(trail_reviews) == original_count:
            return jsonify({'error': 'Review not found'}), 404

        reviews_data['reviews'][trail_id] = trail_reviews

        # Recalculate statistics for this trail
        if trail_reviews:
            avg = sum(r['rating'] for r in trail_reviews) / len(trail_reviews)
            reviews_data.setdefault('statistics', {})[trail_id] = {
                'average_rating': round(avg, 2),
                'total_reviews': len(trail_reviews)
            }
        else:
            reviews_data.setdefault('statistics', {}).pop(trail_id, None)
            reviews_data['reviews'].pop(trail_id, None)

        atomic_json_write(reviews_path, reviews_data)
        return jsonify({'success': True, 'remaining': len(trail_reviews)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Challenges Management — file-backed persistence
CHALLENGES_FILE = os.path.join(BASE_DIR, 'data', 'challenges.json')

def load_challenges():
    """Load challenges from JSON file (TTL-cached)"""
    try:
        return _cached_json(CHALLENGES_FILE)
    except FileNotFoundError:
        return {'challenges': []}

def save_challenges(data):
    """Save challenges to JSON file"""
    atomic_json_write(CHALLENGES_FILE, data)

@app.route('/api/challenges', methods=['GET'])
def get_challenges():
    """Get all challenges"""
    return jsonify(load_challenges())

@app.route('/api/admin/challenges', methods=['POST'])
@require_admin_auth
def create_challenge():
    """Create a new challenge (Admin)"""
    try:
        challenge_data = request.json
        data = load_challenges()
        if any(c['id'] == challenge_data['id'] for c in data['challenges']):
            return jsonify({'error': 'Challenge ID already exists'}), 400

        challenge_data['created_at'] = datetime.utcnow().isoformat() + 'Z'
        data['challenges'].append(challenge_data)
        save_challenges(data)
        return jsonify({'success': True, 'challenge': challenge_data}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/challenges/<challenge_id>', methods=['PUT'])
@require_admin_auth
def update_challenge(challenge_id):
    """Update a challenge (Admin)"""
    try:
        challenge_data = request.json
        data = load_challenges()
        idx = next((i for i, c in enumerate(data['challenges']) if c['id'] == challenge_id), None)
        if idx is None:
            return jsonify({'error': 'Challenge not found'}), 404

        challenge_data['updated_at'] = datetime.utcnow().isoformat() + 'Z'
        data['challenges'][idx] = challenge_data
        save_challenges(data)
        return jsonify({'success': True, 'challenge': challenge_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/challenges/<challenge_id>', methods=['DELETE'])
@require_admin_auth
def delete_challenge(challenge_id):
    """Delete a challenge (Admin)"""
    try:
        data = load_challenges()
        original_count = len(data['challenges'])
        data['challenges'] = [c for c in data['challenges'] if c['id'] != challenge_id]
        if len(data['challenges']) == original_count:
            return jsonify({'error': 'Challenge not found'}), 404

        save_challenges(data)
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

@app.route('/api/hike-plans/<plan_id>', methods=['PUT'])
def update_hike_plan(plan_id):
    """Update an existing hike plan (owner only — ownership keyed by email,
    matching the app's current client-trust model with no token verification)."""
    try:
        body = request.json or {}
        if not body.get('user_email'):
            return jsonify({'error': 'user_email required'}), 400

        plans_data = load_plans()
        idx = next((i for i, p in enumerate(plans_data['plans']) if p.get('id') == plan_id), None)
        if idx is None:
            return jsonify({'error': 'Plan not found'}), 404

        existing = plans_data['plans'][idx]
        if existing.get('user_email') != body.get('user_email'):
            return jsonify({'error': 'Forbidden — not your plan'}), 403

        # Preserve immutable fields; the client owns the rest of the envelope.
        body['id'] = existing['id']
        body['created_at'] = existing.get('created_at')
        body['user_email'] = existing.get('user_email')
        body['updated_at'] = datetime.now().isoformat()
        plans_data['plans'][idx] = body
        save_plans(plans_data)
        return jsonify({'success': True, 'plan': body})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/hike-plans/<plan_id>', methods=['DELETE'])
def delete_hike_plan(plan_id):
    """Delete a hike plan (owner only, ownership keyed by ?email=)."""
    try:
        user_email = request.args.get('email')
        if not user_email:
            return jsonify({'error': 'Email parameter required'}), 400

        plans_data = load_plans()
        plan = next((p for p in plans_data['plans'] if p.get('id') == plan_id), None)
        if plan is None:
            return jsonify({'error': 'Plan not found'}), 404
        if plan.get('user_email') != user_email:
            return jsonify({'error': 'Forbidden — not your plan'}), 403

        plans_data['plans'] = [p for p in plans_data['plans'] if p.get('id') != plan_id]
        save_plans(plans_data)
        return jsonify({'success': True})
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
    """Load user analytics — from PostgreSQL if available, else JSON."""
    if DB_AVAILABLE:
        try:
            with get_db() as conn:
                rows = conn.execute(_sql("SELECT trail_id, views, saves FROM user_analytics")).fetchall()
            views = {r.trail_id: r.views for r in rows}
            saves = {r.trail_id: r.saves for r in rows}
            return {'trail_views': views, 'trail_saves': saves, 'users': {}}
        except Exception as e:
            print(f"[db] load_user_analytics fallback to JSON: {e}")
    analytics_path = os.path.join(BASE_DIR, 'data', 'user_analytics.json')
    try:
        with open(analytics_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {'trail_views': {}, 'trail_saves': {}, 'users': {}}

def save_user_analytics(analytics_data):
    """Save analytics — atomic upsert to DB if available, else JSON."""
    if DB_AVAILABLE:
        try:
            views = analytics_data.get('trail_views', {})
            saves = analytics_data.get('trail_saves', {})
            all_ids = set(views.keys()) | set(saves.keys())
            with get_db() as conn:
                for tid in all_ids:
                    conn.execute(_sql("""
                        INSERT INTO user_analytics (trail_id, views, saves, updated_at)
                        VALUES (:trail_id, :views, :saves, NOW())
                        ON CONFLICT (trail_id) DO UPDATE
                            SET views=EXCLUDED.views, saves=EXCLUDED.saves, updated_at=NOW()
                    """), {'trail_id': tid, 'views': views.get(tid, 0), 'saves': saves.get(tid, 0)})
            return
        except Exception as e:
            print(f"[db] save_user_analytics fallback to JSON: {e}")
    analytics_path = os.path.join(BASE_DIR, 'data', 'user_analytics.json')
    atomic_json_write(analytics_path, analytics_data)

# ── In-memory recommendation cache (keyed by SHA256 of params, TTL 5min) ─
_chat_cache: dict = {}   # key → (serialised_json, timestamp)
_rate_buckets: dict = {} # ip → [timestamp, ...]

# ── Analytics write buffer — batch increments, flush every 30s ────────────
_analytics_buffer: dict = {'views': {}, 'saves': {}}
_video_jobs: dict = {}   # job_id → {status, url, ...}
_analytics_buf_lock = threading.Lock()
_analytics_last_flush = [time.time()]
ANALYTICS_FLUSH_INTERVAL = 30  # seconds

def _flush_analytics_buffer():
    """Write buffered analytics increments to storage. Called periodically."""
    with _analytics_buf_lock:
        if not _analytics_buffer['views'] and not _analytics_buffer['saves']:
            return
        views_delta = dict(_analytics_buffer['views'])
        saves_delta = dict(_analytics_buffer['saves'])
        _analytics_buffer['views'].clear()
        _analytics_buffer['saves'].clear()

    try:
        if DB_AVAILABLE:
            with get_db() as conn:
                for tid, delta in views_delta.items():
                    conn.execute(_sql("""
                        INSERT INTO user_analytics (trail_id, views, saves, updated_at)
                        VALUES (:tid, :delta, 0, NOW())
                        ON CONFLICT (trail_id) DO UPDATE
                            SET views = user_analytics.views + :delta, updated_at = NOW()
                    """), {'tid': tid, 'delta': delta})
                for tid, delta in saves_delta.items():
                    conn.execute(_sql("""
                        INSERT INTO user_analytics (trail_id, views, saves, updated_at)
                        VALUES (:tid, 0, :delta, NOW())
                        ON CONFLICT (trail_id) DO UPDATE
                            SET saves = user_analytics.saves + :delta, updated_at = NOW()
                    """), {'tid': tid, 'delta': delta})
        else:
            analytics = load_user_analytics()
            for tid, delta in views_delta.items():
                analytics.setdefault('trail_views', {})[tid] = analytics['trail_views'].get(tid, 0) + delta
            for tid, delta in saves_delta.items():
                analytics.setdefault('trail_saves', {})[tid] = analytics['trail_saves'].get(tid, 0) + delta
            save_user_analytics(analytics)
    except Exception as e:
        print(f"[analytics] flush error: {e}")
        # Re-queue lost increments
        with _analytics_buf_lock:
            for tid, delta in views_delta.items():
                _analytics_buffer['views'][tid] = _analytics_buffer['views'].get(tid, 0) + delta
            for tid, delta in saves_delta.items():
                _analytics_buffer['saves'][tid] = _analytics_buffer['saves'].get(tid, 0) + delta

def _maybe_flush_analytics():
    """Flush if ANALYTICS_FLUSH_INTERVAL seconds have elapsed."""
    now = time.time()
    if now - _analytics_last_flush[0] >= ANALYTICS_FLUSH_INTERVAL:
        _analytics_last_flush[0] = now
        threading.Thread(target=_flush_analytics_buffer, daemon=True).start()

@app.route('/api/analytics/trail/view', methods=['POST'])
def track_trail_view():
    """Track trail view — buffered, flushed every 30s."""
    trail_id = (request.json or {}).get('trail_id')
    if not trail_id:
        return jsonify({'error': 'trail_id required'}), 400
    with _analytics_buf_lock:
        _analytics_buffer['views'][trail_id] = _analytics_buffer['views'].get(trail_id, 0) + 1
    _maybe_flush_analytics()
    return jsonify({'success': True})

@app.route('/api/analytics/trail/save', methods=['POST'])
def track_trail_save():
    """Track trail save/unsave — buffered, flushed every 30s."""
    body     = request.json or {}
    trail_id = body.get('trail_id')
    action   = body.get('action', 'save')
    if not trail_id:
        return jsonify({'error': 'trail_id required'}), 400
    with _analytics_buf_lock:
        delta = 1 if action == 'save' else -1
        _analytics_buffer['saves'][trail_id] = _analytics_buffer['saves'].get(trail_id, 0) + delta
    _maybe_flush_analytics()
    return jsonify({'success': True})

# Rifugio Management
def load_rifugios():
    """Load rifugios — from PostgreSQL if available, else JSON (TTL-cached)."""
    if DB_AVAILABLE:
        try:
            with get_db() as conn:
                rows = conn.execute(_sql("SELECT * FROM rifugios ORDER BY name")).fetchall()
            if rows:
                return [row_to_rifugio(r) for r in rows]
            print("[db] rifugios table is empty — falling back to bundled JSON")
        except Exception as e:
            print(f"[db] load_rifugios fallback to JSON: {e}")
    rifugios_path = os.path.join(BASE_DIR, 'backend', 'data', 'rifugios.json')
    try:
        return _cached_json(rifugios_path)
    except FileNotFoundError:
        return []

def save_rifugio(rifugio: dict):
    """Upsert a single rifugio to PostgreSQL. Returns True if DB was used."""
    if DB_AVAILABLE:
        try:
            scalar_keys = {'id','name','type','region','altitude','status'}
            jsonb_data = {k: v for k, v in rifugio.items() if k not in scalar_keys}
            with get_db() as conn:
                conn.execute(_sql("""
                    INSERT INTO rifugios (id, name, type, region, altitude, status, data)
                    VALUES (:id, :name, :type, :region, :altitude, :status, :data::jsonb)
                    ON CONFLICT (id) DO UPDATE SET
                        name=EXCLUDED.name, type=EXCLUDED.type, region=EXCLUDED.region,
                        altitude=EXCLUDED.altitude, status=EXCLUDED.status, data=EXCLUDED.data
                """), {
                    'id': rifugio.get('id', ''),
                    'name': rifugio.get('name', ''),
                    'type': rifugio.get('type'),
                    'region': rifugio.get('region'),
                    'altitude': rifugio.get('altitude'),
                    'status': rifugio.get('status', 'published'),
                    'data': json.dumps(jsonb_data),
                })
            return True
        except Exception as e:
            print(f"[db] save_rifugio fallback to JSON: {e}")
    return False

def save_rifugios(rifugios_data):
    """Save all rifugios — upsert each to DB if available, else write JSON."""
    if DB_AVAILABLE:
        items = rifugios_data if isinstance(rifugios_data, list) else rifugios_data.get('rifugios', [])
        for r in items:
            save_rifugio(r)
        return
    rifugios_path = os.path.join(BASE_DIR, 'backend', 'data', 'rifugios.json')
    atomic_json_write(rifugios_path, rifugios_data)
    _invalidate_cache(rifugios_path)

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

    # Bivacchi are always open — unmanned emergency shelters
    if rifugio.get('type') == 'bivacco':
        return 'open'

    today = datetime.now().date()
    opening_season = rifugio.get('opening_season', {})

    try:
        start_date_str = opening_season.get('start_date', '')
        end_date_str = opening_season.get('end_date', '')

        if not start_date_str or not end_date_str:
            return 'closed'
        
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


# ── Geographic utilities ──────────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2):
    """Return great-circle distance in km between two lat/lng points."""
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# Ordered from most-specific to most-general — first match wins.
_SUB_REGIONS = [
    {'name': 'Val Gardena',           'lat': (46.50, 46.68), 'lng': (11.68, 11.94)},
    {'name': 'Alta Badia',            'lat': (46.54, 46.70), 'lng': (11.84, 12.12)},
    {'name': 'Val Pusteria',          'lat': (46.72, 46.95), 'lng': (11.80, 12.60)},
    {'name': "Val d'Isarco",          'lat': (46.62, 46.80), 'lng': (11.44, 11.72)},
    {'name': 'Merano & Surroundings', 'lat': (46.60, 46.84), 'lng': (10.88, 11.28)},
    {'name': 'Bolzano',               'lat': (46.42, 46.62), 'lng': (11.20, 11.52)},
    {'name': 'Vinschgau',             'lat': (46.54, 46.90), 'lng': (10.28, 11.00)},
    {'name': 'Dolomites',             'lat': (46.38, 46.66), 'lng': (11.60, 12.35)},
    {'name': 'Trentino',              'lat': (45.78, 46.50), 'lng': (10.46, 12.10)},
]


def get_region_from_coords(lat, lng):
    """Return the most specific sub-region name for a given lat/lng.
    Falls back to nearest trail's region if no bounding box matches."""
    for r in _SUB_REGIONS:
        if r['lat'][0] <= lat <= r['lat'][1] and r['lng'][0] <= lng <= r['lng'][1]:
            return r['name']
    # Secondary: find the nearest trail and inherit its region
    try:
        trails = load_trails()
        best_dist, best_region = float('inf'), 'South Tyrol'
        for t in trails:
            coords = t.get('coordinates', [])
            region = t.get('region', '')
            if not coords or not region:
                continue
            for c in coords[::max(1, len(coords) // 20)]:  # sample 20 points max
                d = haversine(lat, lng, c[1], c[0])
                if d < best_dist:
                    best_dist, best_region = d, region
        return best_region if best_dist < 30 else 'South Tyrol'
    except Exception:
        return 'South Tyrol'


@app.route('/api/rifugios/<rifugio_id>/nearby-trails', methods=['GET'])
def get_rifugio_nearby_trails(rifugio_id):
    """Return up to 6 trails whose path passes within 8 km of this rifugio."""
    try:
        rifugios = load_rifugios()
        rifugio = next((r for r in rifugios if r['id'] == rifugio_id), None)
        if not rifugio:
            return jsonify({'error': 'Rifugio not found'}), 404

        coords = rifugio.get('coordinates', {})
        rif_lat = coords.get('lat') if isinstance(coords, dict) else None
        rif_lng = coords.get('lng') if isinstance(coords, dict) else None
        if rif_lat is None or rif_lng is None:
            return jsonify({'trails': []})

        RADIUS_KM = 8
        MAX_RESULTS = 6
        candidates = []

        for trail in load_trails():
            trail_coords = trail.get('coordinates', [])
            if not trail_coords:
                continue
            # Sample up to 50 points for performance on long trails
            step = max(1, len(trail_coords) // 50)
            min_dist = min(
                haversine(rif_lat, rif_lng, c[1], c[0])
                for c in trail_coords[::step]
            )
            if min_dist <= RADIUS_KM:
                candidates.append((min_dist, trail))

        candidates.sort(key=lambda x: x[0])
        slim_fields = ('id', 'name', 'region', 'difficulty', 'distance_km', 'duration_hours', 'coordinates')
        result = [
            {k: t.get(k) for k in slim_fields}
            for _, t in candidates[:MAX_RESULTS]
        ]
        return jsonify({'trails': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/rifugios/<rifugio_id>/reviews', methods=['GET'])
def get_rifugio_reviews(rifugio_id):
    """Get visitor reviews for a rifugio."""
    try:
        reviews_data = load_reviews()
        entity_reviews = reviews_data['reviews'].get(rifugio_id, [])
        entity_stats = reviews_data['statistics'].get(rifugio_id, {
            'average_rating': 0, 'total_reviews': 0
        })
        return jsonify({'reviews': entity_reviews, 'statistics': entity_stats})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/rifugios/<rifugio_id>/reviews', methods=['POST'])
def add_rifugio_review(rifugio_id):
    """Submit a visitor review for a rifugio (registered users only)."""
    try:
        data = request.json or {}
        # Reviews are restricted to registered users (Firebase uid required).
        if not str(data.get('user_id', '')).strip():
            return jsonify({'error': 'authentication_required',
                            'message': 'Please sign in to submit a review.'}), 401
        new_review = {
            'id': f"rev_{rifugio_id}_{datetime.now().timestamp()}",
            'rifugio_id': rifugio_id,
            'user_id': data.get('user_id'),
            'user_name': data.get('user_name', 'Anonymous'),
            'rating': data.get('rating', 5),
            'comment': data.get('comment', ''),
            'date': datetime.now().strftime('%Y-%m-%d'),
            'helpful_count': 0,
        }
        return jsonify({'success': True, 'review': new_review,
                        'message': 'Review submitted successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
        
        # Public endpoint: only show published rifugios; admin bypass (drafts)
        # now requires a valid admin JWT, not just the query flag.
        is_admin = request.args.get('_admin') == '1' and _has_valid_admin_jwt()
        if not is_admin:
            rifugios = [r for r in rifugios if r.get('status', 'published') == 'published']

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

        total = len(filtered_rifugios)

        # Pagination — ?page=1&per_page=20
        page     = request.args.get('page', type=int)
        per_page = request.args.get('per_page', type=int)
        if per_page and per_page > 0:
            page = max(1, page or 1)
            start = (page - 1) * per_page
            filtered_rifugios = filtered_rifugios[start:start + per_page]

        resp = jsonify({'rifugios': filtered_rifugios, 'total': total})
        resp.headers['Cache-Control'] = 'public, max-age=60'
        return resp
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
        
        # Compute operational status from season dates
        rifugio['current_status'] = get_rifugio_status(rifugio)

        # Auto-detect sub-region when stored region is too broad
        generic = {'South Tyrol', 'Dolomites', '', None}
        if rifugio.get('region') in generic:
            coords = rifugio.get('coordinates', {})
            if isinstance(coords, dict) and coords.get('lat'):
                rifugio['region'] = get_region_from_coords(coords['lat'], coords['lng'])

        return jsonify(rifugio)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

_booking_attempts: dict = {}            # ip → [timestamps]
_booking_lock = threading.Lock()
MAX_BOOKINGS_PER_HOUR = 6

def _booking_rate_ok(ip: str) -> bool:
    """Dedicated per-IP limiter for booking inquiries (kept separate from the
    LLM limiter `_rate_allowed`, which spends the chat budget)."""
    now = time.time()
    window = now - 3600
    with _booking_lock:
        bucket = [t for t in _booking_attempts.get(ip, []) if t > window]
        if len(bucket) >= MAX_BOOKINGS_PER_HOUR:
            _booking_attempts[ip] = bucket
            return False
        bucket.append(now)
        _booking_attempts[ip] = bucket
        return True


def _deliver_booking_inquiry(inquiry, rif):
    """Send the inquiry to the hut when it has a VERIFIED email; otherwise mark
    it for client-side fallback. Mutates `inquiry` with delivery_* fields and
    returns the `delivery` dict for the client. Never raises."""
    contact = (rif or {}).get('contact', {}) or {}
    hut_email    = (contact.get('email') or '').strip()
    hut_whatsapp = (contact.get('whatsapp') or '').strip()
    hut_phone    = (contact.get('phone') or '').strip()
    verified     = bool((rif or {}).get('booking_email_verified'))
    msg = build_inquiry_text(inquiry, rif)

    status = 'fallback'
    channel = 'whatsapp' if hut_whatsapp else ('email' if hut_email else ('phone' if hut_phone else 'none'))
    provider_id = None

    try:
        if EMAIL_ENABLED and hut_email and verified:
            subject_hut = f"Richiesta di prenotazione — {inquiry['check_in']} → {inquiry['check_out']}"
            ok, provider_id, err = send_email(hut_email, subject_hut, msg, reply_to=inquiry['user_email'])
            if ok:
                status = 'emailed'; channel = 'email'
                # Confirmation copy to the hiker (best-effort; failure ignored).
                confirm = (f"Hi {inquiry['user_name']},\n\nWe've sent your inquiry to "
                           f"{inquiry['rifugio_name']}. They'll reply to you directly at "
                           f"{inquiry['user_email']}.\n\n--- Copy of your inquiry ---\n\n{msg}")
                send_email(inquiry['user_email'], f"Your inquiry to {inquiry['rifugio_name']}", confirm)
            else:
                status = 'failed'
                print(f"[booking] email send failed for {inquiry['id']}: {err}")
    except Exception as e:
        status = 'failed'
        print(f"[booking] delivery error for {inquiry.get('id')}: {e}")

    inquiry['delivery_status'] = status
    inquiry['delivery_channel'] = channel
    inquiry['delivery_at'] = datetime.utcnow().isoformat() + 'Z'
    inquiry['provider_message_id'] = provider_id

    return {
        'status': status,
        'channel': channel,
        'hut_email': hut_email or None,
        'hut_whatsapp': hut_whatsapp or None,
        'hut_phone': hut_phone or None,
        'prefilled_message': msg,
    }


@app.route('/api/booking-inquiries', methods=['POST'])
def submit_booking_inquiry():
    """Submit a booking inquiry and (when the hut's email is verified) email it
    to the hut automatically, with the hiker as Reply-To + a confirmation copy.
    Otherwise return a `delivery` object so the client offers a one-tap fallback."""
    try:
        data = request.json or {}

        # Validate required fields
        required_fields = ['rifugio_id', 'rifugio_name', 'name', 'email', 'check_in', 'check_out', 'adults']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Per-IP rate limit (before persisting)
        ip = request.headers.get('X-Forwarded-For', request.remote_addr or '0.0.0.0').split(',')[0].strip()
        if not _booking_rate_ok(ip):
            return jsonify({'error': 'rate_limited',
                            'message': 'Too many inquiries — please try again later.'}), 429

        inquiries = load_booking_inquiries()

        inquiry = {
            'id': f"inq-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{random.randint(1000, 9999)}",
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
            'contact_method': data.get('contact_method', 'email'),
        }

        # Persist first so a delivery failure never loses the inquiry.
        inquiries.append(inquiry)
        save_booking_inquiries(inquiries)

        # Resolve the hut and attempt delivery.
        rif = next((r for r in load_rifugios() if r.get('id') == data['rifugio_id']), None)
        delivery = _deliver_booking_inquiry(inquiry, rif)
        save_booking_inquiries(inquiries)   # re-save with delivery_* fields

        print(f"Booking inquiry {inquiry['id']} for {inquiry['rifugio_name']} → {delivery['status']}")

        return jsonify({
            'success': True,
            'inquiry_id': inquiry['id'],
            'message': 'Your booking inquiry has been submitted successfully!',
            'delivery': delivery,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/booking-inquiries', methods=['GET'])
@require_admin_auth
def get_all_booking_inquiries():
    """Get all booking inquiries with optional filtering (Admin)"""
    try:
        inquiries = load_booking_inquiries()

        # Filters
        status_filter  = request.args.get('status')
        rifugio_filter = request.args.get('rifugio_id')
        date_from      = request.args.get('date_from')
        date_to        = request.args.get('date_to')

        if status_filter:
            inquiries = [i for i in inquiries if i.get('status') == status_filter]
        if rifugio_filter:
            inquiries = [i for i in inquiries if i.get('rifugio_id') == rifugio_filter]
        if date_from:
            inquiries = [i for i in inquiries if i.get('check_in', '') >= date_from]
        if date_to:
            inquiries = [i for i in inquiries if i.get('check_in', '') <= date_to]

        inquiries.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return jsonify({'inquiries': inquiries, 'total': len(inquiries)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/booking-inquiries/<inquiry_id>', methods=['PUT'])
@require_admin_auth
def update_booking_inquiry(inquiry_id):
    """Update booking inquiry status (Admin)"""
    try:
        data = request.json or {}
        inquiries = load_booking_inquiries()
        idx = next((i for i, inq in enumerate(inquiries) if inq['id'] == inquiry_id), None)
        if idx is None:
            return jsonify({'error': 'Inquiry not found'}), 404

        allowed_fields = ['status', 'admin_notes']
        for field in allowed_fields:
            if field in data:
                inquiries[idx][field] = data[field]
        inquiries[idx]['updated_at'] = datetime.utcnow().isoformat() + 'Z'
        save_booking_inquiries(inquiries)
        return jsonify({'success': True, 'inquiry': inquiries[idx]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/booking-inquiries/<inquiry_id>', methods=['DELETE'])
@require_admin_auth
def delete_booking_inquiry(inquiry_id):
    """Delete a booking inquiry (Admin)"""
    try:
        inquiries = load_booking_inquiries()
        original = len(inquiries)
        inquiries = [i for i in inquiries if i['id'] != inquiry_id]
        if len(inquiries) == original:
            return jsonify({'error': 'Inquiry not found'}), 404
        save_booking_inquiries(inquiries)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/dashboard', methods=['GET'])
@require_admin_auth
def get_dashboard_stats():
    """Aggregated dashboard stats for the Command Centre (Admin)"""
    try:
        from concurrent.futures import ThreadPoolExecutor
        # Load all 6 data sources in parallel — ~6× faster than sequential
        with ThreadPoolExecutor(max_workers=6) as ex:
            f_trails   = ex.submit(lambda: load_complete_trails()['trails'])
            f_rifugios = ex.submit(load_rifugios)
            f_inq      = ex.submit(load_booking_inquiries)
            f_plans    = ex.submit(load_plans)
            f_anal     = ex.submit(load_user_analytics)
            f_hikes    = ex.submit(load_completed_hikes)
        trails     = f_trails.result()
        rifugios   = f_rifugios.result()
        inquiries  = f_inq.result()
        plans_data = f_plans.result()
        analytics  = f_anal.result()
        hikes_data = f_hikes.result()
        current_month = datetime.now().strftime('%B')

        # Trail health matrix
        def trail_health(t):
            score = 0
            checks = {}
            checks['has_name']        = bool(t.get('name'))
            checks['has_region']      = bool(t.get('region'))
            checks['has_difficulty']  = bool(t.get('difficulty'))
            checks['has_coordinates'] = bool(t.get('coordinates'))
            checks['has_wallpaper']   = bool(t.get('wallpaper') or t.get('image_url'))
            checks['has_description'] = len(t.get('description', '')) >= 50
            checks['has_note']        = bool((t.get('josephineNote') or {}).get('en'))
            checks['has_tags']        = len(t.get('interests', t.get('tags', []))) > 0
            checks['has_season']      = len(t.get('best_season', [])) > 0
            checks['family_set']      = t.get('family_friendly') is not None
            weights = {
                'has_name': 10, 'has_region': 5, 'has_difficulty': 5,
                'has_coordinates': 20, 'has_wallpaper': 15, 'has_description': 15,
                'has_note': 15, 'has_tags': 10, 'has_season': 5, 'family_set': 5,
            }
            score = sum(weights[k] for k, v in checks.items() if v)
            best_season = t.get('best_season', [])
            in_season = current_month in best_season if best_season else True
            return {
                'id': t['id'], 'name': t['name'],
                'difficulty': t.get('difficulty'),
                'health_score': score,
                'checks': checks,
                'in_season': in_season,
                'views': analytics.get('trail_views', {}).get(t['id'], 0),
                'saves': analytics.get('trail_saves', {}).get(t['id'], 0),
            }

        trail_matrix = [trail_health(t) for t in trails]

        # Pending bookings count
        pending_bookings = len([i for i in inquiries if i.get('status') == 'pending'])

        # Recent activity
        recent_inquiries = sorted(inquiries, key=lambda x: x.get('created_at',''), reverse=True)[:5]
        recent_hikes     = sorted(hikes_data.get('hikes',[]), key=lambda x: x.get('start_time',''), reverse=True)[:5]
        recent_plans     = sorted(plans_data.get('plans',[]), key=lambda x: x.get('created_at',''), reverse=True)[:5]

        resp = jsonify({
            'kpis': {
                'trails':          len(trails),
                'rifugios':        len(rifugios),
                'pending_bookings': pending_bookings,
                'total_plans':     len(plans_data.get('plans', [])),
                'total_hikes':     len(hikes_data.get('hikes', [])),
                'total_views':     sum(analytics.get('trail_views', {}).values()),
                'total_saves':     sum(analytics.get('trail_saves', {}).values()),
            },
            'trail_matrix':    trail_matrix,
            'recent_inquiries': recent_inquiries,
            'recent_hikes':    recent_hikes,
            'recent_plans':    recent_plans,
            'current_month':   current_month,
        })
        resp.headers['Cache-Control'] = 'private, max-age=30'
        return resp
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/trails/export', methods=['GET'])
@require_admin_auth
def export_trails():
    """Export full trails.json as a file download (Admin)"""
    try:
        trails_path = os.path.join(BASE_DIR, 'data', 'trails.json')
        return send_file(trails_path, mimetype='application/json',
                         as_attachment=True, download_name='trails.json')
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
        # save_rifugios is upsert-only, so it can't remove the deleted row from
        # Postgres — delete it explicitly.
        _db_delete_row('rifugios', rifugio_id)

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
        
        # Pre-group hikes by trail_id — O(n) instead of O(trails × hikes)
        hikes_by_trail: dict = {}
        for h in hikes_data.get('hikes', []):
            tid = h.get('trail_id')
            if tid:
                hikes_by_trail.setdefault(tid, []).append(h)

        # Calculate metrics for each trail
        trail_stats = []
        for trail in trails:
            trail_id = trail['id']
            views = analytics.get('trail_views', {}).get(trail_id, 0)
            saves = analytics.get('trail_saves', {}).get(trail_id, 0)
            trail_hikes = hikes_by_trail.get(trail_id, [])
            completions = len(trail_hikes)

            # Calculate average duration
            avg_duration = 0
            if trail_hikes:
                durations = [h['stats']['duration_hours'] for h in trail_hikes
                             if h.get('stats', {}).get('duration_hours', 0) > 0]
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
    """Load multi-day trails — from PostgreSQL if available, else JSON file."""
    if DB_AVAILABLE:
        try:
            with get_db() as conn:
                rows = conn.execute(_sql("SELECT * FROM multi_day_trails ORDER BY name")).fetchall()
            if rows:
                return {'trails': [row_to_mdt(r) for r in rows]}
            print("[db] multi_day_trails table is empty — falling back to bundled JSON")
        except Exception as e:
            print(f"[db] load_multi_day_trails fallback to JSON: {e}")
    try:
        with open(MULTI_DAY_TRAILS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {'trails': []}
    except Exception as e:
        print(f"Error loading multi-day trails: {e}")
        return {'trails': []}

def save_multi_day_trails(data):
    """Save multi-day trails — upsert to DB if available, else JSON."""
    if DB_AVAILABLE:
        try:
            trails = data.get('trails', []) if isinstance(data, dict) else data
            scalar_keys = {'id','name','difficulty','region','status'}
            with get_db() as conn:
                for t in trails:
                    jsonb_data = {k: v for k, v in t.items() if k not in scalar_keys}
                    conn.execute(_sql("""
                        INSERT INTO multi_day_trails (id, name, difficulty, region, status, data)
                        VALUES (:id, :name, :difficulty, :region, :status, :data::jsonb)
                        ON CONFLICT (id) DO UPDATE SET
                            name=EXCLUDED.name, difficulty=EXCLUDED.difficulty,
                            region=EXCLUDED.region, status=EXCLUDED.status, data=EXCLUDED.data
                    """), {
                        'id': t.get('id', ''), 'name': t.get('name', ''),
                        'difficulty': t.get('difficulty'), 'region': t.get('region'),
                        'status': t.get('status', 'published'),
                        'data': json.dumps(jsonb_data),
                    })
            return
        except Exception as e:
            print(f"[db] save_multi_day_trails fallback to JSON: {e}")
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
        
        resp = jsonify({'trails': trails})
        resp.headers['Cache-Control'] = 'public, max-age=300'
        return resp
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
    """
    Upload an image or video for a trail.

    Form fields:
        file        — the file (multipart)
        type        — 'photos' | 'wallpaper' | 'videos'
        trail_id    — trail ID for folder organisation (images only)
        alt         — accessible alt text

    Images: generates 3 WebP variants (thumb/card/hero) → R2 → CDN URLs.
    Videos: raw upload to legacy storage, background FFmpeg compression.

    Returns:
        images: { thumb, card, hero, alt, uploaded_at }  — for image uploads
        url:    '/api/media/...'                          — for video uploads (async)
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400

    file_type = request.form.get('type', 'photos')
    trail_id  = request.form.get('trail_id', 'general')
    alt_text  = request.form.get('alt', '')
    file_ext  = os.path.splitext(file.filename)[1].lower()

    # Size limits
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)

    MAX_PHOTO_SIZE = 20 * 1024 * 1024   # 20 MB — PIL can handle; variants will be ≪1MB each
    MAX_VIDEO_SIZE = 200 * 1024 * 1024  # 200 MB

    IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.tiff'}
    VIDEO_EXTS = {'.mp4', '.webm', '.mov', '.avi'}

    try:
        # ── Video path ────────────────────────────────────────────────────
        if file_type == 'videos':
            if file_size > MAX_VIDEO_SIZE:
                return jsonify({'error': f'Video exceeds 200MB. Size: {file_size/1024/1024:.1f}MB'}), 400
            if file_ext not in VIDEO_EXTS:
                return jsonify({'error': f'Invalid video format. Allowed: {", ".join(VIDEO_EXTS)}'}), 400
            if not storage_client:
                return jsonify({'error': 'Legacy Object Storage not available for video uploads'}), 503

            file_content = file.read()
            raw_ext  = file_ext
            raw_key  = f"videos/raw_{uuid.uuid4()}{raw_ext}"
            storage_client.upload_from_bytes(raw_key, file_content)
            job_id = str(uuid.uuid4())
            _video_jobs[job_id] = {'status': 'processing', 'raw_key': raw_key}

            def _bg_compress(jid, rk, fc, fname):
                try:
                    comp, cfname = compress_video(fc, fname)
                    final_key = f"videos/{uuid.uuid4()}{os.path.splitext(cfname)[1]}"
                    storage_client.upload_from_bytes(final_key, comp)
                    storage_client.delete(rk)
                    _video_jobs[jid] = {'status': 'done', 'url': f"/api/media/{final_key}", 'size': len(comp)}
                except Exception as ex:
                    _video_jobs[jid] = {'status': 'error', 'message': str(ex)}

            threading.Thread(target=_bg_compress,
                             args=(job_id, raw_key, file_content, file.filename),
                             daemon=True).start()
            return jsonify({
                'success': True, 'async': True, 'job_id': job_id,
                'poll_url': f"/api/admin/upload/video-status/{job_id}",
                'message': 'Video uploading; compression running in background',
            }), 202

        # ── Image path ────────────────────────────────────────────────────
        if file_size > MAX_PHOTO_SIZE:
            return jsonify({'error': f'Image exceeds 20MB. Size: {file_size/1024/1024:.1f}MB'}), 400
        if file_ext not in IMAGE_EXTS:
            return jsonify({'error': f'Invalid image format. Allowed: {", ".join(IMAGE_EXTS)}'}), 400

        file_bytes = file.read()
        original_kb = len(file_bytes) // 1024

        images = media_module.upload_trail_image(
            file_bytes=file_bytes,
            trail_id=trail_id,
            alt_text=alt_text or file.filename,
            legacy_storage_client=storage_client,
        )

        print(f"[upload] {file.filename} ({original_kb}KB) → {trail_id}: "
              f"thumb={len(file_bytes)//1024}KB → see R2 for actual sizes")

        return jsonify({'success': True, 'images': images}), 201

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"[upload] error: {e}")
        return jsonify({'error': f'Upload failed: {e}'}), 500

@app.route('/api/admin/upload/video-status/<job_id>', methods=['GET'])
@require_admin_auth
def video_job_status(job_id):
    """Poll the status of a background video compression job."""
    job = _video_jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    return jsonify(job)


@app.route('/api/media/<path:filename>', methods=['GET'])
def serve_media(filename):
    """Redirect to Object Storage public URL — avoids buffering through Flask."""
    try:
        if not storage_client:
            return jsonify({'error': 'Object Storage not available'}), 503

        # Try to get a public URL directly (zero Flask bandwidth)
        try:
            public_url = storage_client.get_url(filename)
            from flask import redirect
            return redirect(public_url, code=302)
        except AttributeError:
            pass  # SDK version doesn't support get_url — fall back to stream

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

# ============================================================
# Josephine Chat — 3-layer Q&A Engine
# Layer 1: planning chips (handled in frontend, never reaches here)
# Layer 2: structured_answer()  — free, deterministic, ~80% coverage
# Layer 3: Claude API (Haiku)   — paid, cached, rate-limited
# ============================================================

# ── Fix #4: SQLite-backed Josephine cache + rate limiter ─────────────────
# Survives server restarts; thread-safe via check_same_thread=False + WAL mode.
_CHAT_DB_PATH = os.path.join(BASE_DIR, 'backend', 'data', 'chat_cache.db')

def _get_db():
    """Return a thread-local SQLite connection."""
    import threading
    local = threading.local()
    if not hasattr(local, 'conn'):
        local.conn = sqlite3.connect(_CHAT_DB_PATH, check_same_thread=False)
        local.conn.execute('PRAGMA journal_mode=WAL')
        local.conn.execute('''CREATE TABLE IF NOT EXISTS chat_cache (
            key TEXT PRIMARY KEY,
            reply TEXT NOT NULL,
            ts REAL NOT NULL
        )''')
        local.conn.execute('''CREATE TABLE IF NOT EXISTS rate_log (
            ip TEXT NOT NULL,
            ts REAL NOT NULL
        )''')
        local.conn.execute('CREATE INDEX IF NOT EXISTS idx_rate_ip ON rate_log(ip, ts)')
        local.conn.commit()
    return local.conn

# Initialise on startup
_db_conn = sqlite3.connect(_CHAT_DB_PATH, check_same_thread=False)
_db_conn.execute('PRAGMA journal_mode=WAL')
_db_conn.execute('''CREATE TABLE IF NOT EXISTS chat_cache (
    key TEXT PRIMARY KEY,
    reply TEXT NOT NULL,
    ts REAL NOT NULL
)''')
_db_conn.execute('''CREATE TABLE IF NOT EXISTS rate_log (
    ip TEXT NOT NULL,
    ts REAL NOT NULL
)''')
_db_conn.execute('CREATE INDEX IF NOT EXISTS idx_rate_ip ON rate_log(ip, ts)')
_db_conn.commit()
_db_lock = threading.Lock()

CACHE_TTL              = 86_400   # 24 h
MAX_LLM_CALLS_PER_HOUR = 5        # per IP

_system_prompt_cache = {'prompt': None, 'built_at': 0}  # bust by setting built_at=0

def _cache_get(question: str):
    key = hashlib.sha256(question.lower().strip().encode()).hexdigest()
    cutoff = time.time() - CACHE_TTL
    with _db_lock:
        row = _db_conn.execute(
            'SELECT reply FROM chat_cache WHERE key=? AND ts>?', (key, cutoff)
        ).fetchone()
    return row[0] if row else None


def _cache_set(question: str, reply: str):
    key = hashlib.sha256(question.lower().strip().encode()).hexdigest()
    with _db_lock:
        _db_conn.execute(
            'INSERT OR REPLACE INTO chat_cache(key, reply, ts) VALUES(?,?,?)',
            (key, reply, time.time())
        )
        _db_conn.commit()


def _rate_allowed(ip: str) -> bool:
    now  = time.time()
    hour = now - 3600
    with _db_lock:
        count = _db_conn.execute(
            'SELECT COUNT(*) FROM rate_log WHERE ip=? AND ts>?', (ip, hour)
        ).fetchone()[0]
        if count >= MAX_LLM_CALLS_PER_HOUR:
            return False
        _db_conn.execute('INSERT INTO rate_log(ip, ts) VALUES(?,?)', (ip, now))
        # Prune old entries opportunistically
        _db_conn.execute('DELETE FROM rate_log WHERE ts<?', (hour,))
        _db_conn.commit()
    return True


def _build_system_prompt() -> str:
    """Build (and cache in-process) the Josephine system prompt with all trail+rifugio data."""
    # Rebuild at most once every 5 minutes so live edits propagate
    if _system_prompt_cache['prompt'] and time.time() - _system_prompt_cache['built_at'] < 300:
        return _system_prompt_cache['prompt']

    # --- Trails: strip heavy fields not needed for Q&A ---
    KEEP_TRAIL = {'id','name','region','difficulty','tagline','distance_km','duration_hours',
                  'elevation_gain_m','elevation_loss_m','trail_type','interests','tags',
                  'description','josephineNote','dog_friendly','family_friendly',
                  'best_season','access_info','difficulty_details','rating','facilities',
                  'pois','transport','trailhead_info','nearby_rifugios','crowding',
                  'weather_notes','highlights','opening_season','year_round'}
    raw_trails = load_complete_trails().get('trails', [])
    trails_clean = []
    for t in raw_trails:
        clean = {k: v for k, v in t.items() if k in KEEP_TRAIL}
        # Slim down pois to name+type only
        if 'pois' in clean:
            clean['pois'] = [{'name': p.get('name'), 'type': p.get('type')} for p in clean['pois']]
        trails_clean.append(clean)

    # --- Rifugios: strip photos, keep Q&A fields ---
    KEEP_RIFUGIO = {'id','name','type','region','altitude','contact','facilities','description',
                    'access_info','opening_season','prices','status','nearby_trails',
                    'transport','josephine_note','highlights','booking_required','booking_note'}
    raw_rifugios = load_rifugios()
    rifugios_clean = [{k: v for k, v in r.items() if k in KEEP_RIFUGIO} for r in raw_rifugios]

    # --- Multi-day adventures: slim summary for Josephine context ---
    try:
        with open(MULTI_DAY_TRAILS_FILE) as f:
            adventures_raw = json.load(f).get('trails', [])
        adventures_clean = []
        for adv in adventures_raw:
            slim = {k: adv[k] for k in ('id','name','region','difficulty','total_distance_km',
                                         'duration_days','highlights','booking_strategy',
                                         'emergency_contacts','josephine_adventure_note',
                                         'best_season_start','best_season_end') if k in adv}
            slim['stages'] = [
                {k: s.get(k) for k in ('stage_number','name','distance_km','duration_hours',
                                        'stops','exit_routes','weather_risk')}
                for s in adv.get('stages', [])
            ]
            adventures_clean.append(slim)
    except Exception:
        adventures_clean = []

    today = datetime.now().strftime('%B %d, %Y')

    prompt = f"""You are Josephine — alpine guide, local expert, and the voice of this mountain planning app.
You grew up in Val Gardena and have been guiding in South Tyrol for over a decade.
You know these mountains the way a local does: not just the trails, but the light at 7am on the Odle peaks,
the cook at Rifugio Firenze who makes Schlutzkrapfen from scratch, the bus that doesn't run on Sundays.

TODAY'S DATE: {today}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VOICE & STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• First-person and warm: "I know this valley well…", "Last time I was up there…", "My honest advice…"
• Concise: 2–4 sentences for most answers. More only when the user asks for detail.
• Precise over vague: give real numbers (bus line, price, altitude) not "roughly" or "around".
• Never invent trails, rifugios, or facts not present in your databases below.
• If you genuinely don't know, say so directly and suggest where to check — don't fabricate.
• No emojis. No bullet points in conversational replies — write in flowing sentences.
• Never sound like a chatbot or a tourist brochure. Sound like a friend who lives here.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOUTH TYROL — GEOGRAPHY YOU KNOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
South Tyrol (Alto Adige) sits in the northeastern Italian Alps, bordering Austria and Switzerland.
It is bilingual: every place has both an Italian name and a German name — use both naturally.

Key valleys and their character:
• Val Gardena / Gröden — dramatic Dolomite towers, UNESCO World Heritage, very busy in summer. Main towns: Ortisei/St. Ulrich, Santa Cristina, Selva/Wolkenstein.
• Val Badia / Gadertal — quieter Dolomites, Ladin culture, Alta Badia ski area. Main town: Corvara, San Vigilio di Marebbe.
• Val Pusteria / Pustertal — long east-west valley, gateway to Tre Cime, Pragser Wildsee, more alpine than Dolomitic. Main town: Brunico/Bruneck.
• Val Sarentino / Sarntal — narrow valley north of Bolzano, wild and quiet, ibex country. Main town: Sarentino/Sarnthein.
• Vinschgau / Val Venosta — westernmost valley, driest microclimate, apple orchards, VinschgauBahn train. Main towns: Silandro/Schlanders, Malles/Mals, Naturno/Naturns.
• Merano & Surroundings — sheltered basin, Mediterranean microclimate, thermal spas, Texel Group above. Warmer than Bolzano by 3–5°C in shoulder seasons.
• Bolzano / Bozen — capital, lowest point (~260m), gateway to Rosengarten, Renon plateau, wine country.
• Bressanone / Brixen — university town, Eisacktal valley, gateway to Plose, Alpe di Villandro.

Key mountain groups:
Dolomites (UNESCO) — Odle/Geisler, Sella, Rosengarten/Catinaccio, Sassolungo/Langkofel, Puez-Odle, Fanes-Senes-Braies, Tre Cime/Drei Zinnen.
Western Alps — Ortler (3905m, highest peak in South Tyrol), Texel Group (above Merano), Ötztal Alps.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSPORTATION — WHAT YOU KNOW BY HEART
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SAD buses (Südtiroler Autobus Dienst) run the entire region. Most routes run hourly on weekdays, less on Sundays.
Guests staying in registered accommodation get free bus travel with the Südtirol Guest Pass.
The Alto Adige/Südtirol Pass (€35/day or weekly) covers all local trains, SAD buses, and most cable cars.

Key SAD bus lines:
• Line 170: Bolzano/Merano → Val Gardena (Ortisei, Santa Cristina, Selva). ~55 min Merano→Ortisei. Runs Jun–Oct and ski season.
• Line 201: Merano ↔ Bolzano. Frequent (every 30 min peak). ~35 min.
• Line 221: Merano → Vinschgau → Malles/Mals. The valley line. ~80 min to Malles.
• Line 340: Bressanone → Val di Funes (Santa Maddalena). Jun–Oct, ~every 2h.
• Line 441: Brunico → Val Badia (Corvara, Arabba). ~45 min.
• Line 442: Val Gardena ↔ Val Badia via Passo Gardena. Summer only (Jul–Sep).
• Line 445: Bolzano → Cortina d'Ampezzo. Seasonal (summer only, 2× daily). ~2.5h.
• Line 446: Brunico → Dobbiaco → Cortina. ~1h Brunico→Cortina.

Trains:
• VinschgauBahn (Merano → Malles): scenic, hourly, ~70 min to Malles. Free with Guest Pass.
• BrennerBahn (Bolzano → Brenner): regional train, ~1h to Brenner pass.

Key cable cars / gondolas (summer operation):
• Seceda, Ortisei: gondola → 2450m. ~€22 one way. Open Jun–Oct and Jan–Mar. Book online in July–Aug.
• Alpe di Siusi gondola (Ortisei/Seiser Alm Bahn): open year-round. No private cars on plateau Jun–Oct, must use gondola.
• Merano 2000 (Merano): year-round. ~€22 return. Good access for Texel trails.
• Renon/Ritten cable car (Bolzano): up to plateau, connects to the narrow-gauge Rittnerbahn tram. €16 return.
• Plose (Bressanone): open Jun–Oct, winter ski season. ~€18 return.
• Kronplatz (Brunico): major ski area, summer hiking access. ~€20 return.

Driving notes:
• ZTL zones in Ortisei Jun–Oct (car-free afternoons). Use park-and-ride.
• No private cars on Alpe di Siusi plateau Jun–Oct — park at Compatsch or take gondola.
• Passo Gardena, Passo Sella, Passo Pordoi: open Jun–Oct, closed in winter. Check Viamichelin.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEATHER — WHAT TO EXPECT BY SEASON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summer (Jun–Aug): Mornings are usually clear and stable. Afternoon thunderstorms build from noon and are common by 2–3pm, especially in July–August. Start exposed or high routes by 7–8am and be below the treeline or at a rifugio by 1pm. Lightning on exposed ridges is the main danger.

Spring (Mar–May): Trails below 1500m are walkable from April. Above 1800m, snow can persist until late May or early June — check conditions before going up.

Autumn (Sep–Oct): The most stable season. October is the driest month of the year. Cooler above 2000m but usually clear skies. Larch trees turn gold in Val di Funes and Alpe di Siusi — peak colour mid to late October.

Winter (Nov–Mar): Most trails above 1400m are closed or snow-covered. Snowshoe routes open from December. Check the Lawinenwarndienst (avalanche service) for bulletin before heading out.

Föhn (Foehn): A warm dry south wind, most common in spring and autumn. Makes Merano unseasonably warm (sometimes 18–20°C in February). Good for lower valley walks. Can cause sudden cloud break-ups or build-ups — watch the ridgeline.

Merano microclimate: Protected by the Alps on three sides, Merano has the warmest winters in South Tyrol — palm trees grow here. Mediterranean in character. Trails above town (Texel Group) can still be snowy when Merano itself is shirt-sleeve weather.

Check: meteo.provincia.bz.it for the official South Tyrol mountain forecast (7-day, per valley).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GEAR — WHAT TO TELL PEOPLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Easy trails (T1–T2, up to 2h, under 400m gain):
Walking shoes or light trail runners, 1–1.5L water, sunscreen, thin jacket for the return.

Medium trails (T2–T3, 2–5h, 400–800m gain):
Hiking boots with ankle support (essential on loose Dolomite scree), 2L water, a rain layer, high-calorie snack, trekking poles are helpful.

Hard / alpine (T3–T4, 5h+, 800m+ gain, exposed sections):
Stiff mountain boots, 3L water, full rain gear, first aid kit, emergency thermal blanket, headtorch, map or downloaded GPS track. Via ferrata routes also need a via ferrata set (harness + lanyard).

All seasons: Temperatures drop roughly 6°C for every 1000m you gain in altitude. A 20°C day in Merano can be 8°C at 2500m with wind chill.

Sun: The high-altitude UV index is intense — factor 50 is not overkill above 2000m. Hats and sunglasses are as important as rain gear.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEATHER-GEAR QUICK REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use this when someone asks what to grab given today's weather, or when combining a weather question with a gear question.

☀️  Clear / sunny, below 25°C:
Sunscreen (SPF 50+ above 2000m — Dolomite limestone amplifies UV), sunglasses (polarised best on the white rock), a packable windproof or thin fleece for the summit and the shaded descent. The temperature difference between the valley and 2500m can be 12–15°C.

🌡️  Clear / sunny, 25°C or above (heat day):
As above plus: minimum 2L of water (3L for hard trails), start before 09:00 or go straight to altitude where it stays cooler, avoid the open south-facing ridges between 12:00 and 15:00. Electrolyte tabs or salted nuts help on long hot days.

🌧️  Rain / showers:
A waterproof shell (not just "water-resistant" — Dolomite rain comes sideways). Waterproof hiking boots or gaiters on scree trails. Trekking poles become very useful on wet limestone — it's as slippery as ice. Layer under the shell as it will also be cold. Plan for rifugio stops to warm up.

⛈️  Afternoon thunderstorms (common June–August):
Same kit as rain, but timing is everything — off exposed ridges and via ferratas by 13:00 at the latest. Lightning on the Dolomite towers is extremely dangerous. If you're above the treeline and hear thunder: descend immediately, avoid lone trees or rock pinnacles, crouch low if caught in the open. This is not optional advice.

🌫️  Fog / mist:
Navigation is the main risk — downloaded offline GPS track or a good paper map. The paths are marked (CAI waymarks, SAT blazes) but low cloud can make them hard to spot. Dress for cold and damp; fog feels colder than the temperature suggests. Headtorch if you expect it might not lift.

💨  High wind (above 40 km/h):
A windproof outer layer — even a packable running jacket makes a huge difference on an exposed ridge. Avoid narrow exposed ridges and via ferratas in strong wind; the gusts in the Dolomites can be sudden and violent. Secure your hat and anything loose on your pack.

❄️  Snow / winter:
Above 1500m any time October–May: microspikes or snowshoes depending on depth, trekking poles essential, warm base layer + mid layer + waterproof shell, and always tell someone your route and expected return time. Never trust a summer trail description in winter conditions.

General rules Josephine always mentions:
• Cotton kills — it holds moisture and chills you. Merino wool or synthetic base layers.
• Weather can change in 30 minutes in the Dolomites. A packable layer weighs 200g and can save a day.
• Broken-in boots matter more than expensive ones. Never debut new boots on a mountain.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RIFUGIO & MALGA CULTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Types:
• Rifugio/Schutzhütte: staffed mountain hut, usually with beds (dormitory or private rooms), hot meals, often a terrace. The social heart of alpine hiking here.
• Malga/Alm: working alpine dairy farm, usually open June–September. Simple food: cheese, speck, bread, soup. Milk fresh from the farm. More rustic, no rooms, but often the most authentic stop.
• Bivacco: unstaffed emergency shelter. Always unlocked. No food, just metal bunk beds and an emergency blanket. Free to use.

Half-board (mezza pensione): dinner + bed + breakfast, usually €55–90 per person. Always better value than paying à la carte. Ask for it when booking. Includes the house specialty — never skip it.

Booking: Essential for rifugios July–August, especially weekends. Many rifugios don't use online booking — call directly or email. When you call, say: "Buonasera, vorrei prenotare mezza pensione per [X persone] per la notte del [date]." They will ask where you're coming from (hiking safety protocol).

Check-in is usually from 12pm, tell them if you're arriving after 6pm.

Typical rifugio dishes:
• Schlutzkrapfen: half-moon pasta filled with ricotta and spinach or beetroot, butter-tossed. Typical of Val Gardena. One of my favourites.
• Goulash / Gulasch: beef stew with bread dumplings (Knödel). Warming and substantial.
• Canederli in brodo / Knödel in Brühe: bread dumplings in clear broth.
• Kaiserschmarrn: torn-up sweet pancake with powdered sugar and plum jam. The classic mountain dessert.
• Minestrone: simple vegetable soup, always honest.
• Polenta with mushrooms: common in the Dolomite rifugios.

Drinks: local Weizen beers (Forst, Menabrea), Aperol Spritz on the terrace, house Glühwein in shoulder season. Radler (beer + lemon) for the mid-trail stop.

Tipping: 5–10% is appreciated and normal. Pay in cash — many rifugios don't accept cards.

Dogs: usually welcome outside on the terrace. Ask before bringing them inside. Most malghe are fine with dogs if kept on a lead.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOCAL FOOD & DRINK — YOUR RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These are the things I tell every visitor to try before they leave:

• Speck Alto Adige IGP: smoked and cured ham, aged in mountain air. Nothing like prosciutto — smokier, drier, more intense. Get it with bread and local cheese at any malga.
• Graukäse / Formaggio grigio: pungent grey mountain cheese from Val Sarentino. An acquired taste but extraordinary with vinegar and chives on rye bread.
• Strudel: apple or Topfen (ricotta) strudel, warm from the oven, with Schlagobers (whipped cream). Every rifugio makes it.
• Zelten: a dense Christmas fruit bread made with figs, raisins, pine nuts, anise. Only available November–January. Worth seeking out.
• Weißwein: South Tyrol produces some of Italy's best whites. Pinot Grigio from Terlano, Gewürztraminer from Tramin/Termeno, Müller-Thurgau from the high vineyards. All worth trying.
• Lagrein: the regional red, grown around Bolzano. Deep, slightly tannic, pairs perfectly with goulash.
• Torggelen: the autumn tradition (Sep–Nov) of visiting farm restaurants (Buschenschanken) to taste the new wine (Nuie) and eat roasted chestnuts, Schlutzkrapfen, Speck. The best thing about October in South Tyrol.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRAIL WAYMARKING — HOW IT WORKS HERE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trails are maintained by the CAI (Club Alpino Italiano) and AVS (Alpenverein Südtirol) and marked with red/white paint blazes on rocks, trees, and posts.

Each trail has a number shown on yellow signposts with estimated walking time in hours (not km — because elevation matters more than distance here).

CAI difficulty scale:
• T = Turistico: easy walk, no special gear needed.
• E = Escursionistico: standard hiking trail, boots recommended.
• EE = Escursionistico Esperti: demanding, good fitness and proper boots required, some exposed sections.
• EEA = Attrezzato: via ferrata, requires harness and via ferrata set.

In this region the same paths are also marked by the SAT (Trentino) with the same system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SAFETY & EMERGENCY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Alpine rescue in Italy: call 118 (Soccorso Alpino / CNSAS). Free of charge — Italy does not bill for alpine rescue. Give them your GPS coordinates if possible (iPhone: open Maps → long press → coordinates appear; Android: open Google Maps → blue dot → coordinates).

European emergency number: 112 (works even with no signal on some networks).

Mountain distress signal: 6 whistle blasts (or torch flashes) in one minute, pause one minute, repeat.

Before every route: tell someone your plan — trailhead, destination, expected return time. Leave a note in your car if hiking alone. Download the trail to your phone before leaving (no signal above 1600m in most valleys).

If a storm catches you on an exposed ridge: descend immediately, avoid lone trees and summit crosses (lightning conductors), crouch low away from the highest point, don't lie flat.

If you're injured and can't move: stay on the trail (rescuers search trails first), signal, conserve heat. Emergency blankets weigh 50g — always carry one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO ANSWER SPECIFIC QUESTION TYPES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Opening / closing dates → check opening_season fields in the database; compare to today's date and say whether it is currently open, closed, or opening soon. Be specific (days, not just months).
• Access / directions → use access_info and transport fields. Give both bus and car options if both exist.
• Technical difficulty / exposure → cite difficulty_details.technical, difficulty_details.exposure. Relate it to something concrete ("it means 20 minutes on a narrow path with a drop on one side — not dangerous with care").
• Dog-friendly → dog_friendly boolean (trails) or facilities.dogs (rifugios). If yes, add a practical note about leads near farms.
• Family / children → family_friendly boolean. Also mention duration and elevation — a "family friendly" 4h trail still needs fit children.
• Prices / overnight → prices and facilities fields of the rifugio. Recommend half-board.
• Best time / season → best_season list. Also consider current date and mention if now is ideal or not.
• Weather → cannot give live weather; refer to meteo.provincia.bz.it or the in-app weather tab. Use weather_notes for known local patterns.
• What to pack / gear → use the gear section above; calibrate to the specific trail's difficulty and the current season.
• Crowding / when to go to avoid crowds → use crowding fields. Weekday mornings are quieter everywhere. August is peak month.
• What to eat / where to stop → mention malghe, rifugios on or near the trail. Use the nearby_rifugios field.
• Transport / parking / bus → transport fields. Always mention if there's a bus option — many visitors prefer not to drive.
• Cable car access → cable car info is in the transport knowledge above. If a trail starts from a gondola top station, mention it.
• Emergency / recovery routing → use exit_routes from adventure stages. Give numbered options.
• Planning a multi-day trip → use HUT-TO-HUT ADVENTURES database. Mention booking strategy and best season.
• General "what should I do today" → if you don't have enough context, ask one clarifying question (how long? with kids? any area preference?) rather than guessing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSIDER TIPS — YOUR PERSONAL FIELD NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every trail has a josephineNote.en field and every rifugio/malga has a josephine_note field.
These are YOUR observations from your own visits — specific, personal, not available in any guidebook.

Rules:
• When you recommend or describe a specific trail or rifugio, ALWAYS include its insider tip, woven naturally into your answer.
• Never say "the note says" or "according to the tip" — it's YOUR knowledge.
  Wrong: "The josephine_note says to ask for Schlutzkrapfen."
  Right: "Ask specifically for the Schlutzkrapfen — the cook has been making them from scratch every morning for years."
• If a trail passes a rifugio with a tip, mention it: "There's a malga halfway where the butter is extraordinary — worth the stop."
• One sentence is enough. Don't force it awkwardly; let it be the final line of your answer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT YOU DO NOT DO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• No medical advice. If someone describes an injury or health condition, direct them to a doctor or suggest a shorter/easier trail.
• No real-time conditions. You can't see live trail closures, snow depth, or cable car status. Say so and refer to the local tourist office or the specific rifugio.
• No guarantees. Weather, trail conditions, and rifugio availability all change. Say "normally" or "in my experience" — not "it will be".
• No booking. You can tell them exactly what to say when they call, but this app doesn't handle rifugio bookings directly.
• No politics, no controversy, no opinions on anything outside mountains, hiking, and local culture.

TRAILS DATABASE
{json.dumps(trails_clean, ensure_ascii=False, indent=2)}

RIFUGIOS DATABASE
{json.dumps(rifugios_clean, ensure_ascii=False, indent=2)}

HUT-TO-HUT ADVENTURES DATABASE
{json.dumps(adventures_clean, ensure_ascii=False, indent=2)}
"""
    _system_prompt_cache['prompt'] = prompt
    _system_prompt_cache['built_at'] = time.time()
    return prompt


def _resolve_nearby_rifugios(id_list: list) -> list:
    """
    Given a trail's nearby_rifugios list, return slim objects suitable for the
    chat trail-card (name, type, altitude, open/closed status, booking_required,
    insider note). At most 3 rifugios are returned to keep the card compact.

    Entries are tolerated in any of the historical shapes:
      • string id      ("rif-067")            → enriched from the rifugios table
      • inline dict     ({id?, name, ...})     → table-enriched if id resolves,
                                                  otherwise used as-is
      • free-text name  ("Rifugio Auronzo")    → skipped (no record to show)
    Passing a dict to a dict-keyed lookup previously raised
    "unhashable type: 'dict'" and 500'd the recommend endpoint.
    """
    if not id_list:
        return []
    all_rifugios = load_rifugios()
    rif_by_id = {r['id']: r for r in all_rifugios}
    today = datetime.now().date()

    def _from_record(r):
        season = r.get('opening_season', {}) or {}
        start_s, end_s = season.get('start_date'), season.get('end_date')
        if start_s and end_s:
            try:
                open_now = datetime.strptime(start_s, '%Y-%m-%d').date() <= today <= datetime.strptime(end_s, '%Y-%m-%d').date()
            except Exception:
                open_now = None
        else:
            open_now = True if r.get('type') in ('bivacco', 'bivouac') else None
        return {
            'id':               r.get('id'),
            'name':             r.get('name', ''),
            'type':             r.get('type', 'rifugio'),
            'altitude':         r.get('altitude'),
            'open_now':         open_now,
            'opening_season':   season,
            'booking_required': r.get('booking_required', False),
            'josephine_note':   r.get('josephine_note', ''),
        }

    result = []
    for entry in id_list[:3]:
        # Normalise the entry to (rid, inline-dict).
        if isinstance(entry, str):
            rid, inline = entry, None
        elif isinstance(entry, dict):
            rid, inline = entry.get('id'), entry
        else:
            continue

        r = rif_by_id.get(rid) if isinstance(rid, str) else None
        if r:
            result.append(_from_record(r))
        elif inline:
            # No matching record — render straight from the inline object.
            result.append({
                'id':               inline.get('id'),
                'name':             inline.get('name', ''),
                'type':             inline.get('type', 'rifugio'),
                'altitude':         inline.get('altitude') or inline.get('elevation_m'),
                'open_now':         None,
                'opening_season':   inline.get('opening_season', {}),
                'booking_required': inline.get('booking_required', False),
                'josephine_note':   inline.get('josephine_note', ''),
            })
        # else: bare string that isn't a known id (free-text name) → skip
    return result


def _get_entity_tip(entity_type: str | None, entity: dict | None) -> str:
    """Return the personal insider tip for a trail or rifugio, or '' if none."""
    if not entity:
        return ''
    if entity_type == 'rifugio':
        tip = entity.get('josephine_note', '')
    else:
        # Trails store the note as josephineNote.en or josephineNote (string)
        raw = entity.get('josephineNote') or entity.get('josephine_note') or ''
        if isinstance(raw, dict):
            tip = raw.get('en') or raw.get('it') or raw.get('de') or ''
        else:
            tip = str(raw)
    return tip.strip()


def _fuzzy_match_entity(question: str):
    """
    Returns (entity_type, entity_data) for the best trail or rifugio name match
    found in the question, or (None, None) if nothing matches well enough.
    """
    q = question.lower()
    trails   = load_complete_trails().get('trails', [])
    rifugios = load_rifugios()

    best_score = 0
    best = (None, None)

    def score(name: str) -> int:
        name_l = name.lower()
        words  = [w for w in name_l.split() if len(w) > 3]
        # Full name match scores highest
        if name_l in q:
            return 100
        # Word-level partial match
        return sum(10 for w in words if w in q)

    for t in trails:
        s = score(t.get('name', ''))
        if s > best_score:
            best_score, best = s, ('trail', t)

    for r in rifugios:
        s = score(r.get('name', ''))
        if s > best_score:
            best_score, best = s, ('rifugio', r)

    return best if best_score >= 10 else (None, None)


def _vary(seed_text, options):
    """Pick one phrasing from `options`, stable for a given question text but
    spread across the set for different phrasings — so Josephine doesn't repeat
    the identical sentence to everyone. Deterministic (md5) so it never breaks
    response caching."""
    if not options:
        return ''
    if isinstance(options, str):
        return options
    h = int(hashlib.md5((seed_text or '').encode('utf-8')).hexdigest(), 16)
    return options[h % len(options)]


def structured_answer(question: str):
    """
    Layer 2: deterministic answer from trail/rifugio data.
    Returns a Josephine-voice string if the question can be answered,
    or None if Claude (Layer 3) should handle it.
    """
    q = question.lower()

    # -- Intent keyword sets --
    OPENING_KW  = {'open','opening','close','closing','season','when','start','end','reopen','closed'}
    ACCESS_KW   = {'access','reach','get to','get there','directions','how to go','way to',
                   'from','fastest','quickest','route to','road','drive','hike to','walk to'}
    TECH_KW     = {'technical','danger','dangerous','hard','difficult','exposure','exposed',
                   'steep','via ferrata','risky','safe','safety'}
    DOG_KW      = {'dog','dogs','canine','pet','bring my dog','with dog'}
    FAMILY_KW   = {'family','kids','children','child','toddler','pushchair','stroller'}
    PRICE_KW    = {'price','cost','overnight','stay','bed','beds','accommodation','sleep',
                   'dinner','breakfast','half board','how much'}
    WEATHER_KW   = {'weather','forecast','rain','snow','temperature','wind','storm','cloud'}
    TRANSPORT_KW = {'bus','transport','get there','get to it','car park','parking','drive',
                    'public transport','how to reach','reach by','from merano','from bolzano',
                    'from bressanone','from brunico','from trento','shuttle','cable car'}
    CROWD_KW     = {'crowded','busy','quiet','crowd','too many people','peak season',
                    'avoid crowds','avoid the crowds','when is it less busy','less busy'}
    RECOVERY_KW  = {'exit','had to leave','left the trail','had to descend','emergency exit',
                    'get back on','rejoin','rejoin the trail','missed a stage','fell behind',
                    'skipped','evacuate','caught in weather','bad weather','storm came',
                    'injured','couldn\'t continue'}

    def has(kw_set):
        return any(k in q for k in kw_set)

    entity_type, entity = _fuzzy_match_entity(question)

    # Weather — deflect live-forecast questions, but answer gear-for-weather questions
    GEAR_FOR_WX_KW = {'pack','bring','wear','take','need','sunscreen','sunglasses','raincoat',
                       'rain jacket','waterproof','umbrella','boots','layers','what to bring',
                       'what should i bring','what do i need','what to wear','prepared',
                       'ready for','dress for','kit','jacket','sun cream','factor 50'}
    _is_weather_gear_q = has(WEATHER_KW) and any(k in q for k in GEAR_FOR_WX_KW)

    if _is_weather_gear_q:
        # Rain / storm gear
        if any(k in q for k in ('rain','shower','drizzle','wet','storm','thunder','lightning')):
            return ("Rain in the Dolomites is serious — pack a proper waterproof shell (not just water-resistant), "
                    "and waterproof your boots or bring gaiters. Wet limestone is as slippery as ice, so trekking poles "
                    "help a lot. Layer underneath the shell because it'll be cold too. If there's a storm risk, "
                    "be off any exposed ridge or via ferrata by 13:00 — lightning up here is the main danger and it "
                    "moves fast. Keep an eye on the south sky.")
        # Sun / heat gear
        if any(k in q for k in ('sun','sunny','clear','hot','heat','warm','bright')):
            return ("High-altitude sun is stronger than it looks — Dolomite limestone reflects UV like a mirror. "
                    "SPF 50 is not overkill, especially above 2000m. Polarised sunglasses help on the pale rock. "
                    "Bring at least 2L of water (3L on a hard trail), and if it's above 25°C start early or head "
                    "straight to altitude where it stays cooler. A thin packable layer still belongs in your bag "
                    "— the summit will always be colder than the valley.")
        # Wind gear
        if any(k in q for k in ('wind','windy','gusts','breezy')):
            return ("Wind on the Dolomite ridges can be sudden and strong. A windproof outer shell — even a lightweight "
                    "running jacket — makes a huge difference. Secure your hat, and if gusts are above 40 km/h I'd "
                    "avoid narrow exposed ridges and via ferratas. You'll feel the wind chill mainly on the return, "
                    "so keep a layer accessible.")
        # Fog / mist gear
        if any(k in q for k in ('fog','foggy','mist','misty','cloud','overcast')):
            return ("Fog is mainly a navigation issue — download an offline GPS track or take a paper map. "
                    "The CAI waymarks are good but low cloud can hide them. Dress for cold and damp: fog feels "
                    "colder than the thermometer says. A waterproof shell and warm mid-layer are the kit. "
                    "If you're heading to altitude and the cloud won't lift, a lower-route alternative is worth having.")
        # Snow / winter gear
        if any(k in q for k in ('snow','snowy','ice','icy','frozen','winter','cold')):
            return ("On snow or ice above 1500m: microspikes (for hard packed snow) or snowshoes (for deep snow), "
                    "trekking poles, warm base layer + mid layer + waterproof shell. Never trust a summer trail "
                    "description in winter — the route may be completely different. Tell someone your plan and "
                    "expected return time before you go.")
        # Generic weather-gear question
        return ("It depends what the sky is doing. In short: rain → proper waterproof shell and non-slip boots; "
                "sun → SPF 50, sunglasses, 2L of water minimum; wind → windproof layer; fog → offline GPS track "
                "and warm clothes. Whatever the weather, a thin packable layer and sunscreen belong in every pack "
                "— conditions in the Dolomites can flip in 30 minutes.")

    if has(WEATHER_KW):
        return ("I can't pull live weather from here, but the weather tab "
                "shows the current forecast and a 7-day outlook for any trail coordinates. "
                "Check it before you head out!")

    # ── General knowledge answers (no entity needed) ─────────────────────────
    GEAR_KW     = {'pack','bring','wear','gear','equipment','boots','shoes','poles',
                   'what to take','what do i need','what should i have','backpack','layers',
                   'sunscreen','sunglasses','sun cream','rain jacket','raincoat','waterproof',
                   'windproof','wind layer','cotton','merino','base layer','mid layer','jacket'}
    FOOD_KW     = {'eat','food','rifugio food','what to eat','menu','dish','dishes',
                   'typical food','local food','schlutzkrapfen','knödel','canederli',
                   'strudel','speck','goulash','kaiserschmarrn','what to order'}
    RIFUGIO_GENERAL_KW = {'book a rifugio','book rifugio','how to book','booking','reserve',
                           'how do rifugios work','what is a rifugio','rifugio etiquette',
                           'half board','mezza pensione','overnight in','stay overnight',
                           'sleep at','bivacco','malga'}
    BUS_GENERAL_KW = {'how do i get around','public transport south tyrol','sad bus',
                      'guest pass','südtirol pass','alto adige pass','vinschgaubahn',
                      'cable car south tyrol','gondola','seceda cable car how much',
                      'how much is the cable car','bus south tyrol'}
    EMERGENCY_KW = {'emergency','rescue','help','injured','accident','118','112',
                    'mountain rescue','soccorso alpino','what if i get lost','lost on the trail',
                    'storm on the mountain','caught in a storm','lightning'}

    # General knowledge intents — answer from the bible regardless of entity match.
    # These are questions about categories, not specific trails/rifugios.
    _is_gear_q     = has(GEAR_KW) and any(w in q for w in ('pack','bring','wear','gear','equipment','boots','what to take','what do i need','what should i'))
    _is_food_q     = has(FOOD_KW) and not any(w in q for w in ('how far','how long','distance','rating'))
    _is_booking_q  = any(k in q for k in ('how to book','book a rifugio','book rifugio','how do i book','reserve a rifugio','rifugio booking','half board','mezza pensione','overnight in a','stay overnight'))
    _is_rifugio_q  = any(k in q for k in ('what is a rifugio','how do rifugios work','rifugio etiquette','what is a malga','what is a bivacco','bivacco open'))
    _is_bus_q      = any(k in q for k in ('how do i get around','public transport','sad bus','guest pass','südtirol pass','alto adige pass','vinschgaubahn','cable car south','gondola south','how much is the cable','bus south tyrol','how to get around'))
    _is_emergency_q = has(EMERGENCY_KW) and any(w in q for w in ('emergency','rescue','118','112','mountain rescue','soccorso','get lost','lost on','storm on','caught in','lightning','injured'))

    if _is_gear_q:
        if any(w in q for w in ('easy','simple','beginner','flat','short')):
            return ("For an easy trail, walking shoes or light trail runners are fine — no need for heavy boots. "
                    "Bring 1.5L of water, sunscreen (Alpine UV is intense even on overcast days), and a light jacket for the return. "
                    "That's genuinely all you need.")
        if any(w in q for w in ('hard','difficult','alpine','via ferrata','summit','exposed','demanding')):
            return ("For hard or alpine routes, stiff mountain boots are non-negotiable — Dolomite scree will destroy trail runners. "
                    "Carry 3L of water, a full rain layer, first-aid kit, an emergency thermal blanket, and download the GPS track before leaving (no signal above 1600m usually). "
                    "Via ferrata routes also need a harness and lanyard.")
        return _vary(q, [
            ("For a medium hike the most important thing is hiking boots with ankle support — Dolomite scree demands it. "
             "Pack 2L of water, a rain layer (afternoon thunderstorms are common June–August, aim to be below the treeline by 1pm), a snack, and sunscreen. "
             "Trekking poles help significantly on the descent. "
             "Temperatures drop roughly 6°C per 1000m, so always bring a layer even on a warm valley day."),
            ("Think layers and good footwear. Boots with a grippy sole and ankle support, 2L of water, and a packable waterproof — "
             "the weather flips fast above the treeline. Add sunscreen and a hat (UV is fierce on the pale rock), a couple of snacks, "
             "and poles for the knees on the way down. A warm mid-layer earns its place in the bag even in July: "
             "it's roughly 6°C colder for every 1000m you climb."),
        ])

    if _is_food_q:
        return _vary(q, [
            ("The things I always tell people to try: Schlutzkrapfen — half-moon pasta filled with ricotta and spinach, butter-tossed. "
             "The best version I know is in Val Gardena. Also Speck with rye bread and local cheese at any malga stop, "
             "Kaiserschmarrn for dessert, and a cold Weizen on the terrace. "
             "If you're visiting in autumn, Torggelen — going to farm restaurants for new wine and roasted chestnuts — is worth planning a whole day around."),
            ("South Tyrol food is half Italian, half Austrian, and all worth your appetite. Start with Speck and a slab of mountain cheese, "
             "then Knödel (Canederli) — bread dumplings in broth or with butter and cheese. Schlutzkrapfen if you see them fresh-made. "
             "For dessert it's Kaiserschmarrn or apple strudel, no debate. Wash it down with a Weizen or a glass of local Vernatsch. "
             "Eat your big meal at a malga or rifugio at altitude — it always tastes better up there."),
        ])

    if _is_booking_q:
        return _vary(q, [
            ("Most rifugios don't use online booking — call them directly. "
             "Say: 'Buonasera, vorrei prenotare mezza pensione per [number] persone per la notte del [date].' "
             "They'll ask which trail you're arriving on — that's a safety protocol, not just curiosity. "
             "July and August weekends fill up 2–3 weeks out. Half-board (dinner + bed + breakfast) is better value than à la carte — ask for it specifically."),
            ("Booking a rifugio is old-school: phone, not website. A few words of Italian go a long way — ask for 'mezza pensione' (half board), "
             "which is bed, dinner and breakfast, and almost always the best deal. Bring a sleeping-bag liner (sacco lenzuolo) — most huts require one. "
             "Weekends in high summer book out weeks ahead, so call early, and let them know roughly when and via which trail you'll arrive."),
        ])

    if _is_rifugio_q:
        return _vary(q, [
            ("A rifugio is a staffed mountain hut — meals, beds, and usually a terrace with a view. "
             "A malga is a working alpine dairy farm, simpler, often just cheese, bread, and soup, but sometimes the most honest stop on the trail. "
             "Bivacchi are unstaffed emergency shelters — always unlocked, always free, no food. "
             "Tipping 5–10% is normal at rifugios, and most prefer cash."),
            ("Three kinds of mountain stop up here: a rifugio is the full experience — staffed, hot meals, a bed, sometimes a hot shower. "
             "A malga is a real dairy farm that feeds passing hikers; simple, cheap, unforgettable cheese. "
             "A bivacco is a bare metal or stone shelter, always open and free, meant for emergencies or self-sufficient nights. "
             "At rifugios bring cash, a liner sheet for the bunk, and your own slippers if you're fussy — they swap your boots for hut shoes at the door."),
        ])

    if _is_bus_q:
        return _vary(q, [
            ("SAD buses cover the whole region — most routes run hourly on weekdays, less on Sundays. "
             "Guests in registered accommodation get the Südtirol Guest Pass, which makes all SAD buses free. "
             "The Alto Adige/Südtirol Pass includes buses, most trains, and the main cable cars. "
             "The VinschgauBahn from Merano to Malles is one of the most scenic rail journeys in the Alps."),
            ("Public transport here is genuinely good. The integrated network (bus + train + many cable cars) runs on the Südtirol Pass, "
             "and if you're staying overnight ask your host for the free Guest Pass — it covers the SAD buses. "
             "Timetables and live times are on the 'suedtirolmobil' app or sad.it. Plan around Sunday/holiday reductions, and check the last bus back "
             "before you commit to a one-way hike — valley services can stop surprisingly early."),
        ])

    if _is_emergency_q:
        return _vary(q, [
            ("Alpine rescue in Italy: call 118 (Soccorso Alpino) — completely free, no billing ever. "
             "If you can, give them your GPS coordinates — on iPhone open Maps, long-press the screen, the coordinates appear at the top. "
             "The mountain distress signal is 6 whistle blasts or torch flashes per minute. "
             "If a storm catches you on an exposed ridge: descend immediately, crouch away from the high point, avoid lone trees and summit crosses. "
             "Always tell someone your plan before heading out."),
            ("In an emergency call 118 — that's mountain rescue (Soccorso Alpino), and it's free. The Europe-wide 112 works too and can locate you. "
             "Install the GeoResQ or 'Where ARE U' app beforehand so it can send your exact position. "
             "Six signals a minute (whistle, light or shout) is the recognised call for help; three a minute is the reply. "
             "Caught by lightning on a ridge? Get down fast, ditch metal poles, and crouch low on your pack away from the summit cross. "
             "And always leave your route and return time with someone in the valley."),
        ])

    # ── More general-knowledge topics (no specific trail/rifugio needed) ──────
    # These broaden Josephine's "bible" so far fewer everyday questions fall
    # through to the generic fallback. Triggers are deliberately multi-word /
    # specific so they don't hijack questions about a named place.

    # WHEN TO START / time of day
    if any(k in q for k in ('what time should i start','when should i start','best time of day','what time to set off',
                            'how early should i','too late to start','start early','what time do i','when to set off')):
        return _vary(q, [
            ("Start early — it's the single best habit in these mountains. Be walking by 8, ideally 7 in high summer. "
             "Afternoon thunderstorms build fast from about 13:00–14:00, so an early start gets you off the exposed ground before they arrive, "
             "gives you the quiet trails and the best light, and leaves a margin if anything runs long."),
            ("Early. Always earlier than feels necessary. The classic Dolomite pattern is clear mornings and building cloud after lunch, "
             "with storms possible by mid-afternoon, so aim to summit or turn around by around midday. "
             "An 7–8am start also means parking is still free and the rifugio terraces aren't packed yet."),
        ])

    # DRINKING WATER / refills
    if any(k in q for k in ('drinking water','refill water','water on the trail','is the water safe','fill up water',
                            'water source','water sources','can i drink','where to fill','springs on the','fountain',
                            'tap water','water fountain','enough water')):
        return ("Carry 2L as a baseline, 3L on a hot or hard day. You can refill at rifugios and at most village fountains "
                "(if it doesn't say 'Kein Trinkwasser / Acqua non potabile', it's drinkable). High mountain streams look pristine "
                "but can have livestock upstream, so I wouldn't drink untreated unless you have a filter or purification tablets. "
                "Malghe will almost always top up your bottle if you ask nicely.")

    # CASH / CARDS
    if any(k in q for k in ('cash or card','do they take card','credit card','accept card','accept cards','need cash',
                            'how much cash','take cards','pay by card','contactless','bancomat','do i need cash','atm')):
        return ("Bring cash. Many rifugios and malghe are card-friendly now, but signal is patchy up high and card machines fail, "
                "so I always carry enough euros to cover meals, a bed and a drink or two. Smaller dairy farms are often cash-only. "
                "Draw money in the valley — ATMs (Bancomat) are easy to find in towns but non-existent on the mountain.")

    # ALTITUDE / acclimatization
    if any(k in q for k in ('altitude sickness','acclimat','high altitude','elevation sickness','thin air','soroche',
                            'dizzy at altitude','altitude affect','get altitude')):
        return ("Good news — most of South Tyrol's trails top out between 2000 and 3000m, where serious altitude sickness is uncommon. "
                "You might feel a little more breathless and tire faster than at home, so pace yourself, hydrate well, and don't gain "
                "huge height too fast if you've come straight from sea level. On the 3000m+ summits and glaciers, take it slow and turn "
                "back if you get a persistent headache, nausea or dizziness — that's your body telling you to descend.")

    # NAVIGATION / trail markings
    if any(k in q for k in ('trail marking','waymark','way-mark','cai number','red and white','red-white','get lost',
                            'how do i navigate','offline map','gps track','trail sign','signpost','blaze','follow the trail',
                            'trail number','path number','how are trails marked','find my way')):
        return ("Trails here use the CAI system: red-white-red paint flashes and numbered signposts at every junction. "
                "Each path has a number — note the numbers for your route rather than place names, since signs list many destinations. "
                "Red-white-red is a normal footpath; a number on a red background usually means a more demanding or via-ferrata route. "
                "Phone signal drops above the valleys, so download an offline map or GPS track (Komoot, Outdooractive or maps.me) before you set off.")

    # FITNESS / preparation
    if any(k in q for k in ('how fit','fitness level','fit enough','get in shape','prepare physically','out of shape',
                            'how hard is hiking','training for','am i fit','do i need to be fit')):
        return ("You don't need to be an athlete — you need a realistic match between the route and your legs. "
                "If you can walk briskly for 2–3 hours with some uphill, plenty of easy and medium trails are open to you. "
                "The honest test is descent: knees and ankles take a beating going down, so poles help and steady pacing beats speed. "
                "Tell me how long you usually walk and how much climbing feels comfortable, and I'll point you at trails that fit.")

    # PHOTOGRAPHY / best light
    if any(k in q for k in ('photography','best photo','photo spot','where to take photos','sunrise spot','sunset spot',
                            'golden hour','best views for photos','instagram','drone','take pictures','photogenic')):
        return ("The Dolomites glow at dawn and dusk — that pink-gold light on the rock is called enrosadira, and it's worth setting an alarm for. "
                "For sunrise, places like Seceda, the Alpe di Siusi and the Tre Cime saddle are unbeatable; for sunset, anywhere with the peaks to your east. "
                "Shoot in the first and last hour of light, bring a small tripod for the low sun, and remember drones are restricted in the nature parks — "
                "check local rules before you fly. Tell me your area and I'll suggest a viewpoint.")

    # CONNECTIVITY / phone signal
    if any(k in q for k in ('phone signal','cell signal','mobile signal','reception','wifi on the trail','data coverage',
                            'sim card','no signal','internet on the','phone reception','will i have signal')):
        return ("Don't count on it. Coverage is good in the valleys and towns but disappears on the far side of a ridge or in deep valleys, "
                "and even rifugio WiFi is slow and weather-dependent. Download your maps, tickets and trail notes offline before you leave, "
                "tell someone your plan, and keep your phone in battery-saver — its real job up there is the GPS and the emergency call, not Instagram.")

    # LANGUAGE
    if any(k in q for k in ('what language','do they speak english','speak english','useful phrases','italian phrases',
                            'german phrases','how do i say','language in south tyrol','which language','english spoken')):
        return ("South Tyrol is trilingual: German is the everyday language for most locals, Italian is official everywhere, and in a few "
                "Dolomite valleys they speak Ladin. English is widely understood in tourist areas. A few words go a long way though — "
                "'Grüß Gott' (hello), 'Danke' (thanks), 'Buongiorno' and 'Grazie' all earn a smile. In a rifugio, "
                "'Ein Bier, bitte' or 'Un'acqua, per favore' will never fail you.")

    # MOUNTAIN GUIDE
    if any(k in q for k in ('hire a guide','mountain guide','guided tour','guided hike','do i need a guide','alpine guide',
                            'need a guide','book a guide')):
        return ("For marked trails you don't need a guide — good preparation and an offline map are enough. "
                "But for glaciers, harder via ferrate, or any off-trail/alpine objective, a certified mountain guide (Bergführer / guida alpina) "
                "is money well spent: they carry the safety kit, read the conditions, and know the escape routes. "
                "Local guiding offices and alpine schools in the main valleys can pair you with one — book a few days ahead in peak season.")

    # TOILETS / facilities
    if any(k in q for k in ('toilet','bathroom',' wc','restroom','where can i pee','where to go to the bathroom')):
        return ("Rifugios and malghe have toilets — a small coin or a purchase is the polite norm at the busier ones. "
                "Between huts there's nothing, so go before you leave the last one. If you're caught out, step well away from the path and "
                "any water source, and pack out any paper — these are protected landscapes and they stay beautiful because people take their litter home.")

    # WHO ARE YOU / WHAT CAN YOU DO
    if any(k in q for k in ('who are you','what are you','what can you do','what do you do','how can you help',
                            'your name','what is your name','how do you work','what are you for')):
        return ("I'm Josephine — your alpine companion for South Tyrol and the Dolomites. "
                "I can plan your day around the weather and how you're feeling, recommend trails and rifugios, "
                "and answer the practical stuff: opening seasons, how to get there, gear, dogs, difficulty, food, and emergencies. "
                "Tell me how much time you have and what kind of day you want, and I'll build it for you.")

    # SIMPLE GREETING
    if q.strip() in {'hi','hello','hey','ciao','hallo','salve','hi!','hello!','hey!','good morning','good afternoon','good evening','servus','grüß gott'} \
       or any(q.strip().startswith(g) for g in ('hi ','hello ','hey ','ciao ','hallo ')):
        return _vary(q, [
            ("Hello! Lovely to see you. Shall I find you a trail for today — tell me how much time you have and the kind of day you're after?"),
            ("Hi there! Ready for a mountain day? Give me your mood and your spare hours and I'll plan something that fits."),
            ("Grüß Gott! I'm all yours — want a trail recommendation, a rifugio, or just some local know-how?"),
        ])

    # Need an entity for most answers
    if entity is None:
        return None   # fall through to Layer 3

    name = entity.get('name', 'this location')

    # OPENING / SEASON
    if has(OPENING_KW):
        if entity_type == 'rifugio':
            season = entity.get('opening_season', {})
            start, end = season.get('start_date'), season.get('end_date')
            if start and end:
                try:
                    from datetime import datetime as dt
                    today_d  = dt.now().date()
                    start_d  = dt.strptime(start, '%Y-%m-%d').date()
                    end_d    = dt.strptime(end,   '%Y-%m-%d').date()
                    if today_d < start_d:
                        days = (start_d - today_d).days
                        status = f"currently closed — it opens in {days} day{'s' if days != 1 else ''}, on {start}"
                    elif today_d > end_d:
                        status = f"closed for the season (was open until {end})"
                    else:
                        status = f"open right now until {end}"
                except Exception:
                    status = f"open from {start} to {end}"
                return (f"{name} is {status}. "
                        f"If you're planning ahead, I'd book well in advance — the good rifugios fill up fast.")
            else:
                rtype = entity.get('type', 'rifugio')
                if rtype == 'bivacco':
                    return f"{name} is a bivacco — it stays open year-round, no reservation needed."
                return f"I don't have specific season dates for {name} yet. Check their website or contact them directly."
        else:  # trail
            best_season = entity.get('best_season', [])
            if best_season:
                season_str = ', '.join(best_season)
                current = datetime.now().strftime('%B')
                in_season = current in best_season
                state = "you're in the right window" if in_season else f"right now ({current}) is outside the ideal window"
                return (f"The best time for {name} is {season_str} — {state}. "
                        f"Outside that period the path can be snowy or access roads closed.")
            return f"I don't have season restrictions for {name} — it should be walkable most of the year, conditions permitting."

    # ACCESS / DIRECTIONS
    if has(ACCESS_KW):
        access = entity.get('access_info', '')
        if access:
            return f"To reach {name}: {access}"
        return (f"I don't have turn-by-turn directions for {name} in my notes yet. "
                f"I'd suggest checking the trail map in the app or a recent GPS track on Komoot.")

    # TECHNICAL / DANGER
    if has(TECH_KW):
        if entity_type == 'trail':
            dd = entity.get('difficulty_details', {})
            tech     = dd.get('technical', entity.get('difficulty', 'unknown'))
            exposure = dd.get('exposure',  'unknown')
            fitness  = dd.get('fitness',   'unknown')
            diff     = entity.get('difficulty', 'unknown')
            return (f"{name} is rated {diff} overall. "
                    f"Technically it's {tech}, with {exposure} exposure and {fitness} fitness demand. "
                    f"{'It is well within reach for most hikers.' if diff == 'easy' else 'Make sure your footwear has good grip.' if diff == 'medium' else 'I recommend it only for confident, experienced hikers.'}")
        else:
            return (f"{name} is a rifugio — the approach difficulty depends on which trail you take to reach it. "
                    f"Check the access info and pick a route that matches your level.")

    # DOG-FRIENDLY
    if has(DOG_KW):
        if entity_type == 'trail':
            dog_ok = entity.get('dog_friendly')
            if dog_ok is True:
                return f"Good news — {name} is dog-friendly! Keep your dog on a lead near the farms and wildlife areas."
            elif dog_ok is False:
                return f"{name} doesn't allow dogs, unfortunately. Wildlife protection rules in this area restrict it."
            return f"I don't have confirmed dog-friendly info for {name} — check with the local forestry office to be sure."
        else:  # rifugio
            dogs_ok = entity.get('facilities', {}).get('dogs')
            if dogs_ok is True:
                return f"{name} welcomes dogs — just mention it when you book so they can prepare."
            elif dogs_ok is False:
                return f"{name} doesn't accept dogs, I'm afraid. If you're hiking with your dog, I can suggest an alternative."
            return f"I'm not sure whether {name} accepts dogs — give them a call to confirm before you arrive."

    # FAMILY / KIDS
    if has(FAMILY_KW):
        if entity_type == 'trail':
            fam = entity.get('family_friendly')
            diff = entity.get('difficulty', '')
            if fam is True:
                return (f"{name} is family-friendly — great choice for a day out with kids. "
                        f"It's rated {diff}, so even younger hikers should manage well.")
            elif fam is False:
                return (f"{name} isn't really suitable for young children — "
                        f"the terrain is {diff} and can be challenging for little legs.")
            return f"I don't have family-suitability info for {name} specifically — the {entity.get('difficulty','unknown')} rating gives you a rough idea."
        return f"{name} should be fine for families — rifugios are used to all ages. Call ahead to check facilities for kids."

    # PRICES / STAY
    if has(PRICE_KW):
        if entity_type == 'rifugio':
            prices = entity.get('prices', {})
            beds   = entity.get('facilities', {}).get('beds', 0)
            parts  = []
            if prices.get('overnight'): parts.append(f"overnight €{prices['overnight']}")
            if prices.get('half_board'): parts.append(f"half board €{prices['half_board']}")
            if prices.get('breakfast'): parts.append(f"breakfast €{prices['breakfast']}")
            if prices.get('dinner'):    parts.append(f"dinner €{prices['dinner']}")
            price_str = ', '.join(parts) if parts else 'pricing not in my notes'
            beds_str  = f" They have {beds} beds, so book early." if beds else ""
            return f"{name}: {price_str}.{beds_str} Contact them directly to confirm availability."
        return f"Prices for trails are free to walk — you're asking about the wrong kind of spend! Did you mean a rifugio nearby?"

    # TRANSPORT / BUS / PARKING
    if has(TRANSPORT_KW):
        transport = entity.get('transport', {})
        if transport:
            parts = []
            if transport.get('bus'):
                parts.append(f"By bus: {transport['bus']}")
            if transport.get('car'):
                parts.append(f"By car: {transport['car']}")
            if parts:
                return f"Getting to {name} — {' | '.join(parts)}"
        access = entity.get('access_info', '')
        if access:
            return f"To reach {name}: {access}"
        return (f"I don't have transport details for {name} in my notes yet. "
                f"Check the trail map in the app or search 'sad.it' for bus timetables in South Tyrol.")

    # CROWDING
    if has(CROWD_KW):
        crowding = entity.get('crowding', {})
        if crowding:
            level = crowding.get('level', 'unknown')
            peak  = ', '.join(crowding.get('peak_months', [])) if crowding.get('peak_months') else 'summer'
            tip   = crowding.get('quiet_tip', '')
            reply = f"{name} typically sees {level} visitor numbers, with the busiest period in {peak}."
            if tip:
                reply += f" My tip: {tip}"
            return reply
        return (f"I don't have crowd information for {name} in my data. "
                f"Generally, South Tyrol trails are busiest in July and August — weekday mornings are always quieter.")

    # RECOVERY ROUTING (hut-to-hut adventure exits)
    if has(RECOVERY_KW):
        # Try to match a multi-day adventure
        try:
            with open(MULTI_DAY_TRAILS_FILE) as f:
                adventures = json.load(f).get('trails', [])
        except Exception:
            adventures = []

        best_adv = None
        best_score = 0
        for adv in adventures:
            adv_name = adv.get('name', '').lower()
            adv_words = [w for w in adv_name.split() if len(w) > 3]
            sc = sum(10 for w in adv_words if w in q)
            if adv_name in q:
                sc = 100
            if sc > best_score:
                best_score, best_adv = sc, adv

        if best_adv and best_score >= 10:
            # Try to detect day/stage number
            import re
            day_match = re.search(r'\b(?:day|stage|giorno|etappe)\s*(\d+)\b', q)
            stage_num = int(day_match.group(1)) if day_match else None
            stages = best_adv.get('stages', [])
            stage = None
            if stage_num:
                stage = next((s for s in stages if s.get('stage_number') == stage_num), None)
            if not stage and stages:
                stage = stages[0]  # default to first stage

            if stage and stage.get('exit_routes'):
                exit_r = stage['exit_routes'][0]
                reply = (f"No problem — for {best_adv['name']}, Stage {stage.get('stage_number', '?')}: "
                         f"{exit_r.get('description', '')} "
                         f"Transport: {exit_r.get('transport', 'check local transport')}.")
                rejoining = exit_r.get('rejoining_options', [])
                if rejoining:
                    reply += " To get back on trail, you have two options: "
                    reply += " OR ".join(f"({i+1}) {o.get('how','')}" for i, o in enumerate(rejoining[:2]))
                return reply

        return (f"For emergency exits and recovery routing on a multi-day adventure, "
                f"the key rule is: follow any red-white-red marked path downhill to the nearest valley. "
                f"Then call mountain rescue (118) or SAD transport (sad.it). "
                f"Tell me which specific adventure and day you're on and I'll give you precise options.")

    # Entity matched but intent unclear → let Layer 3 handle
    return None


@app.route('/api/chat', methods=['POST'])
def josephine_chat():
    """
    Josephine free-form Q&A — 3-layer engine.
    Layer 2 (structured) fires first; Layer 3 (Claude) only if needed.
    """
    body    = request.get_json(silent=True) or {}
    message = body.get('message', '').strip()
    history = body.get('history', [])[-10:]   # last 5 pairs max
    lang    = body.get('lang', 'en')[:2].lower()   # 'en', 'it', 'de'
    # Optional: factual context about the trail the user is currently viewing,
    # so the LLM can answer about "it" without inventing details.
    context = (body.get('context') or '').strip()[:1500]

    # Language instruction appended to system prompt
    LANG_INSTRUCTIONS = {
        'it': "IMPORTANT: Respond in Italian (italiano). All your answers must be in Italian.",
        'de': "IMPORTANT: Respond in German (Deutsch). All your answers must be in German.",
    }
    lang_instruction = LANG_INSTRUCTIONS.get(lang, '')

    # Fallback messages in the right language
    NO_KEY_REPLIES = {
        'it': ("Conosco bene queste montagne, ma questa domanda richiede un po' più di riflessione. "
               "Prova a chiedermi gli orari di apertura, come raggiungere un posto, "
               "la difficoltà del sentiero o se sono ammessi i cani — rispondo subito!"),
        'de': ("Ich kenne diese Berge gut, aber diese Frage braucht etwas mehr Überlegung. "
               "Frag mich nach Öffnungszeiten, wie man einen Ort erreicht, der Wegschwierigkeit "
               "oder ob Hunde erlaubt sind — das beantworte ich sofort!"),
    }
    RATE_LIMIT_REPLIES = {
        'it': ("Ho risposto a molte domande oggi — dammi qualche minuto per riprendere fiato! "
               "Nel frattempo, il pulsante 'Pianifica la mia giornata' ti troverà subito il sentiero perfetto."),
        'de': ("Ich habe heute viele Fragen beantwortet — gib mir ein paar Minuten zum Durchatmen! "
               "Inzwischen findet dir der Button 'Meinen Tag planen' sofort den perfekten Weg."),
    }

    if not message:
        return jsonify({'error': 'message required'}), 400

    # ── Layer 2: structured lookup (free) ──────────────────────────────
    structured = structured_answer(message)
    if structured:
        # Append insider tip when the question was about a specific place
        entity_type, entity = _fuzzy_match_entity(message)
        tip = _get_entity_tip(entity_type, entity)
        if tip:
            structured = structured + f" — and one thing I always mention: {tip}"
        return jsonify({'reply': structured, 'mode': 'structured'})

    # ── Layer 3: Claude Haiku (paid, with cache + rate limit) ──────────
    if not ANTHROPIC_API_KEY:
        default_no_key = _vary(message, [
            ("I know these mountains well, but that one's a bit beyond what I can answer offline. "
             "Try me on opening seasons, how to reach a place, trail difficulty, gear, dogs, food or "
             "getting around — or tap 'Plan my day' and I'll build you a route right now."),
            ("Good question — let me steer us somewhere I can really help. Ask me about a trail or rifugio, "
             "what to pack, the best time to set off, whether dogs are welcome, or how to get there by bus. "
             "Or just tell me how much time you have and I'll plan your day."),
            ("That's a little outside my map, but I'm great with the practical stuff: seasons, access, difficulty, "
             "gear, water, cash, food and dogs. Want me to suggest a trail for today instead? Tell me your mood and your hours."),
        ])
        return jsonify({
            'reply': NO_KEY_REPLIES.get(lang, default_no_key),
            'mode': 'no_key'
        })

    # Cache key includes language so EN/IT/DE are cached separately
    cache_key = f"{lang}:{message}"
    cached = _cache_get(cache_key)
    if cached:
        return jsonify({'reply': cached, 'mode': 'cached'})

    # Rate limit per IP
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '0.0.0.0').split(',')[0].strip()
    if not _rate_allowed(ip):
        return jsonify({
            'reply': RATE_LIMIT_REPLIES.get(lang,
                "I've been answering a lot of questions today — give me a few minutes to catch my breath! "
                "While you wait, the 'Plan my day' button will find you the perfect trail right now."),
            'mode': 'rate_limited'
        })

    try:
        system_prompt = _build_system_prompt()
        if context:
            system_prompt = system_prompt + (
                "\n\nThe user is currently looking at this trail. If they ask about "
                "'it' or 'this trail', answer using ONLY these facts and do not invent "
                f"anything beyond them:\n{context}"
            )
        if lang_instruction:
            system_prompt = system_prompt + f"\n\n{lang_instruction}"
        response = _anthropic_client.messages.create(
            model='claude-haiku-4-5',
            max_tokens=400,
            system=system_prompt,
            messages=history + [{'role': 'user', 'content': message}],
        )
        reply = response.content[0].text
        _cache_set(cache_key, reply)
        return jsonify({'reply': reply, 'mode': 'llm'})

    except Exception as e:
        print(f"Josephine LLM error: {e}")
        return jsonify({
            'reply': "The mountain winds are interfering with my signal — try again in a moment!",
            'mode': 'error'
        })


# ── Donations (Lemon Squeezy "buy me a coffee") ──────────────────────────────
@app.route('/api/donate/config', methods=['GET'])
def donate_config():
    """Public config the donate page needs to render: whether donations are
    live, the price of one 'coffee', the currency and suggested quantities."""
    return jsonify({
        'enabled':       DONATIONS_ENABLED,
        'coffee_price':  DONATION_COFFEE_PRICE_CENTS,   # cents
        'currency':      DONATION_CURRENCY,
        'presets':       [1, 3, 5],                     # quick-pick coffee counts
        'max_coffees':   DONATION_MAX_COFFEES,
    })


@app.route('/api/donate/checkout', methods=['POST'])
def donate_checkout():
    """Create a Lemon Squeezy checkout for an N-coffee donation and return its
    hosted checkout URL. The amount is computed server-side (never trusted from
    the client) as coffees × unit price."""
    if not DONATIONS_ENABLED:
        return jsonify({'error': 'donations_disabled',
                        'message': 'Donations are not configured yet.'}), 503

    data = request.get_json(silent=True) or {}

    # Resolve the number of coffees (preferred) or a raw amount in cents.
    try:
        coffees = int(data.get('coffees') or 0)
    except (TypeError, ValueError):
        coffees = 0
    if coffees > 0:
        amount_cents = coffees * DONATION_COFFEE_PRICE_CENTS
    else:
        try:
            amount_cents = int(data.get('amount_cents') or 0)
        except (TypeError, ValueError):
            amount_cents = 0
        coffees = max(1, round(amount_cents / DONATION_COFFEE_PRICE_CENTS)) if amount_cents else 0

    # Clamp to sane bounds.
    min_cents = DONATION_COFFEE_PRICE_CENTS
    max_cents = DONATION_COFFEE_PRICE_CENTS * DONATION_MAX_COFFEES
    if amount_cents < min_cents or amount_cents > max_cents:
        return jsonify({'error': 'invalid_amount',
                        'message': f'Donation must be between {min_cents} and {max_cents} cents.'}), 400

    name    = (data.get('name')    or '').strip()[:100]
    email   = (data.get('email')   or '').strip()[:200]
    message = (data.get('message') or '').strip()[:500]

    attributes = {
        'custom_price': amount_cents,
        'product_options': {
            'redirect_url': f"{APP_BASE_URL}/#donate" if APP_BASE_URL else None,
            'receipt_thank_you_note': "Thank you for supporting Josephine — it genuinely keeps the trails alive! ☕",
        },
        'checkout_data': {
            'custom': {
                'coffees': str(coffees),
                'source':  'josephine-app',
                **({'message': message} if message else {}),
            },
        },
        'checkout_options': {'embed': False, 'dark': True},
    }
    if name:
        attributes['checkout_data']['name'] = name
    if email:
        attributes['checkout_data']['email'] = email
    # Drop a null redirect_url so we don't send an invalid value.
    if not attributes['product_options']['redirect_url']:
        attributes['product_options'].pop('redirect_url')

    payload = {
        'data': {
            'type': 'checkouts',
            'attributes': attributes,
            'relationships': {
                'store':   {'data': {'type': 'stores',   'id': str(LEMONSQUEEZY_STORE_ID)}},
                'variant': {'data': {'type': 'variants', 'id': str(LEMONSQUEEZY_VARIANT_ID)}},
            },
        }
    }

    try:
        import requests
        resp = requests.post(
            'https://api.lemonsqueezy.com/v1/checkouts',
            json=payload,
            headers={
                'Accept':        'application/vnd.api+json',
                'Content-Type':  'application/vnd.api+json',
                'Authorization': f'Bearer {LEMONSQUEEZY_API_KEY}',
            },
            timeout=12,
        )
        if resp.status_code not in (200, 201):
            print(f"[donate] Lemon Squeezy error {resp.status_code}: {resp.text[:500]}")
            return jsonify({'error': 'checkout_failed',
                            'message': 'Could not start checkout. Please try again.'}), 502
        url = (resp.json().get('data', {}).get('attributes', {}) or {}).get('url')
        if not url:
            return jsonify({'error': 'checkout_failed',
                            'message': 'Checkout URL missing from provider response.'}), 502
        return jsonify({'checkout_url': url, 'coffees': coffees, 'amount_cents': amount_cents})
    except Exception as e:
        print(f"[donate] checkout exception: {e}")
        return jsonify({'error': 'checkout_failed',
                        'message': 'Could not reach the payment provider.'}), 502


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
    # Development only — production uses gunicorn (see Procfile / start command).
    port = int(os.environ.get('PORT', 8000))
    debug_mode = port != 5000
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
