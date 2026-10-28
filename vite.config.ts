import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API_PORT = Number(process.env.API_PORT ?? 4000);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${API_PORT}`,
      '/ws': { target: `ws://localhost:${API_PORT}`, ws: true },
    },
  },
  test: {
    environment: 'node',
  },
});
