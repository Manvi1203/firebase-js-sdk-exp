import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
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
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          globals: true,
          setupFiles: [
            './test/polyfills.ts',
            './test/setup.ts',
            './src/platform_node/index.ts'
          ],
          include: [
            'src/!(platform_browser|platform_react_native|platform_cordova)/**/*.test.ts',
            'test/helpers/**/*.test.ts'
          ],
          testTimeout: 20000,
          hookTimeout: 20000
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
          setupFiles: [
            './test/polyfills.ts',
            './test/setup.ts'
          ],
          include: ['src/**/*.test.ts', 'test/helpers/**/*.test.ts'],
          testTimeout: 20000,
          hookTimeout: 20000
        }
      }
    ]
  }
});
