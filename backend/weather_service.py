# Weather Service for Alpenvia
# Uses Open-Meteo API — free, no API key required

import requests
from datetime import datetime, timedelta

WMO_DESCRIPTIONS = {
    0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'foggy', 48: 'icy fog',
    51: 'light drizzle', 53: 'moderate drizzle', 55: 'dense drizzle',
    61: 'light rain', 63: 'moderate rain', 65: 'heavy rain',
    71: 'light snow', 73: 'moderate snow', 75: 'heavy snow',
    77: 'snow grains',
    80: 'light showers', 81: 'moderate showers', 82: 'violent showers',
    85: 'snow showers', 86: 'heavy snow showers',
    95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with heavy hail',
}


class WeatherService:
    BASE_URL = 'https://api.open-meteo.com/v1/forecast'

    def _fetch(self, lat, lon):
        params = {
            'latitude': lat,
            'longitude': lon,
            'current': (
                'temperature_2m,apparent_temperature,relative_humidity_2m,'
                'precipitation,weather_code,cloud_cover,'
                'wind_speed_10m,wind_direction_10m,visibility'
            ),
            'daily': (
                'weather_code,temperature_2m_max,temperature_2m_min,'
                'precipitation_probability_max,wind_speed_10m_max'
            ),
            'wind_speed_unit': 'kmh',
            'timezone': 'auto',
            'forecast_days': 7,
        }
        response = requests.get(self.BASE_URL, params=params, timeout=6)
        response.raise_for_status()
        return response.json()

    def get_current_weather(self, lat, lon):
        try:
            data = self._fetch(lat, lon)
            c = data['current']
            code = c.get('weather_code', 0)
            return {
                'temperature': round(c['temperature_2m']),
                'feels_like': round(c['apparent_temperature']),
                'humidity': round(c['relative_humidity_2m']),
                'pressure': 1013,
                'wind_speed': round(c['wind_speed_10m'], 1),
                'wind_direction': c.get('wind_direction_10m', 0),
                'description': WMO_DESCRIPTIONS.get(code, 'partly cloudy'),
                'icon': '01d' if code == 0 else '02d',
                'clouds': round(c.get('cloud_cover', 0)),
                'visibility': round(c.get('visibility', 10000) / 1000, 1),
                'timestamp': datetime.now().isoformat(),
            }
        except Exception as e:
            print(f'Open-Meteo current weather error: {e}')
            return self._get_mock_weather()

    def get_forecast(self, lat, lon):
        try:
            data = self._fetch(lat, lon)
            daily = data['daily']
            forecast = []
            for i, date in enumerate(daily['time']):
                code = daily['weather_code'][i]
                forecast.append({
                    'date': date,
                    'temp_min': round(daily['temperature_2m_min'][i]),
                    'temp_max': round(daily['temperature_2m_max'][i]),
                    'temp_avg': round((daily['temperature_2m_min'][i] + daily['temperature_2m_max'][i]) / 2),
                    'description': WMO_DESCRIPTIONS.get(code, 'partly cloudy'),
                    'humidity': 60,
                    'wind_speed': round(daily['wind_speed_10m_max'][i], 1),
                    'rain_probability': daily['precipitation_probability_max'][i] or 0,
                })
            return forecast
        except Exception as e:
            print(f'Open-Meteo forecast error: {e}')
            return self._get_mock_forecast()

    def get_weather_alerts(self, current_weather, forecast):
        alerts = []
        if current_weather.get('temperature', 15) < 0:
            alerts.append({'severity': 'high', 'type': 'freezing',
                           'message': 'Freezing temperatures — risk of ice on trails'})
        if current_weather.get('wind_speed', 0) > 40:
            alerts.append({'severity': 'high', 'type': 'wind',
                           'message': 'Strong winds — dangerous for exposed ridges'})
        if current_weather.get('visibility', 10) < 2:
            alerts.append({'severity': 'medium', 'type': 'visibility',
                           'message': 'Low visibility — navigation may be difficult'})
        if forecast:
            for day in forecast[:2]:
                if day.get('rain_probability', 0) > 70:
                    alerts.append({'severity': 'medium', 'type': 'rain',
                                   'message': f"High chance of rain on {day['date']}"})
        return alerts

    def get_trail_suitability(self, current_weather, difficulty):
        score = 100
        temp = current_weather.get('temperature', 15)
        wind = current_weather.get('wind_speed', 0)
        vis  = current_weather.get('visibility', 10)

        if temp < -5:   score -= 30
        elif temp < 0:  score -= 15
        elif temp > 30: score -= 10

        if wind > 50:   score -= 40
        elif wind > 30: score -= 20

        if vis < 1:  score -= 30
        elif vis < 3: score -= 15

        if difficulty in ['difficult', 'expert', 'hard'] and score < 70:
            score -= 10

        score = max(0, score)
        return {'score': score, 'recommendation': 'excellent' if score >= 80 else 'fair' if score >= 60 else 'poor', 'suitable': score >= 60}

    def _get_mock_weather(self):
        return {
            'temperature': 15, 'feels_like': 13, 'humidity': 65,
            'pressure': 1013, 'wind_speed': 12, 'wind_direction': 180,
            'description': 'partly cloudy', 'icon': '02d',
            'clouds': 40, 'visibility': 10,
            'timestamp': datetime.now().isoformat(),
            'mock': True,
        }

    def _get_mock_forecast(self):
        today = datetime.now()
        return [
            {
                'date': (today + timedelta(days=i)).strftime('%Y-%m-%d'),
                'temp_min': 8 + i, 'temp_max': 18 + i, 'temp_avg': 13 + i,
                'description': 'partly cloudy' if i % 2 == 0 else 'clear sky',
                'humidity': 60, 'wind_speed': 10, 'rain_probability': 20 if i % 3 == 0 else 10,
                'mock': True,
            }
            for i in range(7)
        ]


weather_service = WeatherService()
