import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // No proxy needed — Supabase client connects directly to supabase.co
  },
  define: {
    // Suppress crypto.randomUUID polyfill warning in non-secure contexts
    global: 'globalThis',
  },
});
