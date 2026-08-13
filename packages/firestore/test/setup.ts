/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { restore } from 'sinon';
import * as sinonChai from 'sinon-chai';

// Fix Vitest error: register Firestore component and prototype.pipeline extension
import '../src/register';
import '../src/api/pipeline_impl';

chai.use(sinonChai.default || sinonChai);
chai.use(chaiAsPromised.default || chaiAsPromised);

// Fix Vitest error: alias before/after to beforeAll/afterAll if missing
const g = globalThis as unknown as Record<string, unknown>;
if (typeof g['before'] === 'undefined' && typeof g['beforeAll'] !== 'undefined') {
  g['before'] = g['beforeAll'];
}
if (typeof g['after'] === 'undefined' && typeof g['afterAll'] !== 'undefined') {
  g['after'] = g['afterAll'];
}
// Fix Vitest error: "Error: No test found in suite ..." for empty suites in node
if (typeof globalThis.describe === 'function') {
  const origDescribe = globalThis.describe;
  const wrappedDescribe = function (
    this: unknown,
    name: unknown,
    fn: unknown,
    ...rest: unknown[]
  ): unknown {
    if (typeof fn === 'function') {
      const wrappedFn = function (this: unknown, ...args: unknown[]): void {
        let childCount = 0;
        const currentIt = globalThis.it;
        const currentDescribe = globalThis.describe;

        const countIt = new Proxy(currentIt, {
          apply(t, thisArg, a) {
            childCount++;
            return Reflect.apply(t, thisArg, a);
          }
        });
        const countDescribe = new Proxy(currentDescribe, {
          apply(t, thisArg, a) {
            childCount++;
            return Reflect.apply(t, thisArg, a);
          }
        });

        globalThis.it = countIt;
        globalThis.describe = countDescribe;
        try {
          (fn as (...a: unknown[]) => unknown).apply(this, args);
        } finally {
          globalThis.it = currentIt;
          globalThis.describe = currentDescribe;
        }
        if (childCount === 0) {
          // eslint-disable-next-line no-restricted-properties
          globalThis.it.skip('skipped (environment not supported)', () => {});
        }
      };
      return Reflect.apply(origDescribe, this, [name, wrappedFn, ...rest]);
    }
    return Reflect.apply(origDescribe, this, [name, fn, ...rest]);
  };
  Object.assign(wrappedDescribe, origDescribe);
  globalThis.describe = wrappedDescribe as typeof origDescribe;
}

interface TestContextShape {
  test?: {
    fullTitle(): string;
    title: string;
  };
  timeout?(ms: number): void;
  task?: {
    name: string;
  };
}

// Fix Vitest error: provide Mocha-compatible `this.test`, `this.timeout`, and `it(...).timeout()` support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapTestFn(origFn: any): any {
  const proxy = new Proxy(origFn, {
    apply(target, thisArg, argArray) {
      const [name, testFn, timeout] = argArray;
      if (typeof testFn === 'function') {
        const wrappedTestFn = function (
          this: TestContextShape,
          context: TestContextShape
        ): unknown {
          const ctx: TestContextShape = context || this || {};
          if (!ctx.test) {
            ctx.test = {
              fullTitle: () => (ctx.task ? ctx.task.name : String(name)),
              title: ctx.task ? ctx.task.name : String(name)
            };
          }
          if (!ctx.timeout) {
            ctx.timeout = (_ms: number) => {};
          }
          return testFn.call(ctx, ctx);
        };
        const res: unknown = Reflect.apply(target, thisArg, [name, wrappedTestFn, timeout]);
        const chainable = {
          timeout: (_ms: number) => chainable,
          ...(typeof res === 'object' && res !== null ? (res as Record<string, unknown>) : {})
        };
        return chainable;
      }
      const res: unknown = Reflect.apply(target, thisArg, argArray);
      const chainable = {
        timeout: (_ms: number) => chainable,
        ...(typeof res === 'object' && res !== null ? (res as Record<string, unknown>) : {})
      };
      return chainable;
    },
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig === 'function') {
        return wrapTestFn(orig);
      }
      return orig;
    }
  });
  return proxy;
}

if (typeof globalThis.it === 'function') {
  const wrapped = wrapTestFn(globalThis.it);
  globalThis.it = wrapped;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).test = wrapped;
}

// Fix Vitest error: prevent simulated test failure unhandled rejection in test runners
if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (
      event.reason &&
      String(event.reason.message || event.reason).includes('Simulated test failure')
    ) {
      event.preventDefault();
    }
  });
}
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  process.on('unhandledRejection', (reason: unknown) => {
    if (
      reason &&
      String((reason as Error).message || reason).includes('Simulated test failure')
    ) {
      return;
    }
  });
}

afterEach(() => {
  restore();
});
