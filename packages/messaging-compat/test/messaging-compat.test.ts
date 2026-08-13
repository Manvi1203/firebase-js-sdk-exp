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

// Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
import { _messagingInternal } from '@firebase/messaging';
import { _messagingSwInternal } from '@firebase/messaging/sw';

import { getFakeApp, getFakeModularMessaging } from './fakes';

import { MessagingCompatImpl } from '../src/messaging-compat';
import { expect } from 'chai';
import { stub, SinonStub } from 'sinon';

describe('messagingCompat', () => {
  let messagingCompat: MessagingCompatImpl;
  let getTokenStub: SinonStub;
  let deleteTokenStub: SinonStub;
  let onMessageStub: SinonStub;
  let onBackgroundMessageStub: SinonStub;

  beforeEach(() => {
    messagingCompat = new MessagingCompatImpl(
      getFakeApp(),
      getFakeModularMessaging()
    );

    // Stubs
    // Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
    getTokenStub = stub(_messagingInternal, 'getToken').resolves('fake-token');
    deleteTokenStub = stub(_messagingInternal, 'deleteToken').resolves(true);
    onMessageStub = stub(_messagingInternal, 'onMessage');
    onBackgroundMessageStub = stub(
      _messagingSwInternal,
      'onBackgroundMessage'
    );
  });

  it('routes messagingCompat.getToken to modular SDK', async () => {
    await messagingCompat.getToken();
    expect(getTokenStub.called).to.be.true;
  });

  it('routes messagingCompat.deleteToken to modular SDK', async () => {
    await messagingCompat.deleteToken();
    expect(deleteTokenStub.called).to.be.true;
  });

  it('routes messagingCompat.onMessage to modular SDK', () => {
    messagingCompat.onMessage(_ => {});
    expect(onMessageStub.called).to.be.true;
  });

  it('routes messagingCompat.onBackgroundMessage to modular SDK', () => {
    messagingCompat.onBackgroundMessage(_ => {});
    expect(onBackgroundMessageStub.called).to.be.true;
  });
});
