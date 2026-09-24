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

import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';
import {
  resolveSafeRepoPath,
  runStage1TriageAndPolicy
} from './stage1-triage-and-policy';
import { runStage2ScaSolver } from './stage2-lockfile-solver';
import { renderBatchedDraftPrMarkdown } from './pr-and-changeset-reporter';
import { RawVulnerabilityAlert, Stage2ScaExecutionResult } from './types';

const repoRoot = path.resolve(__dirname, '../..');

/**
 * Representative sample alerts covering all 3 categories and PR post-mortem edge cases
 * when no external `--alerts <file.json>` is passed.
 */
const DEFAULT_SAMPLE_ALERTS: RawVulnerabilityAlert[] = [
  {
    id: 'WIZ-SCA-101',
    source: 'WIZ_SCA',
    category: 'SCA_DEPENDENCY',
    cveOrRuleId: 'CVE-2022-3517',
    packageOrFilePath: 'minimatch',
    lockfileContext: 'yarn.lock',
    severity: 'HIGH',
    fixedVersionsByMajor: { 3: '3.1.2', 5: '5.1.6', 9: '9.0.5' },
    description: 'ReDoS vulnerability across multiple coexisting SemVer streams'
  },
  {
    id: 'DEPBOT-101',
    source: 'DEPENDABOT',
    category: 'SCA_DEPENDENCY',
    cveOrRuleId: 'CVE-2022-3517',
    packageOrFilePath: 'minimatch',
    lockfileContext: 'yarn.lock',
    severity: 'HIGH',
    fixedVersionsByMajor: { 3: '3.1.2', 5: '5.1.6', 9: '9.0.5' },
    description: 'Overlapping Dependabot alert for minimatch'
  },
  {
    id: 'WIZ-SCA-102',
    source: 'WIZ_SCA',
    category: 'SCA_DEPENDENCY',
    cveOrRuleId: 'GHSA-karma-webpack-501',
    packageOrFilePath: 'karma-webpack',
    lockfileContext: 'yarn.lock',
    severity: 'MEDIUM',
    description: 'Transitive vulnerability in karma-webpack'
  },
  {
    id: 'WIZ-SCA-103',
    source: 'WIZ_SCA',
    category: 'SCA_DEPENDENCY',
    cveOrRuleId: 'GHSA-ts-compiler',
    packageOrFilePath: 'typescript',
    lockfileContext: 'yarn.lock',
    severity: 'LOW',
    description: 'Advisory requiring TypeScript compiler minor bump'
  },
  {
    id: 'WIZ-SCA-104',
    source: 'WIZ_SCA',
    category: 'SCA_DEPENDENCY',
    cveOrRuleId: 'CVE-2023-28155',
    packageOrFilePath: 'request',
    lockfileContext: 'yarn.lock',
    severity: 'MEDIUM',
    description: 'SSRF bypass in deprecated request package'
  },
  {
    id: 'WIZ-SAST-201',
    source: 'WIZ_SAST',
    category: 'SAST_FIRST_PARTY',
    cveOrRuleId: 'js/prototype-pollution',
    packageOrFilePath: 'packages/util/src/deepCopy.ts',
    severity: 'HIGH',
    description: 'Prototype pollution sink in deepCopy utility'
  },
  {
    id: 'WIZ-SAST-202',
    source: 'WIZ_SAST',
    category: 'SAST_FIRST_PARTY',
    cveOrRuleId: 'js/console-log-error',
    packageOrFilePath: 'scripts/release/cli.ts',
    severity: 'LOW',
    description: 'Caught error logged to console in CI release script'
  },
  {
    id: 'WIZ-DATA-301',
    source: 'WIZ_DATA',
    category: 'SECRET_OR_TEST_DATA',
    cveOrRuleId: 'secret/dummy-api-key',
    packageOrFilePath: 'packages/auth/test/helpers/api_key_fixture.test.ts',
    severity: 'MEDIUM',
    description: 'Hardcoded dummy API key in unit test file'
  }
];

function main(): void {
  const argv = yargs
    .option('alerts', {
      type: 'string',
      describe: 'Optional path to JSON file of raw alerts'
    })
    .option('apply', {
      type: 'boolean',
      default: false,
      describe: 'Apply surgical in-place lockfile relocks (default: dry-run)'
    })
    .option('output-pr-md', {
      type: 'string',
      describe: 'Optional path to write the generated Draft PR Markdown report'
    })
    .parseSync();

  let rawAlerts: RawVulnerabilityAlert[] = DEFAULT_SAMPLE_ALERTS;
  if (argv.alerts) {
    const safeAlertsPath = resolveSafeRepoPath(repoRoot, argv.alerts);
    rawAlerts = JSON.parse(fs.readFileSync(safeAlertsPath, 'utf8'));
  }

  // Run Stage 1: Environment Guard, 8-Lockfile Mapper, Deduplication & Policy Router
  const stage1 = runStage1TriageAndPolicy(repoRoot, rawAlerts);

  console.log('=== STAGE 1: ENVIRONMENT GUARD & POLICY TRIAGE ===');
  console.log(
    `Yarn Version: ${stage1.environment.yarnVersion} (Meets >= 1.22.22 guard: ${stage1.environment.yarnVersionValid})`
  );
  console.log(
    `Discovered Tracked Lockfiles (${stage1.environment.lockfiles.length}):`
  );
  for (const lf of stage1.environment.lockfiles) {
    console.log(
      `  - ${lf.relativePath}${
        lf.ignoredByRenovate ? ' [ignored by renovate.json]' : ''
      }`
    );
  }
  console.log(
    `\nAlert Deduplication: ${stage1.totalRawAlerts} raw -> ${stage1.totalDeduplicated} unique alerts`
  );
  console.log(
    'Routing Breakdown:',
    JSON.stringify(stage1.countsByDisposition, null, 2)
  );

  if (!stage1.environment.yarnVersionValid) {
    throw new Error(
      `Aborted: yarn version ${stage1.environment.yarnVersion} is < 1.22.22 (Ref PR #10358).`
    );
  }

  // Run Stage 2: Deterministic Lockfile & Graph Solver on routed SCA alerts
  console.log('\n=== STAGE 2: DETERMINISTIC LOCKFILE & SEMVER-STREAM SOLVER ===');
  const stage2Results: Stage2ScaExecutionResult[] = [];
  for (const alert of stage1.triagedAlerts) {
    if (alert.disposition === 'ROUTE_TO_STAGE2_DETERMINISTIC_SCA') {
      const res = runStage2ScaSolver(repoRoot, alert, {
        applyInPlaceRelock: argv.apply
      });
      stage2Results.push(res);
      console.log(
        `\n[Stage 2 Solver] ${res.packageName} (${res.cveOrRuleId}) in ${res.lockfileContext}:`
      );
      console.log(
        `  Coexisting Major Streams: [${res.coexistingMajorStreams
          .map(m => `${m}.x`)
          .join(', ')}]`
      );
      for (const sr of res.streamResolutions) {
        console.log(`  - ${sr.explanation}`);
      }
      if (res.deadDevToolingBlockingRemoval.length > 0) {
        console.log(
          `  - Dead Dev-Tooling Detected in yarn why: ${res.deadDevToolingBlockingRemoval.join(
            ', '
          )}`
        );
      }
    }
  }

  // Generate Batched Draft PR Markdown + Human Escalation Report
  const prMarkdown = renderBatchedDraftPrMarkdown(
    repoRoot,
    stage1.triagedAlerts,
    stage2Results
  );

  console.log('\n=== GENERATED BATCHED DRAFT PR & ESCALATION REPORT ===\n');
  console.log(prMarkdown);

  if (argv['output-pr-md']) {
    const outPath = resolveSafeRepoPath(repoRoot, argv['output-pr-md']);
    fs.writeFileSync(outPath, prMarkdown, 'utf8');
    console.log(`Wrote Draft PR Markdown report to: ${outPath}`);
  }
}

main();
