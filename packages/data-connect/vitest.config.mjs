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
          name: 'node',
          environment: 'node',
          globals: true,
          setupFiles: [
            './src/index.node.ts',
            './test/polyfills.ts',
            './test/setup.ts'
          ],
          include: ['test/unit/**/*.test.ts', 'test/*.test.ts'],
          exclude: ['test/browser/**/*.test.ts', '**/*.browser.test.ts']
        }
      },
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
          setupFiles: ['./test/polyfills.ts', './test/setup.ts'],
          include: ['test/unit/**/*.test.ts', 'test/*.test.ts'],
          exclude: ['test/node/**/*.test.ts', '**/*.node.test.ts'],
          testTimeout: 20000,
          hookTimeout: 20000
        }
      }
    ]
  }
});
