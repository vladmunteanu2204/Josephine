import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.js so the app build stays untouched.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',     // gives util tests localStorage etc.
    globals: true,            // describe/it/expect without imports
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    css: false,
  },
});
