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

import { FirebaseApp } from '@firebase/app-compat';
import { FunctionsService } from '../src/service';
import { getFunctions } from '@firebase/functions';

export function createTestService(
  app: FirebaseApp,
  regionOrCustomDomain?: string
): FunctionsService {
  const modularFunctions = getFunctions(app, regionOrCustomDomain);
  const functions = new FunctionsService(
    app,
    modularFunctions
  );
  const useEmulator = !!process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST;
  if (useEmulator) {
    functions.useEmulator(
      process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST!,
      Number(process.env.FIREBASE_FUNCTIONS_EMULATOR_PORT!)
    );
  } else {
    // When emulator origin is not set, provide mock fetch implementation matching config/functions/index.js
    (modularFunctions as unknown as { fetchImpl: typeof fetch }).fetchImpl =
      mockFunctionsFetch;
  }
  return functions;
}

function mockFunctionsFetch(
  input: RequestInfo | URL,
  _init?: RequestInit
): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input.toString();

  if (urlStr.includes('dataTestv2')) {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            message: 'stub response',
            code: 42,
            long: {
              value: '420',
              '@type': 'type.googleapis.com/google.protobuf.Int64Value'
            }
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }
  if (urlStr.includes('scalarTestv2')) {
    return Promise.resolve(
      new Response(JSON.stringify({ data: 76 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }
  if (urlStr.includes('nullTestv2')) {
    return Promise.resolve(
      new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }
  if (urlStr.includes('missingResultTestv2')) {
    return Promise.resolve(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }
  if (urlStr.includes('unhandledErrorTestv2')) {
    return Promise.resolve(new Response('', { status: 500 }));
  }
  if (urlStr.includes('unknownErrorTestv2')) {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          error: {
            status: 'THIS_IS_NOT_VALID',
            message: 'this should be ignored'
          }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }
  if (urlStr.includes('explicitErrorTestv2')) {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          error: {
            status: 'OUT_OF_RANGE',
            message: 'explicit nope',
            details: {
              start: 10,
              end: 20,
              long: {
                value: '30',
                '@type': 'type.googleapis.com/google.protobuf.Int64Value'
              }
            }
          }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }
  if (urlStr.includes('httpErrorTestv2')) {
    return Promise.resolve(new Response('', { status: 400 }));
  }
  if (urlStr.includes('timeoutTestv2')) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(
          new Response(JSON.stringify({ data: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }, 500);
    });
  }

  return Promise.resolve(new Response('Not Found', { status: 404 }));
}
