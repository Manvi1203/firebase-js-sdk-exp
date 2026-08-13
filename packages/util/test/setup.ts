import { use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

// Polyfill globals and Mocha hook aliases for browser runner
if (typeof (globalThis as any).global === 'undefined') {
  (globalThis as any).global = globalThis;
}
if (typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = { env: {} };
}
if (typeof (globalThis as any).before === 'undefined') {
  (globalThis as any).before = (globalThis as any).beforeAll;
}
if (typeof (globalThis as any).after === 'undefined') {
  (globalThis as any).after = (globalThis as any).afterAll;
}
if (typeof (globalThis as any).context === 'undefined') {
  (globalThis as any).context = (globalThis as any).describe;
}
