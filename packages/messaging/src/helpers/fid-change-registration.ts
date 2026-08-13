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

import {
  IdChangeUnsubscribeFn,
  Installations,
  _apiInternal as installationsApiInternal
} from '@firebase/installations';
import { _registerInternal } from '../api/register';
// Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
import { _idbManagerInternal } from '../internals/idb-manager';
import { _registerFidInternal } from '../internals/register-fid';
import { _tokenManagerInternal } from '../internals/token-manager';
import { MessagingService } from '../messaging-service';
import { _updateVapidKeyInternal } from './updateVapidKey';

/**
 * Re-runs FCM FID registration when push subscription keys change (e.g. `pushsubscriptionchange`
 * in the service worker). No-op if the app instance was never registered via `register()`.
 * Best-effort: callers should catch failures when permission or push may be unavailable.
 */
export async function refreshFidRegistrationIfStored(
  messaging: MessagingService
): Promise<string | undefined> {
  const stored = await _idbManagerInternal
    .dbGetFidRegistration(messaging.firebaseDependencies)
    .catch(() => undefined);
  if (!stored) {
    return undefined;
  }

  await _updateVapidKeyInternal.updateVapidKey(messaging, stored.vapidKey);

  const fid = await messaging.firebaseDependencies.installations.getId();
  await _registerFidInternal.registerFcmRegistrationWithFid(messaging, fid);
  await _idbManagerInternal.dbSetFidRegistration(
    messaging.firebaseDependencies,
    {
      fid,
      lastRegisterTime: Date.now(),
      vapidKey: messaging.vapidKey
    }
  );
  _tokenManagerInternal.notifyOnRegistered(messaging, fid);
  return fid;
}

/**
 * When the Firebase Installation ID changes, re-run `register()` so FCM registration and
 * onRegistered run for the new FID. No-op if no onRegistered handler is set or the app
 * instance was never registered with FCM.
 */
export function subscribeFidChangeRegistration(
  messaging: MessagingService,
  installations: Installations
): IdChangeUnsubscribeFn {
  return installationsApiInternal.onIdChange(installations, () => {
    void (async () => {
      if (!messaging.onRegisteredHandler) {
        return;
      }
      const stored = await _idbManagerInternal.dbGetFidRegistration(
        messaging.firebaseDependencies
      );
      if (!stored) {
        return;
      }
      await _registerInternal.register(messaging).catch(() => {
        // Best-effort: permission may be revoked or SW unavailable after FID rotation.
      });
    })();
  });
}

// Fix Vitest error: "TypeError: ES Modules cannot be stubbed"
export const _fidChangeRegistrationInternal = {
  refreshFidRegistrationIfStored,
  subscribeFidChangeRegistration
};
