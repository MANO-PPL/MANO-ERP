import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

async function assertScopedContact(connection, contactId, orgId) {
    const contact = await connection('crm_contacts').where({ id: contactId, org_id: orgId }).first('id');
    if (!contact) throw new AppError('Contact not found', 404);
    return contact;
}

/**
 * List interactions for an organization, optionally filtered by contact_id or type.
 */
export async function listInteractions(orgId, query = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = Math.min(parseInt(query.limit, 10) || 50, 200);
    const offset = (page - 1) * limit;

    const baseQuery = db('crm_interactions as i')
        .join('crm_contacts as c', 'i.contact_id', 'c.id')
        .leftJoin('iam_users as u', 'i.interacted_by', 'u.id')
        .where('c.org_id', orgId);

    if (query.contact_id) baseQuery.where('i.contact_id', Number(query.contact_id));
    if (query.type) baseQuery.where('i.type', query.type);

    const countRow = await baseQuery.clone().count('i.id as total').first();
    const total = parseInt(countRow?.total || 0, 10);

    const interactions = await baseQuery
        .select('i.*', 'c.name as contact_name', 'c.category as contact_category', 'u.user_name as interacted_by_name')
        .orderBy('i.interaction_date', 'desc')
        .orderBy('i.id', 'desc')
        .limit(limit)
        .offset(offset);

    return { interactions, total, page, limit };
}

/**
 * Fetch all interactions for a single contact ordered newest first.
 */
export async function getInteractionsForContact(contactId, connection = db) {
    return connection('crm_interactions as i')
        .leftJoin('iam_users as u', 'i.interacted_by', 'u.id')
        .where({ 'i.contact_id': contactId })
        .select('i.*', 'u.user_name as interacted_by_name')
        .orderBy('i.interaction_date', 'desc');
}

/**
 * Fetch interactions grouped by contact_id for bulk list enrichment.
 */
export async function getInteractionsByContactIds(contactIds, options = {}, connection = db) {
    if (!Array.isArray(contactIds) || contactIds.length === 0) return {};
    const q = connection('crm_interactions').whereIn('contact_id', contactIds);
    if (options.unassignedOnly) q.whereNull('interacted_by');
    const rows = await q.select('*');

    return rows.reduce((acc, row) => {
        if (!acc[row.contact_id]) acc[row.contact_id] = [];
        acc[row.contact_id].push(row);
        return acc;
    }, {});
}

/**
 * Aggregate latest Call, Site Visit, follow-up date, and remark per contact_id.
 */
export async function getLatestSummaryByContactIds(contactIds, connection = db) {
    if (!Array.isArray(contactIds) || contactIds.length === 0) return {};

    const aggregated = await connection('crm_interactions')
        .whereIn('contact_id', contactIds)
        .whereIn('type', ['Call', 'Site Visit'])
        .groupBy('contact_id', 'type')
        .select('contact_id', 'type')
        .max('interaction_date as latest_date')
        .max('follow_up_date as latest_follow_up');

    const latestByContact = {};
    aggregated.forEach(agg => {
        if (!latestByContact[agg.contact_id]) {
            latestByContact[agg.contact_id] = {
                called_date: null,
                visited_date: null,
                call_on_date: null,
                interaction_remark: null
            };
        }
        const t = agg.type.toLowerCase();
        if (t === 'call') {
            latestByContact[agg.contact_id].called_date = agg.latest_date;
            latestByContact[agg.contact_id].call_on_date = agg.latest_follow_up;
        } else if (t === 'site visit') {
            latestByContact[agg.contact_id].visited_date = agg.latest_date;
        }
    });

    const latestOverall = await connection('crm_interactions as i')
        .whereIn('i.contact_id', contactIds)
        .whereRaw('i.id IN (SELECT MAX(id) FROM crm_interactions WHERE contact_id = i.contact_id)')
        .select('i.contact_id', 'i.remarks', 'i.follow_up_date');

    latestOverall.forEach(latest => {
        if (!latestByContact[latest.contact_id]) {
            latestByContact[latest.contact_id] = {
                called_date: null,
                visited_date: null,
                call_on_date: null,
                interaction_remark: null
            };
        }
        latestByContact[latest.contact_id].interaction_remark = latest.remarks;
        if (latest.follow_up_date && !latestByContact[latest.contact_id].call_on_date) {
            latestByContact[latest.contact_id].call_on_date = latest.follow_up_date;
        }
    });

    return latestByContact;
}

/**
 * Create a single interaction for an org-scoped contact.
 */
export async function createInteraction(orgId, data, options = {}) {
    const connection = options.transaction || db;
    const { contact_id, type, interaction_date, follow_up_date, remarks, interacted_by } = data;

    if (!contact_id || !type || !interaction_date) {
        throw new AppError('Missing required interaction fields', 400);
    }

    await assertScopedContact(connection, contact_id, orgId);

    const hasOrgIdCol = await connection.schema.hasColumn('crm_interactions', 'org_id');
    const insertPayload = {
        contact_id,
        type,
        interaction_date,
        follow_up_date: follow_up_date || null,
        remarks: remarks || null,
        interacted_by: interacted_by || null,
        created_at: connection.fn.now(),
        updated_at: connection.fn.now()
    };
    if (hasOrgIdCol) insertPayload.org_id = orgId;

    const [newId] = await connection('crm_interactions').insert(insertPayload);

    return newId;
}

/**
 * Create multiple interactions from a contact create/update payload.
 */
export async function createInteractionsBatch(orgId, contactId, rawInteractions, options = {}) {
    const items = Array.isArray(rawInteractions)
        ? rawInteractions
        : (rawInteractions ? [rawInteractions] : []);

    for (const item of items) {
        if (!item || !item.type || (options.skipExisting && item.id)) continue;
        await createInteraction(orgId, {
            contact_id: contactId,
            type: item.type,
            interaction_date: item.interaction_date || new Date().toISOString().split('T')[0],
            follow_up_date: item.follow_up_date || null,
            remarks: item.remarks || null,
            interacted_by: item.interacted_by || options.defaultInteractedBy || options.userId || null
        }, { transaction: options.transaction });
    }
}

/**
 * Delete a single interaction belonging to a contact in the org.
 */
export async function deleteInteraction(orgId, contactId, interactionId, options = {}) {
    const connection = options.transaction || db;
    await assertScopedContact(connection, contactId, orgId);
    const deletedCount = await connection('crm_interactions')
        .where({ id: interactionId, contact_id: contactId })
        .delete();

    if (!deletedCount) {
        throw new AppError('Interaction not found or unauthorized', 404);
    }
    return true;
}

/**
 * Delete all interactions for a set/subquery of contact IDs.
 */
export async function deleteInteractionsByContactIds(contactIdsOrSubquery, options = {}) {
    const connection = options.transaction || db;
    return connection('crm_interactions').whereIn('contact_id', contactIdsOrSubquery).delete();
}

export default {
    listInteractions,
    getInteractionsForContact,
    getInteractionsByContactIds,
    getLatestSummaryByContactIds,
    createInteraction,
    createInteractionsBatch,
    deleteInteraction,
    deleteInteractionsByContactIds
};
