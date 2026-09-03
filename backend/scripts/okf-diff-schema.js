#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../src/config/database.js';
import { captureLiveSchema, snapshotPath, TRACKED_TABLES } from './okf-snapshot-schema.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceMapPath = path.resolve(scriptDirectory, '../knowledge/.okf-system/source-map.json');

function stableJson(value) {
  return JSON.stringify(value);
}

function mapBy(items, key) {
  return new Map(items.map(item => [item[key], item]));
}

function snapshotAge(capturedAt) {
  const capturedTime = Date.parse(capturedAt);
  if (!Number.isFinite(capturedTime)) throw new Error('Snapshot capturedAt is invalid.');
  const seconds = Math.max(0, Math.floor((Date.now() - capturedTime) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function addDefinitionAwareCollectionChanges(
  changes,
  tableName,
  changeType,
  beforeItems,
  afterItems,
  keySelector,
  normalize = item => item
) {
  const before = new Map((beforeItems || []).map(item => [keySelector(item), item]));
  const after = new Map((afterItems || []).map(item => [keySelector(item), item]));
  const allKeys = [...new Set([...before.keys(), ...after.keys()])].sort();

  for (const itemKey of allKeys) {
    const beforeItem = before.get(itemKey);
    const afterItem = after.get(itemKey);

    if (!beforeItem) {
      changes.push({ table: tableName, changeType: `${changeType}_ADDED`, detail: afterItem });
    } else if (!afterItem) {
      changes.push({ table: tableName, changeType: `${changeType}_REMOVED`, detail: beforeItem });
    } else if (stableJson(normalize(beforeItem)) !== stableJson(normalize(afterItem))) {
      changes.push({ table: tableName, changeType: `${changeType}_REMOVED`, detail: beforeItem });
      changes.push({ table: tableName, changeType: `${changeType}_ADDED`, detail: afterItem });
    }
  }
}

function compareSchemas(previous, current) {
  const changes = [];
  const changeOrder = {
    TABLE_ADDED: 1,
    TABLE_REMOVED: 2,
    COLUMN_ADDED: 3,
    COLUMN_REMOVED: 4,
    COLUMN_MODIFIED: 5,
    INDEX_REMOVED: 6,
    INDEX_ADDED: 7,
    FK_REMOVED: 8,
    FK_ADDED: 9
  };

  for (const tableName of TRACKED_TABLES) {
    const before = previous.tables?.[tableName] || { tableName, exists: false };
    const after = current.tables?.[tableName] || { tableName, exists: false };

    if (!before.exists && after.exists) {
      changes.push({ table: tableName, changeType: 'TABLE_ADDED', detail: {} });
      continue;
    }
    if (before.exists && !after.exists) {
      changes.push({ table: tableName, changeType: 'TABLE_REMOVED', detail: {} });
      continue;
    }
    if (!before.exists && !after.exists) continue;

    const beforeColumns = mapBy(before.columns || [], 'name');
    const afterColumns = mapBy(after.columns || [], 'name');
    for (const name of [...afterColumns.keys()].filter(name => !beforeColumns.has(name)).sort()) {
      changes.push({ table: tableName, changeType: 'COLUMN_ADDED', detail: { column: name, after: afterColumns.get(name) } });
    }
    for (const name of [...beforeColumns.keys()].filter(name => !afterColumns.has(name)).sort()) {
      changes.push({ table: tableName, changeType: 'COLUMN_REMOVED', detail: { column: name, before: beforeColumns.get(name) } });
    }
    for (const name of [...beforeColumns.keys()].filter(name => afterColumns.has(name)).sort()) {
      const beforeColumn = beforeColumns.get(name);
      const afterColumn = afterColumns.get(name);
      const beforeComparable = {
        type: beforeColumn.type,
        nullable: beforeColumn.nullable,
        defaultValue: beforeColumn.defaultValue,
        extra: beforeColumn.extra
      };
      const afterComparable = {
        type: afterColumn.type,
        nullable: afterColumn.nullable,
        defaultValue: afterColumn.defaultValue,
        extra: afterColumn.extra
      };
      if (stableJson(beforeComparable) !== stableJson(afterComparable)) {
        changes.push({
          table: tableName,
          changeType: 'COLUMN_MODIFIED',
          detail: { column: name, before: beforeComparable, after: afterComparable }
        });
      }
    }

    addDefinitionAwareCollectionChanges(
      changes,
      tableName,
      'INDEX',
      before.indexes,
      after.indexes,
      item => item.keyName,
      item => ({ keyName: item.keyName, columns: item.columns, unique: item.unique })
    );

    addDefinitionAwareCollectionChanges(
      changes,
      tableName,
      'FK',
      before.foreignKeys,
      after.foreignKeys,
      item => `${item.constraintName}\u0000${item.column}`,
      item => ({
        constraintName: item.constraintName,
        column: item.column,
        referencedTable: item.referencedTable,
        referencedColumn: item.referencedColumn,
        onDelete: item.onDelete
      })
    );
  }

  return changes.sort((left, right) =>
    TRACKED_TABLES.indexOf(left.table) - TRACKED_TABLES.indexOf(right.table) ||
    changeOrder[left.changeType] - changeOrder[right.changeType] ||
    stableJson(left.detail).localeCompare(stableJson(right.detail))
  );
}

async function loadJson(filePath, description) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to load ${description}: ${error.message}`);
  }
}

async function affectedOkfFiles(changes) {
  const sourceMap = await loadJson(sourceMapPath, 'source-map.json');
  const changedTables = new Set(changes.map(change => change.table));
  return [...new Set(sourceMap
    .filter(entry => Array.isArray(entry.tables) && entry.tables.some(table => changedTables.has(table)))
    .map(entry => entry.okfFile))]
    .sort();
}

function emitError(error) {
  console.error(`Fatal Error: ${error.message}`);
  console.log(JSON.stringify({
    snapshotAge: null,
    changes: [],
    hasChanges: false,
    affectedOkfFiles: [],
    error: 'Schema diff failed'
  }, null, 2));
}

async function main() {
  const updateSnapshot = process.argv.slice(2).includes('--update-snapshot');
  try {
    const previous = await loadJson(snapshotPath, 'db-schema-snapshot.json');
    const current = await captureLiveSchema();
    if (previous.database !== current.database) {
      throw new Error('Saved snapshot belongs to a different database.');
    }
    const changes = compareSchemas(previous, current);
    const output = {
      snapshotAge: snapshotAge(previous.capturedAt),
      changes,
      hasChanges: changes.length > 0,
      affectedOkfFiles: await affectedOkfFiles(changes)
    };

    if (updateSnapshot) {
      await fs.writeFile(snapshotPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
    }

    console.log(JSON.stringify(output, null, 2));
    process.exitCode = changes.length > 0 ? 1 : 0;
  } catch (error) {
    emitError(error);
    process.exitCode = 2;
  } finally {
    await db.destroy();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
