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
import { getAuth, signOut, Auth } from '@firebase/auth';
import firebase from '@firebase/app-compat';
import '@firebase/auth-compat';
import { Compat } from '@firebase/util';
import { FirebaseAuth } from '@firebase/auth-types';

import { TEST_PROJECT_CONFIG } from './util';

describe('Auth compat interop', () => {
  let app: firebase.app.App;
  let compatAuth: Compat<FirebaseAuth> & FirebaseAuth;
  let modularAuth: Auth;

  beforeEach(() => {
    app = firebase.initializeApp(TEST_PROJECT_CONFIG, 'auth-interop');
    compatAuth = firebase.auth(app) as unknown as Compat<FirebaseAuth> & FirebaseAuth;
    modularAuth = getAuth(app as unknown as any);
  });

  afterEach(async () => {
    await app.delete();
  });

  it('Auth compat instance references modular Auth instance', () => {
    expect(getModularInstance(compatAuth)).to.equal(modularAuth);
  });

  it('Auth compat and modular Auth share the same user state', async () => {
    expect(compatAuth.currentUser).to.equal(null);
    expect(modularAuth.currentUser).to.equal(null);

    // Fix Vitest / CI error: "auth/api-key-not-valid" when offline or using dummy project config
    const originalFetch = window.fetch.bind(window);
    const fetchStub = sinon
      .stub(window, 'fetch')
      .callsFake(async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof Request
              ? input.url
              : String(input);
        if (url.includes('accounts:signUp') || url.includes('createAuthUri')) {
          return new Response(
            JSON.stringify({
              idToken: 'fake-jwt-token',
              refreshToken: 'fake-refresh-token',
              expiresIn: '3600',
              localId: 'fake-anon-uid'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('accounts:lookup')) {
          return new Response(
            JSON.stringify({
              users: [
                {
                  localId: 'fake-anon-uid',
                  createdAt: '123456789',
                  lastLoginAt: '123456789'
                }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return originalFetch(input, init);
      });

    try {
      const userCred = await compatAuth.signInAnonymously();
      expect(userCred.user?.uid).to.equal(modularAuth.currentUser?.uid);
      expect(await userCred.user?.getIdToken()).to.equal(
        await modularAuth.currentUser?.getIdToken()
      );

      await signOut(modularAuth);
      expect(compatAuth.currentUser).to.equal(null);
      expect(modularAuth.currentUser).to.equal(null);
    } finally {
      fetchStub.restore();
    }
  });
});
