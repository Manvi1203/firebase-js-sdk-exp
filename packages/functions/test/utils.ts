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

import { FirebaseOptions, FirebaseApp } from '@firebase/app';
import { Provider, ComponentContainer } from '@firebase/component';
import { FirebaseAuthInternalName } from '@firebase/auth-interop-types';
import { AppCheckInternalComponentName } from '@firebase/app-check-interop-types';
import { FunctionsService } from '../src/service';
import { connectFunctionsEmulator } from '../src/api';
import { MessagingInternalComponentName } from '../../../packages/messaging-interop-types';

export function makeFakeApp(options: FirebaseOptions = {}): FirebaseApp {
  options = {
    apiKey: 'apiKey',
    projectId: 'projectId',
    authDomain: 'authDomain',
    messagingSenderId: '1234567890',
    databaseURL: 'databaseUrl',
    storageBucket: 'storageBucket',
    appId: '1:777777777777:web:d93b5ca1475efe57',
    ...options
  };
  return {
    name: 'appName',
    options,
    automaticDataCollectionEnabled: true
  };
}

export function createTestService(
  app: FirebaseApp,
  region?: string,
  authProvider = new Provider<FirebaseAuthInternalName>(
    'auth-internal',
    new ComponentContainer('test')
  ),
  messagingProvider = new Provider<MessagingInternalComponentName>(
    'messaging-internal',
    new ComponentContainer('test')
  ),
  appCheckProvider = new Provider<AppCheckInternalComponentName>(
    'app-check-internal',
    new ComponentContainer('test')
  )
): FunctionsService {
  const functions = new FunctionsService(
    app,
    authProvider,
    messagingProvider,
    appCheckProvider,
    region
  );
  const useEmulator = !!process.env.FIREBASE_FUNCTIONS_EMULATOR_ORIGIN;
  if (useEmulator) {
    const url = new URL(process.env.FIREBASE_FUNCTIONS_EMULATOR_ORIGIN!);
    connectFunctionsEmulator(
      functions,
      url.hostname,
      Number.parseInt(url.port, 10)
    );
  } else {
    // When emulator origin is not set, provide mock fetch implementation matching config/functions/index.js
    (functions as unknown as { fetchImpl: typeof fetch }).fetchImpl =
      mockFunctionsFetch;
  }
  return functions;
}

function mockFunctionsFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input.toString();
  const headers = new Headers(init?.headers);

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
  if (urlStr.includes('tokenTestv2')) {
    return Promise.resolve(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }
  if (urlStr.includes('instanceIdTestv2')) {
    return Promise.resolve(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }
  if (urlStr.includes('appCheckTestv2')) {
    const token = headers.get('X-Firebase-AppCheck') || undefined;
    return Promise.resolve(
      new Response(JSON.stringify({ data: { token } }), {
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
