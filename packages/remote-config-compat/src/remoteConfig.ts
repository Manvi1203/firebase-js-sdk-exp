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

import { FirebaseApp, _FirebaseService } from '@firebase/app-compat';
import {
  Value as ValueCompat,
  FetchStatus as FetchSTatusCompat,
  Settings as SettingsCompat,
  LogLevel as RemoteConfigLogLevel,
  RemoteConfig as RemoteConfigCompat
} from '@firebase/remote-config-types';
import {
  RemoteConfig,
  _apiInternal,
  _api2Internal,
  isSupported
} from '@firebase/remote-config';

export { isSupported };

export class RemoteConfigCompatImpl
  implements RemoteConfigCompat, _FirebaseService
{
  constructor(public app: FirebaseApp, readonly _delegate: RemoteConfig) {}

  get defaultConfig(): { [key: string]: string | number | boolean } {
    return this._delegate.defaultConfig;
  }

  set defaultConfig(value: { [key: string]: string | number | boolean }) {
    this._delegate.defaultConfig = value;
  }

  get fetchTimeMillis(): number {
    return this._delegate.fetchTimeMillis;
  }

  get lastFetchStatus(): FetchSTatusCompat {
    return this._delegate.lastFetchStatus;
  }

  get settings(): SettingsCompat {
    return this._delegate.settings;
  }

  set settings(value: SettingsCompat) {
    this._delegate.settings = value;
  }

  activate(): Promise<boolean> {
    return _apiInternal.activate(this._delegate);
  }

  ensureInitialized(): Promise<void> {
    return _apiInternal.ensureInitialized(this._delegate);
  }

  /**
   * @throws a {@link ErrorCode.FETCH_CLIENT_TIMEOUT} if the request takes longer than
   * {@link Settings.fetchTimeoutInSeconds} or
   * {@link DEFAULT_FETCH_TIMEOUT_SECONDS}.
   */
  fetch(): Promise<void> {
    return _apiInternal.fetchConfig(this._delegate);
  }

  fetchAndActivate(): Promise<boolean> {
    return _api2Internal.fetchAndActivate(this._delegate);
  }

  getAll(): { [key: string]: ValueCompat } {
    return _apiInternal.getAll(this._delegate);
  }

  getBoolean(key: string): boolean {
    return _apiInternal.getBoolean(this._delegate, key);
  }

  getNumber(key: string): number {
    return _apiInternal.getNumber(this._delegate, key);
  }

  getString(key: string): string {
    return _apiInternal.getString(this._delegate, key);
  }

  getValue(key: string): ValueCompat {
    return _apiInternal.getValue(this._delegate, key);
  }

  // Based on packages/firestore/src/util/log.ts but not static because we need per-instance levels
  // to differentiate 2p and 3p use-cases.
  setLogLevel(logLevel: RemoteConfigLogLevel): void {
    _apiInternal.setLogLevel(this._delegate, logLevel);
  }
}
