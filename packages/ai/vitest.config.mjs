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
          setupFiles: ['./src/index.node.ts', './test/setup.ts'],
          include: ['src/**/*.test.ts'],
          exclude: [
            'src/**/*-browser*.test.ts',
            'src/methods/live-session-helpers.test.ts',
            '**/*.browser.test.ts'
          ]
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
          setupFiles: ['./test/setup.ts'],
          include: ['src/**/*.test.ts'],
          exclude: ['**/*.node.test.ts'],
          testTimeout: 20000,
          hookTimeout: 20000
        }
      }
    ]
  }
});
