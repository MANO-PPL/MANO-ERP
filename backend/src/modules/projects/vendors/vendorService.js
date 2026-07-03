import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import { findOrCreateJobNature } from '../../shared/jobNatureService.js';

const FIELD_MAP = {
    name: 'c.name',
    location: 'c.address',
    email: 'c.email',
    contact_person: 'c.contact_person',
    mobile: 'c.mobile',
    website: 'c.website',
    job_nature: 'jn.job_name',
    address: 'c.address',
    telephone_no: 'c.telephone_no',
};

/* -------------------------------------------------------
   FETCH PROJECT VENDORS
-------------------------------------------------------- */
export async function getProjectVendors(projectId, fields) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const BASE_FIELDS = [
        'pv.pv_id as pv_id',
        'pv.vendors_id as vendors_id',
    ];

    let selectedFields = [...BASE_FIELDS];

    if (fields) {
        const requestedFields = fields.split(',').map(f => f.trim());
        const dynamicFields = requestedFields
            .filter(f => FIELD_MAP[f])
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

    const vendors = await db('pdoc_vendors as pv')
        .leftJoin('crm_contacts as c', function () {
            this.on('pv.vendors_id', 'c.id').andOn('c.type', db.raw("'vendor'"));
        })
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.job_id')
        .where('pv.project_id', projectId)
        .select(selectedFields)
        .orderBy('c.name', 'asc');

    return { vendors, count: vendors.length };
}

/* -------------------------------------------------------
   ADD VENDORS TO PROJECT (bulk)
-------------------------------------------------------- */
export async function addVendorsToProject(projectId, vendorIds) {
    // Validate all vendors exist in contacts with type=vendor
    const vendorRecords = await db('crm_contacts')
        .where('type', 'vendor')
        .whereIn('id', vendorIds);

    if (vendorRecords.length !== vendorIds.length) {
        const foundIds = vendorRecords.map(v => v.id);
        const missingIds = vendorIds.filter(id => !foundIds.includes(id));
        throw new AppError(`Some vendors not found: ${missingIds.join(', ')}`, 404);
    }

    // Check for existing associations
    const existingAssociations = await db('pdoc_vendors')
        .where('project_id', projectId)
        .whereIn('vendors_id', vendorIds);

    if (existingAssociations.length > 0) {
        const existingIds = existingAssociations.map(a => a.vendors_id);
        throw new AppError(`Some vendors already added: ${existingIds.join(', ')}`, 409);
    }

    // Insert all
    const insertData = vendorIds.map(vendors_id => ({
        project_id: projectId,
        vendors_id,
    }));

    await db('pdoc_vendors').insert(insertData);

    // Return the inserted pv_ids
    const insertedRecords = await db('pdoc_vendors')
        .where('project_id', projectId)
        .whereIn('vendors_id', vendorIds)
        .select('pv_id');

    return insertedRecords.map(r => r.pv_id);
}

/* -------------------------------------------------------
   DELETE VENDORS FROM PROJECT (bulk by pv_ids)
-------------------------------------------------------- */
export async function removeVendorsFromProject(pvIds) {
    const existing = await db('pdoc_vendors').whereIn('pv_id', pvIds);

    if (existing.length === 0) {
        throw new AppError('No matching project vendors found', 404);
    }

    const existingPvIds = existing.map(e => e.pv_id);
    const notFound = pvIds.filter(id => !existingPvIds.includes(id));

    const deletedCount = await db('pdoc_vendors')
        .whereIn('pv_id', pvIds)
        .del();

    return { deletedCount, deletedPvIds: existingPvIds, notFoundPvIds: notFound };
}

export default {
    getProjectVendors,
    addVendorsToProject,
    removeVendorsFromProject,
};
