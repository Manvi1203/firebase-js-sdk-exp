import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  optimizeDeps: {
    include: ['buffer']
  },
  server: {
    fs: {
      allow: ['../..']
    }
  },
  test: {
    projects: [
      {
        resolve: {
          alias: [
            {
              find: /^(.*)\/platform\/([^.\/]*)(\.ts)?$/,
              replacement: '$1/platform/node/$2.ts'
            }
          ]
        },
        test: {
          name: 'node',
          environment: 'node',
          globals: true,
          setupFiles: [
            './test/polyfills.ts',
            './src/index.node.ts',
            './test/setup.ts'
          ],
          include: ['test/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          testTimeout: 20000,
          hookTimeout: 20000
        }
      },
      {
        resolve: {
          alias: [
            {
              find: /^(.*)\/platform\/([^.\/]*)(\.ts)?$/,
              replacement: '$1/platform/browser/$2.ts'
            }
          ]
        },
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
            './test/polyfills.ts',
            './test/setup.ts'
          ],
          include: ['test/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          testTimeout: 20000,
          hookTimeout: 20000
        }
      }
    ]
  }
});
