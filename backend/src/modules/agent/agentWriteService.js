import { fail } from './agentValidation.js';
import { getUploadedDataset, cleanupUpload } from './agentUploadService.js';
import { findOrCreateSector } from '../shared/sectorService.js';
import { findOrCreateJobNature } from '../shared/jobNatureService.js';

const VALID_CATEGORIES = ['Contractor', 'Supplier', 'Consultant', 'Manufacturer', 'Service Provider'];

function cleanCategory(cat) {
    if (!cat) return 'Supplier';
    const clean = String(cat).trim();
    const found = VALID_CATEGORIES.find(c => c.toLowerCase() === clean.toLowerCase());
    return found || 'Supplier';
}

function detectColumnMapping(headers) {
    const mapping = {};
    const lower = headers.map(h => ({ raw: h, clean: h.toLowerCase().trim().replace(/[^a-z0-9]/g, '') }));

    const matchers = {
        name: ['vendorname', 'companyname', 'suppliername', 'firmname', 'vendor', 'supplier', 'name', 'company', 'contractor'],
        contact_person: ['contactperson', 'contactname', 'person', 'poc', 'representative', 'contactpersonname'],
        mobile: ['mobile', 'mobilenumber', 'mobileno', 'phone', 'phonenumber', 'phoneno', 'contactno', 'contactnumber', 'cell', 'telephone'],
        email: ['email', 'emailid', 'emailaddress', 'mail'],
        address: ['address', 'addr', 'officeaddress', 'street', 'locationaddress'],
        location: ['location', 'city', 'place', 'town', 'state'],
        gst_no: ['gst', 'gstno', 'gstnumber', 'gstin', 'taxid', 'vat'],
        category: ['category', 'vendortype', 'type', 'classification'],
        sector_name: ['sector', 'industry', 'domain', 'sectortype'],
        job_nature: ['jobnature', 'natureofwork', 'worknature', 'jobtype', 'trade'],
        remarks: ['remarks', 'notes', 'comment', 'description']
    };

    for (const [field, keywords] of Object.entries(matchers)) {
        for (const kw of keywords) {
            const found = lower.find(h => h.clean === kw || h.clean.includes(kw));
            if (found && !Object.values(mapping).includes(found.raw)) {
                mapping[field] = found.raw;
                break;
            }
        }
    }

    return mapping;
}

function extractRow(row, mapping) {
    const get = field => {
        const header = mapping[field];
        return header ? String(row[header] ?? '').trim() : '';
    };

    return {
        name: get('name'),
        contact_person: get('contact_person') || null,
        mobile: get('mobile') || null,
        email: get('email') || null,
        address: get('address') || null,
        location: get('location') || null,
        gst_no: get('gst_no') || null,
        category: get('category') || 'Supplier',
        sector_name: get('sector_name') || null,
        job_nature: get('job_nature') || null,
        remarks: get('remarks') || null
    };
}

export function createWriteService({ db, vendors, resources, approvalService }) {
    return {
        async preconditions(tool, args, scope, connection = db, lock = false) {
            if (tool.name === 'approvals.decide') {
                return {
                    itemType: args.itemType,
                    itemId: args.itemId,
                    action: args.action,
                    comments: args.comments || null
                };
            }

            if (tool.name === 'approvals.batchDecide') {
                return {
                    itemType: args.itemType || 'all',
                    action: args.action,
                    comments: args.comments || null
                };
            }

            if (tool.name === 'vendors.create') {
                return { category: 'Supplier', scope: 'master', orgId: scope.orgId };
            }

            if (tool.name === 'vendors.bulkImport') {
                const dataset = getUploadedDataset(args.uploadId, scope.orgId);
                if (!dataset) fail('validation_error', 'staged_dataset_expired_or_not_found');

                const mapping = args.mapping && Object.keys(args.mapping).length > 0 ? args.mapping : detectColumnMapping(dataset.headers);
                if (!mapping.name) fail('validation_error', 'unable_to_detect_vendor_name_column');

                const existingQuery = connection('crm_contacts').where({ org_id: scope.orgId });
                if (lock) existingQuery.forUpdate();
                const existing = await existingQuery.select('name', 'mobile');

                const existingNames = new Set(existing.map(c => (c.name || '').toLowerCase().trim()));
                const existingMobiles = new Set(existing.map(c => (c.mobile || '').replace(/\D/g, '')).filter(Boolean));

                const validRows = [];
                const duplicateRows = [];
                const invalidRows = [];

                for (let i = 0; i < dataset.rows.length; i++) {
                    const item = extractRow(dataset.rows[i], mapping);
                    if (!item.name) {
                        invalidRows.push({ rowNumber: i + 2, reason: 'Missing vendor name' });
                        continue;
                    }
                    const normName = item.name.toLowerCase().trim();
                    const normMobile = item.mobile ? item.mobile.replace(/\D/g, '') : null;

                    if (existingNames.has(normName) || (normMobile && existingMobiles.has(normMobile))) {
                        duplicateRows.push({ rowNumber: i + 2, name: item.name, reason: 'Already exists in database' });
                        continue;
                    }

                    existingNames.add(normName);
                    if (normMobile) existingMobiles.add(normMobile);

                    item.category = cleanCategory(item.category);
                    validRows.push(item);
                }

                return {
                    uploadId: args.uploadId,
                    totalRows: dataset.rows.length,
                    validCount: validRows.length,
                    duplicateCount: duplicateRows.length,
                    invalidCount: invalidRows.length,
                    columnMapping: mapping,
                    sampleValid: validRows.slice(0, 3).map(r => ({
                        name: r.name,
                        mobile: r.mobile || '-',
                        category: r.category,
                        sector: r.sector_name || '-'
                    })),
                    issues: [...invalidRows.slice(0, 3), ...duplicateRows.slice(0, 3)].map(iss => `Row ${iss.rowNumber}: ${iss.reason}${iss.name ? ` (${iss.name})` : ''}`)
                };
            }

            if (tool.name !== 'resources.createRateVersion') fail('validation_error', 'unknown_write_tool');
            const q = connection('res_resources').where({ id: args.resourceId, org_id: scope.orgId });
            if (lock) q.forUpdate();
            const resource = await q.first('id', 'type', 'project_id', 'parent_id', 'base_unit_code');
            if (!resource || !['material', 'labour'].includes(resource.type) || Number(resource.project_id || 0) !== Number(args.projectId || 0)) fail('validation_error', 'unsupported_rate_target');
            const ratesQuery = connection('res_rates').where({ resource_id: resource.id, is_active: 1 }).orderBy('id', 'desc').limit(2);
            if (lock) ratesQuery.forUpdate();
            const rates = await ratesQuery.select('id', 'rate', 'unit_code', 'effective_from', 'effective_to');
            if (rates.length > 1) fail('validation_error', 'ambiguous_active_rate');
            return JSON.parse(JSON.stringify({ resource, rates }));
        },

        async execute(tool, args, scope, trx) {
            if (!trx?.isTransaction) fail('execution_failure', 'caller_transaction_required');

            if (tool.name === 'vendors.create') {
                const id = await vendors.createVendor(scope.orgId, { ...args, category: 'Supplier' }, { transaction: trx, agentSupplierOnly: true });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }

            if (tool.name === 'vendors.bulkImport') {
                const dataset = getUploadedDataset(args.uploadId, scope.orgId);
                if (!dataset) fail('execution_failure', 'staged_dataset_expired');

                const mapping = args.mapping && Object.keys(args.mapping).length > 0 ? args.mapping : detectColumnMapping(dataset.headers);
                const existing = await trx('crm_contacts').where({ org_id: scope.orgId }).select('name', 'mobile');
                const existingNames = new Set(existing.map(c => (c.name || '').toLowerCase().trim()));
                const existingMobiles = new Set(existing.map(c => (c.mobile || '').replace(/\D/g, '')).filter(Boolean));

                const recordsToInsert = [];
                for (let i = 0; i < dataset.rows.length; i++) {
                    const item = extractRow(dataset.rows[i], mapping);
                    if (!item.name) continue;
                    const normName = item.name.toLowerCase().trim();
                    const normMobile = item.mobile ? item.mobile.replace(/\D/g, '') : null;
                    if (existingNames.has(normName) || (normMobile && existingMobiles.has(normMobile))) continue;

                    existingNames.add(normName);
                    if (normMobile) existingMobiles.add(normMobile);

                    let sector_id = null;
                    if (item.sector_name) {
                        sector_id = await findOrCreateSector(scope.orgId, item.sector_name, trx);
                    }
                    let job_nature_id = null;
                    if (item.job_nature) {
                        job_nature_id = await findOrCreateJobNature(scope.orgId, item.job_nature, trx);
                    }

                    recordsToInsert.push({
                        org_id: scope.orgId,
                        name: item.name,
                        contact_person: item.contact_person,
                        mobile: item.mobile,
                        telephone_no: item.mobile,
                        email: item.email,
                        address: item.address,
                        location: item.location,
                        gst_no: item.gst_no,
                        category: cleanCategory(item.category),
                        sector_id,
                        job_nature_id,
                        remarks: item.remarks || 'Imported via Agent Bulk Upload',
                        scope: 'master',
                        created_at: trx.fn.now(),
                        updated_at: trx.fn.now()
                    });
                }

                if (recordsToInsert.length > 0) {
                    const CHUNK_SIZE = 50;
                    for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
                        await trx('crm_contacts').insert(recordsToInsert.slice(i, i + CHUNK_SIZE));
                    }
                }

                cleanupUpload(args.uploadId);
                return { count: recordsToInsert.length, outcome: 'success', id: recordsToInsert.length || 1 };
            }

            if (tool.name === 'resources.createRateVersion') {
                const id = await resources.addRate(scope.orgId, args.resourceId,
                    { rate: args.rate, unit_code: args.unit_code, effective_from: args.effective_from, remarks: args.remarks || null, project_id: args.projectId || null },
                    { transaction: trx, agentExistingOnly: true });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }

            if (tool.name === 'approvals.decide') {
                const res = await approvalService.decideApproval(scope.orgId, scope.userId, args, { trx });
                return { id: res.id || 1, ...res };
            }

            if (tool.name === 'approvals.batchDecide') {
                const res = await approvalService.batchDecideApprovals(scope.orgId, scope.userId, args, { trx });
                return { id: res.id || 1, ...res };
            }

            fail('validation_error', 'unknown_write_tool');
        }
    };
}
