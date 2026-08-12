import { use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

// In browser environments (Playwright Chromium under Vitest), process is not globally defined.
// Polyfill process to prevent: ReferenceError: process is not defined.
if (typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = {
    env: {},
    browser: true,
    version: '',
    versions: {},
    argv: [],
    stdout: {},
    stderr: {}
  };
}

if (typeof (globalThis as any).global === 'undefined') {
  (globalThis as any).global = globalThis;
}

// Mocha compatibility aliases for Vitest globals
if (typeof (globalThis as any).before === 'undefined' && typeof (globalThis as any).beforeAll === 'function') {
  (globalThis as any).before = (globalThis as any).beforeAll;
}
if (typeof (globalThis as any).after === 'undefined' && typeof (globalThis as any).afterAll === 'function') {
  (globalThis as any).after = (globalThis as any).afterAll;
}
