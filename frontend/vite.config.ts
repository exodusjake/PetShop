import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api and /uploads are proxied to the Express API so cookies work without CORS fuss.
// In production, nginx on the web EC2 proxies the same paths to the API EC2 (see DEPLOY.md).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
