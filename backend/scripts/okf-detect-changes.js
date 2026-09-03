#!/usr/bin/env node

/**
 * okf-detect-changes.js
 *
 * Stage 2 OKF Change Detector script for MANO-ERP.
 * Analyzes Git diffs or specified files and classifies changes based on
 * their impact on the Operational Knowledge Framework (OKF) knowledge base.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

// ---------------------------------------------------------------------------
// Constants & Configuration
// ---------------------------------------------------------------------------

const KNOWN_INITIALIZERS = [
  'initializeCrmSchema',
  'initializeQualitySchema',
  'initializeProjectSchema',
  'initializeResourceSchema',
  'initializeProjectPartiesSchema',
  'initializeProjectResourceSchema'
];

const SCHEMA_DDL_PATTERNS = [
  /\bCREATE\s+TABLE\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bADD\s+COLUMN\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bMODIFY\s+COLUMN\b/i,
  /\bCREATE\s+INDEX\b/i,
  /\bADD\s+CONSTRAINT\b/i,
  /\bFOREIGN\s+KEY\b/i,
  /\bREFERENCES\b/i,
  /\bENUM\b/i,
  /\btable\.(?:integer|bigInteger|string|text|boolean|json|dateTime|decimal|enu|float|double|uuid|binary|enum)\s*\(/i,
  /\btable\.(?:dropColumn|dropForeign|dropIndex|dropUnique|renameColumn)\s*\(/i,
  /\bdb\.schema\.(?:createTable|alterTable|dropTable|renameTable)\s*\(/i
];

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function normalizePath(p) {
  if (!p) return '';
  let normalized = p.replace(/\\/g, '/');
  if (normalized.startsWith('./')) normalized = normalized.slice(2);
  if (normalized.startsWith('/')) normalized = normalized.slice(1);
  return normalized;
}

function toRepoRelativePath(inputPath, repoRoot) {
  if (!inputPath) return '';
  const raw = normalizePath(inputPath);
  if (!repoRoot) return raw;

  const root = normalizePath(repoRoot);
  const absolute = path.isAbsolute(inputPath) ? normalizePath(inputPath) : normalizePath(path.resolve(repoRoot, inputPath));

  if (absolute === root || absolute.startsWith(root + '/')) {
    const rel = normalizePath(path.relative(root, absolute));
    return rel || raw;
  }

  if (raw.startsWith(root + '/')) {
    return normalizePath(raw.slice(root.length + 1));
  }

  return raw;
}

function getComparablePathCandidates(inputPath, repoRoot) {
  const candidates = new Set();
  if (!inputPath) return [];

  const raw = normalizePath(inputPath);
  const repoRelative = toRepoRelativePath(inputPath, repoRoot);

  candidates.add(raw);
  candidates.add(repoRelative);

  if (repoRoot) {
    const root = normalizePath(repoRoot);
    const absolute = path.isAbsolute(inputPath) ? normalizePath(inputPath) : normalizePath(path.resolve(repoRoot, inputPath));
    const absIfInRepo = absolute.startsWith(root + '/') ? absolute : null;
    if (absIfInRepo) {
      candidates.add(normalizePath(path.relative(root, absIfInRepo)));
    }
  }

  return Array.from(candidates).filter(Boolean);
}

function getRepoRoot() {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    if (!root) {
      throw new Error('Git repository root could not be determined.');
    }
    return root;
  } catch (err) {
    throw new Error(`Not a Git repository or git command failed: ${err.message}`);
  }
}

function runGit(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' });
  } catch (err) {
    throw new Error(`Git command failed: git ${args.join(' ')} (${err.message})`);
  }
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs(args) {
  let mode = 'normal';
  let sinceCommit = null;
  let fileList = null;
  let sinceSeen = false;
  let filesSeen = false;

  for (const arg of args) {
    if (arg.startsWith('--since=')) {
      if (filesSeen) {
        throw new Error('Conflicting CLI modes: --since and --files cannot be used together.');
      }
      sinceSeen = true;
      mode = 'since';
      sinceCommit = arg.split('=')[1].trim();
    } else if (arg.startsWith('--files=')) {
      if (sinceSeen) {
        throw new Error('Conflicting CLI modes: --since and --files cannot be used together.');
      }
      filesSeen = true;
      mode = 'files';
      const rawFiles = arg.split('=')[1];
      fileList = rawFiles.split(',').map(f => normalizePath(f.trim())).filter(Boolean);
    }
  }

  return { mode, sinceCommit, fileList };
}

// ---------------------------------------------------------------------------
// Source-Map & Metadata Loader
// ---------------------------------------------------------------------------

function loadSourceMapAndMetadata(repoRoot) {
  const sourceMapPath = path.join(repoRoot, 'backend', 'knowledge', '.okf-system', 'source-map.json');
  const metadataPath = path.join(repoRoot, 'backend', 'knowledge', '.okf-system', 'okf-metadata.json');

  if (!fs.existsSync(sourceMapPath)) {
    throw new Error(`Source-map file not found at ${sourceMapPath}`);
  }

  const sourceMapRaw = fs.readFileSync(sourceMapPath, 'utf8');
  const sourceMap = JSON.parse(sourceMapRaw);

  let metadata = null;
  if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  }

  // Index: normalizedSourcePath -> Set<okfFile>
  const sourceMapIndex = new Map();

  for (const entry of sourceMap) {
    if (!entry.primarySources || !Array.isArray(entry.primarySources)) continue;
    for (const src of entry.primarySources) {
      const normSrc = normalizePath(src);
      if (!sourceMapIndex.has(normSrc)) {
        sourceMapIndex.set(normSrc, new Set());
      }
      sourceMapIndex.get(normSrc).add(entry.okfFile);
    }
  }

  return { sourceMap, metadata, sourceMapIndex };
}

// ---------------------------------------------------------------------------
// Diff Extraction Helpers
// ---------------------------------------------------------------------------

function getChangedFiles(mode, sinceCommit, fileList, repoRoot) {
  if (mode === 'files') {
    return (fileList || []).map(file => toRepoRelativePath(file, repoRoot));
  }

  let fileSet = new Set();

  if (mode === 'normal') {
    const unstaged = runGit(['diff', '--name-only'], repoRoot);
    const staged = runGit(['diff', '--name-only', '--cached'], repoRoot);

    if (unstaged) {
      unstaged.split('\n').map(f => normalizePath(f.trim())).filter(Boolean).forEach(f => fileSet.add(f));
    }
    if (staged) {
      staged.split('\n').map(f => normalizePath(f.trim())).filter(Boolean).forEach(f => fileSet.add(f));
    }
  } else if (mode === 'since') {
    const sinceOutput = runGit(['diff', '--name-only', sinceCommit, 'HEAD'], repoRoot);
    if (sinceOutput) {
      sinceOutput.split('\n').map(f => normalizePath(f.trim())).filter(Boolean).forEach(f => fileSet.add(f));
    }
  }

  return Array.from(fileSet);
}

function getFileDiff(filePath, mode, sinceCommit, repoRoot) {
  if (mode === 'files') return null;

  if (mode === 'normal') {
    return runGit(['diff', '-U0', 'HEAD', '--', filePath], repoRoot) || '';
  } else if (mode === 'since') {
    return runGit(['diff', '-U0', sinceCommit, 'HEAD', '--', filePath], repoRoot) || '';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Semantic Analysis Helpers
// ---------------------------------------------------------------------------

function isWhitespaceOnlyChange(diffText) {
  if (!diffText || typeof diffText !== 'string') return false;

  const lines = diffText.split('\n');
  let hasLines = false;
  let nonWhitespaceChange = false;

  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      continue;
    }
    if (line.startsWith('+') || line.startsWith('-')) {
      hasLines = true;
      const content = line.slice(1);
      if (content.trim() !== '') {
        nonWhitespaceChange = true;
        break;
      }
    }
  }

  return hasLines && !nonWhitespaceChange;
}

/**
 * Locate initializer functions in file content and find their line ranges using brace matching.
 */
function findInitializerRanges(fileContent) {
  const ranges = [];
  if (!fileContent) return ranges;

  const lines = fileContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const initName of KNOWN_INITIALIZERS) {
      const regex = new RegExp(`(?:function\\s+${initName}|${initName}\\s*=\\s*(?:async\\s*)?function|${initName}\\s*=\\s*(?:async\\s*)?\\()`);
      if (regex.test(line)) {
        // Find opening brace starting from line i
        let braceCount = 0;
        let foundOpenBrace = false;
        let startLine = i + 1;
        let endLine = startLine;

        for (let j = i; j < lines.length; j++) {
          const l = lines[j];
          for (let k = 0; k < l.length; k++) {
            if (l[k] === '{') {
              braceCount++;
              foundOpenBrace = true;
            } else if (l[k] === '}') {
              braceCount--;
            }
          }

          if (foundOpenBrace && braceCount === 0) {
            endLine = j + 1;
            break;
          }
        }

        ranges.push({
          name: initName,
          startLine,
          endLine: foundOpenBrace ? endLine : lines.length
        });
      }
    }
  }

  return ranges;
}

/**
 * Parse diff lines from a unified diff text and return both added and removed lines
 * with their nearest line numbers in the new/old file ranges.
 */
function parseDiffChangeLines(diffText) {
  const changeLines = [];
  if (!diffText) return changeLines;

  const lines = diffText.split('\n');
  let newLineNumber = 0;
  let oldLineNumber = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const newMatch = line.match(/\+\d+(?:,\d+)?/);
      const oldMatch = line.match(/-\d+(?:,\d+)?/);
      if (newMatch) {
        newLineNumber = parseInt(newMatch[0].slice(1).split(',')[0], 10) || 1;
      }
      if (oldMatch) {
        oldLineNumber = parseInt(oldMatch[0].slice(1).split(',')[0], 10) || 1;
      }
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      changeLines.push({
        kind: 'added',
        lineNum: newLineNumber,
        text: line.slice(1)
      });
      newLineNumber++;
      continue;
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      changeLines.push({
        kind: 'removed',
        lineNum: oldLineNumber,
        text: line.slice(1)
      });
      oldLineNumber++;
      continue;
    }

    if (!line.startsWith('diff --git') && !line.startsWith('index ') && !line.startsWith('new file mode') && !line.startsWith('deleted file mode') && !line.startsWith('---') && !line.startsWith('+++')) {
      if (line.length > 0) {
        newLineNumber++;
        oldLineNumber++;
      }
    }
  }

  return changeLines;
}

function checkInitializerSchemaChanges(filePath, diffText, repoRoot) {
  if (!diffText) return false;

  const fullPath = path.join(repoRoot, filePath);
  if (!fs.existsSync(fullPath)) return false;

  const fileContent = fs.readFileSync(fullPath, 'utf8');
  const initRanges = findInitializerRanges(fileContent);
  if (initRanges.length === 0) return false;

  const diffChanges = parseDiffChangeLines(diffText);

  for (const range of initRanges) {
    const changesInBody = diffChanges.filter(item => item.lineNum >= range.startLine && item.lineNum <= range.endLine);

    for (const item of changesInBody) {
      for (const ddlRegex of SCHEMA_DDL_PATTERNS) {
        if (ddlRegex.test(item.text)) {
          return true;
        }
      }
    }
  }

  return false;
}

function detectCrossModuleBehaviorChange(filePath, diffText) {
  if (!diffText) return false;

  // Extract module name from file path, e.g., "vendors" from "backend/src/modules/vendors/vendorService.js"
  const match = filePath.match(/backend\/src\/modules\/([^/]+)/);
  const currentModule = match ? match[1].toLowerCase() : '';

  const modules = ['vendors', 'clients', 'projects', 'inventory', 'quality', 'parties'];
  const otherModules = modules.filter(m => m !== currentModule);
  const targetModules = currentModule ? otherModules : modules;

  for (const other of targetModules) {
    const singular = other.replace(/s$/, '').replace(/ies$/, 'y');

    // Patterns that show interaction with the other module's services or entities
    const patterns = [
      new RegExp(`\\b${singular}Service\\b`, 'i'),
      new RegExp(`\\b${other}Service\\b`, 'i'),
      new RegExp(`\\bdispatch\\b.*\\b${singular}\\b`, 'i'),
      new RegExp(`\\bemit\\b.*\\b${singular}\\b`, 'i'),
      new RegExp(`\\blisten\\b.*\\b${singular}\\b`, 'i'),
      new RegExp(`\\bon\\b.*\\b${singular}\\b`, 'i')
    ];

    if (patterns.some(pattern => pattern.test(diffText))) {
      return true;
    }
  }

  return false;
}

function isGlobalSemanticImpact(filePath, diffText, repoRoot) {
  if (!diffText) return false;

  if (checkInitializerSchemaChanges(filePath, diffText, repoRoot)) {
    return true;
  }

  if (detectCrossModuleBehaviorChange(filePath, diffText)) {
    return true;
  }

  const tenantPatterns = [
    /\bORGANIZATION_ID\b/i,
    /\bTENANT_ID\b/i,
    /\btenantIsolation\b/i,
    /\bROW\s+LEVEL\s+SECURITY\b/i
  ];
  for (const pattern of tenantPatterns) {
    if (pattern.test(diffText)) return true;
  }

  if (filePath.includes('middleware/auth.js') || filePath.includes('middleware/authLimiter.js')) {
    const permissionPatterns = [
      /\bROLE_\w+\b/,
      /\bcheckPermission\b/,
      /\bauthLimiter\b/,
      /\bSECURITY_POLICY\b/
    ];
    for (const pattern of permissionPatterns) {
      if (pattern.test(diffText)) return true;
    }
  }

  return false;
}

function isFrontendOrTestPath(normPath) {
  if (normPath.startsWith('frontend/')) return true;
  if (normPath.includes('.test.') || normPath.includes('.spec.')) return true;
  if (normPath.includes('/test/') || normPath.startsWith('test/')) return true;
  return false;
}

function isKnowledgePath(normPath) {
  return normPath.startsWith('backend/knowledge/') || normPath.startsWith('knowledge/');
}

// ---------------------------------------------------------------------------
// Main Classifier Execution
// ---------------------------------------------------------------------------

function emitFatalJson(err) {
  const errorJson = {
    timestamp: new Date().toISOString(),
    changedFiles: [],
    impactSummary: {
      NO_AGENT_IMPACT: [],
      LOCAL_OKF_IMPACT: [],
      MULTIPLE_OKF_IMPACT: [],
      GLOBAL_KNOWLEDGE_IMPACT: [],
      UNKNOWN: []
    },
    requiresOkfUpdate: false,
    affectedOkfFiles: []
  };
  console.error(`Fatal Error: ${err.message}`);
  console.log(JSON.stringify(errorJson, null, 2));
  process.exit(2);
}

function main() {
  let repoRoot;
  let rawArgs;
  let mode;
  let sinceCommit;
  let fileList;

  try {
    repoRoot = getRepoRoot();
    rawArgs = process.argv.slice(2);
    ({ mode, sinceCommit, fileList } = parseArgs(rawArgs));
  } catch (err) {
    emitFatalJson(err);
  }

  let sourceMapData;
  try {
    sourceMapData = loadSourceMapAndMetadata(repoRoot);
  } catch (err) {
    emitFatalJson(err);
  }

  const { sourceMapIndex } = sourceMapData;

  let changedFiles;
  try {
    changedFiles = getChangedFiles(mode, sinceCommit, fileList, repoRoot);
  } catch (err) {
    emitFatalJson(err);
  }

  const impactSummary = {
    NO_AGENT_IMPACT: [],
    LOCAL_OKF_IMPACT: [],
    MULTIPLE_OKF_IMPACT: [],
    GLOBAL_KNOWLEDGE_IMPACT: [],
    UNKNOWN: []
  };

  const processedFiles = [];
  const affectedOkfSet = new Set();

  try {
    for (const rawFilePath of changedFiles) {
      const normPath = toRepoRelativePath(rawFilePath, repoRoot);

      // 1. Knowledge file guard: exclude backend/knowledge/*
      if (isKnowledgePath(normPath)) {
        continue;
      }

      processedFiles.push(normPath);

      const diffText = getFileDiff(normPath, mode, sinceCommit, repoRoot);

      // 2. Whitespace-only check (normal mode only)
      if (mode === 'normal' && isWhitespaceOnlyChange(diffText)) {
        impactSummary.NO_AGENT_IMPACT.push(normPath);
        continue;
      }

      // 3. Global semantic analysis (runs BEFORE source-map lookup)
      if (isGlobalSemanticImpact(normPath, diffText, repoRoot)) {
        impactSummary.GLOBAL_KNOWLEDGE_IMPACT.push(normPath);
        // Map to affected OKF files if present in source-map
        if (sourceMapIndex.has(normPath)) {
          sourceMapIndex.get(normPath).forEach(okf => affectedOkfSet.add(okf));
        } else {
          affectedOkfSet.add('index.md');
        }
        continue;
      }

      // 4. Source-map lookup
      const sourceMapMatch = getComparablePathCandidates(normPath, repoRoot).find(candidate => sourceMapIndex.has(candidate));
      if (sourceMapMatch) {
        const okfFiles = sourceMapIndex.get(sourceMapMatch);
        if (okfFiles.size === 1) {
          impactSummary.LOCAL_OKF_IMPACT.push(normPath);
        } else if (okfFiles.size >= 2) {
          impactSummary.MULTIPLE_OKF_IMPACT.push(normPath);
        }
        okfFiles.forEach(okf => affectedOkfSet.add(okf));
        continue;
      }

      // 5. Unmapped files
      if (isFrontendOrTestPath(normPath)) {
        impactSummary.NO_AGENT_IMPACT.push(normPath);
      } else {
        impactSummary.UNKNOWN.push(normPath);
      }
    }
  } catch (err) {
    emitFatalJson(err);
  }

  const requiresOkfUpdate =
    impactSummary.LOCAL_OKF_IMPACT.length > 0 ||
    impactSummary.MULTIPLE_OKF_IMPACT.length > 0 ||
    impactSummary.GLOBAL_KNOWLEDGE_IMPACT.length > 0;

  const affectedOkfFiles = Array.from(affectedOkfSet).sort();

  const outputJson = {
    timestamp: new Date().toISOString(),
    changedFiles: processedFiles,
    impactSummary,
    requiresOkfUpdate,
    affectedOkfFiles
  };

  console.log(JSON.stringify(outputJson, null, 2));

  // Determine Exit Code according to contract:
  // 0 = no OKF update required
  // 1 = OKF update required
  // 2 = UNKNOWN impact detected / unsafe to proceed
  if (impactSummary.UNKNOWN.length > 0) {
    process.exit(2);
  } else if (requiresOkfUpdate) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
