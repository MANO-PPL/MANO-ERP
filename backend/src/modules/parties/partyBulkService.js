import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';
import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { findOrCreateSector } from '../shared/sectorService.js';
import { findOrCreateJobNature } from '../shared/jobNatureService.js';
import { applyPartyScopeFilter, createParty, resolveCategory, writePartyChangeLog } from './partyService.js';
import partyContactService from './partyContactService.js';
import interactionService from '../interactions/interactionService.js';

/**
 * Parse an uploaded CSV or XLSX buffer into normalized row objects.
 */
export async function parseSpreadsheetBuffer(file) {
    if (!file) throw new AppError('Please upload a CSV or Excel file', 400);

    const workbook = new ExcelJS.Workbook();
    const buffer = file.buffer;
    const mimeType = file.mimetype || '';
    const originalName = (file.originalname || '').toLowerCase();

    if (mimeType.includes('csv') || originalName.endsWith('.csv')) {
        const bufferStream = new PassThrough();
        bufferStream.end(buffer);
        await workbook.csv.read(bufferStream);
    } else {
        await workbook.xlsx.load(buffer);
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new AppError('Invalid or empty file', 400);

    const headerMap = {};
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        const val = cell.value ? cell.value.toString().toLowerCase().trim() : '';
        headerMap[val] = colNumber;
    });

    const rowsData = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record = {};
        for (const [key, colNum] of Object.entries(headerMap)) {
            const cell = row.getCell(colNum);
            record[key] = cell.value ? cell.value.toString().trim() : null;
        }
        rowsData.push(record);
    });

    return rowsData;
}

/**
 * Bulk insert parties from uploaded CSV/Excel or JSON rows.
 */
export async function bulkInsertParties(orgId, rowsData, options = {}) {
    const scopeMode = options.scopeMode || 'all';
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
            await createParty(orgId, {
                name,
                contact_person,
                designation: rawDesignation ? rawDesignation.trim() : null,
                contact_no: row['Contact No'] || row['contact no'] || row['telephone_no'] || row['telephone'] || row['Telephone'] || null,
                mobile,
                email,
                address: row['address'] || row['Address'] || row['Company Address'] || null,
                location,
                website: row['website'] || row['Website'] || row['web_site'] || null,
                gst_no: row['gst_no'] || row['gst'] || row['GST'] || row['qst_no'] || null,
                category: row['category'] || row['Category'] || null,
                sector: rawSector,
                job_nature: rawJobNature,
                reference: row['reference'] || row['Reference'] || null,
                remarks: row['remarks'] || row['Remarks'] || row['self_remark'] || null
            }, { scopeMode, userId: options.userId });
            results.success_count++;
        } catch (err) {
            results.failure_count++;
            results.errors.push(`Row ${rowNumber}: ${err.message}`);
        }
    }

    return results;
}

/**
 * Validate bulk party rows for email/mobile duplicates and new job natures.
 */
export async function bulkValidateParties(orgId, rows, options = {}) {
    const scopeMode = options.scopeMode || 'all';
    const response = { duplicates: [], new_job_natures: [], valid_count: 0 };
    const inputEmails = new Set();
    const inputPhones = new Set();
    const inputJobNatures = new Set();

    rows.forEach((v) => {
        const email = v['email'] || v['Email'];
        const phone = v['mobile'] || v['Mobile'] || v['mobile no'];
        const jobNature = v['job_nature'] || v['job nature'] || v['Job Nature'] || v['nature of job'] || v['Nature of Job'];

        if (email) inputEmails.add(email);
        if (phone) inputPhones.add(phone.toString().trim());
        if (jobNature) inputJobNatures.add(jobNature.trim().toLowerCase());
    });

    if (inputEmails.size > 0 || inputPhones.size > 0) {
        const emailQuery = db('crm_contacts').where({ org_id: orgId });
        applyPartyScopeFilter(emailQuery, scopeMode, null);
        const existingEmails = inputEmails.size > 0
            ? await emailQuery.whereIn('email', Array.from(inputEmails)).select('email')
            : [];
        const existingEmailSet = new Set(existingEmails.map(c => c.email).filter(Boolean));

        let existingPhoneSet = new Set();
        if (inputPhones.size > 0) {
            const phoneQuery = db('crm_contacts').where({ org_id: orgId });
            applyPartyScopeFilter(phoneQuery, scopeMode, null);
            const existingPhones = await phoneQuery.whereIn('mobile', Array.from(inputPhones)).select('mobile');
            existingPhoneSet = new Set(existingPhones.map(c => c.mobile).filter(Boolean));
        }

        rows.forEach((v, index) => {
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
        response.valid_count = rows.length;
    }

    if (inputJobNatures.size > 0) {
        const existingJobs = await db('crm_job_nature')
            .where({ org_id: orgId })
            .whereIn(db.raw('LOWER(job_name)'), Array.from(inputJobNatures))
            .select('job_name');
        const existingJobSet = new Set(existingJobs.map(j => j.job_name.toLowerCase()));
        Array.from(inputJobNatures).forEach(j => {
            if (!existingJobSet.has(j)) {
                const original = rows.find(v => {
                    const val = v['job_nature'] || v['job nature'] || v['Job Nature'] || v['nature of job'] || v['Nature of Job'];
                    return val?.trim().toLowerCase() === j;
                });
                const originalVal = original['job_nature'] || original['job nature'] || original['Job Nature'] || original['nature of job'] || original['Nature of Job'];
                response.new_job_natures.push(originalVal.trim());
            }
        });
    }

    return response;
}

/**
 * Transactional batch create/update/delete for spreadsheet grid editors.
 */
export async function batchSaveParties(orgId, payload = {}, options = {}) {
    const scopeMode = options.scopeMode || 'all';
    const label = scopeMode === 'client' ? 'client' : scopeMode === 'vendor' ? 'vendor' : 'party';
    const { created = [], updated = [], deleted = [] } = payload;

    return await db.transaction(async (trx) => {
        let deletedCount = 0;
        let createdCount = 0;
        let updatedCount = 0;

        if (Array.isArray(deleted) && deleted.length > 0) {
            const validIds = deleted.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
            if (validIds.length > 0) {
                const toDeleteQuery = trx('crm_contacts').whereIn('id', validIds).where({ org_id: orgId }).select('id', 'name', 'category', 'status');
                applyPartyScopeFilter(toDeleteQuery, scopeMode, null);
                const toDelete = await toDeleteQuery;

                const scopedIds = trx('crm_contacts').whereIn('id', validIds).where({ org_id: orgId }).select('id');
                applyPartyScopeFilter(scopedIds, scopeMode, null);
                await interactionService.deleteInteractionsByContactIds(scopedIds, { transaction: trx });

                const delQuery = trx('crm_contacts').whereIn('id', validIds).where({ org_id: orgId });
                applyPartyScopeFilter(delQuery, scopeMode, null);
                deletedCount = await delQuery.delete();

                for (const row of toDelete) {
                    await writePartyChangeLog(trx, {
                        orgId,
                        entityId: row.id,
                        action: 'delete',
                        beforeData: { name: row.name, category: row.category, status: row.status },
                        afterData: null,
                        reason: payload.reason || 'Deleted via grid batch save',
                        userId: options.userId || null
                    });
                }
            }
        }

        for (const item of updated) {
            const updateData = {};
            if (item.name !== undefined) updateData.name = item.name;
            if (item.company !== undefined) updateData.name = item.company;
            if (item.contact_person !== undefined) updateData.contact_person = item.contact_person;
            if (item.designation !== undefined) updateData.designation = item.designation;
            if (item.telephone_no !== undefined) updateData.telephone_no = item.telephone_no;
            else if (item.contact_no !== undefined || item.mobile !== undefined) {
                updateData.telephone_no = item.contact_no ?? item.mobile;
            }
            if (item.email !== undefined) updateData.email = item.email;
            if (item.website !== undefined) updateData.website = item.website;
            else if (item.web_site !== undefined) updateData.website = item.web_site;
            if (item.address !== undefined) updateData.address = item.address;
            if (item.location !== undefined) updateData.location = item.location;
            if (item.gst_no !== undefined) updateData.gst_no = item.gst_no;
            if (item.reference !== undefined) updateData.reference = item.reference;
            if (item.remarks !== undefined) updateData.remarks = item.remarks;
            else if (item.remark !== undefined) updateData.remarks = item.remark;
            else if (item.self_remark !== undefined) updateData.remarks = item.self_remark;

            if (scopeMode !== 'client' && item.category !== undefined) {
                updateData.category = resolveCategory(item.category, 'Contractor');
            }

            if (item.job_name || item.job_nature) {
                updateData.job_nature_id = await findOrCreateJobNature(orgId, item.job_name || item.job_nature, trx);
            }
            if (item.sector_name || item.sector) {
                updateData.sector_id = await findOrCreateSector(orgId, item.sector_name || item.sector, trx);
            }
            if (options.userId) {
                updateData.updated_by = options.userId;
            }

            if (Object.keys(updateData).length > 0) {
                const updQuery = trx('crm_contacts').where({ id: item.id, org_id: orgId });
                applyPartyScopeFilter(updQuery, scopeMode, null);
                const affected = await updQuery.update(updateData);
                if (affected > 0) {
                    await partyContactService.syncFromPartyPayload(trx, orgId, Number(item.id), item, {
                        userId: options.userId,
                        partyName: updateData.name || item.name
                    });
                }
                updatedCount++;
            }
        }

        if (Array.isArray(created) && created.length > 0) {
            const existingQuery = trx('crm_contacts').where({ org_id: orgId }).select('name');
            applyPartyScopeFilter(existingQuery, scopeMode, null);
            const existingRows = await existingQuery;
            const existingNames = new Set(existingRows.map((c) => String(c.name || '').trim().toLowerCase()));
            const batchNames = new Set();

            for (const item of created) {
                const partyName = item?.name || item?.company;
                if (!partyName || !String(partyName).trim()) continue;

                const normName = String(partyName).trim().toLowerCase();
                if (existingNames.has(normName) || batchNames.has(normName)) {
                    throw new AppError(`Data already exists: A ${label} with the name "${String(partyName).trim()}" already exists`, 409);
                }
                batchNames.add(normName);

                let jobNatureId = item.job_nature_id || item.job_id || null;
                if (!jobNatureId && (item.job_name || item.job_nature)) {
                    jobNatureId = await findOrCreateJobNature(orgId, item.job_name || item.job_nature, trx);
                }

                let sectorId = item.sector_id || null;
                if (!sectorId && (item.sector_name || item.sector)) {
                    sectorId = await findOrCreateSector(orgId, item.sector_name || item.sector, trx);
                }

                const [newId] = await trx('crm_contacts').insert({
                    org_id: orgId,
                    category: scopeMode === 'client' ? 'Client' : resolveCategory(item.category, 'Contractor'),
                    name: String(partyName).trim(),
                    job_nature_id: jobNatureId,
                    sector_id: sectorId,
                    contact_person: item.contact_person || null,
                    designation: item.designation || null,
                    telephone_no: item.telephone_no || item.contact_no || item.mobile || null,
                    email: item.email || null,
                    website: item.website || item.web_site || null,
                    address: item.address || null,
                    location: item.location || null,
                    gst_no: item.gst_no || null,
                    reference: item.reference || null,
                    remarks: (item.remarks !== undefined ? item.remarks : (item.remark !== undefined ? item.remark : item.self_remark)) || null,
                    status: 'active',
                    created_by: options.userId || null,
                    updated_by: options.userId || null
                });
                await partyContactService.syncFromPartyPayload(trx, orgId, newId, item, {
                    userId: options.userId,
                    partyName: String(partyName).trim()
                });

                await writePartyChangeLog(trx, {
                    orgId,
                    entityId: newId,
                    action: 'create',
                    beforeData: null,
                    afterData: { name: String(partyName).trim(), category: scopeMode === 'client' ? 'Client' : resolveCategory(item.category, 'Contractor') },
                    reason: payload.reason || 'Created via grid batch save',
                    userId: options.userId || null
                });
                createdCount++;
            }
        }

        return { createdCount, updatedCount, deletedCount };
    });
}

export default {
    parseSpreadsheetBuffer,
    bulkInsertParties,
    bulkValidateParties,
    batchSaveParties
};
