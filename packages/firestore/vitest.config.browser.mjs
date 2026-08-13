import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const targetPlatform = process.env.TEST_PLATFORM || 'browser';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^(.*)\/platform\/([^.\/]*)(\.ts)?$/,
        replacement: `$1/platform/${targetPlatform}/$2.ts`
      }
    ]
  },
  optimizeDeps: {
    include: ['buffer']
  },
  server: {
    fs: {
      allow: ['../..']
    }
  },
  test: {
    globals: true,
    include: ['test/unit/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.node.test.ts',
      '**/node_api.test.ts',
      '**/node/**'
    ],
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
