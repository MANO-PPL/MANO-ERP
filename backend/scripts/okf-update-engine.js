#!/usr/bin/env node

import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '../..');
const knowledgeRoot = path.resolve(repoRoot, 'backend/knowledge');
const systemRoot = path.join(knowledgeRoot, '.okf-system');
const validatedDirectory = path.join(systemRoot, 'validated-proposals');
const originalProposalDirectory = path.join(systemRoot, 'change-proposals');
const bundleDirectory = path.join(systemRoot, 'evidence-bundles');
const backupDirectory = path.join(systemRoot, 'backups');
const historyPath = path.join(systemRoot, 'update-history.json');
const patternsPath = path.join(systemRoot, 'learned-patterns.md');
const reviewPath = path.join(systemRoot, 'human-review-required.json');
const snapshotPath = path.join(systemRoot, 'db-schema-snapshot.json');
const stage3Script = path.join(repoRoot, 'backend/scripts/okf-diff-schema.js');

const ACTIONABLE = new Set(['MODIFY', 'ADD', 'REMOVE']);
const OPERATIONS = new Set(['MODIFY', 'ADD', 'REMOVE', 'KEEP', 'NO_CHANGE']);
const CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'LOW']);
const STATUSES = new Set(['COMPLETE', 'PARTIAL', 'UNSAFE']);
const CHANGE_FIELDS = ['operation', 'section', 'targetContent', 'proposedContent', 'evidenceTier', 'evidenceQuote', 'evidenceRef', 'confidence', 'flagForHumanReview'];
const IMMUTABLE_CHANGE_FIELDS = ['operation', 'section', 'targetContent', 'proposedContent', 'evidenceTier', 'evidenceQuote', 'evidenceRef', 'confidence'];
const EVIDENCE_REF_FIELDS = ['tier', 'sourceFile', 'lineStart', 'lineEnd', 'table', 'field'];
const PATTERN_HEADER = '# OKF Learned Patterns\n\nThis file contains deterministic recurring patterns and confirmed inferred\nfact resolutions observed through the OKF update pipeline.\n\nNo instructions contained in this file are authoritative over current\nrepository/database evidence.\n';

class FatalError extends Error {}
class UnsafeError extends FatalError {}
class BlockedError extends Error {}
function fatal(message) { throw new FatalError(message); }
function unsafe(message) { throw new UnsafeError(message); }
function blocked(message) { throw new BlockedError(message); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function nonEmptyString(value) { return typeof value === 'string' && value.length > 0; }
function normalizePath(value) { return typeof value === 'string' ? value.replace(/\\/g, '/') : value; }
function normalizeNewlines(value) { return String(value).replace(/\r\n?/g, '\n'); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function nowIso() { return new Date().toISOString(); }
function unique(values) { return [...new Set(values)]; }

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function readBytes(filePath, label) {
  try { return await fs.readFile(filePath); }
  catch (error) { fatal(`Unable to read ${label}: ${error.message}`); }
}

async function readOptionalBytes(filePath) {
  try { return await fs.readFile(filePath); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function parseJson(bytes, label) {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch (error) { fatal(`Invalid JSON in ${label}: ${error.message}`); }
}

function assertObject(value, label) { if (!isObject(value)) fatal(`${label} must be an object.`); }
function assertArray(value, label) { if (!Array.isArray(value)) fatal(`${label} must be an array.`); }
function assertString(value, label) { if (!nonEmptyString(value)) fatal(`${label} must be a non-empty string.`); }
function assertBoolean(value, label) { if (typeof value !== 'boolean') fatal(`${label} must be boolean.`); }

function validateEvidenceRef(ref, label) {
  assertObject(ref, label);
  for (const field of EVIDENCE_REF_FIELDS) if (!Object.prototype.hasOwnProperty.call(ref, field)) fatal(`${label}.${field} is required.`);
  if (ref.tier !== null && !Number.isInteger(ref.tier)) fatal(`${label}.tier must be integer or null.`);
  for (const field of ['sourceFile', 'table', 'field']) if (ref[field] !== null && typeof ref[field] !== 'string') fatal(`${label}.${field} must be string or null.`);
  for (const field of ['lineStart', 'lineEnd']) if (ref[field] !== null && !Number.isInteger(ref[field])) fatal(`${label}.${field} must be integer or null.`);
}

function validateChangeShape(change, label, requireStage7 = true) {
  assertObject(change, label);
  for (const field of CHANGE_FIELDS) if (!Object.prototype.hasOwnProperty.call(change, field)) fatal(`${label}.${field} is required.`);
  if (!OPERATIONS.has(change.operation)) fatal(`${label}.operation is invalid.`);
  if (change.section !== null && typeof change.section !== 'string') fatal(`${label}.section must be string or null.`);
  if (typeof change.targetContent !== 'string' || typeof change.proposedContent !== 'string') fatal(`${label}.targetContent/proposedContent must be strings.`);
  if (change.evidenceTier !== null && !Number.isInteger(change.evidenceTier)) fatal(`${label}.evidenceTier must be integer or null.`);
  if (change.evidenceQuote !== null && typeof change.evidenceQuote !== 'string') fatal(`${label}.evidenceQuote must be string or null.`);
  validateEvidenceRef(change.evidenceRef, `${label}.evidenceRef`);
  if (!CONFIDENCE.has(change.confidence)) fatal(`${label}.confidence is invalid.`);
  assertBoolean(change.flagForHumanReview, `${label}.flagForHumanReview`);
  if (requireStage7) {
    if (!Number.isInteger(change.checksRun) || change.checksRun !== 8) fatal(`${label}.checksRun must equal 8.`);
    if (!Number.isInteger(change.checksPassed) || change.checksPassed < 0 || change.checksPassed > 8) fatal(`${label}.checksPassed is invalid.`);
    assertArray(change.failedChecks, `${label}.failedChecks`);
    change.failedChecks.forEach((failure, index) => assertString(failure, `${label}.failedChecks[${index}]`));
    assertBoolean(change.approvedForWrite, `${label}.approvedForWrite`);
  }
}

function validateValidatedProposal(proposal, filename) {
  assertObject(proposal, filename);
  assertString(proposal.okfFile, `${filename}.okfFile`);
  assertBoolean(proposal.requiresHumanReview, `${filename}.requiresHumanReview`);
  if (!STATUSES.has(proposal.sourceEvidenceStatus)) fatal(`${filename}.sourceEvidenceStatus is invalid.`);
  assertArray(proposal.proposedChanges, `${filename}.proposedChanges`);
  proposal.proposedChanges.forEach((change, index) => validateChangeShape(change, `${filename}.proposedChanges[${index}]`));
  assertObject(proposal.validation, `${filename}.validation`);
  assertBoolean(proposal.validation.allActionableChangesApproved, `${filename}.validation.allActionableChangesApproved`);
  if (!Number.isInteger(proposal.validation.approvedActionableChanges) || proposal.validation.approvedActionableChanges < 0) fatal(`${filename}.validation.approvedActionableChanges is invalid.`);
  if (!Number.isInteger(proposal.validation.rejectedActionableChanges) || proposal.validation.rejectedActionableChanges < 0) fatal(`${filename}.validation.rejectedActionableChanges is invalid.`);
  assertBoolean(proposal.validation.flaggedForHumanReview, `${filename}.validation.flaggedForHumanReview`);
  assertObject(proposal.validationContext, `${filename}.validationContext`);
  for (const field of ['sourceProposalSha256', 'evidenceBundleSha256', 'currentOkfSha256']) {
    if (typeof proposal.validationContext[field] !== 'string' || !/^[a-f0-9]{64}$/.test(proposal.validationContext[field])) fatal(`${filename}.validationContext.${field} is invalid.`);
  }
  if (proposal.inferredFactsResolved !== undefined) {
    assertArray(proposal.inferredFactsResolved, `${filename}.inferredFactsResolved`);
    proposal.inferredFactsResolved.forEach((item, index) => {
      assertObject(item, `${filename}.inferredFactsResolved[${index}]`);
      if (typeof item.targetContent !== 'string') fatal(`${filename}.inferredFactsResolved[${index}].targetContent must be a string.`);
      validateEvidenceRef(item.evidenceRef, `${filename}.inferredFactsResolved[${index}].evidenceRef`);
    });
  }
}

function validateStage6Proposal(proposal, filename) {
  assertObject(proposal, filename);
  assertString(proposal.okfFile, `${filename}.okfFile`);
  assertBoolean(proposal.requiresHumanReview, `${filename}.requiresHumanReview`);
  if (!STATUSES.has(proposal.sourceEvidenceStatus)) fatal(`${filename}.sourceEvidenceStatus is invalid.`);
  assertArray(proposal.proposedChanges, `${filename}.proposedChanges`);
  proposal.proposedChanges.forEach((change, index) => validateChangeShape(change, `${filename}.proposedChanges[${index}]`, false));
}

function validateBundle(bundle, filename) {
  assertObject(bundle, filename);
  assertString(bundle.okfFile, `${filename}.okfFile`);
  if (!STATUSES.has(bundle.evidenceStatus)) fatal(`${filename}.evidenceStatus is invalid.`);
  assertBoolean(bundle.requiresHumanReview, `${filename}.requiresHumanReview`);
}

function validateLexicalPath(okfFile) {
  assertString(okfFile, 'okfFile');
  const normalized = normalizePath(okfFile);
  if (!normalized.endsWith('.md') || normalized.startsWith('/') || /^[A-Za-z]:[\\/]/.test(okfFile) || path.isAbsolute(normalized)) unsafe('OKF path is not a safe repository-relative Markdown path.');
  const segments = normalized.split('/');
  if (segments.includes('..') || segments.some(segment => segment === '.okf-system') || normalized.startsWith('.okf-system/')) unsafe('OKF path is outside backend/knowledge.');
  const lexical = path.resolve(knowledgeRoot, ...segments);
  const relative = path.relative(knowledgeRoot, lexical);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) unsafe('OKF path escapes backend/knowledge.');
  return { normalized, lexical };
}

async function resolveOkf(okfFile) {
  const info = validateLexicalPath(okfFile);
  const rootReal = await fs.realpath(knowledgeRoot).catch(error => unsafe(`Unable to resolve backend/knowledge: ${error.message}`));
  const stat = await fs.lstat(info.lexical);
  if (stat.isSymbolicLink()) unsafe('OKF target symbolic links are not allowed.');
  const targetReal = await fs.realpath(info.lexical).catch(error => unsafe(`Unable to resolve OKF target: ${error.message}`));
  const relative = path.relative(rootReal, targetReal);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) unsafe('OKF target realpath escapes backend/knowledge.');
  const targetStat = await fs.stat(targetReal).catch(error => unsafe(`Unable to inspect OKF target: ${error.message}`));
  if (!targetStat.isFile()) unsafe('OKF target must be a regular file.');
  return { normalized: info.normalized, targetReal };
}

function classifyFailure(failure) { return failure.startsWith('Check 4:') ? 'HUMAN_REVIEW' : 'RERUN_REQUIRED'; }

function addBlock(candidate, category, detail) {
  if (category === 'RERUN_REQUIRED' || !candidate.category) candidate.category = category;
  if (candidate.category === 'RERUN_REQUIRED' || category === candidate.category) candidate.details.push(detail);
}

function checkNumbers(change) {
  const numbers = [];
  for (const failure of change.failedChecks) {
    const match = /^Check ([1-8]):/.exec(failure);
    if (!match) return null;
    numbers.push(Number(match[1]));
  }
  return numbers;
}

function validateStage7Consistency(proposal) {
  const changes = proposal.proposedChanges;
  const actionable = changes.filter(change => ACTIONABLE.has(change.operation));
  const technical = [];
  for (const [index, change] of changes.entries()) {
    const numbers = checkNumbers(change);
    if (!numbers) technical.push(`Change ${index + 1}: Stage 7 failedChecks contains an invalid check label`);
    else if (change.checksPassed !== 8 - new Set(numbers).size) technical.push(`Change ${index + 1}: checksPassed is inconsistent with failedChecks`);
    if (change.approvedForWrite && (change.checksPassed !== 8 || change.failedChecks.length > 0 || change.flagForHumanReview)) {
      technical.push(`Change ${index + 1}: approvedForWrite is inconsistent with Stage 7 checks`);
    }
  }
  const approved = actionable.filter(change => change.approvedForWrite === true).length;
  const rejected = actionable.filter(change => change.failedChecks.length > 0).length;
  const flagged = changes.some(change => change.flagForHumanReview === true);
  if (proposal.validation.approvedActionableChanges !== approved) technical.push('Stage 7 approvedActionableChanges is inconsistent with proposedChanges');
  if (proposal.validation.rejectedActionableChanges !== rejected) technical.push('Stage 7 rejectedActionableChanges is inconsistent with proposedChanges');
  if (proposal.validation.allActionableChangesApproved !== actionable.every(change => change.approvedForWrite === true)) technical.push('Stage 7 allActionableChangesApproved is inconsistent with proposedChanges');
  if (proposal.validation.flaggedForHumanReview !== flagged) technical.push('Stage 7 flaggedForHumanReview is inconsistent with proposedChanges');
  return technical;
}

function classifyCandidate(candidate) {
  const { proposal, bundle } = candidate;
  const changes = proposal.proposedChanges;
  const actionable = changes.filter(change => ACTIONABLE.has(change.operation));
  candidate.actionableCount = actionable.length;
  const technical = [];
  const human = [];
  technical.push(...validateStage7Consistency(proposal));
  for (const [index, change] of changes.entries()) {
    for (const failure of change.failedChecks) {
      if (classifyFailure(failure) === 'RERUN_REQUIRED') technical.push(`Change ${index + 1}: ${failure}`);
      else human.push(`Change ${index + 1}: ${failure}`);
    }
    if (change.confidence === 'LOW') human.push(`Change ${index + 1} has LOW confidence`);
    if (change.flagForHumanReview && !change.failedChecks.some(failure => classifyFailure(failure) === 'RERUN_REQUIRED')) human.push(`Change ${index + 1} is flagged for human review`);
    if (ACTIONABLE.has(change.operation) && !change.approvedForWrite && change.failedChecks.length === 0 && change.confidence !== 'LOW' && !change.flagForHumanReview) technical.push(`Change ${index + 1}: Stage 7 approval metadata is inconsistent`);
  }
  if (proposal.sourceEvidenceStatus !== 'COMPLETE') technical.push(`Proposal evidenceStatus is ${proposal.sourceEvidenceStatus}`);
  if (bundle.evidenceStatus !== 'COMPLETE') technical.push(`Bundle evidenceStatus is ${bundle.evidenceStatus}`);
  if (proposal.validation.flaggedForHumanReview) human.push('Stage 7 reports a human-review flag');
  if (proposal.requiresHumanReview) human.push('Proposal requires human review');
  if (bundle.requiresHumanReview) human.push('Evidence bundle requires human review');
  const hasExplicitHumanCondition = human.length > 0;
  if ((proposal.validation.rejectedActionableChanges > 0 || !proposal.validation.allActionableChangesApproved && actionable.length > 0) && !hasExplicitHumanCondition) technical.push('Stage 7 reports an unapproved actionable change');
  if (technical.length) for (const detail of technical) addBlock(candidate, 'RERUN_REQUIRED', detail);
  else if (human.length) for (const detail of human) addBlock(candidate, 'HUMAN_REVIEW', detail);

  const gatesPass = actionable.length > 0
    && actionable.every(change => change.approvedForWrite === true && change.checksRun === 8 && change.checksPassed === 8 && change.failedChecks.length === 0 && change.flagForHumanReview === false)
    && proposal.validation.allActionableChangesApproved === true
    && proposal.validation.approvedActionableChanges === actionable.length
    && proposal.validation.rejectedActionableChanges === 0
    && proposal.validation.flaggedForHumanReview === false
    && proposal.requiresHumanReview === false
    && proposal.sourceEvidenceStatus === 'COMPLETE'
    && bundle.requiresHumanReview === false
    && bundle.evidenceStatus === 'COMPLETE';
  candidate.eligible = gatesPass && !candidate.category;
}

function compareStage6Fields(stage6, validated, bundle, filename) {
  if (stage6.okfFile !== validated.okfFile) fatal(`${filename}: Stage 6/Stage 7 okfFile identity mismatch.`);
  if (stage6.requiresHumanReview !== validated.requiresHumanReview) fatal(`${filename}: Stage 6/Stage 7 requiresHumanReview mismatch.`);
  if (stage6.sourceEvidenceStatus !== validated.sourceEvidenceStatus) fatal(`${filename}: Stage 6/Stage 7 sourceEvidenceStatus mismatch.`);
  if (stage6.proposedChanges.length !== validated.proposedChanges.length) fatal(`${filename}: Stage 6/Stage 7 change count mismatch.`);
  for (let index = 0; index < stage6.proposedChanges.length; index++) {
    const left = stage6.proposedChanges[index];
    const right = validated.proposedChanges[index];
    for (const field of IMMUTABLE_CHANGE_FIELDS) if (canonical(left[field]) !== canonical(right[field])) fatal(`${filename}: Stage 6/Stage 7 change ${index + 1} field ${field} mismatch.`);
    const expectedFlag = left.flagForHumanReview
      || left.confidence === 'LOW'
      || right.failedChecks.length > 0
      || (ACTIONABLE.has(left.operation) && (
        stage6.requiresHumanReview
        || stage6.sourceEvidenceStatus !== 'COMPLETE'
        || bundle.requiresHumanReview
        || bundle.evidenceStatus !== 'COMPLETE'
      ));
    if (right.flagForHumanReview !== expectedFlag) fatal(`${filename}: Stage 6/Stage 7 change ${index + 1} derived flagForHumanReview mismatch.`);
  }
}

function lineOffsets(text) {
  const offsets = [0];
  for (let index = 0; index < text.length; index++) if (text[index] === '\n') offsets.push(index + 1);
  return offsets;
}

function documentInfo(text) {
  const hasCrlf = text.includes('\r\n');
  const withoutCrlf = text.replace(/\r\n/g, '');
  if (withoutCrlf.includes('\r') || (hasCrlf && withoutCrlf.includes('\n'))) blocked('Mixed newline representation is unsupported.');
  return { normalized: text.replace(/\r\n/g, '\n'), eol: hasCrlf ? '\r\n' : '\n' };
}

function headingsAndFrontmatter(text) {
  const lines = text.split('\n');
  const headings = [];
  for (let index = 0; index < lines.length; index++) {
    const match = /^(#{1,6})[ \t]+(\S.*?)[ \t]*$/.exec(lines[index]);
    if (match) headings.push({ text: lines[index], level: match[1].length, number: index + 1 });
  }
  const sections = new Map();
  for (const heading of headings) {
    const next = headings.find(item => item.number > heading.number && item.level <= heading.level);
    const range = { start: heading.number, end: (next?.number ?? lines.length + 1) - 1, heading };
    if (!sections.has(heading.text)) sections.set(heading.text, []);
    sections.get(heading.text).push(range);
  }
  const frontmatterClose = lines.slice(1).findIndex(line => line === '---');
  return { lines, headings, sections, frontmatter: lines[0] === '---' && frontmatterClose >= 0 ? { start: 1, end: frontmatterClose + 2 } : null };
}

function sectionRange(index, section) {
  if (section === 'frontmatter') return index.frontmatter ?? { error: 'missing' };
  if (typeof section !== 'string') return { error: 'missing' };
  const matches = index.sections.get(section) ?? [];
  return matches.length === 1 ? matches[0] : { error: matches.length ? 'ambiguous' : 'missing' };
}

function findOccurrences(text, needle) {
  const result = [];
  if (!needle) return result;
  for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) result.push(at);
  return result;
}

function locate(text, section, target) {
  const index = headingsAndFrontmatter(text);
  const range = sectionRange(index, section);
  if (range.error) return { range, locations: [] };
  const lines = index.lines;
  const offsets = lineOffsets(text);
  const sectionText = lines.slice(range.start - 1, range.end).join('\n');
  const targetText = normalizeNewlines(target);
  const startOffset = offsets[range.start - 1];
  const locations = findOccurrences(sectionText, targetText).map(offset => {
    const absoluteStart = startOffset + offset;
    const absoluteEnd = absoluteStart + targetText.length;
    return {
      startOffset: absoluteStart,
      endOffset: absoluteEnd,
      startLine: text.slice(0, absoluteStart).split('\n').length,
      endLine: text.slice(0, Math.max(absoluteStart, absoluteEnd - 1)).split('\n').length
    };
  });
  return { range, locations };
}

function applyOperation(text, change) {
  if (!ACTIONABLE.has(change.operation)) return text;
  const found = locate(text, change.section, change.targetContent);
  if (found.range.error || found.locations.length !== 1) blocked(`${change.operation} target is missing or ambiguous; validated proposal is stale.`);
  const location = found.locations[0];
  const before = text.slice(0, location.startOffset);
  const after = text.slice(location.endOffset);
  if (change.operation === 'MODIFY') return before + change.proposedContent + after;
  if (change.operation === 'REMOVE') {
    const cleanedAfter = after.startsWith('\n\n') ? `\n${after.slice(2)}` : after;
    return before + cleanedAfter;
  }
  const proposed = change.proposedContent;
  const anchor = text.slice(location.startOffset, location.endOffset);
  const beforeAnchor = before + anchor;
  const prefix = beforeAnchor && !beforeAnchor.endsWith('\n') && !proposed.startsWith('\n') ? '\n' : '';
  const suffix = after && !proposed.endsWith('\n') && !after.startsWith('\n') ? '\n' : '';
  return beforeAnchor + prefix + proposed + suffix + after;
}

function frontmatterInfo(text) {
  const index = headingsAndFrontmatter(text);
  if (!index.frontmatter) blocked('Current OKF frontmatter is missing or malformed.');
  const { start, end } = index.frontmatter;
  const entries = new Map();
  for (let line = start; line <= end; line++) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):([ \t]*)(.*)$/.exec(index.lines[line - 1]);
    if (!match) continue;
    const item = { line, raw: index.lines[line - 1], value: match[3], spacing: match[2], key: match[1] };
    if (!entries.has(item.key)) entries.set(item.key, []);
    entries.get(item.key).push(item);
  }
  for (const key of ['type', 'title', 'resource', 'tags', 'timestamp']) {
    if ((entries.get(key) ?? []).length !== 1 || !entries.get(key)[0].value.trim()) blocked(`Frontmatter key ${key} is missing, duplicated, or empty.`);
  }
  return { index, entries };
}

function timestampValue(raw) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)) return new Date().toISOString();
  blocked('Existing timestamp format is unsupported.');
}

function updateTimestamp(text, beforeInfo) {
  const info = frontmatterInfo(text);
  const original = beforeInfo.entries.get('timestamp')[0].value.trim();
  const lineNumber = info.entries.get('timestamp')[0].line;
  const lines = info.index.lines;
  const line = lines[lineNumber - 1];
  const prefix = line.slice(0, line.indexOf(':') + 1) + info.entries.get('timestamp')[0].spacing;
  lines[lineNumber - 1] = prefix + timestampValue(original);
  return lines.join('\n');
}

function validateFinalFrontmatter(text, beforeInfo) {
  const after = frontmatterInfo(text);
  for (const key of ['type', 'title', 'resource', 'tags']) if (after.entries.get(key)[0].raw !== beforeInfo.entries.get(key)[0].raw) blocked(`Protected frontmatter key ${key} changed.`);
  if (!after.entries.get('timestamp')[0].value.trim()) blocked('Frontmatter timestamp is empty.');
}

function encodeDocument(normalizedText, eol) { return Buffer.from(eol === '\n' ? normalizedText : normalizedText.replace(/\n/g, eol), 'utf8'); }

async function preflightCandidate(candidate) {
  try {
    const pathInfo = await resolveOkf(candidate.proposal.okfFile);
    const currentBytes = await verifyCandidateHashes(candidate, pathInfo);
    if (!currentBytes) return;
    const document = documentInfo(currentBytes.toString('utf8'));
    const beforeInfo = frontmatterInfo(document.normalized);
    let updated = document.normalized;
    for (const change of candidate.proposal.proposedChanges) updated = applyOperation(updated, change);
    updated = updateTimestamp(updated, beforeInfo);
    validateFinalFrontmatter(updated, beforeInfo);
    const outputBytes = encodeDocument(updated, document.eol);
    if (Buffer.compare(currentBytes, outputBytes) === 0) blocked('Approved changes produce no content change.');
    candidate.preflight = { targetReal: pathInfo.targetReal, beforeBytes: currentBytes, afterBytes: outputBytes };
  } catch (error) {
    if (error instanceof UnsafeError) throw error;
    if (error instanceof BlockedError) addBlock(candidate, 'RERUN_REQUIRED', error.message);
    else if (error instanceof FatalError) addBlock(candidate, 'RERUN_REQUIRED', error.message);
    else addBlock(candidate, 'RERUN_REQUIRED', `Unable to preflight OKF: ${error.message}`);
  }
}

async function verifyCandidateHashes(candidate, knownPathInfo = null) {
  try {
    const pathInfo = knownPathInfo ?? await resolveOkf(candidate.proposal.okfFile);
    const [proposalBytes, bundleBytes, currentBytes] = await Promise.all([
      readBytes(candidate.proposalPath, `Stage 6 proposal ${candidate.filename}`),
      readBytes(candidate.bundlePath, `evidence bundle ${candidate.filename}`),
      readBytes(pathInfo.targetReal, `current OKF ${candidate.proposal.okfFile}`)
    ]);
    const context = candidate.proposal.validationContext;
    if (sha256(proposalBytes) !== context.sourceProposalSha256 || sha256(bundleBytes) !== context.evidenceBundleSha256 || sha256(currentBytes) !== context.currentOkfSha256) blocked('Validated proposal is stale; Stage 5/6/7 must be rerun.');
    return currentBytes;
  } catch (error) {
    if (error instanceof UnsafeError) throw error;
    if (error instanceof BlockedError) addBlock(candidate, 'RERUN_REQUIRED', error.message);
    else if (error instanceof FatalError) addBlock(candidate, 'RERUN_REQUIRED', error.message);
    else addBlock(candidate, 'RERUN_REQUIRED', `Unable to verify Stage 5/6/7 hashes: ${error.message}`);
    return null;
  }
}

async function refreshCandidate(candidate) {
  const proposalBytes = await readBytes(candidate.proposalPath, `Stage 6 proposal ${candidate.filename}`);
  const bundleBytes = await readBytes(candidate.bundlePath, `evidence bundle ${candidate.filename}`);
  const currentBytes = await readBytes(candidate.preflight.targetReal, `current OKF ${candidate.proposal.okfFile}`);
  if (sha256(proposalBytes) !== candidate.proposal.validationContext.sourceProposalSha256 || sha256(bundleBytes) !== candidate.proposal.validationContext.evidenceBundleSha256 || sha256(currentBytes) !== candidate.proposal.validationContext.currentOkfSha256) blocked('Validated proposal is stale; Stage 5/6/7 must be rerun.');
  if (Buffer.compare(currentBytes, candidate.preflight.beforeBytes) !== 0) blocked('Validated proposal is stale; Stage 5/6/7 must be rerun.');
}

function runChild(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function validateStage3Output(result) {
  if (![0, 1].includes(result.code)) return false;
  let data;
  try { data = JSON.parse(result.stdout); } catch { return false; }
  return nonEmptyString(data.snapshotAge) && Array.isArray(data.changes) && typeof data.hasChanges === 'boolean' && Array.isArray(data.affectedOkfFiles);
}

async function runStage3(args) {
  let result;
  try { result = await runChild(process.execPath, [stage3Script, ...args]); }
  catch (error) { return { ok: false, reason: `Stage 3 could not be executed: ${error.message}` }; }
  return validateStage3Output(result) ? { ok: true } : { ok: false, reason: 'Stage 3 database/snapshot execution failed.' };
}

function utcBackupStamp() {
  return nowIso().replace(/[-:]/g, '').replace('T', 'T').replace('Z', 'Z');
}

function backupName(okfFile, stamp) { return `${normalizePath(okfFile).replaceAll('/', '--').replace(/\.md$/, '')}--${stamp}.md`; }

async function atomicReplace(filePath, bytes) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx' });
    await fs.rename(temporary, filePath);
  } catch (error) {
    try { await fs.unlink(temporary); } catch {}
    throw error;
  }
}

async function restoreArtifact(filePath, priorBytes) {
  if (priorBytes === null) { try { await fs.unlink(filePath); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  else await atomicReplace(filePath, priorBytes);
}

async function loadHistory() {
  const bytes = await readOptionalBytes(historyPath);
  if (bytes === null) return { bytes: null, data: { updates: [] } };
  let data;
  try { data = JSON.parse(bytes.toString('utf8')); } catch (error) { fatal(`Malformed update-history.json: ${error.message}`); }
  if (!isObject(data) || !Array.isArray(data.updates)) fatal('Malformed update-history.json: updates must be an array.');
  for (const entry of data.updates) {
    if (!isObject(entry) || !nonEmptyString(entry.okfFile) || !Array.isArray(entry.changesApplied)) fatal('Malformed update-history.json entry.');
  }
  return { bytes, data };
}

async function loadPatterns() {
  const bytes = await readOptionalBytes(patternsPath);
  if (bytes === null) return { bytes: null, text: PATTERN_HEADER };
  const text = normalizeNewlines(bytes.toString('utf8'));
  if (!text.startsWith(PATTERN_HEADER)) fatal('Unsupported learned-patterns.md format.');
  return { bytes, text };
}

function historyPatternSignature(okfFile, change) {
  return sha256(Buffer.from(canonical({ okfFile, operation: change.operation, section: change.section, evidenceTier: change.evidenceTier, confidence: change.confidence }), 'utf8'));
}

function priorPatternCount(history, signature) {
  return history.data.updates.filter(entry => entry.changesApplied.some(change => change.patternSignature === signature || historyPatternSignature(entry.okfFile, change) === signature)).length;
}

function historyEntry(candidate, backupFile, timestamp) {
  return {
    timestamp,
    okfFile: candidate.proposal.okfFile,
    trigger: 'automated_okf_pipeline',
    changesApplied: candidate.proposal.proposedChanges.filter(change => ACTIONABLE.has(change.operation)).map(change => ({
      operation: change.operation,
      section: change.section,
      summary: `${change.operation} in ${change.section}`,
      evidenceTier: change.evidenceTier,
      confidence: change.confidence,
      patternSignature: historyPatternSignature(candidate.proposal.okfFile, change)
    })),
    backupFile: `.okf-system/backups/${backupFile}`,
    provider: null,
    model: null,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    validationContext: candidate.proposal.validationContext
  };
}

function inferredResolutionEntries(candidate) {
  const inferred = Array.isArray(candidate.proposal.inferredFactsResolved) ? candidate.proposal.inferredFactsResolved : [];
  const applied = candidate.proposal.proposedChanges.filter(change => ACTIONABLE.has(change.operation) && change.approvedForWrite && change.confidence === 'HIGH');
  const blocks = candidate.bundle?.evidence?.existing_okf_inferred_facts?.blocks ?? [];
  return inferred.filter(item => blocks.filter(block => block.content === item.targetContent).length === 1 && applied.some(change => change.targetContent === item.targetContent && canonical(change.evidenceRef) === canonical(item.evidenceRef))).map(item => ({
    signature: sha256(Buffer.from(canonical({ type: 'inferred-resolution', okfFile: candidate.proposal.okfFile, targetContent: item.targetContent, evidenceRef: item.evidenceRef }), 'utf8')),
    okfFile: candidate.proposal.okfFile,
    targetContent: item.targetContent,
    evidenceRef: item.evidenceRef
  }));
}

function patternBlock(pattern) {
  return `\n## Recurring pattern: ${pattern.signature}\n- signature: ${pattern.signature}\n- okfFile: ${pattern.okfFile}\n- operation: ${pattern.operation}\n- section: ${JSON.stringify(pattern.section)}\n- evidenceTier: ${pattern.evidenceTier}\n- confidence: ${pattern.confidence}\n- occurrenceCount: 3\n`;
}

function resolutionBlock(item) {
  return `\n## Confirmed inferred fact resolution: ${item.signature}\n- resolutionSignature: ${item.signature}\n- okfFile: ${item.okfFile}\n- targetContent: ${JSON.stringify(item.targetContent)}\n- evidenceRef: ${canonical(item.evidenceRef)}\n`;
}

function preparePatterns(patternState, history, candidates) {
  let text = patternState.text;
  const additions = [];
  for (const candidate of candidates) {
    for (const change of candidate.proposal.proposedChanges.filter(item => ACTIONABLE.has(item.operation) && item.approvedForWrite && item.confidence === 'HIGH')) {
      const signature = historyPatternSignature(candidate.proposal.okfFile, change);
      if (priorPatternCount(history, signature) >= 2 && !text.includes(`- signature: ${signature}`)) additions.push({ signature, okfFile: candidate.proposal.okfFile, operation: change.operation, section: change.section, evidenceTier: change.evidenceTier, confidence: change.confidence });
    }
    for (const resolution of inferredResolutionEntries(candidate)) if (!text.includes(`- resolutionSignature: ${resolution.signature}`)) additions.push(resolution);
  }
  for (const addition of additions) text += 'signature' in addition && 'operation' in addition ? patternBlock(addition) : resolutionBlock(addition);
  const bytes = additions.length || (patternState.bytes === null && candidates.length > 0) ? Buffer.from(text, 'utf8') : patternState.bytes;
  return { bytes, learned: additions.length };
}

function buildReviewItems(candidates) {
  return candidates.filter(candidate => candidate.category === 'HUMAN_REVIEW').sort((a, b) => a.proposal.okfFile.localeCompare(b.proposal.okfFile)).map(candidate => ({
    okfFile: candidate.proposal.okfFile,
    validatedProposal: candidate.filename,
    category: 'HUMAN_REVIEW',
    reason: 'Human review required',
    details: unique(candidate.details),
    validationContext: candidate.proposal.validationContext,
    changes: candidate.proposal.proposedChanges.filter(change => change.flagForHumanReview || change.confidence === 'LOW' || change.failedChecks.length > 0 || ACTIONABLE.has(change.operation) && (candidate.proposal.requiresHumanReview || candidate.bundle.requiresHumanReview)).map(change => ({ operation: change.operation, section: change.section, targetContent: change.targetContent, proposedContent: change.proposedContent, confidence: change.confidence, failedChecks: change.failedChecks, flagForHumanReview: change.flagForHumanReview }))
  }));
}

function buildBlockedFiles(candidates) {
  return candidates.filter(candidate => candidate.category).sort((a, b) => a.proposal.okfFile.localeCompare(b.proposal.okfFile)).map(candidate => ({
    okfFile: candidate.proposal.okfFile,
    validatedProposal: candidate.filename,
    category: candidate.category,
    reason: candidate.category === 'HUMAN_REVIEW' ? 'Human review required' : 'Rerun required',
    details: unique(candidate.details)
  }));
}

async function loadCandidate(filename) {
  const validatedPath = path.join(validatedDirectory, filename);
  const proposalBytes = await readBytes(validatedPath, `validated proposal ${filename}`);
  const proposal = parseJson(proposalBytes, `validated proposal ${filename}`);
  validateValidatedProposal(proposal, filename);
  const candidate = { filename, proposal, proposalPath: path.join(originalProposalDirectory, filename), bundlePath: path.join(bundleDirectory, filename), details: [], category: null, eligible: false, actionableCount: proposal.proposedChanges.filter(change => ACTIONABLE.has(change.operation)).length };
  try {
    const [stage6Bytes, bundleBytes] = await Promise.all([readBytes(candidate.proposalPath, `Stage 6 proposal ${filename}`), readBytes(candidate.bundlePath, `evidence bundle ${filename}`)]);
    candidate.stage6Bytes = stage6Bytes; candidate.bundleBytes = bundleBytes;
    candidate.stage6 = parseJson(stage6Bytes, `Stage 6 proposal ${filename}`);
    candidate.bundle = parseJson(bundleBytes, `evidence bundle ${filename}`);
    validateStage6Proposal(candidate.stage6, filename);
    validateBundle(candidate.bundle, filename);
    compareStage6Fields(candidate.stage6, proposal, candidate.bundle, filename);
    if (candidate.bundle.okfFile !== proposal.okfFile) fatal(`${filename}: Stage 5/Stage 7 okfFile identity mismatch.`);
    const pathInfo = validateLexicalPath(proposal.okfFile);
    if (pathInfo.normalized !== proposal.okfFile) fatal(`${filename}: okfFile must use its normalized repository-relative form.`);
    if (proposal.requiresHumanReview || proposal.sourceEvidenceStatus !== 'COMPLETE' || candidate.bundle.requiresHumanReview || candidate.bundle.evidenceStatus !== 'COMPLETE') {
      // The detailed classification below supplies the deterministic category.
    }
    classifyCandidate(candidate);
  } catch (error) {
    if (error instanceof UnsafeError) throw error;
    if (error instanceof FatalError) addBlock(candidate, 'RERUN_REQUIRED', error.message);
    else addBlock(candidate, 'RERUN_REQUIRED', `Unable to validate Stage 5/6 inputs: ${error.message}`);
  }
  return candidate;
}

function rejectDuplicateOkfIdentities(candidates) {
  const byOkf = new Map();
  for (const candidate of candidates) {
    if (!candidate.proposal) continue;
    const normalized = normalizePath(candidate.proposal.okfFile);
    if (!byOkf.has(normalized)) byOkf.set(normalized, []);
    byOkf.get(normalized).push(candidate.filename);
  }
  for (const [okfFile, filenames] of byOkf) {
    if (filenames.length > 1) fatal(`Duplicate validated proposal OKF identity ${okfFile}: ${filenames.sort((a, b) => a.localeCompare(b)).join(', ')}`);
  }
}

async function updateReviewReport(candidates) {
  const report = { generatedAt: nowIso(), files: buildReviewItems(candidates) };
  await atomicReplace(reviewPath, Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8'));
}

async function commit(candidates, blockedFiles, actionableBlocked) {
  const history = await loadHistory();
  const patterns = await loadPatterns();
  const stamp = utcBackupStamp();
  const backups = candidates.map(candidate => ({ candidate, name: backupName(candidate.proposal.okfFile, stamp), path: path.join(backupDirectory, backupName(candidate.proposal.okfFile, stamp)) }));
  const priorReport = await readOptionalBytes(reviewPath);
  const timestamp = nowIso();
  const newHistory = { updates: [...history.data.updates, ...candidates.map(item => historyEntry(item, backups.find(backup => backup.candidate === item).name, timestamp))].slice(-50) };
  const historyBytes = Buffer.from(`${JSON.stringify(newHistory, null, 2)}\n`, 'utf8');
  const patternResult = preparePatterns(patterns, history, candidates);
  const report = { generatedAt: nowIso(), files: buildReviewItems(blockedFiles) };
  const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const writtenOkfs = []; let historyWritten = false; let patternsWritten = false; let reportWritten = false;
  try {
    await fs.mkdir(backupDirectory, { recursive: true });
    for (const backup of backups) await fs.writeFile(backup.path, backup.candidate.preflight.beforeBytes, { flag: 'wx' });
    for (const candidate of candidates) { await atomicReplace(candidate.preflight.targetReal, candidate.preflight.afterBytes); writtenOkfs.push(candidate); }
    await atomicReplace(historyPath, historyBytes); historyWritten = true;
    if (patternResult.bytes !== patterns.bytes) { await atomicReplace(patternsPath, patternResult.bytes); patternsWritten = true; }
    await atomicReplace(reviewPath, reportBytes); reportWritten = true;
    if (!actionableBlocked) {
      const snapshot = await runStage3(['--update-snapshot']);
      if (!snapshot.ok) throw new Error(snapshot.reason);
    }
    return {
      backupsCreated: backups.length,
      historyEntriesAdded: candidates.length,
      patternsLearned: patternResult.learned,
      snapshotUpdated: !actionableBlocked,
      snapshotDeferred: actionableBlocked
    };
  } catch (error) {
    const rollbackErrors = [];
    const attempt = async (label, action) => {
      try { await action(); } catch (rollbackError) { rollbackErrors.push(`${label}: ${rollbackError.message}`); }
    };
    for (const candidate of [...writtenOkfs].reverse()) await attempt(`OKF ${candidate.proposal.okfFile}`, () => restoreArtifact(candidate.preflight.targetReal, candidate.preflight.beforeBytes));
    if (historyWritten) await attempt('update-history.json', () => restoreArtifact(historyPath, history.bytes));
    if (patternsWritten) await attempt('learned-patterns.md', () => restoreArtifact(patternsPath, patterns.bytes));
    if (reportWritten) await attempt('human-review-required.json', () => restoreArtifact(reviewPath, priorReport));
    for (const directory of unique([systemRoot, backupDirectory, ...candidates.map(candidate => path.dirname(candidate.preflight.targetReal))])) {
      await attempt(`temporary files in ${directory}`, async () => {
        let names;
        try { names = await fs.readdir(directory); } catch (directoryError) { if (directoryError.code === 'ENOENT') return; throw directoryError; }
        for (const name of names.filter(item => item.endsWith('.tmp')).sort((a, b) => a.localeCompare(b))) await fs.unlink(path.join(directory, name));
      });
    }
    if (rollbackErrors.length) throw new Error(`${error.message}; rollback failures: ${rollbackErrors.sort((a, b) => a.localeCompare(b)).join(' | ')}`);
    throw error;
  }
}

function parseArgs(args) {
  if (!args.length) return 'dry-run';
  if (args.length === 1 && args[0] === '--apply') return 'apply';
  fatal(`Unknown argument: ${args[0]}`);
}

function hasActionableBlockers(candidates) {
  return candidates.some(candidate => candidate.actionableCount > 0 && candidate.category !== null);
}

function summaryBase(mode) {
  return {
    mode,
    filesEligible: 0,
    filesWouldUpdate: 0,
    filesBlocked: 0,
    blockedFiles: [],
    changesWouldApply: 0,
    snapshotWouldUpdate: false,
    snapshotUpdated: false,
    snapshotDeferred: false,
    writesPerformed: false
  };
}

async function main() {
  let mode;
  try {
    mode = parseArgs(process.argv.slice(2));
    const summary = summaryBase(mode);
    const entries = (await fs.readdir(validatedDirectory, { withFileTypes: true })).filter(entry => entry.isFile() && entry.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name));
    const candidates = [];
    for (const entry of entries) candidates.push(await loadCandidate(entry.name));
    rejectDuplicateOkfIdentities(candidates);
    const eligible = candidates.filter(candidate => candidate.eligible && !candidate.category);
    for (const candidate of candidates) if (candidate.stage6 && candidate.bundle) await verifyCandidateHashes(candidate);
    summary.filesEligible = eligible.length;
    summary.filesBlocked = candidates.filter(candidate => candidate.category).length;

    if (mode === 'dry-run') {
      for (const candidate of eligible) await preflightCandidate(candidate);
      const failedPreflight = eligible.filter(candidate => candidate.category || !candidate.preflight);
      if (failedPreflight.length) for (const candidate of eligible.filter(item => !item.category && item.preflight)) addBlock(candidate, 'RERUN_REQUIRED', 'Batch preflight aborted because another initially eligible file failed.');
      const ready = eligible.filter(candidate => !candidate.category && candidate.preflight);
      summary.filesWouldUpdate = ready.length;
      summary.changesWouldApply = ready.reduce((total, candidate) => total + candidate.actionableCount, 0);
      summary.filesBlocked = candidates.filter(candidate => candidate.category).length;
      summary.blockedFiles = buildBlockedFiles(candidates);
      const actionableBlocked = hasActionableBlockers(candidates);
      summary.snapshotWouldUpdate = ready.length > 0 && !actionableBlocked;
      summary.snapshotDeferred = ready.length > 0 && actionableBlocked;
      console.log(JSON.stringify(summary, null, 2));
      process.exitCode = actionableBlocked ? 2 : 0;
      return;
    }

    for (const candidate of eligible) await preflightCandidate(candidate);
    const failedPreflight = eligible.filter(candidate => candidate.category || !candidate.preflight);
    if (failedPreflight.length) for (const candidate of eligible.filter(item => !item.category && item.preflight)) addBlock(candidate, 'RERUN_REQUIRED', 'Batch preflight aborted because another initially eligible file failed.');
    if (!failedPreflight.length && eligible.length > 0) {
      const stage3 = await runStage3([]);
      if (!stage3.ok) for (const candidate of eligible) addBlock(candidate, 'RERUN_REQUIRED', stage3.reason);
    }
    const ready = eligible.filter(candidate => !candidate.category && candidate.preflight);
    summary.filesEligible = ready.length;
    summary.filesBlocked = candidates.filter(candidate => candidate.category).length;
    summary.blockedFiles = buildBlockedFiles(candidates);
    if (!ready.length) {
      await updateReviewReport(candidates);
      summary.filesUpdated = 0; summary.changesApplied = 0; summary.backupsCreated = 0; summary.historyEntriesAdded = 0; summary.patternsLearned = 0; summary.snapshotUpdated = false; summary.writesPerformed = false;
      console.log(JSON.stringify(summary, null, 2));
      process.exitCode = hasActionableBlockers(candidates) ? 2 : 0;
      return;
    }
    for (const candidate of ready) {
      try { await refreshCandidate(candidate); }
      catch (error) { addBlock(candidate, 'RERUN_REQUIRED', error.message); }
    }
    const finalReady = ready.filter(candidate => !candidate.category);
    if (finalReady.length !== ready.length) {
      for (const candidate of ready.filter(item => !item.category)) addBlock(candidate, 'RERUN_REQUIRED', 'Batch commit preflight aborted because a just-before-commit validation failed.');
      await updateReviewReport(candidates);
      summary.filesEligible = 0; summary.filesBlocked = candidates.filter(candidate => candidate.category).length; summary.blockedFiles = buildBlockedFiles(candidates);
      console.log(JSON.stringify(summary, null, 2));
      process.exitCode = hasActionableBlockers(candidates) ? 2 : 0;
      return;
    }
    const actionableBlocked = hasActionableBlockers(candidates);
    const result = await commit(finalReady, candidates, actionableBlocked);
    summary.filesUpdated = finalReady.length;
    summary.changesApplied = finalReady.reduce((total, candidate) => total + candidate.actionableCount, 0);
    summary.backupsCreated = result.backupsCreated;
    summary.historyEntriesAdded = result.historyEntriesAdded;
    summary.patternsLearned = result.patternsLearned;
    summary.snapshotUpdated = result.snapshotUpdated;
    summary.snapshotDeferred = result.snapshotDeferred;
    summary.filesBlocked = candidates.filter(candidate => candidate.category).length;
    summary.blockedFiles = buildBlockedFiles(candidates);
    summary.writesPerformed = true;
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = actionableBlocked ? 2 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fatal Error: ${message}`);
    console.log(JSON.stringify({ mode: mode ?? 'dry-run', filesEligible: 0, filesWouldUpdate: 0, filesBlocked: 0, blockedFiles: [], changesWouldApply: 0, snapshotWouldUpdate: false, snapshotUpdated: false, snapshotDeferred: false, writesPerformed: false, error: message }, null, 2));
    process.exitCode = 3;
  }
}

await main();
