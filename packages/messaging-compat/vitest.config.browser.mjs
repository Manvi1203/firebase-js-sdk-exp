import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  server: {
    fs: {
      allow: ['../..']
    }
  },
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
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
