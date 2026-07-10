import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 46000,
    strictPort: true,
    allowedHosts: ['canton.sweetsquare.io'],
  },
  preview: {
    host: '0.0.0.0',
    port: 46000,
    strictPort: true,
    allowedHosts: ['canton.sweetsquare.io'],
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
