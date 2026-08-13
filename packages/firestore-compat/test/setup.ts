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

// Fix Vitest error: register Firestore compat component
import '../src/index';

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
// Fix Vitest error: "ReferenceError: context is not defined" (Mocha alias for describe)
if (typeof g['context'] === 'undefined' && typeof describe !== 'undefined') {
  g['context'] = describe;
}
// Fix Vitest error: "ReferenceError: xit is not defined" (Mocha alias for it.skip)
if (typeof g['xit'] === 'undefined' && typeof it !== 'undefined') {
  // eslint-disable-next-line no-restricted-properties
  g['xit'] = it.skip;
}
if (typeof g['xdescribe'] === 'undefined' && typeof describe !== 'undefined') {
  // eslint-disable-next-line no-restricted-properties
  g['xdescribe'] = describe.skip;
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
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return wrapTestFn(value);
      }
      return value;
    }
  });
  return proxy;
}

if (typeof it !== 'undefined') {
  const wrappedIt = wrapTestFn(it);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).it = wrappedIt;
}

afterEach(() => {
  restore();
});
