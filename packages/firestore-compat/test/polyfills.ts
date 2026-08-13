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

import { Buffer } from 'buffer';

// Fix Vitest error: "ReferenceError: global is not defined" in browser tests
if (typeof (globalThis as unknown as { global: unknown }).global === 'undefined') {
  (globalThis as unknown as { global: typeof globalThis }).global = globalThis;
}
if (typeof (globalThis as unknown as { process: unknown }).process === 'undefined') {
  (globalThis as unknown as { process: { env: Record<string, string> } }).process = {
    env: {}
  };
}
const proc = (globalThis as unknown as { process: { env: Record<string, string> } }).process;
proc.env = proc.env || {};
if (!proc.env.FIRESTORE_EMULATOR_PORT) {
  proc.env.FIRESTORE_EMULATOR_PORT = '8080';
}
if (!proc.env.FIRESTORE_TARGET_BACKEND) {
  proc.env.FIRESTORE_TARGET_BACKEND = 'emulator';
}
if (!proc.env.FIRESTORE_EMULATOR_PROJECT_ID) {
  proc.env.FIRESTORE_EMULATOR_PROJECT_ID = 'test-emulator';
}

// Fix Vitest error: "ReferenceError: Buffer is not defined" in browser tests
if (typeof (globalThis as unknown as { Buffer: unknown }).Buffer === 'undefined') {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
