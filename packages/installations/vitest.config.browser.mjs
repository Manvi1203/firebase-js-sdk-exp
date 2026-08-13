import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
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
    setupFiles: ['./src/testing/polyfills.ts', './src/testing/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000
  }
});
