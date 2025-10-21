import axios from 'axios';

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api'
  : 'https://your-replit-url.repl.co:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const trailsApi = {
  getAllTrails: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.difficulty) params.append('difficulty', filters.difficulty);
    if (filters.duration_max) params.append('duration_max', filters.duration_max);
    if (filters.interest) params.append('interest', filters.interest);
    
    const response = await api.get(`/trails?${params.toString()}`);
    return response.data;
  },

  getTrailById: async (trailId) => {
    const response = await api.get(`/trails/${trailId}`);
    return response.data;
  },

  generateTrail: async (preferences) => {
    const response = await api.post('/trails/generate', preferences);
    return response.data;
  },

  getRecommendations: async (userPreferences, location) => {
    const response = await api.post('/recommendations', {
      preferences: userPreferences,
      location: location,
    });
    return response.data;
  },

  healthCheck: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default api;
