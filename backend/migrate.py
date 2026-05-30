#!/usr/bin/env python3
"""
migrate.py — One-time migration from JSON files → PostgreSQL.

Run once after setting DATABASE_URL:
    DATABASE_URL=postgresql://... ADMIN_PASSWORD=x python backend/migrate.py

Safe to re-run (uses INSERT ... ON CONFLICT DO NOTHING for most tables).
"""

import os
import sys
import json
from datetime import datetime
from sqlalchemy import text

# Ensure backend/ is on the path
sys.path.insert(0, os.path.dirname(__file__))

from db import DB_AVAILABLE, get_db, create_tables

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_json(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"  [skip] {path} not found")
        return default

def migrate_trails(conn):
    data = load_json(os.path.join(BASE_DIR, 'data', 'trails.json'), {'trails': []})
    trails = data.get('trails', [])
    count = 0
    for t in trails:
        scalar_keys = {'id','name','region','difficulty','distance_km',
                       'duration_hours','elevation_gain_m','status',
                       'dog_friendly','family_friendly','rating'}
        jsonb_data = {k: v for k, v in t.items() if k not in scalar_keys}
        conn.execute(text("""
            INSERT INTO trails (id, name, region, difficulty, distance_km,
                duration_hours, elevation_gain_m, status, dog_friendly,
                family_friendly, rating, data)
            VALUES (:id, :name, :region, :difficulty, :distance_km,
                :duration_hours, :elevation_gain_m, :status, :dog_friendly,
                :family_friendly, :rating, :data::jsonb)
            ON CONFLICT (id) DO NOTHING
        """), {
            'id': t.get('id', ''),
            'name': t.get('name', ''),
            'region': t.get('region'),
            'difficulty': t.get('difficulty'),
            'distance_km': t.get('distance_km'),
            'duration_hours': t.get('duration_hours'),
            'elevation_gain_m': t.get('elevation_gain_m'),
            'status': t.get('status', 'published'),
            'dog_friendly': bool(t.get('dog_friendly', False)),
            'family_friendly': bool(t.get('family_friendly', False)),
            'rating': t.get('rating'),
            'data': json.dumps(jsonb_data),
        })
        count += 1
    print(f"  trails: {count} rows migrated")

def migrate_rifugios(conn):
    # Try both possible paths
    data = (load_json(os.path.join(BASE_DIR, 'data', 'rifugios.json')) or
            load_json(os.path.join(BASE_DIR, 'backend', 'data', 'rifugios.json'), []))
    if isinstance(data, dict):
        data = data.get('rifugios', [])
    count = 0
    for r in data:
        scalar_keys = {'id','name','type','region','altitude','status'}
        jsonb_data = {k: v for k, v in r.items() if k not in scalar_keys}
        conn.execute(text("""
            INSERT INTO rifugios (id, name, type, region, altitude, status, data)
            VALUES (:id, :name, :type, :region, :altitude, :status, :data::jsonb)
            ON CONFLICT (id) DO NOTHING
        """), {
            'id': r.get('id', ''),
            'name': r.get('name', ''),
            'type': r.get('type'),
            'region': r.get('region'),
            'altitude': r.get('altitude'),
            'status': r.get('status', 'published'),
            'data': json.dumps(jsonb_data),
        })
        count += 1
    print(f"  rifugios: {count} rows migrated")

def migrate_multi_day_trails(conn):
    data = load_json(os.path.join(BASE_DIR, 'backend', 'data', 'multi_day_trails.json'), {'trails': []})
    trails = data.get('trails', [])
    count = 0
    for t in trails:
        scalar_keys = {'id','name','difficulty','region','status'}
        jsonb_data = {k: v for k, v in t.items() if k not in scalar_keys}
        conn.execute(text("""
            INSERT INTO multi_day_trails (id, name, difficulty, region, status, data)
            VALUES (:id, :name, :difficulty, :region, :status, :data::jsonb)
            ON CONFLICT (id) DO NOTHING
        """), {
            'id': t.get('id', ''),
            'name': t.get('name', ''),
            'difficulty': t.get('difficulty'),
            'region': t.get('region'),
            'status': t.get('status', 'published'),
            'data': json.dumps(jsonb_data),
        })
        count += 1
    print(f"  multi_day_trails: {count} rows migrated")

def migrate_completed_hikes(conn):
    data = load_json(os.path.join(BASE_DIR, 'data', 'completed_hikes.json'), {'hikes': []})
    hikes = data.get('hikes', data) if isinstance(data, dict) else data
    count = 0
    for h in hikes:
        conn.execute(text("""
            INSERT INTO completed_hikes (id, trail_id, user_email, start_time, data)
            VALUES (:id, :trail_id, :user_email, :start_time, :data::jsonb)
            ON CONFLICT (id) DO NOTHING
        """), {
            'id': h.get('id', str(datetime.utcnow().timestamp())),
            'trail_id': h.get('trail_id'),
            'user_email': h.get('user_email'),
            'start_time': h.get('start_time'),
            'data': json.dumps(h),
        })
        count += 1
    print(f"  completed_hikes: {count} rows migrated")

def migrate_reviews(conn):
    data = load_json(os.path.join(BASE_DIR, 'data', 'reviews.json'), [])
    if isinstance(data, dict):
        data = data.get('reviews', [])
    count = 0
    for r in data:
        conn.execute(text("""
            INSERT INTO reviews (trail_id, user_email, rating, comment, created_at, data)
            VALUES (:trail_id, :user_email, :rating, :comment, :created_at, :data::jsonb)
        """), {
            'trail_id': r.get('trail_id', ''),
            'user_email': r.get('user_email'),
            'rating': r.get('rating'),
            'comment': r.get('comment', ''),
            'created_at': r.get('timestamp', r.get('created_at', datetime.utcnow().isoformat())),
            'data': json.dumps(r),
        })
        count += 1
    print(f"  reviews: {count} rows migrated")

def migrate_plans(conn):
    data = load_json(os.path.join(BASE_DIR, 'data', 'plans.json'), {'plans': []})
    plans = data.get('plans', []) if isinstance(data, dict) else []
    count = 0
    for p in plans:
        conn.execute(text("""
            INSERT INTO plans (user_email, trail_id, plan_date, data)
            VALUES (:user_email, :trail_id, :plan_date, :data::jsonb)
        """), {
            'user_email': p.get('user_email', ''),
            'trail_id': p.get('trail_id'),
            'plan_date': p.get('plan_date'),
            'data': json.dumps(p),
        })
        count += 1
    print(f"  plans: {count} rows migrated")

def migrate_analytics(conn):
    data = load_json(os.path.join(BASE_DIR, 'data', 'user_analytics.json'), {})
    views = data.get('trail_views', {})
    saves = data.get('trail_saves', {})
    trail_ids = set(views.keys()) | set(saves.keys())
    count = 0
    for tid in trail_ids:
        conn.execute(text("""
            INSERT INTO user_analytics (trail_id, views, saves)
            VALUES (:trail_id, :views, :saves)
            ON CONFLICT (trail_id) DO UPDATE
                SET views = EXCLUDED.views, saves = EXCLUDED.saves
        """), {
            'trail_id': tid,
            'views': views.get(tid, 0),
            'saves': saves.get(tid, 0),
        })
        count += 1
    print(f"  user_analytics: {count} rows migrated")

def migrate_challenges(conn):
    data = load_json(os.path.join(BASE_DIR, 'data', 'challenges.json'), {'challenges': []})
    challenges = data.get('challenges', []) if isinstance(data, dict) else []
    count = 0
    for c in challenges:
        conn.execute(text("""
            INSERT INTO challenges (id, data)
            VALUES (:id, :data::jsonb)
            ON CONFLICT (id) DO NOTHING
        """), {'id': c.get('id', ''), 'data': json.dumps(c)})
        count += 1
    print(f"  challenges: {count} rows migrated")

def migrate_booking_inquiries(conn):
    data = load_json(os.path.join(BASE_DIR, 'data', 'booking_inquiries.json'), [])
    if isinstance(data, dict):
        data = data.get('inquiries', [])
    count = 0
    for b in data:
        conn.execute(text("""
            INSERT INTO booking_inquiries (rifugio_id, user_email, status, data)
            VALUES (:rifugio_id, :user_email, :status, :data::jsonb)
        """), {
            'rifugio_id': b.get('rifugio_id', ''),
            'user_email': b.get('user_email'),
            'status': b.get('status', 'pending'),
            'data': json.dumps(b),
        })
        count += 1
    print(f"  booking_inquiries: {count} rows migrated")


def main():
    if not DB_AVAILABLE:
        print("ERROR: DATABASE_URL not set or SQLAlchemy not installed.")
        print("Set DATABASE_URL and run: pip install psycopg2-binary sqlalchemy")
        sys.exit(1)

    print("Creating tables...")
    create_tables()

    print("Migrating data from JSON files...")
    with get_db() as conn:
        migrate_trails(conn)
        migrate_rifugios(conn)
        migrate_multi_day_trails(conn)
        migrate_completed_hikes(conn)
        migrate_reviews(conn)
        migrate_plans(conn)
        migrate_analytics(conn)
        migrate_challenges(conn)
        migrate_booking_inquiries(conn)

    print("\nMigration complete. Verify with:")
    print("  SELECT tablename, n_live_tup FROM pg_stat_user_tables ORDER BY tablename;")

if __name__ == '__main__':
    main()
