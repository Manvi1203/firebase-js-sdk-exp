import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^(.*)\/platform\/([^.\/]*)(\.ts)?$/,
        replacement: '$1/platform/browser/$2.ts'
      }
    ]
  },
  server: {
    fs: {
      allow: ['../..']
    }
  },
  optimizeDeps: {
    include: ['chai-as-promised', 'chai', 'sinon-chai', 'sinon', 'idb']
  },
  test: {
    globals: true,
    include: [
      'test/unit/**/*.test.ts',
      'test/browser/string.browser.test.ts'
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
