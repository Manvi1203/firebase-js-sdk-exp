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

export type ScannerSource =
  'WIZ_SCA' | 'DEPENDABOT' | 'WIZ_SAST' | 'CODEQL' | 'WIZ_DATA' | 'OSV_SCANNER';

export type AlertCategory =
  'SCA_DEPENDENCY' | 'SAST_FIRST_PARTY' | 'SECRET_OR_TEST_DATA';

export type Stage1Disposition =
  | 'ROUTE_TO_STAGE2_DETERMINISTIC_SCA'
  | 'ROUTE_TO_STAGE3_CODING_AGENT_NODE_NATIVE'
  | 'ROUTE_TO_STAGE3_CODING_AGENT_SAST'
  | 'ROUTE_TO_STAGE3_TEST_FIXTURE_SANITIZE'
  | 'ROUTE_TO_PATCH_PACKAGE_OR_DEP_REPLACE'
  | 'AUTO_SUPPRESS_NON_PROD_NOISE'
  | 'ESCALATE_TO_HUMAN_REPORT';

export interface RawVulnerabilityAlert {
  id: string;
  source: ScannerSource;
  category: AlertCategory;
  cveOrRuleId: string;
  packageOrFilePath: string;
  lockfileContext?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  fixedVersionsByMajor?: Record<number, string>;
  description: string;
}

export interface LockfileContext {
  relativePath: string;
  directory: string;
  ignoredByRenovate: boolean;
}

export interface TriagedAlert extends RawVulnerabilityAlert {
  mergedSources: ScannerSource[];
  disposition: Stage1Disposition;
  policyRuleId: string;
  rationale: string;
}

export interface SemverStreamResolution {
  majorStream: number;
  resolvedVersionsInLockfile: string[];
  parentSpecifiers: string[];
  targetFixedVersion?: string;
  canRelockInPlace: boolean;
  strategy: 'IN_PLACE_RELOCK' | 'GRAPH_AWARE_PARENT_PEER_BUMP';
  explanation: string;
}

export interface Stage2ScaExecutionResult {
  alertId: string;
  cveOrRuleId: string;
  packageName: string;
  lockfileContext: string;
  coexistingMajorStreams: number[];
  streamResolutions: SemverStreamResolution[];
  yarnWhyRootParents: string[];
  deadDevToolingBlockingRemoval: string[];
  appliedLockfileEdit: boolean;
  finalStatus:
    'READY_FOR_PR' | 'REQUIRES_PATCH_PACKAGE_OR_REPLACE' | 'ESCALATED_TO_HUMAN';
  summaryNote: string;
}

export interface Stage3AgentExecutionResult {
  alertId: string;
  cveOrRuleId: string;
  targetPathOrPackage: string;
  disposition: Stage1Disposition;
  engineUsed: 'GEMINI_API_SANDBOX' | 'DETERMINISTIC_SECURITY_CODEMOD';
  attemptsUsed: number;
  maxRetries: number;
  publicApiUnchangedVerified: boolean;
  verificationGatePassed: boolean;
  modifiedFiles: string[];
  finalStatus: 'PATCHED_AND_VERIFIED' | 'CIRCUIT_BREAKER_ESCALATED_TO_HUMAN';
  diffPreview: string;
  escalationOrSuccessNote: string;
}
