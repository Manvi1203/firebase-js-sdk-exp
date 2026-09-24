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
import * as semver from 'semver';
import {
  execSafeCommand,
  resolveSafeRepoPath
} from './stage1-triage-and-policy';
import {
  SemverStreamResolution,
  Stage2ScaExecutionResult,
  TriagedAlert
} from './types';

const DEAD_DEV_TOOLING_PACKAGES = [
  'coveralls',
  'selenium-assistant',
  'istanbul',
  'tslint'
];

interface YarnLockBlock {
  rawBlockText: string;
  headerLine: string;
  specifiers: string[];
  resolvedVersion: string;
}

/**
 * Stage 2 Deterministic Lockfile & Dependency Graph Solver:
 * - Parses target `yarn.lock` stanzas for `<packageName>`.
 * - Groups resolved blocks by SemVer Major Stream (e.g. 3.x, 5.x, 6.x, 9.x — Ref PR #10341)
 *   so legacy tools requiring 3.x are never flattened into 9.x.
 * - Uses `semver.satisfies(targetPatch, range)` to verify if all parents in that stream
 *   allow an In-Place Relock (`yarn.lock` only) vs. requiring a Graph-Aware Parent + Peer Bump.
 * - Runs `yarn why <packageName>` to detect dead dev-tooling transitive leaves (Ref PR #10174).
 */
export function runStage2ScaSolver(
  repoRoot: string,
  alert: TriagedAlert,
  options: { applyInPlaceRelock?: boolean } = {}
): Stage2ScaExecutionResult {
  const safeRoot = resolveSafeRepoPath(repoRoot, '.');
  const lockfileRel = alert.lockfileContext || 'yarn.lock';
  const lockfileAbs = resolveSafeRepoPath(safeRoot, lockfileRel);
  const packageName = alert.packageOrFilePath;

  if (!fs.existsSync(lockfileAbs)) {
    return {
      alertId: alert.id,
      cveOrRuleId: alert.cveOrRuleId,
      packageName,
      lockfileContext: lockfileRel,
      coexistingMajorStreams: [],
      streamResolutions: [],
      yarnWhyRootParents: [],
      deadDevToolingBlockingRemoval: [],
      appliedLockfileEdit: false,
      finalStatus: 'ESCALATED_TO_HUMAN',
      summaryNote: `Target lockfile "${lockfileRel}" not found.`
    };
  }

  const lockContent = fs.readFileSync(lockfileAbs, 'utf8');
  const blocks = extractPackageBlocksFromYarnLock(lockContent, packageName);

  // Group blocks by SemVer major stream
  const byMajor = new Map<
    number,
    { versions: Set<string>; specifiers: Set<string>; blocks: YarnLockBlock[] }
  >();

  for (const blk of blocks) {
    const parsedVer = semver.parse(blk.resolvedVersion);
    if (!parsedVer) continue;
    const major = parsedVer.major;
    let entry = byMajor.get(major);
    if (!entry) {
      entry = { versions: new Set(), specifiers: new Set(), blocks: [] };
      byMajor.set(major, entry);
    }
    entry.versions.add(blk.resolvedVersion);
    for (const spec of blk.specifiers) {
      entry.specifiers.add(spec);
    }
    entry.blocks.push(blk);
  }

  const coexistingMajorStreams = Array.from(byMajor.keys()).sort(
    (a, b) => a - b
  );
  const streamResolutions: SemverStreamResolution[] = [];

  for (const major of coexistingMajorStreams) {
    const bucket = byMajor.get(major)!;
    const specifiers = Array.from(bucket.specifiers);
    const resolvedVersions = Array.from(bucket.versions);
    const targetFixedVersion = alert.fixedVersionsByMajor?.[major];

    const maxAffectedMajor = alert.fixedVersionsByMajor
      ? Math.max(...Object.keys(alert.fixedVersionsByMajor).map(Number))
      : Infinity;
    const isUnaffectedHigherMajor = major > maxAffectedMajor;

    const allResolvedAlreadyPatched =
      isUnaffectedHigherMajor ||
      (Boolean(targetFixedVersion) &&
        resolvedVersions.every(v => semver.gte(v, targetFixedVersion!)));

    // Check if every specifier in this major stream intersects with >=targetFixedVersion <(major+1).0.0
    let canRelockInPlace = true;
    const blockingSpecifiers: string[] = [];
    const safeStreamRange = targetFixedVersion
      ? `>=${targetFixedVersion} <${major + 1}.0.0-0`
      : `>=${major}.0.0 <${major + 1}.0.0-0`;

    if (!allResolvedAlreadyPatched) {
      for (const spec of specifiers) {
        const rangePart = spec.slice(packageName.length + 1);
        if (targetFixedVersion) {
          if (!semver.intersects(rangePart, safeStreamRange)) {
            canRelockInPlace = false;
            blockingSpecifiers.push(spec);
          }
        } else if (/^\d+\.\d+\.\d+$/.test(rangePart)) {
          canRelockInPlace = false;
          blockingSpecifiers.push(spec);
        }
      }
    }

    const strategy = allResolvedAlreadyPatched
      ? 'IN_PLACE_RELOCK'
      : canRelockInPlace
      ? 'IN_PLACE_RELOCK'
      : 'GRAPH_AWARE_PARENT_PEER_BUMP';

    const explanation = isUnaffectedHigherMajor
      ? `Stream ${major}.x (resolved: ${resolvedVersions.join(
          ', '
        )}) is above the highest affected major stream (${maxAffectedMajor}.x). No change needed.`
      : allResolvedAlreadyPatched
      ? `Stream ${major}.x (resolved: ${resolvedVersions.join(
          ', '
        )}) is ALREADY >= ${targetFixedVersion}. No change needed for ${major}.x.`
      : canRelockInPlace
      ? `Stream ${major}.x (resolved: ${resolvedVersions.join(
          ', '
        )}) allows upgrading to >=${
          targetFixedVersion || 'latest patch'
        } within ${major}.x across all parent ranges (${specifiers.join(
          ', '
        )}). Safe for surgical in-place yarn.lock relock.`
      : `Stream ${major}.x has exact/restrictive parent pin(s) [${blockingSpecifiers.join(
          ', '
        )}] that block >=${
          targetFixedVersion || 'latest patch'
        }. Requires parent package.json + linked peer dependency co-bump (Ref PR #10361).`;

    streamResolutions.push({
      majorStream: major,
      resolvedVersionsInLockfile: resolvedVersions,
      parentSpecifiers: specifiers,
      targetFixedVersion,
      canRelockInPlace: allResolvedAlreadyPatched || canRelockInPlace,
      strategy,
      explanation
    });
  }

  // Audit `yarn why <packageName>` in the lockfile directory (Ref PR #10174)
  const lockfileDir = path.dirname(lockfileAbs);
  const whyRes = execSafeCommand(
    'yarn',
    ['why', packageName],
    lockfileDir,
    safeRoot
  );
  const whyCombined = `${whyRes.stdout}\n${whyRes.stderr}`;
  const yarnWhyRootParents = parseYarnWhyParents(whyCombined);
  const deadDevToolingBlockingRemoval = DEAD_DEV_TOOLING_PACKAGES.filter(dead =>
    whyCombined.toLowerCase().includes(dead.toLowerCase())
  );

  let appliedLockfileEdit = false;
  if (
    options.applyInPlaceRelock &&
    streamResolutions.some(s => s.canRelockInPlace && s.targetFixedVersion)
  ) {
    // Surgical lockfile stanza removal + `yarn install` to relock only the target stream
    let updatedLock = lockContent;
    for (const sr of streamResolutions) {
      if (sr.canRelockInPlace && sr.targetFixedVersion) {
        const bucket = byMajor.get(sr.majorStream)!;
        for (const blk of bucket.blocks) {
          if (semver.lt(blk.resolvedVersion, sr.targetFixedVersion)) {
            updatedLock = updatedLock.replace(blk.rawBlockText + '\n\n', '');
          }
        }
      }
    }
    if (updatedLock !== lockContent) {
      fs.writeFileSync(lockfileAbs, updatedLock, 'utf8');
      execSafeCommand(
        'yarn',
        ['install', '--non-interactive'],
        lockfileDir,
        safeRoot
      );
      appliedLockfileEdit = true;
    }
  }

  let finalStatus: Stage2ScaExecutionResult['finalStatus'] = 'READY_FOR_PR';
  let summaryNote = `Resolved across ${coexistingMajorStreams.length} SemVer stream(s) [${coexistingMajorStreams
    .map(m => `${m}.x`)
    .join(', ')}].`;

  if (
    streamResolutions.some(s => !s.canRelockInPlace) &&
    deadDevToolingBlockingRemoval.length > 0
  ) {
    finalStatus = 'REQUIRES_PATCH_PACKAGE_OR_REPLACE';
    summaryNote = `Parent range is locked by legacy/dead dev-tooling (${deadDevToolingBlockingRemoval.join(
      ', '
    )} — Ref PR #10174). Prioritize replacing dead dev-tooling (Note #7) or apply patch-package on leaf.`;
  }

  return {
    alertId: alert.id,
    cveOrRuleId: alert.cveOrRuleId,
    packageName,
    lockfileContext: lockfileRel,
    coexistingMajorStreams,
    streamResolutions,
    yarnWhyRootParents,
    deadDevToolingBlockingRemoval,
    appliedLockfileEdit,
    finalStatus,
    summaryNote
  };
}

function extractPackageBlocksFromYarnLock(
  lockContent: string,
  packageName: string
): YarnLockBlock[] {
  const blocks: YarnLockBlock[] = [];
  const rawParagraphs = lockContent.split(/\n\n+/);
  const escapedPkg = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const specRegex = new RegExp(`^"?${escapedPkg}@[^":\\n]+"?`);

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    const lines = trimmed.split('\n');
    if (lines.length < 2) continue;

    const headerLine = lines[0].replace(/:$/, '').trim();
    const rawSpecs = headerLine
      .split(',')
      .map(s => s.trim().replace(/^"|"$/g, ''));
    const matchingSpecs = rawSpecs.filter(s => specRegex.test(s));
    if (matchingSpecs.length === 0) continue;

    let resolvedVersion = '';
    for (const line of lines.slice(1)) {
      const m = line.match(/^\s*version\s+"([^"]+)"/);
      if (m) {
        resolvedVersion = m[1];
        break;
      }
    }
    if (resolvedVersion) {
      blocks.push({
        rawBlockText: trimmed,
        headerLine,
        specifiers: matchingSpecs,
        resolvedVersion
      });
    }
  }
  return blocks;
}

function parseYarnWhyParents(whyOutput: string): string[] {
  const parents = new Set<string>();
  for (const line of whyOutput.split('\n')) {
    const m = line.match(/"([^"]+)" depends on it/);
    if (m && m[1]) {
      parents.add(m[1]);
    } else if (line.includes('#')) {
      const hm = line.match(/"([^"]+)"/);
      if (hm && hm[1]) {
        parents.add(hm[1]);
      }
    }
  }
  return Array.from(parents).slice(0, 10);
}
