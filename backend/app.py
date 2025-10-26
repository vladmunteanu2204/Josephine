from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import random
from datetime import datetime
from weather_service import weather_service

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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
    
    return jsonify({'trails': filtered_trails, 'count': len(filtered_trails)})

@app.route('/api/trails/<trail_id>', methods=['GET'])
def get_trail(trail_id):
    """Get a specific trail by ID"""
    trails = load_complete_trails()
    trail = next((t for t in trails['trails'] if t['id'] == trail_id), None)
    
    if not trail:
        return jsonify({'error': 'Trail not found'}), 404
    
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
    Scores trails based on difficulty, interests, duration, and location match.
    Returns top 3-5 verified trails from South Tyrol & Trentino.
    """
    try:
        data = request.json or {}
        
        duration_hours = data.get('duration_hours', data.get('duration', 3))
        difficulty = data.get('difficulty', 'medium')
        interests = data.get('interests', [])
        start_area = data.get('start_area', data.get('starting_area', ''))
        
        trails = load_complete_trails()['trails']
        
        scored_trails = []
        for trail in trails:
            score = 0
            
            if trail['difficulty'].lower() == difficulty.lower():
                score += 3
            
            trail_interests = trail.get('interests', [])
            matching_interests = set(interests) & set(trail_interests)
            score += len(matching_interests) * 2
            
            duration_diff = abs(trail['duration_hours'] - duration_hours)
            if duration_diff <= 1:
                score += 2
            
            if 'loop' in interests and trail.get('trail_type') == 'loop':
                score += 1
            
            if start_area:
                region_match = start_area.lower() in trail.get('region', '').lower()
                name_match = start_area.lower() in trail.get('name', '').lower()
                if region_match or name_match:
                    score += 1
            
            scored_trails.append({'trail': trail, 'score': score})
        
        scored_trails.sort(key=lambda x: x['score'], reverse=True)
        
        top_trails = [item['trail'] for item in scored_trails[:5]]
        
        results = []
        for trail in top_trails:
            coords_list = trail.get('coordinates', [])
            geometry = {
                'type': 'LineString',
                'coordinates': coords_list
            }
            
            pois_formatted = []
            for poi in trail.get('pois', []):
                pois_formatted.append({
                    'type': poi.get('type', 'viewpoint'),
                    'name': poi.get('name', ''),
                    'coord': poi.get('coordinates', [0, 0]),
                    'message': poi.get('description', '')
                })
            
            results.append({
                'id': trail['id'],
                'name': trail['name'],
                'distance_km': trail['distance_km'],
                'duration_hours': trail['duration_hours'],
                'elevation_gain_m': trail['elevation_gain_m'],
                'difficulty': trail['difficulty'],
                'geometry': geometry,
                'pois': pois_formatted,
                'tags': trail.get('interests', []),
                'description': trail.get('description', ''),
                'thumbnail': trail.get('image_url', ''),
                'region': trail.get('region', ''),
                'rating': trail.get('rating', 0),
                'trail_type': trail.get('trail_type', '')
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
        
        hikes_path = os.path.join(BASE_DIR, 'data', 'completed_hikes.json')
        
        # Load existing hikes or create new structure
        if os.path.exists(hikes_path):
            with open(hikes_path, 'r') as f:
                hikes = json.load(f)
        else:
            hikes = {'hikes': []}
        
        # Add new hike
        hike_entry = {
            'id': f"hike-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            'trail_id': hike_data.get('trail_id'),
            'trail_name': hike_data.get('trail_name'),
            'start_time': hike_data.get('start_time'),
            'end_time': hike_data.get('end_time'),
            'stats': hike_data.get('stats'),
            'gps_track': hike_data.get('gps_track', [])
        }
        
        hikes['hikes'].append(hike_entry)
        
        # Save back to file
        with open(hikes_path, 'w') as f:
            json.dump(hikes, f, indent=2)
        
        return jsonify({'success': True, 'hike_id': hike_entry['id']})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
