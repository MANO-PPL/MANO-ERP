import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { validateTransaction, TXN_TYPES, TXN_STATUS, ROLES } from './ledgerValidation.js';

function parseIntOrNull(val) {
    if (val === undefined || val === null || val === '') return null;
    const parsed = Number(val);
    return isNaN(parsed) ? null : parsed;
}

/**
 * Verifies that non-Supplier parties have sufficient stock before transferring out resources.
 * Suppliers have unlimited allocation capacity. Contractors & others cannot transfer out more than their current net balance.
 */
async function verifyPartyStockSufficiency(trx, projectId, orgId, linesToValidate) {
    const outflowLines = linesToValidate.filter(l => Number(l.signed_qty) < 0);
    if (outflowLines.length === 0) return;

    const partyIds = Array.from(new Set(outflowLines.map(l => l.party_id)));

    // Fetch vendor details (category) from pdoc_vendors JOIN crm_contacts
    const vendorDetails = await trx('pdoc_vendors as pv')
        .join('crm_contacts as c', 'pv.vendors_id', 'c.id')
        .whereIn('pv.pv_id', partyIds)
        .select('pv.pv_id', 'c.name', 'c.category');

    const vendorMap = {};
    vendorDetails.forEach(v => {
        vendorMap[v.pv_id] = v;
    });

    for (const line of outflowLines) {
        const vendor = vendorMap[line.party_id];
        const category = (vendor?.category || '').toLowerCase();
        const partyName = vendor?.name || `Party #${line.party_id}`;

        // Suppliers can issue unlimited supply — skip stock balance enforcement for Suppliers
        if (category.includes('supplier')) {
            continue;
        }

        // For Contractors & non-suppliers, query current net confirmed stock position for this resource
        let posQuery = trx('txn_transaction_lines as l')
            .join('txn_transactions as t', 'l.transaction_id', 't.id')
            .where('t.status', TXN_STATUS.CONFIRMED)
            .where('l.party_id', line.party_id)
            .where('l.resource_id', line.resource_id);

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
 * party_id is always INT UNSIGNED referencing pdoc_vendors.pv_id.
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
            throw new AppError(`Line at index ${i} has invalid party_id "${rawPartyId}". Must be a positive integer (pdoc_vendors.pv_id)`, 400);
        }

        const signedQty = Number(line.signed_qty ?? line.signedQty ?? line.qty);
        const resId     = line.resource_id ?? line.resourceId;

        return {
            party_id:    partyId,
            resource_id: parseIntOrNull(resId),
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
 * Returns net inventory position per resource for a given party (pdoc_vendors.pv_id).
 */
export async function getPartyResourcePosition(pvId, rawResourceId = null, rawProjectId = null, rawOrgId = null) {
    const partyId   = parseIntOrNull(pvId);
    const orgId     = parseIntOrNull(rawOrgId);
    const projectId = parseIntOrNull(rawProjectId);
    const resourceId = parseIntOrNull(rawResourceId);

    if (!partyId) throw new AppError('party_id (pdoc_vendors.pv_id) is required and must be a positive integer', 400);

    let query = db('txn_transaction_lines as l')
        .join('txn_transactions as t', 'l.transaction_id', 't.id')
        .where('t.status', TXN_STATUS.CONFIRMED)
        .where('l.party_id', partyId);

    if (orgId     !== null) query = query.where('t.org_id',     orgId);
    if (projectId !== null) query = query.where('t.project_id', projectId);
    if (resourceId)         query = query.where('l.resource_id', resourceId);

    if (resourceId) {
        const result = await query
            .select('l.party_id', 'l.resource_id')
            .sum('l.signed_qty as net_qty')
            .groupBy('l.party_id', 'l.resource_id')
            .first();

        return {
            party_id:    partyId,
            resource_id: resourceId,
            net_qty:     result ? Number(result.net_qty) : 0,
        };
    } else {
        const results = await query
            .select('l.party_id', 'l.resource_id')
            .sum('l.signed_qty as net_qty')
            .groupBy('l.party_id', 'l.resource_id');

        return results.map((r) => ({
            party_id:    r.party_id,
            resource_id: r.resource_id,
            net_qty:     Number(r.net_qty),
        }));
    }
}

/**
 * Returns party ledger (passbook) with running balance per resource.
 * party_id is pdoc_vendors.pv_id (INT UNSIGNED).
 */
export async function getPartyLedger(pvId, rawProjectId = null, rawOrgId = null) {
    const partyId   = parseIntOrNull(pvId);
    const orgId     = parseIntOrNull(rawOrgId);
    const projectId = parseIntOrNull(rawProjectId);

    if (!partyId) throw new AppError('party_id (pdoc_vendors.pv_id) is required and must be a positive integer', 400);

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
            'l.resource_id',
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
        const resId    = line.resource_id;
        const signedQty = Number(line.signed_qty);
        runningBalances[resId] = (runningBalances[resId] || 0) + signedQty;

        return {
            ...line,
            signed_qty:      signedQty,
            running_balance: runningBalances[resId],
        };
    });
}

/**
 * Returns the active project vendor list for a project (pdoc_vendors JOIN crm_contacts).
 * This is the source of truth for valid party_id values in transaction lines.
 */
export async function getProjectVendors(rawProjectId) {
    const projectId = parseIntOrNull(rawProjectId);
    if (!projectId) throw new AppError('project_id is required', 400);

    const vendors = await db('pdoc_vendors as pv')
        .join('crm_contacts as c', 'pv.vendors_id', 'c.id')
        .whereNull('pv.deleted_at')
        .where('pv.project_id', projectId)
        .select(
            'pv.pv_id',
            'pv.project_id',
            'pv.vendors_id as crm_contact_id',
            'c.name',
            'c.type',
            'c.category',
            'c.mobile',
            'c.email',
        )
        .orderBy('c.category')
        .orderBy('c.name');

    return vendors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Integration Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assign supply from PMC/supplier (fromPartyId) to a contractor (toPartyId).
 * Both are pdoc_vendors.pv_id integers for this project.
 */
export async function assignSupplyToContractor({ orgId, projectId, fromPartyId, toPartyId, resourceId, qty, uomId, remarks, createdBy, status = TXN_STATUS.CONFIRMED }) {
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
            resource_id: resourceId,
            signed_qty:  -Math.abs(qty),
            uom_id:      uomId,
            role:        ROLES.OWNER,
        },
        {
            party_id:    toPartyId,
            resource_id: resourceId,
            signed_qty:  Math.abs(qty),
            uom_id:      uomId,
            role:        ROLES.OWNER,
        },
    ];

    return await createTransaction(txnData, lines);
}

/**
 * Transfer resource custody between two contractors (both pdoc_vendors.pv_id).
 */
export async function transferBetweenContractors({ orgId, projectId, fromPartyId, toPartyId, resourceId, qty, uomId, remarks, createdBy, status = TXN_STATUS.CONFIRMED }) {
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
            resource_id: resourceId,
            signed_qty:  -Math.abs(qty),
            uom_id:      uomId,
            role:        ROLES.EXECUTOR,
        },
        {
            party_id:    toPartyId,
            resource_id: resourceId,
            signed_qty:  Math.abs(qty),
            uom_id:      uomId,
            role:        ROLES.EXECUTOR,
        },
    ];

    return await createTransaction(txnData, lines);
}
