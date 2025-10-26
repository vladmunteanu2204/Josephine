import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './WeatherWidget.css';

function WeatherWidget({ lat, lon, difficulty = 'moderate' }) {
  const { t } = useTranslation();
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForecast, setShowForecast] = useState(false);

  useEffect(() => {
    if (lat && lon) {
      fetchWeather();
    } else {
      setError('No coordinates provided');
      setLoading(false);
    }
  }, [lat, lon]);

  const fetchWeather = async () => {
    try {
      const url = `/api/weather/suitability?lat=${lat}&lon=${lon}&difficulty=${difficulty}`;
      
      console.log('Fetching weather from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Weather data received:', data);
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setWeatherData(data);
      setLoading(false);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError(err.message || 'Failed to load weather data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="weather-widget loading">
        <div className="weather-loader"></div>
        <p style={{marginTop: '1rem', color: 'rgba(255, 255, 255, 0.7)'}}>Loading weather data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="weather-widget error">
        <div className="weather-error-message">
          <span style={{fontSize: '2rem'}}>⚠️</span>
          <p style={{margin: '0.5rem 0', color: '#fbbf24'}}>Unable to load weather data</p>
          <p style={{margin: 0, fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)'}}>{error}</p>
        </div>
      </div>
    );
  }

  if (!weatherData || !weatherData.current) {
    return (
      <div className="weather-widget error">
        <div className="weather-error-message">
          <p style={{color: 'rgba(255, 255, 255, 0.7)'}}>No weather data available</p>
        </div>
      </div>
    );
  }

  const { current, forecast, alerts, suitability } = weatherData;

  const getSuitabilityColor = (score) => {
    if (score >= 80) return '#4ade80';
    if (score >= 60) return '#fbbf24';
    return '#ef4444';
  };

  const getWindDirection = (degrees) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(degrees / 45) % 8];
  };

  return (
    <div className="weather-widget">
      <div className="weather-header">
        <h3>{t('weather.currentConditions', 'Current Conditions')}</h3>
        {current.mock && <span className="mock-badge">{t('weather.mockData', 'Demo Data')}</span>}
      </div>

      <div className="weather-main">
        <div className="weather-temp-section">
          <div className="weather-temp">{current.temperature}°C</div>
          <div className="weather-description">{current.description}</div>
          <div className="weather-feels-like">
            {t('weather.feelsLike', 'Feels like')} {current.feels_like}°C
          </div>
        </div>

        <div className="weather-details-grid">
          <div className="weather-detail">
            <span className="detail-icon">💨</span>
            <div>
              <div className="detail-value">{current.wind_speed} km/h</div>
              <div className="detail-label">{getWindDirection(current.wind_direction)} {t('weather.wind', 'Wind')}</div>
            </div>
          </div>
          <div className="weather-detail">
            <span className="detail-icon">💧</span>
            <div>
              <div className="detail-value">{current.humidity}%</div>
              <div className="detail-label">{t('weather.humidity', 'Humidity')}</div>
            </div>
          </div>
          <div className="weather-detail">
            <span className="detail-icon">☁️</span>
            <div>
              <div className="detail-value">{current.clouds}%</div>
              <div className="detail-label">{t('weather.clouds', 'Clouds')}</div>
            </div>
          </div>
          <div className="weather-detail">
            <span className="detail-icon">👁️</span>
            <div>
              <div className="detail-value">{current.visibility} km</div>
              <div className="detail-label">{t('weather.visibility', 'Visibility')}</div>
            </div>
          </div>
        </div>
      </div>

      {suitability && (
        <div className="weather-suitability">
          <div className="suitability-label">{t('weather.hikingSuitability', 'Hiking Suitability')}</div>
          <div className="suitability-bar-container">
            <div 
              className="suitability-bar-fill"
              style={{ 
                width: `${suitability.score}%`,
                background: getSuitabilityColor(suitability.score)
              }}
            ></div>
          </div>
          <div className="suitability-text">
            {suitability.score >= 80 && <span style={{color: '#4ade80'}}>✓ {t('weather.excellent', 'Excellent')}</span>}
            {suitability.score >= 60 && suitability.score < 80 && <span style={{color: '#fbbf24'}}>⚠ {t('weather.fair', 'Fair')}</span>}
            {suitability.score < 60 && <span style={{color: '#ef4444'}}>✗ {t('weather.poor', 'Poor')}</span>}
          </div>
        </div>
      )}

      {alerts && alerts.length > 0 && (
        <div className="weather-alerts">
          {alerts.map((alert, index) => (
            <div key={index} className={`weather-alert ${alert.severity}`}>
              {alert.severity === 'high' && <span>⚠️</span>}
              {alert.severity === 'medium' && <span>⚡</span>}
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {forecast && forecast.length > 0 && (
        <div className="weather-forecast-section">
          <button 
            className="forecast-toggle"
            onClick={() => setShowForecast(!showForecast)}
          >
            {showForecast ? '▼' : '▶'} {t('weather.sevenDayForecast', '7-Day Forecast')}
          </button>

          {showForecast && (
            <div className="forecast-grid">
              {forecast.map((day, index) => (
                <div key={index} className="forecast-day">
                  <div className="forecast-date">
                    {index === 0 ? t('weather.today', 'Today') : new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                  <div className="forecast-temps">
                    <span className="temp-high">{day.temp_max}°</span>
                    <span className="temp-low">{day.temp_min}°</span>
                  </div>
                  <div className="forecast-desc">{day.description}</div>
                  {day.rain_probability > 30 && (
                    <div className="forecast-rain">💧 {day.rain_probability}%</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WeatherWidget;
