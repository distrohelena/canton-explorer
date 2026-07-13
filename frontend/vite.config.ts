import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

const configDirectory = dirname(fileURLToPath(import.meta.url));
const packageMetadata = JSON.parse(
  readFileSync(resolve(configDirectory, '../backend/package.json'), 'utf8'),
) as { version: string };

export default defineConfig({
  plugins: [vue()],
  define: {
    __CANTON_EXPLORER_VERSION__: JSON.stringify(packageMetadata.version),
  },
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
