#!/usr/bin/env node

import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDirectory, '../..');

const normalize = value => String(value ?? '').replace(/\\/g, '/').replace(/^\.\//, '');

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: defaultRepoRoot,
      encoding: 'utf8',
      windowsHide: true
    }).trim();
  } catch (error) {
    throw new Error(`Unable to determine Git repository root: ${error.message}`);
  }
}

function stagedPaths(root) {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--no-renames', '-z'], {
    cwd: root,
    encoding: 'buffer',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Unable to read staged paths: ${result.error?.message ?? String(result.stderr ?? '').trim()}`);
  }
  return String(result.stdout ?? '').split('\0').filter(Boolean).map(normalize);
}

function parseStage2(stdout) {
  const text = String(stdout ?? '').trim();
  if (!text) throw new Error('Stage 2 produced no JSON output.');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Stage 2 produced malformed JSON: ${error.message}`);
  }
}

function validateStage2(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Stage 2 output is not an object.');
  if (!Array.isArray(data.changedFiles) || !data.changedFiles.every(value => typeof value === 'string')) throw new Error('Stage 2 changedFiles is invalid.');
  if (!data.impactSummary || typeof data.impactSummary !== 'object' || Array.isArray(data.impactSummary)) throw new Error('Stage 2 impactSummary is invalid.');
  const categories = ['NO_AGENT_IMPACT', 'LOCAL_OKF_IMPACT', 'MULTIPLE_OKF_IMPACT', 'GLOBAL_KNOWLEDGE_IMPACT', 'UNKNOWN'];
  for (const category of categories) if (!Array.isArray(data.impactSummary[category]) || !data.impactSummary[category].every(value => typeof value === 'string')) throw new Error(`Stage 2 ${category} is invalid.`);
  if (typeof data.requiresOkfUpdate !== 'boolean' || !Array.isArray(data.affectedOkfFiles) || !data.affectedOkfFiles.every(value => typeof value === 'string')) throw new Error('Stage 2 summary fields are invalid.');
  const expectedRequiresUpdate = ['LOCAL_OKF_IMPACT', 'MULTIPLE_OKF_IMPACT', 'GLOBAL_KNOWLEDGE_IMPACT'].some(category => data.impactSummary[category].length > 0);
  if (data.requiresOkfUpdate !== expectedRequiresUpdate) throw new Error('Stage 2 requiresOkfUpdate is inconsistent with impactSummary.');
  return data;
}

function printAdvisory(data) {
  const summary = data.impactSummary;
  const affected = data.affectedOkfFiles.length ? ` Affected OKF scope: ${data.affectedOkfFiles.join(', ')}.` : '';
  const paths = [...summary.LOCAL_OKF_IMPACT, ...summary.MULTIPLE_OKF_IMPACT, ...summary.GLOBAL_KNOWLEDGE_IMPACT];
  console.warn(`OKF advisory: staged source changes may affect agent knowledge; the routine updater will reconcile them.${affected}`);
  if (paths.length) console.warn(`Affected staged paths: ${paths.join(', ')}`);
}

function main() {
  const root = repoRoot();
  const stage2Script = path.join(root, 'backend', 'scripts', 'okf-detect-changes.js');
  const paths = stagedPaths(root);
  if (!paths.length) return 0;
  if (paths.some(file => file.includes(','))) throw new Error('Staged paths containing commas cannot be represented by the existing Stage 2 --files contract.');

  const result = spawnSync(process.execPath, [stage2Script, `--files=${paths.join(',')}`], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.error) throw new Error(`Stage 2 execution failed: ${result.error.message}`);
  const data = validateStage2(parseStage2(result.stdout));
  const exitCode = result.status;
  if (![0, 1, 2].includes(exitCode)) throw new Error(`Stage 2 returned unexpected exit code ${exitCode}.`);
  if (exitCode === 2 || data.impactSummary.UNKNOWN.length > 0) {
    if (process.env.OKF_SKIP_PRECOMMIT === '1' && data.impactSummary.UNKNOWN.length > 0 && exitCode === 2) {
      console.warn(`OKF pre-commit UNKNOWN bypass enabled explicitly (OKF_SKIP_PRECOMMIT=1): ${data.impactSummary.UNKNOWN.join(', ')}`);
      return 0;
    }
    throw new Error(`Commit blocked: Stage 2 could not deterministically classify staged source paths: ${data.impactSummary.UNKNOWN.join(', ') || 'UNKNOWN result'}`);
  }
  if (data.impactSummary.NO_AGENT_IMPACT.length === paths.length) return 0;
  if (data.requiresOkfUpdate) printAdvisory(data);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`OKF pre-commit blocked: ${error.message}`);
  process.exitCode = 1;
}
