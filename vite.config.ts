import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { codespaceHost } from './server/config';
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } },
    allowedHosts: [
      'terminal.local',
      ...[codespaceHost(5173)].filter((host): host is string => !!host),
    ],
  },
  test: {
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
    clearMocks: true,
  },
});
