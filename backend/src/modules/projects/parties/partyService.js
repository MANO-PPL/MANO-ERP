import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import {
    getAvailableContactCandidates,
    linkContactsToProject
} from '../../clients/clientService.js';
import { findOrCreateJobNature } from '../../shared/jobNatureService.js';

// Project parties are stored in proj_parties and resolved from CRM contacts.

const FIELD_MAP = {
    name: 'c.name',
    category: 'c.category',
    location: 'c.address',
    email: 'c.email',
    contact_person: 'c.contact_person',
    mobile: 'c.mobile',
    website: 'c.website',
    job_nature: 'jn.job_name',
    address: 'c.address',
    telephone_no: 'c.telephone_no',
};

/**
 * Ensure proj_parties schema is configured with joined_at and correct indices.
 */
export async function initializeProjectPartiesSchema() {
    if (await db.schema.hasTable('proj_parties')) {
        const hasImportedAt = await db.schema.hasColumn('proj_parties', 'imported_at');
        const hasJoinedAt = await db.schema.hasColumn('proj_parties', 'joined_at');
        if (hasImportedAt && !hasJoinedAt) {
            await db.raw('ALTER TABLE proj_parties CHANGE COLUMN imported_at joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
        }

        const [indexes] = await db.raw("SHOW INDEXES FROM proj_parties WHERE Key_name = 'proj_parties_project'");
        if (indexes && indexes.length > 0) {
            await db.raw('ALTER TABLE proj_parties DROP INDEX proj_parties_project');
        }

        const [projIdx] = await db.raw("SHOW INDEXES FROM proj_parties WHERE Key_name = 'idx_proj_parties_project_id'");
        if (!projIdx || projIdx.length === 0) {
            await db.raw('ALTER TABLE proj_parties ADD INDEX idx_proj_parties_project_id (project_id)');
        }
    }
}

/* -------------------------------------------------------
   FETCH PROJECT PARTIES
-------------------------------------------------------- */
export async function getProjectParties(projectId, fields, orgId, options = {}) {
    if (!projectId) throw new AppError('projectId is required', 400);

    if (orgId) {
        const project = await db('proj_projects').where({ id: projectId, org_id: orgId }).first();
        if (!project) throw new AppError('Project not found', 404);
    }

    const BASE_FIELDS = [
        'pp.id as id',
        'pp.id as pv_id',
        'pp.contact_id as party_id',
        'pp.contact_id as contact_id',
        'pp.joined_at as joined_at',
        'c.category as category',
    ];

    let selectedFields = [...BASE_FIELDS];

    if (fields) {
        const requestedFields = fields.split(',').map(f => f.trim());
        const dynamicFields = requestedFields
            .filter(f => FIELD_MAP[f] && f !== 'category')
            .map(f => `${FIELD_MAP[f]} as ${f}`);
        selectedFields.push(...dynamicFields);
    } else {
        selectedFields.push(
            'c.name as name',
            'jn.job_name as job_nature',
            'c.mobile',
            'c.email',
            'c.contact_person',
            'c.address as address',
            'c.website as website',
            'c.telephone_no as telephone_no'
        );
    }

    const parties = await db('proj_parties as pp')
        .join('crm_contacts as c', 'pp.contact_id', 'c.id')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.id')
        .where('pp.project_id', projectId)
        .modify(query => {
            if (options.agentRead === true) {
                query.where('c.org_id', orgId).limit(Math.min(options.limit || 20, 50)).offset(options.offset || 0);
                if (options.category) query.where('c.category', options.category);
            }
        })
        .select(selectedFields)
        .orderBy('c.name', 'asc');

    return { parties, count: parties.length };
}

/* -------------------------------------------------------
   FETCH AVAILABLE CRM PARTIES FOR A PROJECT
-------------------------------------------------------- */
export async function getAvailableProjectParties(projectId, orgId, query = {}) {
    if (!projectId) throw new AppError('projectId is required', 400);

    // Keep this legacy picker endpoint limited to contacts that can still be
    // newly linked. The scope-aware endpoint is exposed as /available-contacts.
    return getAvailableContactCandidates(orgId, projectId, query);
}

/* -------------------------------------------------------
   ADD PARTIES TO PROJECT (bulk)
-------------------------------------------------------- */
export async function addPartiesToProject(projectId, partyIds, orgId) {
    const linked = await linkContactsToProject(orgId, projectId, partyIds);
    return linked.map(item => item.project_party_id);
}

/* -------------------------------------------------------
   DELETE PARTIES FROM PROJECT (bulk by pp_ids)
-------------------------------------------------------- */
export async function removePartiesFromProject(projectId, ppIds) {
    const existing = await db('proj_parties')
        .where('project_id', projectId)
        .where(function () {
            this.whereIn('id', ppIds).orWhereIn('contact_id', ppIds);
        });

    if (existing.length === 0) {
        throw new AppError('No matching project parties found', 404);
    }

    const existingIds = existing.map(e => e.id);
    const notFound = ppIds.filter(id => !existingIds.includes(id) && !existing.some(e => e.contact_id === id));

    const deletedCount = await db('proj_parties')
        .where('project_id', projectId)
        .whereIn('id', existingIds)
        .del();

    return { deletedCount, deletedPvIds: existingIds, notFoundPvIds: notFound };
}

/* -------------------------------------------------------
   SYNC PARTIES WITH PROJECT (bulk create / update / delete)
-------------------------------------------------------- */
export async function syncProjectParties(projectId, { parties = [], deleted_ids = [] }, orgId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    return await db.transaction(async (trx) => {
        const deleteIdSet = new Set((deleted_ids || []).map(String));

        // 1. Delete removed parties from project
        if (Array.isArray(deleted_ids) && deleted_ids.length > 0) {
            const numericIds = deleted_ids.map(Number).filter(n => !isNaN(n));
            if (numericIds.length > 0) {
                await trx('proj_parties')
                    .where('project_id', projectId)
                    .where(function () {
                        this.whereIn('id', numericIds)
                            .orWhereIn('contact_id', numericIds);
                    })
                    .del();
            }
        }

        // 2. Process incoming party rows (excluding any that were flagged for deletion)
        const partiesToProcess = parties.filter((p) => {
            const id1 = p.id != null ? String(p.id) : null;
            const id2 = p.pv_id != null ? String(p.pv_id) : null;
            const id3 = p.party_id != null ? String(p.party_id) : null;
            const id4 = p.contact_id != null ? String(p.contact_id) : null;
            return (!id1 || !deleteIdSet.has(id1)) &&
                (!id2 || !deleteIdSet.has(id2)) &&
                (!id3 || !deleteIdSet.has(id3)) &&
                (!id4 || !deleteIdSet.has(id4));
        });

        for (const p of partiesToProcess) {
            if (!p.name || !String(p.name).trim()) continue;

            const name = String(p.name).trim();
            const category = p.category || 'Contractor';
            const contactPerson = p.contact_person ? String(p.contact_person).trim() : null;
            const designation = p.designation ? String(p.designation).trim() : null;
            const telephoneNo = p.telephone_no || p.mobile ? String(p.telephone_no || p.mobile).trim() : null;
            const mobile = p.mobile || p.telephone_no ? String(p.mobile || p.telephone_no).trim() : null;
            const email = p.email ? String(p.email).trim() : null;
            const address = p.address ? String(p.address).trim() : null;
            const remarks = p.remarks ? String(p.remarks).trim() : null;
            const jobNatureName = p.job_nature || p.job_name ? String(p.job_nature || p.job_name).trim() : null;

            let jobNatureId = null;
            if (jobNatureName) {
                jobNatureId = await findOrCreateJobNature(orgId, jobNatureName);
            }

            let contactId = p.contact_id || p.party_id || (p.id && !String(p.id).startsWith('temp_') ? p.id : null);

            if (contactId) {
                const existingPartyRow = await trx('proj_parties').where({ id: contactId, project_id: projectId }).first();
                if (existingPartyRow) {
                    contactId = existingPartyRow.contact_id;
                }
            }

            if (contactId) {
                // Update existing contact record
                const updatePayload = {
                    name,
                    category,
                    contact_person: contactPerson,
                    designation,
                    telephone_no: telephoneNo,
                    mobile,
                    email,
                    address,
                    remarks,
                    updated_at: new Date()
                };
                if (jobNatureId !== null) updatePayload.job_nature_id = jobNatureId;

                await trx('crm_contacts')
                    .where({ id: contactId })
                    .where(function () {
                        if (orgId) this.where('org_id', orgId).orWhereNull('org_id');
                    })
                    .update(updatePayload);

                // Ensure linked in proj_parties
                const isLinked = await trx('proj_parties')
                    .where({ project_id: projectId, contact_id: contactId })
                    .first();
                if (!isLinked) {
                    await trx('proj_parties').insert({
                        project_id: projectId,
                        contact_id: contactId
                    });
                }
            } else {
                // Check if contact with same name exists in org
                let existingContact = await trx('crm_contacts')
                    .whereRaw('LOWER(name) = ?', [name.toLowerCase()])
                    .where(function () {
                        if (orgId) this.where('org_id', orgId).orWhereNull('org_id');
                    })
                    .first();

                if (!existingContact) {
                    const [newId] = await trx('crm_contacts').insert({
                        org_id: orgId || null,
                        name,
                        category,
                        contact_person: contactPerson,
                        designation,
                        telephone_no: telephoneNo,
                        mobile,
                        email,
                        address,
                        remarks,
                        job_nature_id: jobNatureId,
                        scope: 'project',
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                    contactId = newId;
                } else {
                    contactId = existingContact.id;
                }

                // Link in proj_parties
                const isLinked = await trx('proj_parties')
                    .where({ project_id: projectId, contact_id: contactId })
                    .first();
                if (!isLinked) {
                    await trx('proj_parties').insert({
                        project_id: projectId,
                        contact_id: contactId
                    });
                }
            }
        }

        return { success: true, message: 'Project parties synced successfully' };
    });
}

export default {
    getProjectParties,
    getAvailableProjectParties,
    addPartiesToProject,
    removePartiesFromProject,
    syncProjectParties,
};
