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
import * as sinon from 'sinon';
import { getAnalytics, Analytics } from '@firebase/analytics';
import firebase from '@firebase/app-compat';
import '@firebase/analytics-compat';
import { Compat } from '@firebase/util';
import { AnalyticsCompat } from '@firebase/analytics-compat';

import { TEST_PROJECT_CONFIG } from './util';

describe('Analytics compat interop', () => {
  let app: firebase.app.App;
  let compatAnalytics: Compat<AnalyticsCompat>;
  let modularAnalytics: Analytics;
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    // Fix Vitest / CI error: "Analytics: Dynamic config fetch failed: [400] API key not valid"
    const originalFetch = window.fetch.bind(window);
    fetchStub = sinon.stub(window, 'fetch').callsFake(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
      if (url.includes('webConfig') || url.includes('google-analytics')) {
        return new Response(
          JSON.stringify({
            measurementId: 'G-123456',
            appId: '1:1234567890:web:abcdef123456'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    });

    app = firebase.initializeApp(TEST_PROJECT_CONFIG, 'analytics-interop');
    compatAnalytics = firebase.analytics(app) as unknown as Compat<AnalyticsCompat>;
    modularAnalytics = getAnalytics(app as unknown as any);
  });

  afterEach(async () => {
    fetchStub.restore();
    await app.delete();
  });

  it('Analytics compat instance references modular Analytics instance', () => {
    expect(getModularInstance(compatAnalytics)).to.equal(modularAnalytics);
  });
});
