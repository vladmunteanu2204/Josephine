# Weather Service for Alpenvia
# Uses OpenWeatherMap API for weather data

import requests
import os
from datetime import datetime, timedelta

class WeatherService:
    def __init__(self, api_key=None):
        # Use environment variable or fallback to demo
        self.api_key = api_key or os.environ.get('OPENWEATHER_API_KEY', 'demo')
        self.base_url = "https://api.openweathermap.org/data/2.5"
        
        # Log API key status (without revealing the actual key)
        if self.api_key == 'demo':
            print("⚠️  Using mock weather data (no API key configured)")
        else:
            print(f"✅ OpenWeatherMap API key configured (key starts with: {self.api_key[:4]}...)")
        
    def get_current_weather(self, lat, lon):
        """Get current weather for coordinates"""
        try:
            url = f"{self.base_url}/weather"
            params = {
                'lat': lat,
                'lon': lon,
                'appid': self.api_key,
                'units': 'metric'
            }
            
            response = requests.get(url, params=params, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'temperature': round(data['main']['temp']),
                    'feels_like': round(data['main']['feels_like']),
                    'humidity': data['main']['humidity'],
                    'pressure': data['main']['pressure'],
                    'wind_speed': round(data['wind']['speed'] * 3.6, 1),  # Convert m/s to km/h
                    'wind_direction': data['wind'].get('deg', 0),
                    'description': data['weather'][0]['description'],
                    'icon': data['weather'][0]['icon'],
                    'clouds': data['clouds']['all'],
                    'visibility': data.get('visibility', 10000) / 1000,  # Convert to km
                    'timestamp': datetime.now().isoformat()
                }
            else:
                # Return mock data if API fails
                return self._get_mock_weather()
        except Exception as e:
            print(f"Weather API error: {e}")
            return self._get_mock_weather()
    
    def get_forecast(self, lat, lon):
        """Get 7-day forecast for coordinates"""
        try:
            url = f"{self.base_url}/forecast"
            params = {
                'lat': lat,
                'lon': lon,
                'appid': self.api_key,
                'units': 'metric'
            }
            
            response = requests.get(url, params=params, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                forecast_list = []
                
                # Group by day and get daily summary
                daily_data = {}
                for item in data['list'][:40]:  # 5 days, 8 forecasts per day
                    date = item['dt_txt'].split()[0]
                    if date not in daily_data:
                        daily_data[date] = {
                            'temps': [],
                            'conditions': [],
                            'humidity': [],
                            'wind': [],
                            'rain': 0
                        }
                    
                    daily_data[date]['temps'].append(item['main']['temp'])
                    daily_data[date]['conditions'].append(item['weather'][0]['description'])
                    daily_data[date]['humidity'].append(item['main']['humidity'])
                    daily_data[date]['wind'].append(item['wind']['speed'] * 3.6)
                    
                    if 'rain' in item:
                        daily_data[date]['rain'] += item['rain'].get('3h', 0)
                
                # Create daily summaries
                for date, day_data in list(daily_data.items())[:7]:
                    forecast_list.append({
                        'date': date,
                        'temp_min': round(min(day_data['temps'])),
                        'temp_max': round(max(day_data['temps'])),
                        'temp_avg': round(sum(day_data['temps']) / len(day_data['temps'])),
                        'description': max(set(day_data['conditions']), key=day_data['conditions'].count),
                        'humidity': round(sum(day_data['humidity']) / len(day_data['humidity'])),
                        'wind_speed': round(sum(day_data['wind']) / len(day_data['wind']), 1),
                        'rain_probability': min(100, int(day_data['rain'] * 10))
                    })
                
                return forecast_list
            else:
                return self._get_mock_forecast()
        except Exception as e:
            print(f"Forecast API error: {e}")
            return self._get_mock_forecast()
    
    def get_weather_alerts(self, current_weather, forecast):
        """Generate safety alerts based on weather conditions"""
        alerts = []
        
        # Current conditions alerts
        if current_weather['temperature'] < 0:
            alerts.append({
                'severity': 'high',
                'type': 'freezing',
                'message': 'Freezing temperatures - risk of ice on trails'
            })
        
        if current_weather['wind_speed'] > 40:
            alerts.append({
                'severity': 'high',
                'type': 'wind',
                'message': 'Strong winds - dangerous for exposed ridges'
            })
        
        if current_weather['visibility'] < 2:
            alerts.append({
                'severity': 'medium',
                'type': 'visibility',
                'message': 'Low visibility - navigation may be difficult'
            })
        
        # Forecast alerts
        if forecast and len(forecast) > 0:
            for day in forecast[:2]:  # Check next 2 days
                if day['rain_probability'] > 70:
                    alerts.append({
                        'severity': 'medium',
                        'type': 'rain',
                        'message': f'High chance of rain on {day["date"]}'
                    })
        
        return alerts
    
    def get_trail_suitability(self, current_weather, difficulty):
        """Determine if conditions are suitable for hiking"""
        score = 100
        recommendation = 'excellent'
        
        # Temperature penalties
        if current_weather['temperature'] < -5:
            score -= 30
            recommendation = 'poor'
        elif current_weather['temperature'] < 0:
            score -= 15
            recommendation = 'fair' if score > 60 else 'poor'
        elif current_weather['temperature'] > 30:
            score -= 10
        
        # Wind penalties
        if current_weather['wind_speed'] > 50:
            score -= 40
            recommendation = 'poor'
        elif current_weather['wind_speed'] > 30:
            score -= 20
            recommendation = 'fair' if score > 60 else 'poor'
        
        # Visibility penalties
        if current_weather['visibility'] < 1:
            score -= 30
            recommendation = 'poor'
        elif current_weather['visibility'] < 3:
            score -= 15
        
        # Adjust for difficulty
        if difficulty in ['difficult', 'expert'] and score < 70:
            score -= 10
            recommendation = 'poor'
        
        return {
            'score': max(0, score),
            'recommendation': recommendation,
            'suitable': score >= 60
        }
    
    def _get_mock_weather(self):
        """Return mock weather data when API is unavailable"""
        return {
            'temperature': 15,
            'feels_like': 13,
            'humidity': 65,
            'pressure': 1013,
            'wind_speed': 12,
            'wind_direction': 180,
            'description': 'partly cloudy',
            'icon': '02d',
            'clouds': 40,
            'visibility': 10,
            'timestamp': datetime.now().isoformat(),
            'mock': True
        }
    
    def _get_mock_forecast(self):
        """Return mock forecast data when API is unavailable"""
        forecast = []
        today = datetime.now()
        
        for i in range(7):
            date = (today + timedelta(days=i)).strftime('%Y-%m-%d')
            forecast.append({
                'date': date,
                'temp_min': 8 + i,
                'temp_max': 18 + i,
                'temp_avg': 13 + i,
                'description': 'partly cloudy' if i % 2 == 0 else 'clear sky',
                'humidity': 60 + (i * 2),
                'wind_speed': 10 + i,
                'rain_probability': 20 if i % 3 == 0 else 10,
                'mock': True
            })
        
        return forecast

weather_service = WeatherService()
