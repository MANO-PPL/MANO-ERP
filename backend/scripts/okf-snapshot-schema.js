#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../src/config/database.js';

export const TRACKED_TABLES = [
  'crm_contacts',
  'crm_interactions',
  'crm_job_nature',
  'crm_sectors',
  'proj_qaqc_observations',
  'proj_projects',
  'proj_members',
  'res_resources',
  'res_rates',
  'res_compositions',
  'res_conversions',
  'pdoc_parties'
];

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const snapshotPath = path.resolve(scriptDirectory, '../knowledge/.okf-system/db-schema-snapshot.json');

function placeholders(values) {
  return values.map(() => '?').join(', ');
}

function rowsFrom(result) {
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
}

export function getResolvedDatabaseName() {
  return db.client.config.connection.database;
}

function sortBy(items, selector) {
  return [...items].sort((left, right) => selector(left).localeCompare(selector(right)));
}

export async function captureLiveSchema() {
  const databaseName = getResolvedDatabaseName();
  const inList = placeholders(TRACKED_TABLES);

  const columnsResult = await db.raw(`
    SELECT
      TABLE_NAME,
      COLUMN_NAME,
      COLUMN_TYPE,
      IS_NULLABLE,
      COLUMN_DEFAULT,
      EXTRA
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME IN (${inList})
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `, [databaseName, ...TRACKED_TABLES]);

  const indexesResult = await db.raw(`
    SELECT
      TABLE_NAME,
      INDEX_NAME,
      COLUMN_NAME,
      SEQ_IN_INDEX,
      NON_UNIQUE
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME IN (${inList})
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
  `, [databaseName, ...TRACKED_TABLES]);

  const foreignKeysResult = await db.raw(`
    SELECT
      kcu.TABLE_NAME,
      kcu.CONSTRAINT_NAME,
      kcu.COLUMN_NAME,
      kcu.REFERENCED_TABLE_NAME,
      kcu.REFERENCED_COLUMN_NAME,
      rc.DELETE_RULE
    FROM information_schema.KEY_COLUMN_USAGE kcu
    JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
      ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
     AND rc.TABLE_NAME = kcu.TABLE_NAME
     AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    WHERE kcu.TABLE_SCHEMA = ?
      AND kcu.TABLE_NAME IN (${inList})
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
  `, [databaseName, ...TRACKED_TABLES]);

  const columns = rowsFrom(columnsResult);
  const indexes = rowsFrom(indexesResult);
  const foreignKeys = rowsFrom(foreignKeysResult);
  const tableNamesWithColumns = new Set(columns.map(row => row.TABLE_NAME));
  const tables = {};

  for (const tableName of TRACKED_TABLES) {
    if (!tableNamesWithColumns.has(tableName)) {
      tables[tableName] = { tableName, exists: false };
      continue;
    }

    const tableColumns = columns
      .filter(row => row.TABLE_NAME === tableName)
      .map(row => ({
        name: row.COLUMN_NAME,
        type: row.COLUMN_TYPE,
        nullable: row.IS_NULLABLE === 'YES',
        defaultValue: row.COLUMN_DEFAULT,
        extra: row.EXTRA || ''
      }));

    const groupedIndexes = new Map();
    for (const row of indexes.filter(item => item.TABLE_NAME === tableName)) {
      if (!groupedIndexes.has(row.INDEX_NAME)) {
        groupedIndexes.set(row.INDEX_NAME, {
          keyName: row.INDEX_NAME,
          columns: [],
          unique: Number(row.NON_UNIQUE) === 0
        });
      }
      groupedIndexes.get(row.INDEX_NAME).columns.push({
        sequence: Number(row.SEQ_IN_INDEX),
        name: row.COLUMN_NAME
      });
    }

    const tableIndexes = sortBy([...groupedIndexes.values()], item => item.keyName)
      .map(index => ({
        keyName: index.keyName,
        columns: index.columns
          .sort((left, right) => left.sequence - right.sequence)
          .map(column => column.name),
        unique: index.unique
      }));

    const tableForeignKeys = foreignKeys
      .filter(row => row.TABLE_NAME === tableName)
      .map(row => ({
        constraintName: row.CONSTRAINT_NAME,
        column: row.COLUMN_NAME,
        referencedTable: row.REFERENCED_TABLE_NAME,
        referencedColumn: row.REFERENCED_COLUMN_NAME,
        onDelete: row.DELETE_RULE
      }))
      .sort((left, right) => left.constraintName.localeCompare(right.constraintName) || left.column.localeCompare(right.column));

    tables[tableName] = {
      tableName,
      exists: true,
      columns: tableColumns,
      indexes: tableIndexes,
      foreignKeys: tableForeignKeys
    };
  }

  return {
    capturedAt: new Date().toISOString(),
    database: databaseName,
    tables
  };
}

export function generateCanonicalBaselineSchema() {
  const databaseName = getResolvedDatabaseName() || 'MANO-ERP';
  const tableDefs = {
    crm_contacts: [
      { name: 'id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'scope', type: "enum('master','project')", nullable: false, defaultValue: 'master', extra: '' },
      { name: 'category', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'name', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'contact_person', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'designation', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'telephone_no', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'mobile', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'email', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'location', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'address', type: 'text', nullable: true, defaultValue: null, extra: '' },
      { name: 'website', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'gst_no', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'constitution', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'sector_id', type: 'int', nullable: true, defaultValue: null, extra: '' },
      { name: 'job_nature_id', type: 'int', nullable: true, defaultValue: null, extra: '' },
      { name: 'reference', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'responsibility', type: 'varchar(255)', nullable: true, defaultValue: null, extra: '' },
      { name: 'remarks', type: 'text', nullable: true, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ],
    crm_interactions: [
      { name: 'id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'contact_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'interaction_type', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'interaction_date', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'summary', type: 'text', nullable: true, defaultValue: null, extra: '' },
      { name: 'next_follow_up', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ],
    crm_job_nature: [
      { name: 'job_id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'job_name', type: 'varchar(255)', nullable: false, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ],
    crm_sectors: [
      { name: 'sector_id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'sector_name', type: 'varchar(255)', nullable: false, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ],
    proj_qaqc_observations: [
      { name: 'id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'project_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'observation_number', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'description', type: 'text', nullable: true, defaultValue: null, extra: '' },
      { name: 'status', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'severity', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'category', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'created_by', type: 'int', nullable: true, defaultValue: null, extra: '' },
      { name: 'assigned_to', type: 'int', nullable: true, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ],
    proj_projects: [
      { name: 'id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'project_name', type: 'varchar(255)', nullable: false, defaultValue: null, extra: '' },
      { name: 'project_code', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'client_id', type: 'int', nullable: true, defaultValue: null, extra: '' },
      { name: 'status', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'start_date', type: 'date', nullable: true, defaultValue: null, extra: '' },
      { name: 'end_date', type: 'date', nullable: true, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ],
    proj_members: [
      { name: 'id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'project_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'user_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'role', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ],
    res_resources: [
      { name: 'id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'name', type: 'varchar(255)', nullable: false, defaultValue: null, extra: '' },
      { name: 'code', type: 'varchar(100)', nullable: true, defaultValue: null, extra: '' },
      { name: 'type', type: "enum('material','item','labour')", nullable: false, defaultValue: 'material', extra: '' },
      { name: 'base_unit_code', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'project_id', type: 'int', nullable: true, defaultValue: null, extra: '' },
      { name: 'parent_id', type: 'int', nullable: true, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ],
    res_rates: [
      { name: 'id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'resource_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'project_id', type: 'int', nullable: true, defaultValue: null, extra: '' },
      { name: 'rate', type: 'decimal(18,2)', nullable: false, defaultValue: null, extra: '' },
      { name: 'unit_code', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'effective_from', type: 'date', nullable: true, defaultValue: null, extra: '' },
      { name: 'effective_to', type: 'date', nullable: true, defaultValue: null, extra: '' },
      { name: 'is_active', type: 'int', nullable: false, defaultValue: '1', extra: '' },
      { name: 'remarks', type: 'text', nullable: true, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ],
    res_compositions: [
      { name: 'id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'parent_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'component_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'quantity', type: 'decimal(18,4)', nullable: false, defaultValue: null, extra: '' },
      { name: 'unit_code', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'effective_from', type: 'date', nullable: true, defaultValue: null, extra: '' },
      { name: 'effective_to', type: 'date', nullable: true, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ],
    res_conversions: [
      { name: 'id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'resource_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'from_unit_code', type: 'varchar(50)', nullable: false, defaultValue: null, extra: '' },
      { name: 'to_unit_code', type: 'varchar(50)', nullable: false, defaultValue: null, extra: '' },
      { name: 'multiplier', type: 'decimal(18,6)', nullable: false, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ],
    pdoc_parties: [
      { name: 'id', type: 'int', nullable: false, defaultValue: null, extra: 'auto_increment' },
      { name: 'org_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'project_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'contact_id', type: 'int', nullable: false, defaultValue: null, extra: '' },
      { name: 'category', type: 'varchar(50)', nullable: true, defaultValue: null, extra: '' },
      { name: 'created_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' },
      { name: 'updated_at', type: 'datetime', nullable: true, defaultValue: null, extra: '' }
    ]
  };

  const tables = {};
  for (const tableName of TRACKED_TABLES) {
    const cols = tableDefs[tableName] || [];
    tables[tableName] = {
      tableName,
      exists: true,
      columns: cols,
      indexes: [
        { keyName: 'PRIMARY', columns: [cols[0]?.name || 'id'], unique: true }
      ],
      foreignKeys: []
    };
  }

  return {
    capturedAt: new Date().toISOString(),
    database: databaseName,
    source: 'canonical_code',
    tables
  };
}

async function writeSnapshot(snapshot) {
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

function emitError(error) {
  console.error(`Fatal Error: ${error.message}`);
  console.log(JSON.stringify({ error: 'Schema snapshot failed' }, null, 2));
}

async function main() {
  try {
    let snapshot;
    try {
      snapshot = await captureLiveSchema();
    } catch (dbErr) {
      console.warn(`Live database unavailable (${dbErr.message}); generating canonical baseline schema.`);
      snapshot = generateCanonicalBaselineSchema();
    }
    await writeSnapshot(snapshot);
    console.log(JSON.stringify(snapshot, null, 2));
    process.exitCode = 0;
  } catch (error) {
    emitError(error);
    process.exitCode = 2;
  } finally {
    try { await db.destroy(); } catch {}
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
