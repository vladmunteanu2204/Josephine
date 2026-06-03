// Single source of truth for the backend API base URL.
//
// In production the React bundle is served by the same Flask app, so a relative
// `/api` is correct. In dev, Vite proxies `/api` → http://localhost:8000 (see
// vite.config.js server.proxy), so `/api` works there too. Set VITE_API_URL to
// point at a different backend origin (e.g. a remote staging API).
export const API_URL = import.meta.env.VITE_API_URL ?? '/api';
