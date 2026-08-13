/**
 * @license
 * Copyright 2021 Google LLC
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

import { getModularInstance } from '@firebase/util';
import { expect } from 'chai';
import { getPerformance, FirebasePerformance } from '@firebase/performance';
import firebase from '@firebase/app-compat';
import '@firebase/performance-compat';
import { Compat } from '@firebase/util';
import { PerformanceCompat } from '@firebase/performance-compat';

import { TEST_PROJECT_CONFIG } from './util';

describe('Performance compat interop', () => {
  let app: firebase.app.App;
  let compatPerf: PerformanceCompat & Compat<PerformanceCompat>;
  let modularPerf: FirebasePerformance;

  beforeEach(() => {
    // Performance SDK requires the default app instance
    app = firebase.initializeApp(TEST_PROJECT_CONFIG);
    compatPerf = firebase.performance(app) as unknown as PerformanceCompat & Compat<PerformanceCompat>;
    modularPerf = getPerformance(app as unknown as any);
  });

  afterEach(async () => {
    await app.delete();
  });

  it('Performance compat instance references modular Performance instance', () => {
    expect(getModularInstance(compatPerf)).to.equal(modularPerf);
  });

  it('Performance compat and modular Performance instance share the same configuration', () => {
    expect(compatPerf.dataCollectionEnabled).to.equal(true);
    expect(compatPerf.instrumentationEnabled).to.equal(true);
    expect(modularPerf.dataCollectionEnabled).to.equal(true);
    expect(modularPerf.instrumentationEnabled).to.equal(true);

    // change settings on the compat instance
    compatPerf.dataCollectionEnabled = false;
    compatPerf.instrumentationEnabled = false;

    expect(compatPerf.dataCollectionEnabled).to.equal(false);
    expect(compatPerf.instrumentationEnabled).to.equal(false);
    expect(modularPerf.dataCollectionEnabled).to.equal(false);
    expect(modularPerf.instrumentationEnabled).to.equal(false);

    // change settings on the modular instance
    modularPerf.dataCollectionEnabled = true;
    modularPerf.instrumentationEnabled = true;

    expect(compatPerf.dataCollectionEnabled).to.equal(true);
    expect(compatPerf.instrumentationEnabled).to.equal(true);
    expect(modularPerf.dataCollectionEnabled).to.equal(true);
    expect(modularPerf.instrumentationEnabled).to.equal(true);
  });
});
