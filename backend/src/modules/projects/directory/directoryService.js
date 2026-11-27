import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import { findOrCreateJobNature } from '../../shared/jobNatureService.js';
import partyContactService from '../../parties/partyContactService.js';
import { applyPartyOverrides, saveProjectOverrides } from '../../parties/partyRegistryService.js';

async function resolveProjectPartyContactId(connection, projectId, partyOrContactId) {
    if (!partyOrContactId) return { partyId: null, contactId: null };
    const pp = await connection('proj_parties')
        .where({ project_id: projectId, id: partyOrContactId })
        .orWhere({ project_id: projectId, contact_id: partyOrContactId })
        .first();
    if (!pp) return { partyId: null, contactId: null };
    return { partyId: pp.id, contactId: pp.contact_id };
}

async function resolveOrCreateProjectParty(trx, projectId, { party_id, pv_id, company_name, category, address_line, orgId }) {
    const requestedId = party_id || pv_id || null;
    if (requestedId) {
        const resolved = await resolveProjectPartyContactId(trx, projectId, requestedId);
        if (resolved.partyId) return resolved;
    }

    const trimmedName = String(company_name || '').trim();
    if (!trimmedName) return { partyId: null, contactId: null };

    const existingParty = await trx('proj_parties as pp')
        .join('crm_contacts as c', 'pp.contact_id', 'c.id')
        .where('pp.project_id', projectId)
        .whereRaw('LOWER(c.name) = ?', [trimmedName.toLowerCase()])
        .select('pp.id', 'pp.contact_id')
        .first();

    if (existingParty) {
        return { partyId: existingParty.id, contactId: existingParty.contact_id };
    }

    let crmContact = await trx('crm_contacts')
        .whereRaw('LOWER(name) = ?', [trimmedName.toLowerCase()])
        .where(function () {
            if (orgId) this.where('org_id', orgId).orWhereNull('org_id');
        })
        .first();

    if (!crmContact) {
        const [newCrmId] = await trx('crm_contacts').insert({
            org_id: orgId || null,
            name: trimmedName,
            category: category || 'Contractor',
            scope: 'project',
            address: address_line || null,
            created_at: new Date(),
            updated_at: new Date()
        });
        crmContact = { id: newCrmId };
    }

    const [newPartyId] = await trx('proj_parties').insert({
        project_id: projectId,
        contact_id: crmContact.id
    });
    return { partyId: newPartyId, contactId: crmContact.id };
}

export async function fetchProjectDirectory(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const directory = await db('proj_parties as pp')
        .join('crm_contacts as c', 'pp.contact_id', 'c.id')
        .join('crm_contact_persons as cp', function () {
            this.on('cp.contact_id', '=', 'c.id')
                .andOnVal('cp.status', '=', 'active');
        })
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.id')
        .where('pp.project_id', projectId)
        .select([
            'cp.id',
            'cp.id as pd_id',
            'pp.project_id',
            'pp.id as party_id',
            'pp.id as pv_id',
            'pp.overrides as overrides',
            'c.id as contact_id',
            'c.name as company_name',
            'c.category as category',
            'jn.job_name as job_nature',
            'cp.name as contact_person',
            'cp.designation',
            'cp.department as responsibilities',
            db.raw('COALESCE(cp.mobile, cp.telephone_no) as mobile_no'),
            'cp.email',
            'c.address as address_line',
            'cp.is_primary',
            'cp.created_at',
            'cp.updated_at'
        ])
        .orderBy('c.name', 'asc')
        .orderBy('cp.is_primary', 'desc')
        .orderBy('cp.id', 'asc');

    const enriched = directory.map(applyPartyOverrides);
    return { directory: enriched, count: enriched.length };
}

export async function fetchDirectoryCount(projectId = null) {
    const query = db('proj_parties as pp')
        .join('crm_contact_persons as cp', function () {
            this.on('cp.contact_id', '=', 'pp.contact_id')
                .andOnVal('cp.status', '=', 'active');
        });
    if (projectId) {
        query.where('pp.project_id', projectId);
    }
    const result = await query.countDistinct('cp.id as cnt').first();
    return result ? parseInt(result.cnt, 10) : 0;
}

export async function insertDirectoryItem(data) {
    return db.transaction(async (trx) => {
        const { contactId } = await resolveProjectParty(trx, data.project_id, data);
        if (!contactId) {
            throw new AppError('Valid project party is required to add a directory contact', 400);
        }
        const party = await trx('crm_contacts').where({ id: contactId }).first();
        const created = await partyContactService.addContactPerson(
            party.org_id,
            contactId,
            {
                name: data.contact_person || data.name,
                designation: data.designation || null,
                department: data.responsibilities || data.department || null,
                mobile: data.mobile_no || data.mobile || null,
                telephone_no: data.telephone_no || null,
                email: data.email || null
            },
            { transaction: trx }
        );
        return { id: created.id, pd_id: created.id };
    });
}

async function resolveProjectParty(trx, projectId, data) {
    const requestedId = data.party_id || data.pv_id || null;
    if (requestedId) {
        return resolveProjectPartyContactId(trx, projectId, requestedId);
    }
    if (data.contact_id) {
        return resolveProjectPartyContactId(trx, projectId, data.contact_id);
    }
    return { partyId: null, contactId: null };
}

export async function updateDirectoryItem(projectId, id, data = {}) {
    return db.transaction(async (trx) => {
        const existing = await trx('crm_contact_persons as cp')
            .join('proj_parties as pp', 'cp.contact_id', 'pp.contact_id')
            .join('crm_contacts as c', 'cp.contact_id', 'c.id')
            .where({ 'cp.id': id, 'pp.project_id': projectId })
            .select('cp.id', 'cp.contact_id', 'c.org_id')
            .first();
        if (!existing) throw new AppError('Directory item not found', 404);

        const payload = {};
        if (data.contact_person !== undefined) payload.name = data.contact_person;
        if (data.designation !== undefined) payload.designation = data.designation;
        if (data.responsibilities !== undefined) payload.department = data.responsibilities;
        if (data.mobile_no !== undefined) payload.mobile = data.mobile_no;
        if (data.email !== undefined) payload.email = data.email;

        if (Object.keys(payload).length > 0) {
            await partyContactService.updateContactPerson(existing.org_id, existing.contact_id, existing.id, payload, { transaction: trx });
        }
        if (data.address_line !== undefined) {
            await trx('crm_contacts').where({ id: existing.contact_id }).update({ address: data.address_line || null, updated_at: trx.fn.now() });
        }
        return { affected: 1 };
    });
}

export async function deleteDirectoryItem(projectId, id) {
    return db.transaction(async (trx) => {
        const existing = await trx('crm_contact_persons as cp')
            .join('proj_parties as pp', 'cp.contact_id', 'pp.contact_id')
            .join('crm_contacts as c', 'cp.contact_id', 'c.id')
            .where({ 'cp.id': id, 'pp.project_id': projectId })
            .select('cp.id', 'cp.contact_id', 'c.org_id')
            .first();
        if (!existing) throw new AppError('Directory item not found', 404);

        await partyContactService.deleteContactPerson(existing.org_id, existing.contact_id, existing.id, { transaction: trx });
        return { affectedRows: 1 };
    });
}

async function deleteDirectoryItems(trx, projectId, deletedIds) {
    if (!Array.isArray(deletedIds) || deletedIds.length === 0) return;
    const numericIds = deletedIds.map(Number).filter(n => !isNaN(n));
    if (numericIds.length === 0) return;

    const toDelete = await trx('crm_contact_persons as cp')
        .join('proj_parties as pp', 'cp.contact_id', 'pp.contact_id')
        .join('crm_contacts as c', 'cp.contact_id', 'c.id')
        .where('pp.project_id', projectId)
        .whereIn('cp.id', numericIds)
        .select('cp.id', 'cp.contact_id', 'c.org_id');

    for (const row of toDelete) {
        await partyContactService.deleteContactPerson(row.org_id, row.contact_id, row.id, { transaction: trx });
    }
}

async function syncPartyMetadata(trx, projectId, partyId, contactId, { category, jobNature, addressLine, orgId }) {
    const partyRec = await trx('crm_contacts as c')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.id')
        .where({ 'c.id': contactId })
        .select('c.*', 'jn.job_name as master_job_nature')
        .first();
    const effectiveOrgId = partyRec?.org_id || orgId;

    if (partyRec?.scope === 'master' && (category || jobNature)) {
        const ppRow = await trx('proj_parties').where({ id: partyId, project_id: projectId }).first();
        if (ppRow) {
            await saveProjectOverrides(
                trx,
                ppRow,
                {
                    ...(category ? { category } : {}),
                    ...(jobNature ? { job_nature: jobNature } : {})
                },
                { category: partyRec.category, job_nature: partyRec.master_job_nature }
            );
        }
    } else if (partyRec?.scope !== 'master') {
        if (jobNature) {
            const jnId = await findOrCreateJobNature(effectiveOrgId, jobNature, trx);
            if (jnId) {
                await trx('crm_contacts').where({ id: contactId }).update({ job_nature_id: jnId, updated_at: new Date() });
            }
        }
        if (addressLine) {
            await trx('crm_contacts').where({ id: contactId }).update({ address: addressLine, updated_at: new Date() });
        }
    }

    return effectiveOrgId;
}

export async function syncProjectDirectory(projectId, { items = [], deleted_ids = [] }, orgId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    return await db.transaction(async (trx) => {
        await deleteDirectoryItems(trx, projectId, deleted_ids);

        let lastPartyId = null;
        let lastContactId = null;
        let lastCompanyName = null;
        let lastCategory = null;

        for (const item of items) {
            let companyName = (item.company_name || item.name || '').trim();
            const contactPerson = (item.contact_person || item.person || '').trim();
            const designation = item.designation || null;
            const responsibilities = item.responsibilities || null;
            const mobileNo = item.mobile_no || item.telephone_no || item.mobile || null;
            const email = item.email || null;
            const addressLine = item.address_line || item.address || null;
            let category = item.category || null;
            const jobNature = (item.job_nature || item.job_name || '').trim();

            if (!companyName && !contactPerson) continue;

            let partyId = item.party_id || item.pv_id || null;
            let contactId = item.contact_id || null;

            if (!companyName && !partyId && contactPerson && lastPartyId) {
                partyId = lastPartyId;
                contactId = lastContactId;
                companyName = lastCompanyName;
                if (!category) category = lastCategory;
            } else {
                const resolved = await resolveOrCreateProjectParty(trx, projectId, {
                    party_id: partyId,
                    company_name: companyName,
                    category,
                    address_line: addressLine,
                    orgId
                });
                partyId = resolved.partyId;
                contactId = resolved.contactId;
            }

            if (!contactId) continue;

            lastPartyId = partyId;
            lastContactId = contactId;
            if (companyName) lastCompanyName = companyName;
            if (category) lastCategory = category;

            const effectiveOrgId = await syncPartyMetadata(trx, projectId, partyId, contactId, {
                category,
                jobNature,
                addressLine,
                orgId
            });

            if (contactPerson || designation || responsibilities || (item.id && !String(item.id).startsWith('temp_'))) {
                await partyContactService.upsertContactPerson(
                    effectiveOrgId,
                    contactId,
                    item.id,
                    {
                        name: (contactPerson || companyName || 'Primary Contact').trim(),
                        designation,
                        department: responsibilities,
                        mobile: mobileNo,
                        email
                    },
                    { transaction: trx }
                );
            }
        }

        return { success: true, message: 'Project directory synced successfully' };
    });
}

export async function bulkAddPersonnelToParty(projectId, payload = {}, orgId) {
    if (!projectId) throw new AppError('projectId is required', 400);
    const {
        party_id = null,
        company_name = '',
        category = 'Contractor',
        address_line = '',
        personnel = []
    } = payload;

    if (!Array.isArray(personnel) || personnel.length === 0) {
        throw new AppError('personnel array is required and must not be empty', 400);
    }

    return await db.transaction(async (trx) => {
        const { partyId, contactId } = await resolveOrCreateProjectParty(trx, projectId, {
            party_id,
            company_name,
            category,
            address_line,
            orgId
        });
        if (!contactId) {
            throw new AppError('Could not resolve project party for personnel', 400);
        }
        const partyRec = await trx('crm_contacts').where({ id: contactId }).first();
        const effectiveOrgId = partyRec?.org_id || orgId;

        const insertedIds = [];
        for (const person of personnel) {
            const contactPerson = person.contact_person || person.name || person.person || null;
            if (!contactPerson && !person.designation) continue;

            const created = await partyContactService.addContactPerson(
                effectiveOrgId,
                contactId,
                {
                    name: contactPerson || company_name || 'Contact Person',
                    designation: person.designation || person.role || null,
                    department: person.responsibilities || null,
                    mobile: person.mobile_no || person.telephone_no || person.phone || null,
                    email: person.email || null
                },
                { transaction: trx }
            );
            insertedIds.push(created.id);
        }

        return {
            success: true,
            message: `Successfully added ${insertedIds.length} personnel to ${company_name || 'party'}`,
            party_id: partyId,
            inserted_count: insertedIds.length,
            ids: insertedIds
        };
    });
}

export default {
    fetchProjectDirectory,
    fetchDirectoryCount,
    insertDirectoryItem,
    updateDirectoryItem,
    deleteDirectoryItem,
    syncProjectDirectory,
    bulkAddPersonnelToParty,
};
