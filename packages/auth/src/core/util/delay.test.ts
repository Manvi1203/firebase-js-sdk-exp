/**
 * @license
 * Copyright 2020 Google LLC
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

import { expect } from 'chai';
import { restore, stub } from 'sinon';
import { Delay, DelayMin, _delayInternal } from './delay';

describe('core/util/delay', () => {
  const SHORT_DELAY = 30_000;
  const LONG_DELAY = 60_000;

  // Fix Vitest error: sandbox.restore() does not take any parameters
  afterEach(() => {
    restore();
  });

  it('should return the short delay in browser environments', () => {
    const delay = new Delay(SHORT_DELAY, LONG_DELAY);
    expect(delay.get()).to.eq(SHORT_DELAY);
  });

  it('should return the long delay in Cordova environments', () => {
    // Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
    const mock = stub(_delayInternal, 'isMobileCordova');
    mock.callsFake(() => true);
    const delay = new Delay(SHORT_DELAY, LONG_DELAY);
    expect(delay.get()).to.eq(LONG_DELAY);
  });

  it('should return the long delay in React Native environments', () => {
    // Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
    const mock = stub(_delayInternal, 'isReactNative');
    mock.callsFake(() => true);
    const delay = new Delay(SHORT_DELAY, LONG_DELAY);
    expect(delay.get()).to.eq(LONG_DELAY);
  });

  it('should return quicker when offline', () => {
    // Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
    const mock = stub(_delayInternal, '_isOnline');
    mock.callsFake(() => false);
    const delay = new Delay(SHORT_DELAY, LONG_DELAY);
    expect(delay.get()).to.eq(DelayMin.OFFLINE);
  });
});
