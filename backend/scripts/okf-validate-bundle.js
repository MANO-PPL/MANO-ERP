#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '../..');
const knowledgeRoot = path.resolve(repoRoot, 'backend/knowledge');
const systemRoot = path.join(knowledgeRoot, '.okf-system');
const sourceMapPath = path.join(systemRoot, 'source-map.json');
const metadataPath = path.join(systemRoot, 'okf-metadata.json');
const CHECK_ORDER = ['S1', 'S2', 'S3', 'S4', 'C1', 'C2', 'C3', 'X1', 'X2', 'X3', 'A1', 'A2', 'A3', 'A4'];
const STRUCTURAL = new Set(['S1', 'S2', 'S3', 'S4']);
const ALLOWED_MARKER_SECTIONS = new Set(['Business Rules', 'Relationships', 'Agent Constraints']);
const RELATIONSHIP_CUES = /(?:->|links?|references?|join|via|connects?|1-to-many|many-to-1|relationship|foreign\s+key|table|stored\s+in|rows?\s+in)/i;
const TABLE_CONTEXT = /(?:\btable\b|\btables\b|\bschema\b|stored\s+in|rows?\s+in|references?|foreign\s+key|relationship|join|\bfrom\b|\binto\b|\bupdate\b|\bdelete\b|\bdrop\b|\btruncate\b)/i;
const DESTRUCTIVE_CALL = /\.(delete|del|destroy|remove|drop|truncate)\s*\(/gi;
const STRONG_SQL = [
  /\bSELECT\s+[\s\S]{1,300}?\bFROM\s+[`"A-Za-z_]/i,
  /\bINSERT\s+INTO\s+[`"A-Za-z_][A-Za-z0-9_$`".]*/i,
  /\bUPDATE\s+[`"A-Za-z_][A-Za-z0-9_$`".]*\s+SET\b/i,
  /\bDELETE\s+FROM\s+[`"A-Za-z_][A-Za-z0-9_$`".]*/i,
  /\bDROP\s+TABLE\s+[`"A-Za-z_][A-Za-z0-9_$`".]*/i,
  /\bTRUNCATE\s+TABLE\s+[`"A-Za-z_][A-Za-z0-9_$`".]*/i
];
const STRONG_SQL_LINE = [
  /\bSELECT\s+(?:\*|[A-Za-z_][A-Za-z0-9_$]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_$]*)*)\s+FROM\s+[`"A-Za-z_][A-Za-z0-9_$`".]*/i,
  /\bINSERT\s+INTO\s+[`"A-Za-z_][A-Za-z0-9_$`".]*/i,
  /\bUPDATE\s+[`"A-Za-z_][A-Za-z0-9_$`".]*\s+SET\b/i,
  /\bDELETE\s+FROM\s+[`"A-Za-z_][A-Za-z0-9_$`".]*/i,
  /\bDROP\s+TABLE\s+[`"A-Za-z_][A-Za-z0-9_$`".]*/i,
  /\bTRUNCATE\s+TABLE\s+[`"A-Za-z_][A-Za-z0-9_$`".]*/i
];
const SQL_STATEMENT_START = /^(?:SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/i;
const SQL_GRAMMAR_CUE = /\b(?:FROM|INTO|SET|WHERE|JOIN|VALUES|TABLE)\b|[;=(),]/i;
const SQL_IDENTIFIER_TOKEN = /^(?:[`\"][A-Za-z_][A-Za-z0-9_$.-]*[`\"]|[A-Za-z_][A-Za-z0-9$]*(?:[_.][A-Za-z0-9_$.-]+)+)(?=\s|;|$)/;

class FatalError extends Error {}
function fatal(message) { throw new FatalError(message); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function normalizePath(value) { return typeof value === 'string' ? value.replace(/\\/g, '/') : value; }
function normalizeText(value) { return String(value).replace(/\r\n?/g, '\n'); }
function unique(values) { return [...new Set(values)]; }
function lexicalSort(left, right) { return String(left).localeCompare(String(right)); }

function parseJson(bytes, label) {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch (error) { fatal(`Invalid JSON in ${label}: ${error.message}`); }
}

async function readRequired(filePath, label) {
  try { return await fs.readFile(filePath); }
  catch (error) { fatal(`Unable to read ${label}: ${error.message}`); }
}

function canonicalOkfIdentity(value, label) {
  if (!nonEmptyString(value)) fatal(`${label} must be a non-empty string.`);
  const raw = value;
  const slashNormalized = normalizePath(value);
  const rawSegments = slashNormalized.split('/');
  const rawUnsafe = slashNormalized.startsWith('/')
    || path.posix.isAbsolute(slashNormalized)
    || /^[A-Za-z]:/.test(slashNormalized)
    || rawSegments.some(segment => segment === '..' || segment === '.okf-system');
  const canonical = path.posix.normalize(slashNormalized);
  const segments = canonical.split('/');
  const invalid = rawUnsafe
    || segments.some(segment => segment === '..' || segment === '.okf-system')
    || canonical === '.'
    || canonical === '..'
    || canonical.startsWith('../')
    || !canonical.endsWith('.md');
  return { raw, normalized: canonical, lexicalValid: !invalid };
}

function declaredPath(value, label) { return canonicalOkfIdentity(value, label); }

function validateSourceMapShape(sourceMap) {
  if (!Array.isArray(sourceMap)) fatal('source-map.json must be an array.');
  sourceMap.forEach((entry, index) => {
    if (!isObject(entry)) fatal(`source-map.json[${index}] must be an object.`);
    if (!nonEmptyString(entry.okfFile)) fatal(`source-map.json[${index}].okfFile must be a non-empty string.`);
    if (!Array.isArray(entry.tables) || entry.tables.some(table => !nonEmptyString(table))) fatal(`source-map.json[${index}].tables must be an array of non-empty strings.`);
    if (!Array.isArray(entry.primarySources) || entry.primarySources.some(source => !nonEmptyString(source))) fatal(`source-map.json[${index}].primarySources must be an array of non-empty strings.`);
    if (entry.schemaInitFunctions !== undefined && (!Array.isArray(entry.schemaInitFunctions) || entry.schemaInitFunctions.some(name => !nonEmptyString(name)))) fatal(`source-map.json[${index}].schemaInitFunctions is invalid.`);
  });
}

function metadataDeclarations(metadata) {
  if (!isObject(metadata)) fatal('okf-metadata.json must be an object.');
  if (metadata.totalFiles !== undefined && (!Number.isInteger(metadata.totalFiles) || metadata.totalFiles < 0)) fatal('okf-metadata.json.totalFiles is invalid.');
  const declarations = [];
  const collect = (value, label) => {
    if (!Array.isArray(value)) fatal(`${label} must be an array.`);
    value.forEach((entry, index) => {
      const file = typeof entry === 'string' ? entry : entry?.okfFile;
      if (!nonEmptyString(file)) fatal(`${label}[${index}] must declare a non-empty okfFile.`);
      declarations.push({ path: declaredPath(file, `${label}[${index}]`), entry });
    });
  };
  for (const key of ['okfFiles', 'files', 'entries']) if (metadata[key] !== undefined) collect(metadata[key], `okf-metadata.json.${key}`);
  return declarations;
}

function canonicalMetadataIdentity(value, label) {
  const info = canonicalOkfIdentity(value, label);
  if (!info.lexicalValid) fatal(`${label} is an unsafe OKF identity.`);
  return info.normalized;
}

function validateMetadataPathMaps(metadata) {
  for (const key of ['requiredSections', 'requiredHeadings']) {
    if (metadata[key] === undefined) continue;
    if (!isObject(metadata[key])) fatal(`okf-metadata.json.${key} must be an object keyed by OKF identity.`);
    for (const identity of Object.keys(metadata[key])) canonicalMetadataIdentity(identity, `okf-metadata.json.${key}`);
  }
  for (const key of ['agentConstraintsRequired', 'agentConstraintsApplicability']) {
    const value = metadata[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((identity, index) => canonicalMetadataIdentity(identity, `okf-metadata.json.${key}[${index}]`));
    else if (isObject(value)) Object.keys(value).forEach(identity => canonicalMetadataIdentity(identity, `okf-metadata.json.${key}`));
    else fatal(`okf-metadata.json.${key} must be an array or object.`);
  }
}

function buildExpected(sourceMap, metadata) {
  const byIdentity = new Map();
  const add = (pathInfo, origin, entry) => {
    if (!byIdentity.has(pathInfo.normalized)) byIdentity.set(pathInfo.normalized, { normalized: pathInfo.normalized, declarations: { sourceMap: [], metadata: [] }, lexicalValid: pathInfo.lexicalValid });
    const item = byIdentity.get(pathInfo.normalized);
    item.declarations[origin].push(entry);
    item.lexicalValid = item.lexicalValid && pathInfo.lexicalValid;
  };
  sourceMap.forEach((entry, index) => add(declaredPath(entry.okfFile, `source-map.json[${index}]`), 'sourceMap', entry));
  metadataDeclarations(metadata).forEach(item => add(item.path, 'metadata', item.entry));
  const expected = [...byIdentity.values()].sort((left, right) => lexicalSort(left.normalized, right.normalized));
  if (metadata.totalFiles !== undefined && metadata.totalFiles !== expected.length) fatal(`okf-metadata.json.totalFiles ${metadata.totalFiles} does not match ${expected.length} canonical expected OKF identities.`);
  return expected;
}

function duplicateDeclarations(expected) {
  return expected.filter(item => item.declarations.sourceMap.length > 1 || item.declarations.metadata.length > 1).map(item => item.normalized);
}

async function inspectFile(expected) {
  const result = { ...expected, safe: false, missing: false, symlink: false, escape: false, regular: false, content: null, text: null, document: null };
  if (!expected.lexicalValid) { result.escape = true; return result; }
  const lexical = path.resolve(knowledgeRoot, ...expected.normalized.split('/'));
  let stat;
  try { stat = await fs.lstat(lexical); }
  catch (error) { if (error.code === 'ENOENT') { result.missing = true; return result; } fatal(`Unable to inspect expected OKF ${expected.normalized}: ${error.message}`); }
  if (stat.isSymbolicLink()) { result.symlink = true; return result; }
  const rootReal = await fs.realpath(knowledgeRoot).catch(error => fatal(`Unable to resolve backend/knowledge: ${error.message}`));
  const targetReal = await fs.realpath(lexical).catch(error => { result.escape = true; return null; });
  if (!targetReal) return result;
  const relative = path.relative(rootReal, targetReal);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) { result.escape = true; return result; }
  const targetStat = await fs.stat(targetReal).catch(error => fatal(`Unable to inspect expected OKF ${expected.normalized}: ${error.message}`));
  if (!targetStat.isFile()) { result.regular = false; return result; }
  result.regular = true;
  result.safe = true;
  result.targetReal = targetReal;
  result.content = await fs.readFile(targetReal).catch(error => fatal(`Unable to read expected OKF ${expected.normalized}: ${error.message}`));
  result.text = normalizeText(result.content.toString('utf8'));
  result.document = parseDocument(result.text);
  return result;
}

function parseDocument(text) {
  const lines = text.split('\n');
  const close = lines.slice(1).findIndex(line => line === '---');
  const frontmatter = lines[0] === '---' && close >= 0 ? { start: 0, end: close + 1 } : null;
  const headings = [];
  lines.forEach((line, index) => {
    const match = /^(#{1,6})[ \t]+(\S.*?)[ \t]*$/.exec(line);
    if (match) headings.push({ line: index, level: match[1].length, text: match[2].trim(), raw: line });
  });
  const sections = new Map();
  headings.forEach(heading => {
    const next = headings.find(item => item.line > heading.line && item.level <= heading.level);
    const end = (next?.line ?? lines.length) - 1;
    if (!sections.has(heading.text)) sections.set(heading.text, []);
    sections.get(heading.text).push({ heading, start: heading.line, end });
  });
  const frontmatterEntries = new Map();
  if (frontmatter) for (let line = 1; line < frontmatter.end; line++) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/.exec(lines[line]);
    if (!match) continue;
    if (!frontmatterEntries.has(match[1])) frontmatterEntries.set(match[1], []);
    frontmatterEntries.get(match[1]).push({ line, value: match[2], raw: lines[line] });
  }
  return { lines, frontmatter, frontmatterEntries, headings, sections };
}

function addResult(results, check, file, status, detail) { results.push({ check, file, status, detail }); }
function sectionBody(document, name) { const ranges = document.sections.get(name) ?? []; return ranges.length === 1 ? ranges[0] : null; }
function sectionRanges(document, name) { return document.sections.get(name) ?? []; }
function bodyText(document, range) { return document.lines.slice(range.start + 1, range.end + 1).join('\n'); }
function frontmatterStatus(file, results) {
  if (!file.safe) return;
  const document = file.document;
  if (!document.frontmatter) addResult(results, 'S1', file.normalized, 'FAIL', 'Frontmatter delimiters are missing or malformed.');
  else {
    let ok = true;
    for (const key of ['type', 'title', 'resource', 'tags', 'timestamp']) {
      const entries = document.frontmatterEntries.get(key) ?? [];
      if (entries.length !== 1 || !entries[0].value.trim()) { ok = false; addResult(results, 'S1', file.normalized, 'FAIL', `Frontmatter key ${key} is missing, duplicated, or empty.`); }
    }
    if (ok) addResult(results, 'S1', file.normalized, 'PASS', 'Required frontmatter keys are present.');
  }
}

function validDate(value) {
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }
  match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/.exec(value);
  if (!match) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function timestampCheck(file, results) {
  if (!file.safe || !file.document.frontmatter) return;
  const entries = file.document.frontmatterEntries.get('timestamp') ?? [];
  if (entries.length === 1 && validDate(entries[0].value.trim())) addResult(results, 'S2', file.normalized, 'PASS', 'Timestamp uses a supported valid calendar format.');
  else addResult(results, 'S2', file.normalized, 'FAIL', 'Timestamp is not a supported valid calendar date.');
}

function declaredSectionsFor(file, metadata) {
  const values = [];
  const add = value => {
    if (Array.isArray(value)) values.push(...value);
    else if (typeof value === 'string') values.push(value);
  };
  for (const entry of file.declarations.sourceMap) for (const key of ['requiredSections', 'requiredHeadings', 'sections']) add(entry?.[key]);
  for (const entry of file.declarations.metadata) for (const key of ['requiredSections', 'requiredHeadings', 'sections']) add(entry?.[key]);
  if (isObject(metadata.requiredSections)) for (const [identity, value] of Object.entries(metadata.requiredSections)) if (canonicalMetadataIdentity(identity, 'okf-metadata.json.requiredSections') === file.normalized) add(value);
  if (isObject(metadata.requiredHeadings)) for (const [identity, value] of Object.entries(metadata.requiredHeadings)) if (canonicalMetadataIdentity(identity, 'okf-metadata.json.requiredHeadings') === file.normalized) add(value);
  return unique(values.filter(nonEmptyString));
}

function s3Check(files, metadata, results) {
  let evaluated = false;
  for (const file of files) {
    const required = declaredSectionsFor(file, metadata);
    if (!required.length) continue;
    evaluated = true;
    if (!file.safe) continue;
    for (const declared of required) {
      const title = declared.replace(/^#{1,6}[ \t]+/, '').trim();
      const matches = sectionRanges(file.document, title);
      if (matches.length === 1) addResult(results, 'S3', file.normalized, 'PASS', `Declared section ${title} exists exactly once.`);
      else if (!matches.length) addResult(results, 'S3', file.normalized, 'FAIL', `Declared section ${title} is missing.`);
      else addResult(results, 'S3', file.normalized, 'FAIL', `Declared section ${title} is duplicated.`);
    }
  }
  if (!evaluated) addResult(results, 'S3', '(bundle)', 'PASS', 'No explicitly declared required sections exist in source-map.json or okf-metadata.json.');
}

function s4Check(files, results) {
  for (const file of files) {
    if (file.missing) addResult(results, 'S4', file.normalized, 'FAIL', 'Expected OKF file is missing.');
    else if (file.symlink) addResult(results, 'S4', file.normalized, 'FAIL', 'Expected OKF file is a symbolic link.');
    else if (file.escape) addResult(results, 'S4', file.normalized, 'FAIL', 'Expected OKF file escapes backend/knowledge.');
    else if (!file.regular) addResult(results, file.lexicalValid ? 'S4' : 'S4', file.normalized, 'FAIL', 'Expected OKF path is not a regular file.');
    else if (!file.content || !file.text.trim() || file.text.length < 200) addResult(results, 'S4', file.normalized, 'FAIL', 'OKF content is empty or shorter than 200 characters.');
    else addResult(results, 'S4', file.normalized, 'PASS', 'Expected OKF is a regular non-empty file with sufficient content.');
  }
}

function c1Check(sourceMap, expected, files, results) {
  const tables = unique(sourceMap.flatMap(entry => entry.tables));
  if (!tables.length) { addResult(results, 'C1', '(bundle)', 'PASS', 'No source-map OKF-relevant tables are declared.'); return; }
  for (const table of tables) {
    const owners = sourceMap
      .filter(entry => entry.tables.includes(table))
      .map((entry, index) => ({ entry, index, identity: declaredPath(entry.okfFile, `source-map.json[${index}]`).normalized }));
    const safeOwner = owners.some(owner => {
      const expectedFile = expected.find(file => file.normalized === owner.identity);
      return expectedFile && files.some(file => file.normalized === owner.identity && file.safe && file.regular);
    });
    if (safeOwner) addResult(results, 'C1', '(bundle)', 'PASS', `OKF-relevant table ${table} has at least one safely readable mapped OKF file.`);
    else addResult(results, 'C1', '(bundle)', 'FAIL', `OKF-relevant table ${table} has no safely readable mapped OKF file.`);
  }
}

function c2Check(files, results) {
  for (const file of files) {
    if (file.declarations.sourceMap.length > 1 || file.declarations.metadata.length > 1) addResult(results, 'C2', file.normalized, 'FAIL', 'Normalized OKF identity has ambiguous duplicate declarations within one configuration source.');
    else if (!file.lexicalValid || file.escape) addResult(results, 'C2', file.normalized, 'FAIL', 'Mapped OKF path is unsafe or escapes backend/knowledge.');
    else if (file.missing) addResult(results, 'C2', file.normalized, 'FAIL', 'Mapped OKF file is missing.');
    else if (file.symlink) addResult(results, 'C2', file.normalized, 'FAIL', 'Mapped OKF file is a symbolic link.');
    else if (!file.regular) addResult(results, 'C2', file.normalized, 'FAIL', 'Mapped OKF path is not a regular file.');
    else addResult(results, 'C2', file.normalized, 'PASS', 'Mapped OKF identity resolves to one safe regular file.');
  }
}

function parseLinks(text) {
  const links = [];
  const regex = /!??\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of text.matchAll(regex)) {
    const target = match[1].trim().replace(/^<|>$/g, '');
    if (/\.md(?:[#?].*)?$/i.test(target)) links.push(target);
  }
  return links;
}

function navigationContract(metadata, sourceMap) {
  const values = [];
  for (const object of [metadata, ...sourceMap]) for (const key of ['indexNavigation', 'indexNavigationContract', 'requiredIndexReferences']) if (object?.[key] !== undefined) values.push(object[key]);
  return values.length ? values[0] : null;
}

function normalizeLinkTarget(target) {
  const clean = target.split(/[?#]/, 1)[0];
  if (!clean) return null;
  let decoded;
  try { decoded = decodeURIComponent(clean); } catch { return null; }
  const info = canonicalOkfIdentity(decoded.replace(/\\/g, '/'), 'index link');
  return info.lexicalValid ? info.normalized : null;
}

function c3Check(files, metadata, sourceMap, results) {
  const index = files.find(file => file.normalized === 'index.md');
  const contract = navigationContract(metadata, sourceMap);
  const links = index?.safe ? parseLinks(index.text) : [];
  const expected = files.map(file => file.normalized).filter(file => file !== 'index.md');
  if (contract) {
    const targets = new Set(links.map(normalizeLinkTarget).filter(Boolean));
    for (const target of expected) addResult(results, 'C3', 'index.md', targets.has(target) ? 'PASS' : 'FAIL', targets.has(target) ? `Index references ${target}.` : `Index is missing required reference to ${target}.`);
    return;
  }
  if (!links.length) addResult(results, 'C3', 'index.md', 'WARN', 'No machine-readable OKF navigation convention is declared or present in index.md; complete index coverage cannot be deterministically enforced.');
  else {
    const targets = new Set(links.map(normalizeLinkTarget).filter(Boolean));
    const missing = expected.filter(file => !targets.has(file));
    if (missing.length) addResult(results, 'C3', 'index.md', 'WARN', `Index navigation is incomplete for ${missing.join(', ')}.`);
    else addResult(results, 'C3', 'index.md', 'PASS', 'Observed Markdown navigation references every expected non-root OKF.');
  }
}

function codeSpanClaims(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map(match => ({ token: match[1].trim(), index: match.index, raw: match[0] })).filter(claim => /^[A-Za-z][A-Za-z0-9_.]*$/.test(claim.token));
}

function relationshipClaims(file) {
  const claims = [];
  for (const range of sectionRanges(file.document, 'Relationships')) for (let line = range.start + 1; line <= range.end; line++) {
    const raw = file.document.lines[line];
    if (!RELATIONSHIP_CUES.test(raw)) continue;
    for (const claim of codeSpanClaims(raw)) {
      const token = claim.token.includes('.') ? claim.token.split('.')[0] : claim.token;
      if (!claim.token.includes('.') && (!token.includes('_') || /_id$/i.test(token))) continue;
      if (/^[A-Za-z][A-Za-z0-9_]*$/.test(token)) claims.push({ token, line: line + 1, raw });
    }
  }
  return claims;
}

function x1Check(files, knownTables, results) {
  let evaluated = false;
  for (const file of files) {
    if (!file.safe) continue;
    const claims = relationshipClaims(file);
    if (!claims.length) continue;
    evaluated = true;
    let failed = false;
    for (const claim of claims) {
      if (!knownTables.has(claim.token)) { addResult(results, 'X1', file.normalized, 'FAIL', `Relationship table reference ${claim.token} does not resolve to an exact source-map table identity.`); failed = true; }
      else {
        const owner = files.find(item => item.declarations.sourceMap.some(entry => entry.tables.includes(claim.token)));
        if (!owner || !owner.safe) { addResult(results, 'X1', file.normalized, 'FAIL', `Relationship table ${claim.token} maps to an unavailable OKF.`); failed = true; }
      }
    }
    if (!failed) addResult(results, 'X1', file.normalized, 'PASS', 'Relationship table references resolve to exact known identities.');
  }
  if (!evaluated) addResult(results, 'X1', '(bundle)', 'PASS', 'No deterministic relationship table references required validation.');
}

function contextClaims(file) {
  const claims = [];
  for (const heading of ['Business Rules', 'Relationships', 'Agent Constraints', 'Key Columns / Fields', 'Operational', 'Schema']) for (const range of sectionRanges(file.document, heading)) {
    for (let line = range.start + 1; line <= range.end; line++) {
      const raw = file.document.lines[line];
      for (const claim of codeSpanClaims(raw)) {
        const before = raw.slice(0, claim.index);
        const after = raw.slice(claim.index + claim.raw.length);
        const qualifiedTable = claim.token.includes('.') ? claim.token.split('.')[0] : null;
        const directTable = /(?:\btable\b|\btables\b|\bschema\b)\s*(?:is|:|named|called|uses)?\s*$/i.test(before)
          || /\b(?:FROM|JOIN|INTO|UPDATE|DELETE)\s*$/i.test(before)
          || /^\s*(?:table|tables|schema)\b/i.test(after)
          || /^\s+(?:is|represents)\s+(?:a\s+)?(?:table|schema)\b/i.test(after)
          || (/^\s+(?:stores|contains|holds)\b/i.test(after) && /\b(?:table|schema|database)\b/i.test(raw));
        const relationshipEndpoint = heading === 'Relationships' && RELATIONSHIP_CUES.test(raw) && claim.token.includes('_') && !/_id$/i.test(claim.token);
        if (qualifiedTable || directTable || relationshipEndpoint) claims.push({ token: qualifiedTable ?? claim.token, raw, line: line + 1 });
      }
    }
  }
  return claims;
}

function x2Check(files, knownTables, results) {
  let evaluated = false;
  for (const file of files) {
    if (!file.safe) continue;
    const claims = contextClaims(file);
    if (!claims.length) continue;
    evaluated = true;
    for (const claim of claims) {
      if (knownTables.has(claim.token)) addResult(results, 'X2', file.normalized, 'PASS', `Known table claim ${claim.token} resolves to source-map.`);
      else if (/\[(?:EXTERNAL|ILLUSTRATIVE|HISTORICAL)\]/.test(claim.raw)) addResult(results, 'X2', file.normalized, 'PASS', `Unknown table claim ${claim.token} is explicitly exempted.`);
      else if (/\[(?:INFERRED|UNVERIFIED)\]/.test(claim.raw)) addResult(results, 'X2', file.normalized, 'WARN', `Unknown table claim ${claim.token} is explicitly uncertain.`);
      else addResult(results, 'X2', file.normalized, 'FAIL', `Unknown unmarked concrete table claim ${claim.token} is outside source-map.`);
    }
  }
  if (!evaluated) addResult(results, 'X2', '(bundle)', 'PASS', 'No deterministic unknown concrete table claims were identified.');
}

function markerSectionContract(metadata, sourceMap) {
  const values = [];
  let declared = false;
  for (const object of [metadata, ...sourceMap]) for (const key of ['allowedMarkerSections', 'markerSections', 'markerSectionContract']) {
    if (object?.[key] === undefined) continue;
    declared = true;
    const value = object[key];
    if (Array.isArray(value)) values.push(...value);
    else if (isObject(value)) values.push(...Object.entries(value).filter(([, enabled]) => enabled === true).map(([section]) => section));
    else fatal(`${key} must be an array or object when declared.`);
  }
  if (!declared) return null;
  if (values.some(section => !nonEmptyString(section))) fatal('Marker-section contract contains an invalid section name.');
  return new Set(values.map(section => section.replace(/^#{1,6}[ \t]+/, '').trim()));
}

function x3Check(files, metadata, sourceMap, results) {
  const contract = markerSectionContract(metadata, sourceMap);
  for (const file of files) {
    if (!file.safe) continue;
    const markers = [];
    file.document.lines.forEach((line, index) => { for (const marker of ['[INFERRED]', '[STATED]']) if (line.includes(marker)) markers.push({ marker, index, line }); });
    if (!markers.length) { addResult(results, 'X3', file.normalized, 'PASS', 'No knowledge markers are present.'); continue; }
    let failed = false;
    let warned = false;
    for (const marker of markers) {
      const inFrontmatter = file.document.frontmatter && marker.index < file.document.frontmatter.end;
      const isHeading = /^(#{1,6})[ \t]+/.test(marker.line);
      const containing = [...file.document.sections.entries()]
        .flatMap(([section, ranges]) => ranges.filter(range => marker.index > range.start && marker.index <= range.end).map(range => ({ section, start: range.start, level: range.heading.level })))
        .sort((left, right) => right.start - left.start || left.level - right.level)[0]?.section
        ?? (inFrontmatter ? 'frontmatter' : '(none)');
      const allowedSections = contract ?? ALLOWED_MARKER_SECTIONS;
      const allowed = [...allowedSections].some(section => sectionRanges(file.document, section)
        .some(range => marker.index > range.start && marker.index <= range.end));
      if (inFrontmatter || isHeading || (contract && !allowed)) { addResult(results, 'X3', file.normalized, 'FAIL', `${marker.marker} appears at line ${marker.index + 1} under section "${containing}", outside an allowed knowledge-section body.`); failed = true; }
      else if (!allowed) { addResult(results, 'X3', file.normalized, 'WARN', `${marker.marker} appears at line ${marker.index + 1} under ordinary section "${containing}"; no explicit marker-section contract requires failure.`); warned = true; }
    }
    if (!failed && !warned) addResult(results, 'X3', file.normalized, 'PASS', 'Knowledge markers are confined to allowed section bodies.');
  }
}

function agentFiles(files, metadata) {
  const explicit = metadata.agentConstraintsRequired ?? metadata.agentConstraintsApplicability;
  if (Array.isArray(explicit)) return new Set(explicit.map((identity, index) => canonicalMetadataIdentity(identity, `okf-metadata.agentConstraints[${index}]`)));
  if (isObject(explicit)) return new Set(Object.entries(explicit).filter(([, value]) => value === true).map(([key]) => canonicalMetadataIdentity(key, 'okf-metadata.agentConstraints')));
  return new Set(files.map(file => file.normalized).filter(file => file !== 'index.md'));
}

function a1Check(files, metadata, results, applicableFiles = agentFiles(files, metadata)) {
  for (const file of files) if (applicableFiles.has(file.normalized)) {
    if (!file.safe) addResult(results, 'A1', file.normalized, 'WARN', 'Agent Constraints applicability is known but the OKF cannot be read; structural checks cover the file failure.');
    else if (sectionRanges(file.document, 'Agent Constraints').length === 1) addResult(results, 'A1', file.normalized, 'PASS', 'Required Agent Constraints section exists exactly once.');
    else addResult(results, 'A1', file.normalized, 'FAIL', 'Required Agent Constraints section is missing or duplicated.');
  }
}

function a2Check(files, metadata, results, applicableFiles = agentFiles(files, metadata)) {
  for (const file of files) if (applicableFiles.has(file.normalized) && file.safe) {
    const ranges = sectionRanges(file.document, 'Agent Constraints');
    if (ranges.length === 1 && bodyText(file.document, ranges[0]).trim()) addResult(results, 'A2', file.normalized, 'PASS', 'Agent Constraints section has non-whitespace body content.');
    else addResult(results, 'A2', file.normalized, 'FAIL', 'Agent Constraints section is empty or unavailable.');
  }
}

function maskSource(source) {
  const chars = [...source]; let state = 'code'; let quote = ''; let template = false;
  for (let i = 0; i < chars.length; i++) {
    const current = chars[i]; const next = chars[i + 1];
    if (state === 'line') { if (current === '\n') state = 'code'; else if (current !== '\r') chars[i] = ' '; continue; }
    if (state === 'block') { if (current === '*' && next === '/') { chars[i] = ' '; chars[i + 1] = ' '; i++; state = 'code'; } else if (current !== '\n' && current !== '\r') chars[i] = ' '; continue; }
    if (state === 'string') { if (current === '\\') { chars[i] = ' '; if (i + 1 < chars.length && chars[i + 1] !== '\n') chars[++i] = ' '; } else if (current === quote) { chars[i] = ' '; state = 'code'; } else if (current !== '\n' && current !== '\r') chars[i] = ' '; continue; }
    if (current === '/' && next === '/') { chars[i] = ' '; chars[i + 1] = ' '; i++; state = 'line'; continue; }
    if (current === '/' && next === '*') { chars[i] = ' '; chars[i + 1] = ' '; i++; state = 'block'; continue; }
    if (current === '`') { chars[i] = ' '; state = 'string'; quote = '`'; template = true; continue; }
    if (current === '\'' || current === '"') { chars[i] = ' '; state = 'string'; quote = current; template = false; }
  }
  return chars.join('');
}

function braceDepthAt(masked, position) { let depth = 0; for (let i = 0; i < position; i++) { if (masked[i] === '{') depth++; else if (masked[i] === '}') depth--; } return depth; }
function matchingBrace(masked, start) { let depth = 0; for (let i = start; i < masked.length; i++) { if (masked[i] === '{') depth++; else if (masked[i] === '}' && --depth === 0) return i; } return masked.length - 1; }
function functionRanges(source) {
  const masked = maskSource(source); const ranges = [];
  const patterns = [/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g, /(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g, /(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*catchAsync\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g];
  for (const pattern of patterns) for (const match of masked.matchAll(pattern)) {
    if (braceDepthAt(masked, match.index) !== 0) continue;
    const open = match.index + match[0].lastIndexOf('{'); ranges.push({ name: match[1], start: match.index, end: matchingBrace(masked, open), text: source.slice(match.index, matchingBrace(masked, open) + 1) });
  }
  return ranges.sort((left, right) => left.start - right.start);
}

function matchingParen(source, open) { let depth = 0; let quote = null; for (let i = open; i < source.length; i++) { const c = source[i]; if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; } if (c === '\'' || c === '"' || c === '`') { quote = c; continue; } if (c === '(') depth++; else if (c === ')' && --depth === 0) return i; } return source.length - 1; }
function extractBuilderTable(argument) {
  const literal = /^\s*(['"`])([^'"`]*?)\1/.exec(argument);
  if (!literal || /\$\{/.test(literal[2])) return null;
  return literal[2].trim().split(/\s+as\s+/i)[0].trim() || null;
}

function builderCandidates(source, masked, range) {
  const candidates = [];
  for (const match of masked.matchAll(/\b(db|trx|connection|dbClient)\s*\(/g)) {
    if (match.index < range.start || match.index > range.end) continue;
    const open = masked.indexOf('(', match.index); const close = matchingParen(source, open);
    const assignment = /(?:^|[;\n{])\s*(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*$/.exec(masked.slice(Math.max(range.start, match.index - 160), match.index));
    candidates.push({ start: match.index, close, table: extractBuilderTable(source.slice(open + 1, close)), variable: assignment?.[1] ?? null });
  }
  return candidates;
}

function isContinuousMemberChain(masked, start, end) {
  const text = masked.slice(start, end).trim();
  if (!(text.startsWith('.') || text.startsWith('?.'))) return false;
  let paren = 0; let bracket = 0; let brace = 0;
  for (let index = 0; index < text.length; index++) {
    const current = text[index]; const next = text[index + 1];
    if (current === '(') { paren++; continue; }
    if (current === ')') { if (paren === 0) return false; paren--; continue; }
    if (current === '[') { bracket++; continue; }
    if (current === ']') { if (bracket === 0) return false; bracket--; continue; }
    if (current === '{') { brace++; continue; }
    if (current === '}') { if (brace === 0) return false; brace--; continue; }
    if (paren || bracket || brace) continue;
    if (current === ';' || current === ',' || current === '=' || current === ':' || current === '&' || current === '|') return false;
    if (current === '?' && next !== '.') return false;
  }
  return paren === 0 && bracket === 0 && brace === 0;
}

function hasVariableReassignment(masked, variable, start, end) {
  const escaped = variable.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&');
  const operators = '(?:\\?\\?=|\\|\\|=|&&=|\\*\\*=|<<=|>>>=|>>=|\\+=|-=|\\*=|/=|%=|&=|\\^=|\\|=|=)(?![=>])';
  return new RegExp(`\\b${escaped}\\s*${operators}`).test(masked.slice(start, end));
}

function builderForDestructiveCall(source, masked, methodIndex, range) {
  const candidates = builderCandidates(source, masked, range).filter(candidate => candidate.close < methodIndex);
  const direct = candidates
    .filter(candidate => isContinuousMemberChain(masked, candidate.close + 1, methodIndex + 1))
    .sort((left, right) => right.close - left.close)[0];
  if (direct) return direct;
  const before = masked.slice(range.start, methodIndex);
  let invalidLocalTrace = false;
  for (const candidate of candidates.filter(item => item.variable).sort((left, right) => right.close - left.close)) {
    const escaped = candidate.variable.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&');
    const occurrences = [...before.matchAll(new RegExp(`\\b${escaped}\\b`, 'g'))];
    const last = occurrences.at(-1);
    if (!last || range.start + last.index < candidate.close) continue;
    const afterAssignment = masked.slice(candidate.close + 1, range.start + last.index);
    if (hasVariableReassignment(masked, candidate.variable, candidate.close + 1, range.start + last.index)) { invalidLocalTrace = true; continue; }
    if (isContinuousMemberChain(masked, range.start + last.index + candidate.variable.length, methodIndex + 1)) return candidate;
  }
  return invalidLocalTrace ? { table: null, unresolved: true } : null;
}

function rawOperations(source, ranges) {
  const operations = []; const masked = maskSource(source);
  for (const match of masked.matchAll(/\b(db|trx|connection)\.raw\s*\(/g)) {
    const open = masked.indexOf('(', match.index); const close = matchingParen(source, open); const argument = source.slice(open + 1, close);
    const actionMatch = /\b(ALTER\s+TABLE|DROP\s+TABLE|DROP\s+INDEX|DROP\s+FOREIGN\s+KEY|TRUNCATE\s+TABLE)\b/i.exec(argument);
    if (!actionMatch) continue;
    const alter = /\bALTER\s+TABLE\s+[`"']?([A-Za-z_][A-Za-z0-9_]*)/i.exec(argument);
    const direct = /\b(?:DROP\s+TABLE|TRUNCATE\s+TABLE)\s+[`"']?([A-Za-z_][A-Za-z0-9_]*)/i.exec(argument);
    const dropIndexOn = /\bDROP\s+INDEX\s+[`"']?[A-Za-z_][A-Za-z0-9_]*[`"']?\s+ON\s+[`"']?([A-Za-z_][A-Za-z0-9_]*)/i.exec(argument);
    const range = ranges.filter(item => item.start <= match.index && item.end >= match.index).sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
    operations.push({ functionName: range?.name ?? null, action: actionMatch[1].toUpperCase(), table: alter?.[1] ?? direct?.[1] ?? dropIndexOn?.[1] ?? null, position: match.index });
  }
  return operations;
}

function exactIdentifierInText(text, identifier) {
  if (!nonEmptyString(identifier)) return false;
  const escaped = identifier.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&');
  return new RegExp(`(^|[^A-Za-z0-9_$])${escaped}(?![A-Za-z0-9_$])`).test(text);
}

function sourcePathInfo(sourceFile) {
  const raw = sourceFile;
  if (!nonEmptyString(sourceFile)) return { raw, normalized: sourceFile, canonical: null, rawUnsafe: true, a3Candidate: true, key: `unsafe:${String(sourceFile)}` };
  const normalized = normalizePath(sourceFile);
  const rawSegments = normalized.split('/');
  const absolute = normalized.startsWith('/') || path.posix.isAbsolute(normalized);
  const driveQualified = /^[A-Za-z]:/.test(normalized);
  const rawUnsafe = absolute || driveQualified || rawSegments.some(segment => segment === '..');
  const canonical = path.posix.normalize(normalized);
  const insideSourceRoot = canonical.startsWith('backend/src/') && canonical !== 'backend/src/';
  return { raw, normalized, canonical, rawUnsafe, a3Candidate: insideSourceRoot || normalized === 'backend/src' || absolute || driveQualified || rawSegments.includes('..'), key: rawUnsafe ? `unsafe:${normalized}` : `safe:${canonical}`, readable: !rawUnsafe && insideSourceRoot };
}

function canonicalSourceIdentity(sourceFile) {
  return sourcePathInfo(sourceFile).canonical;
}

function operationIdentity(operation) {
  return [
    canonicalSourceIdentity(operation.sourceFile),
    operation.position,
    operation.functionName ?? '',
    operation.action,
    operation.table ?? ''
  ].join('|');
}

function discoverMappedOperations(files) {
  const declarations = files.flatMap(file => file.declarations.sourceMap.map(entry => ({ okfFile: file.normalized, entry })));
  const sourceInfos = [...new Map(declarations.flatMap(({ entry }) => (entry.primarySources ?? []).map(sourcePathInfo))
    .filter(info => info.a3Candidate).map(info => [info.key, info])).values()]
    .sort((left, right) => lexicalSort(left.key, right.key));
  const operationsBySource = new Map();
  const warningsBySource = new Map();
  for (const sourceInfo of sourceInfos) {
    if (!sourceInfo.readable) {
      warningsBySource.set(sourceInfo.key, `Mapped service source ${sourceInfo.raw} is unsafe and was not read for destructive-operation verification.`);
      continue;
    }
    const sourceResult = readMappedServiceSource(sourceInfo.canonical);
    if (!sourceResult.source) { warningsBySource.set(sourceInfo.key, sourceResult.warning); continue; }
    const source = sourceResult.source;
    const ranges = functionRanges(source); const masked = maskSource(source);
    const operations = [];
    for (const match of masked.matchAll(/\.(delete|del|destroy|remove|drop|truncate)\s*\(/gi)) {
      const range = ranges.filter(item => item.start <= match.index && item.end >= match.index)
        .sort((a, b) => (a.end - a.start) - (b.end - b.start) || (a.start - b.start))[0];
      const builder = builderForDestructiveCall(source, masked, match.index, range ?? { start: 0, end: source.length });
      if (!builder) continue;
      operations.push({ sourceFile: sourceInfo.canonical, sourceKey: sourceInfo.key, functionName: range?.name ?? null, action: `.${match[1]}()`, table: builder.table, position: match.index });
    }
    for (const operation of rawOperations(source, ranges)) operations.push({ ...operation, sourceFile: sourceInfo.canonical, sourceKey: sourceInfo.key });
    const deduplicated = [...new Map(operations.map(operation => [operationIdentity(operation), operation])).values()]
      .sort((left, right) => left.position - right.position || lexicalSort(left.action, right.action) || lexicalSort(left.functionName ?? '', right.functionName ?? '') || lexicalSort(left.table ?? '', right.table ?? ''));
    operationsBySource.set(sourceInfo.key, deduplicated);
  }
  return { declarations, sourceInfos, operationsBySource, warningsBySource };
}

function a3Check(files, applicableFiles, results) {
  const { declarations, sourceInfos, operationsBySource, warningsBySource } = discoverMappedOperations(files);
  const exemptWarnings = new Set();
  for (const file of files) {
    if (!file.safe) continue;
    const sourceEntries = [...new Map(file.declarations.sourceMap.flatMap(entry => (entry.primarySources ?? []).map(sourcePathInfo))
      .filter(info => info.a3Candidate).map(info => [info.key, info])).values()];
    let emitted = false;
    for (const sourceInfo of sourceEntries) {
      if (warningsBySource.has(sourceInfo.key)) {
        addResult(results, 'A3', file.normalized, 'WARN', warningsBySource.get(sourceInfo.key));
        emitted = true;
        continue;
      }
      for (const operation of operationsBySource.get(sourceInfo.key) ?? []) {
        const prefix = `${operation.functionName ?? 'anonymous'} (${operation.action}) on ${operation.table ?? '<unknown table>'} from ${operation.sourceFile} for ${file.normalized}`;
        if (!operation.table) {
          addResult(results, 'A3', file.normalized, 'WARN', `Destructive operation ${prefix} could not be deterministically mapped to an OKF table.`);
          emitted = true;
          continue;
        }
        const owners = unique(declarations
          .filter(({ entry }) => (entry.primarySources ?? []).some(source => {
            const info = sourcePathInfo(source);
            return !info.rawUnsafe && info.canonical === operation.sourceFile;
          })
            && entry.tables.includes(operation.table))
          .map(({ okfFile }) => okfFile));
        if (!owners.length) {
          addResult(results, 'A3', file.normalized, 'WARN', `Destructive operation ${prefix} could not be mapped to any OKF owning both the source and table.`);
          emitted = true;
          continue;
        }
        const constraintOwners = owners.filter(owner => applicableFiles.has(owner));
        if (!constraintOwners.length) {
          const warningKey = operationIdentity(operation);
          if (!exemptWarnings.has(warningKey)) {
            addResult(results, 'A3', '(bundle)', 'WARN', `Destructive operation ${prefix} maps only to OKFs exempt from Agent Constraints applicability; deterministic safety coverage cannot be enforced.`);
            exemptWarnings.add(warningKey);
          }
          continue;
        }
        if (!constraintOwners.includes(file.normalized)) continue;
        const units = constraintUnits(file);
        const covered = units.some(unit => (operation.functionName && exactIdentifierInText(unit, operation.functionName))
          || (exactIdentifierInText(unit, operation.table) && new RegExp(`\\b(?:delete|remove|destroy|drop|truncate)\\w*\\b`, 'i').test(unit)));
        addResult(results, 'A3', file.normalized, covered ? 'PASS' : 'FAIL', covered ? `Mapped destructive operation ${prefix} has deterministic Agent Constraints coverage.` : `Mapped destructive operation ${prefix} has no deterministic Agent Constraints coverage.`);
        emitted = true;
      }
    }
    const hasMappedOperation = sourceEntries.some(sourceInfo => (operationsBySource.get(sourceInfo.key) ?? []).length > 0);
    if (!emitted && !hasMappedOperation) addResult(results, 'A3', file.normalized, 'PASS', 'No verified destructive service operation is mapped to this OKF.');
  }
  if (!results.some(result => result.check === 'A3')) addResult(results, 'A3', '(bundle)', 'PASS', 'No mapped destructive service operations were found.');
}

function requireRead(filePath) {
  let data;
  try { data = fsSync.readFileSync(filePath, 'utf8'); } catch (error) { throw error; }
  return data;
}

function readMappedServiceSource(sourceFile) {
  const normalized = normalizePath(sourceFile);
  const rawSegments = normalized.split('/');
  const canonical = path.posix.normalize(normalized);
  const unsafe = normalized.startsWith('/') || path.posix.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)
    || rawSegments.some(segment => segment === '..') || !canonical.startsWith('backend/src/') || canonical === 'backend/src/';
  if (unsafe) return { warning: `Mapped service source ${sourceFile} is unsafe and was not read for destructive-operation verification.` };
  const sourceRoot = path.resolve(repoRoot, 'backend/src');
  const lexical = path.resolve(repoRoot, ...canonical.split('/'));
  let rootReal;
  try { rootReal = fsSync.realpathSync.native(sourceRoot); } catch { return { warning: `Mapped service source ${sourceFile} is unavailable for destructive-operation verification.` }; }
  let stat;
  try { stat = fsSync.lstatSync(lexical); } catch { return { warning: `Mapped service source ${sourceFile} is unavailable for destructive-operation verification.` }; }
  if (stat.isSymbolicLink()) return { warning: `Mapped service source ${sourceFile} is a symbolic link and was not read for destructive-operation verification.` };
  let targetReal;
  try { targetReal = fsSync.realpathSync.native(lexical); } catch { return { warning: `Mapped service source ${sourceFile} is unavailable for destructive-operation verification.` }; }
  const relative = path.relative(rootReal, targetReal);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return { warning: `Mapped service source ${sourceFile} escapes backend/src and was not read for destructive-operation verification.` };
  let targetStat;
  try { targetStat = fsSync.statSync(targetReal); } catch { return { warning: `Mapped service source ${sourceFile} is unavailable for destructive-operation verification.` }; }
  if (!targetStat.isFile()) return { warning: `Mapped service source ${sourceFile} is not a regular file and was not read for destructive-operation verification.` };
  try { return { source: fsSync.readFileSync(targetReal, 'utf8') }; }
  catch { return { warning: `Mapped service source ${sourceFile} is unavailable for destructive-operation verification.` }; }
}

function isA3SourceCandidate(sourceFile) {
  const normalized = normalizePath(sourceFile);
  const rawSegments = normalized.split('/');
  return normalized.startsWith('backend/src/') || normalized === 'backend/src'
    || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) || rawSegments.includes('..');
}

function constraintUnits(file) {
  const range = sectionBody(file.document, 'Agent Constraints');
  if (!range) return [];
  const units = []; let current = [];
  const finish = () => { if (current.length) units.push(current.join('\n')); current = []; };
  for (let line = range.start + 1; line <= range.end; line++) {
    const value = file.document.lines[line];
    if (!value.trim()) { finish(); continue; }
    if (/^\s*[-*+]\s+/.test(value) && current.length) finish();
    current.push(value);
  }
  finish();
  return units;
}

function a4Check(files, results) {
  for (const file of files) {
    if (!file.safe) continue;
    const body = file.document.frontmatter ? file.document.lines.slice(file.document.frontmatter.end + 1).join('\n') : file.text;
    const fencedBlocks = [...body.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(match => match[1]);
    const withoutFences = body.replace(/```[^\n]*\n[\s\S]*?```/g, '');
    const inlineSql = [...withoutFences.matchAll(/`([^`\n]+)`/g)].map(match => match[1]);
    const fencedStrong = fencedBlocks.some(block => STRONG_SQL.some(pattern => pattern.test(block)));
    const sameLineStrong = withoutFences.split('\n').some(line => STRONG_SQL_LINE.some(pattern => pattern.test(line)));
    const inlineStrong = inlineSql.some(value => STRONG_SQL_LINE.some(pattern => pattern.test(value)));
    if (fencedStrong || sameLineStrong || inlineStrong) addResult(results, 'A4', file.normalized, 'FAIL', 'Strong executable raw SQL statement detected in OKF content.');
    else {
      const localFragments = [
        ...fencedBlocks.flatMap(block => block.split('\n')),
        ...inlineSql,
        ...withoutFences
          .split('\n')
          .map(line => line.replace(/`[^`\n]+`/g, ''))
      ];
      const locallyAmbiguous = localFragments.some(fragment => {
        const trimmed = fragment.trim().replace(/^[-*+]\s+/, '');
        if (!SQL_STATEMENT_START.test(trimmed)) return false;
        const remainder = trimmed.replace(SQL_STATEMENT_START, '').trim();
        if (!remainder) return false;
        return SQL_GRAMMAR_CUE.test(remainder) || SQL_IDENTIFIER_TOKEN.test(remainder);
      });
      if (locallyAmbiguous) addResult(results, 'A4', file.normalized, 'WARN', 'SQL-like content is ambiguous and requires developer inspection.');
      else addResult(results, 'A4', file.normalized, 'PASS', 'No strong executable raw SQL statement detected.');
    }
  }
}

function aggregate(results) {
  const aggregateByCheck = new Map(CHECK_ORDER.map(check => [check, 'PASS']));
  for (const check of CHECK_ORDER) {
    const statuses = results.filter(result => result.check === check).map(result => result.status);
    aggregateByCheck.set(check, statuses.includes('FAIL') ? 'FAIL' : statuses.includes('WARN') ? 'WARN' : 'PASS');
  }
  const passed = [...aggregateByCheck.values()].filter(status => status === 'PASS').length;
  const failed = [...aggregateByCheck.values()].filter(status => status === 'FAIL').length;
  const warnings = [...aggregateByCheck.values()].filter(status => status === 'WARN').length;
  const structuralFailure = CHECK_ORDER.filter(check => STRUCTURAL.has(check)).some(check => aggregateByCheck.get(check) === 'FAIL');
  return { passed, failed, warnings, bundleIsStructurallyValid: !structuralFailure, bundleIsAgentSafe: !structuralFailure && failed === 0 };
}

async function main() {
  const sourceMap = parseJson(await readRequired(sourceMapPath, 'source-map.json'), 'source-map.json');
  const metadata = parseJson(await readRequired(metadataPath, 'okf-metadata.json'), 'okf-metadata.json');
  validateSourceMapShape(sourceMap);
  validateMetadataPathMaps(metadata);
  const expected = buildExpected(sourceMap, metadata);
  const files = await Promise.all(expected.map(inspectFile));
  const results = [];
  const duplicatePaths = duplicateDeclarations(expected);
  for (const file of files) if (duplicatePaths.includes(file.normalized)) addResult(results, 'C2', file.normalized, 'FAIL', 'Normalized OKF identity has ambiguous duplicate declarations within one configuration source.');
  for (const file of files) frontmatterStatus(file, results);
  for (const file of files) timestampCheck(file, results);
  s3Check(files, metadata, results);
  s4Check(files, results);
  c1Check(sourceMap, expected, files, results);
  c2Check(files.filter(file => !duplicatePaths.includes(file.normalized)), results);
  c3Check(files, metadata, sourceMap, results);
  const knownTables = new Set(sourceMap.flatMap(entry => entry.tables));
  x1Check(files, knownTables, results);
  x2Check(files, knownTables, results);
  x3Check(files, metadata, sourceMap, results);
  const applicableAgentFiles = agentFiles(files, metadata);
  a1Check(files, metadata, results, applicableAgentFiles);
  a2Check(files, metadata, results, applicableAgentFiles);
  a3Check(files, applicableAgentFiles, results);
  a4Check(files, results);
  results.sort((left, right) => CHECK_ORDER.indexOf(left.check) - CHECK_ORDER.indexOf(right.check) || lexicalSort(left.file, right.file) || lexicalSort(left.detail, right.detail));
  const summary = aggregate(results);
  console.log(JSON.stringify({ validatedAt: new Date().toISOString(), totalFiles: files.length, checksRun: CHECK_ORDER.length, ...summary, results }, null, 2));
  process.exitCode = summary.bundleIsStructurallyValid ? (summary.bundleIsAgentSafe ? 0 : 1) : 2;
}

try { await main(); }
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal Error: ${message}`);
  console.log(JSON.stringify({ validatedAt: new Date().toISOString(), totalFiles: 0, checksRun: CHECK_ORDER.length, passed: 0, failed: 0, warnings: 0, bundleIsStructurallyValid: false, bundleIsAgentSafe: false, results: [], error: message }, null, 2));
  process.exitCode = 3;
}
