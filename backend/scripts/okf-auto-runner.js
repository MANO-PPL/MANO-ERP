#!/usr/bin/env node

/*
 * Stage 11A automatic runner.
 *
 * This module owns scheduling, committed-source baselines, checkout safety,
 * and durable runner state. Stage 10 remains the sole pipeline orchestrator.
 */

import fsPromises from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { orchestrate as runStage10 } from './okf-update.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const INTERVAL_MS = 72 * 60 * 60 * 1000;
const INTERVAL_HOURS = 72;
const STATE_SCHEMA_VERSION = 1;
const CANONICAL_OKFS = [
  'index.md', 'vendors/index.md', 'vendors/relationships.md', 'clients/index.md',
  'resources/index.md', 'resources/rate-versioning.md', 'resources/compositions.md',
  'resources/impact-tracing.md', 'interactions/index.md', 'projects/index.md'
];
const CANONICAL_SET = new Set(CANONICAL_OKFS);

class RunnerError extends Error {
  constructor(message, code = 3, status = 'FATAL', details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.runnerFatal = code === 3;
  }
}

const normalize = value => String(value ?? '').replace(/\\/g, '/').replace(/^\.\//, '');
const nowIso = () => new Date().toISOString();
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function pathsFor(repoRoot) {
  const systemRoot = path.join(repoRoot, 'backend', 'knowledge', '.okf-system');
  return {
    repoRoot,
    systemRoot,
    state: path.join(systemRoot, 'auto-runner-state.json'),
    okfRoot: path.join(repoRoot, 'backend', 'knowledge')
  };
}

function realGit(repoRoot, args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.error || result.status !== 0) {
    throw new RunnerError(`Git command failed: git ${args.join(' ')}`, 2, 'SOURCE_BASELINE_UNAVAILABLE', {
      code: result.error?.code ?? null,
      status: result.status,
      stderr: String(result.stderr ?? '').trim().slice(0, 500)
    });
  }
  return String(result.stdout ?? '').trim();
}

function makeRealDependencies(repoRoot = REPO_ROOT) {
  return {
    paths: pathsFor(repoRoot),
    fs: fsPromises,
    now: () => new Date(),
    git: {
      head: () => realGit(repoRoot, ['rev-parse', '--verify', 'HEAD']),
      commit: commit => realGit(repoRoot, ['rev-parse', '--verify', `${commit}^{commit}`]),
      isAncestor: (ancestor, head) => {
        const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, head], {
          cwd: repoRoot, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
        });
        if (result.error) throw new RunnerError('Unable to determine source baseline ancestry.', 2, 'SOURCE_BASELINE_UNAVAILABLE', { code: result.error.code ?? null });
        return result.status === 0;
      },
      status: () => realGit(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all'])
    },
    runStage10: options => runStage10(options),
    validateBootstrap: options => runStage10({ validateOnly: true, verbose: Boolean(options?.verbose) }),
    persistCanonical: null
  };
}

function toNow(deps) {
  const value = typeof deps.now === 'function' ? deps.now() : new Date();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RunnerError('Clock returned an invalid timestamp.');
  return date;
}

function emptySummary(mode, now, overrides = {}) {
  return {
    mode,
    due: false,
    intervalHours: INTERVAL_HOURS,
    baselineCommit: null,
    headCommit: null,
    sourceRange: null,
    lastAttemptAt: null,
    nextDueAt: null,
    stage10Executed: false,
    stage10ExitCode: null,
    stage10FinalStatus: null,
    baselineAdvanced: false,
    newBaselineCommit: null,
    stateWritten: false,
    warnings: [],
    errors: [],
    finalStatus: 'UNKNOWN',
    exitCode: 3,
    timestamp: now.toISOString(),
    ...overrides
  };
}

function validCommit(value) {
  return typeof value === 'string' && /^[0-9a-f]{7,64}$/i.test(value);
}

function validateState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new RunnerError('Auto-runner state is not an object.');
  if (state.schemaVersion !== STATE_SCHEMA_VERSION) throw new RunnerError('Unsupported auto-runner state schema.');
  if (state.baselineCommit !== null && !validCommit(state.baselineCommit)) throw new RunnerError('Auto-runner baselineCommit is invalid.');
  for (const field of ['lastObservedHead', 'lastAttemptAt', 'lastCompletedAt', 'nextDueAt']) {
    if (state[field] !== null && typeof state[field] !== 'string') throw new RunnerError(`Auto-runner state field ${field} is invalid.`);
  }
  for (const field of ['lastAttemptAt', 'lastCompletedAt', 'nextDueAt']) if (state[field] !== null && Number.isNaN(Date.parse(state[field]))) throw new RunnerError(`Auto-runner state field ${field} is not a valid timestamp.`);
  if (state.baselineCommit !== null && (typeof state.nextDueAt !== 'string' || Number.isNaN(Date.parse(state.nextDueAt)))) throw new RunnerError('Auto-runner state with a baseline must have a valid nextDueAt timestamp.');
  if (state.lastExitCode !== null && state.lastExitCode !== undefined && !Number.isInteger(state.lastExitCode)) throw new RunnerError('Auto-runner lastExitCode is invalid.');
  if (typeof state.lastStatus !== 'string') throw new RunnerError('Auto-runner lastStatus is invalid.');
  if (state.lastAutoAppliedOkfFiles !== undefined && (!state.lastAutoAppliedOkfFiles || typeof state.lastAutoAppliedOkfFiles !== 'object' || Array.isArray(state.lastAutoAppliedOkfFiles))) throw new RunnerError('Auto-runner ownership map is invalid.');
  for (const [file, hash] of Object.entries(state.lastAutoAppliedOkfFiles ?? {})) {
    if (!CANONICAL_SET.has(normalize(file)) || !/^[0-9a-f]{64}$/i.test(hash)) throw new RunnerError('Auto-runner ownership map contains an invalid entry.');
  }
  return state;
}

async function readState(deps) {
  try {
    return validateState(JSON.parse(await deps.fs.readFile(deps.paths.state, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    if (error instanceof RunnerError) throw error;
    throw new RunnerError(`Unable to read auto-runner state: ${error.message}`);
  }
}

async function writeStateAtomic(deps, state) {
  validateState(state);
  const dir = path.dirname(deps.paths.state);
  await deps.fs.mkdir(dir, { recursive: true });
  const temporary = `${deps.paths.state}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  let handle;
  try {
    handle = await deps.fs.open(temporary, 'wx');
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await deps.fs.rename(temporary, deps.paths.state);
  } catch (error) {
    try { await handle?.close(); } catch {}
    try { await deps.fs.unlink(temporary); } catch {}
    throw new RunnerError(`Unable to atomically write auto-runner state: ${error.message}`);
  }
}

async function hashCanonical(deps) {
  const hashes = {};
  for (const file of CANONICAL_OKFS) {
    try { hashes[file] = sha256(await deps.fs.readFile(path.join(deps.paths.okfRoot, file))); }
    catch (error) { if (error.code === 'ENOENT') hashes[file] = null; else throw new RunnerError(`Unable to hash canonical OKF ${file}: ${error.message}`); }
  }
  return hashes;
}

function changedCanonical(before, after) {
  return CANONICAL_OKFS.filter(file => before[file] !== after[file]);
}

function parseStatus(raw) {
  return String(raw ?? '').split(/\r?\n/).filter(Boolean).map(line => {
    const xy = line.slice(0, 2);
    const file = normalize(line.slice(3));
    return { xy, file };
  });
}

function canonicalIdentity(repoPath, deps) {
  const normalized = normalize(repoPath);
  const root = normalize(path.relative(deps.paths.repoRoot, deps.paths.okfRoot)).replace(/\/$/, '');
  const prefix = `${root}/`;
  if (!root || !normalized.startsWith(prefix)) return null;
  const candidate = normalized.slice(prefix.length);
  return CANONICAL_SET.has(candidate) ? candidate : null;
}

async function checkoutIssues(deps, state) {
  const entries = parseStatus(deps.git.status());
  const issues = [];
  for (const entry of entries) {
    if (entry.xy.includes('U') || entry.xy === '??' || entry.file.includes(' -> ')) {
      issues.push(entry.file);
      continue;
    }
    const canonical = canonicalIdentity(entry.file, deps);
    if (!canonical) {
      issues.push(entry.file);
      continue;
    }
    const expected = state?.lastAutoAppliedOkfFiles?.[canonical];
    if (!expected) issues.push(entry.file);
    else {
      const actual = (await hashCanonical(deps))[canonical];
      if (actual !== expected) issues.push(entry.file);
    }
  }
  return [...new Set(issues)].sort();
}

function ownershipMap(state, before, after, candidates, stage10) {
  const existing = { ...(state?.lastAutoAppliedOkfFiles ?? {}) };
  for (const file of Object.keys(existing)) if (!CANONICAL_SET.has(file) || after[file] !== existing[file]) delete existing[file];
  const delta = changedCanonical(before, after);
  if (stage10.rollbackPerformed === true) {
    if (delta.length) throw new RunnerError('Stage 10 reported rollback but canonical OKF files changed.', 3, 'FATAL');
    return { map: existing, delta };
  }
  if (delta.length && ![0, 1].includes(stage10.exitCode)) throw new RunnerError('Canonical OKF files changed during a non-success/non-review Stage 10 result.', 3, 'FATAL');
  if (stage10.filesUpdated > 0 && !delta.length) throw new RunnerError('Stage 10 reported writes but no canonical filesystem delta was observed.', 3, 'FATAL');
  const candidateSet = new Set((candidates ?? []).map(normalize));
  if (delta.some(file => !candidateSet.has(file))) throw new RunnerError('Observed canonical OKF delta is outside Stage 10 AUTO_APPLY candidates.', 3, 'FATAL', { changedFiles: delta });
  if (delta.length && (stage10.postWriteValidationRun !== true || stage10.postWriteAgentSafe !== true || stage10.rollbackPerformed === true)) throw new RunnerError('Observed canonical OKF delta lacks validated post-write safety.', 3, 'FATAL');
  for (const file of delta) {
    if (!CANONICAL_SET.has(file) || !after[file]) throw new RunnerError(`Observed canonical OKF delta is not a valid existing file: ${file}`);
    existing[file] = after[file];
  }
  return { map: existing, delta };
}

async function acquireLock(deps) {
  if (deps.acquireLock) return deps.acquireLock();
  let canonical;
  try { canonical = await deps.fs.realpath(deps.paths.repoRoot); } catch { canonical = path.resolve(deps.paths.repoRoot); }
  const key = sha256(Buffer.from(canonical, 'utf8')).slice(0, 32);
  const lockFile = path.join(os.tmpdir(), `mano-okf-auto-${key}.lock`);
  const guardFile = path.join(os.tmpdir(), `mano-okf-auto-${key}.acquire.guard`);
  const token = crypto.randomBytes(18).toString('hex');
  const probe = pid => {
    try { process.kill(pid, 0); return { kind: 'live' }; }
    catch (error) { return error?.code === 'ESRCH' ? { kind: 'dead' } : { kind: 'indeterminate', code: error?.code ?? null, message: error?.message ?? 'unknown' }; }
  };
  const sameCanonical = value => {
    try {
      const left = path.resolve(value);
      const right = path.resolve(canonical);
      return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
    } catch { return false; }
  };
  const releaseGuard = await acquireAcquisitionGuard(deps, canonical, guardFile);
  const releasePrimary = async () => {
    try {
      const current = JSON.parse(await deps.fs.readFile(lockFile, 'utf8'));
      if (current.ownershipToken === token) await deps.fs.unlink(lockFile);
    } catch {}
  };
  try {
    for (;;) {
      try {
        const handle = await deps.fs.open(lockFile, 'wx');
        await handle.writeFile(JSON.stringify({ canonicalRepo: canonical, pid: process.pid, ownershipToken: token, startedAt: nowIso() }));
        await handle.close();
        try { await releaseGuard(); }
        catch (error) {
          await releasePrimary();
          throw error;
        }
        return releasePrimary;
      } catch (error) {
        if (error.code !== 'EEXIST') throw new RunnerError(`Unable to establish automatic runner ownership: ${error.message}`);
        let metadata;
        try { metadata = JSON.parse(await deps.fs.readFile(lockFile, 'utf8')); }
        catch (readError) { throw new RunnerError('Unreadable or malformed automatic runner lock; refusing to remove it.', 2, 'RERUN_REQUIRED', { lock: lockFile, reason: readError.message }); }
        if (!metadata || typeof metadata !== 'object' || !sameCanonical(metadata.canonicalRepo) || !Number.isInteger(metadata.pid) || metadata.pid <= 0 || typeof metadata.ownershipToken !== 'string' || !metadata.ownershipToken || typeof metadata.startedAt !== 'string' || Number.isNaN(Date.parse(metadata.startedAt))) throw new RunnerError('Invalid automatic runner lock metadata; refusing to remove it.', 2, 'RERUN_REQUIRED', { lock: lockFile });
        const result = (deps.probePid ?? probe)(metadata.pid);
        const kind = typeof result === 'string' ? result : result?.kind;
        if (kind === 'live') throw new RunnerError('Another automatic OKF runner is already running.', 2, 'RERUN_REQUIRED', { lock: lockFile, pid: metadata.pid });
        if (kind !== 'dead') throw new RunnerError('Unable to determine automatic runner lock owner liveness; refusing to reclaim it.', 2, 'RERUN_REQUIRED', { lock: lockFile, pid: metadata.pid, reason: result?.code ?? result?.message ?? 'indeterminate' });
        let current;
        try { current = JSON.parse(await deps.fs.readFile(lockFile, 'utf8')); }
        catch (readError) { throw new RunnerError('Automatic runner lock changed or became unreadable; refusing to remove it.', 2, 'RERUN_REQUIRED', { lock: lockFile, reason: readError.message }); }
        if (!current || current.canonicalRepo !== metadata.canonicalRepo || current.pid !== metadata.pid || current.ownershipToken !== metadata.ownershipToken || current.startedAt !== metadata.startedAt) throw new RunnerError('Automatic runner lock changed during stale-lock inspection; refusing to remove it.', 2, 'RERUN_REQUIRED', { lock: lockFile });
        try { await deps.fs.unlink(lockFile); }
        catch (unlinkError) { if (unlinkError.code !== 'ENOENT') throw new RunnerError('Unable to reclaim stale automatic runner lock.', 2, 'RERUN_REQUIRED', { lock: lockFile, reason: unlinkError.message }); }
      }
    }
  } catch (error) {
    try { await releaseGuard(); } catch (cleanupError) { throw cleanupError; }
    throw error;
  }
}

function validLockMetadata(metadata, canonical, sameCanonical) {
  return metadata && typeof metadata === 'object' && sameCanonical(metadata.canonicalRepo) && Number.isInteger(metadata.pid) && metadata.pid > 0 && typeof metadata.ownershipToken === 'string' && metadata.ownershipToken.length > 0 && typeof metadata.startedAt === 'string' && !Number.isNaN(Date.parse(metadata.startedAt));
}

function sameLockMetadata(a, b) {
  return a?.canonicalRepo === b?.canonicalRepo && a?.pid === b?.pid && a?.ownershipToken === b?.ownershipToken && a?.startedAt === b?.startedAt;
}

async function acquireAcquisitionGuard(deps, canonical, guardFile) {
  const reclaimFile = `${guardFile}.reclaim`;
  const reclaimPrefix = `${path.basename(reclaimFile)}.`;
  const probe = deps.probePid ?? (pid => {
    try { process.kill(pid, 0); return { kind: 'live' }; }
    catch (error) { return error?.code === 'ESRCH' ? { kind: 'dead' } : { kind: 'indeterminate', code: error?.code ?? null, message: error?.message ?? 'unknown' }; }
  });
  const sameCanonical = value => {
    try {
      const left = path.resolve(value);
      const right = path.resolve(canonical);
      return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
    } catch { return false; }
  };
  const metadataFor = token => ({ canonicalRepo: canonical, pid: process.pid, ownershipToken: token, startedAt: nowIso() });
  const writeLease = async file => {
    const token = crypto.randomBytes(18).toString('hex');
    const metadata = metadataFor(token);
    let handle;
    let created = false;
    try {
      handle = await deps.fs.open(file, 'wx');
      created = true;
      await handle.writeFile(JSON.stringify(metadata));
      await handle.close();
      return { file, token, metadata };
    } catch (error) {
      try { await handle?.close(); } catch {}
      if (created) { try { await deps.fs.unlink(file); } catch {} }
      if (error.code === 'EEXIST') return null;
      throw new RunnerError(`Unable to establish automatic runner reclaim lease: ${error.message}`);
    }
  };
  const releaseLease = lease => async () => {
    let current;
    try { current = JSON.parse(await deps.fs.readFile(lease.file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return; throw new RunnerError(`Unable to verify automatic runner reclaim lease: ${error.message}`); }
    if (current.ownershipToken !== lease.token) throw new RunnerError('Automatic runner reclaim lease ownership changed; refusing to remove it.');
    try { await deps.fs.unlink(lease.file); }
    catch (error) { if (error.code !== 'ENOENT') throw new RunnerError(`Unable to release automatic runner reclaim lease: ${error.message}`); }
  };
  const readCandidate = async file => {
    let raw;
    let metadata;
    try { raw = await deps.fs.readFile(file, 'utf8'); metadata = JSON.parse(raw); }
    catch (error) { throw new RunnerError('Unreadable or malformed automatic runner acquisition guard; refusing to remove it.', 2, 'RERUN_REQUIRED', { guard: file, reason: error.message }); }
    if (!validLockMetadata(metadata, canonical, sameCanonical)) throw new RunnerError('Invalid automatic runner acquisition guard metadata; refusing to remove it.', 2, 'RERUN_REQUIRED', { guard: file });
    const result = probe(metadata.pid);
    const kind = typeof result === 'string' ? result : result?.kind;
    return { raw, metadata, kind, result };
  };
  const inspectCandidate = async file => {
    const inspected = await readCandidate(file);
    if (inspected.kind === 'live') throw new RunnerError('Another automatic runner is acquiring the repository lock.', 2, 'RERUN_REQUIRED', { guard: file, pid: inspected.metadata.pid });
    if (inspected.kind !== 'dead') throw new RunnerError('Unable to determine automatic runner acquisition guard liveness; refusing to reclaim it.', 2, 'RERUN_REQUIRED', { guard: file, pid: inspected.metadata.pid, reason: inspected.result?.code ?? inspected.result?.message ?? 'indeterminate' });
    return inspected;
  };
  const takeoverArtifacts = async () => {
    let entries = [];
    try { entries = await deps.fs.readdir(path.dirname(reclaimFile), { withFileTypes: true }); }
    catch (error) { if (error.code !== 'ENOENT') throw new RunnerError(`Unable to inspect automatic runner reclaim artifacts: ${error.message}`); }
    return entries
      .filter(entry => entry.isFile() && entry.name.startsWith(reclaimPrefix) && entry.name.endsWith('.takeover'))
      .map(entry => path.join(path.dirname(reclaimFile), entry.name))
      .sort();
  };
  const removeDeadTakeover = async (file, inspected) => {
    let current;
    try { current = JSON.parse(await deps.fs.readFile(file, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return false;
      throw new RunnerError('Automatic runner reclaim artifact changed or became unreadable; refusing to remove it.', 2, 'RERUN_REQUIRED', { guard: file, reason: error.message });
    }
    if (!sameLockMetadata(current, inspected.metadata)) throw new RunnerError('Automatic runner reclaim artifact changed during stale inspection; refusing to remove it.', 2, 'RERUN_REQUIRED', { guard: file });
    try { await deps.fs.unlink(file); }
    catch (error) {
      if (error.code === 'ENOENT') return false;
      throw new RunnerError(`Unable to reclaim automatic runner artifact: ${error.message}`, 2, 'RERUN_REQUIRED', { guard: file, reason: error.message });
    }
    return true;
  };
  const inspectTakeoverSet = async () => {
    const live = [];
    for (const file of await takeoverArtifacts()) {
      const inspected = await readCandidate(file);
      if (inspected.kind === 'live') {
        live.push({ file, ...inspected });
        continue;
      }
      if (inspected.kind !== 'dead') throw new RunnerError('Unable to determine automatic runner reclaim artifact owner liveness; refusing to reclaim it.', 2, 'RERUN_REQUIRED', { guard: file, pid: inspected.metadata.pid, reason: inspected.result?.code ?? inspected.result?.message ?? 'indeterminate' });
      await removeDeadTakeover(file, inspected);
    }
    return live.sort((left, right) => {
      const a = path.basename(left.file);
      const b = path.basename(right.file);
      return a < b ? -1 : a > b ? 1 : 0;
    });
  };
  const claimFile = () => `${reclaimFile}.${crypto.randomBytes(18).toString('hex')}.takeover`;
  const releaseCombined = async (fixed, own) => {
    if (own) await releaseLease(own)();
    if (fixed) await releaseLease(fixed)();
  };
  const acquireReclaimLease = async () => {
    let fixed = await writeLease(reclaimFile);
    let own = null;
    if (fixed) {
      try {
        let live = await inspectTakeoverSet();
        if (live.length) throw new RunnerError('Another automatic runner reclaim leader is already active.', 2, 'RERUN_REQUIRED', { guard: live[0].file, pid: live[0].metadata.pid });
        own = await writeLease(claimFile());
        if (!own) throw new RunnerError('Unable to establish automatic runner reclaim claim.', 2, 'RERUN_REQUIRED');
        live = await inspectTakeoverSet();
        const leader = live[0];
        if (!leader || leader.file !== own.file) throw new RunnerError('Another automatic runner reclaim leader won the election.', 2, 'RERUN_REQUIRED', { guard: leader?.file ?? null });
        return { ...own, release: async () => releaseCombined(fixed, own) };
      } catch (error) {
        try { await releaseCombined(fixed, own); } catch (cleanupError) { throw cleanupError; }
        throw error;
      }
    }

    const fixedInspection = await inspectCandidate(reclaimFile);
    let live = await inspectTakeoverSet();
    if (live.length) throw new RunnerError('Another automatic runner reclaim leader is already active.', 2, 'RERUN_REQUIRED', { guard: live[0].file, pid: live[0].metadata.pid });
    own = await writeLease(claimFile());
    if (!own) return acquireReclaimLease();
    try {
      live = await inspectTakeoverSet();
      const leader = live[0];
      if (!leader || leader.file !== own.file) throw new RunnerError('Another automatic runner reclaim leader won the election.', 2, 'RERUN_REQUIRED', { guard: leader?.file ?? null });
      let current;
      try { current = JSON.parse(await deps.fs.readFile(reclaimFile, 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return { ...own, release: releaseLease(own) }; throw new RunnerError(`Unable to recheck automatic runner reclaim marker: ${error.message}`, 2, 'RERUN_REQUIRED', { guard: reclaimFile, reason: error.message }); }
      if (!sameLockMetadata(current, fixedInspection.metadata)) throw new RunnerError('Automatic runner reclaim marker changed during stale inspection; refusing to remove it.', 2, 'RERUN_REQUIRED', { guard: reclaimFile });
      try { await deps.fs.unlink(reclaimFile); }
      catch (error) { if (error.code !== 'ENOENT') throw new RunnerError(`Unable to reclaim automatic runner reclaim marker: ${error.message}`, 2, 'RERUN_REQUIRED', { guard: reclaimFile, reason: error.message }); }
      return { ...own, release: releaseLease(own) };
    } catch (error) {
      try { await releaseLease(own)(); } catch (cleanupError) { throw cleanupError; }
      throw error;
    }
  };
  const lease = await acquireReclaimLease();
  const token = crypto.randomBytes(18).toString('hex');
  const metadata = metadataFor(token);
  let guardCreated = false;
  const releaseGuard = async () => {
    if (!guardCreated) return;
    guardCreated = false;
    let current;
    try { current = JSON.parse(await deps.fs.readFile(guardFile, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return; throw new RunnerError(`Unable to verify owned automatic runner guard: ${error.message}`); }
    if (current.ownershipToken !== token) throw new RunnerError('Automatic runner acquisition guard ownership changed; refusing to remove another owner.');
    try { await deps.fs.unlink(guardFile); }
    catch (error) { if (error.code !== 'ENOENT') throw new RunnerError(`Unable to release owned automatic runner guard: ${error.message}`); }
  };
  try {
    for (;;) {
      try {
        const handle = await deps.fs.open(guardFile, 'wx');
        await handle.writeFile(JSON.stringify(metadata));
        await handle.close();
        guardCreated = true;
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw new RunnerError(`Unable to establish automatic runner acquisition guard: ${error.message}`);
        const inspected = await inspectCandidate(guardFile);
        let current;
        try { current = JSON.parse(await deps.fs.readFile(guardFile, 'utf8')); }
        catch (readError) { if (readError.code === 'ENOENT') continue; throw new RunnerError(`Unable to recheck automatic runner acquisition guard: ${readError.message}`); }
        if (!sameLockMetadata(current, inspected.metadata)) continue;
        try { await deps.fs.unlink(guardFile); }
        catch (unlinkError) { if (unlinkError.code !== 'ENOENT') throw new RunnerError(`Unable to reclaim stale automatic runner acquisition guard: ${unlinkError.message}`); }
      }
    }
    try { await lease.release(); }
    catch (error) { await releaseGuard(); throw error; }
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      await releaseGuard();
    };
  } catch (error) {
    try { await releaseGuard(); } catch (cleanupError) { throw cleanupError; }
    try { await lease.release(); } catch (cleanupError) { throw cleanupError; }
    throw error;
  }
}

async function validateHeadAndBaseline(deps, baseline) {
  let head;
  try { head = deps.git.head(); } catch (error) { throw new RunnerError('Current HEAD is unavailable.', 2, 'SOURCE_BASELINE_UNAVAILABLE', error.details); }
  if (!head) throw new RunnerError('Current HEAD is unavailable.', 2, 'SOURCE_BASELINE_UNAVAILABLE');
  if (!validCommit(baseline)) throw new RunnerError('Stored source baseline is unavailable.', 2, 'SOURCE_BASELINE_UNAVAILABLE');
  try { deps.git.commit(baseline); } catch (error) { throw new RunnerError('Stored source baseline is unavailable.', 2, 'SOURCE_BASELINE_UNAVAILABLE', error.details); }
  if (!deps.git.isAncestor(baseline, head)) throw new RunnerError('Stored source baseline diverged from current HEAD.', 2, 'SOURCE_BASELINE_DIVERGED', { baseline, head });
  return head;
}

function baseState(baseline, head, attemptAt, nextDueAt, prior = {}) {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    baselineCommit: baseline,
    lastObservedHead: head,
    lastAttemptAt: attemptAt,
    lastCompletedAt: prior.lastCompletedAt ?? null,
    nextDueAt,
    lastExitCode: null,
    lastStatus: 'RUNNING',
    lastAutoAppliedOkfFiles: { ...(prior.lastAutoAppliedOkfFiles ?? {}) },
    lastStage10Summary: null
  };
}

async function bootstrap(options, deps, now, unlock) {
  const summary = emptySummary('bootstrap', now);
  try {
    const state = await readState(deps);
    if (state?.baselineCommit) throw new RunnerError('Auto-runner baseline already exists.', 2, 'AUTO_BASELINE_EXISTS');
    const issues = await checkoutIssues(deps, state);
    if (issues.length) throw new RunnerError('Automation checkout is dirty.', 2, 'AUTOMATION_CHECKOUT_DIRTY', { files: issues });
    const head = deps.git.head();
    const validation = await deps.validateBootstrap({ verbose: options.verbose });
    if (validation?.exitCode !== 0 || validation?.postWriteAgentSafe !== true) throw new RunnerError('Current OKF bundle is not agent-safe for bootstrap.', 2, 'AUTO_BASELINE_REQUIRED', { stage9: validation });
    const nextDue = new Date(now.getTime() + INTERVAL_MS).toISOString();
    const next = { schemaVersion: STATE_SCHEMA_VERSION, baselineCommit: head, lastObservedHead: head, lastAttemptAt: null, lastCompletedAt: null, nextDueAt: nextDue, lastExitCode: 0, lastStatus: 'BOOTSTRAPPED', lastAutoAppliedOkfFiles: {}, lastStage10Summary: null };
    await writeStateAtomic(deps, next);
    return { ...summary, due: false, baselineCommit: head, headCommit: head, nextDueAt: nextDue, stateWritten: true, finalStatus: 'BOOTSTRAPPED', exitCode: 0 };
  } finally { await unlock?.(); }
}

export async function runAutoUpdate(inputOptions = {}, providedDeps = null) {
  const options = { bootstrap: false, verbose: false, ...inputOptions };
  const deps = { ...makeRealDependencies(), ...(providedDeps ?? {}) };
  deps.paths = { ...pathsFor(REPO_ROOT), ...(providedDeps?.paths ?? {}) };
  const now = toNow(deps);
  let unlock = null;
  try {
    unlock = await acquireLock(deps);
    if (options.bootstrap) return await bootstrap(options, deps, now, unlock);
    const summary = emptySummary('routine', now);
    const state = await readState(deps);
    if (!state || !state.baselineCommit) throw new RunnerError('Automatic baseline is required.', 2, 'AUTO_BASELINE_REQUIRED');
    summary.baselineCommit = state.baselineCommit;
    summary.lastAttemptAt = state.lastAttemptAt;
    summary.nextDueAt = state.nextDueAt;
    const head = deps.git.head();
    summary.headCommit = head;
    summary.sourceRange = `${state.baselineCommit}..${head}`;
    if (!state.nextDueAt || now.getTime() < new Date(state.nextDueAt).getTime()) return { ...summary, finalStatus: 'NOT_DUE', exitCode: 0 };
    summary.due = true;
    const validatedHead = await validateHeadAndBaseline(deps, state.baselineCommit);
    const issues = await checkoutIssues(deps, state);
    if (issues.length) throw new RunnerError('Automation checkout is dirty.', 2, 'AUTOMATION_CHECKOUT_DIRTY', { files: issues });
    const attemptAt = now.toISOString();
    const nextDueAt = new Date(now.getTime() + INTERVAL_MS).toISOString();
    const running = baseState(state.baselineCommit, validatedHead, attemptAt, nextDueAt, state);
    await writeStateAtomic(deps, running);
    summary.stateWritten = true;
    summary.lastAttemptAt = attemptAt;
    summary.nextDueAt = nextDueAt;
    const before = await hashCanonical(deps);
    let stage10;
    try { stage10 = await deps.runStage10({ verbose: options.verbose, since: state.baselineCommit }); }
    catch (error) { throw new RunnerError(`Stage 10 execution failed: ${error.message}`, 3, 'FATAL'); }
    if (!stage10 || !Number.isInteger(stage10.exitCode)) throw new RunnerError('Stage 10 produced malformed output.');
    const after = await hashCanonical(deps);
    const reconciled = ownershipMap({ ...state, lastAutoAppliedOkfFiles: running.lastAutoAppliedOkfFiles }, before, after, stage10.autoApplyFiles, { ...stage10, filesUpdated: Number(stage10.filesUpdated ?? 0) });
    let finalStatus = stage10.finalStatus || (stage10.exitCode === 0 ? 'SUCCESS' : stage10.exitCode === 1 ? 'HUMAN_REVIEW' : stage10.exitCode === 2 ? 'RERUN_REQUIRED' : 'FATAL');
    let finalExit = stage10.exitCode === 0 ? 0 : stage10.exitCode === 1 ? 1 : stage10.exitCode === 2 ? 2 : 3;
    let baseline = state.baselineCommit;
    let advanced = false;
    if (stage10.exitCode === 0 && reconciled.delta.length) {
      if (typeof deps.persistCanonical !== 'function') {
        finalStatus = 'PERSISTENCE_REQUIRED'; finalExit = 2;
      } else {
        let persisted = false;
        try { persisted = (await deps.persistCanonical({ files: reconciled.delta, hashes: after, stage10, baselineCommit: state.baselineCommit, headCommit: validatedHead })) === true; } catch (error) { summary.errors.push(`Canonical OKF persistence failed: ${error.message}`); }
        if (!persisted) { finalStatus = 'PERSISTENCE_REQUIRED'; finalExit = 2; }
        else { baseline = validatedHead; advanced = true; }
      }
    } else if (stage10.exitCode === 0) {
      baseline = validatedHead; advanced = true;
    }
    const completedAt = toNow(deps).toISOString();
    const nextState = { ...running, baselineCommit: baseline, lastObservedHead: validatedHead, lastCompletedAt: completedAt, lastExitCode: finalExit, lastStatus: finalStatus, lastAutoAppliedOkfFiles: reconciled.map, lastStage10Summary: { finalStatus: stage10.finalStatus ?? null, exitCode: stage10.exitCode, filesUpdated: stage10.filesUpdated ?? 0, autoApplyFiles: stage10.autoApplyFiles ?? [], rollbackPerformed: stage10.rollbackPerformed === true } };
    await writeStateAtomic(deps, nextState);
    return { ...summary, baselineCommit: state.baselineCommit, headCommit: validatedHead, sourceRange: `${state.baselineCommit}..${validatedHead}`, stage10Executed: true, stage10ExitCode: stage10.exitCode, stage10FinalStatus: stage10.finalStatus ?? null, baselineAdvanced: advanced, newBaselineCommit: advanced ? validatedHead : state.baselineCommit, stateWritten: true, warnings: stage10.warnings ?? [], errors: [...summary.errors, ...(stage10.errors ?? [])], finalStatus, exitCode: finalExit };
  } catch (error) {
    const e = error instanceof RunnerError ? error : new RunnerError(error.message ?? String(error));
    const result = emptySummary(options.bootstrap ? 'bootstrap' : 'routine', now, { finalStatus: e.status, exitCode: e.code, errors: [e.message] });
    if (e.details?.baseline) result.baselineCommit = e.details.baseline;
    if (e.details?.head) result.headCommit = e.details.head;
    if (e.details?.files) result.errors.push(`files: ${e.details.files.join(', ')}`);
    result.runnerFatal = e.runnerFatal === true;
    return result;
  } finally { if (unlock && !options.bootstrap) await unlock(); }
}

async function sleep(ms) {
  if (ms > 0) await new Promise(resolve => setTimeout(resolve, ms));
}

async function daemon(options) {
  for (;;) {
    const result = await runAutoUpdate(options);
    console.log(JSON.stringify(result));
    if (result.runnerFatal) return 3;
    const waitUntil = result.nextDueAt ? new Date(result.nextDueAt).getTime() : Date.now() + INTERVAL_MS;
    await sleep(Math.max(0, waitUntil - Date.now()));
  }
}

function parseArgs(args) {
  const options = { bootstrap: false, daemon: false, verbose: false };
  for (const arg of args) {
    if (arg === '--bootstrap') { if (options.bootstrap) throw new RunnerError('Duplicate --bootstrap.'); options.bootstrap = true; }
    else if (arg === '--daemon') { if (options.daemon) throw new RunnerError('Duplicate --daemon.'); options.daemon = true; }
    else if (arg === '--verbose') { if (options.verbose) throw new RunnerError('Duplicate --verbose.'); options.verbose = true; }
    else throw new RunnerError(`Unknown argument: ${arg}`);
  }
  if (options.bootstrap && options.daemon) throw new RunnerError('--bootstrap cannot be combined with --daemon.', 2, 'AUTO_BASELINE_REQUIRED');
  return options;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.daemon) process.exitCode = await daemon(options);
    else {
      const result = await runAutoUpdate(options);
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.exitCode;
    }
  } catch (error) {
    console.error(`Fatal Error: ${error.message}`);
    process.exitCode = error.code ?? 3;
  }
}

export {
  CANONICAL_OKFS,
  INTERVAL_MS,
  STATE_SCHEMA_VERSION,
  RunnerError,
  makeRealDependencies,
  parseArgs,
  pathsFor,
  validateState,
  hashCanonical,
  changedCanonical,
  ownershipMap,
  parseStatus,
  canonicalIdentity,
  acquireLock,
  acquireAcquisitionGuard
};
