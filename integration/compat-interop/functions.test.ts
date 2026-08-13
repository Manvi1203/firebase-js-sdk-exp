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
import { getFunctions, Functions } from '@firebase/functions';
import firebase from '@firebase/app-compat';
import '@firebase/functions-compat';
import { Compat } from '@firebase/util';
import { FunctionsCompat } from '@firebase/functions-compat';

import { TEST_PROJECT_CONFIG } from './util';

describe('Functions compat interop', () => {
  let app: firebase.app.App;
  let compatFunction: Compat<FunctionsCompat>;
  let modularFunctions: Functions;

  beforeEach(() => {
    app = firebase.initializeApp(TEST_PROJECT_CONFIG, 'functions-interop');
    compatFunction = firebase.functions(app) as unknown as Compat<FunctionsCompat>;
    modularFunctions = getFunctions(app as unknown as any);
  });

  afterEach(async () => {
    await app.delete();
  });

  it('Functions compat instance references modular Functions instance', () => {
    expect(getModularInstance(compatFunction)).to.equal(modularFunctions);
  });
});
