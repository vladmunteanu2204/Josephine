from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from openai import OpenAI
import json
import random
from datetime import datetime

app = Flask(__name__)
CORS(app)

client = OpenAI(
    api_key=os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
    base_url=os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
)

def load_trail_segments():
    """Load trail segments from the mock database"""
    with open('data/trail_segments.json', 'r') as f:
        return json.load(f)

def load_complete_trails():
    """Load complete trail data"""
    with open('data/trails.json', 'r') as f:
        return json.load(f)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'Alpenvia API is running'})

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
    """Generate a custom AI trail based on user preferences"""
    try:
        data = request.json
        duration = data.get('duration', 3)
        difficulty = data.get('difficulty', 'medium')
        interests = data.get('interests', [])
        starting_area = data.get('starting_area', 'Bolzano')
        
        segments = load_trail_segments()
        
        suitable_segments = []
        for segment in segments['segments']:
            if segment['difficulty'].lower() == difficulty.lower():
                segment_interests = segment.get('features', [])
                if any(interest in segment_interests for interest in interests) or not interests:
                    suitable_segments.append(segment)
        
        if not suitable_segments:
            suitable_segments = [s for s in segments['segments'] if s['difficulty'].lower() == difficulty.lower()]
        
        if not suitable_segments:
            suitable_segments = segments['segments']
        
        selected_segments = random.sample(suitable_segments, min(len(suitable_segments), 3))
        
        total_distance = sum(seg['distance_km'] for seg in selected_segments)
        total_elevation = sum(seg['elevation_gain_m'] for seg in selected_segments)
        
        interests_text = ", ".join(interests) if interests else "scenic alpine views"
        
        prompt = f"""Create a compelling description for a {difficulty} difficulty hiking trail in South Tyrol/Trentino Alps.

Trail Details:
- Duration: {duration} hours
- Distance: {total_distance:.1f} km
- Elevation gain: {total_elevation} meters
- Starting area: {starting_area}
- Key features: {interests_text}

Write a vivid, inspiring 2-3 paragraph description that captures the essence of this alpine hike. Include what hikers will experience, key viewpoints, and why this trail is special. Keep it concise but evocative."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a passionate alpine hiking guide with deep knowledge of the South Tyrol and Trentino regions. Write engaging, informative trail descriptions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300
        )
        
        ai_description = response.choices[0].message.content
        
        coordinates = []
        for segment in selected_segments:
            coordinates.extend(segment['coordinates'])
        
        pois = []
        for segment in selected_segments:
            if 'pois' in segment:
                pois.extend(segment['pois'])
        
        trail_name_prompt = f"Generate a short, evocative name (2-4 words) for a hiking trail in South Tyrol featuring: {interests_text}. Just return the name, nothing else."
        
        name_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": trail_name_prompt}
            ],
            temperature=0.8,
            max_tokens=20
        )
        
        trail_name = (name_response.choices[0].message.content or "Alpine Trail").strip().strip('"\'')
        
        generated_trail = {
            'id': f'ai_{datetime.now().strftime("%Y%m%d_%H%M%S")}',
            'name': trail_name,
            'region': 'South Tyrol',
            'difficulty': difficulty,
            'distance_km': round(total_distance, 1),
            'duration_hours': duration,
            'elevation_gain_m': total_elevation,
            'elevation_loss_m': total_elevation,
            'trail_type': 'loop' if random.random() > 0.5 else 'point-to-point',
            'interests': interests,
            'description': ai_description,
            'coordinates': coordinates,
            'pois': pois,
            'rating': 4.5,
            'reviews_count': 0,
            'image_url': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
            'generated': True
        }
        
        return jsonify(generated_trail)
        
    except Exception as e:
        print(f"Error generating trail: {str(e)}")
        return jsonify({'error': f'Failed to generate trail: {str(e)}'}), 500

@app.route('/api/recommendations', methods=['POST'])
def get_recommendations():
    """Get trail recommendations based on user preferences"""
    try:
        data = request.json
        preferences = data.get('preferences', {})
        location = data.get('location', {})
        
        trails = load_complete_trails()['trails']
        
        user_interests = preferences.get('interests', [])
        user_skill = preferences.get('skill_level', 'intermediate')
        
        scored_trails = []
        for trail in trails:
            score = 0
            
            if trail['difficulty'].lower() == user_skill.lower():
                score += 3
            elif user_skill == 'beginner' and trail['difficulty'].lower() == 'easy':
                score += 5
            elif user_skill == 'expert' and trail['difficulty'].lower() == 'hard':
                score += 5
            
            trail_interests = trail.get('interests', [])
            matching_interests = set(user_interests) & set(trail_interests)
            score += len(matching_interests) * 2
            
            scored_trails.append({'trail': trail, 'score': score})
        
        scored_trails.sort(key=lambda x: x['score'], reverse=True)
        
        recommended = scored_trails[0]['trail'] if scored_trails else trails[0]
        
        return jsonify(recommended)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
