import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Force ALL imports of react/react-dom to resolve to the same absolute path.
    // dedupe alone isn't enough in Vite 5 + Safari because mid-session dep
    // re-optimization can assign a new ?v= hash, giving lazy-loaded components
    // a DIFFERENT react module instance → "Invalid hook call" /
    // "null is not an object (evaluating 'dispatcher.useContext')".
    // alias overrides resolution before Vite even touches the dep optimizer.
    alias: {
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
      'react/jsx-runtime': path.resolve('./node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve('./node_modules/react/jsx-dev-runtime'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    hmr: {
      port: 5173,
    },
    headers: {
      // Never cache dev-mode JS — prevents the "two React instances" crash
      // caused by the browser mixing old cached modules with fresh ones
      'Cache-Control': 'no-store',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    },
    // Pre-transform every source file (including lazy-loaded routes) at startup
    // so all their deps are discovered before any browser request. Without this,
    // Safari can trigger a Vite re-optimisation mid-session when it first loads
    // a lazy component, changing the ?v= hash on react.js and creating a second
    // React module instance → "Invalid hook call" crash.
    warmup: {
      clientFiles: ['./src/**/*.{js,jsx}'],
    },
  },
  optimizeDeps: {
    // Scan ALL source files (including lazy-loaded routes) at startup so Vite
    // discovers every dep before the browser loads the page.  Without this,
    // Vite only scans main.jsx → misses deps in lazy-loaded components →
    // triggers mid-session re-optimisation → new browserHash → two copies of
    // react-i18next land in the same page → getI18n() returns undefined →
    // crash.  entries overrides the default "scan index.html only" behaviour.
    entries: ['src/**/*.{js,jsx,ts,tsx}'],
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'mapbox-gl',
      'react-map-gl',
      'i18next',
      'react-i18next',
      // Pre-bundle deps reached only through lazy-loaded routes. If these are
      // optimized on-demand (when a lazy chunk first loads), Vite assigns a new
      // browserHash and re-bundles react under a fresh ?v= hash → a SECOND React
      // instance in the page → "Cannot read properties of undefined (reading 'S')"
      // (ReactSharedInternals undefined). Forcing them into the startup pass keeps
      // a single React instance across every lazy route.
      'axios',
      '@sentry/react',
    ],
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
