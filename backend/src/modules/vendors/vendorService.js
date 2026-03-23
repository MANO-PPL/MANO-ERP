import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { findOrCreateSector } from '../shared/sectorService.js';
import { findOrCreateJobNature } from '../shared/jobNatureService.js';

export async function getVendors(query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const offset = (page - 1) * limit;

    const baseQuery = db('contacts as c')
        .leftJoin('job_nature as jn', 'c.job_nature_id', 'jn.job_id')
        .where('c.type', 'vendor');

    // Apply filters to both count and data queries
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
        if (query.categories && query.categories.length > 0) {
            let cats = Array.isArray(query.categories) ? query.categories : query.categories.split(',').filter(Boolean);
            if (cats.length > 0) {
                // Normalize and handle common plural/singular mismatches
                cats = cats.map(c => c.toLowerCase());
                if (cats.includes('consultant') && !cats.includes('consultants')) cats.push('consultants');
                if (cats.includes('consultants') && !cats.includes('consultant')) cats.push('consultant');
                qb = qb.whereIn(db.raw('LOWER(c.category)'), cats);
            }
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
        return qb;
    };

    // 1. Get total count
    const countRes = await applyFilters(baseQuery.clone()).count('c.id as total').first();
    const total = parseInt(countRes?.total || 0);

    // 2. Get paginated data
    const vendors = await applyFilters(baseQuery)
        .select(
            'c.*',
            'jn.job_name'
        )
        .orderBy('c.created_at', 'asc')
        .limit(limit)
        .offset(offset);

    const vendorIds = vendors.map(v => v.id);

    if (vendorIds.length === 0) {
        return { vendors: [], total, page, limit };
    }

    // Fetch interactions...
    const interactions = await db('interactions')
        .whereIn('contact_id', vendorIds)
        .whereNull('interacted_by')
        .select('*');

    const interactionsByContact = interactions.reduce((acc, interaction) => {
        if (!acc[interaction.contact_id]) {
            acc[interaction.contact_id] = [];
        }
        acc[interaction.contact_id].push(interaction);
        return acc;
    }, {});

    return {
        vendors: vendors.map(v => ({
            ...v,
            contact_no: v.telephone_no,
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

export async function getVendorById(id) {
    const vendor = await db('contacts')
        .where({ id, type: 'vendor' })
        .first();

    if (!vendor) {
        throw new AppError('Vendor not found', 404);
    }

    const interactions = await db('interactions as i')
        .leftJoin('users as u', 'i.interacted_by', 'u.id')
        .where({ 'i.contact_id': id })
        .select('i.*', 'u.name as interacted_by_name')
        .orderBy('i.interaction_date', 'desc');

    vendor.interactions = interactions;
    vendor.self_remark = vendor.remarks;
    vendor.job_id = vendor.job_nature_id;
    return vendor;
}

export async function createInteraction(id, data) {
    if (!data.type || !data.interaction_date) {
        throw new AppError('Interaction type and date are required', 400);
    }

    const insertData = {
        contact_id: id,
        type: data.type.toLowerCase(),
        interaction_date: data.interaction_date,
        follow_up_date: data.follow_up_date || null,
        remarks: data.remarks || null,
        interacted_by: data.interacted_by || null,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
    };

    const [newId] = await db('interactions').insert(insertData);
    return newId;
}

export async function createVendor(data) {
    if (!data.name) {
        throw new AppError('Vendor name is required', 400);
    }

    const insertData = {
        type: 'vendor',
        name: data.name,
        sector_id: data.sector_id || null,
        job_nature_id: data.job_nature_id || null,
        category: data.category || null,
        contact_person: data.contact_person || null,
        designation: data.designation || null,
        telephone_no: data.telephone_no || null,
        mobile: data.mobile || null,
        email: data.email || null,
        address: data.address || null,
        location: data.location || null,
        website: data.website || null,
        gst_no: data.gst_no || null,
        constitution: data.constitution || null,
        reference: data.reference || null,
        responsibility: data.responsibility || null,
        remarks: data.remarks || data.self_remark || null
    };

    // Resolve job nature name to ID if provided as string
    if (data.job_nature && !data.job_nature_id) {
        insertData.job_nature_id = await findOrCreateJobNature(data.job_nature);
    }

    const [newId] = await db('contacts').insert(insertData);
    return newId;
}

export async function updateVendor(id, data) {
    const vendor = await db('contacts').where({ id, type: 'vendor' }).first();
    if (!vendor) {
        throw new AppError('Vendor not found', 404);
    }

    const updateData = {};
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
    if (data.constitution !== undefined) updateData.constitution = data.constitution;
    if (data.reference !== undefined) updateData.reference = data.reference;
    if (data.responsibility !== undefined) updateData.responsibility = data.responsibility;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;
    if (data.self_remark !== undefined) updateData.remarks = data.self_remark;

    // Resolve job nature name to ID if provided as string
    if (data.job_nature && !data.job_nature_id) {
        updateData.job_nature_id = await findOrCreateJobNature(data.job_nature);
    }

    updateData.updated_at = db.fn.now();

    await db('contacts').where({ id }).update(updateData);
    return true;
}

export async function deleteVendors(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError('No Vendor IDs provided', 400);
    }

    // Delete related interactions first (if no cascade)
    await db('interactions').whereIn('contact_id', ids).delete();

    // Delete contact
    const deletedCount = await db('contacts').whereIn('id', ids).where({ type: 'vendor' }).delete();

    if (deletedCount === 0) {
        throw new AppError('No valid vendors found to delete', 404);
    }

    return true;
}

export async function bulkInsertVendors(rowsData) {
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
        const rawJobNature = row['job_nature'] || row['job nature'] || row['Job Nature'] || row['nature of job'] || row['Nature of Job'] || null;

        if (!name) {
            results.failure_count++;
            results.errors.push(`Row ${rowNumber}: Missing Name`);
            continue;
        }

        try {
            let jobNatureId = null;
            if (rawJobNature) {
                jobNatureId = await findOrCreateJobNature(rawJobNature);
            }

            await createVendor({
                name,
                contact_person,
                mobile,
                email,
                location,
                telephone_no: row['telephone_no'] || row['telephone'] || row['Telephone'] || null,
                address: row['address'] || row['Address'] || null,
                website: row['website'] || row['Website'] || null,
                gst_no: row['gst_no'] || row['gst'] || row['GST'] || null,
                category: row['category'] || row['Category'] || null,
                job_nature_id: jobNatureId
            });
            results.success_count++;
        } catch (err) {
            results.failure_count++;
            results.errors.push(`Row ${rowNumber}: ${err.message}`);
        }
    }

    return results;
}

export async function bulkValidateVendors(vendors) {
    const response = { duplicates: [], new_job_natures: [], valid_count: 0 };
    const inputEmails = new Set();
    const inputPhones = new Set();
    const inputJobNatures = new Set();

    vendors.forEach((v) => {
        const email = v['email'] || v['Email'];
        const phone = v['mobile'] || v['Mobile'] || v['mobile no'];
        const jobNature = v['job_nature'] || v['job nature'] || v['Job Nature'] || v['nature of job'] || v['Nature of Job'];

        if (email) inputEmails.add(email);
        if (phone) inputPhones.add(phone.toString().trim());
        if (jobNature) inputJobNatures.add(jobNature.trim().toLowerCase());
    });

    if (inputEmails.size > 0) {
        const existingVendors = await db('contacts').where({ type: 'vendor' }).whereIn('email', Array.from(inputEmails)).select('email');
        const existingEmailSet = new Set(existingVendors.map(v => v.email));

        let existingPhoneSet = new Set();
        if (inputPhones.size > 0) {
            const existingPhones = await db('contacts').where({ type: 'vendor' }).whereIn('mobile', Array.from(inputPhones)).select('mobile');
            existingPhoneSet = new Set(existingPhones.map(v => v.mobile));
        }

        vendors.forEach((v, index) => {
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
        response.valid_count = vendors.length;
    }

    if (inputJobNatures.size > 0) {
        const existingJobs = await db('job_nature').whereIn(db.raw('LOWER(job_name)'), Array.from(inputJobNatures)).select('job_name');
        const existingJobSet = new Set(existingJobs.map(j => j.job_name.toLowerCase()));
        Array.from(inputJobNatures).forEach(j => {
            if (!existingJobSet.has(j)) {
                const searchStr = j;
                const original = vendors.find(v => {
                    const val = v['job_nature'] || v['job nature'] || v['Job Nature'] || v['nature of job'] || v['Nature of Job'];
                    return val?.trim().toLowerCase() === searchStr;
                });
                const originalVal = original['job_nature'] || original['job nature'] || original['Job Nature'] || original['nature of job'] || original['Nature of Job'];
                response.new_job_natures.push(originalVal.trim());
            }
        });
    }

    return response;
}

export default {
    getVendors,
    getVendorById,
    createVendor,
    updateVendor,
    deleteVendors,
    bulkInsertVendors,
    bulkValidateVendors,
    createInteraction
};
