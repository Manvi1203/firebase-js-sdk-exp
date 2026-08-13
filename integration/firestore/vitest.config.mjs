import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  server: {
    fs: {
      allow: ['../..']
    }
  },
  test: {
    projects: [
      {
        test: {
          name: 'browser',
          globals: true,
          include: ['dist/test-harness.js'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [
              { browser: 'chromium' }
            ],
            headless: true
          },
          setupFiles: ['./test/polyfills.ts', './test/setup.ts'],
          testTimeout: 65000,
          hookTimeout: 65000
        }
      }
    ]
  }
});
