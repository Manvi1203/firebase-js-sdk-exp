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

// APIs that don't depend on @firebase/app
// Fix Vitest error: "SyntaxError: The requested module ... does not provide an export named 'EmulatorMockTokenOptions'"
export type { EmulatorMockTokenOptions } from './api/Database';
export {
  Database,
  enableLogging,
  goOffline,
  goOnline,
  forceWebSockets,
  forceLongPolling,
  connectDatabaseEmulator
} from './api/Database';
// Fix Vitest error: "SyntaxError: The requested module '/src/api/Reference.ts' does not provide an export named 'Query'"
export type {
  Query,
  DatabaseReference,
  ListenOptions,
  Unsubscribe,
  ThenableReference
} from './api/Reference';
export { OnDisconnect } from './api/OnDisconnect';
// Fix Vitest error: "SyntaxError: The requested module '/src/api/Reference_impl.ts' does not provide an export named 'QueryConstraintType'"
export type {
  EventType,
  IteratedDataSnapshot,
  QueryConstraintType
} from './api/Reference_impl';
export {
  DataSnapshot,
  QueryConstraint,
  endAt,
  endBefore,
  equalTo,
  get,
  limitToFirst,
  limitToLast,
  off,
  onChildAdded,
  onChildChanged,
  onChildMoved,
  onChildRemoved,
  onDisconnect,
  onValue,
  orderByChild,
  orderByKey,
  orderByPriority,
  orderByValue,
  push,
  query,
  ref,
  refFromURL,
  remove,
  set,
  setPriority,
  setWithPriority,
  startAfter,
  startAt,
  update,
  child
} from './api/Reference_impl';
export { increment, serverTimestamp } from './api/ServerValue';
// Fix Vitest error: "SyntaxError: The requested module '/src/api/Transaction.ts' does not provide an export named 'TransactionOptions'"
export type { TransactionOptions } from './api/Transaction';
export {
  runTransaction,
  TransactionResult
} from './api/Transaction';

// internal exports
export { setSDKVersion as _setSDKVersion } from './core/version';
export {
  ReferenceImpl as _ReferenceImpl,
  QueryImpl as _QueryImpl
} from './api/Reference_impl';
export { repoManagerDatabaseFromApp as _repoManagerDatabaseFromApp } from './api/Database';
export {
  validatePathString as _validatePathString,
  validateWritablePath as _validateWritablePath
} from './core/util/validation';
// Fix Vitest error: "SyntaxError: The requested module '/src/core/view/EventRegistration.ts' does not provide an export named 'UserCallback'"
export type { UserCallback as _UserCallback } from './core/view/EventRegistration';
export { QueryParams as _QueryParams } from './core/view/QueryParams';

/* eslint-disable camelcase */
export {
  hijackHash as _TEST_ACCESS_hijackHash,
  forceRestClient as _TEST_ACCESS_forceRestClient
} from './api/test_access';
export * from './internal/index';
/* eslint-enable camelcase */
