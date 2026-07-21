import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { findOrCreateSector } from '../shared/sectorService.js';
import { findOrCreateJobNature } from '../shared/jobNatureService.js';

export async function getClients(orgId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const offset = (page - 1) * limit;

    const baseQuery = db('crm_contacts as c')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.job_id')
        .leftJoin('crm_sectors as s', 'c.sector_id', 's.sector_id')
        .where('c.type', 'client')
        .andWhere('c.org_id', orgId);

    const applyFilters = (qb) => {
        if (query.company || query.name) {
            qb = qb.where('c.name', 'like', `%${query.company || query.name}%`);
        }
        if (query.person || query.contact_person) {
            qb = qb.where('c.contact_person', 'like', `%${query.person || query.contact_person}%`);
        }
        if (query.location) {
            qb = qb.where('c.location', 'like', `%${query.location}%`);
        }
        if (query.jobNature || query.job_nature) {
            qb = qb.where('jn.job_name', 'like', `%${query.jobNature || query.job_nature}%`);
        }
        if (query.jobs && query.jobs.length > 0) {
            const jobs = Array.isArray(query.jobs) ? query.jobs : query.jobs.split(',').filter(Boolean);
            if (jobs.length > 0) {
                const hasNames = jobs.some(j => isNaN(parseInt(j)));
                if (hasNames) {
                    qb = qb.whereIn('jn.job_name', jobs);
                } else {
                    qb = qb.whereIn('c.job_nature_id', jobs);
                }
            }
        }
        if (query.sectors && query.sectors.length > 0) {
            const sectors = Array.isArray(query.sectors) ? query.sectors : query.sectors.split(',').filter(Boolean);
            if (sectors.length > 0) {
                const hasNames = sectors.some(s => isNaN(parseInt(s)));
                if (hasNames) {
                    qb = qb.whereIn('s.sector_name', sectors);
                } else {
                    qb = qb.whereIn('c.sector_id', sectors);
                }
            }
        }
        return qb;
    };

    const countRes = await applyFilters(baseQuery.clone()).count('c.id as total').first();
    const total = parseInt(countRes?.total || 0);

    const clients = await applyFilters(baseQuery)
        .select('c.*', 'jn.job_name', 's.sector_name')
        .orderBy('c.created_at', 'asc')
        .limit(limit)
        .offset(offset);

    if (clients.length === 0) return { clients: [], total, page, limit };

    const clientIds = clients.map(c => c.id);

    // Fetch latest interaction for each type for these clients
    const aggregatedInteractions = await db('crm_interactions')
        .whereIn('contact_id', clientIds)
        .andWhere('org_id', orgId)
        .select('contact_id', 'type', 'interaction_date', 'follow_up_date', 'remarks')
        .orderBy('interaction_date', 'asc');

    const latestByContact = aggregatedInteractions.reduce((acc, interaction) => {
        if (!acc[interaction.contact_id]) {
            acc[interaction.contact_id] = {
                emailed_date: null,
                whatsapp_text_date: null,
                called_date: null,
                visited_date: null,
                call_on_date: null,
                interaction_remark: null
            };
        }
        const data = acc[interaction.contact_id];
        const type = interaction.type.toLowerCase();

        if (type === 'email' && !data.emailed_date) data.emailed_date = interaction.interaction_date;
        if (type === 'whatsapp' && !data.whatsapp_text_date) data.whatsapp_text_date = interaction.interaction_date;
        if (type === 'call' && !data.called_date) data.called_date = interaction.interaction_date;
        if (type === 'site visit' && !data.visited_date) data.visited_date = interaction.interaction_date;

        if (interaction.follow_up_date && (!data.call_on_date || interaction.follow_up_date > data.call_on_date)) {
            data.call_on_date = interaction.follow_up_date;
        }

        // Set interaction_remark from the very latest interaction overall
        if (!data.interaction_remark) {
            data.interaction_remark = interaction.remarks;
        }

        return acc;
    }, {});

    return {
        clients: clients.map(c => ({
            ...c,
            contact_no: c.telephone_no, // UI alias
            web_site: c.website, // UI alias
            self_remark: c.remarks, // UI alias
            job_id: c.job_nature_id, // User requested job_id
            emailed_date: latestByContact[c.id]?.emailed_date || null,
            whatsapp_text_date: latestByContact[c.id]?.whatsapp_text_date || null,
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

export async function getClientById(orgId, id) {
    const client = await db('crm_contacts as c')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.job_id')
        .leftJoin('crm_sectors as s', 'c.sector_id', 's.sector_id')
        .where({ 'c.id': id, 'c.type': 'client', 'c.org_id': orgId })
        .select('c.*', 'jn.job_name', 's.sector_name')
        .first();

    if (!client) {
        throw new AppError('Client not found', 404);
    }

    const interactions = await db('crm_interactions as i')
        .leftJoin('iam_users as u', 'i.interacted_by', 'u.user_id')
        .where({ 'i.contact_id': id, 'i.org_id': orgId })
        .select('i.*', 'u.user_name as interacted_by_name')
        .orderBy('i.interaction_date', 'desc');

    const latestByType = interactions.reduce((acc, interaction) => {
        const type = interaction.type.toLowerCase();
        if (!acc[type]) acc[type] = interaction.interaction_date;
        return acc;
    }, {});

    return {
        ...client,
        contact_no: client.telephone_no,
        web_site: client.website,
        self_remark: client.remarks,
        emailed_date: latestByType['email'] || null,
        whatsapp_text_date: latestByType['whatsapp'] || null,
        called_date: latestByType['call'] || null,
        visited_date: latestByType['site visit'] || null,
        call_on_date: interactions.find(i => i.follow_up_date)?.follow_up_date || null,
        interaction_remark: interactions[0]?.remarks || null,
        interactions
    };
}

export async function createClient(orgId, data) {
    if (!data.name) {
        throw new AppError('Client name is required', 400);
    }

    const insertData = {
        org_id: orgId,
        type: 'client',
        name: data.name,
        sector_id: data.sector_id || null,
        job_nature_id: data.job_nature_id || null,
        category: data.category || null,
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
        responsibility: data.responsibility || null,
        remarks: data.remarks || data.self_remark || null
    };

    // Resolve sector name to ID if provided as string
    if (data.sector && !data.sector_id) {
        insertData.sector_id = await findOrCreateSector(orgId, data.sector);
    }
    // Resolve job nature name to ID if provided as string
    if ((data.job_nature || data.job_nature_name) && !data.job_nature_id) {
        insertData.job_nature_id = await findOrCreateJobNature(orgId, data.job_nature || data.job_nature_name);
    }

    const [newId] = await db('crm_contacts').insert(insertData);
    return newId;
}

export async function updateClient(orgId, id, data) {
    const client = await db('crm_contacts').where({ id, type: 'client', org_id: orgId }).first();
    if (!client) {
        throw new AppError('Client not found', 404);
    }

    const updateData = {};

    // Mapping frontend fields to DB columns
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sector_id !== undefined) updateData.sector_id = data.sector_id;
    if (data.job_nature_id !== undefined) updateData.job_nature_id = data.job_nature_id;
    if (data.job_id !== undefined) updateData.job_nature_id = data.job_id;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.contact_person !== undefined) updateData.contact_person = data.contact_person;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.telephone_no !== undefined) updateData.telephone_no = data.telephone_no;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.contact_no !== undefined) updateData.telephone_no = data.contact_no;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.web_site !== undefined) updateData.website = data.web_site;
    if (data.gst_no !== undefined) updateData.gst_no = data.gst_no;
    if (data.qst_no !== undefined) updateData.gst_no = data.qst_no;
    if (data.constitution !== undefined) updateData.constitution = data.constitution;
    if (data.reference !== undefined) updateData.reference = data.reference;
    if (data.responsibility !== undefined) updateData.responsibility = data.responsibility;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;
    if (data.self_remark !== undefined) updateData.remarks = data.self_remark;

    // Resolve job nature name to ID if provided as string
    if ((data.job_nature || data.job_nature_name) && !updateData.job_nature_id) {
        updateData.job_nature_id = await findOrCreateJobNature(orgId, data.job_nature || data.job_nature_name || data.job_id);
    }

    // Resolve sector name to ID if provided as string
    if (data.sector && !updateData.sector_id) {
        updateData.sector_id = await findOrCreateSector(orgId, data.sector);
    }

    updateData.updated_at = db.fn.now();

    await db('crm_contacts').where({ id, org_id: orgId }).update(updateData);
    return true;
}

export async function deleteClient(orgId, id) {
    const client = await db('crm_contacts').where({ id, type: 'client', org_id: orgId }).first();
    if (!client) {
        throw new AppError('Client not found', 404);
    }

    // Delete related interactions first
    await db('crm_interactions').where({ contact_id: id, org_id: orgId }).delete();

    // Delete contact
    await db('crm_contacts').where({ id, org_id: orgId }).delete();
    return true;
}

export async function bulkInsertClients(orgId, rowsData) {
    const results = { total_processed: 0, success_count: 0, failure_count: 0, errors: [] };

    let rowNumber = 1;
    for (const row of rowsData) {
        rowNumber++;
        results.total_processed++;

        const name = row['name'] || row['Name'] || row['company'] || row['Company'] || row['company name'];
        const contact_person = row['contact_person'] || row['contact person'] || row['Contact Person'] || null;
        const mobile = row['mobile'] || row['Mobile'] || row['mobile no'] || null;
        const email = row['email'] || row['Email'] || null;
        const location = row['location'] || row['Location'] || null;
        const rawDesignation = row['designation'] || row['Designation'] || null;
        const rawSector = row['sector'] || row['Sector'] || null;
        const rawJobNature = row['job_nature'] || row['job nature'] || row['Job Nature'] || row['nature of job'] || row['Nature of Job'] || null;

        if (!name) {
            results.failure_count++;
            results.errors.push(`Row ${rowNumber}: Missing Name`);
            continue;
        }

        try {
            const designation = rawDesignation ? rawDesignation.trim() : null;

            await createClient(orgId, {
                name,
                contact_person: contact_person,
                designation,
                contact_no: row['Contact No'] || row['contact no'] || row['telephone_no'] || row['telephone'] || row['Telephone'] || null,
                mobile: row['mobile'] || row['Mobile'] || null,
                email: email,
                address: row['address'] || row['Address'] || row['Company Address'] || null,
                location: location,
                website: row['website'] || row['Website'] || row['web_site'] || null,
                category: row['category'] || row['Category'] || null,
                sector: rawSector,
                job_nature: rawJobNature,
                responsibility: row['responsibility'] || row['Responsibility'] || null,
                reference: row['reference'] || row['Reference'] || null,
                remarks: row['remarks'] || row['Remarks'] || row['self_remark'] || null
            });
            results.success_count++;
        } catch (err) {
            results.failure_count++;
            results.errors.push(`Row ${rowNumber}: ${err.message}`);
        }
    }

    return results;
}

export async function bulkValidateClients(orgId, clients) {
    const response = { duplicates: [], new_job_natures: [], valid_count: 0 };
    const inputEmails = new Set();
    const inputPhones = new Set();
    const inputJobNatures = new Set();

    clients.forEach((v) => {
        const email = v['email'] || v['Email'];
        const phone = v['mobile'] || v['Mobile'] || v['mobile no'];
        const jobNature = v['job_nature'] || v['job nature'] || v['Job Nature'] || v['nature of job'] || v['nature of job'];

        if (email) inputEmails.add(email);
        if (phone) inputPhones.add(phone.toString().trim());
        if (jobNature) inputJobNatures.add(jobNature.trim().toLowerCase());
    });

    if (inputEmails.size > 0 || inputPhones.size > 0) {
        const existingClients = await db('crm_contacts')
            .where({ type: 'client', org_id: orgId })
            .where(function () {
                if (inputEmails.size > 0) this.whereIn('email', Array.from(inputEmails));
                if (inputPhones.size > 0) this.orWhereIn('mobile', Array.from(inputPhones));
            })
            .select('email', 'mobile');

        const existingEmailSet = new Set(existingClients.map(c => c.email).filter(Boolean));
        const existingPhoneSet = new Set(existingClients.map(c => c.mobile).filter(Boolean));

        clients.forEach((v, index) => {
            const rowNum = index + 1;
            const email = v['email'] || v['Email'];
            const phone = v['mobile'] || v['Mobile'] || v['mobile no'];
            let isDuplicate = false;

            if (email && existingEmailSet.has(email)) {
                response.duplicates.push({ row: rowNum, email, reason: 'Email already exists' });
                isDuplicate = true;
            }
            if (phone && existingPhoneSet.has(phone.toString().trim())) {
                response.duplicates.push({ row: rowNum, phone, reason: 'Mobile number already exists' });
                isDuplicate = true;
            }
            if (!isDuplicate) response.valid_count++;
        });
    } else {
        response.valid_count = clients.length;
    }

    if (inputJobNatures.size > 0) {
        const existingJobs = await db('crm_job_nature').where({ org_id: orgId }).whereIn(db.raw('LOWER(job_name)'), Array.from(inputJobNatures)).select('job_name');
        const existingJobSet = new Set(existingJobs.map(j => j.job_name.toLowerCase()));
        Array.from(inputJobNatures).forEach(j => {
            if (!existingJobSet.has(j)) {
                const original = clients.find(c => {
                    const val = c['job_nature'] || c['job nature'] || c['Job Nature'] || c['nature of job'] || c['nature of job'];
                    return val?.trim().toLowerCase() === j;
                });
                const originalVal = original['job_nature'] || original['job nature'] || original['Job Nature'] || original['nature of job'] || original['nature of job'];
                response.new_job_natures.push(originalVal.trim());
            }
        });
    }

    return response;
}

export async function createInteraction(orgId, data) {
    const { contact_id, type, interaction_date, follow_up_date, remarks, interacted_by } = data;

    if (!contact_id || !type || !interaction_date) {
        throw new AppError('Missing required interaction fields', 400);
    }

    const [newId] = await db('crm_interactions').insert({
        org_id: orgId,
        contact_id,
        type,
        interaction_date,
        follow_up_date: follow_up_date || null,
        remarks: remarks || null,
        interacted_by: interacted_by || null,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
    });

    return newId;
}

export default {
    getClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient,
    bulkInsertClients,
    bulkValidateClients,
    createInteraction
};
