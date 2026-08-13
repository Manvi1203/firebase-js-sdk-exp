/**
 * @license
 * Copyright 2019 Google LLC
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
import { restore } from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';

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

afterEach(async () => {
  restore();
});
