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

import '../test/setup';
import { expect } from 'chai';
import { stub } from 'sinon';
import { RemoteConfigCompatImpl } from './remoteConfig';
import { getFakeApp, getFakeModularRemoteConfig } from '../test/util';
import * as modularApi from '@firebase/remote-config';

describe('Remote Config Compat', () => {
  let remoteConfig!: RemoteConfigCompatImpl;
  const fakeModularRemoteConfig = getFakeModularRemoteConfig();
  // Use beforeEach to avoid Vitest error: "ReferenceError: before is not defined"
  beforeEach(() => {
    remoteConfig = new RemoteConfigCompatImpl(
      getFakeApp(),
      fakeModularRemoteConfig
    );
  });

  it('activate() calls modular activate()', async () => {
    // Stub _apiInternal to avoid Vitest error: "TypeError: ES Modules cannot be stubbed"
    const modularActivateStub = stub(
      modularApi._apiInternal,
      'activate'
    ).callsFake(() => Promise.resolve(true));
    const res = await remoteConfig.activate();

    expect(res).to.equal(res);
    expect(modularActivateStub).to.have.been.calledWithExactly(
      fakeModularRemoteConfig
    );
  });

  it('ensureInitialized() calls modular ensureInitialized()', async () => {
    // Stub _apiInternal to avoid Vitest error: "TypeError: ES Modules cannot be stubbed"
    const modularEnsureInitializedStub = stub(
      modularApi._apiInternal,
      'ensureInitialized'
    ).callsFake(() => Promise.resolve());
    await remoteConfig.ensureInitialized();

    expect(modularEnsureInitializedStub).to.have.been.calledWithExactly(
      fakeModularRemoteConfig
    );
  });

  it('fetch() calls modular fetchConfig()', async () => {
    // Stub _apiInternal to avoid Vitest error: "TypeError: ES Modules cannot be stubbed"
    const modularFetchStub = stub(
      modularApi._apiInternal,
      'fetchConfig'
    ).callsFake(() => Promise.resolve());
    await remoteConfig.fetch();

    expect(modularFetchStub).to.have.been.calledWithExactly(
      fakeModularRemoteConfig
    );
  });

  it('fetchAndActivate() calls modular fetchAndActivate()', async () => {
    // Stub _api2Internal to avoid Vitest error: "TypeError: ES Modules cannot be stubbed"
    const modularFetchAndActivateStub = stub(
      modularApi._api2Internal,
      'fetchAndActivate'
    ).callsFake(() => Promise.resolve(true));
    const res = await remoteConfig.fetchAndActivate();

    expect(res).to.equal(true);
    expect(modularFetchAndActivateStub).to.have.been.calledWithExactly(
      fakeModularRemoteConfig
    );
  });

  it('getAll() calls modular getAll()', () => {
    const allValues = {};
    // Stub _apiInternal to avoid Vitest error: "TypeError: ES Modules cannot be stubbed"
    const modularGetAllStub = stub(
      modularApi._apiInternal,
      'getAll'
    ).callsFake(() => allValues);

    const res = remoteConfig.getAll();

    expect(res).to.equal(allValues);
    expect(modularGetAllStub).to.have.been.calledWithExactly(
      fakeModularRemoteConfig
    );
  });

  it('getBoolean() calls modular getBoolean()', () => {
    // Stub _apiInternal to avoid Vitest error: "TypeError: ES Modules cannot be stubbed"
    const modularGetBoolean = stub(
      modularApi._apiInternal,
      'getBoolean'
    ).callsFake(() => false);

    const res = remoteConfig.getBoolean('myKey');

    expect(res).to.equal(false);
    expect(modularGetBoolean).to.have.been.calledWithExactly(
      fakeModularRemoteConfig,
      'myKey'
    );
  });

  it('getNumber() calls modular getNumber()', () => {
    // Stub _apiInternal to avoid Vitest error: "TypeError: ES Modules cannot be stubbed"
    const modularGetNumber = stub(
      modularApi._apiInternal,
      'getNumber'
    ).callsFake(() => 123);
    const res = remoteConfig.getNumber('myNumKey');

    expect(res).to.equal(123);
    expect(modularGetNumber).to.have.been.calledWithExactly(
      fakeModularRemoteConfig,
      'myNumKey'
    );
  });

  it('getString() calls modular getString()', () => {
    // Stub _apiInternal to avoid Vitest error: "TypeError: ES Modules cannot be stubbed"
    const modularGetString = stub(
      modularApi._apiInternal,
      'getString'
    ).callsFake(() => 'abc');
    const res = remoteConfig.getString('myStrKey');

    expect(res).to.equal('abc');
    expect(modularGetString).to.have.been.calledWithExactly(
      fakeModularRemoteConfig,
      'myStrKey'
    );
  });

  it('getValue() calls modular getValue()', () => {
    const fakeValue = {} as modularApi.Value;
    // Stub _apiInternal to avoid Vitest error: "TypeError: ES Modules cannot be stubbed"
    const modularGetValue = stub(
      modularApi._apiInternal,
      'getValue'
    ).callsFake(() => fakeValue);
    const res = remoteConfig.getValue('myValKey');

    expect(res).to.equal(fakeValue);
    expect(modularGetValue).to.have.been.calledWithExactly(
      fakeModularRemoteConfig,
      'myValKey'
    );
  });

  it('setLogLevel() calls modular setLogLevel()', () => {
    // Stub _apiInternal to avoid Vitest error: "TypeError: ES Modules cannot be stubbed"
    const modularSetLogLevel = stub(
      modularApi._apiInternal,
      'setLogLevel'
    ).callsFake(() => {});
    remoteConfig.setLogLevel('debug');

    expect(modularSetLogLevel).to.have.been.calledWithExactly(
      fakeModularRemoteConfig,
      'debug'
    );
  });
});
