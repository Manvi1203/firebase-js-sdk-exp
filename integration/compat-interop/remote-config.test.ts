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
import { getRemoteConfig, RemoteConfig } from '@firebase/remote-config';
import firebase from '@firebase/app-compat';
import '@firebase/remote-config-compat';
import { Compat } from '@firebase/util';
import { RemoteConfigCompat } from '@firebase/remote-config-compat';

import { TEST_PROJECT_CONFIG } from './util';

describe('RC compat interop', () => {
  let app: firebase.app.App;
  let compatRC: Compat<RemoteConfigCompat>;
  let modularRC: RemoteConfig;

  beforeEach(() => {
    app = firebase.initializeApp(TEST_PROJECT_CONFIG, 'rc-interop');
    compatRC = firebase.remoteConfig(app) as unknown as Compat<RemoteConfigCompat>;
    modularRC = getRemoteConfig(app as unknown as any);
  });

  afterEach(async () => {
    await app.delete();
  });

  it('RC compat instance references modular RC instance', () => {
    expect(getModularInstance(compatRC)).to.equal(modularRC);
  });
});
