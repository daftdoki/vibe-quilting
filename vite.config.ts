import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// VITE_BASE is the path the site is served from. GitHub Pages serves it from /<repo>/.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: { port: 5173, host: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
