import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import { findOrCreateJobNature } from '../../shared/jobNatureService.js';

export async function fetchProjectDirectory(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const directory = await db('proj_directory as pd')
        .leftJoin('proj_parties as pp', 'pd.party_id', 'pp.id')
        .leftJoin('crm_contacts as c', 'pp.contact_id', 'c.id')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.id')
        .where('pd.project_id', projectId)
        .select([
            'pd.id',
            'pd.id as pd_id',
            'pd.project_id',
            'pd.party_id as party_id',
            'pd.party_id as pv_id',
            'pp.contact_id as contact_id',
            'c.name as company_name',
            'c.category as category',
            'jn.job_name as job_nature',
            'pd.contact_person',
            'pd.designation',
            'pd.responsibilities',
            'pd.mobile_no',
            'pd.email',
            'pd.address_line',
            'pd.created_at',
            'pd.updated_at'
        ]);

    return { directory, count: directory.length };
}

export async function fetchDirectoryCount(projectId = null) {
    const query = db('proj_directory');
    if (projectId) {
        query.where('project_id', projectId);
    }
    const result = await query.count('id as cnt').first();
    return result ? parseInt(result.cnt, 10) : 0;
}

export async function insertDirectoryItem(data) {
    // Find party_id from proj_parties based on id or contact_id
    let party_id = data.party_id || data.pv_id || null;
    if (party_id) {
        const v = await db('proj_parties')
            .where({ project_id: data.project_id, id: party_id })
            .orWhere({ project_id: data.project_id, contact_id: party_id })
            .first();
        if (v) party_id = v.id;
    }

    const [id] = await db('proj_directory').insert({
        project_id: data.project_id,
        party_id: party_id,
        contact_person: data.contact_person,
        designation: data.designation || null,
        responsibilities: data.responsibilities || null,
        mobile_no: data.mobile_no || null,
        email: data.email || null,
        address_line: data.address_line || null
    });

    return { id, pd_id: id };
}

export async function updateDirectoryItem(projectId, id, data = {}) {
    const updateData = {};
    if (data.party_id !== undefined || data.pv_id !== undefined) {
        let party_id = data.party_id || data.pv_id || null;
        if (party_id) {
            const v = await db('proj_parties')
                .where({ project_id: projectId, id: party_id })
                .orWhere({ project_id: projectId, contact_id: party_id })
                .first();
            if (v) party_id = v.id;
        }
        updateData.party_id = party_id;
    }
    if (data.contact_person !== undefined) updateData.contact_person = data.contact_person;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities;
    if (data.mobile_no !== undefined) updateData.mobile_no = data.mobile_no;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address_line !== undefined) updateData.address_line = data.address_line;

    const affected = await db('proj_directory')
        .where({ id, project_id: projectId })
        .update(updateData);

    if (affected === 0) throw new AppError('Directory item not found', 404);
    return { affected };
}

export async function deleteDirectoryItem(projectId, id) {
    const affectedRows = await db('proj_directory')
        .where({ id, project_id: projectId })
        .del();

    if (affectedRows === 0) throw new AppError('Directory item not found', 404);
    return { affectedRows };
}

export async function syncProjectDirectory(projectId, { items = [], deleted_ids = [] }, orgId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    return await db.transaction(async (trx) => {
        // 1. Delete removed directory items
        if (Array.isArray(deleted_ids) && deleted_ids.length > 0) {
            const numericIds = deleted_ids.map(Number).filter(n => !isNaN(n));
            if (numericIds.length > 0) {
                await trx('proj_directory')
                    .where('project_id', projectId)
                    .whereIn('id', numericIds)
                    .del();
            }
        }

        // 2. Process incoming rows with smart company forward-filling for multiple personnel
        let lastPartyId = null;
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

            // Resolve or find party_id in proj_parties
            let partyId = item.party_id || item.pv_id || null;

            // Smart Blank Company Forward-Fill:
            // When multiple team members are entered with subsequent company names blank,
            // inherit the contractor details from the active company row above!
            if (!companyName && !partyId && contactPerson && lastPartyId) {
                partyId = lastPartyId;
                companyName = lastCompanyName;
                if (!category) category = lastCategory;
            }

            if (!partyId && companyName) {
                const existingParty = await trx('proj_parties as pp')
                    .join('crm_contacts as c', 'pp.contact_id', 'c.id')
                    .where('pp.project_id', projectId)
                    .whereRaw('LOWER(c.name) = ?', [String(companyName).trim().toLowerCase()])
                    .select('pp.id')
                    .first();

                if (existingParty) {
                    partyId = existingParty.id;
                } else {
                    let crmContact = await trx('crm_contacts')
                        .whereRaw('LOWER(name) = ?', [String(companyName).trim().toLowerCase()])
                        .where(function () {
                            if (orgId) this.where('org_id', orgId).orWhereNull('org_id');
                        })
                        .first();

                    if (!crmContact) {
                        const [newCrmId] = await trx('crm_contacts').insert({
                            org_id: orgId || null,
                            name: String(companyName).trim(),
                            category: category || 'Contractor',
                            scope: 'project',
                            contact_person: contactPerson || null,
                            designation: designation,
                            mobile: mobileNo,
                            email: email,
                            address: addressLine,
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                        crmContact = { id: newCrmId };
                    }

                    const [newPartyId] = await trx('proj_parties').insert({
                        project_id: projectId,
                        contact_id: crmContact.id
                    });
                    partyId = newPartyId;
                }
            }

            // Track active company context for subsequent rows
            if (partyId) {
                lastPartyId = partyId;
                if (companyName) lastCompanyName = companyName;
                if (category) lastCategory = category;

                if (jobNature) {
                    const partyRec = await trx('proj_parties').where({ id: partyId, project_id: projectId }).first();
                    if (partyRec && partyRec.contact_id) {
                        const jnId = await findOrCreateJobNature(orgId, jobNature, trx);
                        if (jnId) {
                            await trx('crm_contacts').where({ id: partyRec.contact_id }).update({ job_nature_id: jnId, updated_at: new Date() });
                        }
                    }
                }
            }

            const dirId = item.id && !String(item.id).startsWith('temp_') ? Number(item.id) : null;

            if (dirId && !isNaN(dirId)) {
                await trx('proj_directory')
                    .where({ id: dirId, project_id: projectId })
                    .update({
                        party_id: partyId,
                        contact_person: contactPerson,
                        designation: designation,
                        responsibilities: responsibilities,
                        mobile_no: mobileNo,
                        email: email,
                        address_line: addressLine,
                        updated_at: new Date()
                    });
            } else if (contactPerson || designation || responsibilities) {
                await trx('proj_directory').insert({
                    project_id: projectId,
                    party_id: partyId,
                    contact_person: contactPerson,
                    designation: designation,
                    responsibilities: responsibilities,
                    mobile_no: mobileNo,
                    email: email,
                    address_line: addressLine,
                    created_at: new Date(),
                    updated_at: new Date()
                });
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
        job_nature = '',
        address_line = '',
        personnel = []
    } = payload;

    if (!Array.isArray(personnel) || personnel.length === 0) {
        throw new AppError('personnel array is required and must not be empty', 400);
    }

    return await db.transaction(async (trx) => {
        let partyId = party_id ? Number(party_id) : null;

        // Resolve or create party in proj_parties
        if (!partyId && company_name) {
            const existingParty = await trx('proj_parties as pp')
                .join('crm_contacts as c', 'pp.contact_id', 'c.id')
                .where('pp.project_id', projectId)
                .whereRaw('LOWER(c.name) = ?', [String(company_name).trim().toLowerCase()])
                .select('pp.id')
                .first();

            if (existingParty) {
                partyId = existingParty.id;
            } else {
                let crmContact = await trx('crm_contacts')
                    .whereRaw('LOWER(name) = ?', [String(company_name).trim().toLowerCase()])
                    .where(function () {
                        if (orgId) this.where('org_id', orgId).orWhereNull('org_id');
                    })
                    .first();

                if (!crmContact) {
                    const [newCrmId] = await trx('crm_contacts').insert({
                        org_id: orgId || null,
                        name: String(company_name).trim(),
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
                partyId = newPartyId;
            }
        }

        const insertedIds = [];
        for (const person of personnel) {
            const contactPerson = person.contact_person || person.name || person.person || null;
            if (!contactPerson && !person.designation) continue;

            const [newId] = await trx('proj_directory').insert({
                project_id: projectId,
                party_id: partyId,
                contact_person: contactPerson,
                designation: person.designation || person.role || null,
                responsibilities: person.responsibilities || null,
                mobile_no: person.mobile_no || person.telephone_no || person.phone || null,
                email: person.email || null,
                address_line: person.address_line || person.address || address_line || null,
                created_at: new Date(),
                updated_at: new Date()
            });
            insertedIds.push(newId);
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
