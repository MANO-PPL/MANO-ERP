import { fail, fingerprint } from './agentValidation.js';
import { validateIntent } from './agentTools.js';
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

export function createWriteService({ db, clients, vendors, resources, approvalService }) {
    async function clientImport(args, scope, connection, lock = false) {
        const dataset = getUploadedDataset(args.uploadId, scope.orgId);
        if (!dataset) fail('validation_error', 'staged_dataset_expired_or_not_found');
        if (dataset.rows.length > 500) fail('validation_error', 'client_import_row_limit');
        const headers = dataset.headers;
        const mapping = args.mapping && Object.keys(args.mapping).length ? args.mapping : Object.fromEntries(
            ['name', 'contact_person', 'mobile', 'email', 'address', 'location', 'remarks'].map(field => [field, headers.find(header => header.toLowerCase().replace(/[^a-z]/g, '') === field.replace(/_/g, '') || (field === 'name' && ['clientname', 'companyname', 'customername'].includes(header.toLowerCase().replace(/[^a-z]/g, ''))))]).filter(([, header]) => header));
        const fields = ['name', 'contact_person', 'mobile', 'email', 'address', 'location', 'remarks'];
        if (!mapping.name || Object.entries(mapping).some(([key, value]) => !fields.includes(key) || !headers.includes(value))) fail('validation_error', 'invalid_client_column_mapping');
        const query = connection('crm_contacts').where({ org_id: scope.orgId });
        if (lock) query.forUpdate();
        const existing = await query.select('name', 'mobile', 'email');
        const names = new Set(existing.map(row => String(row.name || '').trim().toLowerCase()).filter(Boolean));
        const mobiles = new Set(existing.map(row => String(row.mobile || '').replace(/\D/g, '')).filter(Boolean));
        const emails = new Set(existing.map(row => String(row.email || '').trim().toLowerCase()).filter(Boolean));
        const valid = [], invalid = [], duplicates = [];
        dataset.rows.forEach((row, index) => {
            const data = Object.fromEntries(fields.filter(field => mapping[field] && String(row[mapping[field]] || '').trim()).map(field => [field, String(row[mapping[field]]).trim()]));
            try { validateIntent({ kind: 'tool', tool: 'clients.create', version: 1, arguments: data }); }
            catch { invalid.push(index + 2); return; }
            const name = data.name.toLowerCase(), mobile = String(data.mobile || '').replace(/\D/g, ''), email = String(data.email || '').toLowerCase();
            if (names.has(name) || (mobile && mobiles.has(mobile)) || (email && emails.has(email))) { duplicates.push(index + 2); return; }
            names.add(name); if (mobile) mobiles.add(mobile); if (email) emails.add(email);
            valid.push(data);
        });
        const preview = { uploadId: args.uploadId, totalRows: dataset.rows.length, validCount: valid.length, invalidCount: invalid.length,
            duplicateCount: duplicates.length, columnMapping: mapping, contentHash: fingerprint(dataset.rows), acceptedHash: fingerprint(valid),
            sampleValid: valid.slice(0, 3).map(row => ({ name: row.name, category: 'Client' })),
            issues: [...invalid.slice(0, 3).map(row => `Row ${row}: invalid client fields`), ...duplicates.slice(0, 3).map(row => `Row ${row}: duplicate contact`)] };
        return { valid, preview };
    }
    return {
        async preconditions(tool, args, scope, connection = db, lock = false) {
            if (['tasks.create', 'tasks.update'].includes(tool.name)) {
                let task = null;
                let category = null;
                if (tool.name === 'tasks.create') {
                    const query = connection('proj_task_categories').where({ project_id: args.projectId })
                        .whereRaw('LOWER(??) = ?', ['name', args.categoryName.trim().toLowerCase()]);
                    if (lock) query.forUpdate();
                    const matches = await query.limit(2).select('id', 'name', 'sort_order');
                    if (matches.length !== 1) fail('validation_error', 'task_category_not_unique_or_missing');
                    category = matches[0];
                    const duplicate = connection('proj_tasks').where({ project_id: args.projectId, category_id: category.id })
                        .whereRaw('LOWER(??) = ?', ['name', args.name.trim().toLowerCase()]);
                    if (lock) duplicate.forUpdate();
                    if (await duplicate.first('id')) fail('validation_error', 'duplicate_task_name');
                } else {
                    const query = connection('proj_tasks').where({ id: args.taskId, project_id: args.projectId });
                    if (lock) query.forUpdate();
                    task = await query.first('id', 'project_id', 'category_id', 'name', 'description', 'status', 'priority', 'start_date', 'due_date');
                    if (!task) fail('authorization_denied');
                }
                const start = args.start_date || (task?.start_date ? new Date(task.start_date).toISOString().slice(0, 10) : null);
                const end = args.due_date || (task?.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : null);
                if (start && end && end < start) fail('validation_error', 'invalid_task_dates');
                return { projectId: args.projectId, category: category ? JSON.parse(JSON.stringify(category)) : null,
                    current: task ? JSON.parse(JSON.stringify(task)) : null, proposedDates: { start, end } };
            }
            if (['projects.create', 'projects.update'].includes(tool.name)) {
                const currentQuery = tool.name === 'projects.update'
                    ? connection('proj_projects').where({ id: args.projectId, org_id: scope.orgId })
                    : null;
                if (lock && currentQuery) currentQuery.forUpdate();
                const current = currentQuery ? await currentQuery.first('id', 'name', 'location', 'project_code', 'start_date', 'end_date', 'status') : null;
                if (currentQuery && !current) fail('authorization_denied');
                if (tool.name === 'projects.create') {
                    const duplicate = connection('proj_projects').where({ org_id: scope.orgId })
                        .whereRaw('LOWER(??) = ?', ['name', args.name.trim().toLowerCase()]);
                    if (lock) duplicate.forUpdate();
                    if (await duplicate.first('id')) fail('validation_error', 'duplicate_project_name');
                }
                const code = args.project_code?.trim();
                if (code) {
                    const duplicate = connection('proj_projects').where({ org_id: scope.orgId, project_code: code });
                    if (current) duplicate.whereNot({ id: current.id });
                    if (lock) duplicate.forUpdate();
                    if (await duplicate.first('id')) fail('validation_error', 'duplicate_project_code');
                }
                const start = args.start_date || (current?.start_date ? new Date(current.start_date).toISOString().slice(0, 10) : null);
                const end = args.end_date || (current?.end_date ? new Date(current.end_date).toISOString().slice(0, 10) : null);
                if (start && end && end < start) fail('validation_error', 'invalid_project_dates');
                return { orgId: scope.orgId, current: current ? JSON.parse(JSON.stringify(current)) : null, proposedDates: { start, end } };
            }
            if (tool.name === 'resources.create') {
                const query = connection('res_resources').where({ org_id: scope.orgId }).whereNull('project_id').whereRaw('LOWER(??) = ?', ['name', args.name.trim().toLowerCase()]);
                if (lock) query.forUpdate();
                if (await query.first('id')) fail('validation_error', 'duplicate_resource_name');
                return { orgId: scope.orgId, scope: 'master', type: args.type, base_unit_code: args.base_unit_code };
            }
            if (['resources.update', 'resources.addConversion'].includes(tool.name)) {
                const query = connection('res_resources').where({ id: args.resourceId, org_id: scope.orgId });
                if (lock) query.forUpdate();
                const resource = await query.first();
                if (!resource || Number(resource.project_id || 0) !== Number(args.projectId || 0)) fail('authorization_denied');
                return JSON.parse(JSON.stringify({ resource }));
            }
            if (tool.name === 'clients.bulkImport') return (await clientImport(args, scope, connection, lock)).preview;
            if (tool.name === 'clients.create') {
                const query = connection('crm_contacts').where({ org_id: scope.orgId }).whereRaw('LOWER(??) = ?', ['name', args.name.trim().toLowerCase()]);
                if (lock) query.forUpdate();
                if (await query.first('id')) fail('validation_error', 'duplicate_contact_name');
                return { category: 'Client', scope: 'master', orgId: scope.orgId, name: args.name };
            }
            if (['clients.update', 'vendors.update', 'clients.addInteraction'].includes(tool.name)) {
                const query = connection('crm_contacts').where({ id: args.contactId, org_id: scope.orgId });
                if (lock) query.forUpdate();
                const contact = await query.first();
                const category = String(contact?.category || '').toLowerCase();
                if (!contact || (tool.module === 'clients' ? category !== 'client' : ['client', 'pmc'].includes(category))) fail('authorization_denied');
                return JSON.parse(JSON.stringify({ contact }));
            }
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
            if (tool.name === 'tasks.create') {
                const category = await trx('proj_task_categories').where({ project_id: args.projectId })
                    .whereRaw('LOWER(??) = ?', ['name', args.categoryName.trim().toLowerCase()]).first('id');
                if (!category) fail('request_rejected', 'task_category_changed');
                const last = await trx('proj_tasks').where({ project_id: args.projectId }).orderBy('id', 'desc').first('id');
                const lastInCategory = await trx('proj_tasks').where({ project_id: args.projectId, category_id: category.id })
                    .orderBy('sort_order', 'desc').first('sort_order');
                const [id] = await trx('proj_tasks').insert({ project_id: args.projectId, category_id: category.id,
                    task_code: `T-${last ? Number(last.id) + 1 : 1}`, name: args.name.trim(),
                    description: args.description?.trim() || null, status: args.status || 'open', priority: args.priority || 'Medium',
                    start_date: args.start_date || null, due_date: args.due_date || null,
                    sort_order: lastInCategory ? Number(lastInCategory.sort_order) + 10 : 10 });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'tasks.update') {
                const updates = Object.fromEntries(Object.entries(args).filter(([key]) => !['projectId', 'taskId'].includes(key))
                    .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
                const changed = await trx('proj_tasks').where({ id: args.taskId, project_id: args.projectId }).update(updates);
                if (changed !== 1) fail('execution_failure', 'task_update_not_applied');
                return { id: args.taskId };
            }
            if (tool.name === 'projects.create') {
                const [id] = await trx('proj_projects').insert({ org_id: scope.orgId, name: args.name.trim(),
                    location: args.location?.trim() || null, project_code: args.project_code?.trim() || null,
                    start_date: args.start_date || null, end_date: args.end_date || null, status: 'active' });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                await trx('proj_members').insert({ project_id: id, user_id: scope.userId, org_id: scope.orgId, project_permissions: null });
                return { id: Number(id) };
            }
            if (tool.name === 'projects.update') {
                const updates = Object.fromEntries(Object.entries(args).filter(([key]) => key !== 'projectId').map(([key, value]) => [key, value.trim()]));
                const changed = await trx('proj_projects').where({ id: args.projectId, org_id: scope.orgId }).update(updates);
                if (changed !== 1) fail('execution_failure', 'project_update_not_applied');
                return { id: args.projectId };
            }
            if (['resources.create', 'resources.update', 'resources.addConversion'].includes(tool.name)) {
                const { resourceId, projectId, ...data } = args;
                const id = tool.name === 'resources.create' ? await resources.createAgentResource(scope.orgId, data, { transaction: trx })
                    : tool.name === 'resources.update' ? await resources.updateAgentResource(scope.orgId, resourceId, data, { transaction: trx })
                    : await resources.addConversion(scope.orgId, resourceId, data, { transaction: trx });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'clients.bulkImport') {
                const { valid } = await clientImport(args, scope, trx, true);
                if (!valid.length) fail('validation_error', 'no_valid_client_rows');
                for (const data of valid) await clients.createClient(scope.orgId, data, { transaction: trx });
                return { id: valid.length, count: valid.length, outcome: 'success' };
            }
            if (['clients.create', 'clients.update', 'vendors.update', 'clients.addInteraction'].includes(tool.name)) {
                const { contactId, ...data } = args;
                let id = contactId;
                if (tool.name === 'clients.create') id = await clients.createClient(scope.orgId, data, { transaction: trx });
                else if (tool.name === 'clients.update') await clients.updateClient(scope.orgId, contactId, data, { transaction: trx });
                else if (tool.name === 'vendors.update') await vendors.updateVendor(scope.orgId, contactId, data, { transaction: trx });
                else id = await clients.createInteraction(scope.orgId, { ...data, contact_id: contactId, interacted_by: scope.userId }, { transaction: trx });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }

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
