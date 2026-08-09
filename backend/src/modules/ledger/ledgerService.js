import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { validateTransaction, TXN_TYPES, TXN_STATUS, ROLES } from './ledgerValidation.js';

function parseIntOrNull(val) {
    if (val === undefined || val === null || val === '') return null;
    const parsed = Number(val);
    return isNaN(parsed) ? null : parsed;
}

/**
 * A project resource is identified by resource_id inside proj_resources and is
 * scoped by the transaction header's project_id. Keep this check here because
 * proj_resources has a composite (project_id, resource_id) primary key, while
 * transaction lines store the resource component as project_resource_id.
 */
async function verifyProjectResourceMembership(trx, projectId, orgId, lines) {
    if (lines.length === 0) return;
    if (!projectId) {
        throw new AppError('project_id is required when transaction lines use project resources', 400);
    }

    const projectResourceIds = [...new Set(lines.map(line => line.project_resource_id))];
    const query = trx('proj_resources')
        .where({ project_id: projectId, is_deleted: 0 })
        .whereIn('resource_id', projectResourceIds);

    if (orgId !== null && orgId !== undefined) {
        query.andWhere('org_id', orgId);
    }

    const memberships = await query.select('resource_id');
    const validIds = new Set(memberships.map(row => String(row.resource_id)));

    // Legacy project imports were stored only in res_rates/res_compositions.
    // Accept those rows while installations migrate membership data into
    // proj_resources; new imports are written to both representations.
    const missingCandidates = projectResourceIds.filter(id => !validIds.has(String(id)));
    if (missingCandidates.length > 0) {
        const legacyRows = await trx('res_resources as r')
            .where('r.org_id', orgId)
            .whereIn('r.id', missingCandidates)
            .where(function () {
                this.whereIn('r.id', trx('res_rates')
                    .where('project_id', projectId)
                    .select('resource_id'))
                    .orWhereIn('r.id', trx('res_compositions')
                        .where('project_id', projectId)
                        .select('parent_resource_id'));
            })
            .select('r.id as resource_id');
        legacyRows.forEach(row => validIds.add(String(row.resource_id)));
    }

    const missingId = projectResourceIds.find(id => !validIds.has(String(id)));

    if (missingId !== undefined) {
        throw new AppError(`Project resource '${missingId}' is not imported into project '${projectId}'`, 400);
    }
}

/**
 * Verifies that non-Supplier parties have sufficient stock before transferring out resources.
 * Suppliers have unlimited allocation capacity. Contractors & others cannot transfer out more than their current net balance.
 */
async function verifyPartyStockSufficiency(trx, projectId, orgId, linesToValidate) {
    const outflowLines = linesToValidate.filter(l => Number(l.signed_qty) < 0);
    if (outflowLines.length === 0) return;

    const partyIds = Array.from(new Set(outflowLines.map(l => l.party_id)));

    // Fetch party details (category) from pdoc_parties JOIN crm_contacts.
    // pdoc_parties links the project-party row to the CRM contact through party_id.
    const partyDetails = await trx('pdoc_parties as pp')
        .join('crm_contacts as c', 'pp.party_id', 'c.id')
        .whereIn('pp.pv_id', partyIds)
        .select('pp.pv_id', 'c.name', 'c.category');

    const partyMap = {};
    partyDetails.forEach(party => {
        partyMap[party.pv_id] = party;
    });

    for (const line of outflowLines) {
        const party = partyMap[line.party_id];
        const category = (party?.category || '').toLowerCase();
        const partyName = party?.name || `Party #${line.party_id}`;

        // Suppliers can issue unlimited supply — skip stock balance enforcement for Suppliers
        if (category.includes('supplier')) {
            continue;
        }

        // For Contractors & non-suppliers, query current net confirmed stock position for this project resource
        let posQuery = trx('txn_transaction_lines as l')
            .join('txn_transactions as t', 'l.transaction_id', 't.id')
            .where('t.status', TXN_STATUS.CONFIRMED)
            .where('l.party_id', line.party_id)
            .where('l.project_resource_id', line.project_resource_id);

        if (projectId) posQuery = posQuery.where('t.project_id', projectId);
        if (orgId)     posQuery = posQuery.where('t.org_id', orgId);

        const stockRes = await posQuery.sum('l.signed_qty as net_qty').first();
        const availableStock = stockRes ? Number(stockRes.net_qty || 0) : 0;
        const requestedOutflow = Math.abs(Number(line.signed_qty));

        if (requestedOutflow > availableStock) {
            throw new AppError(
                `Insufficient stock for "${partyName}". Available balance: ${availableStock}, requested transfer out: ${requestedOutflow}. (Only Suppliers can issue initial supply allocations)`,
                400
            );
        }
    }
}

/**
 * Creates a new transaction with lines using auto-increment integer IDs.
 * party_id is always INT UNSIGNED referencing pdoc_parties.pv_id.
 * Executed atomically in a database transaction with stock balance enforcement.
 */
export async function createTransaction(txnData, linesData) {
    const status  = txnData.status || TXN_STATUS.DRAFT;
    const txnDate = txnData.txn_date ? new Date(txnData.txn_date) : new Date();

    const header = {
        org_id:               parseIntOrNull(txnData.org_id     ?? txnData.orgId),
        project_id:           parseIntOrNull(txnData.project_id ?? txnData.projectId),
        txn_type:             txnData.txn_type,
        txn_date:             txnDate,
        activity_id:          parseIntOrNull(txnData.activity_id  ?? txnData.activityId),
        wbs_id:               parseIntOrNull(txnData.wbs_id       ?? txnData.wbsId),
        responsible_party_id: parseIntOrNull(txnData.responsible_party_id ?? txnData.responsiblePartyId),
        status,
        created_by:           parseIntOrNull(txnData.created_by ?? txnData.createdBy),
        remarks:              txnData.remarks || null,
    };

    const linesToValidate = linesData.map((line, i) => {
        const rawPartyId = line.party_id ?? line.partyId;
        const partyId    = parseIntOrNull(rawPartyId);
        if (!partyId || partyId <= 0) {
            throw new AppError(`Line at index ${i} has invalid party_id "${rawPartyId}". Must be a positive integer (pdoc_parties.pv_id)`, 400);
        }

        const signedQty = Number(line.signed_qty ?? line.signedQty ?? line.qty);
        const projectResourceId = line.project_resource_id ?? line.projectResourceId;

        return {
            party_id:    partyId,
            project_resource_id: parseIntOrNull(projectResourceId),
            signed_qty:  signedQty,
            uom_id:      parseIntOrNull(line.uom_id ?? line.uomId),
            role:        line.role || null,
            notes:       line.notes || null,
        };
    });

    if (status === TXN_STATUS.CONFIRMED) {
        validateTransaction(header, linesToValidate);
    }

    return await db.transaction(async (trx) => {
        await verifyProjectResourceMembership(trx, header.project_id, header.org_id, linesToValidate);

        // Enforce stock availability for non-suppliers on confirmed transactions
        if (status === TXN_STATUS.CONFIRMED) {
            await verifyPartyStockSufficiency(trx, header.project_id, header.org_id, linesToValidate);
        }

        const [insertedId] = await trx('txn_transactions').insert(header);
        const txnId = insertedId;

        let insertedLines = [];
        if (linesToValidate.length > 0) {
            const linesForInsert = linesToValidate.map((l) => ({
                transaction_id: txnId,
                ...l,
            }));
            await trx('txn_transaction_lines').insert(linesForInsert);
            insertedLines = await trx('txn_transaction_lines').where({ transaction_id: txnId });
        }

        const createdTxn = await trx('txn_transactions').where({ id: txnId }).first();
        return { ...createdTxn, lines: insertedLines };
    });
}

/**
 * Confirms a transaction, running full validation checks & stock balance verification.
 */
export async function confirmTransaction(transactionId) {
    const txn = await db('txn_transactions').where({ id: transactionId }).first();
    if (!txn) throw new AppError(`Transaction '${transactionId}' not found`, 404);

    if (txn.status === TXN_STATUS.CONFIRMED) {
        const lines = await db('txn_transaction_lines').where({ transaction_id: transactionId });
        return { ...txn, lines };
    }
    if (txn.status === TXN_STATUS.CANCELLED) {
        throw new AppError(`Cannot confirm a cancelled transaction`, 400);
    }

    const lines = await db('txn_transaction_lines').where({ transaction_id: transactionId });
    validateTransaction(txn, lines);

    await db.transaction(async (trx) => {
        await verifyProjectResourceMembership(trx, txn.project_id, txn.org_id, lines);
        await verifyPartyStockSufficiency(trx, txn.project_id, txn.org_id, lines);

        await trx('txn_transactions').where({ id: transactionId }).update({
            status:     TXN_STATUS.CONFIRMED,
            updated_at: trx.fn.now(),
        });
    });

    const updatedTxn = await db('txn_transactions').where({ id: transactionId }).first();
    return { ...updatedTxn, lines };
}

/**
 * Cancels a transaction.
 */
export async function cancelTransaction(transactionId) {
    const txn = await db('txn_transactions').where({ id: transactionId }).first();
    if (!txn) throw new AppError(`Transaction '${transactionId}' not found`, 404);

    await db('txn_transactions').where({ id: transactionId }).update({
        status:     TXN_STATUS.CANCELLED,
        updated_at: db.fn.now(),
    });

    const lines = await db('txn_transaction_lines').where({ transaction_id: transactionId });
    return { ...txn, status: TXN_STATUS.CANCELLED, lines };
}

/**
 * Fetches a transaction by ID with its lines.
 */
export async function getTransactionById(transactionId) {
    const txn = await db('txn_transactions').where({ id: transactionId }).first();
    if (!txn) return null;
    const lines = await db('txn_transaction_lines').where({ transaction_id: transactionId });
    return { ...txn, lines };
}

/**
 * Lists transactions with optional filters, includes lines for each transaction.
 */
export async function getTransactions(filters = {}) {
    let query = db('txn_transactions');

    const orgId     = parseIntOrNull(filters.org_id     || filters.orgId);
    const projectId = parseIntOrNull(filters.project_id || filters.projectId);

    if (orgId     !== null) query = query.where({ org_id:     orgId });
    if (projectId !== null) query = query.where({ project_id: projectId });
    if (filters.txn_type)  query = query.where({ txn_type:   filters.txn_type });
    if (filters.status)    query = query.where({ status:     filters.status });

    if (filters.party_id || filters.partyId) {
        const targetParty = parseIntOrNull(filters.party_id || filters.partyId);
        if (targetParty) {
            query = query.whereIn('id', function () {
                this.select('transaction_id').from('txn_transaction_lines').where({ party_id: targetParty });
            });
        }
    }

    query = query.orderBy('txn_date', 'desc').orderBy('created_at', 'desc');

    const txns = await query;
    if (txns.length === 0) return [];

    const txnIds  = txns.map((t) => t.id);
    const allLines = await db('txn_transaction_lines').whereIn('transaction_id', txnIds);

    const linesMap = {};
    for (const line of allLines) {
        if (!linesMap[line.transaction_id]) linesMap[line.transaction_id] = [];
        linesMap[line.transaction_id].push(line);
    }

    return txns.map((t) => ({ ...t, lines: linesMap[t.id] || [] }));
}

/**
 * Returns net inventory position per project resource for a given party (pdoc_parties.pv_id).
 */
export async function getPartyResourcePosition(pvId, rawProjectResourceId = null, rawProjectId = null, rawOrgId = null) {
    const partyId   = parseIntOrNull(pvId);
    const orgId     = parseIntOrNull(rawOrgId);
    const projectId = parseIntOrNull(rawProjectId);
    const projectResourceId = parseIntOrNull(rawProjectResourceId);

    if (!partyId) throw new AppError('party_id (pdoc_parties.pv_id) is required and must be a positive integer', 400);

    let query = db('txn_transaction_lines as l')
        .join('txn_transactions as t', 'l.transaction_id', 't.id')
        .where('t.status', TXN_STATUS.CONFIRMED)
        .where('l.party_id', partyId);

    if (orgId     !== null) query = query.where('t.org_id',     orgId);
    if (projectId !== null) query = query.where('t.project_id', projectId);
    if (projectResourceId)  query = query.where('l.project_resource_id', projectResourceId);

    if (projectResourceId) {
        const result = await query
            .select('l.party_id', 'l.project_resource_id')
            .sum('l.signed_qty as net_qty')
            .groupBy('l.party_id', 'l.project_resource_id')
            .first();

        return {
            party_id:    partyId,
            project_resource_id: projectResourceId,
            net_qty:     result ? Number(result.net_qty) : 0,
        };
    } else {
        const results = await query
            .select('l.party_id', 'l.project_resource_id')
            .sum('l.signed_qty as net_qty')
            .groupBy('l.party_id', 'l.project_resource_id');

        return results.map((r) => ({
            party_id:    r.party_id,
            project_resource_id: r.project_resource_id,
            net_qty:     Number(r.net_qty),
        }));
    }
}

/**
 * Returns party ledger (passbook) with running balance per project resource.
 * party_id is pdoc_parties.pv_id (INT UNSIGNED).
 */
export async function getPartyLedger(pvId, rawProjectId = null, rawOrgId = null) {
    const partyId   = parseIntOrNull(pvId);
    const orgId     = parseIntOrNull(rawOrgId);
    const projectId = parseIntOrNull(rawProjectId);

    if (!partyId) throw new AppError('party_id (pdoc_parties.pv_id) is required and must be a positive integer', 400);

    let query = db('txn_transaction_lines as l')
        .join('txn_transactions as t', 'l.transaction_id', 't.id')
        .where('t.status', TXN_STATUS.CONFIRMED)
        .where('l.party_id', partyId);

    if (orgId     !== null) query = query.where('t.org_id',     orgId);
    if (projectId !== null) query = query.where('t.project_id', projectId);

    query = query
        .select(
            'l.id as line_id',
            't.id as transaction_id',
            't.org_id',
            't.project_id',
            't.txn_type',
            't.txn_date',
            't.remarks',
            'l.party_id',
            'l.project_resource_id',
            'l.signed_qty',
            'l.uom_id',
            'l.role',
            'l.notes',
            't.created_at'
        )
        .orderBy('t.txn_date', 'asc')
        .orderBy('t.created_at', 'asc')
        .orderBy('l.id', 'asc');

    const lines = await query;
    const runningBalances = {};

    return lines.map((line) => {
        const projectResourceId = line.project_resource_id;
        const signedQty = Number(line.signed_qty);
        runningBalances[projectResourceId] = (runningBalances[projectResourceId] || 0) + signedQty;

        return {
            ...line,
            signed_qty:      signedQty,
            running_balance: runningBalances[projectResourceId],
        };
    });
}

/**
 * Returns the active project party list for a project (pdoc_parties JOIN crm_contacts).
 * This is the source of truth for valid party_id values in transaction lines.
 */
export async function getProjectParties(rawProjectId) {
    const projectId = parseIntOrNull(rawProjectId);
    if (!projectId) throw new AppError('project_id is required', 400);

    const parties = await db('pdoc_parties as pp')
        .join('crm_contacts as c', 'pp.party_id', 'c.id')
        .whereNull('pp.deleted_at')
        .where('pp.project_id', projectId)
        .select(
            'pp.pv_id',
            'pp.project_id',
            'pp.party_id as crm_contact_id',
            'c.name',
            'c.category',
            'c.mobile',
            'c.email',
        )
        .orderBy('c.category')
        .orderBy('c.name');

    return parties;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Integration Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assign supply from PMC/supplier (fromPartyId) to a contractor (toPartyId).
 * Both are pdoc_parties.pv_id integers for this project.
 */
export async function assignSupplyToContractor({ orgId, projectId, fromPartyId, toPartyId, projectResourceId, qty, uomId, remarks, createdBy, status = TXN_STATUS.CONFIRMED }) {
    const txnData = {
        org_id:     orgId,
        project_id: projectId,
        txn_type:   TXN_TYPES.SUPPLY_ASSIGN,
        txn_date:   new Date(),
        status,
        remarks:    remarks || null,
        created_by: createdBy,
    };

    const lines = [
        {
            party_id:    fromPartyId,
            project_resource_id: projectResourceId,
            signed_qty:  -Math.abs(qty),
            uom_id:      uomId,
            role:        ROLES.OWNER,
        },
        {
            party_id:    toPartyId,
            project_resource_id: projectResourceId,
            signed_qty:  Math.abs(qty),
            uom_id:      uomId,
            role:        ROLES.OWNER,
        },
    ];

    return await createTransaction(txnData, lines);
}

/**
 * Transfer resource custody between two contractors (both pdoc_parties.pv_id).
 */
export async function transferBetweenContractors({ orgId, projectId, fromPartyId, toPartyId, projectResourceId, qty, uomId, remarks, createdBy, status = TXN_STATUS.CONFIRMED }) {
    const txnData = {
        org_id:     orgId,
        project_id: projectId,
        txn_type:   TXN_TYPES.TRANSFER_PARTY,
        txn_date:   new Date(),
        status,
        remarks:    remarks || null,
        created_by: createdBy,
    };

    const lines = [
        {
            party_id:    fromPartyId,
            project_resource_id: projectResourceId,
            signed_qty:  -Math.abs(qty),
            uom_id:      uomId,
            role:        ROLES.EXECUTOR,
        },
        {
            party_id:    toPartyId,
            project_resource_id: projectResourceId,
            signed_qty:  Math.abs(qty),
            uom_id:      uomId,
            role:        ROLES.EXECUTOR,
        },
    ];

    return await createTransaction(txnData, lines);
}
