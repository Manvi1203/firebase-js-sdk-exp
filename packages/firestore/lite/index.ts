/**
 * Firestore Lite
 *
 * @remarks Firestore Lite is a small online-only SDK that allows read
 * and write access to your Firestore database. All operations connect
 * directly to the backend, and `onSnapshot()` APIs are not supported.
 * @packageDocumentation
 */

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

import { registerFirestore } from './register';
registerFirestore();

export {
  aggregateQuerySnapshotEqual,
  getCount,
  getAggregate,
  count,
  sum,
  average,
  aggregateFieldEqual
} from '../src/lite-api/aggregate';

// Fix Vitest error: type-only exports in lite/index.ts
export {
  AggregateField,
  AggregateQuerySnapshot
} from '../src/lite-api/aggregate_types';
export type {
  AggregateFieldType,
  AggregateSpec,
  AggregateSpecData,
  AggregateType
} from '../src/lite-api/aggregate_types';

export type { FirestoreSettings as Settings } from '../src/lite-api/settings';

export {
  Firestore as Firestore,
  initializeFirestore,
  getFirestore,
  terminate,
  connectFirestoreEmulator
} from '../src/lite-api/database';
export type { EmulatorMockTokenOptions } from '../src/lite-api/database';

export {
  DocumentReference,
  Query,
  CollectionReference,
  collection,
  collectionGroup,
  doc,
  refEqual,
  queryEqual
} from '../src/lite-api/reference';
export type {
  DocumentData,
  UpdateData,
  WithFieldValue,
  PartialWithFieldValue,
  SetOptions
} from '../src/lite-api/reference';

export {
  and,
  endAt,
  endBefore,
  startAt,
  startAfter,
  limit,
  limitToLast,
  where,
  or,
  orderBy,
  query,
  QueryConstraint,
  QueryCompositeFilterConstraint,
  QueryFieldFilterConstraint,
  QueryOrderByConstraint,
  QueryLimitConstraint,
  QueryStartAtConstraint,
  QueryEndAtConstraint
} from '../src/lite-api/query';
export type {
  QueryConstraintType,
  QueryFilterConstraint,
  QueryNonFilterConstraint,
  OrderByDirection,
  WhereFilterOp
} from '../src/lite-api/query';

export {
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  getDoc,
  getDocs
} from '../src/lite-api/reference_impl';

export type {
  Primitive,
  NestedUpdateFields,
  ChildUpdateFields,
  AddPrefixToKeys,
  UnionToIntersection
} from '../src/lite-api/types';

// TODO(firestorelite): Add tests when Queries are usable
export { FieldPath, documentId } from '../src/lite-api/field_path';

// TODO(firestorelite): Add tests when setDoc() is available
export { FieldValue } from '../src/lite-api/field_value';

export {
  increment,
  minimum,
  maximum,
  arrayRemove,
  arrayUnion,
  serverTimestamp,
  deleteField,
  vector
} from '../src/lite-api/field_value_impl';

export {
  DocumentSnapshot,
  QueryDocumentSnapshot,
  QuerySnapshot,
  snapshotEqual
} from '../src/lite-api/snapshot';
export type { FirestoreDataConverter } from '../src/lite-api/snapshot';

export { VectorValue } from '../src/lite-api/vector_value';

export { WriteBatch, writeBatch } from '../src/lite-api/write_batch';

export type { TransactionOptions } from '../src/lite-api/transaction_options';

export { Transaction, runTransaction } from '../src/lite-api/transaction';

// Fix Vitest error: type-only export for LogLevelString
export { setLogLevel } from '../src/util/log';
export type { LogLevelString as LogLevel } from '../src/util/log';

export { Bytes } from '../src/lite-api/bytes';

export { GeoPoint } from '../src/lite-api/geo_point';

export { Timestamp } from '../src/lite-api/timestamp';

export { FirestoreError } from '../src/util/error';
export type { FirestoreErrorCode } from '../src/util/error';
