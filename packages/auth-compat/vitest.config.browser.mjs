import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@firebase\/auth\/internal$/,
        replacement: resolve(__dirname, '../auth/internal/index.ts')
      },
      {
        find: /^@firebase\/auth$/,
        replacement: resolve(__dirname, '../auth/index.ts')
      }
    ]
  },
  server: {
    fs: {
      allow: ['../..']
    }
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' }
      ],
      headless: true
    },
    setupFiles: ['./test/polyfills.ts', './test/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000
  }
});
