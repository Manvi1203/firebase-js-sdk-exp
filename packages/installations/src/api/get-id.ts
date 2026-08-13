/**
 * @license
 * Copyright 2019 Google LLC
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

import { _getInstallationEntryInternal } from '../helpers/get-installation-entry';
import { _refreshAuthTokenInternal } from '../helpers/refresh-auth-token';
import { FirebaseInstallationsImpl } from '../interfaces/installation-impl';
import { Installations } from '../interfaces/public-types';

/**
 * Creates a Firebase Installation if there isn't one for the app and
 * returns the Installation ID.
 * @param installations - The `Installations` instance.
 *
 * @public
 */
export async function getId(installations: Installations): Promise<string> {
  const installationsImpl = installations as FirebaseInstallationsImpl;
  const { installationEntry, registrationPromise } = await _getInstallationEntryInternal.getInstallationEntry(
    installationsImpl
  );

  if (registrationPromise) {
    registrationPromise.catch(console.error);
  } else {
    // If the installation is already registered, update the authentication
    // token if needed.
    _refreshAuthTokenInternal.refreshAuthToken(installationsImpl).catch(console.error);
  }

  return installationEntry.fid;
}
