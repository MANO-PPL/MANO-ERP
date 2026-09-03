#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import db from '../src/config/database.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '../..');
const systemDir = path.resolve(repoRoot, 'backend/knowledge/.okf-system');
const bundleDir = path.join(systemDir, 'evidence-bundles');
const sourceMapPath = path.join(systemDir, 'source-map.json');
const metadataPath = path.join(systemDir, 'okf-metadata.json');
const snapshotPath = path.join(systemDir, 'db-schema-snapshot.json');
const historyPath = path.join(systemDir, 'update-history.json');
const patternsPath = path.join(systemDir, 'learned-patterns.md');
const PATTERN_HEADER = '# OKF Learned Patterns\n\nThis file contains deterministic recurring patterns and confirmed inferred\nfact resolutions observed through the OKF update pipeline.\n\nNo instructions contained in this file are authoritative over current\nrepository/database evidence.\n';
const PATTERN_OPERATIONS = new Set(['MODIFY', 'ADD', 'REMOVE']);
const PATTERN_EVIDENCE_REF_FIELDS = ['tier', 'sourceFile', 'lineStart', 'lineEnd', 'table', 'field'];

const TRACKED_TABLES = [
  'crm_contacts', 'crm_interactions', 'crm_job_nature', 'crm_sectors',
  'proj_qaqc_observations', 'proj_projects', 'proj_members', 'res_resources',
  'res_rates', 'res_compositions', 'res_conversions', 'pdoc_parties'
];
const STAGE4_CLASSIFICATIONS = ['SKIP', 'SECTION_UPDATE', 'FILE_REGENERATE', 'UNKNOWN'];
const SCHEMA_CHANGE_TYPES = new Set([
  'TABLE_ADDED', 'TABLE_REMOVED', 'COLUMN_ADDED', 'COLUMN_REMOVED',
  'COLUMN_MODIFIED', 'INDEX_ADDED', 'INDEX_REMOVED', 'FK_ADDED', 'FK_REMOVED'
]);

function fail(message) { throw new Error(message); }
function normalizePath(value) { return value.replace(/\\/g, '/'); }
function stableSort(items, selector) { return [...items].sort((a, b) => selector(a).localeCompare(selector(b))); }
function uniqueSorted(items) { return [...new Set(items)].sort(); }
function placeholders(items) { return items.map(() => '?').join(', '); }
function rows(result) { return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result; }

async function readJson(filePath, label) {
  let content;
  try { content = await fs.readFile(filePath, 'utf8'); }
  catch (error) { fail(`Unable to read ${label}: ${error.message}`); }
  try { return JSON.parse(content); }
  catch (error) { fail(`Invalid JSON in ${label}: ${error.message}`); }
}

function parseArgs(args) {
  const analysisArg = args.find(arg => arg.startsWith('--analysis='));
  const unknown = args.filter(arg => !arg.startsWith('--analysis='));
  if (unknown.length) fail(`Unknown argument: ${unknown[0]}`);
  return analysisArg ? path.resolve(process.cwd(), analysisArg.slice('--analysis='.length)) : null;
}

async function readAnalysis(filePath) {
  if (filePath) return readJson(filePath, 'Stage 4 analysis');
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  if (!input.trim()) fail('Stage 4 analysis stdin is empty.');
  try { return JSON.parse(input); }
  catch (error) { fail(`Invalid JSON in Stage 4 stdin: ${error.message}`); }
}

function validateAnalysis(analysis) {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) fail('Stage 4 analysis must be an object.');
  if (!analysis.sourceChanges || typeof analysis.sourceChanges !== 'object') fail('Stage 4 sourceChanges is missing.');
  if (!analysis.schemaChanges || typeof analysis.schemaChanges !== 'object') fail('Stage 4 schemaChanges is missing.');
  if (!Array.isArray(analysis.sourceChanges.changedFiles)) fail('Stage 4 sourceChanges.changedFiles must be an array.');
  analysis.sourceChanges.changedFiles.forEach((value, index) => {
    if (typeof value !== 'string' || !value) fail(`Stage 4 sourceChanges.changedFiles[${index}] must be a non-empty string.`);
  });
  if (!Array.isArray(analysis.schemaChanges.changes)) fail('Stage 4 schemaChanges.changes must be an array.');
  if (typeof analysis.schemaChanges.hasChanges !== 'boolean') fail('Stage 4 schemaChanges.hasChanges must be boolean.');
  if (!analysis.schemaChanges.hasChanges && analysis.schemaChanges.changes.length !== 0) fail('Stage 4 schemaChanges.hasChanges=false contradicts non-empty changes.');
  if (analysis.schemaChanges.hasChanges && analysis.schemaChanges.changes.length === 0) fail('Stage 4 schemaChanges.hasChanges=true contradicts empty changes.');
  for (const [index, change] of analysis.schemaChanges.changes.entries()) {
    if (!change || typeof change !== 'object' || Array.isArray(change)) fail(`Stage 4 schemaChanges.changes[${index}] is invalid.`);
    if (typeof change.table !== 'string' || !change.table) fail(`Stage 4 schemaChanges.changes[${index}].table must be a non-empty string.`);
    if (!SCHEMA_CHANGE_TYPES.has(change.changeType)) fail(`Stage 4 schemaChanges.changes[${index}].changeType is invalid.`);
    if (change.detail !== undefined && (change.detail === null || typeof change.detail !== 'object' || Array.isArray(change.detail))) fail(`Stage 4 schemaChanges.changes[${index}].detail must be an object.`);
  }
  if (!Array.isArray(analysis.impactAnalysis)) fail('Stage 4 impactAnalysis must be an array.');
  for (const [index, item] of analysis.impactAnalysis.entries()) {
    if (!item || typeof item !== 'object') fail(`Stage 4 impactAnalysis[${index}] is invalid.`);
    if (typeof item.okfFile !== 'string' || !item.okfFile) fail(`Stage 4 impactAnalysis[${index}].okfFile is invalid.`);
    if (!STAGE4_CLASSIFICATIONS.includes(item.classification)) fail(`Stage 4 impactAnalysis[${index}] classification is invalid.`);
    if (typeof item.crossOkfImpact !== 'boolean' || typeof item.requiresHumanReview !== 'boolean') fail(`Stage 4 impactAnalysis[${index}] flags are invalid.`);
    if (typeof item.reason !== 'string' || !Array.isArray(item.evidence) || item.evidence.some(value => typeof value !== 'string')) fail(`Stage 4 impactAnalysis[${index}] evidence is invalid.`);
  }
}

function validateMetadata(metadata) {
  if (!Array.isArray(metadata.evidenceHierarchy) || metadata.evidenceHierarchy.length === 0) fail('Metadata evidenceHierarchy is missing or invalid.');
  if (metadata.evidenceHierarchy.some(item => typeof item !== 'string' || !item)) fail('Metadata evidenceHierarchy contains an invalid item.');
}

function validateSourceMap(sourceMap) {
  if (!Array.isArray(sourceMap) || sourceMap.length === 0) fail('source-map.json must contain entries.');
  const okfFiles = new Set();
  for (const [index, entry] of sourceMap.entries()) {
    if (!entry || typeof entry !== 'object') fail(`source-map entry ${index} is invalid.`);
    for (const field of ['okfFile', 'tables', 'primarySources', 'schemaInitFunctions']) {
      if (field === 'okfFile') {
        if (typeof entry[field] !== 'string' || !entry[field]) fail(`source-map entry ${index}.okfFile is invalid.`);
        if (okfFiles.has(entry[field])) fail(`source-map contains duplicate okfFile: ${entry[field]}`);
        okfFiles.add(entry[field]);
      } else if (!Array.isArray(entry[field])) fail(`source-map entry ${index}.${field} must be an array.`);
    }
    if (entry.tables.some(item => typeof item !== 'string' || !item) || entry.primarySources.some(item => typeof item !== 'string' || !item) || entry.schemaInitFunctions.some(item => typeof item !== 'string' || !item)) fail(`source-map entry ${index} contains invalid fields.`);
  }
}

function findOpeningBrace(content, start) {
  let quote = null;
  let template = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = start; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) { if (ch === '\\') { i++; continue; } if (ch === quote) quote = null; continue; }
    if (template) { if (ch === '\\') { i++; continue; } if (ch === '`') template = false; continue; }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '`') { template = true; continue; }
    if (ch === '{') return i;
  }
  return -1;
}

function matchingBrace(content, opening) {
  let depth = 0;
  let quote = null;
  let template = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = opening; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) { if (ch === '\\') { i++; continue; } if (ch === quote) quote = null; continue; }
    if (template) { if (ch === '\\') { i++; continue; } if (ch === '`') template = false; continue; }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '`') { template = true; continue; }
    if (ch === '{') depth++;
    if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}

function lineNumber(content, offset) { return content.slice(0, offset).split('\n').length; }

function extractTopLevelFunctions(content, requestedName = null) {
  const found = [];
  let braceDepth = 0;
  let quote = null;
  let template = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) { if (ch === '\\') { i++; continue; } if (ch === quote) quote = null; continue; }
    if (template) { if (ch === '\\') { i++; continue; } if (ch === '`') template = false; continue; }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '`') { template = true; continue; }
    if (ch === '{') { braceDepth++; continue; }
    if (ch === '}') { braceDepth = Math.max(0, braceDepth - 1); continue; }
    if (braceDepth !== 0 || !/[A-Za-z_$]/.test(ch)) continue;
    const lineStart = content.lastIndexOf('\n', i - 1) + 1;
    if (content.slice(lineStart, i).trim()) continue;
    const remainder = content.slice(i);
    if (!/^(?:export\b|async\b|function\b|const\b)/.test(remainder)) continue;
    const match = remainder.match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{|^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:catchAsync\(\s*)?(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/);
    if (!match) continue;
    const name = match[1] || match[2];
    if (requestedName && name !== requestedName) continue;
    const declarationEnd = i + match[0].length;
    const opening = findOpeningBrace(content, declarationEnd - 1);
    const closing = matchingBrace(content, opening);
    if (opening < 0 || closing < 0) continue;
    found.push({ functionName: name, lineStart: lineNumber(content, i), lineEnd: lineNumber(content, closing), content: content.slice(i, closing + 1) });
    i = closing;
  }
  return found;
}

async function readRepoFile(relativePath) {
  const absolute = path.resolve(repoRoot, relativePath);
  try { return await fs.readFile(absolute, 'utf8'); }
  catch { return null; }
}

async function captureLiveSchema() {
  const databaseName = db.client.config.connection.database;
  const inList = placeholders(TRACKED_TABLES);
  const columnResult = await db.raw(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${inList}) ORDER BY TABLE_NAME, ORDINAL_POSITION`, [databaseName, ...TRACKED_TABLES]);
  const indexResult = await db.raw(`SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${inList}) ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`, [databaseName, ...TRACKED_TABLES]);
  const fkResult = await db.raw(`SELECT kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME, rc.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE kcu JOIN information_schema.REFERENTIAL_CONSTRAINTS rc ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA AND rc.TABLE_NAME = kcu.TABLE_NAME AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME WHERE kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME IN (${inList}) AND kcu.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`, [databaseName, ...TRACKED_TABLES]);
  const columns = rows(columnResult);
  const indexes = rows(indexResult);
  const foreignKeys = rows(fkResult);
  const tables = {};
  for (const tableName of TRACKED_TABLES) {
    const tableColumns = columns.filter(row => row.TABLE_NAME === tableName);
    if (!tableColumns.length) { tables[tableName] = { tableName, exists: false }; continue; }
    const grouped = new Map();
    for (const row of indexes.filter(item => item.TABLE_NAME === tableName)) {
      if (!grouped.has(row.INDEX_NAME)) grouped.set(row.INDEX_NAME, { keyName: row.INDEX_NAME, columns: [], unique: Number(row.NON_UNIQUE) === 0 });
      grouped.get(row.INDEX_NAME).columns.push({ sequence: Number(row.SEQ_IN_INDEX), name: row.COLUMN_NAME });
    }
    tables[tableName] = {
      tableName,
      exists: true,
      columns: tableColumns.map(row => ({ name: row.COLUMN_NAME, type: row.COLUMN_TYPE, nullable: row.IS_NULLABLE === 'YES', defaultValue: row.COLUMN_DEFAULT, extra: row.EXTRA || '' })),
      indexes: stableSort([...grouped.values()], item => item.keyName).map(item => ({ keyName: item.keyName, columns: item.columns.sort((a, b) => a.sequence - b.sequence).map(column => column.name), unique: item.unique })),
      foreignKeys: foreignKeys.filter(row => row.TABLE_NAME === tableName).map(row => ({ constraintName: row.CONSTRAINT_NAME, column: row.COLUMN_NAME, referencedTable: row.REFERENCED_TABLE_NAME, referencedColumn: row.REFERENCED_COLUMN_NAME, onDelete: row.DELETE_RULE })).sort((a, b) => a.constraintName.localeCompare(b.constraintName) || a.column.localeCompare(b.column))
    };
  }
  return { capturedAt: new Date().toISOString(), database: databaseName, tables };
}

function markdownBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    const start = i;
    if (/^\s*```/.test(lines[i])) {
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) i++;
      if (i < lines.length) i++;
    } else if (/^\s*#{1,6}\s/.test(lines[i])) i++;
    else if (/^\s*[-*+]\s|^\s*\d+[.)]\s/.test(lines[i])) {
      while (i + 1 < lines.length && /^\s*[-*+]\s|^\s*\d+[.)]\s/.test(lines[i + 1])) i++;
      i++;
    } else if (lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) i++;
    } else {
      i++;
      while (i < lines.length && lines[i].trim() && !/^\s*(?:#|```|[-*+]\s|\d+[.)]\s)/.test(lines[i])) i++;
    }
    const block = lines.slice(start, i).join('\n');
    blocks.push({ lineStart: start + 1, lineEnd: i, content: block });
  }
  return blocks;
}

async function collectFacts(okfFile, warnings, errors) {
  const content = await readRepoFile(`backend/knowledge/${okfFile}`);
  if (content === null) { errors.push(`OKF Markdown file is missing: ${okfFile}`); return { stated: [], inferred: [], unsafe: true }; }
  const blocks = markdownBlocks(content);
  return {
    stated: blocks.filter(block => !block.content.includes('[INFERRED]')),
    inferred: blocks.filter(block => block.content.includes('[INFERRED]')),
    unsafe: false
  };
}

async function collectInitializers(entry, warnings) {
  const functions = [];
  for (const name of entry.schemaInitFunctions) {
    const matches = [];
    for (const sourceFile of entry.primarySources) {
      const content = await readRepoFile(sourceFile);
      if (content === null) continue;
      for (const item of extractTopLevelFunctions(content, name)) matches.push({ ...item, sourceFile });
    }
    if (matches.length === 1) functions.push(matches[0]);
    else if (matches.length === 0) warnings.push(`Initializer ${name} was not found in mapped primary sources.`);
    else warnings.push(`Initializer ${name} has multiple exact matches; none was selected.`);
  }
  return functions;
}

function changedSourcesFor(entry, sourceChanges) {
  const changed = new Set(sourceChanges.changedFiles.map(normalizePath));
  return entry.primarySources.filter(source => changed.has(normalizePath(source)));
}

async function collectSourceItems(entry, analysisEntry, sourceChanges, affectedTables, warnings) {
  const changedSources = changedSourcesFor(entry, sourceChanges);
  const sourceCandidates = entry.primarySources.filter(source => !/(?:Controller|Routes?)\.js$/.test(source));
  const sources = analysisEntry.classification === 'FILE_REGENERATE'
    ? sourceCandidates
    : uniqueSorted(changedSources.filter(source => sourceCandidates.includes(source)));
  const items = [];
  for (const sourceFile of sources) {
    const content = await readRepoFile(sourceFile);
    if (content === null) { warnings.push(`Mapped source file is unavailable: ${sourceFile}`); continue; }
    if (analysisEntry.classification === 'FILE_REGENERATE') {
      items.push({ sourceFile, functionName: null, lineStart: 1, lineEnd: content.split('\n').length, scope: 'FULL_FILE', content });
      continue;
    }
    const functions = extractTopLevelFunctions(content);
    if (!functions.length) {
      items.push({ sourceFile, functionName: null, lineStart: 1, lineEnd: content.split('\n').length, scope: 'FULL_FILE_FALLBACK', tableRelevant: false, matchedTables: [], content });
      warnings.push(`No bounded top-level functions found; full-file fallback used for ${sourceFile}.`);
      continue;
    }
    for (const fn of functions) {
      const matchedTables = affectedTables.filter(table => fn.content.includes(table));
      items.push({ sourceFile, functionName: fn.functionName, lineStart: fn.lineStart, lineEnd: fn.lineEnd, scope: 'FUNCTION', tableRelevant: matchedTables.length > 0, matchedTables, content: fn.content });
    }
  }
  if (analysisEntry.classification === 'SECTION_UPDATE' && affectedTables.length > 0) {
    for (const sourceFile of sourceCandidates.filter(source => !sources.includes(source))) {
      const content = await readRepoFile(sourceFile);
      if (content === null) { warnings.push(`Mapped source file is unavailable: ${sourceFile}`); continue; }
      for (const fn of extractTopLevelFunctions(content)) {
        const matchedTables = affectedTables.filter(table => fn.content.includes(table));
        if (matchedTables.length > 0 && !items.some(item => item.sourceFile === sourceFile && item.functionName === fn.functionName && item.lineStart === fn.lineStart)) {
          items.push({ sourceFile, functionName: fn.functionName, lineStart: fn.lineStart, lineEnd: fn.lineEnd, scope: 'FUNCTION', tableRelevant: true, matchedTables, content: fn.content });
        }
      }
    }
  }
  return stableSort(items, item => `${item.sourceFile}:${String(item.lineStart).padStart(8, '0')}:${item.functionName || ''}`);
}

async function collectControllersRoutes(entry, warnings) {
  const explicitPaths = new Set(entry.primarySources.filter(source => /(?:Controller|Routes?)\.js$/.test(source)));
  const candidates = new Map([...explicitPaths].map(source => [source, { explicit: true, token: null }]));
  for (const source of entry.primarySources.filter(item => /Service\.js$/.test(item))) {
    candidates.set(source.replace(/Service\.js$/, 'Controller.js'), { explicit: false, token: path.basename(source, '.js') });
    candidates.set(source.replace(/Service\.js$/, 'Routes.js'), { explicit: false, token: path.basename(source, '.js').replace(/Service$/, 'Controller') });
  }
  const items = [];
  for (const sourceFile of [...candidates.keys()].sort()) {
    const content = await readRepoFile(sourceFile);
    if (content === null) {
      if (candidates.get(sourceFile).explicit) warnings.push(`Mapped controller or route source is unavailable: ${sourceFile}`);
      continue;
    }
    const candidate = candidates.get(sourceFile);
    if (!candidate.explicit && candidate.token && !content.includes(candidate.token)) continue;
    const functions = extractTopLevelFunctions(content);
    const routeLines = content.split('\n').map((line, index) => ({ line, index })).filter(item => /\brouter\.(get|post|put|patch|delete|use)\b/.test(item.line));
    for (const item of routeLines) {
      items.push({ sourceFile, functionName: null, kind: 'route_registration', lineStart: item.index + 1, lineEnd: item.index + 1, content: item.line });
    }
    if (!functions.length) {
      if (routeLines.length) continue;
      items.push({ sourceFile, functionName: null, kind: 'FULL_FILE_FALLBACK', lineStart: 1, lineEnd: content.split('\n').length, content });
      warnings.push(`Bounded controller or route extraction was unavailable; full-file fallback used for ${sourceFile}.`);
      continue;
    }
    for (const fn of functions) {
      const lines = fn.content.split('\n');
      const selected = lines.map((line, index) => ({ line, index, kind: index === 0 ? 'handler_signature' : controllerLineKind(line) }))
        .filter(item => item.kind !== null);
      let group = [];
      const flush = () => {
        if (!group.length) return;
        items.push({
          sourceFile,
          functionName: fn.functionName,
          kind: group[0].kind,
          lineStart: fn.lineStart + group[0].index,
          lineEnd: fn.lineStart + group[group.length - 1].index,
          content: group.map(item => item.line).join('\n')
        });
        group = [];
      };
      for (const item of selected) {
        if (group.length && item.index !== group[group.length - 1].index + 1) flush();
        group.push(item);
      }
      flush();
    }
  }
  return stableSort(items, item => `${item.sourceFile}:${String(item.lineStart).padStart(8, '0')}:${item.functionName}`);
}

function controllerLineKind(line) {
  if (/\b(router|route)\.(get|post|put|patch|delete|use)\b/.test(line)) return 'route_registration';
  if (/\b(validate|validation|schema|parse|safeParse|z\.)\b/.test(line)) return 'request_validation';
  if (/\b(req\.(params|body|query)|req\[|searchParams|headers)\b/.test(line)) return 'request_extraction';
  if (/\b[A-Za-z_$][\w$]*(?:Service|service)\s*\./.test(line) || /\b(?:await\s+)?(?:[A-Za-z_$][\w$]*Service|service)\s*\(/.test(line)) return 'service_invocation';
  if (/\b(req|res|next)\b/.test(line)) return 'handler_signature';
  return null;
}

function historyEntryIdentity(entry) {
  return typeof entry?.okfFile === 'string' && entry.okfFile
    || typeof entry?.file === 'string' && entry.file
    || Array.isArray(entry?.okfFiles) && entry.okfFiles.length > 0 && entry.okfFiles.every(value => typeof value === 'string' && value) && entry.okfFiles.join(',');
}

function validateHistoryEntries(entries, canonical, warnings) {
  if (!Array.isArray(entries)) {
    warnings.push(canonical ? 'update-history.json updates must be an array.' : 'update-history.json does not contain a supported entries array.');
    return { entries: [], partial: true };
  }
  const valid = [];
  let partial = false;
  entries.forEach((entry, index) => {
    const identity = canonical
      ? typeof entry?.okfFile === 'string' && entry.okfFile
      : historyEntryIdentity(entry);
    const dateValue = entry && (entry.timestamp ?? entry.date);
    const parsedDate = typeof dateValue === 'string' ? Date.parse(dateValue) : Number.NaN;
    const validCanonical = !canonical || Array.isArray(entry?.changesApplied);
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !identity || !Number.isFinite(parsedDate) || !validCanonical) {
      partial = true;
      warnings.push(`update-history.json ${canonical ? 'updates' : 'legacy entry'}[${index}] is malformed and was not trusted.`);
      return;
    }
    valid.push({ entry, parsedDate, index });
  });
  return { entries: valid, partial };
}

async function collectHistory(okfFile, warnings) {
  try { await fs.access(historyPath); }
  catch (error) {
    if (error.code === 'ENOENT') return { available: false, entries: [] };
    warnings.push(`Unable to access update-history.json (${error.code || 'filesystem error'}).`);
    return { available: true, entries: [], partial: true };
  }
  let history;
  try {
    const content = await fs.readFile(historyPath, 'utf8');
    try { history = JSON.parse(content); }
    catch (error) { warnings.push(`Invalid JSON in update-history.json: ${error.message}`); return { available: true, entries: [], partial: true }; }
  } catch (error) {
    warnings.push(`Unable to read update-history.json (${error.code || 'filesystem error'}).`);
    return { available: true, entries: [], partial: true };
  }

  let rawEntries;
  let canonical = false;
  if (Array.isArray(history)) rawEntries = history;
  else if (history && typeof history === 'object' && !Array.isArray(history) && Object.prototype.hasOwnProperty.call(history, 'updates')) {
    canonical = true;
    rawEntries = history.updates;
  } else if (history && typeof history === 'object' && !Array.isArray(history) && Object.prototype.hasOwnProperty.call(history, 'entries')) rawEntries = history.entries;
  else rawEntries = null;

  const validated = validateHistoryEntries(rawEntries, canonical, warnings);
  const selected = validated.entries
    .filter(({ entry }) => entry.okfFile === okfFile || entry.file === okfFile || (Array.isArray(entry.okfFiles) && entry.okfFiles.includes(okfFile)))
    .sort((a, b) => b.parsedDate - a.parsedDate || a.index - b.index)
    .slice(0, 3)
    .map(({ entry }) => entry);
  return { available: true, entries: selected, partial: validated.partial };
}

function parseJsonField(value, label) {
  try { return JSON.parse(value); }
  catch { throw new Error(`${label} is not valid JSON.`); }
}

function parsePatternBlock(lines, start, type) {
  const recurring = type === 'recurring';
  const expectedFields = recurring
    ? ['signature', 'okfFile', 'operation', 'section', 'evidenceTier', 'confidence', 'occurrenceCount']
    : ['resolutionSignature', 'okfFile', 'targetContent', 'evidenceRef'];
  const headerPattern = recurring ? /^## Recurring pattern: (.+)$/ : /^## Confirmed inferred fact resolution: (.+)$/;
  const headerMatch = lines[start].match(headerPattern);
  if (!headerMatch) throw new Error(`invalid ${type} block heading.`);
  const signature = headerMatch[1];
  if (!signature.trim()) throw new Error(`invalid ${type} block signature.`);
  if (start + expectedFields.length >= lines.length + 1) throw new Error(`incomplete ${type} block.`);
  const values = {};
  for (let offset = 0; offset < expectedFields.length; offset++) {
    const field = expectedFields[offset];
    const match = lines[start + 1 + offset].match(new RegExp(`^- ${field}: (.*)$`));
    if (!match) throw new Error(`invalid ${type} block field ${field}.`);
    values[field] = match[1];
  }
  if (recurring && values.signature !== signature) throw new Error('recurring pattern signature does not match its heading.');
  if (!recurring && values.resolutionSignature !== signature) throw new Error('resolution signature does not match its heading.');
  if (!/^[0-9a-f]{64}$/.test(signature)) throw new Error(`${type} block signature is not a lowercase SHA-256 hex value.`);
  if (!values.okfFile) throw new Error(`${type} block okfFile is empty.`);
  if (recurring) {
    if (!PATTERN_OPERATIONS.has(values.operation)) throw new Error('recurring pattern operation is invalid.');
    const section = parseJsonField(values.section, 'recurring pattern section');
    if (typeof section !== 'string' || !section.trim()) throw new Error('recurring pattern section must be a non-empty string.');
    if (!/^[1-4]$/.test(values.evidenceTier)) throw new Error('recurring pattern evidenceTier is invalid.');
    if (values.confidence !== 'HIGH') throw new Error('recurring pattern confidence is invalid.');
    if (values.occurrenceCount !== '3') throw new Error('recurring pattern occurrenceCount is invalid.');
  } else {
    const targetContent = parseJsonField(values.targetContent, 'resolution targetContent');
    if (typeof targetContent !== 'string' || !targetContent.trim()) throw new Error('resolution targetContent must be a non-empty string.');
    const evidenceRef = parseJsonField(values.evidenceRef, 'resolution evidenceRef');
    if (!evidenceRef || typeof evidenceRef !== 'object' || Array.isArray(evidenceRef)) throw new Error('resolution evidenceRef must be an object.');
    const expectedFields = [...PATTERN_EVIDENCE_REF_FIELDS].sort();
    const keys = Object.keys(evidenceRef).sort();
    if (keys.length !== expectedFields.length || keys.some((key, index) => key !== expectedFields[index])) throw new Error('resolution evidenceRef fields are invalid.');
    if (!Number.isInteger(evidenceRef.tier) || evidenceRef.tier < 1 || evidenceRef.tier > 4) throw new Error('resolution evidenceRef.tier is invalid.');
    for (const field of ['sourceFile', 'table', 'field']) if (evidenceRef[field] !== null && typeof evidenceRef[field] !== 'string') throw new Error(`resolution evidenceRef.${field} must be string or null.`);
    for (const field of ['lineStart', 'lineEnd']) if (evidenceRef[field] !== null && !Number.isInteger(evidenceRef[field])) throw new Error(`resolution evidenceRef.${field} must be integer or null.`);
  }
  return start + 1 + expectedFields.length;
}

function validatePatternsContent(content) {
  const normalized = content.replace(/\r\n?/g, '\n');
  if (!normalized.startsWith(PATTERN_HEADER)) throw new Error('learned-patterns.md header is unsupported.');
  const remainder = normalized.slice(PATTERN_HEADER.length);
  if (!remainder.trim()) return normalized;
  const lines = remainder.split('\n');
  let index = 0;
  const recurringSignatures = new Set();
  const resolutionSignatures = new Set();
  while (index < lines.length) {
    if (!lines[index].trim()) { index++; continue; }
    if (/^## Recurring pattern: /.test(lines[index])) {
      const signature = lines[index].slice('## Recurring pattern: '.length);
      if (recurringSignatures.has(signature)) throw new Error('duplicate recurring pattern signature.');
      recurringSignatures.add(signature);
      index = parsePatternBlock(lines, index, 'recurring');
    } else if (/^## Confirmed inferred fact resolution: /.test(lines[index])) {
      const signature = lines[index].slice('## Confirmed inferred fact resolution: '.length);
      if (resolutionSignatures.has(signature)) throw new Error('duplicate resolution signature.');
      resolutionSignatures.add(signature);
      index = parsePatternBlock(lines, index, 'resolution');
    }
    else throw new Error('learned-patterns.md contains an unsupported block or text.');
  }
  return normalized;
}

async function collectPatterns(okfFile, documentedTables, warnings) {
  let content;
  try { content = await fs.readFile(patternsPath, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return { available: false, content: '' };
    warnings.push(`Unable to read learned-patterns.md (${error.code || 'filesystem error'}).`);
    return { available: true, content: '', partial: true };
  }
  try {
    return { available: true, content: validatePatternsContent(content), partial: false };
  } catch (error) {
    warnings.push(`learned-patterns.md is malformed: ${error.message}`);
    return { available: true, content: '', partial: true };
  }
}

function schemaBaseline(snapshot, documentedTables) {
  return Object.fromEntries(documentedTables.filter(table => snapshot.tables?.[table]).map(table => [table, snapshot.tables[table]]));
}

async function atomicWrite(filePath, content) {
  const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try { await fs.writeFile(temporary, content, 'utf8'); await fs.rename(temporary, filePath); }
  catch (error) { try { await fs.unlink(temporary); } catch {} throw error; }
}

async function collectBundle(entry, analysisEntry, stage4, metadata, liveSchema, liveError) {
  const warnings = [];
  const errors = [];
  const documentedTables = [...entry.tables];
  const changedTables = uniqueSorted(stage4.schemaChanges.changes.map(change => change.table));
  const affectedTables = documentedTables.filter(table => changedTables.includes(table)).sort();
  const facts = await collectFacts(entry.okfFile, warnings, errors);
  const initializers = await collectInitializers(entry, warnings);
  const sourceItems = await collectSourceItems(entry, analysisEntry, stage4.sourceChanges, affectedTables, warnings);
  const controllerItems = await collectControllersRoutes(entry, warnings);
  const liveEvidence = liveSchema
    ? { available: true, tables: schemaBaseline(liveSchema, documentedTables) }
    : { available: false, tables: {} };
  if (liveError) warnings.push(`Live database schema unavailable: ${liveError}`);
  const history = await collectHistory(entry.okfFile, warnings);
  const patterns = await collectPatterns(entry.okfFile, documentedTables, warnings);
  const evidenceStatus = facts.unsafe
    ? 'UNSAFE'
    : (liveError || warnings.length > 0 || history.partial || patterns.partial ? 'PARTIAL' : 'COMPLETE');
  return {
    bundle: {
      okfFile: entry.okfFile,
      classification: analysisEntry.classification,
      crossOkfImpact: analysisEntry.crossOkfImpact,
      requiresHumanReview: analysisEntry.requiresHumanReview || evidenceStatus === 'UNSAFE',
      collectedAt: new Date().toISOString(),
      evidenceStatus,
      documentedTables,
      affectedTables,
      changeReason: analysisEntry.reason,
      warnings,
      errors,
      evidenceHierarchy: metadata.evidenceHierarchy,
      evidence: {
        live_database_schema: liveEvidence,
        schema_initialization_code: { functions: initializers },
        service_layer: { items: sourceItems },
        controllers_and_routes: { items: controllerItems },
        existing_okf_stated_facts: { blocks: facts.stated },
        existing_okf_inferred_facts: { blocks: facts.inferred },
        update_history: history,
        learned_patterns: patterns
      }
    },
    warnings,
    errors,
    evidenceStatus
  };
}

function bundleFilename(okfFile) { return `${okfFile.replace(/[\\/]/g, '-').replace(/\.md$/, '')}.json`; }

async function main() {
  let dbUsed = false;
  const summary = { bundlesCreated: [], totalFilesProcessed: 0, skipped: 0, complete: 0, partial: 0, unsafe: 0, warnings: [], errors: [] };
  try {
    const analysis = await readAnalysis(parseArgs(process.argv.slice(2)));
    validateAnalysis(analysis);
    const [sourceMap, metadata] = await Promise.all([readJson(sourceMapPath, 'source-map.json'), readJson(metadataPath, 'okf-metadata.json')]);
    validateSourceMap(sourceMap);
    validateMetadata(metadata);
    const mapByOkf = new Map(sourceMap.map(entry => [entry.okfFile, entry]));
    const requested = analysis.impactAnalysis.filter(item => item.classification !== 'SKIP');
    summary.skipped = analysis.impactAnalysis.length - requested.length;
    for (const item of requested) if (!mapByOkf.has(item.okfFile)) fail(`Stage 4 OKF cannot be reconciled with source-map.json: ${item.okfFile}`);
    let liveSchema = null;
    let liveError = null;
    if (requested.length) {
      dbUsed = true;
      try { liveSchema = await captureLiveSchema(); }
      catch (error) { liveError = error.message; }
    }
    await fs.mkdir(bundleDir, { recursive: true });
    for (const item of requested) {
      const result = await collectBundle(mapByOkf.get(item.okfFile), item, analysis, metadata, liveSchema, liveError);
      const fileName = bundleFilename(item.okfFile);
      await atomicWrite(path.join(bundleDir, fileName), `${JSON.stringify(result.bundle, null, 2)}\n`);
      summary.bundlesCreated.push(fileName);
      summary.totalFilesProcessed++;
      summary[result.evidenceStatus.toLowerCase()]++;
      summary.warnings.push(...result.warnings.map(message => `${item.okfFile}: ${message}`));
      summary.errors.push(...result.errors.map(message => `${item.okfFile}: ${message}`));
    }
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = summary.unsafe > 0 ? 2 : summary.partial > 0 ? 1 : 0;
  } catch (error) {
    console.error(`Fatal Error: ${error.message}`);
    summary.errors.push(error.message);
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 3;
  } finally {
    if (dbUsed) await db.destroy();
  }
}

await main();
