import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { findOrCreateSector } from '../shared/sectorService.js';
import { findOrCreateJobNature } from '../shared/jobNatureService.js';
import interactionService from '../interactions/interactionService.js';

const VALID_CATEGORIES = ['Contractor', 'Supplier', 'Consultant', 'Manufacturer', 'Service Provider', 'Client', 'PMC'];
const CONTACT_CATEGORIES = ['Contractor', 'Consultants', 'Supplier', 'Client', 'PMC'];
const CONTACT_FIELDS = [
    'id', 'org_id', 'name', 'scope', 'sector_id', 'job_nature_id', 'category',
    'contact_person', 'designation', 'telephone_no', 'mobile', 'email', 'address',
    'location', 'website', 'gst_no', 'constitution', 'reference',
    'remarks', 'status', 'created_by', 'updated_by', 'created_at', 'updated_at'
];

/**
 * Startup self-healing schema migration for CRM/Parties tables.
 */
export async function initializeCrmSchema() {
    const tables = ['crm_contacts', 'crm_job_nature', 'crm_sectors'];
    for (const t of tables) {
        const hasTable = await db.schema.hasTable(t);
        if (!hasTable) continue;

        if (t === 'crm_contacts') {
            if (!(await db.schema.hasColumn(t, 'scope'))) {
                await db.schema.alterTable(t, (table) => {
                    table.enu('scope', ['master', 'project']).notNullable().defaultTo('master');
                });
                console.log('Added crm_contacts.scope with master default');
            }
            if (!(await db.schema.hasColumn(t, 'status'))) {
                await db.schema.alterTable(t, (table) => {
                    table.enu('status', ['active', 'archived']).notNullable().defaultTo('active');
                });
                console.log('Added crm_contacts.status with active default');
            }
            if (await db.schema.hasColumn(t, 'archived_at')) {
                await db.schema.alterTable(t, (table) => {
                    table.dropColumn('archived_at');
                });
            }
            if (!(await db.schema.hasColumn(t, 'created_by'))) {
                await db.schema.alterTable(t, (table) => {
                    table.integer('created_by').unsigned().nullable();
                    table.foreign('created_by', 'fk_contacts_created_by').references('id').inTable('iam_users').onDelete('SET NULL');
                });
            }
            if (!(await db.schema.hasColumn(t, 'updated_by'))) {
                await db.schema.alterTable(t, (table) => {
                    table.integer('updated_by').unsigned().nullable();
                    table.foreign('updated_by', 'fk_contacts_updated_by').references('id').inTable('iam_users').onDelete('SET NULL');
                });
            }

            const [statusIdx] = await db.raw("SHOW INDEXES FROM crm_contacts WHERE Key_name = 'idx_contacts_org_status'");
            if (!statusIdx || statusIdx.length === 0) {
                await db.raw('ALTER TABLE crm_contacts ADD INDEX idx_contacts_org_status (org_id, status)');
            }

            if (await db.schema.hasColumn(t, 'responsibility')) {
                await db.raw(`
                    UPDATE crm_contacts c
                    JOIN iam_users u
                      ON u.org_id = c.org_id
                     AND LOWER(TRIM(u.user_name)) = LOWER(TRIM(c.responsibility))
                    SET c.created_by = u.id
                    WHERE c.created_by IS NULL
                      AND c.responsibility IS NOT NULL
                      AND TRIM(c.responsibility) != ''
                `);
                await db.raw(`
                    UPDATE crm_contacts c
                    JOIN iam_users u
                      ON u.org_id = c.org_id
                     AND LOWER(TRIM(u.user_name)) LIKE CONCAT(LOWER(TRIM(c.responsibility)), ' %')
                    SET c.created_by = u.id
                    WHERE c.created_by IS NULL
                      AND c.responsibility IS NOT NULL
                      AND CHAR_LENGTH(TRIM(c.responsibility)) >= 3
                `);
            }
        }

        const hasOrgId = await db.schema.hasColumn(t, 'org_id');
        if (!hasOrgId) {
            await db.schema.alterTable(t, (table) => {
                table.integer('org_id').unsigned().nullable();
            });
            await db(t).update({ org_id: 2 });
            await db.schema.alterTable(t, (table) => {
                table.integer('org_id').unsigned().notNullable().alter();
            });
        }
    }

    if (!(await db.schema.hasTable('crm_change_log'))) {
        await db.schema.createTable('crm_change_log', (table) => {
            table.increments('id');
            table.integer('org_id').unsigned().notNullable();
            table.integer('entity_id').unsigned().notNullable();
            table.string('action', 30).notNullable();
            table.json('before_data').nullable();
            table.json('after_data').nullable();
            table.string('reason', 255).nullable();
            table.integer('user_id').unsigned().nullable();
            table.dateTime('at').notNullable().defaultTo(db.fn.now());
            table.index(['org_id', 'entity_id', 'at'], 'idx_crm_log_entity');
        });
        console.log('Created crm_change_log table');
    }
}

export async function writePartyChangeLog(connection, { orgId, entityId, action, beforeData = null, afterData = null, reason = null, userId = null }) {
    if (!(await connection.schema.hasTable('crm_change_log'))) return;
    await connection('crm_change_log').insert({
        org_id: orgId,
        entity_id: entityId,
        action,
        before_data: beforeData !== null && beforeData !== undefined ? JSON.stringify(beforeData) : null,
        after_data: afterData !== null && afterData !== undefined ? JSON.stringify(afterData) : null,
        reason: reason ? String(reason).trim().slice(0, 255) : null,
        user_id: userId || null
    });
}

export function resolveCategory(cat, fallback = 'Contractor') {
    if (!cat) return fallback;
    const clean = String(cat).trim();
    if (!clean) return fallback;
    const matched = VALID_CATEGORIES.find(c => c.toLowerCase() === clean.toLowerCase());
    if (matched) return matched;
    if (clean.toLowerCase() === 'consultants') return 'Consultant';
    throw new AppError(`Invalid category "${cat}". Allowed categories are: ${VALID_CATEGORIES.join(', ')}`, 400);
}

export function applyPartyScopeFilter(qb, scopeMode = 'all', alias = 'c') {
    const col = alias ? `${alias}.category` : 'category';
    if (scopeMode === 'client') {
        return qb.whereRaw('LOWER(??) = ?', [col, 'client']);
    }
    if (scopeMode === 'vendor') {
        return qb.where(function () {
            this.whereNull(col)
                .orWhereRaw('LOWER(??) NOT IN (?, ?)', [col, 'client', 'pmc']);
        });
    }
    return qb;
}

function positiveId(value, field) {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
        throw new AppError(`${field} must be a positive integer`, 400);
    }
    return num;
}

function isDuplicateEntry(error) {
    return error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062;
}

function duplicateLinkError(contactId, projectId) {
    return new AppError(`Contact ${contactId} is already linked to project ${projectId}`, 409);
}

async function getScopedProject(connection, projectId, orgId) {
    const project = await connection('proj_projects').where({ id: projectId, org_id: orgId }).first();
    if (!project) throw new AppError('Project not found', 404);
    return project;
}

async function getScopedContact(connection, contactId, orgId) {
    const contact = await connection('crm_contacts').where({ id: contactId, org_id: orgId }).first();
    if (!contact) throw new AppError('Contact not found', 404);
    return contact;
}

async function resolveContactReferences(orgId, data, connection = db) {
    const resolved = { ...data };
    if ((data.sector || data.sector_name) && !data.sector_id) {
        resolved.sector_id = await findOrCreateSector(orgId, data.sector || data.sector_name, connection);
    }
    if ((data.job_nature || data.job_nature_name || data.job_name) && !data.job_nature_id && !data.job_id) {
        resolved.job_nature_id = await findOrCreateJobNature(
            orgId, data.job_nature || data.job_nature_name || data.job_name, connection
        );
    }
    return resolved;
}

/**
 * List parties with unified filtering, search, pagination, and interaction summaries.
 */
export async function listParties(orgId, query = {}, options = {}) {
    const scopeMode = options.scopeMode || query.party_type || 'all';
    const defaultLimit = scopeMode === 'vendor' ? 10 : 20;
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || defaultLimit;
    const offset = query.agentRead === true ? (query.agentOffset || 0) : (page - 1) * limit;

    const includeProjectInfo = query.scope === 'project' || Boolean(query.project_id);

    const baseQuery = db('crm_contacts as c')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.id')
        .leftJoin('crm_sectors as s', 'c.sector_id', 's.id')
        .leftJoin('iam_users as cu', 'c.created_by', 'cu.id')
        .andWhere('c.org_id', orgId);

    if (includeProjectInfo) {
        baseQuery
            .leftJoin('proj_parties as pp', 'c.id', 'pp.contact_id')
            .leftJoin('proj_projects as p', 'pp.project_id', 'p.id');
        if (query.project_id) {
            baseQuery.andWhere('pp.project_id', Number(query.project_id));
        }
    }

    applyPartyScopeFilter(baseQuery, scopeMode, 'c');

    const applyFilters = (qb) => {
        if (query.status === 'archived') {
            qb = qb.where('c.status', 'archived');
        } else if (query.status !== 'all') {
            qb = qb.where('c.status', 'active');
        }
        if (query.agentMasterOnly === true || query.scope === 'master') qb = qb.where('c.scope', 'master');
        else if (query.scope === 'project') qb = qb.where('c.scope', 'project');

        if (query.search) {
            const term = `%${String(query.search).trim()}%`;
            qb = qb.where(function () {
                this.where('c.name', 'like', term)
                    .orWhere('c.contact_person', 'like', term)
                    .orWhere('c.mobile', 'like', term)
                    .orWhere('c.email', 'like', term)
                    .orWhere('c.location', 'like', term)
                    .orWhere('jn.job_name', 'like', term);
            });
        }
        if (query.company || query.name) qb = qb.where('c.name', 'like', `%${query.company || query.name}%`);
        if (query.person || query.contact_person) qb = qb.where('c.contact_person', 'like', `%${query.person || query.contact_person}%`);
        if (query.location) qb = qb.where('c.location', 'like', `%${query.location}%`);
        if (query.jobNature || query.job_nature) qb = qb.where('jn.job_name', 'like', `%${query.jobNature || query.job_nature}%`);

        if (query.category) {
            qb = qb.where('c.category', resolveCategory(query.category));
        }
        if (query.categories && query.categories.length > 0) {
            let cats = Array.isArray(query.categories) ? query.categories : String(query.categories).split(',').filter(Boolean);
            if (cats.length > 0) {
                cats = cats.map(c => c.toLowerCase());
                if (cats.includes('consultant') && !cats.includes('consultants')) cats.push('consultants');
                if (cats.includes('consultants') && !cats.includes('consultant')) cats.push('consultant');
                qb = qb.whereIn(db.raw('LOWER(c.category)'), cats);
            }
        }
        if (query.jobs && query.jobs.length > 0) {
            const jobs = Array.isArray(query.jobs) ? query.jobs : String(query.jobs).split(',').filter(Boolean);
            if (jobs.length > 0) {
                const hasNames = jobs.some(j => isNaN(parseInt(j)));
                qb = hasNames ? qb.whereIn('jn.job_name', jobs) : qb.whereIn('c.job_nature_id', jobs);
            }
        }
        if (query.sectors && query.sectors.length > 0) {
            const sectors = Array.isArray(query.sectors) ? query.sectors : String(query.sectors).split(',').filter(Boolean);
            if (sectors.length > 0) {
                const hasNames = sectors.some(s => isNaN(parseInt(s)));
                qb = hasNames ? qb.whereIn('s.sector_name', sectors) : qb.whereIn('c.sector_id', sectors);
            }
        }
        return qb;
    };

    const countRes = await applyFilters(baseQuery.clone()).countDistinct('c.id as total').first();
    const total = parseInt(countRes?.total || 0);

    const selectFields = [
        'c.*',
        'jn.job_name',
        's.sector_name',
        'cu.user_name as created_by_name',
        'cu.user_name as responsibility'
    ];
    if (includeProjectInfo) {
        selectFields.push('pp.project_id', 'p.name as project_name');
    }

    const rows = await applyFilters(baseQuery)
        .select(...selectFields)
        .orderBy('c.created_at', 'asc')
        .limit(limit)
        .offset(offset);

    if (query.agentRead === true || rows.length === 0) {
        return { parties: rows, total, page, limit };
    }

    const ids = rows.map(r => r.id);

    if (scopeMode === 'client') {
        const latestByContact = await interactionService.getLatestSummaryByContactIds(ids);

        return {
            parties: rows.map(c => ({
                ...c,
                called_date: latestByContact[c.id]?.called_date || null,
                visited_date: latestByContact[c.id]?.visited_date || null,
                call_on_date: latestByContact[c.id]?.call_on_date || null,
                interaction_remark: latestByContact[c.id]?.interaction_remark || null
            })),
            total,
            page,
            limit
        };
    }

    let interactionsByContact = {};
    if (query.include_interactions === 'true' || query.include_interactions === true) {
        interactionsByContact = await interactionService.getInteractionsByContactIds(ids, { unassignedOnly: true });
    }

    return {
        parties: rows.map(v => ({
            ...v,
            telephone_no: v.telephone_no || v.mobile || null,
            contact_no: v.telephone_no || v.mobile || null,
            web_site: v.website,
            self_remark: v.remarks,
            job_id: v.job_nature_id,
            interactions: interactionsByContact[v.id] || []
        })),
        total,
        page,
        limit
    };
}

/**
 * Fetch single party details along with interactions.
 */
export async function getPartyById(orgId, id, options = {}) {
    const scopeMode = options.scopeMode || 'all';
    const q = db('crm_contacts as c')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.id')
        .leftJoin('crm_sectors as s', 'c.sector_id', 's.id')
        .leftJoin('iam_users as cu', 'c.created_by', 'cu.id')
        .where({ 'c.id': id, 'c.org_id': orgId });

    applyPartyScopeFilter(q, scopeMode, 'c');

    const party = await q.select(
        'c.*',
        'jn.job_name',
        's.sector_name',
        'cu.user_name as created_by_name',
        'cu.user_name as responsibility'
    ).first();

    if (!party) {
        const label = scopeMode === 'client' ? 'Client' : scopeMode === 'vendor' ? 'Vendor' : 'Party';
        throw new AppError(`${label} not found`, 404);
    }

    if (options.agentRead === true) return party;

    const interactions = await interactionService.getInteractionsForContact(id);

    const baseParty = {
        ...party,
        contact_no: party.telephone_no || party.mobile || null,
        telephone: party.telephone_no || null,
        web_site: party.website,
        self_remark: party.remarks,
        job_id: party.job_nature_id,
        interactions
    };

    if (scopeMode === 'client') {
        const latestByType = interactions.reduce((acc, interaction) => {
            const type = interaction.type.toLowerCase();
            if (!acc[type]) acc[type] = interaction.interaction_date;
            return acc;
        }, {});
        const latestOverall = interactions[0];

        return {
            ...baseParty,
            called_date: latestByType['call'] || null,
            visited_date: latestByType['site visit'] || null,
            call_on_date: latestOverall ? latestOverall.follow_up_date : null,
            interaction_remark: latestOverall ? latestOverall.remarks : null
        };
    }

    return baseParty;
}

/**
 * Create a new party record in crm_contacts.
 */
export async function createParty(orgId, data, options = {}) {
    const scopeMode = options.scopeMode || 'all';
    const label = scopeMode === 'client' ? 'Client' : scopeMode === 'vendor' ? 'Vendor' : 'Party';

    const run = async (connection) => {
        if (options.agentSupplierOnly === true && (!connection.isTransaction || data.category !== 'Supplier'
            || Object.keys(data).some(key => !['name', 'category', 'contact_person', 'mobile', 'email', 'address'].includes(key)))) {
            throw new AppError('Agent supplier creation requires an exact caller transaction operation', 400);
        }
        if (!data.name) {
            throw new AppError(`${label} name is required`, 400);
        }

        if (options.skipDuplicateCheck !== true) {
            const dupQuery = connection('crm_contacts')
                .where({ org_id: orgId })
                .whereRaw('LOWER(TRIM(name)) = ?', [String(data.name).trim().toLowerCase()]);
            applyPartyScopeFilter(dupQuery, scopeMode, null);
            const existing = await dupQuery.first();
            if (existing) {
                throw new AppError(`Data already exists: A ${label.toLowerCase()} with the name "${data.name.trim()}" already exists`, 409);
            }
        }

        const resolved = await resolveContactReferences(orgId, data, connection);
        const resolvedCategory = scopeMode === 'client'
            ? 'Client'
            : resolveCategory(data.category, 'Contractor');
        const insertData = buildScopedContact(
            orgId,
            { ...resolved, category: resolvedCategory, status: data.status === 'archived' ? 'archived' : 'active' },
            data.scope === 'project' ? 'project' : 'master',
            options
        );

        const [newId] = await connection('crm_contacts').insert(insertData);

        await writePartyChangeLog(connection, {
            orgId,
            entityId: newId,
            action: 'create',
            beforeData: null,
            afterData: { name: insertData.name, category: insertData.category, scope: insertData.scope },
            reason: data.reason || null,
            userId: options.userId || null
        });

        await interactionService.createInteractionsBatch(
            orgId,
            newId,
            data.interactions || data.interaction,
            { transaction: connection, defaultInteractedBy: data.interacted_by, userId: options.userId }
        );

        return newId;
    };

    if (options.transaction) {
        return await run(options.transaction);
    }
    return await db.transaction(run);
}

/**
 * Update an existing party record.
 */
export async function updateParty(orgId, id, data, options = {}) {
    const scopeMode = options.scopeMode || 'all';
    const label = scopeMode === 'client' ? 'Client' : scopeMode === 'vendor' ? 'Vendor' : 'Party';

    const run = async (connection) => {
        const q = connection('crm_contacts').where({ id, org_id: orgId });
        applyPartyScopeFilter(q, scopeMode, null);
        const existing = await q.first();
        if (!existing) {
            throw new AppError(`${label} not found`, 404);
        }

        const updateData = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.sector_id !== undefined) updateData.sector_id = data.sector_id;
        if (data.job_nature_id !== undefined) updateData.job_nature_id = data.job_nature_id;
        if (data.job_id !== undefined) updateData.job_nature_id = data.job_id;
        if (scopeMode === 'client') {
            updateData.category = 'Client';
        } else if (data.category !== undefined) {
            updateData.category = resolveCategory(data.category, existing.category || 'Contractor');
        }
        if (data.contact_person !== undefined) updateData.contact_person = data.contact_person;
        if (data.designation !== undefined) updateData.designation = data.designation;
        if (data.telephone_no !== undefined) updateData.telephone_no = data.telephone_no;
        else if (data.contact_no !== undefined) updateData.telephone_no = data.contact_no;
        if (data.mobile !== undefined) updateData.mobile = data.mobile;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.address !== undefined) updateData.address = data.address;
        if (data.location !== undefined) updateData.location = data.location;
        if (data.website !== undefined) updateData.website = data.website;
        else if (data.web_site !== undefined) updateData.website = data.web_site;
        if (data.gst_no !== undefined) updateData.gst_no = data.gst_no;
        else if (data.qst_no !== undefined) updateData.gst_no = data.qst_no;
        if (data.constitution !== undefined) updateData.constitution = data.constitution;
        if (data.reference !== undefined) updateData.reference = data.reference;
        if (data.remarks !== undefined) updateData.remarks = data.remarks;
        else if (data.remark !== undefined) updateData.remarks = data.remark;
        else if (data.self_remark !== undefined) updateData.remarks = data.self_remark;

        if ((data.job_nature || data.job_nature_name || data.job_name) && !updateData.job_nature_id) {
            updateData.job_nature_id = await findOrCreateJobNature(orgId, data.job_nature || data.job_nature_name || data.job_name || data.job_id, connection);
        }
        if ((data.sector || data.sector_name) && !updateData.sector_id) {
            updateData.sector_id = await findOrCreateSector(orgId, data.sector || data.sector_name, connection);
        }

        if (data.status === 'active' || data.status === 'archived') {
            updateData.status = data.status;
        }
        if (options.userId) {
            updateData.updated_by = options.userId;
        }
        updateData.updated_at = connection.fn.now();

        await connection('crm_contacts').where({ id, org_id: orgId }).update(updateData);

        await writePartyChangeLog(connection, {
            orgId,
            entityId: Number(id),
            action: 'update',
            beforeData: { name: existing.name, category: existing.category, status: existing.status },
            afterData: { name: updateData.name ?? existing.name, category: updateData.category ?? existing.category, status: updateData.status ?? existing.status },
            reason: data.reason || null,
            userId: options.userId || null
        });

        await interactionService.createInteractionsBatch(
            orgId,
            id,
            data.interactions || data.interaction,
            { transaction: connection, defaultInteractedBy: data.interacted_by, userId: options.userId, skipExisting: true }
        );

        return true;
    };

    if (options.transaction) {
        return await run(options.transaction);
    }
    return await db.transaction(run);
}

/**
 * Archive or restore a party (soft lifecycle state) and write audit log.
 */
export async function setPartyStatus(orgId, id, status, options = {}) {
    if (status !== 'active' && status !== 'archived') {
        throw new AppError('Status must be active or archived', 400);
    }
    return db.transaction(async (trx) => {
        const beforeQuery = trx('crm_contacts').where({ id, org_id: orgId });
        applyPartyScopeFilter(beforeQuery, options.scopeMode || 'all', null);
        const before = await beforeQuery.first();
        if (!before) throw new AppError('Party not found', 404);

        await trx('crm_contacts')
            .where({ id, org_id: orgId })
            .update({
                status,
                updated_by: options.userId || null,
                updated_at: trx.fn.now()
            });

        const after = await getScopedContact(trx, id, orgId);
        await writePartyChangeLog(trx, {
            orgId,
            entityId: id,
            action: status === 'archived' ? 'archive' : 'restore',
            beforeData: { status: before.status },
            afterData: { status: after.status },
            reason: options.reason || null,
            userId: options.userId || null
        });
        return after;
    });
}

export async function listPartyChangeLog(orgId, id) {
    const contactId = positiveId(id, 'contact_id');
    await getScopedContact(db, contactId, orgId);
    if (!(await db.schema.hasTable('crm_change_log'))) return [];
    return db('crm_change_log as l')
        .leftJoin('iam_users as u', 'l.user_id', 'u.id')
        .where({ 'l.org_id': orgId, 'l.entity_id': contactId })
        .select('l.*', 'u.user_name')
        .orderBy('l.at', 'desc')
        .orderBy('l.id', 'desc');
}

/**
 * Hard-delete one or more parties if unreferenced; returns 409 if linked to projects.
 */
export async function deleteParties(orgId, ids, options = {}) {
    const scopeMode = options.scopeMode || 'all';
    const label = scopeMode === 'client' ? 'Client' : scopeMode === 'vendor' ? 'Vendor' : 'Party';
    const validIds = (Array.isArray(ids) ? ids : [ids]).filter(id => id && !String(id).startsWith('temp_'));
    if (validIds.length === 0) {
        throw new AppError(`No ${label} IDs provided`, 400);
    }

    const scopedRowsQuery = db('crm_contacts').whereIn('id', validIds).where({ org_id: orgId }).select('id', 'name', 'category', 'status');
    applyPartyScopeFilter(scopedRowsQuery, scopeMode, null);
    const toDelete = await scopedRowsQuery;

    const scopedIdsQuery = db('crm_contacts').whereIn('id', validIds).where({ org_id: orgId }).select('id');
    applyPartyScopeFilter(scopedIdsQuery, scopeMode, null);

    try {
        await db.transaction(async (trx) => {
            await interactionService.deleteInteractionsByContactIds(scopedIdsQuery, { transaction: trx });
            const delQuery = trx('crm_contacts').whereIn('id', validIds).where({ org_id: orgId });
            applyPartyScopeFilter(delQuery, scopeMode, null);
            const deletedCount = await delQuery.delete();
            if (options.requireMatch !== false && deletedCount === 0) {
                throw new AppError(`${label} not found`, 404);
            }
            for (const row of toDelete) {
                await writePartyChangeLog(trx, {
                    orgId,
                    entityId: row.id,
                    action: 'delete',
                    beforeData: { name: row.name, category: row.category, status: row.status },
                    afterData: null,
                    reason: options.reason || null,
                    userId: options.userId || null
                });
            }
        });
    } catch (error) {
        if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.errno === 1451) {
            throw new AppError(`${label} is linked to existing projects and cannot be deleted; archive it instead`, 409);
        }
        throw error;
    }
    return true;
}

// ─── Scope-aware Master & Project Contact Operations ──────────────────────────

function normalizeContactCategory(category) {
    if (!category) return 'Contractor';
    const raw = String(category).trim();
    const matched = CONTACT_CATEGORIES.find(item => item.toLowerCase() === raw.toLowerCase());
    if (matched) return matched;
    if (raw.toLowerCase() === 'consultant') return 'Consultants';
    return resolveCategory(raw, 'Contractor');
}

function buildScopedContact(orgId, data, scope, options = {}) {
    if (!data?.name || !String(data.name).trim()) {
        throw new AppError('Contact name is required', 400);
    }
    return {
        org_id: orgId,
        name: String(data.name).trim(),
        scope,
        sector_id: data.sector_id || null,
        job_nature_id: data.job_nature_id || data.job_id || null,
        category: normalizeContactCategory(data.category),
        contact_person: data.contact_person || null,
        designation: data.designation || null,
        telephone_no: data.telephone_no || data.contact_no || null,
        mobile: data.mobile || null,
        email: data.email || null,
        address: data.address || null,
        location: data.location || null,
        website: data.website || data.web_site || null,
        gst_no: data.gst_no || data.qst_no || null,
        constitution: data.constitution || null,
        reference: data.reference || null,
        remarks: (data.remarks !== undefined ? data.remarks : (data.remark !== undefined ? data.remark : data.self_remark)) || null,
        status: data.status === 'archived' ? 'archived' : 'active',
        created_by: options.userId || null,
        updated_by: options.userId || null
    };
}

export async function createMasterContact(orgId, data, options = {}) {
    const resolved = await resolveContactReferences(orgId, data);
    const [contactId] = await db('crm_contacts').insert(buildScopedContact(orgId, resolved, 'master', options));
    return getScopedContact(db, contactId, orgId);
}

export async function createProjectContact(orgId, projectId, data, options = {}) {
    const projectIdValue = positiveId(projectId, 'project_id');
    return db.transaction(async (trx) => {
        await getScopedProject(trx, projectIdValue, orgId);
        const resolved = await resolveContactReferences(orgId, data, trx);
        const [contactId] = await trx('crm_contacts').insert(buildScopedContact(orgId, resolved, 'project', options));
        try {
            const [projectPartyId] = await trx('proj_parties').insert({ project_id: projectIdValue, contact_id: contactId });
            const contact = await trx('crm_contacts')
                .where({ id: contactId, org_id: orgId })
                .select(CONTACT_FIELDS)
                .first();
            return { contact, project_party_id: projectPartyId };
        } catch (error) {
            if (isDuplicateEntry(error)) throw duplicateLinkError(contactId, projectIdValue);
            throw error;
        }
    });
}

async function linkContactInTransaction(trx, orgId, projectId, contactId) {
    await getScopedProject(trx, projectId, orgId);
    const contact = await getScopedContact(trx, contactId, orgId);
    const currentLink = await trx('proj_parties')
        .where({ project_id: projectId, contact_id: contactId })
        .first();
    if (currentLink) throw duplicateLinkError(contactId, projectId);

    if (contact.scope === 'project') {
        const otherLink = await trx('proj_parties as pp')
            .where('pp.contact_id', contactId)
            .whereNot('pp.project_id', projectId)
            .first('pp.project_id');
        if (otherLink) {
            throw new AppError(
                `Project-exclusive contact ${contactId} is already linked to project ${otherLink.project_id}`,
                409
            );
        }
    }

    try {
        const [projectPartyId] = await trx('proj_parties').insert({ project_id: projectId, contact_id: contactId });
        return { project_party_id: projectPartyId, contact_id: contactId };
    } catch (error) {
        if (isDuplicateEntry(error)) throw duplicateLinkError(contactId, projectId);
        throw error;
    }
}

export async function linkContactToProject(orgId, projectId, contactId) {
    const projectIdValue = positiveId(projectId, 'project_id');
    const contactIdValue = positiveId(contactId, 'contact_id');
    return db.transaction(trx => linkContactInTransaction(trx, orgId, projectIdValue, contactIdValue));
}

export async function linkContactsToProject(orgId, projectId, contactIds) {
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        throw new AppError('contact_ids must be a non-empty array', 400);
    }
    const projectIdValue = positiveId(projectId, 'project_id');
    const uniqueIds = [...new Set(contactIds.map(id => positiveId(id, 'contact_id')))];
    return db.transaction(async (trx) => {
        await getScopedProject(trx, projectIdValue, orgId);
        const linked = [];
        for (const contactId of uniqueIds) {
            linked.push(await linkContactInTransaction(trx, orgId, projectIdValue, contactId));
        }
        return linked;
    });
}

async function eligibleContacts(orgId, projectId, query = {}, connection = db) {
    await getScopedProject(connection, projectId, orgId);
    let builder = connection('crm_contacts as c')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.id');

    if (orgId) {
        builder = builder.where(function () {
            this.where('c.org_id', orgId).orWhereNull('c.org_id');
        });
    }

    if (query.status === 'archived') {
        builder = builder.where('c.status', 'archived');
    } else if (query.status !== 'all') {
        builder = builder.where('c.status', 'active');
    }

    builder = builder.where(function () {
        this.where('c.scope', 'master')
            .orWhereNull('c.scope')
            .orWhere('c.scope', '')
            .orWhereExists(function () {
                this.select(connection.raw('1'))
                    .from('proj_parties as own_pp')
                    .whereRaw('own_pp.contact_id = c.id')
                    .andWhere('own_pp.project_id', projectId);
            });
    });

    if (query.search) {
        const search = `%${String(query.search).trim()}%`;
        builder = builder.where(function () {
            this.where('c.name', 'like', search)
                .orWhere('c.category', 'like', search)
                .orWhere('c.contact_person', 'like', search)
                .orWhere('c.mobile', 'like', search)
                .orWhere('c.email', 'like', search)
                .orWhere('jn.job_name', 'like', search);
        });
    }

    return builder
        .select(
            ...CONTACT_FIELDS.map(field => `c.${field}`),
            'jn.job_name',
            connection.raw(`(
                SELECT pp.id FROM proj_parties pp
                WHERE pp.contact_id = c.id AND pp.project_id = ?
                LIMIT 1
            ) as project_party_id`, [projectId])
        )
        .orderBy('c.name', 'asc')
        .limit(Math.min(parseInt(query.limit, 10) || 5000, 5000));
}

export async function getAvailableContacts(orgId, projectId, query = {}) {
    const rows = await eligibleContacts(orgId, positiveId(projectId, 'project_id'), query);
    return { contacts: rows, count: rows.length };
}

export async function getAvailableContactCandidates(orgId, projectId, query = {}) {
    const rows = await eligibleContacts(orgId, positiveId(projectId, 'project_id'), query);
    const candidates = rows.filter(contact => !contact.project_party_id);
    return { parties: candidates, count: candidates.length };
}

export async function promoteContactToMaster(orgId, contactId, options = {}) {
    const contactIdValue = positiveId(contactId, 'contact_id');
    return db.transaction(async (trx) => {
        const before = await getScopedContact(trx, contactIdValue, orgId);
        await trx('crm_contacts')
            .where({ id: contactIdValue, org_id: orgId })
            .update({ scope: 'master', updated_by: options.userId || null, updated_at: trx.fn.now() });
        const after = await getScopedContact(trx, contactIdValue, orgId);
        await writePartyChangeLog(trx, {
            orgId,
            entityId: contactIdValue,
            action: 'promote',
            beforeData: { scope: before.scope },
            afterData: { scope: after.scope },
            reason: options.reason || 'Promoted project party to Master',
            userId: options.userId || null
        });
        return after;
    });
}

/**
 * Compatibility facade objects for callers (such as agentRuntime) expecting
 * clientService / vendorService method signatures.
 */
export function createClientServiceFacade(interactionSvc) {
    return {
        initializeCrmSchema,
        getClients: async (orgId, query = {}) => {
            const { parties, total, page, limit } = await listParties(orgId, query, { scopeMode: 'client' });
            return { clients: parties, total, page, limit };
        },
        getClientById: (orgId, id, options = {}) => getPartyById(orgId, id, { ...options, scopeMode: 'client' }),
        createClient: (orgId, data, options = {}) => createParty(orgId, data, { ...options, scopeMode: 'client' }),
        updateClient: (orgId, id, data, options = {}) => updateParty(orgId, id, data, { ...options, scopeMode: 'client' }),
        deleteClient: (orgId, id) => deleteParties(orgId, [id], { scopeMode: 'client', requireMatch: true }),
        deleteClients: (orgId, ids) => deleteParties(orgId, ids, { scopeMode: 'client', requireMatch: false }),
        createInteraction: interactionSvc?.createInteraction,
        deleteInteraction: interactionSvc?.deleteInteraction,
        createMasterContact,
        createProjectContact,
        linkContactToProject,
        linkContactsToProject,
        getAvailableContacts,
        getAvailableContactCandidates,
        promoteContactToMaster
    };
}

export function createVendorServiceFacade(interactionSvc) {
    return {
        getVendors: async (orgId, query = {}) => {
            const { parties, total, page, limit } = await listParties(orgId, query, { scopeMode: 'vendor' });
            return { vendors: parties, total, page, limit };
        },
        getVendorById: (orgId, id, options = {}) => getPartyById(orgId, id, { ...options, scopeMode: 'vendor' }),
        createVendor: (orgId, data, options = {}) => createParty(orgId, data, { ...options, scopeMode: 'vendor' }),
        updateVendor: (orgId, id, data, options = {}) => updateParty(orgId, id, data, { ...options, scopeMode: 'vendor' }),
        deleteVendors: (orgId, ids) => deleteParties(orgId, ids, { scopeMode: 'vendor', requireMatch: true }),
        createInteraction: interactionSvc
            ? (orgId, id, data) => interactionSvc.createInteraction(orgId, {
                ...data,
                contact_id: id,
                type: data.type ? data.type.toLowerCase() : data.type
            })
            : undefined
    };
}

export default {
    initializeCrmSchema,
    resolveCategory,
    applyPartyScopeFilter,
    listParties,
    getPartyById,
    createParty,
    updateParty,
    setPartyStatus,
    listPartyChangeLog,
    deleteParties,
    createMasterContact,
    createProjectContact,
    linkContactToProject,
    linkContactsToProject,
    getAvailableContacts,
    getAvailableContactCandidates,
    promoteContactToMaster,
    createClientServiceFacade,
    createVendorServiceFacade
};
