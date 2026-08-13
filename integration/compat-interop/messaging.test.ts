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
import { getMessaging, Messaging } from '@firebase/messaging';
import firebase from '@firebase/app-compat';
import '@firebase/messaging-compat';
import { Compat } from '@firebase/util';
import { MessagingCompat } from '@firebase/messaging-compat';

import { TEST_PROJECT_CONFIG } from './util';

describe('Messaging compat interop', () => {
  let app: firebase.app.App;
  let compatMessaging: Compat<MessagingCompat>;
  let modularMessaging: Messaging;

  beforeEach(() => {
    app = firebase.initializeApp(TEST_PROJECT_CONFIG, 'messaging-interop');
    compatMessaging = firebase.messaging(app) as unknown as Compat<MessagingCompat>;
    modularMessaging = getMessaging(app as unknown as any);
  });

  afterEach(async () => {
    await app.delete();
  });

  it('Messaging compat instance references modular Messaging instance', () => {
    expect(getModularInstance(compatMessaging)).to.equal(modularMessaging);
  });
});
