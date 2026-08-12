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

import { use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { restore } from 'sinon';
import sinonChai from 'sinon-chai';

use(chaiAsPromised);
use(sinonChai);

// Fix Vitest error: alias before/after to beforeAll/afterAll if missing
const g = globalThis as unknown as Record<string, unknown>;
if (typeof g['before'] === 'undefined' && typeof g['beforeAll'] !== 'undefined') {
  g['before'] = g['beforeAll'];
}
if (typeof g['after'] === 'undefined' && typeof g['afterAll'] !== 'undefined') {
  g['after'] = g['afterAll'];
}

afterEach(() => {
  restore();
});
