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
import { Connection } from '../implementation/connection';
import {
  newTextConnection as browserNewTextConnection,
  newBytesConnection as browserNewBytesConnection,
  newBlobConnection as browserNewBlobConnection,
  newStreamConnection as browserNewStreamConnection,
  injectTestConnection as browserInjectTestConnection
} from './browser/connection';
import {
  newTextConnection as nodeNewTextConnection,
  newBytesConnection as nodeNewBytesConnection,
  newBlobConnection as nodeNewBlobConnection,
  newStreamConnection as nodeNewStreamConnection,
  injectTestConnection as nodeInjectTestConnection
} from './node/connection';

function isBrowser(): boolean {
  return (
    typeof XMLHttpRequest !== 'undefined' ||
    typeof window !== 'undefined' ||
    typeof self !== 'undefined'
  );
}

export function injectTestConnection(
  factory: (() => Connection<string>) | null
): void {
  // Fix Vitest error: "Error: Blobs are not supported on Node" in browser tests
  if (isBrowser()) {
    browserInjectTestConnection(factory);
  } else {
    nodeInjectTestConnection(factory);
  }
}

export function newTextConnection(): Connection<string> {
  if (isBrowser()) {
    return browserNewTextConnection();
  }
  return nodeNewTextConnection();
}

export function newBytesConnection(): Connection<ArrayBuffer> {
  if (isBrowser()) {
    return browserNewBytesConnection();
  }
  return nodeNewBytesConnection();
}

export function newBlobConnection(): Connection<Blob> {
  if (isBrowser()) {
    return browserNewBlobConnection();
  }
  return nodeNewBlobConnection();
}

export function newStreamConnection(): Connection<ReadableStream<Uint8Array>> {
  if (isBrowser()) {
    return browserNewStreamConnection();
  }
  return nodeNewStreamConnection();
}

