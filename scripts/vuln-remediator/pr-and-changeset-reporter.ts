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

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { resolveSafeRepoPath } from './stage1-triage-and-policy';
import { Stage2ScaExecutionResult, TriagedAlert } from './types';

export type ChangesetTier =
  | 'TIER_1_RUNTIME_DEP'
  | 'TIER_2_BUILD_PIPELINE'
  | 'TIER_3_TEST_OR_LINT'
  | 'TIER_4_ORCHESTRATION_DIST_DIFF';

export interface ChangesetEvaluation {
  dependencyName: string;
  tier: ChangesetTier;
  requiresChangeset: boolean;
  rationale: string;
}

const BUILD_PIPELINE_PATTERNS = [
  /^rollup/,
  /^@rollup\//,
  /^@babel\//,
  /^babel-/,
  /^terser$/,
  /^tslib$/,
  /^webpack/,
  /^ts-loader$/
];

const TEST_OR_LINT_PATTERNS = [
  /^karma/,
  /^vitest$/,
  /^@vitest\//,
  /^playwright$/,
  /^mocha$/,
  /^chai/,
  /^sinon/,
  /^eslint/,
  /^@typescript-eslint\//,
  /^tslint$/,
  /^nyc$/,
  /^prettier$/
];

/**
 * Evaluates the 4-tier Changeset Decision Matrix (Ref PR #9883, Footnote [^1]):
 * 1. Direct Runtime Dependency -> ALWAYS generate changeset.
 * 2. Build Pipeline Tool (rollup, babel) -> ALWAYS generate changeset (alters dist/).
 * 3. Test Runner / Linter (karma, vitest, eslint) -> NO changeset.
 * 4. Monorepo Orchestration (lerna, nx) -> Check if dist/ SHA-256 checksum changed.
 */
export function evaluateChangesetRequirement(
  repoRoot: string,
  dependencyName: string,
  distChecksumChanged: boolean = false
): ChangesetEvaluation {
  const safeRoot = resolveSafeRepoPath(repoRoot, '.');
  const runtimeConsumers = findPublishedPackagesUsingRuntimeDep(
    safeRoot,
    dependencyName
  );

  if (runtimeConsumers.length > 0) {
    return {
      dependencyName,
      tier: 'TIER_1_RUNTIME_DEP',
      requiresChangeset: true,
      rationale: `Direct runtime dependency in ${runtimeConsumers.join(
        ', '
      )} (Tier 1, Note #1).`
    };
  }

  if (BUILD_PIPELINE_PATTERNS.some(rx => rx.test(dependencyName))) {
    return {
      dependencyName,
      tier: 'TIER_2_BUILD_PIPELINE',
      requiresChangeset: true,
      rationale:
        'Build pipeline tool affecting compiled output in dist/ (Tier 2, Note #1).'
    };
  }

  if (TEST_OR_LINT_PATTERNS.some(rx => rx.test(dependencyName))) {
    return {
      dependencyName,
      tier: 'TIER_3_TEST_OR_LINT',
      requiresChangeset: false,
      rationale:
        'Test runner or linter only; does not alter published dist/ bundles (Tier 3, Note #1).'
    };
  }

  return {
    dependencyName,
    tier: 'TIER_4_ORCHESTRATION_DIST_DIFF',
    requiresChangeset: distChecksumChanged,
    rationale: distChecksumChanged
      ? 'Monorepo orchestration/dev tool where dist/ checksum changed after build (Tier 4, Note #1).'
      : 'Monorepo orchestration/dev tool where dist/ checksum is unchanged (Tier 4, Note #1).'
  };
}

/**
 * Computes a deterministic SHA-256 checksum of a package's dist/ directory for Tier 4 verification.
 */
export function hashPackageDistDir(
  repoRoot: string,
  packageDirRel: string
): string {
  const distDir = resolveSafeRepoPath(
    repoRoot,
    path.join(packageDirRel, 'dist')
  );
  if (!fs.existsSync(distDir)) {
    return 'NO_DIST';
  }
  const hash = crypto.createHash('sha256');
  function walk(dir: string): void {
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        hash.update(path.relative(distDir, full));
        hash.update(fs.readFileSync(full));
      }
    }
  }
  walk(distDir);
  return hash.digest('hex');
}

/**
 * Renders the Batched Draft PR Body Markdown including:
 * 1. Automated Fixes Table (Stage 2 SCA + Stage 3 Agent Fixes)
 * 2. Human Escalation Report Table (Off-Limits, Pinned Regressions, Stuck Upgrades — Note #3)
 * 3. Auto-Suppressed Non-Prod Script Noise Summary (Note #5)
 */
export function renderBatchedDraftPrMarkdown(
  repoRoot: string,
  triagedAlerts: TriagedAlert[],
  stage2Results: Stage2ScaExecutionResult[]
): string {
  const stage2Map = new Map<string, Stage2ScaExecutionResult>();
  for (const r of stage2Results) {
    stage2Map.set(r.alertId, r);
  }

  const lines: string[] = [
    '## Automated Security Vulnerability Remediation (Batched Draft PR)',
    '',
    '### 1. Deterministically Resolved & Queued Fixes',
    '',
    '| CVE / Rule ID | Target Package / Path | Lockfile Context | Resolution Strategy | SemVer Streams / Detail | Changeset Needed? |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |'
  ];

  for (const alert of triagedAlerts) {
    if (alert.disposition === 'ROUTE_TO_STAGE2_DETERMINISTIC_SCA') {
      const s2 = stage2Map.get(alert.id);
      const cs = evaluateChangesetRequirement(
        repoRoot,
        alert.packageOrFilePath
      );
      const strategies =
        s2?.streamResolutions.map(sr => sr.strategy).join(', ') ||
        'IN_PLACE_RELOCK';
      const streamDetail = s2
        ? `Streams: [${s2.coexistingMajorStreams
            .map(m => `${m}.x`)
            .join(', ')}] — ${s2.summaryNote}`
        : alert.rationale;
      lines.push(
        `| \`${alert.cveOrRuleId}\` | \`${alert.packageOrFilePath}\` | \`${
          alert.lockfileContext
        }\` | \`${strategies}\` | ${streamDetail} | **${
          cs.requiresChangeset ? 'Yes' : 'No'
        }** (${cs.tier}) |`
      );
    } else if (
      alert.disposition === 'ROUTE_TO_STAGE3_CODING_AGENT_NODE_NATIVE' ||
      alert.disposition === 'ROUTE_TO_STAGE3_CODING_AGENT_SAST' ||
      alert.disposition === 'ROUTE_TO_STAGE3_TEST_FIXTURE_SANITIZE'
    ) {
      lines.push(
        `| \`${alert.cveOrRuleId}\` | \`${alert.packageOrFilePath}\` | \`${alert.lockfileContext}\` | \`${alert.disposition}\` | ${alert.rationale} | Evaluated post-build |`
      );
    }
  }

  const escalated = triagedAlerts.filter(
    a =>
      a.disposition === 'ESCALATE_TO_HUMAN_REPORT' ||
      a.disposition === 'ROUTE_TO_PATCH_PACKAGE_OR_DEP_REPLACE'
  );

  if (escalated.length > 0) {
    lines.push(
      '',
      '### 2. Human Escalation Report (Requires Manual Engineering Triage — Footnote #3)',
      '',
      '| CVE / Rule ID | Package / Path | Policy Rule Triggered | Why Autonomous Bump Was Blocked | Recommended Maintainer Action |',
      '| :--- | :--- | :--- | :--- | :--- |'
    );
    for (const e of escalated) {
      lines.push(
        `| \`${e.cveOrRuleId}\` | \`${e.packageOrFilePath}\` | \`${e.policyRuleId}\` | ${e.rationale} | Handle in dedicated migration PR or apply \`patch-package\` |`
      );
    }
  }

  const suppressed = triagedAlerts.filter(
    a => a.disposition === 'AUTO_SUPPRESS_NON_PROD_NOISE'
  );
  if (suppressed.length > 0) {
    lines.push(
      '',
      '### 3. Auto-Suppressed Non-Production CI/Script Alerts (Footnote #5)',
      '',
      '| CVE / Rule ID | File Path | Suppression Rationale |',
      '| :--- | :--- | :--- |'
    );
    for (const s of suppressed) {
      lines.push(
        `| \`${s.cveOrRuleId}\` | \`${s.packageOrFilePath}\` | ${s.rationale} |`
      );
    }
  }

  return lines.join('\n') + '\n';
}

function findPublishedPackagesUsingRuntimeDep(
  safeRoot: string,
  depName: string
): string[] {
  const pkgsDir = resolveSafeRepoPath(safeRoot, 'packages');
  if (!fs.existsSync(pkgsDir)) return [];
  const consumers: string[] = [];

  for (const entry of fs.readdirSync(pkgsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgJsonPath = path.join(pkgsDir, entry.name, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;
    try {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (
        !pkgJson.private &&
        pkgJson.dependencies &&
        pkgJson.dependencies[depName]
      ) {
        consumers.push(pkgJson.name || entry.name);
      }
    } catch {
      // Ignore malformed package.json
    }
  }
  return consumers;
}
