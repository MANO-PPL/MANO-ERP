#!/usr/bin/env node

/*
 * Stage 10 OKF pipeline orchestrator.
 *
 * This module deliberately owns orchestration only.  Semantic reasoning,
 * evidence validation, mutation, and final safety validation remain in stages
 * 2-9.  The exported orchestrate() function is dependency injectable for
 * deterministic tests; importing this file never starts a pipeline.
 */

import fsPromises from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const SYSTEM_ROOT = path.resolve(REPO_ROOT, 'backend/knowledge/.okf-system');
const CANONICAL_OKFS = [
  'index.md', 'vendors/index.md', 'vendors/relationships.md', 'clients/index.md',
  'resources/index.md', 'resources/rate-versioning.md', 'resources/compositions.md',
  'resources/impact-tracing.md', 'interactions/index.md', 'projects/index.md'
];
const MODULE_RE = /\/modules\/([^/]+)\//i;
const ACTIONABLE = new Set(['MODIFY', 'ADD', 'REMOVE']);
const TERMINAL = new Set([0, 1, 2, 3]);
const ALLOWED_STAGE_EXITS = {
  stage2: new Set([0, 1, 2]), stage3: new Set([0, 1, 2]), stage4: new Set([0, 1, 2, 3]),
  stage5: TERMINAL, stage6: TERMINAL, stage7: TERMINAL, stage8: new Set([0, 2, 3]), stage9: TERMINAL
};

class Stage10Error extends Error { constructor(message, code = 3, details = {}) { super(message); this.code = code; this.details = details; } }
const fatal = (message, details) => { throw new Stage10Error(message, 3, details); };
const retry = (message, details) => { throw new Stage10Error(message, 2, details); };
const normalize = value => String(value ?? '').replace(/\\/g, '/').replace(/^\.\//, '');
const sorted = values => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function parseArgs(args) {
  const out = { dryRun: false, module: null, all: false, verbose: false, noNim: false, validateOnly: false, since: null };
  const seen = new Set();
  for (const arg of args) {
    let key = arg;
    if (arg.startsWith('--module=')) { key = '--module'; if (seen.has(key)) fatal('Duplicate --module.'); const value = arg.slice(9).trim(); if (!value) fatal('Empty --module value.'); out.module = value.toLowerCase(); }
    else if (arg === '--dry-run') { if (seen.has(arg)) fatal('Duplicate --dry-run.'); out.dryRun = true; }
    else if (arg === '--all') { if (seen.has(arg)) fatal('Duplicate --all.'); out.all = true; }
    else if (arg === '--verbose') { if (seen.has(arg)) fatal('Duplicate --verbose.'); out.verbose = true; }
    else if (arg === '--no-nim') { if (seen.has(arg)) fatal('Duplicate --no-nim.'); out.noNim = true; }
    else if (arg === '--validate-only') { if (seen.has(arg)) fatal('Duplicate --validate-only.'); out.validateOnly = true; }
    else if (arg.startsWith('--since=')) { key = '--since'; if (seen.has(key)) fatal('Duplicate --since.'); const value = arg.slice(8).trim(); if (!value) fatal('Empty --since value.'); out.since = value; }
    else fatal(`Unknown argument: ${arg}`);
    seen.add(key);
  }
  if (out.validateOnly && (out.all || out.module || out.noNim || out.dryRun || out.since)) fatal('--validate-only cannot be combined with pipeline flags.');
  return out;
}

function defaultPaths(repoRoot = REPO_ROOT) {
  const knowledge = path.join(repoRoot, 'backend/knowledge');
  const system = path.join(knowledge, '.okf-system');
  return {
    repoRoot, systemRoot: system,
    sourceMap: path.join(system, 'source-map.json'), metadata: path.join(system, 'okf-metadata.json'),
    snapshot: path.join(system, 'db-schema-snapshot.json'), history: path.join(system, 'update-history.json'),
    patterns: path.join(system, 'learned-patterns.md'), review: path.join(system, 'human-review-required.json'),
    backups: path.join(system, 'backups'), bundles: path.join(system, 'evidence-bundles'),
    proposals: path.join(system, 'change-proposals'), validated: path.join(system, 'validated-proposals'),
    scripts: {
      stage2: path.join(repoRoot, 'backend/scripts/okf-detect-changes.js'),
      stage3: path.join(repoRoot, 'backend/scripts/okf-diff-schema.js'),
      stage4: path.join(repoRoot, 'backend/scripts/okf-analyze-impact.js'),
      stage5: path.join(repoRoot, 'backend/scripts/okf-collect-evidence.js'),
      stage6: path.join(repoRoot, 'backend/scripts/okf-reason.js'),
      stage7: path.join(repoRoot, 'backend/scripts/okf-check-evidence.js'),
      stage8: path.join(repoRoot, 'backend/scripts/okf-update-engine.js'),
      stage9: path.join(repoRoot, 'backend/scripts/okf-validate-bundle.js')
    },
    okfRoot: knowledge
  };
}

function childResult(result, label) {
  const exitCode = Number.isInteger(result?.exitCode) ? result.exitCode : (Number.isInteger(result?.status) ? result.status : 3);
  const stdout = String(result?.stdout ?? '');
  const stderr = String(result?.stderr ?? '');
  let data = result?.data ?? result?.parsed;
  if (data === undefined && stdout.trim()) {
    try { data = JSON.parse(stdout.trim()); } catch { throw new Stage10Error(`${label} produced malformed JSON.`, 3, { stderr }); }
  }
  if (result?.error || result?.spawnError || result?.signal) throw new Stage10Error(`${label} could not run safely.`, 3, { error: String(result.error ?? result.spawnError ?? result.signal), stderr });
  if (!isObject(data)) throw new Stage10Error(`${label} produced no structured JSON.`, 3, { stderr });
  return { exitCode, data, stdout, stderr };
}

function realRunner(script, args, options = {}) {
  const env = { ...process.env, ...(options.env ?? {}) };
  if (options.removeNim) env.NVIDIA_API_KEY = '';
  const result = spawnSync(process.execPath, [script, ...args], { cwd: options.cwd ?? REPO_ROOT, env, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  return { exitCode: result.status ?? 3, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error, signal: result.signal };
}

function makeRealDependencies() {
  return { fs: fsPromises, syncFs: fsSync, paths: defaultPaths(), runChild: realRunner, now: () => new Date().toISOString() };
}

async function readJson(fs, file, label) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { throw new Stage10Error(`Unable to read ${label}: ${error.message}`, 3); }
}
async function writeJson(fs, file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
async function readOptional(fs, file) { try { return await fs.readFile(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function exists(fs, file) { try { await fs.access(file); return true; } catch { return false; } }
async function clearDirectory(fs, dir) {
  await fs.mkdir(dir, { recursive: true });
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) await fs.rm(path.join(dir, entry.name), { recursive: true, force: true });
}
async function listJson(fs, dir) {
  if (!(await exists(fs, dir))) return [];
  return (await fs.readdir(dir, { withFileTypes: true })).filter(e => e.isFile() && e.name.endsWith('.json')).map(e => e.name).sort();
}

function validateStage2(data, exitCode) {
  if (!isObject(data) || !Array.isArray(data.changedFiles) || !isObject(data.impactSummary) || typeof data.requiresOkfUpdate !== 'boolean' || !Array.isArray(data.affectedOkfFiles)) throw new Stage10Error('Stage 2 result shape is invalid.', 3);
  const buckets = ['NO_AGENT_IMPACT', 'LOCAL_OKF_IMPACT', 'MULTIPLE_OKF_IMPACT', 'GLOBAL_KNOWLEDGE_IMPACT', 'UNKNOWN'];
  const changed = new Set(data.changedFiles.map(normalize));
  const seen = new Set();
  for (const bucket of buckets) { if (!Array.isArray(data.impactSummary[bucket])) throw new Stage10Error(`Stage 2 ${bucket} bucket is invalid.`, 3); for (const item of data.impactSummary[bucket]) { const n = normalize(item); if (!changed.has(n) || seen.has(n)) throw new Stage10Error('Stage 2 classification is inconsistent.', 3); seen.add(n); } }
  if (seen.size !== changed.size) throw new Stage10Error('Stage 2 changedFiles classification is incomplete.', 3);
  const hasImpact = buckets.slice(1, 4).some(k => data.impactSummary[k].length);
  const expected = data.impactSummary.UNKNOWN.length ? 2 : hasImpact ? 1 : 0;
  if (exitCode !== null && exitCode !== expected) throw new Stage10Error(`Stage 2 exit ${exitCode} contradicts structured result.`, 3);
  return data;
}
function validateStage3(data, exitCode) {
  if (!isObject(data) || !Array.isArray(data.changes) || typeof data.hasChanges !== 'boolean' || !Array.isArray(data.affectedOkfFiles)) throw new Stage10Error('Stage 3 result shape is invalid.', 3);
  if ((data.hasChanges && !data.changes.length) || (!data.hasChanges && data.changes.length)) throw new Stage10Error('Stage 3 hasChanges contradicts changes.', 3);
  if (exitCode !== null && exitCode !== (data.hasChanges ? 1 : 0)) throw new Stage10Error(`Stage 3 exit ${exitCode} contradicts structured result.`, 3);
  return data;
}
function validateStage4(data) {
  if (!isObject(data) || !Array.isArray(data.impactAnalysis) || !isObject(data.summary)) throw new Stage10Error('Stage 4 result shape is invalid.', 3);
  if (data.unresolvedEvidence?.length || data.impactAnalysis.some(item => item.classification === 'UNKNOWN')) retry('Stage 4 unresolved evidence.', { unresolvedEvidence: data.unresolvedEvidence ?? [] });
  return data;
}

function moduleFiles(sourceMap, moduleName) {
  if (!moduleName) return null;
  const publicModules = new Set(['root', 'clients', 'vendors', 'resources', 'interactions', 'projects']);
  const available = new Set();
  for (const entry of sourceMap) {
    const head = normalize(entry.okfFile).split('/')[0]; if (head === 'index.md') available.add('root'); else if (head) available.add(head.toLowerCase());
  }
  if (!publicModules.has(moduleName) || !available.has(moduleName)) fatal(`Unsupported module: ${moduleName}.`, { supportedModules: sorted([...available].filter(item => publicModules.has(item))) });
  return new Set(sourceMap.filter(entry => {
    const okf = normalize(entry.okfFile).toLowerCase();
    return moduleName === 'root' ? okf === 'index.md' : okf.startsWith(`${moduleName}/`);
  }).map(entry => entry.okfFile));
}
function moduleTriggerInfo(sourceMap, moduleName) {
  const selected = moduleFiles(sourceMap, moduleName);
  const entries = sourceMap.filter(entry => selected.has(entry.okfFile));
  return { selected, sources: new Set(entries.flatMap(entry => (entry.primarySources ?? []).map(normalize))), tables: new Set(entries.flatMap(entry => entry.tables ?? [])) };
}
function validateSourceMap(sourceMap) {
  if (!Array.isArray(sourceMap) || sourceMap.length === 0 || sourceMap.some(e => !isObject(e) || typeof e.okfFile !== 'string' || !Array.isArray(e.tables) || !Array.isArray(e.primarySources))) fatal('source-map.json is malformed.');
  return sourceMap;
}
function mapSources(sourceMap, files) {
  const result = new Set();
  for (const file of files) for (const entry of sourceMap) if ((entry.primarySources ?? []).map(normalize).includes(normalize(file))) result.add(entry.okfFile);
  return result;
}
function mapTables(sourceMap, changes) {
  const result = new Set();
  for (const change of changes) for (const entry of sourceMap) if ((entry.tables ?? []).includes(change.table)) result.add(entry.okfFile);
  return result;
}
function filterStage2(stage2, sourceMap, moduleName) {
  if (!moduleName) return stage2;
  const info = moduleTriggerInfo(sourceMap, moduleName);
  const changedFiles = stage2.changedFiles.filter(file => info.sources.has(normalize(file)));
  const summary = {}; for (const key of Object.keys(stage2.impactSummary)) summary[key] = stage2.impactSummary[key].filter(file => changedFiles.map(normalize).includes(normalize(file)));
  const affected = sorted([...mapSources(sourceMap, changedFiles)]);
  return { ...stage2, changedFiles, impactSummary: summary, requiresOkfUpdate: summary.LOCAL_OKF_IMPACT.length + summary.MULTIPLE_OKF_IMPACT.length + summary.GLOBAL_KNOWLEDGE_IMPACT.length > 0, affectedOkfFiles: affected };
}
function filterStage3(stage3, sourceMap, moduleName) {
  if (!moduleName) return stage3;
  const info = moduleTriggerInfo(sourceMap, moduleName);
  const changes = stage3.changes.filter(change => info.tables.has(change.table));
  return { ...stage3, changes, hasChanges: changes.length > 0, affectedOkfFiles: sorted([...mapTables(sourceMap, changes)]) };
}
function forceAllAnalysis(stage2, stage3, sourceMap, moduleName = null, realAnalysis = null) {
  const scope = moduleFiles(sourceMap, moduleName);
  let files = sourceMap.map(entry => entry.okfFile);
  if (scope) {
    const scopedEntries = sourceMap.filter(entry => scope.has(entry.okfFile));
    const sharedTables = new Set(scopedEntries.flatMap(entry => entry.tables ?? []));
    const sharedSources = new Set(scopedEntries.flatMap(entry => (entry.primarySources ?? []).map(normalize)));
    files = sourceMap.filter(entry => (entry.tables ?? []).some(t => sharedTables.has(t)) || (entry.primarySources ?? []).some(s => sharedSources.has(normalize(s)))).map(entry => entry.okfFile);
  }
  files = sorted(files);
  const realByOkf = new Map((realAnalysis?.impactAnalysis ?? []).map(item => [item.okfFile, item]));
  const unresolvedEvidence = realAnalysis?.unresolvedEvidence ?? [];
  const impactAnalysis = files.map(okfFile => ({ okfFile, classification: 'FILE_REGENERATE', crossOkfImpact: realByOkf.get(okfFile)?.crossOkfImpact === true, reason: 'User-requested full re-analysis; no source or schema change is implied.', evidence: realByOkf.get(okfFile)?.evidence ?? [], requiresHumanReview: realByOkf.get(okfFile)?.requiresHumanReview === true }));
  const classifications = { SKIP: 0, SECTION_UPDATE: 0, FILE_REGENERATE: 0, UNKNOWN: 0 }; for (const item of impactAnalysis) classifications[item.classification]++;
  return { timestamp: new Date().toISOString(), sourceChanges: realAnalysis?.sourceChanges ?? stage2, schemaChanges: realAnalysis?.schemaChanges ?? stage3, unresolvedEvidence, impactAnalysis, summary: { totalOkfFilesAffected: impactAnalysis.filter(item => item.classification !== 'SKIP').length, requiresHumanReview: unresolvedEvidence.length > 0 || impactAnalysis.some(item => item.requiresHumanReview), classifications, crossOkfImpactCount: impactAnalysis.filter(item => item.crossOkfImpact).length } };
}
function tierCount(bundle) {
  const evidence = bundle?.evidence ?? {};
  let count = 0;
  if (evidence.live_database_schema?.available && isObject(evidence.live_database_schema.tables) && Object.keys(evidence.live_database_schema.tables).length) count += Object.keys(evidence.live_database_schema.tables).length;
  for (const key of ['schema_initialization_code', 'service_layer', 'controllers_and_routes']) { const values = evidence[key]?.functions ?? evidence[key]?.items; if (Array.isArray(values)) count += values.length; }
  return count;
}
function actionCount(proposals) { return proposals.reduce((n, p) => n + (p.proposedChanges ?? []).filter(c => ACTIONABLE.has(c.operation)).length, 0); }
function bundleFilename(okfFile) { return `${String(okfFile).replace(/[\\/]/g, '-').replace(/\.md$/, '')}.json`; }
function classifyBlocked(stage8, actionableByOkf = new Map()) {
  const blocked = stage8.blockedFiles ?? [];
  const human = blocked.filter(f => f.category === 'HUMAN_REVIEW' && (actionableByOkf.get(f.okfFile) ?? 0) > 0).map(f => f.okfFile);
  const metadataOnly = blocked.filter(f => f.category === 'HUMAN_REVIEW' && (actionableByOkf.get(f.okfFile) ?? 0) === 0).map(f => f.okfFile);
  const rerun = blocked.filter(f => f.category === 'RERUN_REQUIRED').map(f => f.okfFile);
  return { human, metadataOnly, rerun };
}

function compareArtifactSet(actual, expected, label) {
  const a = sorted(actual); const e = sorted(expected);
  if (JSON.stringify(a) !== JSON.stringify(e)) throw new Stage10Error(`${label} artifact set mismatch.`, 3, { expected: e, actual: a });
}
function validateStage8Data(data) {
  if (!isObject(data) || typeof data.writesPerformed !== 'boolean' || !Array.isArray(data.blockedFiles)) throw new Stage10Error('Stage 8 result is structurally invalid.', 3);
  return data;
}
function validateStage9Data(data) {
  if (!isObject(data) || typeof data.bundleIsAgentSafe !== 'boolean' || typeof data.bundleIsStructurallyValid !== 'boolean') throw new Stage10Error('Stage 9 result is structurally invalid.', 3);
  return data;
}

async function readProposalSet(deps, directory, expected, label) {
  const actual = await listJson(deps.fs, directory); compareArtifactSet(actual, expected, label);
  const proposals = [];
  for (const file of actual) {
    const proposal = await readJson(deps.fs, path.join(directory, file), `${label} ${file}`);
    if (!isObject(proposal) || typeof proposal.okfFile !== 'string' || !Array.isArray(proposal.proposedChanges)) throw new Stage10Error(`Malformed ${label} artifact ${file}.`, 3);
    if (bundleFilename(proposal.okfFile) !== file) throw new Stage10Error(`${label} ${file} has an unexpected okfFile identity.`, 3);
    proposals.push({ file, proposal });
  }
  return proposals;
}

function changePreview(proposals) {
  return proposals.flatMap(({ proposal }) => (proposal.proposedChanges ?? []).filter(change => ACTIONABLE.has(change.operation)).map(change => ({
    okfFile: proposal.okfFile, operation: change.operation, section: change.section, targetContent: change.targetContent,
    proposedContent: change.proposedContent, evidenceTier: change.evidenceTier, confidence: change.confidence,
    approvedForWrite: change.approvedForWrite === true, flagForHumanReview: change.flagForHumanReview === true
  })));
}

async function acquireLock(deps) {
  if (deps.acquireLock) return deps.acquireLock();
  let canonicalRepo;
  try { canonicalRepo = await deps.fs.realpath(path.resolve(deps.paths.repoRoot)); } catch { canonicalRepo = path.resolve(deps.paths.repoRoot); }
  const key = sha256(Buffer.from(canonicalRepo, 'utf8')).slice(0, 32);
  const file = path.join(os.tmpdir(), `mano-okf-${key}.lock`);
  const ownershipToken = crypto.randomBytes(18).toString('hex');
  try {
    const handle = await deps.fs.open(file, 'wx');
    await handle.writeFile(JSON.stringify({ canonicalRepo, pid: process.pid, startedAt: new Date().toISOString(), ownershipToken }));
    await handle.close();
    return async () => {
      try { const current = JSON.parse(await deps.fs.readFile(file, 'utf8')); if (current.ownershipToken === ownershipToken) await deps.fs.unlink(file); } catch {}
    };
  } catch (error) {
    if (error.code === 'EEXIST') {
      let metadata;
      try {
        metadata = JSON.parse(await deps.fs.readFile(file, 'utf8'));
        if (!metadata || typeof metadata !== 'object' || !Number.isInteger(metadata.pid) || metadata.pid <= 0 || typeof metadata.ownershipToken !== 'string' || typeof metadata.canonicalRepo !== 'string') retry('Indeterminate Stage 10 lock; refusing to remove it.', { lock: file });
      } catch (readError) {
        retry('Unreadable or malformed Stage 10 lock; refusing to remove it.', { lock: file, reason: readError.message });
      }
      let dead = false;
      try { process.kill(metadata.pid, 0); } catch (probeError) {
        if (probeError?.code === 'ESRCH') dead = true;
        else retry('Unable to determine Stage 10 lock owner liveness; refusing to reclaim it.', { lock: file, reason: probeError?.code ?? probeError?.message });
      }
      if (dead) { try { await deps.fs.unlink(file); } catch (unlinkError) { retry('Unable to reclaim stale Stage 10 lock.', { lock: file, reason: unlinkError.message }); } return acquireLock(deps); }
      retry('Another Stage 10 updater is already running.', { lock: file });
    }
    throw error;
  }
}
async function runStage(deps, key, args = [], options = {}) {
  const raw = await deps.runChild(deps.paths.scripts[key], args, { cwd: deps.paths.repoRoot, removeNim: options.removeNim });
  const result = childResult(raw, `Stage ${key.slice(-1)}`);
  if (!ALLOWED_STAGE_EXITS[key]?.has(result.exitCode)) throw new Stage10Error(`Stage ${key.slice(-1)} returned unsupported exit code ${result.exitCode}.`, 3, { unsupportedExitCode: result.exitCode });
  return result;
}
async function captureTransaction(deps) {
  const p = deps.paths; const files = {};
  for (const rel of CANONICAL_OKFS) files[rel] = await readOptional(deps.fs, path.join(p.okfRoot, rel));
  for (const [name, file] of [['snapshot', p.snapshot], ['history', p.history], ['patterns', p.patterns], ['review', p.review]]) files[name] = await readOptional(deps.fs, file);
  files.backupNames = (await exists(deps.fs, p.backups)) ? await deps.fs.readdir(p.backups) : [];
  return files;
}
async function restoreTransaction(deps, before) {
  const p = deps.paths;
  for (const rel of CANONICAL_OKFS) await restoreBytes(deps, path.join(p.okfRoot, rel), before[rel]);
  for (const [name, file] of [['snapshot', p.snapshot], ['history', p.history], ['patterns', p.patterns], ['review', p.review]]) await restoreBytes(deps, file, before[name]);
  if (await exists(deps.fs, p.backups)) for (const name of await deps.fs.readdir(p.backups)) if (!before.backupNames.includes(name)) await deps.fs.rm(path.join(p.backups, name), { force: true });
}
async function transactionState(deps) { return captureTransaction(deps); }
function sameBytes(a, b) { if (a === null || b === null) return a === b; return Buffer.compare(a, b) === 0; }
async function hasRollbackConflict(deps, expected) {
  const current = await transactionState(deps);
  for (const rel of CANONICAL_OKFS) if (!sameBytes(current[rel], expected[rel])) return true;
  for (const name of ['snapshot', 'history', 'patterns', 'review']) if (!sameBytes(current[name], expected[name])) return true;
  return JSON.stringify([...current.backupNames].sort()) !== JSON.stringify([...expected.backupNames].sort());
}
async function restoreBytes(deps, file, bytes) {
  if (bytes === null) { try { await deps.fs.unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  else { await deps.fs.mkdir(path.dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.rollback.tmp`; await deps.fs.writeFile(tmp, bytes); await deps.fs.rename(tmp, file); }
}
async function recoverUncertainApply(deps, summary, preimage, error) {
  summary.rollbackPerformed = true;
  summary.errors.push(error.message);
  try {
    if (!preimage) throw new Error('Stage 8 preimage was unavailable.');
    const expectedPostFailure = await transactionState(deps);
    if (await hasRollbackConflict(deps, expectedPostFailure)) throw new Error('ROLLBACK_CONFLICT: external state changed; no overwrite performed.');
    await restoreTransaction(deps, preimage);
    const restored = await runStage(deps, 'stage9'); validateStage9Data(restored.data);
    summary.stagesExecuted.push(9); summary.postWriteValidationRun = true; summary.postWriteAgentSafe = restored.data.bundleIsAgentSafe === true;
    if (restored.exitCode !== 0 || restored.data.bundleIsAgentSafe !== true || restored.data.bundleIsStructurallyValid !== true) throw new Error('Restored state failed Stage 9 validation.');
    summary.rollbackSucceeded = true;
  } catch (rollbackError) {
    summary.rollbackSucceeded = false;
    summary.errors.push(`${error.message}; ${rollbackError.message}`);
  }
  summary.finalStatus = 'FATAL'; summary.exitCode = 3;
  return summary;
}
async function recoverAfterValidationFailure(deps, summary, preimage, afterWrite, error) {
  summary.rollbackPerformed = true; summary.errors.push(error.message);
  try {
    if (!preimage || !afterWrite || await hasRollbackConflict(deps, afterWrite)) throw new Error('ROLLBACK_CONFLICT: post-Stage-8 state changed; no overwrite performed.');
    await restoreTransaction(deps, preimage);
    const restored = await runStage(deps, 'stage9'); validateStage9Data(restored.data); summary.stagesExecuted.push(9); summary.postWriteValidationRun = true; summary.postWriteAgentSafe = restored.data.bundleIsAgentSafe === true;
    if (restored.exitCode !== 0 || restored.data.bundleIsAgentSafe !== true || restored.data.bundleIsStructurallyValid !== true) throw new Error('Restored state failed Stage 9 validation.');
    summary.rollbackSucceeded = true; summary.finalStatus = 'RERUN_REQUIRED'; summary.exitCode = 2;
  } catch (rollbackError) {
    summary.rollbackSucceeded = false; summary.errors.push(rollbackError.message); summary.finalStatus = 'FATAL'; summary.exitCode = 3;
  }
  return summary;
}

function baseSummary(options) {
  return { mode: options.validateOnly ? 'validate-only' : options.dryRun ? 'dry-run' : 'apply', module: options.module, forceAll: options.all, noNim: options.noNim, ...(options.since ? { sourceBaselineCommit: options.since } : {}), stagesExecuted: [], sourceChangesDetected: false, schemaChangesDetected: false, affectedOkfFiles: [], evidenceBundlesCreated: [], evidenceBundlesSkipped: [], proposalsGenerated: 0, actionableChanges: 0, validatedProposals: 0, changePreview: [], autoApplyFiles: [], humanReviewFiles: [], rerunRequiredFiles: [], filesEligible: 0, filesBlocked: 0, blockedFiles: [], changesWouldApply: 0, filesUpdated: 0, snapshotUpdated: false, snapshotDeferred: false, snapshotWouldUpdate: false, postWriteValidationRun: false, postWriteAgentSafe: null, rollbackPerformed: false, rollbackSucceeded: false, tempDirectoryRetained: false, warnings: [], errors: [], finalStatus: 'UNKNOWN', exitCode: 3 };
}

export async function orchestrate(inputOptions = {}, providedDeps = null) {
  const options = { dryRun: false, module: null, all: false, verbose: false, noNim: false, validateOnly: false, since: null, ...inputOptions };
  const deps = { ...makeRealDependencies(), ...(providedDeps ?? {}) }; deps.paths = { ...defaultPaths(), ...(providedDeps?.paths ?? {}) }; deps.fs ??= fsPromises;
  const summary = baseSummary(options); if (options.verbose) summary.stageDiagnostics = {}; let unlock = null; let tempDir = null;
  try {
    unlock = await acquireLock(deps);
    if (options.validateOnly) {
      const s9 = await runStage(deps, 'stage9'); validateStage9Data(s9.data); summary.stagesExecuted.push(9); if (options.verbose) summary.stageDiagnostics.stage9 = s9.data; summary.postWriteValidationRun = true; summary.postWriteAgentSafe = s9.data.bundleIsAgentSafe === true; summary.finalStatus = summary.postWriteAgentSafe && s9.data.bundleIsStructurallyValid === true && s9.exitCode === 0 ? 'SUCCESS' : s9.exitCode === 3 ? 'FATAL' : 'RERUN_REQUIRED'; summary.exitCode = summary.finalStatus === 'SUCCESS' ? 0 : summary.finalStatus === 'FATAL' ? 3 : 2; return summary;
    }
    tempDir = await deps.fs.mkdtemp(path.join(os.tmpdir(), 'mano-okf-')); const temp = { root: tempDir, stage2: path.join(tempDir, 'stage2.json'), stage3: path.join(tempDir, 'stage3.json'), stage4: path.join(tempDir, 'stage4.json'), reasoner: path.join(tempDir, 'reasoner-bundles') }; await deps.fs.mkdir(temp.reasoner, { recursive: true });
    const sourceMap = validateSourceMap(providedDeps?.sourceMap ?? await readJson(deps.fs, deps.paths.sourceMap, 'source-map.json'));
    const s2 = await runStage(deps, 'stage2', options.since ? [`--since=${options.since}`] : []); summary.stagesExecuted.push(2); if (options.verbose) summary.stageDiagnostics.stage2 = s2.data; let stage2 = validateStage2(s2.data, s2.exitCode); summary.sourceChangesDetected = stage2.requiresOkfUpdate;
    if (s2.exitCode === 2 || stage2.impactSummary.UNKNOWN.length) retry('Stage 2 reported UNKNOWN source scope.', { stage2 });
    stage2 = filterStage2(stage2, sourceMap, options.module);
    await writeJson(deps.fs, temp.stage2, stage2);
    const s3 = await runStage(deps, 'stage3'); summary.stagesExecuted.push(3); if (options.verbose) summary.stageDiagnostics.stage3 = s3.data; let stage3;
    if (s3.exitCode === 3) fatal('Stage 3 fatal failure.', { stage3: s3.data });
    if (s3.exitCode === 2) { const missing = !await exists(deps.fs, deps.paths.snapshot); if (missing || s3.data.error === 'Schema diff failed') retry(missing ? 'SCHEMA_BASELINE_REQUIRED: run okf-snapshot-schema.js explicitly.' : 'Stage 3 schema diff failed; rerun required.', { stage3: s3.data }); validateStage3(s3.data, s3.exitCode); }
    stage3 = validateStage3(s3.data, s3.exitCode); stage3 = filterStage3(stage3, sourceMap, options.module); summary.schemaChangesDetected = stage3.hasChanges; await writeJson(deps.fs, temp.stage3, stage3);
    if (!options.all && !stage2.requiresOkfUpdate && !stage3.hasChanges) { summary.finalStatus = 'SUCCESS'; summary.exitCode = 0; summary.message = 'OKF bundle is current'; return summary; }
    const s4 = await runStage(deps, 'stage4', [`--source-changes=${temp.stage2}`, `--schema-diff=${temp.stage3}`]);
    summary.stagesExecuted.push(4); if (options.verbose) summary.stageDiagnostics.stage4 = s4.data; if (s4.exitCode === 3) fatal('Stage 4 fatal failure.', { stage4: s4.data }); if (s4.exitCode === 2) retry('Stage 4 reported unresolved or unsafe impact scope.', { stage4: s4.data }); const realAnalysis = validateStage4(s4.data); const analysis = options.all ? forceAllAnalysis(stage2, stage3, sourceMap, options.module, realAnalysis) : realAnalysis; await writeJson(deps.fs, temp.stage4, analysis); summary.affectedOkfFiles = analysis.impactAnalysis.filter(i => i.classification !== 'SKIP').map(i => i.okfFile).sort();
    if (!summary.affectedOkfFiles.length) { summary.finalStatus = 'SUCCESS'; summary.exitCode = 0; summary.message = 'No agent knowledge affected'; return summary; }
    await clearDirectory(deps.fs, deps.paths.bundles); await clearDirectory(deps.fs, deps.paths.proposals); await clearDirectory(deps.fs, deps.paths.validated);
    const s5 = await runStage(deps, 'stage5', [`--analysis=${temp.stage4}`]); summary.stagesExecuted.push(5); if (options.verbose) summary.stageDiagnostics.stage5 = s5.data; summary.evidenceBundlesCreated = s5.data.bundlesCreated ?? []; summary.warnings.push(...(s5.data.warnings ?? [])); summary.errors.push(...(s5.data.errors ?? []));
    if (s5.exitCode === 3) fatal('Stage 5 fatal failure.', { stage5: s5.data });
    const expectedStage5 = summary.affectedOkfFiles.map(bundleFilename); const bundles = await listJson(deps.fs, deps.paths.bundles); compareArtifactSet(bundles, expectedStage5, 'Stage 5'); const rerunEvidence = new Set(); const eligible = [];
    for (const file of bundles) { const bundle = await readJson(deps.fs, path.join(deps.paths.bundles, file), `Stage 5 bundle ${file}`); if (!isObject(bundle) || typeof bundle.okfFile !== 'string' || !['COMPLETE', 'PARTIAL', 'UNSAFE'].includes(bundle.evidenceStatus)) fatal(`Malformed Stage 5 bundle ${file}.`); const count = tierCount(bundle); if (bundle.evidenceStatus === 'UNSAFE' || count === 0) { rerunEvidence.add(bundle.okfFile); summary.evidenceBundlesSkipped.push(file); } else { eligible.push(file); await deps.fs.copyFile(path.join(deps.paths.bundles, file), path.join(temp.reasoner, file)); } }
    summary.rerunRequiredFiles = sorted([...rerunEvidence]);
    if (!eligible.length) retry('No required OKF file has usable Tier 1-4 evidence.', { rerunRequiredFiles: summary.rerunRequiredFiles });
    const expectedStage6 = eligible.slice(); const s6 = await runStage(deps, 'stage6', [`--bundles=${temp.reasoner}`], { removeNim: options.noNim }); summary.stagesExecuted.push(6); if (options.verbose) summary.stageDiagnostics.stage6 = s6.data; summary.proposalsGenerated = s6.data.proposalsGenerated ?? 0; summary.actionableChanges = (s6.data.totalChanges ?? 0); summary.warnings.push(...(s6.data.warnings ?? [])); summary.errors.push(...(s6.data.errors ?? []));
    if (s6.exitCode === 2) retry('Stage 6 technical failure.', { stage6: s6.data }); if (s6.exitCode === 3) fatal('Stage 6 fatal failure.', { stage6: s6.data });
    const stage6Proposals = await readProposalSet(deps, deps.paths.proposals, expectedStage6, 'Stage 6 proposal');
    const actualActionableChanges = actionCount(stage6Proposals.map(item => item.proposal)); if (s6.data.totalChanges !== undefined && s6.data.totalChanges !== actualActionableChanges) fatal('Stage 6 totalChanges disagrees with proposal artifacts.', { reported: s6.data.totalChanges, actual: actualActionableChanges }); summary.actionableChanges = actualActionableChanges;
    if (summary.actionableChanges === 0) { summary.finalStatus = summary.rerunRequiredFiles.length ? 'RERUN_REQUIRED' : 'SUCCESS'; summary.exitCode = summary.rerunRequiredFiles.length ? 2 : 0; summary.message = 'No OKF changes needed'; return summary; }
    const s7 = await runStage(deps, 'stage7'); summary.stagesExecuted.push(7); if (options.verbose) summary.stageDiagnostics.stage7 = s7.data; summary.validatedProposals = s7.data.proposalsValidated ?? 0; if (s7.exitCode === 3) fatal('Stage 7 fatal failure.', { stage7: s7.data });
    const stage7Proposals = await readProposalSet(deps, deps.paths.validated, expectedStage6, 'Stage 7 validated proposal');
    const actionableByOkf = new Map(stage7Proposals.map(item => [item.proposal.okfFile, (item.proposal.proposedChanges ?? []).filter(change => ACTIONABLE.has(change.operation)).length]));
    summary.changePreview = changePreview(stage7Proposals);
    if (!options.dryRun && summary.rerunRequiredFiles.length === 0) {
      const baseline = await runStage(deps, 'stage9'); validateStage9Data(baseline.data); summary.stagesExecuted.push(9); if (options.verbose) summary.stageDiagnostics.stage9Preflight = baseline.data;
      if (baseline.exitCode === 3) fatal('Stage 9 fatal failure before apply.', { stage9: baseline.data });
      if (baseline.exitCode !== 0 || baseline.data.bundleIsAgentSafe !== true || baseline.data.bundleIsStructurallyValid !== true) { summary.postWriteValidationRun = true; summary.postWriteAgentSafe = baseline.data.bundleIsAgentSafe === true; retry('Current OKF bundle is not agent-safe; Stage 8 apply was not invoked.', { stage9: baseline.data }); }
    }
    const globallyBlocked = summary.rerunRequiredFiles.length > 0;
    const preimage = !options.dryRun && !globallyBlocked ? await captureTransaction(deps) : null;
    let s8;
    if (!options.dryRun && !globallyBlocked) {
      try { s8 = await runStage(deps, 'stage8', ['--apply']); }
      catch (error) { summary.stagesExecuted.push(8); return await recoverUncertainApply(deps, summary, preimage, error); }
    } else s8 = await runStage(deps, 'stage8', []);
    summary.stagesExecuted.push(8); if (options.verbose) summary.stageDiagnostics.stage8 = s8.data; if (s8.exitCode === 3) { if (!options.dryRun && !globallyBlocked) return await recoverUncertainApply(deps, summary, preimage, new Error('Stage 8 fatal exit.')); fatal('Stage 8 fatal failure.', { stage8: s8.data }); } try { validateStage8Data(s8.data); } catch (error) { if (!options.dryRun && !globallyBlocked) return await recoverUncertainApply(deps, summary, preimage, error); throw error; } summary.filesEligible = s8.data.filesEligible ?? 0; summary.filesBlocked = s8.data.filesBlocked ?? 0; summary.blockedFiles = s8.data.blockedFiles ?? []; summary.changesWouldApply = s8.data.changesWouldApply ?? s8.data.changesApplied ?? 0; summary.snapshotWouldUpdate = globallyBlocked ? false : s8.data.snapshotWouldUpdate === true; summary.snapshotDeferred = globallyBlocked ? true : s8.data.snapshotDeferred === true; const blocked = classifyBlocked(s8.data, actionableByOkf); summary.humanReviewFiles = blocked.human; summary.rerunRequiredFiles = sorted([...new Set([...summary.rerunRequiredFiles, ...blocked.rerun])]); const blockedNames = new Set((s8.data.blockedFiles ?? []).map(f => f.okfFile)); const candidatesForWrite = [...actionableByOkf.entries()].filter(([, count]) => count > 0).map(([file]) => file); const autoCandidates = s8.data.autoApplyFiles ?? ((s8.data.filesWouldUpdate ?? s8.data.filesUpdated ?? 0) > 0 ? candidatesForWrite.filter(f => !blockedNames.has(f)) : []); summary.autoApplyFiles = autoCandidates.filter(Boolean);
    if (options.dryRun) { summary.filesUpdated = 0; summary.snapshotWouldUpdate = summary.rerunRequiredFiles.length ? false : summary.snapshotWouldUpdate; summary.finalStatus = summary.rerunRequiredFiles.length ? 'RERUN_REQUIRED' : summary.humanReviewFiles.length ? 'HUMAN_REVIEW' : 'SUCCESS'; summary.exitCode = summary.finalStatus === 'SUCCESS' ? 0 : summary.finalStatus === 'HUMAN_REVIEW' ? 1 : 2; return summary; }
    if (!s8.data.writesPerformed) { summary.finalStatus = summary.rerunRequiredFiles.length ? 'RERUN_REQUIRED' : summary.humanReviewFiles.length ? 'HUMAN_REVIEW' : 'SUCCESS'; summary.exitCode = summary.finalStatus === 'RERUN_REQUIRED' ? 2 : summary.finalStatus === 'HUMAN_REVIEW' ? 1 : 0; return summary; }
    let afterWrite; let s9;
    try { afterWrite = await captureTransaction(deps); summary.filesUpdated = s8.data.filesUpdated ?? 0; summary.snapshotUpdated = s8.data.snapshotUpdated === true; summary.postWriteValidationRun = true; s9 = await runStage(deps, 'stage9'); validateStage9Data(s9.data); summary.stagesExecuted.push(9); summary.postWriteAgentSafe = s9.data.bundleIsAgentSafe === true; }
    catch (error) { return await recoverAfterValidationFailure(deps, summary, preimage, afterWrite, error); }
    if (s9.exitCode !== 0 || s9.data.bundleIsAgentSafe !== true || s9.data.bundleIsStructurallyValid !== true) { summary.rollbackPerformed = true; try { if (!preimage || await hasRollbackConflict(deps, afterWrite)) fatal('ROLLBACK_CONFLICT: post-Stage-8 state changed externally; no overwrite performed.'); await restoreTransaction(deps, preimage); const restored = await runStage(deps, 'stage9'); validateStage9Data(restored.data); summary.stagesExecuted.push(9); summary.rollbackSucceeded = restored.exitCode === 0 && restored.data.bundleIsAgentSafe === true && restored.data.bundleIsStructurallyValid === true; } catch (error) { summary.errors.push(error.message); } if (!summary.rollbackSucceeded) fatal('CRITICAL ROLLBACK FAILURE.'); summary.finalStatus = 'RERUN_REQUIRED'; summary.exitCode = 2; return summary; }
    summary.finalStatus = summary.rerunRequiredFiles.length ? 'RERUN_REQUIRED' : summary.humanReviewFiles.length ? 'HUMAN_REVIEW' : 'SUCCESS'; summary.exitCode = summary.finalStatus === 'RERUN_REQUIRED' ? 2 : summary.finalStatus === 'HUMAN_REVIEW' ? 1 : 0; return summary;
  } catch (error) {
    const e = error instanceof Stage10Error ? error : new Stage10Error(error.message ?? String(error), 3); summary.errors.push(e.message); summary.finalStatus = e.code === 3 ? 'FATAL' : 'RERUN_REQUIRED'; summary.exitCode = e.code; if (tempDir && e.code !== 0) { summary.tempDirectoryRetained = true; summary.tempDirectory = tempDir; } return summary;
  } finally { if (unlock) await unlock(); if (tempDir && summary.exitCode <= 1) { try { await deps.fs.rm(tempDir, { recursive: true, force: true }); } catch {} } else if (tempDir && summary.exitCode >= 2) { summary.tempDirectoryRetained = true; summary.tempDirectory ??= tempDir; } }
}

function printSummary(summary) { console.log(JSON.stringify(summary, null, 2)); }
const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  try { const options = parseArgs(process.argv.slice(2)); const result = await orchestrate(options); printSummary(result); process.exitCode = result.exitCode; }
  catch (error) { console.error(`Fatal Error: ${error.message}`); process.exitCode = error.code ?? 3; }
}

export { Stage10Error, parseArgs, defaultPaths, tierCount, moduleFiles, moduleTriggerInfo, filterStage2, filterStage3, forceAllAnalysis, classifyBlocked, makeRealDependencies };
