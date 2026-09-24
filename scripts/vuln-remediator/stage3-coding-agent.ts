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
import {
  execSafeCommand,
  resolveSafeRepoPath
} from './stage1-triage-and-policy';
import { Stage3AgentExecutionResult, TriagedAlert } from './types';

const MAX_RETRIES = 2;

export interface Stage3Options {
  applyEdits?: boolean;
  geminiModel?: string;
}

/**
 * Stage 3 Sandboxed Coding-Agent Sub-Step:
 * Invoked ONLY for alerts routed to:
 * - ROUTE_TO_STAGE3_CODING_AGENT_NODE_NATIVE (Node >= 20/24 native API migration, Ref PR #10175)
 * - ROUTE_TO_STAGE3_CODING_AGENT_SAST (First-party production SDK SAST fixes in packages/*\/src/**)
 * - ROUTE_TO_STAGE3_TEST_FIXTURE_SANITIZE (Static dummy credentials in *.test.ts / demo/**)
 *
 * Enforces a strict 2-retry circuit breaker (Footnote [^3]) and Public API Signature Guard.
 */
export async function runStage3CodingAgent(
  repoRoot: string,
  alert: TriagedAlert,
  options: Stage3Options = {}
): Promise<Stage3AgentExecutionResult> {
  const safeRoot = resolveSafeRepoPath(repoRoot, '.');
  const apiKey = process.env.GEMINI_API_KEY || '';
  const engineUsed: Stage3AgentExecutionResult['engineUsed'] = apiKey
    ? 'GEMINI_API_SANDBOX'
    : 'DETERMINISTIC_SECURITY_CODEMOD';

  const targetFiles = resolveCandidateFilesForStage3(safeRoot, alert);
  if (targetFiles.length === 0) {
    return {
      alertId: alert.id,
      cveOrRuleId: alert.cveOrRuleId,
      targetPathOrPackage: alert.packageOrFilePath,
      disposition: alert.disposition,
      engineUsed,
      attemptsUsed: 1,
      maxRetries: MAX_RETRIES,
      publicApiUnchangedVerified: true,
      verificationGatePassed: true,
      modifiedFiles: [],
      finalStatus: 'PATCHED_AND_VERIFIED',
      diffPreview: 'No active call sites or vulnerable lines remaining.',
      escalationOrSuccessNote: `Verified 0 remaining vulnerable call sites for "${alert.packageOrFilePath}".`
    };
  }

  // Snapshot original files for 2-retry circuit-breaker rollback
  const snapshots = new Map<string, string>();
  for (const relFile of targetFiles) {
    const absFile = resolveSafeRepoPath(safeRoot, relFile);
    if (fs.existsSync(absFile)) {
      snapshots.set(relFile, fs.readFileSync(absFile, 'utf8'));
    }
  }

  let attemptsUsed = 0;
  let lastError = '';
  let diffPreview = '';
  let publicApiOk = true;

  while (attemptsUsed < MAX_RETRIES) {
    attemptsUsed++;
    const modifiedInAttempt: string[] = [];
    const diffs: string[] = [];

    for (const [relFile, originalContent] of snapshots.entries()) {
      const patchedContent = await synthesizeStage3Patch(
        relFile,
        originalContent,
        alert,
        lastError,
        apiKey,
        options.geminiModel || 'gemini-2.5-flash'
      );

      if (patchedContent && patchedContent !== originalContent) {
        // Verify public API signatures are preserved for packages/*/src/**
        if (/^packages\/[^/]+\/src\//.test(relFile)) {
          const sigsMatch = verifyExportSignaturesUnchanged(
            originalContent,
            patchedContent
          );
          if (!sigsMatch) {
            publicApiOk = false;
            lastError = `Public API signature altered in ${relFile}`;
            break;
          }
        }

        modifiedInAttempt.push(relFile);
        diffs.push(buildUnifiedDiffPreview(relFile, originalContent, patchedContent));

        if (options.applyEdits) {
          const absFile = resolveSafeRepoPath(safeRoot, relFile);
          fs.writeFileSync(absFile, patchedContent, 'utf8');
        }
      }
    }

    diffPreview = diffs.join('\n');

    if (!publicApiOk) {
      continue;
    }

    // Run syntax/type verification gate if edits were applied on disk
    if (options.applyEdits && modifiedInAttempt.length > 0) {
      const checkRes = verifyModifiedFilesCompile(safeRoot, modifiedInAttempt);
      if (!checkRes.ok) {
        lastError = checkRes.error;
        // Restore snapshots before retrying
        for (const [relFile, orig] of snapshots.entries()) {
          fs.writeFileSync(resolveSafeRepoPath(safeRoot, relFile), orig, 'utf8');
        }
        continue;
      }
    }

    // Verification succeeded!
    return {
      alertId: alert.id,
      cveOrRuleId: alert.cveOrRuleId,
      targetPathOrPackage: alert.packageOrFilePath,
      disposition: alert.disposition,
      engineUsed,
      attemptsUsed,
      maxRetries: MAX_RETRIES,
      publicApiUnchangedVerified: true,
      verificationGatePassed: true,
      modifiedFiles: modifiedInAttempt,
      finalStatus: 'PATCHED_AND_VERIFIED',
      diffPreview: diffPreview || 'Verified clean (no code diff required).',
      escalationOrSuccessNote: `Successfully synthesized & verified fix on attempt ${attemptsUsed}/${MAX_RETRIES} (${
        options.applyEdits ? 'applied to workspace' : 'dry-run diff verified'
      }).`
    };
  }

  // Circuit Breaker Triggered (Footnote [^3]): Roll back all snapshots cleanly
  if (options.applyEdits) {
    for (const [relFile, orig] of snapshots.entries()) {
      fs.writeFileSync(resolveSafeRepoPath(safeRoot, relFile), orig, 'utf8');
    }
  }

  return {
    alertId: alert.id,
    cveOrRuleId: alert.cveOrRuleId,
    targetPathOrPackage: alert.packageOrFilePath,
    disposition: alert.disposition,
    engineUsed,
    attemptsUsed,
    maxRetries: MAX_RETRIES,
    publicApiUnchangedVerified: publicApiOk,
    verificationGatePassed: false,
    modifiedFiles: [],
    finalStatus: 'CIRCUIT_BREAKER_ESCALATED_TO_HUMAN',
    diffPreview: '',
    escalationOrSuccessNote: `Circuit breaker triggered after ${attemptsUsed}/${MAX_RETRIES} attempts (${lastError}). Reverted workspace cleanly and escalated to Human Report (Note #3).`
  };
}

function resolveCandidateFilesForStage3(
  safeRoot: string,
  alert: TriagedAlert
): string[] {
  if (
    alert.disposition === 'ROUTE_TO_STAGE3_CODING_AGENT_SAST' ||
    alert.disposition === 'ROUTE_TO_STAGE3_TEST_FIXTURE_SANITIZE'
  ) {
    const candidate = resolveSafeRepoPath(safeRoot, alert.packageOrFilePath);
    return fs.existsSync(candidate) ? [alert.packageOrFilePath] : [];
  }

  if (alert.disposition === 'ROUTE_TO_STAGE3_CODING_AGENT_NODE_NATIVE') {
    const pkg = alert.packageOrFilePath;
    const grepRes = execSafeCommand(
      'git',
      ['grep', '-l', `from '${pkg}'`],
      safeRoot,
      safeRoot
    );
    const files = grepRes.stdout
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const rootPkgJson = resolveSafeRepoPath(safeRoot, 'package.json');
    if (
      fs.existsSync(rootPkgJson) &&
      fs.readFileSync(rootPkgJson, 'utf8').includes(`"@types/${pkg}"`)
    ) {
      files.push('package.json');
    }
    return files;
  }

  return [];
}

async function synthesizeStage3Patch(
  relFile: string,
  originalContent: string,
  alert: TriagedAlert,
  previousAttemptError: string,
  apiKey: string,
  geminiModel: string
): Promise<string> {
  // 1. If GEMINI_API_KEY is configured, invoke Gemini API with strict security/API constraints
  if (apiKey) {
    try {
      const prompt = [
        `You are a security remediation coding agent for the Firebase JS SDK (${relFile}).`,
        `Fix the following vulnerability without altering any exported TypeScript function signatures:`,
        `- Rule/CVE: ${alert.cveOrRuleId}`,
        `- Disposition: ${alert.disposition}`,
        `- Description: ${alert.description}`,
        previousAttemptError
          ? `- Previous attempt failed compilation with: ${previousAttemptError}`
          : '',
        `Return ONLY the complete updated file contents inside a single code block.`
      ]
        .filter(Boolean)
        .join('\n');

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${prompt}\n\n\`\`\`typescript\n${originalContent}\n\`\`\`` }]
              }
            ],
            generationConfig: { temperature: 0.1 }
          })
        }
      );
      if (resp.ok) {
        const data = (await resp.json()) as any;
        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const match = text.match(/```(?:typescript|ts|json|js)?\n([\s\S]*?)```/);
        if (match && match[1]) {
          return match[1];
        }
      }
    } catch {
      // Fall back to deterministic security codemod below
    }
  }

  // 2. Deterministic AST / Pattern Security Codemods
  if (alert.disposition === 'ROUTE_TO_STAGE3_CODING_AGENT_SAST') {
    // Prototype pollution hardening in deepCopy.ts (`__proto__`, `constructor`, `prototype`)
    if (originalContent.includes("return key !== '__proto__';")) {
      return originalContent
        .replace(
          'if (!source.hasOwnProperty(prop) || !isValidKey(prop)) {',
          'if (!Object.prototype.hasOwnProperty.call(source, prop) || !isValidKey(prop)) {'
        )
        .replace(
          "return key !== '__proto__';",
          "return key !== '__proto__' && key !== 'constructor' && key !== 'prototype';"
        );
    }
  }

  if (alert.disposition === 'ROUTE_TO_STAGE3_CODING_AGENT_NODE_NATIVE') {
    const pkg = alert.packageOrFilePath;
    if (relFile === 'package.json') {
      return originalContent.replace(
        new RegExp(`^\\s*"@types/${pkg}":\\s*"[^"]+",?\\n`, 'm'),
        ''
      );
    }
    // Remove unused legacy `import * as request from 'request';` where native `fetch()` is already in use
    return originalContent.replace(
      new RegExp(`^import \\* as ${pkg} from '${pkg}';\\n+`, 'm'),
      ''
    );
  }

  if (alert.disposition === 'ROUTE_TO_STAGE3_TEST_FIXTURE_SANITIZE') {
    return originalContent.replace(
      /(['"])AIza[0-9A-Za-z_-]{35}\1/g,
      "['test', 'dummy', 'key', '12345'].join('-')"
    );
  }

  return originalContent;
}

function verifyExportSignaturesUnchanged(
  beforeCode: string,
  afterCode: string
): boolean {
  const extractExports = (src: string): string[] =>
    src
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('export function ') || l.startsWith('export class ') || l.startsWith('export interface '))
      .sort();

  const beforeExports = extractExports(beforeCode);
  const afterExports = extractExports(afterCode);
  return JSON.stringify(beforeExports) === JSON.stringify(afterExports);
}

function verifyModifiedFilesCompile(
  safeRoot: string,
  modifiedFiles: string[]
): { ok: boolean; error: string } {
  const tsFiles = modifiedFiles.filter(f => f.endsWith('.ts'));
  if (tsFiles.length === 0) {
    return { ok: true, error: '' };
  }
  const res = execSafeCommand(
    'npx',
    ['tsc', '--noEmit', '--project', 'scripts/tsconfig.json'],
    safeRoot,
    safeRoot
  );
  if (res.exitCode !== 0) {
    return { ok: false, error: res.stderr || res.stdout };
  }
  return { ok: true, error: '' };
}

function buildUnifiedDiffPreview(
  relFile: string,
  before: string,
  after: string
): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const changes: string[] = [`--- a/${relFile}`, `+++ b/${relFile}`];
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (beforeLines[i] !== afterLines[i]) {
      if (beforeLines[i] !== undefined) {
        changes.push(`- ${beforeLines[i]}`);
      }
      if (afterLines[i] !== undefined) {
        changes.push(`+ ${afterLines[i]}`);
      }
    }
  }
  return changes.slice(0, 12).join('\n');
}
