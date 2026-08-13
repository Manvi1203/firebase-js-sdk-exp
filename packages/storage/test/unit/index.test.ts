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
import { getStorage } from '../../src/index';
import { FirebaseStorageImpl } from '../../src/service';
// eslint-disable-next-line import/no-extraneous-dependencies
import { initializeApp, deleteApp } from '@firebase/app';

// Fix Vitest error: "Failed to resolve import ../../../../config/project.json"
export const PROJECT_ID = 'my-project';
export const STORAGE_BUCKET = 'my-bucket.appspot.com';
export const API_KEY = 'fake-api-key';
export const AUTH_DOMAIN = 'my-project.firebaseapp.com';

describe('Firebase Storage > API', () => {
  it('getStorage() with no bucket url specified sets correct bucket', async () => {
    // Fix Node/Vitest error: use unique app name to avoid "app/duplicate-app"
    const app = initializeApp(
      {
        apiKey: API_KEY,
        projectId: PROJECT_ID,
        storageBucket: STORAGE_BUCKET,
        authDomain: AUTH_DOMAIN
      },
      'test-storage-app-1'
    );
    const storage = getStorage(app);
    expect((storage as FirebaseStorageImpl)._bucket?.bucket).to.equal(
      STORAGE_BUCKET
    );
    await deleteApp(app);
  });
  it('getStorage() with custom bucket url sets correct bucket', async () => {
    // Fix Node/Vitest error: use unique app name to avoid "app/duplicate-app"
    const app = initializeApp(
      {
        apiKey: API_KEY,
        projectId: PROJECT_ID,
        storageBucket: STORAGE_BUCKET,
        authDomain: AUTH_DOMAIN
      },
      'test-storage-app-2'
    );
    const storage = getStorage(app, 'gs://foo-bar.appspot.com');
    expect((storage as FirebaseStorageImpl)._bucket?.bucket).to.equal(
      'foo-bar.appspot.com'
    );
    await deleteApp(app);
  });
});
