import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      // Fix Vitest error: "SyntaxError: The requested module '/dist/esm/internal.js' does not provide an export named 'DefaultConfig'"
      '../../../internal': resolve(__dirname, 'internal/index.ts'),
      '../../internal': resolve(__dirname, 'internal/index.ts'),
      '../internal': resolve(__dirname, 'internal/index.ts'),
      '@firebase/auth/internal': resolve(__dirname, 'internal/index.ts')
    }
  },
  server: {
    fs: {
      allow: ['../..']
    }
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'test/helpers/**/*.test.ts'],
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
