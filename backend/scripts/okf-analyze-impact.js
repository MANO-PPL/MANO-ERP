#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '../..');
const sourceMapPath = path.resolve(repoRoot, 'backend/knowledge/.okf-system/source-map.json');
const stage2Path = path.resolve(repoRoot, 'backend/scripts/okf-detect-changes.js');
const stage3Path = path.resolve(repoRoot, 'backend/scripts/okf-diff-schema.js');

const CLASSIFICATIONS = ['SKIP', 'SECTION_UPDATE', 'FILE_REGENERATE', 'UNKNOWN'];
const STAGE2_CLASSIFICATIONS = [
  'NO_AGENT_IMPACT',
  'LOCAL_OKF_IMPACT',
  'MULTIPLE_OKF_IMPACT',
  'GLOBAL_KNOWLEDGE_IMPACT',
  'UNKNOWN'
];
const MAPPED_STAGE2_CLASSIFICATIONS = [
  'LOCAL_OKF_IMPACT',
  'MULTIPLE_OKF_IMPACT',
  'GLOBAL_KNOWLEDGE_IMPACT'
];
const SCHEMA_CHANGE_TYPES = [
  'TABLE_ADDED',
  'TABLE_REMOVED',
  'COLUMN_ADDED',
  'COLUMN_REMOVED',
  'COLUMN_MODIFIED',
  'INDEX_ADDED',
  'INDEX_REMOVED',
  'FK_ADDED',
  'FK_REMOVED'
];

function normalizePath(value) {
  return typeof value === 'string' ? value.replace(/\\/g, '/') : value;
}

function stableJson(value) {
  return JSON.stringify(value);
}

function fatal(message) {
  throw new Error(message);
}

async function readJson(filePath, description) {
  let text;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    fatal(`Unable to read ${description}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fatal(`Invalid JSON in ${description}: ${error.message}`);
  }
}

function parseArgs(args) {
  const options = {};
  for (const arg of args) {
    if (arg.startsWith('--source-changes=')) options.sourceChangesPath = arg.slice('--source-changes='.length);
    else if (arg.startsWith('--schema-diff=')) options.schemaDiffPath = arg.slice('--schema-diff='.length);
    else fatal(`Unknown argument: ${arg}`);
  }
  return options;
}

function childStreamText(value) {
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (typeof value === 'string') return value;
  return value == null ? '' : String(value);
}

function runChild(scriptPath, label) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true
  });

  if (result.error) fatal(`${label} could not run: ${result.error.message}`);
  if (result.signal) fatal(`${label} terminated by signal ${result.signal}`);

  const stdout = childStreamText(result.stdout);
  const stderr = childStreamText(result.stderr);
  let parsed;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch (error) {
    const diagnostic = stderr.trim() ? ` Diagnostics: ${stderr.trim()}` : '';
    fatal(`${label} produced invalid JSON on stdout: ${error.message}.${diagnostic}`);
  }

  return { data: parsed, exitCode: result.status, stderr };
}

async function loadInput(options, kind) {
  if (kind === 'source') {
    if (options.sourceChangesPath) {
      const filePath = path.resolve(process.cwd(), options.sourceChangesPath);
      return { data: await readJson(filePath, 'source changes input'), exitCode: null };
    }
    return runChild(stage2Path, 'Stage 2 detector');
  }

  if (options.schemaDiffPath) {
    const filePath = path.resolve(process.cwd(), options.schemaDiffPath);
    return { data: await readJson(filePath, 'schema diff input'), exitCode: null };
  }
  return runChild(stage3Path, 'Stage 3 schema diff');
}

function assertArray(value, label) {
  if (!Array.isArray(value)) fatal(`${label} must be an array.`);
}

function assertString(value, label, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) fatal(`${label} must be a non-empty string.`);
}

function validateStage2(data, exitCode) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fatal('Stage 2 result must be an object.');
  assertString(data.timestamp, 'Stage 2 timestamp');
  assertArray(data.changedFiles, 'Stage 2 changedFiles');
  data.changedFiles.forEach((value, index) => assertString(value, `Stage 2 changedFiles[${index}]`));
  if (!data.impactSummary || typeof data.impactSummary !== 'object') fatal('Stage 2 impactSummary must be an object.');

  for (const key of STAGE2_CLASSIFICATIONS) {
    assertArray(data.impactSummary[key], `Stage 2 impactSummary.${key}`);
    data.impactSummary[key].forEach((value, index) => assertString(value, `Stage 2 impactSummary.${key}[${index}]`));
  }
  if (typeof data.requiresOkfUpdate !== 'boolean') fatal('Stage 2 requiresOkfUpdate must be boolean.');
  assertArray(data.affectedOkfFiles, 'Stage 2 affectedOkfFiles');
  data.affectedOkfFiles.forEach((value, index) => assertString(value, `Stage 2 affectedOkfFiles[${index}]`));

  const changedFiles = new Set(data.changedFiles.map(normalizePath));
  const classificationPaths = new Map();
  for (const key of STAGE2_CLASSIFICATIONS) {
    for (const value of data.impactSummary[key]) {
      const normalized = normalizePath(value);
      if (!changedFiles.has(normalized)) fatal(`Stage 2 classification path is absent from changedFiles: ${value}`);
      if (!classificationPaths.has(normalized)) classificationPaths.set(normalized, []);
      classificationPaths.get(normalized).push(key);
    }
  }
  for (const changedFile of changedFiles) {
    const classifications = classificationPaths.get(changedFile) || [];
    if (classifications.length !== 1) {
      fatal(`Stage 2 changed file must appear in exactly one classification bucket: ${changedFile}`);
    }
  }

  const hasImpact = ['LOCAL_OKF_IMPACT', 'MULTIPLE_OKF_IMPACT', 'GLOBAL_KNOWLEDGE_IMPACT']
    .some(key => data.impactSummary[key].length > 0);
  if (data.requiresOkfUpdate !== hasImpact) fatal('Stage 2 requiresOkfUpdate contradicts impactSummary.');

  if (exitCode !== null) {
    const expectedExitCode = data.impactSummary.UNKNOWN.length > 0 ? 2 : hasImpact ? 1 : 0;
    if (exitCode !== expectedExitCode) {
      fatal(`Stage 2 exit code ${exitCode} disagrees with structured result; expected ${expectedExitCode}.`);
    }
  }
}

function validateStage3(data, exitCode) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fatal('Stage 3 result must be an object.');
  assertString(data.snapshotAge, 'Stage 3 snapshotAge');
  assertArray(data.changes, 'Stage 3 changes');
  if (typeof data.hasChanges !== 'boolean') fatal('Stage 3 hasChanges must be boolean.');
  assertArray(data.affectedOkfFiles, 'Stage 3 affectedOkfFiles');
  data.affectedOkfFiles.forEach((value, index) => assertString(value, `Stage 3 affectedOkfFiles[${index}]`));

  if (!data.hasChanges && data.changes.length > 0) fatal('Stage 3 hasChanges contradicts non-empty changes.');
  if (data.hasChanges && data.changes.length === 0) fatal('Stage 3 hasChanges contradicts empty changes.');

  for (const [index, change] of data.changes.entries()) {
    if (!change || typeof change !== 'object' || Array.isArray(change)) fatal(`Stage 3 changes[${index}] must be an object.`);
    assertString(change.table, `Stage 3 changes[${index}].table`);
    if (!SCHEMA_CHANGE_TYPES.includes(change.changeType)) fatal(`Stage 3 changes[${index}] has an invalid changeType.`);
    if (change.detail !== undefined && (change.detail === null || typeof change.detail !== 'object' || Array.isArray(change.detail))) {
      fatal(`Stage 3 changes[${index}].detail must be an object when present.`);
    }
  }
  if (exitCode !== null) {
    const expectedExitCode = data.hasChanges ? 1 : 0;
    if (exitCode !== expectedExitCode) {
      fatal(`Stage 3 exit code ${exitCode} disagrees with structured result; expected ${expectedExitCode}.`);
    }
  }
}

function validateSourceMap(sourceMap) {
  if (!Array.isArray(sourceMap) || sourceMap.length === 0) fatal('source-map.json must contain OKF entries.');
  for (const [index, entry] of sourceMap.entries()) {
    if (!entry || typeof entry !== 'object') fatal(`source-map entry ${index} is invalid.`);
    assertString(entry.okfFile, `source-map entry ${index}.okfFile`);
    assertArray(entry.tables, `source-map entry ${index}.tables`);
    entry.tables.forEach((table, tableIndex) => assertString(table, `source-map entry ${index}.tables[${tableIndex}]`));
    assertArray(entry.primarySources, `source-map entry ${index}.primarySources`);
    entry.primarySources.forEach((source, sourceIndex) => assertString(source, `source-map entry ${index}.primarySources[${sourceIndex}]`));
  }
}

function buildIndexes(sourceMap) {
  const okfFiles = sourceMap.map(entry => entry.okfFile);
  const bySource = new Map();
  const byTable = new Map();
  for (const entry of sourceMap) {
    for (const source of entry.primarySources) {
      const normalized = normalizePath(source);
      if (!bySource.has(normalized)) bySource.set(normalized, []);
      bySource.get(normalized).push(entry.okfFile);
    }
    for (const table of entry.tables) {
      if (!byTable.has(table)) byTable.set(table, []);
      byTable.get(table).push(entry.okfFile);
    }
  }
  return { okfFiles, bySource, byTable };
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function validateStage2Attribution(stage2, indexes, unresolvedEvidence) {
  const mappedBySource = new Map();
  const unknownMappedBySource = new Map();
  for (const rawPath of stage2.changedFiles) {
    const sourcePath = normalizePath(rawPath);
    const classifications = STAGE2_CLASSIFICATIONS.filter(key =>
      stage2.impactSummary[key].some(value => normalizePath(value) === sourcePath)
    );
    const mappedClassifications = classifications.filter(key => MAPPED_STAGE2_CLASSIFICATIONS.includes(key));
    const mapped = indexes.bySource.get(sourcePath) || [];
    if (mappedClassifications.length > 0) {
      mappedBySource.set(sourcePath, sortedUnique(mapped));
    }
    if (classifications.includes('UNKNOWN')) {
      if (mapped.length > 0) {
        unknownMappedBySource.set(sourcePath, sortedUnique(mapped));
        unresolvedEvidence.push({
          type: 'UNKNOWN_MAPPED_SOURCE_CHANGE',
          sourceFile: sourcePath,
          reason: 'Stage 2 reported UNKNOWN source impact for a source mapped to known OKF files.'
        });
      } else {
        unresolvedEvidence.push({
          type: 'UNMAPPED_SOURCE_CHANGE',
          sourceFile: sourcePath,
          reason: 'Stage 2 reported UNKNOWN source impact and the source path is not mapped to an OKF primary source.'
        });
      }
    }
  }

  const deterministicallyMapped = sortedUnique([...mappedBySource.values()].flat());
  const reported = sortedUnique(stage2.affectedOkfFiles);
  const mappedReported = reported.filter(okf => indexes.okfFiles.includes(okf));
  const unknownReported = reported.filter(okf => !indexes.okfFiles.includes(okf));
  if (unknownReported.length > 0 || stableJson(mappedReported) !== stableJson(deterministicallyMapped)) {
    unresolvedEvidence.push({
      type: 'UNMAPPED_SOURCE_CHANGE',
      reason: 'Stage 2 affectedOkfFiles could not be reconciled with primarySources attribution.'
    });
  }

  return { mappedBySource, unknownMappedBySource };
}

function validateStage3Attribution(stage3, indexes, unresolvedEvidence) {
  const derived = [];
  for (const change of stage3.changes) {
    const mapped = indexes.byTable.get(change.table) || [];
    if (mapped.length === 0) {
      unresolvedEvidence.push({
        type: 'UNMAPPED_SCHEMA_TABLE',
        table: change.table,
        reason: 'Schema change table is not mapped to any OKF file.'
      });
    }
    derived.push(...mapped);
  }

  const derivedSet = sortedUnique(derived);
  const reportedSet = sortedUnique(stage3.affectedOkfFiles);
  if (stableJson(derivedSet) !== stableJson(reportedSet)) {
    fatal('Stage 3 affectedOkfFiles disagrees with deterministic table mapping.');
  }
}

function schemaEvidence(change) {
  const detail = change.detail || {};
  if (change.changeType === 'COLUMN_MODIFIED' && detail.column) {
    return `DB diff: ${change.table}.${detail.column} definition changed.`;
  }
  if (detail.column && ['COLUMN_ADDED', 'COLUMN_REMOVED'].includes(change.changeType)) {
    return `DB diff: ${change.table}.${detail.column} ${change.changeType === 'COLUMN_ADDED' ? 'added' : 'removed'}.`;
  }
  return `DB diff: ${change.changeType} for ${change.table}.`;
}

function sourceEvidence(sourceFile, classifications) {
  return classifications.map(classification =>
    `Mapped source file ${sourceFile} changed (${classification}); targeted evidence review is required in Stage 5.`
  );
}

function classificationRank(value) {
  return { SKIP: 0, SECTION_UPDATE: 1, FILE_REGENERATE: 2, UNKNOWN: 3 }[value];
}

function mainAnalysis(stage2, stage3, sourceMap) {
  const indexes = buildIndexes(sourceMap);
  const unresolvedEvidence = [];
  const { mappedBySource, unknownMappedBySource } = validateStage2Attribution(stage2, indexes, unresolvedEvidence);
  validateStage3Attribution(stage3, indexes, unresolvedEvidence);
  const stage2ClassificationBySource = new Map();

  for (const rawPath of stage2.changedFiles) {
    const sourcePath = normalizePath(rawPath);
    const classifications = STAGE2_CLASSIFICATIONS.filter(key =>
      stage2.impactSummary[key].some(value => normalizePath(value) === sourcePath)
    );
    stage2ClassificationBySource.set(sourcePath, classifications);
  }

  const entries = new Map(indexes.okfFiles.map(okfFile => [okfFile, {
    okfFile,
    classification: 'SKIP',
    crossOkfImpact: false,
    reason: 'No mapped source or schema evidence detected.',
    evidence: [],
    requiresHumanReview: false,
    sourceEvidence: [],
    schemaEvidence: [],
    tableEvidence: []
  }]));

  for (const mappedOkfs of unknownMappedBySource.values()) {
    for (const okfFile of mappedOkfs) {
      const entry = entries.get(okfFile);
      entry.classification = 'UNKNOWN';
      entry.requiresHumanReview = true;
    }
  }

  for (const [sourceFile, mappedOkfs] of mappedBySource.entries()) {
    const classifications = stage2ClassificationBySource.get(sourceFile) || [];
    for (const okfFile of mappedOkfs) {
      const entry = entries.get(okfFile);
      entry.sourceEvidence.push(...sourceEvidence(sourceFile, classifications));
      if (classifications.includes('MULTIPLE_OKF_IMPACT')) {
        entry.crossOkfImpact = true;
      }
    }
  }

  for (const change of stage3.changes) {
    const mappedOkfs = indexes.byTable.get(change.table) || [];
    for (const okfFile of mappedOkfs) {
      const entry = entries.get(okfFile);
      entry.schemaEvidence.push(schemaEvidence(change));
      entry.tableEvidence.push(change);
      if (mappedOkfs.length > 1) entry.crossOkfImpact = true;
    }

    if (change.changeType === 'FK_ADDED' || change.changeType === 'FK_REMOVED') {
      const detail = change.detail || {};
      if (typeof detail.referencedTable !== 'string' || detail.referencedTable.length === 0) {
        for (const okfFile of mappedOkfs) {
          entries.get(okfFile).classification = 'UNKNOWN';
          entries.get(okfFile).requiresHumanReview = true;
        }
        unresolvedEvidence.push({
          type: 'UNMAPPED_FK_SCOPE',
          table: change.table,
          reason: 'Foreign-key referencedTable is absent; relationship scope cannot be determined safely.'
        });
      } else {
        const localOkfs = indexes.byTable.get(change.table) || [];
        const referencedOkfs = indexes.byTable.get(detail.referencedTable) || [];
        if (referencedOkfs.length === 0) {
          for (const okfFile of localOkfs) {
            entries.get(okfFile).classification = 'UNKNOWN';
            entries.get(okfFile).requiresHumanReview = true;
          }
          unresolvedEvidence.push({
            type: 'UNMAPPED_FK_SCOPE',
            table: change.table,
            reason: `Foreign-key referenced table ${detail.referencedTable} is not mapped to any OKF file.`
          });
        } else if (new Set([...localOkfs, ...referencedOkfs]).size > 1) {
          for (const okfFile of [...localOkfs, ...referencedOkfs]) entries.get(okfFile).crossOkfImpact = true;
        }
      }
    }
  }

  for (const entry of entries.values()) {
    const hasTableAddedRemoved = entry.tableEvidence.some(change =>
      change.changeType === 'TABLE_ADDED' || change.changeType === 'TABLE_REMOVED'
    );
    const hasEvidence = entry.sourceEvidence.length > 0 || entry.schemaEvidence.length > 0;
    if (entry.classification !== 'UNKNOWN') {
      if (hasTableAddedRemoved) entry.classification = 'FILE_REGENERATE';
      else if (hasEvidence) entry.classification = 'SECTION_UPDATE';
    }
  }

  const indexEntry = entries.get('index.md');
  const coordinatingEntries = [...entries.values()].filter(entry =>
    entry.okfFile !== 'index.md' && (entry.classification === 'SECTION_UPDATE' || entry.classification === 'FILE_REGENERATE')
  );
  if (indexEntry && coordinatingEntries.length > 0) {
    indexEntry.crossOkfImpact = true;
    if (indexEntry.classification === 'SKIP') {
      indexEntry.classification = 'SECTION_UPDATE';
      indexEntry.reason = 'Root knowledge index requires coordinated review because dependent OKF files changed.';
      indexEntry.evidence.push(indexEntry.reason);
    }
    for (const entry of coordinatingEntries) entry.crossOkfImpact = true;
  }

  const unresolvedOkfFiles = new Set();
  for (const unresolved of unresolvedEvidence) {
    if (unresolved.type === 'UNMAPPED_FK_SCOPE' && unresolved.table) {
      for (const okfFile of indexes.byTable.get(unresolved.table) || []) unresolvedOkfFiles.add(okfFile);
    }
  }
  for (const okfFile of unresolvedOkfFiles) {
    const entry = entries.get(okfFile);
    entry.classification = 'UNKNOWN';
    entry.requiresHumanReview = true;
  }

  const impactAnalysis = [...entries.values()].map(entry => {
    const evidence = sortedUnique([...entry.evidence, ...entry.sourceEvidence, ...entry.schemaEvidence]);
    const classification = entry.classification;
    let reason = entry.reason;
    if (classification === 'UNKNOWN') reason = 'Unresolved evidence prevents safe OKF scope determination.';
    else if (classification === 'FILE_REGENERATE') reason = 'Table addition or removal detected for a mapped OKF table.';
    else if (classification === 'SECTION_UPDATE' && reason === 'No mapped source or schema evidence detected.') reason = 'Mapped evidence requires targeted review in Stage 5.';
    return {
      okfFile: entry.okfFile,
      classification,
      crossOkfImpact: entry.crossOkfImpact,
      reason,
      evidence,
      requiresHumanReview: classification === 'UNKNOWN' || entry.requiresHumanReview
    };
  });

  const classifications = Object.fromEntries(CLASSIFICATIONS.map(classification => [
    classification,
    impactAnalysis.filter(entry => entry.classification === classification).length
  ]));
  const summary = {
    totalOkfFilesAffected: impactAnalysis.filter(entry => entry.classification !== 'SKIP').length,
    requiresHumanReview: unresolvedEvidence.length > 0 || impactAnalysis.some(entry => entry.requiresHumanReview),
    classifications,
    crossOkfImpactCount: impactAnalysis.filter(entry => entry.crossOkfImpact).length
  };

  return { impactAnalysis, unresolvedEvidence, summary };
}

function emitFatal(error) {
  console.error(`Fatal Error: ${error.message}`);
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    sourceChanges: null,
    schemaChanges: null,
    unresolvedEvidence: [],
    impactAnalysis: [],
    summary: {
      totalOkfFilesAffected: 0,
      requiresHumanReview: true,
      classifications: { SKIP: 0, SECTION_UPDATE: 0, FILE_REGENERATE: 0, UNKNOWN: 0 },
      crossOkfImpactCount: 0
    },
    error: 'Impact analysis failed'
  }, null, 2));
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const sourceResult = await loadInput(options, 'source');
    const schemaResult = await loadInput(options, 'schema');
    validateStage2(sourceResult.data, sourceResult.exitCode);
    validateStage3(schemaResult.data, schemaResult.exitCode);
    const sourceMap = await readJson(sourceMapPath, 'source-map.json');
    validateSourceMap(sourceMap);
    const analysis = mainAnalysis(sourceResult.data, schemaResult.data, sourceMap);
    const output = {
      timestamp: new Date().toISOString(),
      sourceChanges: sourceResult.data,
      schemaChanges: schemaResult.data,
      unresolvedEvidence: analysis.unresolvedEvidence,
      impactAnalysis: analysis.impactAnalysis,
      summary: analysis.summary
    };
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = analysis.unresolvedEvidence.length > 0
      ? 2
      : analysis.impactAnalysis.some(entry => entry.classification === 'UNKNOWN')
        ? 2
        : analysis.impactAnalysis.some(entry => entry.classification === 'SECTION_UPDATE' || entry.classification === 'FILE_REGENERATE')
          ? 1
          : 0;
  } catch (error) {
    emitFatal(error);
    process.exitCode = 3;
  }
}

await main();
