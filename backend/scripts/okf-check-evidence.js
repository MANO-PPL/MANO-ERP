#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '../..');
const knowledgeRoot = path.resolve(repoRoot, 'backend/knowledge');
const proposalDirectory = path.resolve(knowledgeRoot, '.okf-system/change-proposals');
const bundleDirectory = path.resolve(knowledgeRoot, '.okf-system/evidence-bundles');
const validatedDirectory = path.resolve(knowledgeRoot, '.okf-system/validated-proposals');

const OPERATIONS = new Set(['MODIFY', 'ADD', 'REMOVE', 'KEEP', 'NO_CHANGE']);
const ACTIONABLE = new Set(['MODIFY', 'ADD', 'REMOVE']);
const DUPLICATE_TARGET_OPERATIONS = new Set(['MODIFY', 'REMOVE', 'KEEP']);
const CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'LOW']);
const STATUSES = new Set(['COMPLETE', 'PARTIAL', 'UNSAFE']);
const TIERS = new Set([1, 2, 3, 4, null]);
const CHANGE_FIELDS = ['operation', 'section', 'targetContent', 'proposedContent', 'evidenceTier', 'evidenceQuote', 'evidenceRef', 'confidence', 'flagForHumanReview'];
const HIERARCHY = ['live_database_schema', 'schema_initialization_code', 'service_layer', 'controllers_and_routes', 'existing_okf_stated_facts', 'existing_okf_inferred_facts', 'update_history', 'learned_patterns'];

class FatalError extends Error {}
function fatal(message) { throw new FatalError(message); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function nonEmptyString(value) { return typeof value === 'string' && value.length > 0; }
function normalizePath(value) { return typeof value === 'string' ? value.replace(/\\/g, '/') : value; }
function normalizeNewlines(value) { return String(value).replace(/\r\n?/g, '\n'); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function stableJson(value) { return JSON.stringify(value); }

async function readBytes(filePath, label) {
  try { return await fs.readFile(filePath); }
  catch (error) { fatal(`Unable to read ${label}: ${error.message}`); }
}

function parseJsonBytes(bytes, label) {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch (error) { fatal(`Invalid JSON in ${label}: ${error.message}`); }
}

function assertString(value, label, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) fatal(`${label} must be ${allowEmpty ? 'a string' : 'a non-empty string'}.`);
}
function assertBoolean(value, label) { if (typeof value !== 'boolean') fatal(`${label} must be boolean.`); }
function assertArray(value, label) { if (!Array.isArray(value)) fatal(`${label} must be an array.`); }

function validateEvidenceRef(ref, label) {
  if (!isObject(ref)) fatal(`${label} must be an object.`);
  for (const field of ['tier', 'sourceFile', 'lineStart', 'lineEnd', 'table', 'field']) if (!Object.prototype.hasOwnProperty.call(ref, field)) fatal(`${label}.${field} is required.`);
  if (ref.tier !== null && typeof ref.tier !== 'number') fatal(`${label}.tier must be a number or null.`);
  for (const field of ['sourceFile', 'table', 'field']) if (ref[field] !== null && typeof ref[field] !== 'string') fatal(`${label}.${field} must be string or null.`);
  for (const field of ['lineStart', 'lineEnd']) if (ref[field] !== null && !Number.isInteger(ref[field])) fatal(`${label}.${field} must be integer or null.`);
}

function validateChangeShape(change, label) {
  if (!isObject(change)) fatal(`${label} must be an object.`);
  for (const field of CHANGE_FIELDS) if (!Object.prototype.hasOwnProperty.call(change, field)) fatal(`${label}.${field} is required.`);
  if (!OPERATIONS.has(change.operation)) fatal(`${label}.operation is invalid.`);
  if (change.section !== null && typeof change.section !== 'string') fatal(`${label}.section must be string or null.`);
  assertString(change.targetContent, `${label}.targetContent`, true);
  assertString(change.proposedContent, `${label}.proposedContent`, true);
  if (change.evidenceTier !== null && typeof change.evidenceTier !== 'number') fatal(`${label}.evidenceTier must be a number or null.`);
  if (change.evidenceQuote !== null && typeof change.evidenceQuote !== 'string') fatal(`${label}.evidenceQuote must be string or null.`);
  validateEvidenceRef(change.evidenceRef, `${label}.evidenceRef`);
  if (!CONFIDENCE.has(change.confidence)) fatal(`${label}.confidence is invalid.`);
  assertBoolean(change.flagForHumanReview, `${label}.flagForHumanReview`);
}

function validateBundleShape(bundle, label) {
  if (!isObject(bundle)) fatal(`${label} must be an object.`);
  assertString(bundle.okfFile, `${label}.okfFile`);
  assertString(bundle.collectedAt, `${label}.collectedAt`);
  assertString(bundle.changeReason, `${label}.changeReason`);
  if (!STATUSES.has(bundle.evidenceStatus)) fatal(`${label}.evidenceStatus is invalid.`);
  assertBoolean(bundle.requiresHumanReview, `${label}.requiresHumanReview`);
  assertArray(bundle.warnings, `${label}.warnings`); bundle.warnings.forEach((v, i) => assertString(v, `${label}.warnings[${i}]`));
  assertArray(bundle.errors, `${label}.errors`); bundle.errors.forEach((v, i) => assertString(v, `${label}.errors[${i}]`));
  assertArray(bundle.evidenceHierarchy, `${label}.evidenceHierarchy`);
  if (stableJson(bundle.evidenceHierarchy) !== stableJson(HIERARCHY)) fatal(`${label}.evidenceHierarchy is invalid.`);
  if (!isObject(bundle.evidence)) fatal(`${label}.evidence must be an object.`);
  const evidence = bundle.evidence;
  if (!isObject(evidence.live_database_schema) || typeof evidence.live_database_schema.available !== 'boolean' || !isObject(evidence.live_database_schema.tables)) fatal(`${label}.live_database_schema is malformed.`);
  for (const section of ['schema_initialization_code', 'service_layer', 'controllers_and_routes']) {
    if (!isObject(evidence[section]) || !Array.isArray(evidence[section].functions ?? evidence[section].items)) fatal(`${label}.${section} is malformed.`);
    const items = evidence[section].functions ?? evidence[section].items;
    items.forEach((item, i) => validateEvidenceItem(item, `${label}.${section}[${i}]`));
  }
  for (const section of ['existing_okf_stated_facts', 'existing_okf_inferred_facts']) {
    if (!isObject(evidence[section]) || !Array.isArray(evidence[section].blocks)) fatal(`${label}.${section}.blocks is malformed.`);
    evidence[section].blocks.forEach((block, i) => {
      if (!isObject(block) || !Number.isInteger(block.lineStart) || !Number.isInteger(block.lineEnd) || block.lineStart < 1 || block.lineEnd < block.lineStart || typeof block.content !== 'string') fatal(`${label}.${section}.blocks[${i}] is malformed.`);
    });
  }
  for (const section of ['update_history', 'learned_patterns']) if (!isObject(evidence[section])) fatal(`${label}.${section} is malformed.`);
}

function validateEvidenceItem(item, label) {
  if (!isObject(item)) fatal(`${label} must be an object.`);
  assertString(item.sourceFile, `${label}.sourceFile`);
  if (!Number.isInteger(item.lineStart) || !Number.isInteger(item.lineEnd) || item.lineStart < 1 || item.lineEnd < item.lineStart) fatal(`${label}.line range is invalid.`);
  assertString(item.content, `${label}.content`);
  if (item.functionName !== undefined && item.functionName !== null) assertString(item.functionName, `${label}.functionName`);
  if (item.kind !== undefined && item.kind !== null) assertString(item.kind, `${label}.kind`);
}

function validateProposalShape(proposal, label) {
  if (!isObject(proposal)) fatal(`${label} must be an object.`);
  assertString(proposal.okfFile, `${label}.okfFile`);
  assertBoolean(proposal.requiresHumanReview, `${label}.requiresHumanReview`);
  if (!STATUSES.has(proposal.sourceEvidenceStatus)) fatal(`${label}.sourceEvidenceStatus is invalid.`);
  assertArray(proposal.proposedChanges, `${label}.proposedChanges`);
  proposal.proposedChanges.forEach((change, i) => validateChangeShape(change, `${label}.proposedChanges[${i}]`));
  if (proposal.rejectedChanges !== undefined && !Array.isArray(proposal.rejectedChanges)) fatal(`${label}.rejectedChanges must be an array.`);
}

function validateLexicalOkfPath(okfFile) {
  assertString(okfFile, 'okfFile');
  const normalized = normalizePath(okfFile);
  if (!normalized.endsWith('.md')) fatal('OKF path must end with .md.');
  if (path.isAbsolute(okfFile) || path.isAbsolute(normalized) || /^[A-Za-z]:[\\/]/.test(okfFile) || normalized.startsWith('/')) fatal('OKF path must be repository-relative.');
  const segments = normalized.split('/');
  if (segments.includes('..') || segments.some(segment => segment === '.okf-system') || normalized.startsWith('.okf-system/')) fatal('OKF path is outside the allowed Markdown scope.');
  const lexicalTarget = path.resolve(knowledgeRoot, ...segments);
  const relative = path.relative(knowledgeRoot, lexicalTarget);
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) fatal('OKF path escapes backend/knowledge.');
  return { normalized, lexicalTarget };
}

async function resolveCurrentOkf(okfFile) {
  const { normalized, lexicalTarget } = validateLexicalOkfPath(okfFile);
  const rootReal = await fs.realpath(knowledgeRoot).catch(error => fatal(`Unable to resolve backend/knowledge: ${error.message}`));
  const lexicalStat = await fs.lstat(lexicalTarget).catch(error => fatal(`Unable to read current OKF Markdown: ${error.message}`));
  if (lexicalStat.isSymbolicLink()) fatal('OKF target symbolic links are not allowed.');
  const targetReal = await fs.realpath(lexicalTarget).catch(error => fatal(`Unable to resolve current OKF Markdown: ${error.message}`));
  const relative = path.relative(rootReal, targetReal);
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) fatal('OKF realpath escapes backend/knowledge.');
  const targetStat = await fs.stat(targetReal);
  if (!targetStat.isFile()) fatal('OKF target must be a regular file.');
  return { normalized, targetReal };
}

function linesOf(text) { return normalizeNewlines(text).split('\n').map((content, index) => ({ number: index + 1, content })); }

function frontmatterRange(lines) {
  if (lines[0]?.content !== '---') return null;
  const closing = lines.slice(1).find(line => line.content === '---');
  return closing ? { start: 1, end: closing.number } : null;
}

function headingInfo(line) {
  const match = /^(#{1,6})[ \t]+(\S.*?)[ \t]*$/.exec(line.content);
  return match ? { text: line.content, level: match[1].length, number: line.number } : null;
}

function currentSections(lines) {
  const headings = lines.map(headingInfo).filter(Boolean);
  const sections = new Map();
  for (const heading of headings) {
    const endsBefore = headings.find(next => next.number > heading.number && next.level <= heading.level);
    const range = { start: heading.number, end: (endsBefore?.number || lines.length + 1) - 1, heading };
    if (!sections.has(heading.text)) sections.set(heading.text, []);
    sections.get(heading.text).push(range);
  }
  return { headings, sections, frontmatter: frontmatterRange(lines) };
}

function sectionRange(index, section) {
  if (section === 'frontmatter') {
    if (!index.frontmatter) return { error: 'missing' };
    return index.frontmatter;
  }
  const matches = index.sections.get(section) || [];
  if (matches.length !== 1) return { error: matches.length ? 'ambiguous' : 'missing' };
  return matches[0];
}

function occurrences(haystack, needle) {
  const result = [];
  if (!needle) return result;
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) result.push(at);
  return result;
}

function lineForOffset(text, offset) { return text.slice(0, offset).split('\n').length; }

function locateInSection(lines, range, target) {
  if (!range || range.error || !target) return [];
  const sectionText = lines.slice(range.start - 1, range.end).map(line => line.content).join('\n');
  const needle = normalizeNewlines(target);
  return occurrences(sectionText, needle).map(offset => ({
    start: range.start + lineForOffset(sectionText, offset) - 1,
    end: range.start + lineForOffset(sectionText, offset + needle.length - 1) - 1,
    offset,
    length: needle.length
  }));
}

function canonicalDatabaseItem(table, element) {
  if (element.kind === 'table') return `[TIER 1]\nTABLE: ${table}\nEXISTS: ${element.value.exists === true}`;
  if (element.kind === 'column') {
    const value = element.value;
    return `[TIER 1]\nTABLE: ${table}\nCOLUMN: ${value.name}\nTYPE: ${value.type}\nNULLABLE: ${value.nullable}\nDEFAULT: ${value.defaultValue === null ? 'null' : value.defaultValue}\nEXTRA: ${value.extra || ''}`;
  }
  if (element.kind === 'index') return `[TIER 1]\nTABLE: ${table}\nINDEX: ${element.value.keyName}\nCOLUMNS: ${(element.value.columns || []).join(',')}\nUNIQUE: ${element.value.unique === true}`;
  const value = element.value;
  return `[TIER 1]\nTABLE: ${table}\nFOREIGN_KEY: ${value.constraintName}\nCOLUMN: ${value.column}\nREFERENCED_TABLE: ${value.referencedTable}\nREFERENCED_COLUMN: ${value.referencedColumn}\nON_DELETE: ${value.onDelete}`;
}

function canonicalSourceItem(tier, item) {
  const parts = [`[TIER ${tier}]`, `SOURCE: ${normalizePath(item.sourceFile)}`];
  if (item.functionName !== undefined && item.functionName !== null) parts.push(`FUNCTION: ${item.functionName}`);
  if (item.kind !== undefined && item.kind !== null) parts.push(`KIND: ${item.kind}`);
  parts.push(`LINES: ${item.lineStart}-${item.lineEnd}`);
  if (tier === 3) parts.push(`SCOPE: ${item.scope || ''}`, `TABLE_RELEVANT: ${item.tableRelevant === true}`, `MATCHED_TABLES: ${(item.matchedTables || []).join(',')}`);
  parts.push('CONTENT:', item.content);
  return parts.join('\n');
}

function databaseReference(bundle, ref) {
  if (bundle.evidence.live_database_schema.available !== true || typeof ref.table !== 'string' || !ref.table) return null;
  const tableValue = bundle.evidence.live_database_schema.tables[ref.table];
  if (!isObject(tableValue)) return null;
  const elements = [{ kind: 'table', value: tableValue }];
  for (const value of tableValue.columns || []) elements.push({ kind: 'column', value });
  for (const value of tableValue.indexes || []) elements.push({ kind: 'index', value });
  for (const value of tableValue.foreignKeys || []) elements.push({ kind: 'foreignKey', value });
  if (ref.field === null) return { table: ref.table, element: elements[0] };
  const matches = elements.filter(element => element.kind === 'column' ? element.value.name === ref.field : element.kind === 'index' ? element.value.keyName === ref.field : element.kind === 'foreignKey' ? element.value.constraintName === ref.field : false);
  return matches.length === 1 ? { table: ref.table, element: matches[0] } : null;
}

function sourceItems(bundle, tier) {
  if (tier === 2) return bundle.evidence.schema_initialization_code.functions || bundle.evidence.schema_initialization_code.items || [];
  if (tier === 3) return bundle.evidence.service_layer.items || [];
  return bundle.evidence.controllers_and_routes.items || [];
}

function sourceReference(bundle, tier, ref) {
  if (![2, 3, 4].includes(tier) || typeof ref.sourceFile !== 'string' || !Number.isInteger(ref.lineStart) || !Number.isInteger(ref.lineEnd)) return null;
  const matches = sourceItems(bundle, tier).filter(item => normalizePath(item.sourceFile) === normalizePath(ref.sourceFile) && item.lineStart === ref.lineStart && item.lineEnd === ref.lineEnd);
  return matches.length === 1 ? matches[0] : null;
}

function normalizeForQuote(value) { return normalizeNewlines(value).trim().replace(/\s+/g, ' '); }

function longestCommonContiguousLength(left, right) {
  let previous = new Array(right.length + 1).fill(0); let best = 0;
  for (let i = 1; i <= left.length; i++) {
    const current = new Array(right.length + 1).fill(0);
    for (let j = 1; j <= right.length; j++) if (left[i - 1] === right[j - 1]) { current[j] = previous[j - 1] + 1; if (current[j] > best) best = current[j]; }
    previous = current;
  }
  return best;
}

function quoteMatches(quote, canonical) {
  if (canonical.includes(quote)) return true;
  const normalizedQuote = normalizeForQuote(quote); const normalizedCanonical = normalizeForQuote(canonical);
  if (normalizedCanonical.includes(normalizedQuote)) return true;
  return normalizedQuote.length > 0 && longestCommonContiguousLength(normalizedQuote, normalizedCanonical) / normalizedQuote.length > 0.80;
}

function tierReference(bundle, change) {
  const tier = change.evidenceTier; const ref = change.evidenceRef;
  if (![1, 2, 3, 4].includes(tier) || ref.tier !== tier) return null;
  if (tier === 1) {
    if (ref.sourceFile !== null || ref.lineStart !== null || ref.lineEnd !== null) return null;
    const reference = databaseReference(bundle, ref);
    return reference ? { canonical: canonicalDatabaseItem(reference.table, reference.element) } : null;
  }
  if (ref.table !== null || ref.field !== null) return null;
  const item = sourceReference(bundle, tier, ref);
  return item ? { canonical: canonicalSourceItem(tier, item) } : null;
}

const snakePattern = /\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g;
const camelPattern = /\b[a-z]+(?:[A-Z][A-Za-z0-9]*)+\b/g;
function identifierTokens(text) {
  const found = new Set();
  for (const pattern of [snakePattern, camelPattern]) for (const match of String(text).matchAll(pattern)) found.add(match[0]);
  return found;
}

function verifiedIdentifiers(bundle) {
  const result = new Set(); const schema = bundle.evidence.live_database_schema;
  for (const [tableName, table] of Object.entries(schema.tables || {})) {
    result.add(tableName); if (table.tableName) result.add(table.tableName);
    for (const column of table.columns || []) if (nonEmptyString(column.name)) result.add(column.name);
    for (const index of table.indexes || []) if (nonEmptyString(index.keyName)) result.add(index.keyName);
    for (const fk of table.foreignKeys || []) {
      for (const value of [fk.constraintName, fk.referencedTable, fk.referencedColumn]) if (nonEmptyString(value)) result.add(value);
    }
  }
  for (const tier of [2, 3, 4]) for (const item of sourceItems(bundle, tier)) for (const token of identifierTokens(item.content)) result.add(token);
  return result;
}

function statedTarget(bundle, target) {
  const normalized = normalizeNewlines(target);
  return bundle.evidence.existing_okf_stated_facts.blocks.some(block => normalizeNewlines(block.content).includes(normalized));
}

function evidenceSupplied(change) {
  const ref = change.evidenceRef;
  return change.evidenceTier !== null || change.evidenceQuote !== null || ref.tier !== null || ref.sourceFile !== null || ref.lineStart !== null || ref.lineEnd !== null || ref.table !== null || ref.field !== null;
}

function addFailure(result, number, message) {
  if (!result.failures[number]) result.failures[number] = message;
}

function validateOneChange(bundle, proposal, change, current) {
  const result = { change, failures: {}, range: null, sectionRange: null, low: change.confidence === 'LOW', stated: false };
  const actionable = ACTIONABLE.has(change.operation);
  const ref = change.evidenceRef;

  if (actionable) {
    if (![1, 2, 3, 4].includes(change.evidenceTier) || ref.tier !== change.evidenceTier) addFailure(result, 1, 'Check 1: Change proposed without tier 1-4 evidence');
    if (typeof change.evidenceQuote !== 'string' || change.evidenceQuote.trim().length < 10) addFailure(result, 2, 'Check 2: No evidence quote provided for proposed change');
    if (!result.failures[1] && !result.failures[2]) {
      const reference = tierReference(bundle, change);
      if (!reference || !quoteMatches(change.evidenceQuote, reference.canonical)) addFailure(result, 3, 'Check 3: Evidence quote not found in collected evidence');
    } else addFailure(result, 3, 'Check 3: Evidence quote not found in collected evidence');
  } else {
    if (change.operation === 'NO_CHANGE') {
      if (change.evidenceQuote !== null) addFailure(result, 2, 'Check 2: No evidence quote provided for proposed change');
      if (change.section !== null || change.targetContent !== '' || change.proposedContent !== '') addFailure(result, 5, 'Check 5: Target content is stale or ambiguous in the current OKF file');
      const hasNonNullEvidenceRefField = ['tier', 'sourceFile', 'lineStart', 'lineEnd', 'table', 'field'].some(field => ref[field] !== null);
      if (change.evidenceTier !== null || hasNonNullEvidenceRefField) {
        addFailure(result, 1, 'Check 1: Change proposed without tier 1-4 evidence');
      } else if (evidenceSupplied(change)) {
        if (![1, 2, 3, 4, null].includes(change.evidenceTier) || (change.evidenceTier !== null && ref.tier !== change.evidenceTier)) addFailure(result, 1, 'Check 1: Change proposed without tier 1-4 evidence');
        const reference = change.evidenceTier === null ? null : tierReference(bundle, change);
        if (change.evidenceTier !== null && !reference) addFailure(result, 3, 'Check 3: Evidence quote not found in collected evidence');
      }
    } else if (change.operation === 'KEEP') {
      if (!nonEmptyString(change.section) || !nonEmptyString(change.targetContent)) addFailure(result, 5, 'Check 5: Target content is stale or ambiguous in the current OKF file');
      if (change.proposedContent !== change.targetContent) addFailure(result, 5, 'Check 5: Target content is stale or ambiguous in the current OKF file');
      if (evidenceSupplied(change)) {
        if (![1, 2, 3, 4].includes(change.evidenceTier) || ref.tier !== change.evidenceTier) addFailure(result, 1, 'Check 1: Change proposed without tier 1-4 evidence');
        if (typeof change.evidenceQuote !== 'string' || change.evidenceQuote.trim().length < 10) addFailure(result, 2, 'Check 2: No evidence quote provided for proposed change');
        const reference = tierReference(bundle, change);
        if (!reference || !quoteMatches(change.evidenceQuote, reference.canonical)) addFailure(result, 3, 'Check 3: Evidence quote not found in collected evidence');
      }
    }
  }

  if (change.operation !== 'NO_CHANGE') {
    const section = sectionRange(current.index, change.section);
    result.sectionRange = section;
    if (section.error) addFailure(result, 5, 'Check 5: Target section not found in OKF file');
    else {
      const locations = locateInSection(current.lines, section, change.targetContent);
      if (change.operation === 'ADD') {
        if (locations.length !== 1) addFailure(result, 5, 'Check 5: Target content is stale or ambiguous in the current OKF file');
        else result.range = locations[0];
      } else {
        if (locations.length !== 1) addFailure(result, 5, locations.length === 0 ? 'Check 5: Target content is stale or ambiguous in the current OKF file' : 'Check 5: Target content is stale or ambiguous in the current OKF file');
        else result.range = locations[0];
      }
    }
  }

  const check4PrerequisitesPassed = !result.failures[1] && !result.failures[2] && !result.failures[3] && !result.failures[5] && result.range !== null;
  if ((change.operation === 'MODIFY' || change.operation === 'REMOVE') && statedTarget(bundle, change.targetContent) && check4PrerequisitesPassed) {
    result.stated = true;
    const highStatedModifyMayPass = change.operation === 'MODIFY'
      && change.confidence === 'HIGH'
      && change.flagForHumanReview === false
      && [1, 2, 3, 4].includes(change.evidenceTier)
      && ref.tier === change.evidenceTier
      && change.proposedContent.trim().length > 0;
    if (!highStatedModifyMayPass) addFailure(result, 4, 'Check 4: Proposed modification or removal of stated fact requires review');
  }

  if (change.operation === 'ADD' || change.operation === 'MODIFY') {
    const candidates = [...identifierTokens(change.proposedContent)].filter(token => !identifierTokens(change.targetContent).has(token)).sort();
    const verified = verifiedIdentifiers(bundle);
    for (const token of candidates) if (!verified.has(token)) addFailure(result, 6, `Check 6: Proposed content contains unverified identifier: ${token}`);
    if (candidates.some(token => !verified.has(token))) result.failures[6] = candidates.filter(token => !verified.has(token)).map(token => `Check 6: Proposed content contains unverified identifier: ${token}`);
  }

  return result;
}

function failureList(result) {
  const values = [];
  for (let number = 1; number <= 8; number++) {
    const value = result.failures[number];
    if (Array.isArray(value)) values.push(...value);
    else if (value) values.push(value);
  }
  return values;
}

function rangesOverlap(left, right) { return left && right && left.start <= right.end && right.start <= left.end; }

function applyDuplicateCheck(results) {
  for (let i = 0; i < results.length; i++) for (let j = i + 1; j < results.length; j++) {
    const left = results[i]; const right = results[j];
    if (!left.sectionRange || !right.sectionRange || left.sectionRange.error || right.sectionRange.error) continue;
    const sameSection = stableJson(left.change.section) === stableJson(right.change.section);
    if (!sameSection) continue;
    let conflict = false;
    const leftTarget = DUPLICATE_TARGET_OPERATIONS.has(left.change.operation); const rightTarget = DUPLICATE_TARGET_OPERATIONS.has(right.change.operation);
    if (left.change.operation === 'ADD' && right.change.operation === 'ADD') conflict = left.change.targetContent === right.change.targetContent;
    else if (leftTarget && rightTarget) {
      conflict = (left.change.targetContent && right.change.targetContent && (left.change.targetContent.includes(right.change.targetContent) || right.change.targetContent.includes(left.change.targetContent))) || rangesOverlap(left.range, right.range);
    } else if ((left.change.operation === 'ADD' && rightTarget) || (right.change.operation === 'ADD' && leftTarget)) {
      conflict = rangesOverlap(left.range, right.range);
    }
    if (conflict) {
      addFailure(left, 8, 'Check 8: Duplicate changes detected for same section');
      addFailure(right, 8, 'Check 8: Duplicate changes detected for same section');
    }
  }
}

function enrichChange(result, proposal, bundle) {
  const failures = failureList(result);
  const hardFailure = failures.length > 0;
  const proposalGate = proposal.requiresHumanReview || proposal.sourceEvidenceStatus !== 'COMPLETE' || bundle.requiresHumanReview || bundle.evidenceStatus !== 'COMPLETE';
  const finalFlag = result.change.flagForHumanReview || result.low || hardFailure || (ACTIONABLE.has(result.change.operation) && proposalGate);
  const checksPassed = 8 - new Set(Object.keys(result.failures).map(Number)).size;
  return { ...result.change, checksRun: 8, checksPassed, failedChecks: failures, approvedForWrite: ACTIONABLE.has(result.change.operation) && !hardFailure && !finalFlag && !proposalGate, flagForHumanReview: finalFlag };
}

function buildValidatedProposal(proposal, bundle, current, filename) {
  const results = proposal.proposedChanges.map(change => validateOneChange(bundle, proposal, change, current));
  applyDuplicateCheck(results);
  const changes = results.map(result => enrichChange(result, proposal, bundle));
  const actionable = changes.filter(change => ACTIONABLE.has(change.operation));
  const approved = actionable.filter(change => change.approvedForWrite).length;
  const rejected = actionable.filter(change => change.failedChecks.length > 0).length;
  const flagged = changes.filter(change => change.flagForHumanReview).length;
  const allApproved = actionable.every(change => change.approvedForWrite);
  const fileReview = proposal.requiresHumanReview || proposal.sourceEvidenceStatus !== 'COMPLETE' || bundle.requiresHumanReview || bundle.evidenceStatus !== 'COMPLETE' || flagged > 0;
  const ready = actionable.length > 0 && allApproved && !fileReview;
  return {
    ...proposal,
    proposedChanges: changes,
    validationContext: current.validationContext,
    validation: { allActionableChangesApproved: allApproved, approvedActionableChanges: approved, rejectedActionableChanges: rejected, flaggedForHumanReview: flagged > 0 },
    _stage7: { filename, actionableCount: actionable.length, approved, rejected, flagged, ready, allApproved }
  };
}

function publicProposal(proposal) { const result = { ...proposal }; delete result._stage7; return result; }

async function atomicWrite(filePath, content) {
  const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try { await fs.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' }); await fs.rename(temporary, filePath); }
  catch (error) { try { await fs.unlink(temporary); } catch {} throw error; }
}

async function prepareOne(filename) {
  const proposalPath = path.join(proposalDirectory, filename);
  const bundlePath = path.join(bundleDirectory, filename);
  const proposalBytes = await readBytes(proposalPath, `proposal ${filename}`);
  const bundleBytes = await readBytes(bundlePath, `evidence bundle ${filename}`);
  const proposal = parseJsonBytes(proposalBytes, `proposal ${filename}`);
  const bundle = parseJsonBytes(bundleBytes, `evidence bundle ${filename}`);
  validateProposalShape(proposal, filename);
  validateBundleShape(bundle, filename);
  const proposalPathInfo = validateLexicalOkfPath(proposal.okfFile);
  const bundlePathInfo = validateLexicalOkfPath(bundle.okfFile);
  if (proposal.okfFile !== bundle.okfFile || proposalPathInfo.normalized !== bundlePathInfo.normalized) fatal(`Proposal/bundle OKF identity mismatch in ${filename}.`);
  const currentInfo = await resolveCurrentOkf(proposal.okfFile);
  const currentBytes = await readBytes(currentInfo.targetReal, `current OKF ${proposal.okfFile}`);
  const currentText = currentBytes.toString('utf8');
  const currentLines = linesOf(currentText);
  const current = { bytes: currentBytes, lines: currentLines, index: currentSections(currentLines), validationContext: { sourceProposalSha256: sha256(proposalBytes), evidenceBundleSha256: sha256(bundleBytes), currentOkfSha256: sha256(currentBytes) } };
  return { filename, proposal, bundle, current };
}

function summaryFor(validated) {
  const summary = { proposalsValidated: validated.length, changesApproved: 0, changesRejected: 0, flaggedForHumanReview: 0, approvedForWrite: true, filesReadyForWrite: 0, filesBlocked: 0, rejectionReasons: [] };
  const reasons = new Set();
  for (const item of validated) {
    const proposal = item.proposal;
    const internal = proposal._stage7;
    summary.changesApproved += internal.approved;
    summary.changesRejected += internal.rejected;
    summary.flaggedForHumanReview += internal.flagged;
    if (internal.ready) summary.filesReadyForWrite++;
    if (internal.actionableCount > 0 && !internal.ready) summary.filesBlocked++;
    if (internal.actionableCount > 0 && !internal.allApproved) summary.approvedForWrite = false;
    if (proposal.requiresHumanReview || proposal.sourceEvidenceStatus !== 'COMPLETE' || item.bundle.requiresHumanReview || item.bundle.evidenceStatus !== 'COMPLETE') summary.approvedForWrite = false;
    for (const change of proposal.proposedChanges) for (const failure of change.failedChecks) reasons.add(`${failure} in ${item.filename}`);
  }
  summary.rejectionReasons = [...reasons].sort();
  if (summary.flaggedForHumanReview > 0) summary.approvedForWrite = false;
  return summary;
}

async function main() {
  let validated = [];
  try {
    const filenames = (await fs.readdir(proposalDirectory, { withFileTypes: true })).filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => entry.name).sort();
    if (!filenames.length) fatal('No Stage 6 proposal JSON files found.');
    const prepared = [];
    for (const filename of filenames) prepared.push(await prepareOne(filename));
    await fs.mkdir(validatedDirectory, { recursive: true });
    for (const item of prepared) {
      const proposal = buildValidatedProposal(item.proposal, item.bundle, item.current, item.filename);
      validated.push({ ...item, proposal });
      await atomicWrite(path.join(validatedDirectory, item.filename), `${JSON.stringify(publicProposal(proposal), null, 2)}\n`);
    }
    const summary = summaryFor(validated);
    let exitCode = 0;
    if (summary.filesBlocked > 0 && validated.some(item => item.proposal._stage7.actionableCount > 0 && item.proposal._stage7.approved === 0)) exitCode = 2;
    else if (!summary.approvedForWrite || summary.changesRejected > 0) exitCode = 1;
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fatal Error: ${message}`);
    console.log(JSON.stringify({ proposalsValidated: 0, changesApproved: 0, changesRejected: 0, flaggedForHumanReview: 0, approvedForWrite: false, filesReadyForWrite: 0, filesBlocked: 0, rejectionReasons: [], error: message }, null, 2));
    process.exitCode = 3;
  }
}

await main();
