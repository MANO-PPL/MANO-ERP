/**
 * kgDatabaseListener.js
 * Database change listener & real-time sync dispatcher for the Knowledge Graph.
 * 
 * Captures DML operations (INSERT, UPDATE, DELETE) across all 25+ operational platform tables
 * and automatically updates the Knowledge Graph in-memory while broadcasting real-time change
 * events over Server-Sent Events (SSE) and Socket.IO.
 */

import { EventEmitter } from 'node:events';
import knowledgeGraphService from './knowledgeGraphService.js';
import db from '../../config/database.js';

export const TRACKED_TABLES = new Set([
  // Projects Core
  'proj_projects',
  'proj_members',
  'proj_summary',
  'proj_directory',
  'pdoc_parties',
  'proj_parties',

  // Tasks, Planning & Schedule
  'proj_tasks',
  'proj_task_categories',
  'proj_task_assignees',
  'proj_planning',
  'proj_phases',

  // Reports, DPR & Billing
  'proj_reports',
  'proj_billing',
  'proj_contracts',

  // Drawings
  'proj_drawings',
  'proj_drawing_categories',

  // Quality & Safety
  'proj_quality_checklists',
  'proj_quality_methodologies',
  'proj_qaqc_observations',
  'proj_safety',

  // Meetings & MOM
  'proj_meetings',
  'proj_meetings_participants',

  // CRM Contacts & Interactions
  'crm_contacts',
  'crm_interactions',
  'crm_sectors',
  'crm_job_nature',

  // Resources & Inventory
  'res_resources',
  'res_rates',
  'res_compositions',
  'res_conversions',

  // Financial & Transactions
  'txn_transactions',
  'txn_transaction_lines',

  // Workflows & Approvals
  'wf_documents',
  'wf_document_instances',
  'wf_approval_cycles',
  'wf_approval_levels',
  'wf_approval_logs',
  'wf_cycle_submissions',

  // IAM & Admin
  'iam_users',
  'iam_departments',
  'iam_designations',
  'org_organizations'
]);

class KnowledgeGraphEventBus extends EventEmitter {}
export const kgEventBus = new KnowledgeGraphEventBus();

// Set of active SSE client response streams
const sseClients = new Set();
let socketIoInstance = null;

export function setSocketIo(io) {
  socketIoInstance = io;
}

export function registerSseClient(res) {
  sseClients.add(res);
  res.on('close', () => {
    sseClients.delete(res);
  });
}

/**
 * Dispatches a minute database mutation event to Knowledge Graph and all connected clients.
 */
export async function notifyMutation(table, id, operation, data = {}) {
  try {
    const changeEvent = knowledgeGraphService.syncEntityMutation(table, id, operation, data);

    // 1. Emit internal event
    kgEventBus.emit('mutation', changeEvent);

    // 2. Broadcast to Socket.IO if available
    if (socketIoInstance) {
      try {
        socketIoInstance.emit('kg:change', changeEvent);
      } catch (err) {
        // ignore socket errors
      }
    }

    // 3. Broadcast to all active Server-Sent Events (SSE) clients
    const ssePayload = `event: change\ndata: ${JSON.stringify(changeEvent)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(ssePayload);
      } catch {
        sseClients.delete(client);
      }
    }

    return changeEvent;
  } catch (err) {
    console.error('[KnowledgeGraphListener] Error broadcasting mutation:', err);
  }
}

/**
 * Attaches Knex query-response listener for transparent real-time database change capture across all tables.
 */
export function attachDatabaseListener(knexClient = db) {
  if (!knexClient || typeof knexClient.on !== 'function') return;

  knexClient.on('query-response', async (response, queryData) => {
    try {
      const sql = (queryData.sql || '').trim();
      const match = sql.match(/^(?:insert\s+into|update|delete\s+from)\s+[`"]?([a-zA-Z0-9_]+)[`"]?/i);
      if (!match) return;

      const rawTable = match[1];
      if (!TRACKED_TABLES.has(rawTable)) return;

      let operation = 'UPDATE';
      if (/^insert/i.test(sql)) operation = 'INSERT';
      else if (/^delete/i.test(sql)) operation = 'DELETE';

      let recordId = null;
      if (operation === 'INSERT') {
        recordId = Array.isArray(response) ? response[0] : response?.insertId || response;
      } else {
        // Try to extract ID from SQL or bindings
        const idMatch = sql.match(/where\s+[`"]?id[`"]?\s*=\s*(\?|\d+)/i);
        if (idMatch) {
          if (idMatch[1] === '?') {
            const bindings = queryData.bindings || [];
            // Usually id is at the end of bindings in UPDATE statements
            recordId = bindings[bindings.length - 1];
          } else {
            recordId = Number(idMatch[1]);
          }
        }
      }

      if (recordId && Number.isFinite(Number(recordId))) {
        // Fetch freshly updated record details if insert or update
        let freshData = {};
        if (operation !== 'DELETE') {
          try {
            const row = await knexClient(rawTable).where({ id: recordId }).first();
            if (row) freshData = row;
          } catch {
            // best-effort
          }
        }
        await notifyMutation(rawTable, recordId, operation, freshData);
      }
    } catch (err) {
      // Never crash on query listener error
    }
  });

  console.log(`[KnowledgeGraphListener] Knex real-time database listener attached across ${TRACKED_TABLES.size} operational tables.`);
}
