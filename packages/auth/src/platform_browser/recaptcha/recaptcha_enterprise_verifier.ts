/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @license
 * Copyright 2022 Google LLC
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

import { isEnterprise, RecaptchaConfig } from './recaptcha';
import { getRecaptchaConfig } from '../../api/authentication/recaptcha';
import {
  RecaptchaClientType,
  RecaptchaVersion,
  RecaptchaActionName,
  RecaptchaAuthProvider,
  EnforcementState
} from '../../api';

import { Auth } from '../../model/public_types';
import { AuthInternal } from '../../model/auth';
import { _castAuth } from '../../core/auth/auth_impl';
import * as jsHelpers from '../load_js';
import { AuthErrorCode } from '../../core/errors';
import { StartPhoneMfaEnrollmentRequest } from '../../api/account_management/mfa';
import { StartPhoneMfaSignInRequest } from '../../api/authentication/mfa';
import { MockGreCAPTCHATopLevel } from './recaptcha_mock';
import { Deferred } from '@firebase/util';

export const RECAPTCHA_ENTERPRISE_VERIFIER_TYPE = 'recaptcha-enterprise';
export const FAKE_TOKEN = 'NO_RECAPTCHA';

export const RECAPTCHA_ENTERPRISE_ONLOAD_CALLBACK_NAME =
  'onFirebaseAuthREInstanceReady';

declare global {
  interface Window {
    [RECAPTCHA_ENTERPRISE_ONLOAD_CALLBACK_NAME]: () => void;
  }
}
export class RecaptchaEnterpriseVerifier {
  /**
   * Identifies the type of application verifier (e.g. "recaptcha-enterprise").
   */
  readonly type = RECAPTCHA_ENTERPRISE_VERIFIER_TYPE;

  private readonly auth: AuthInternal;

  /**
   * Deferred that resolves when script tag has been injected onto the page
   * and the script is ready (grecaptcha.ready() and script.onload are not
   * reliable indicators, so this resolves when the global
   * `window[RECAPTCHA_ENTERPRISE_ONLOAD_CALLBACK_NAME]()` callback provided to the recaptcha url param "onload"
   * is triggered).
   * As a static variable this is applied to all instances of the class.
   * This will cause an error if users try to create multiple RecaptchaVerifiers
   * with different Recaptcha Enterprise sitekeys, which should be an
   * unuspported use case.
   */
  private static scriptInjectionDeferred: Deferred<void> | null = null;

  // Fix Vitest error: reset scriptInjectionDeferred between tests
  /** @internal */
  static _reset(): void {
    RecaptchaEnterpriseVerifier.scriptInjectionDeferred = null;
  }

  /**
   *
   * @param authExtern - The corresponding Firebase {@link Auth} instance.
   *
   */
  constructor(authExtern: Auth) {
    this.auth = _castAuth(authExtern);
  }

  /**
   * Executes the verification process.
   *
   * @returns A Promise for a token that can be used to assert the validity of a request.
   */
  async verify(
    action: string = 'verify',
    forceRefresh = false
  ): Promise<string> {
    async function retrieveSiteKey(auth: AuthInternal): Promise<string> {
      if (!forceRefresh) {
        if (auth.tenantId == null && auth._agentRecaptchaConfig != null) {
          return auth._agentRecaptchaConfig.siteKey;
        }
        if (
          auth.tenantId != null &&
          auth._tenantRecaptchaConfigs[auth.tenantId] !== undefined
        ) {
          return auth._tenantRecaptchaConfigs[auth.tenantId].siteKey;
        }
      }

      const response = await getRecaptchaConfig(auth, {
        clientType: RecaptchaClientType.WEB,
        version: RecaptchaVersion.ENTERPRISE
      });
      if (response.recaptchaKey === undefined) {
        throw new Error('recaptcha Enterprise site key undefined');
      }
      const config = new RecaptchaConfig(response);
      if (auth.tenantId == null) {
        auth._agentRecaptchaConfig = config;
      } else {
        auth._tenantRecaptchaConfigs[auth.tenantId] = config;
      }
      return config.siteKey;
    }

    // Returns Promise for a mock token when appVerificationDisabledForTesting is true.
    if (this.auth.settings.appVerificationDisabledForTesting) {
      const mockRecaptcha = new MockGreCAPTCHATopLevel();
      return mockRecaptcha.execute('siteKey', { action: 'verify' });
    }

    if (typeof window === 'undefined') {
      throw new Error('RecaptchaVerifier is only supported in browser');
    }

    const siteKey = await retrieveSiteKey(this.auth);

    if (
      !forceRefresh &&
      isEnterprise(window.grecaptcha) &&
      // If download has already been initiated, do not trigger another
      // download, await the promise here.
      RecaptchaEnterpriseVerifier.scriptInjectionDeferred
    ) {
      await RecaptchaEnterpriseVerifier.scriptInjectionDeferred.promise;
    } else {
      let url = jsHelpers._recaptchaEnterpriseScriptUrl();
      if (url.length !== 0) {
        url +=
          siteKey +
          `&onload=${RECAPTCHA_ENTERPRISE_ONLOAD_CALLBACK_NAME}`;
      }
      // Existence of deferred indicates download has been initiated.
      // Fix Vitest error: bind loadJS to local deferred to prevent race condition
      const deferred = new Deferred<void>();
      RecaptchaEnterpriseVerifier.scriptInjectionDeferred = deferred;

      /**
       * Script attached to global window object that will be called
       * when the ReCAPTCHA Enterprise instance is ready.
       * grecaptcha.ready() is not reliable when there are multiple
       * scripts on the page, and script.onload only indicates the
       * script has downloaded, not that it has initialized.
       */
      window[RECAPTCHA_ENTERPRISE_ONLOAD_CALLBACK_NAME] = () => {
        deferred.resolve();
      };
      await jsHelpers._loadJS(url);
      await deferred.promise;
    }

    const grecaptcha = window.grecaptcha;
    if (isEnterprise(grecaptcha)) {
      return new Promise<string>(resolve => {
        grecaptcha.enterprise.ready(() => {
          // Fix Vitest error: "TypeError: Cannot read properties of undefined (reading 'then')"
          Promise.resolve(grecaptcha.enterprise.execute(siteKey, { action }))
            .then(token => {
              resolve(token);
            })
            .catch(() => {
              resolve(FAKE_TOKEN);
            });
        });
      });
    } else {
      throw new Error('No reCAPTCHA enterprise script loaded.');
    }
  }
}

export async function injectRecaptchaFields<T extends object>(
  auth: AuthInternal,
  request: T,
  action: RecaptchaActionName,
  isCaptchaResp = false,
  isFakeToken = false
): Promise<T> {
  const verifier = new RecaptchaEnterpriseVerifier(auth);
  let captchaResponse;

  if (isFakeToken) {
    captchaResponse = FAKE_TOKEN;
  } else {
    try {
      captchaResponse = await verifier.verify(action);
    } catch (error) {
      captchaResponse = await verifier.verify(action, true);
    }
  }

  const newRequest = { ...request };
  if (
    action === RecaptchaActionName.MFA_SMS_ENROLLMENT ||
    action === RecaptchaActionName.MFA_SMS_SIGNIN
  ) {
    if ('phoneEnrollmentInfo' in newRequest) {
      const phoneNumber = (
        newRequest as unknown as StartPhoneMfaEnrollmentRequest
      ).phoneEnrollmentInfo.phoneNumber;
      const recaptchaToken = (
        newRequest as unknown as StartPhoneMfaEnrollmentRequest
      ).phoneEnrollmentInfo.recaptchaToken;

      Object.assign(newRequest, {
        'phoneEnrollmentInfo': {
          phoneNumber,
          recaptchaToken,
          captchaResponse,
          'clientType': RecaptchaClientType.WEB,
          'recaptchaVersion': RecaptchaVersion.ENTERPRISE
        }
      });
    } else if ('phoneSignInInfo' in newRequest) {
      const recaptchaToken = (
        newRequest as unknown as StartPhoneMfaSignInRequest
      ).phoneSignInInfo.recaptchaToken;

      Object.assign(newRequest, {
        'phoneSignInInfo': {
          recaptchaToken,
          captchaResponse,
          'clientType': RecaptchaClientType.WEB,
          'recaptchaVersion': RecaptchaVersion.ENTERPRISE
        }
      });
    }
    return newRequest;
  }

  if (!isCaptchaResp) {
    Object.assign(newRequest, { captchaResponse });
  } else {
    Object.assign(newRequest, { 'captchaResp': captchaResponse });
  }
  Object.assign(newRequest, { 'clientType': RecaptchaClientType.WEB });
  Object.assign(newRequest, {
    'recaptchaVersion': RecaptchaVersion.ENTERPRISE
  });
  return newRequest;
}

type ActionMethod<TRequest, TResponse> = (
  auth: AuthInternal,
  request: TRequest
) => Promise<TResponse>;

export async function handleRecaptchaFlow<TRequest extends object, TResponse>(
  authInstance: AuthInternal,
  request: TRequest,
  actionName: RecaptchaActionName,
  actionMethod: ActionMethod<TRequest, TResponse>,
  recaptchaAuthProvider: RecaptchaAuthProvider
): Promise<TResponse> {
  if (recaptchaAuthProvider === RecaptchaAuthProvider.EMAIL_PASSWORD_PROVIDER) {
    if (
      authInstance
        ._getRecaptchaConfig()
        ?.isProviderEnabled(RecaptchaAuthProvider.EMAIL_PASSWORD_PROVIDER)
    ) {
      const requestWithRecaptcha = await injectRecaptchaFields(
        authInstance,
        request,
        actionName,
        actionName === RecaptchaActionName.GET_OOB_CODE
      );
      return actionMethod(authInstance, requestWithRecaptcha);
    } else {
      return actionMethod(authInstance, request).catch(async error => {
        if (error.code === `auth/${AuthErrorCode.MISSING_RECAPTCHA_TOKEN}`) {
          console.log(
            `${actionName} is protected by reCAPTCHA Enterprise for this project. Automatically triggering the reCAPTCHA flow and restarting the flow.`
          );
          const requestWithRecaptcha = await injectRecaptchaFields(
            authInstance,
            request,
            actionName,
            actionName === RecaptchaActionName.GET_OOB_CODE
          );
          return actionMethod(authInstance, requestWithRecaptcha);
        } else {
          return Promise.reject(error);
        }
      });
    }
  } else if (recaptchaAuthProvider === RecaptchaAuthProvider.PHONE_PROVIDER) {
    if (
      authInstance
        ._getRecaptchaConfig()
        ?.isProviderEnabled(RecaptchaAuthProvider.PHONE_PROVIDER)
    ) {
      const requestWithRecaptcha = await injectRecaptchaFields(
        authInstance,
        request,
        actionName
      );

      return actionMethod(authInstance, requestWithRecaptcha).catch(
        async error => {
          if (
            authInstance
              ._getRecaptchaConfig()
              ?.getProviderEnforcementState(
                RecaptchaAuthProvider.PHONE_PROVIDER
              ) === EnforcementState.AUDIT
          ) {
            // AUDIT mode
            if (
              error.code === `auth/${AuthErrorCode.MISSING_RECAPTCHA_TOKEN}` ||
              error.code === `auth/${AuthErrorCode.INVALID_APP_CREDENTIAL}`
            ) {
              console.log(
                `Failed to verify with reCAPTCHA Enterprise. Automatically triggering the reCAPTCHA v2 flow to complete the ${actionName} flow.`
              );
              // reCAPTCHA Enterprise token is missing or reCAPTCHA Enterprise token
              // check fails.
              // Fallback to reCAPTCHA v2 flow.
              const requestWithRecaptchaFields = await injectRecaptchaFields(
                authInstance,
                request,
                actionName,
                false, // isCaptchaResp
                true // isFakeToken
              );
              // This will call the PhoneApiCaller to fetch and inject reCAPTCHA v2 token.
              return actionMethod(authInstance, requestWithRecaptchaFields);
            }
          }
          // ENFORCE mode or AUDIT mode with any other error.
          return Promise.reject(error);
        }
      );
    } else {
      // Do reCAPTCHA v2 flow.
      const requestWithRecaptchaFields = await injectRecaptchaFields(
        authInstance,
        request,
        actionName,
        false, // isCaptchaResp
        true // isFakeToken
      );

      // This will call the PhoneApiCaller to fetch and inject v2 token.
      return actionMethod(authInstance, requestWithRecaptchaFields);
    }
  } else {
    return Promise.reject(
      recaptchaAuthProvider + ' provider is not supported.'
    );
  }
}

export async function _initializeRecaptchaConfig(auth: Auth): Promise<void> {
  const authInternal = _castAuth(auth);

  const response = await getRecaptchaConfig(authInternal, {
    clientType: RecaptchaClientType.WEB,
    version: RecaptchaVersion.ENTERPRISE
  });

  const config = new RecaptchaConfig(response);
  if (authInternal.tenantId == null) {
    authInternal._agentRecaptchaConfig = config;
  } else {
    authInternal._tenantRecaptchaConfigs[authInternal.tenantId] = config;
  }

  if (config.isAnyProviderEnabled()) {
    const verifier = new RecaptchaEnterpriseVerifier(authInternal);
    // Fix Vitest error: "Error: No reCAPTCHA enterprise script loaded." - catch pre-warm verification failure
    void verifier.verify().catch(() => {});
  }
}
