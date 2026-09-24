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
import * as semver from 'semver';
import {
  execSafeCommand,
  resolveSafeRepoPath
} from './stage1-triage-and-policy';
import { RawVulnerabilityAlert } from './types';

export interface LiveFetchSummary {
  dependabotAlertsFetched: number;
  codeqlAlertsFetched: number;
  osvLockfileAlertsFetched: number;
  lockfilesScanned: string[];
  warnings: string[];
  alerts: RawVulnerabilityAlert[];
}

interface ParsedLockEntry {
  packageName: string;
  version: string;
  lockfileRel: string;
}

/**
 * Fetches live alerts across:
 * 1. GitHub Dependabot API (`gh api repos/<repo>/dependabot/alerts`)
 * 2. GitHub CodeQL API (`gh api repos/<repo>/code-scanning/alerts`)
 * 3. Google OSV.dev Batch API (`https://api.osv.dev/v1/querybatch`) across all 8 tracked `yarn.lock` files.
 */
export async function fetchLiveSecurityAlerts(
  repoRoot: string,
  githubRepoSlug: string = 'Manvi1203/firebase-js-sdk-exp',
  maxPackagesPerLockfile: number = 250
): Promise<LiveFetchSummary> {
  const safeRoot = resolveSafeRepoPath(repoRoot, '.');
  const warnings: string[] = [];
  const alerts: RawVulnerabilityAlert[] = [];

  // 1. Try GitHub Dependabot API via `gh api`
  let dependabotAlertsFetched = 0;
  const depBotRes = tryGhApi(
    `repos/${githubRepoSlug}/dependabot/alerts?state=open&per_page=50`,
    safeRoot
  );
  if (depBotRes.ok && Array.isArray(depBotRes.data)) {
    for (const item of depBotRes.data) {
      const pkgName = item?.dependency?.package?.name;
      const cveId =
        item?.security_advisory?.cve_id ||
        item?.security_advisory?.ghsa_id ||
        `DEPBOT-${item?.number}`;
      const lockCtx = item?.dependency?.manifest_path || 'yarn.lock';
      const rawSev = String(
        item?.security_vulnerability?.severity || 'medium'
      ).toUpperCase();
      if (pkgName) {
        alerts.push({
          id: `DEPBOT-${item.number}`,
          source: 'DEPENDABOT',
          category: 'SCA_DEPENDENCY',
          cveOrRuleId: cveId,
          packageOrFilePath: pkgName,
          lockfileContext: lockCtx,
          severity: normalizeSeverity(rawSev),
          description: item?.security_advisory?.summary || 'Dependabot alert'
        });
        dependabotAlertsFetched++;
      }
    }
  } else if (depBotRes.error) {
    warnings.push(
      `GitHub Dependabot API (${githubRepoSlug}): ${depBotRes.error}`
    );
  }

  // 2. Try GitHub CodeQL / Code-Scanning API via `gh api`
  let codeqlAlertsFetched = 0;
  const codeqlRes = tryGhApi(
    `repos/${githubRepoSlug}/code-scanning/alerts?state=open&per_page=50`,
    safeRoot
  );
  if (codeqlRes.ok && Array.isArray(codeqlRes.data)) {
    for (const item of codeqlRes.data) {
      const filePath =
        item?.most_recent_instance?.location?.path || 'unknown-file';
      const ruleId = item?.rule?.id || `CODEQL-${item?.number}`;
      const rawSev = String(
        item?.rule?.security_severity_level || item?.rule?.severity || 'medium'
      ).toUpperCase();
      alerts.push({
        id: `CODEQL-${item.number}`,
        source: 'CODEQL',
        category: 'SAST_FIRST_PARTY',
        cveOrRuleId: ruleId,
        packageOrFilePath: filePath,
        severity: normalizeSeverity(rawSev),
        description:
          item?.most_recent_instance?.message?.text ||
          item?.rule?.description ||
          'CodeQL SAST alert'
      });
      codeqlAlertsFetched++;
    }
  } else if (codeqlRes.error) {
    warnings.push(`GitHub CodeQL API (${githubRepoSlug}): ${codeqlRes.error}`);
  }

  // 3. Scan all 8 tracked `yarn.lock` files live via OSV.dev Batch API
  const gitLockRes = execSafeCommand(
    'git',
    ['ls-files', '*yarn.lock*'],
    safeRoot,
    safeRoot
  );
  const lockfilesScanned = gitLockRes.stdout
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const entriesToQuery: ParsedLockEntry[] = [];
  for (const lockRel of lockfilesScanned) {
    const lockAbs = resolveSafeRepoPath(safeRoot, lockRel);
    if (!fs.existsSync(lockAbs)) continue;
    const content = fs.readFileSync(lockAbs, 'utf8');
    const parsed = extractUniqueLockPackages(
      content,
      lockRel,
      maxPackagesPerLockfile
    );
    entriesToQuery.push(...parsed);
  }

  let osvLockfileAlertsFetched = 0;
  const batchSize = 500;
  const vulnDetailsCache = new Map<string, any>();

  for (let i = 0; i < entriesToQuery.length; i += batchSize) {
    const chunk = entriesToQuery.slice(i, i + batchSize);
    const payload = {
      queries: chunk.map(c => ({
        package: { name: c.packageName, ecosystem: 'npm' },
        version: c.version
      }))
    };

    try {
      const resp = await fetch('https://api.osv.dev/v1/querybatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        warnings.push(`OSV.dev querybatch returned HTTP ${resp.status}`);
        continue;
      }
      const data = (await resp.json()) as {
        results?: Array<{ vulns?: Array<{ id: string }> }>;
      };
      const results = data.results || [];

      for (let idx = 0; idx < results.length; idx++) {
        const vulns = results[idx]?.vulns || [];
        if (vulns.length === 0) continue;
        const entry = chunk[idx];
        // Take primary advisory ID for this package+lockfile
        const topVulnId = vulns[0].id;

        let detail = vulnDetailsCache.get(topVulnId);
        if (!detail && vulnDetailsCache.size < 40) {
          detail = await fetchOsvVulnDetail(topVulnId);
          if (detail) {
            vulnDetailsCache.set(topVulnId, detail);
          }
        }

        const fixedByMajor = extractFixedVersionsByMajor(
          detail,
          entry.packageName
        );
        const summary =
          detail?.summary ||
          detail?.details?.slice(0, 100) ||
          `OSV vulnerability in ${entry.packageName}@${entry.version}`;

        alerts.push({
          id: `OSV-${topVulnId}-${entry.lockfileRel}-${entry.packageName}`,
          source: 'OSV_SCANNER',
          category: 'SCA_DEPENDENCY',
          cveOrRuleId: topVulnId,
          packageOrFilePath: entry.packageName,
          lockfileContext: entry.lockfileRel,
          severity: extractOsvSeverity(detail),
          fixedVersionsByMajor: fixedByMajor,
          description: summary
        });
        osvLockfileAlertsFetched++;
      }
    } catch (err: any) {
      warnings.push(`OSV.dev live query error: ${String(err.message || err)}`);
    }
  }

  return {
    dependabotAlertsFetched,
    codeqlAlertsFetched,
    osvLockfileAlertsFetched,
    lockfilesScanned,
    warnings,
    alerts
  };
}

function tryGhApi(
  endpoint: string,
  cwd: string
): { ok: boolean; data?: any; error?: string } {
  try {
    const out = childProcess.execFileSync('gh', ['api', endpoint], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 5 * 1024 * 1024
    });
    return { ok: true, data: JSON.parse(out) };
  } catch (err: any) {
    const msg =
      typeof err.stderr === 'string' && err.stderr.trim()
        ? err.stderr.trim().split('\n')[0]
        : String(err.message || err);
    return { ok: false, error: msg };
  }
}

function extractUniqueLockPackages(
  lockContent: string,
  lockfileRel: string,
  limit: number
): ParsedLockEntry[] {
  const seen = new Set<string>();
  const list: ParsedLockEntry[] = [];
  const paragraphs = lockContent.split(/\n\n+/);

  for (const para of paragraphs) {
    if (list.length >= limit) break;
    const lines = para.trim().split('\n');
    if (lines.length < 2) continue;
    const firstSpec = lines[0]
      .replace(/:$/, '')
      .split(',')[0]
      .trim()
      .replace(/^"|"$/g, '');
    const atIdx = firstSpec.lastIndexOf('@');
    if (atIdx <= 0) continue;
    const pkgName = firstSpec.slice(0, atIdx);
    if (pkgName.startsWith('@firebase/')) continue;

    let resolvedVersion = '';
    for (const line of lines.slice(1)) {
      const m = line.match(/^\s*version\s+"([^"]+)"/);
      if (m) {
        resolvedVersion = m[1];
        break;
      }
    }
    if (!resolvedVersion) continue;
    const key = `${pkgName}@${resolvedVersion}`;
    if (!seen.has(key)) {
      seen.add(key);
      list.push({ packageName: pkgName, version: resolvedVersion, lockfileRel });
    }
  }
  return list;
}

async function fetchOsvVulnDetail(vulnId: string): Promise<any | null> {
  try {
    const res = await fetch(
      `https://api.osv.dev/v1/vulns/${encodeURIComponent(vulnId)}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function extractFixedVersionsByMajor(
  detail: any,
  packageName: string
): Record<number, string> | undefined {
  if (!detail || !Array.isArray(detail.affected)) return undefined;
  const fixedMap: Record<number, string> = {};
  for (const aff of detail.affected) {
    if (aff?.package?.name && aff.package.name !== packageName) continue;
    for (const rng of aff.ranges || []) {
      for (const ev of rng.events || []) {
        if (ev.fixed) {
          const parsed = semver.parse(ev.fixed);
          if (parsed) {
            fixedMap[parsed.major] = ev.fixed;
          }
        }
      }
    }
  }
  return Object.keys(fixedMap).length > 0 ? fixedMap : undefined;
}

function extractOsvSeverity(
  detail: any
): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const dbSev = String(detail?.database_specific?.severity || '').toUpperCase();
  if (
    dbSev === 'CRITICAL' ||
    dbSev === 'HIGH' ||
    dbSev === 'MEDIUM' ||
    dbSev === 'LOW'
  ) {
    return dbSev;
  }
  return 'MEDIUM';
}

function normalizeSeverity(
  raw: string
): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (raw.includes('CRIT')) return 'CRITICAL';
  if (raw.includes('HIGH')) return 'HIGH';
  if (raw.includes('LOW')) return 'LOW';
  return 'MEDIUM';
}
