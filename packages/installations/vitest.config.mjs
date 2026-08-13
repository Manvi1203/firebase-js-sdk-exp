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
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            headless: true
          },
          setupFiles: [
            './src/testing/polyfills.ts',
            './src/testing/setup.ts'
          ],
          include: ['src/**/*.test.ts'],
          testTimeout: 20000,
          hookTimeout: 20000
        }
      }
    ]
  }
});
