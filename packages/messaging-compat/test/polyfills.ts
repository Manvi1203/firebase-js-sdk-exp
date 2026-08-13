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

const g = globalThis as Record<string, unknown>;
if (typeof g.global === 'undefined') {
  g.global = globalThis;
}
if (typeof g.process === 'undefined') {
  g.process = { env: {} };
}
if (typeof g.before === 'undefined') {
  g.before = g.beforeAll;
}
if (typeof g.after === 'undefined') {
  g.after = g.afterAll;
}
if (typeof g.context === 'undefined') {
  g.context = g.describe;
}
