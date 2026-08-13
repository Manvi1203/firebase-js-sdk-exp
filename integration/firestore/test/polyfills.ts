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

// Polyfill global for browser runner
if (typeof (globalThis as Record<string, unknown>).global === 'undefined') {
  (globalThis as Record<string, unknown>).global = globalThis;
}

// Polyfill karma config to force emulator target backend in browser runner
(globalThis as Record<string, unknown>).__karma__ = {
  config: {
    targetBackend: 'emulator',
    databaseId: '(default)'
  }
};

// Polyfill process for browser runner
const proc = (globalThis as Record<string, unknown>).process as
  | { env?: Record<string, string> }
  | undefined;
if (!proc) {
  (globalThis as Record<string, unknown>).process = {
    env: {
      FIRESTORE_EMULATOR_PORT: '8080',
      FIRESTORE_EMULATOR_PROJECT_ID: 'test-emulator-project',
      FIRESTORE_TARGET_BACKEND: 'emulator',
      FIRESTORE_RUN_MULTI_DB_TESTS: 'false',
      INCLUDE_FIRESTORE_PERSISTENCE: 'false'
    }
  };
} else {
  proc.env = proc.env || {};
  proc.env.FIRESTORE_EMULATOR_PORT = '8080';
  proc.env.FIRESTORE_EMULATOR_PROJECT_ID = 'test-emulator-project';
  proc.env.FIRESTORE_TARGET_BACKEND = 'emulator';
  proc.env.FIRESTORE_RUN_MULTI_DB_TESTS = 'false';
}

// Polyfill Mocha before / after aliases for Vitest
// Fix Vitest error: "ReferenceError: before is not defined"
const g = globalThis as Record<string, unknown>;
if (typeof g.before === 'undefined' && typeof g.beforeAll !== 'undefined') {
  g.before = g.beforeAll;
}
if (typeof g.after === 'undefined' && typeof g.afterAll !== 'undefined') {
  g.after = g.afterAll;
}

// Polyfill Mocha it().timeout() chaining and it.skip/it.only for Vitest
// Fix Vitest error: "TypeError: mocha_extensions_1.it.skip is not a function"
function makeChainable(fn: unknown) {
  if (typeof fn !== 'function') {
    return fn;
  }
  const wrapped = function (
    this: unknown,
    name: string,
    testFn?: unknown,
    timeout?: number
  ) {
    const res =
      timeout !== undefined
        ? (fn as (n: string, f?: unknown, t?: number) => unknown).call(
            this,
            name,
            testFn,
            timeout
          )
        : (fn as (n: string, f?: unknown) => unknown).call(
            this,
            name,
            testFn
          );
    return {
      timeout: (_t: number) => res,
      skip: (n: string, f?: unknown) =>
        (fn as unknown as { skip: (n: string, f?: unknown) => unknown }).skip(
          n,
          f
        ),
      only: (n: string, f?: unknown) =>
        (fn as unknown as { only: (n: string, f?: unknown) => unknown }).only(
          n,
          f
        )
    };
  };
  Object.assign(wrapped, fn);
  return wrapped;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalIt: any = g.it;
if (originalIt && typeof originalIt === 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customIt: any = makeChainable(originalIt);
  customIt.skip = makeChainable(originalIt.skip);
  customIt.only = makeChainable(originalIt.only);
  customIt.todo = originalIt.todo;
  customIt.fails = originalIt.fails;
  customIt.each = originalIt.each;
  g.it = customIt;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalDescribe: any = g.describe;
if (originalDescribe && typeof originalDescribe === 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customDescribe: any = makeChainable(originalDescribe);
  customDescribe.skip = makeChainable(originalDescribe.skip);
  customDescribe.only = makeChainable(originalDescribe.only);
  customDescribe.each = originalDescribe.each;
  g.describe = customDescribe;
}
