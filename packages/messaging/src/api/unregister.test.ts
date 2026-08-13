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

import '../testing/setup';

import { expect } from 'chai';
import { stub } from 'sinon';
import { MessagingService } from '../messaging-service';
import {
  getFakeAnalyticsProvider,
  getFakeApp,
  getFakeInstallations
} from '../testing/fakes/firebase-dependencies';
import { unregister } from './unregister';
// Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
import { _idbManagerInternal } from '../internals/idb-manager';
import { _requestsInternal } from '../internals/requests';

describe('unregister', () => {
  let messaging: MessagingService;

  beforeEach(() => {
    messaging = new MessagingService(
      getFakeApp(),
      getFakeInstallations(),
      getFakeAnalyticsProvider()
    );
  });

  it('deletes the stored FID registration and notifies onUnregisteredHandler', async () => {
    const fid = 'FID_STORED';
    const onUnregisteredSpy = stub();
    messaging.onUnregisteredHandler = onUnregisteredSpy;

    // Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
    const dbGetStub = stub(_idbManagerInternal, 'dbGetFidRegistration').resolves({
      fid,
      lastRegisterTime: Date.now()
    });
    const dbRemoveStub = stub(_idbManagerInternal, 'dbRemoveFidRegistration').resolves();
    const deleteRegStub = stub(
      _requestsInternal,
      'requestDeleteRegistration'
    ).resolves();
    const getIdStub = stub(
      messaging.firebaseDependencies.installations,
      'getId'
    ).resolves('FID_SHOULD_NOT_BE_USED');

    await unregister(messaging);

    expect(dbGetStub).to.have.been.calledOnce;
    expect(deleteRegStub).to.have.been.calledOnceWith(
      messaging.firebaseDependencies,
      fid
    );
    expect(dbRemoveStub).to.have.been.calledOnce;
    expect(getIdStub).to.not.have.been.called;
    expect(onUnregisteredSpy).to.have.been.calledOnceWith(fid);
  });

  it('falls back to installations.getId() when no stored FID registration exists', async () => {
    const fid = 'FID_FROM_INSTALLATIONS';
    messaging.onUnregisteredHandler = stub();

    // Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
    const dbGetStub = stub(_idbManagerInternal, 'dbGetFidRegistration').resolves(
      undefined
    );
    const dbRemoveStub = stub(_idbManagerInternal, 'dbRemoveFidRegistration').resolves();
    const deleteRegStub = stub(
      _requestsInternal,
      'requestDeleteRegistration'
    ).resolves();
    const getIdStub = stub(
      messaging.firebaseDependencies.installations,
      'getId'
    ).resolves(fid);

    await unregister(messaging);

    expect(dbGetStub).to.have.been.calledOnce;
    expect(getIdStub).to.have.been.calledOnce;
    expect(deleteRegStub).to.have.been.calledOnceWith(
      messaging.firebaseDependencies,
      fid
    );
    expect(dbRemoveStub).to.have.been.calledOnce;
  });

  it('does not throw if onUnregisteredHandler is not set', async () => {
    const fid = 'FID';
    messaging.onUnregisteredHandler = null;

    // Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
    stub(_idbManagerInternal, 'dbGetFidRegistration').resolves({
      fid,
      lastRegisterTime: Date.now()
    });
    stub(_idbManagerInternal, 'dbRemoveFidRegistration').resolves();
    stub(_requestsInternal, 'requestDeleteRegistration').resolves();

    await unregister(messaging);
  });

  it('cleans up legacy FCM token stored via getToken() without touching legacy delete token request', async () => {
    const fid = 'FID_STORED';
    const onUnregisteredSpy = stub();
    messaging.onUnregisteredHandler = onUnregisteredSpy;

    // Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
    stub(_idbManagerInternal, 'dbGetFidRegistration').resolves({
      fid,
      lastRegisterTime: Date.now()
    });
    stub(_idbManagerInternal, 'dbRemoveFidRegistration').resolves();
    const deleteRegStub = stub(
      _requestsInternal,
      'requestDeleteRegistration'
    ).resolves();

    // Guard rails: unregister() should clean up legacy token DB, but must not call legacy
    // requestDeleteToken(). The DB cleanup is best-effort.
    const legacyDbRemoveStub = stub(_idbManagerInternal, 'dbRemove').resolves();
    const legacyDeleteTokenReqStub = stub(
      _requestsInternal,
      'requestDeleteToken'
    ).throws(new Error('unexpected requestDeleteToken()'));

    await unregister(messaging);

    expect(deleteRegStub).to.have.been.calledOnceWith(
      messaging.firebaseDependencies,
      fid
    );
    expect(onUnregisteredSpy).to.have.been.calledOnceWith(fid);
    expect(legacyDbRemoveStub).to.have.been.calledOnceWith(
      messaging.firebaseDependencies
    );
    expect(legacyDeleteTokenReqStub).to.not.have.been.called;
  });

  it('does not notify onUnregisteredHandler when delete registration fails', async () => {
    const fid = 'FID';
    const onUnregisteredSpy = stub();
    messaging.onUnregisteredHandler = onUnregisteredSpy;

    // Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
    stub(_idbManagerInternal, 'dbGetFidRegistration').resolves({
      fid,
      lastRegisterTime: Date.now()
    });
    const dbRemoveStub = stub(_idbManagerInternal, 'dbRemoveFidRegistration').resolves();
    stub(_requestsInternal, 'requestDeleteRegistration').rejects(
      new Error('boom')
    );

    await expect(unregister(messaging)).to.be.rejectedWith('boom');
    expect(onUnregisteredSpy).to.not.have.been.called;
    expect(dbRemoveStub).to.not.have.been.called;
  });
});
