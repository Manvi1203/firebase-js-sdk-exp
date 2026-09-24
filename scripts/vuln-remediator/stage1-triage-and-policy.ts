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

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import {
  LockfileContext,
  RawVulnerabilityAlert,
  Stage1Disposition,
  TriagedAlert
} from './types';

const ALLOWED_BINARIES = new Set(['yarn', 'git', 'npx', 'node', 'osv-scanner']);

/**
 * Packages that must never be bumped autonomously (Ref PR #9575).
 */
const OFF_LIMITS_COMPILERS_AND_BUNDLERS = new Set([
  'typescript',
  'webpack',
  'rollup',
  '@microsoft/api-extractor'
]);

/**
 * Packages that should be deleted and replaced with native Node 20/24+ APIs
 * rather than migrated across breaking major versions (Ref PR #10175, Note #6).
 */
const NODE_NATIVE_REPLACEMENT_MAP: Record<string, string> = {
  request: 'Replace with native global fetch() in Node >= 20/24 (Ref PR #10175).',
  'node-fetch': 'Replace with native global fetch() in Node >= 20/24.',
  rimraf: 'Replace with native fs.rmSync(dir, { recursive: true, force: true }).',
  mkdirp: 'Replace with native fs.mkdirSync(dir, { recursive: true }).'
};

export interface Stage1EnvironmentSummary {
  yarnVersion: string;
  yarnVersionValid: boolean;
  lockfiles: LockfileContext[];
  renovateIgnoreDeps: string[];
  renovateIgnorePaths: string[];
}

export interface Stage1Output {
  environment: Stage1EnvironmentSummary;
  totalRawAlerts: number;
  totalDeduplicated: number;
  countsByDisposition: Record<Stage1Disposition, number>;
  triagedAlerts: TriagedAlert[];
}

/**
 * Strictly validates that targetPath stays inside repoRoot (prevents path traversal).
 */
export function resolveSafeRepoPath(repoRoot: string, targetPath: string): string {
  const canonicalRoot = path.resolve(repoRoot);
  const resolved = path.resolve(canonicalRoot, targetPath);
  if (
    resolved !== canonicalRoot &&
    !resolved.startsWith(canonicalRoot + path.sep)
  ) {
    throw new Error(
      `Path traversal blocked: "${targetPath}" resolves outside "${canonicalRoot}"`
    );
  }
  return resolved;
}

/**
 * Executes an allow-listed CLI binary safely using execFileSync (never shell interpolation).
 */
export function execSafeCommand(
  binary: string,
  args: string[],
  cwd: string,
  repoRoot: string
): { stdout: string; stderr: string; exitCode: number } {
  if (!ALLOWED_BINARIES.has(binary)) {
    throw new Error(`Binary "${binary}" is not in the security allow-list.`);
  }
  const safeCwd = resolveSafeRepoPath(repoRoot, cwd);
  try {
    const stdout = childProcess.execFileSync(binary, args, {
      cwd: safeCwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024
    });
    return { stdout: stdout.trim(), stderr: '', exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: typeof err.stdout === 'string' ? err.stdout.trim() : '',
      stderr:
        typeof err.stderr === 'string'
          ? err.stderr.trim()
          : String(err.message || err),
      exitCode: typeof err.status === 'number' ? err.status : 1
    };
  }
}

/**
 * Runs Stage 1:
 * 1. Verifies `yarn >= 1.22.22` (PR #10358).
 * 2. Discovers all 8 tracked `yarn.lock` contexts (PR #10341).
 * 3. Loads `renovate.json` (`ignoreDeps`, `ignorePaths`).
 * 4. Deduplicates and routes all raw alerts into Stage 2, Stage 3, Suppressed, or Human Escalation.
 */
export function runStage1TriageAndPolicy(
  repoRoot: string,
  rawAlerts: RawVulnerabilityAlert[]
): Stage1Output {
  const safeRoot = resolveSafeRepoPath(repoRoot, '.');

  // 1. Assert Yarn >= 1.22.22 (PR #10358 aliased-dependency corruption guard)
  const yarnRes = execSafeCommand('yarn', ['--version'], safeRoot, safeRoot);
  const yarnVersion = yarnRes.stdout || '0.0.0';
  const yarnVersionValid = Boolean(
    semver.valid(yarnVersion) && semver.gte(yarnVersion, '1.22.22')
  );

  // 2. Parse renovate.json
  const renovatePath = resolveSafeRepoPath(safeRoot, 'renovate.json');
  let renovateIgnoreDeps: string[] = [];
  let renovateIgnorePaths: string[] = [];
  if (fs.existsSync(renovatePath)) {
    const parsed = JSON.parse(fs.readFileSync(renovatePath, 'utf8'));
    if (Array.isArray(parsed.ignoreDeps)) {
      renovateIgnoreDeps = parsed.ignoreDeps;
    }
    if (Array.isArray(parsed.ignorePaths)) {
      renovateIgnorePaths = parsed.ignorePaths;
    }
  }
  const ignoreDepsSet = new Set(renovateIgnoreDeps);

  // 3. Discover all tracked yarn.lock files across the monorepo
  const gitLockRes = execSafeCommand(
    'git',
    ['ls-files', '*yarn.lock*'],
    safeRoot,
    safeRoot
  );
  const lockfiles: LockfileContext[] = gitLockRes.stdout
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .map(rel => ({
      relativePath: rel,
      directory: path.dirname(rel),
      ignoredByRenovate: renovateIgnorePaths.some(ignorePrefix =>
        rel.includes(ignorePrefix)
      )
    }));

  // 4. Deduplicate and classify alerts
  const dedupMap = new Map<string, TriagedAlert>();

  for (const raw of rawAlerts) {
    const normPath = raw.packageOrFilePath.replace(/\\/g, '/');
    const lockCtx = raw.lockfileContext || 'yarn.lock';
    const key = `${raw.category}::${raw.cveOrRuleId}::${normPath}::${lockCtx}`;

    const existing = dedupMap.get(key);
    if (existing) {
      if (!existing.mergedSources.includes(raw.source)) {
        existing.mergedSources.push(raw.source);
      }
      continue;
    }

    const decision = routeSingleAlert(raw, normPath, ignoreDepsSet);
    dedupMap.set(key, {
      ...raw,
      packageOrFilePath: normPath,
      lockfileContext: lockCtx,
      mergedSources: [raw.source],
      disposition: decision.disposition,
      policyRuleId: decision.policyRuleId,
      rationale: decision.rationale
    });
  }

  const triagedAlerts = Array.from(dedupMap.values());
  const countsByDisposition: Record<Stage1Disposition, number> = {
    ROUTE_TO_STAGE2_DETERMINISTIC_SCA: 0,
    ROUTE_TO_STAGE3_CODING_AGENT_NODE_NATIVE: 0,
    ROUTE_TO_STAGE3_CODING_AGENT_SAST: 0,
    ROUTE_TO_STAGE3_TEST_FIXTURE_SANITIZE: 0,
    ROUTE_TO_PATCH_PACKAGE_OR_DEP_REPLACE: 0,
    AUTO_SUPPRESS_NON_PROD_NOISE: 0,
    ESCALATE_TO_HUMAN_REPORT: 0
  };

  for (const item of triagedAlerts) {
    countsByDisposition[item.disposition]++;
  }

  return {
    environment: {
      yarnVersion,
      yarnVersionValid,
      lockfiles,
      renovateIgnoreDeps,
      renovateIgnorePaths
    },
    totalRawAlerts: rawAlerts.length,
    totalDeduplicated: triagedAlerts.length,
    countsByDisposition,
    triagedAlerts
  };
}

function routeSingleAlert(
  alert: RawVulnerabilityAlert,
  normPath: string,
  ignoreDepsSet: Set<string>
): {
  disposition: Stage1Disposition;
  policyRuleId: string;
  rationale: string;
} {
  // Category 1: Third-Party Dependencies (SCA)
  if (alert.category === 'SCA_DEPENDENCY') {
    const pkg = normPath;

    if (OFF_LIMITS_COMPILERS_AND_BUNDLERS.has(pkg)) {
      return {
        disposition: 'ESCALATE_TO_HUMAN_REPORT',
        policyRuleId: 'PR_9575_OFF_LIMITS_COMPILER_BUNDLER',
        rationale: `"${pkg}" is marked Off-Limits (non-SemVer compiler/bundler checks break monorepo builds). Escalated to Human Report (Note #3).`
      };
    }

    if (ignoreDepsSet.has(pkg)) {
      return {
        disposition: 'ROUTE_TO_PATCH_PACKAGE_OR_DEP_REPLACE',
        policyRuleId: 'PR_8725_RENOVATE_PINNED_REGRESSION',
        rationale: `"${pkg}" is pinned in renovate.json ignoreDeps (e.g. 5.0.1 build regression). Bypass parent bump and route to patch-package or deprecation task (Note #7).`
      };
    }

    if (pkg.includes('api-extractor-me') || pkg.includes('github:')) {
      return {
        disposition: 'ESCALATE_TO_HUMAN_REPORT',
        policyRuleId: 'PR_10233_UNMAINTAINED_PERSONAL_FORK',
        rationale: `"${pkg}" is an unmaintained/personal fork that cannot receive SemVer updates. Must be brought in-tree or un-forked to official upstream.`
      };
    }

    if (NODE_NATIVE_REPLACEMENT_MAP[pkg]) {
      return {
        disposition: 'ROUTE_TO_STAGE3_CODING_AGENT_NODE_NATIVE',
        policyRuleId: 'PR_10175_NODE_20_NATIVE_REPLACEMENT',
        rationale: NODE_NATIVE_REPLACEMENT_MAP[pkg]
      };
    }

    return {
      disposition: 'ROUTE_TO_STAGE2_DETERMINISTIC_SCA',
      policyRuleId: 'PR_10341_SEMVER_STREAM_OR_GRAPH_SOLVER',
      rationale:
        'Eligible for Stage 2 deterministic SemVer-stream lockfile relock or graph-aware parent+peer bump.'
    };
  }

  // Category 2: First-Party Code Flaws (SAST) — Apply Note #5 path/rule filter
  if (alert.category === 'SAST_FIRST_PARTY') {
    const isProdSdkSource = /^packages\/[^/]+\/src\//.test(normPath);
    const isCiOrBuildScript =
      normPath.startsWith('scripts/') ||
      normPath.startsWith('repo-scripts/') ||
      normPath.startsWith('tools/');
    const isTestOrDemo =
      normPath.endsWith('.test.ts') ||
      normPath.endsWith('.test.js') ||
      normPath.includes('/test/') ||
      normPath.includes('/demo/');

    if (isProdSdkSource) {
      return {
        disposition: 'ROUTE_TO_STAGE3_CODING_AGENT_SAST',
        policyRuleId: 'NOTE_5_PROD_SDK_SAST',
        rationale:
          'First-party production SDK code in packages/*/src/**; route to Coding Agent with API-Extractor signature guard.'
      };
    }

    if (isCiOrBuildScript || isTestOrDemo) {
      return {
        disposition: 'AUTO_SUPPRESS_NON_PROD_NOISE',
        policyRuleId: 'NOTE_5_NON_PROD_SCRIPT_FILTER',
        rationale:
          'Alert occurs in CI/build script or test harness (not shipped in browser SDK bundles; e.g. caught error logged to console or trusted config input).'
      };
    }
  }

  // Category 3: Secrets / Sensitive Data
  if (alert.category === 'SECRET_OR_TEST_DATA') {
    const isTestOrDemo =
      normPath.endsWith('.test.ts') ||
      normPath.endsWith('.test.js') ||
      normPath.includes('/test/') ||
      normPath.includes('/demo/');

    if (isTestOrDemo) {
      return {
        disposition: 'ROUTE_TO_STAGE3_TEST_FIXTURE_SANITIZE',
        policyRuleId: 'NOTE_5_TEST_DUMMY_CREDENTIAL',
        rationale:
          'Dummy key in test/demo file; replace with dynamic fixture generator (test-api-key-*) or .wizignore suppression.'
      };
    }

    return {
      disposition: 'ESCALATE_TO_HUMAN_REPORT',
      policyRuleId: 'PROD_SECRET_ROTATION_REQUIRED',
      rationale:
        'Potential secret detected outside test/demo files; escalate immediately for human credential rotation.'
    };
  }

  return {
    disposition: 'ESCALATE_TO_HUMAN_REPORT',
    policyRuleId: 'DEFAULT_HUMAN_TRIAGE',
    rationale: 'Unclassified alert routed to human review.'
  };
}
