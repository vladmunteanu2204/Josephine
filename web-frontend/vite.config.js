import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  optimizeDeps: {
    include: ['mapbox-gl', 'react-map-gl']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mapbox: ['mapbox-gl', 'react-map-gl'],
          react: ['react', 'react-dom'],
          i18n: ['react-i18next', 'i18next'],
        }
      }
    }
  }
});
