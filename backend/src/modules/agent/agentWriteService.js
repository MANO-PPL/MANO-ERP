import { fail, fingerprint } from './agentValidation.js';
import { validateIntent } from './agentTools.js';
import { getUploadedDataset, getUploadedAttachment, cleanupUpload } from './agentUploadService.js';
import { findOrCreateSector } from '../shared/sectorService.js';
import { findOrCreateJobNature } from '../shared/jobNatureService.js';
import { storeQualityAttachment } from '../projects/quality/qualityService.js';

const VALID_CATEGORIES = ['Contractor', 'Supplier', 'Consultant', 'Manufacturer', 'Service Provider'];
const ADMIN_NAMED_TABLES = Object.freeze({
    'adminDepartments.create': ['iam_departments', 'dept_name'],
    'adminDesignations.create': ['iam_designations', 'desg_name'],
    'adminSectors.create': ['crm_sectors', 'sector_name'],
    'adminJobNatures.create': ['crm_job_nature', 'job_name']
});
const sameName = (actual, expected) => String(actual || '').trim().toLowerCase() === expected.trim().toLowerCase();

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

export function createWriteService({ db, clients, vendors, resources, approvalService, cycles }) {
    const stagedQualityAttachment = (args, scope, imageOnly = false) => {
        const attachment = getUploadedAttachment(args.uploadId, scope.orgId);
        if (!attachment) fail('validation_error', 'staged_attachment_expired_or_not_found');
        if (!attachment.approvedForAgentWrite) fail('validation_error', 'approved_attachment_required');
        if (imageOnly && (!['jpg', 'jpeg', 'png', 'webp'].includes(attachment.extension)
            || !attachment.mimeType.toLowerCase().startsWith('image/'))) fail('validation_error', 'resolution_image_required');
        return attachment;
    };
    const fileFromAttachment = attachment => ({ buffer: attachment.buffer, originalname: attachment.filename,
        mimetype: attachment.mimeType, size: attachment.size });
    const qualityFileName = (prefix, id, attachment) => `${prefix}_${id}_${Date.now()}_${attachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const qualityDocumentTable = toolName => toolName.startsWith('qualityMethodologies.')
        ? { table: 'proj_quality_methodologies', prefix: 'methodology', folder: 'methodology' }
        : { table: 'proj_quality_checklists', prefix: 'checklist', folder: 'check_snag' };
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
            if (['adminUsers.updateProfile', 'adminUsers.setSystemPermissions'].includes(tool.name)) {
                const query = connection('iam_users').where({ id: args.userId, org_id: scope.orgId });
                if (lock) query.forUpdate();
                const user = await query.first('id', 'user_name', 'email', 'phone_no', 'user_type', 'system_permissions');
                if (!user) fail('authorization_denied');
                if (!sameName(user.user_name, args.expectedName)) fail('validation_error', 'user_name_mismatch');
                for (const [column, value] of tool.name === 'adminUsers.updateProfile'
                    ? [['email', args.email], ['phone_no', args.phone_no]] : []) {
                    if (value === undefined) continue;
                    const duplicate = connection('iam_users').where({ [column]: value.trim() }).whereNot({ id: args.userId });
                    if (lock) duplicate.forUpdate();
                    if (await duplicate.first('id')) fail('validation_error', 'duplicate_user_contact');
                }
                return { operation: tool.name, user: JSON.parse(JSON.stringify(user)) };
            }
            if (tool.name === 'projects.setMemberPermissions') {
                const query = connection('proj_members as m').join('iam_users as u', 'm.user_id', 'u.id')
                    .where({ 'm.project_id': args.projectId, 'm.user_id': args.userId, 'm.org_id': scope.orgId,
                        'u.org_id': scope.orgId });
                if (lock) query.forUpdate();
                const member = await query.first('m.user_id', 'm.project_permissions', 'u.user_name');
                if (!member) fail('authorization_denied');
                if (!sameName(member.user_name, args.expectedName)) fail('validation_error', 'member_name_mismatch');
                return { projectId: args.projectId, operation: tool.name, member: JSON.parse(JSON.stringify(member)),
                    requestedPermissions: args.permissions };
            }
            if (tool.name.startsWith('permissionTemplates.')) {
                if (tool.name === 'permissionTemplates.create') {
                    if (lock) await connection('org_organizations').where({ id: scope.orgId }).forUpdate().first('id');
                    const query = connection('iam_permission_templates').where({ org_id: scope.orgId, type: args.type })
                        .whereRaw('LOWER(??) = ?', ['name', args.name.trim().toLowerCase()]);
                    if (lock) query.forUpdate();
                    if (await query.first('id')) fail('validation_error', 'duplicate_permission_template');
                    return { operation: tool.name, name: args.name.trim(), type: args.type,
                        requestedPermissions: args.permissions };
                }
                const query = connection('iam_permission_templates').where({ id: args.templateId, org_id: scope.orgId });
                if (lock) query.forUpdate();
                const template = await query.first('id', 'name', 'type', 'permissions');
                if (!template || template.type !== args.type) fail('authorization_denied');
                if (!sameName(template.name, args.expectedName)) fail('validation_error', 'template_name_mismatch');
                if (args.name && args.name.trim().toLowerCase() !== String(template.name).trim().toLowerCase()) {
                    const duplicate = connection('iam_permission_templates').where({ org_id: scope.orgId, type: args.type })
                        .whereNot({ id: args.templateId })
                        .whereRaw('LOWER(??) = ?', ['name', args.name.trim().toLowerCase()]);
                    if (lock) duplicate.forUpdate();
                    if (await duplicate.first('id')) fail('validation_error', 'duplicate_permission_template');
                }
                return { operation: tool.name, template: JSON.parse(JSON.stringify(template)),
                    requestedPermissions: args.permissions || null };
            }
            if (ADMIN_NAMED_TABLES[tool.name]) {
                const [table, column] = ADMIN_NAMED_TABLES[tool.name];
                if (lock) await connection('org_organizations').where({ id: scope.orgId }).forUpdate().first('id');
                const query = connection(table).where({ org_id: scope.orgId })
                    .whereRaw('LOWER(??) = ?', [column, args.name.trim().toLowerCase()]);
                if (lock) query.forUpdate();
                if (await query.first('id')) fail('validation_error', 'duplicate_admin_name');
                return { operation: tool.name, name: args.name.trim(), organizationId: scope.orgId };
            }
            if (tool.name === 'documents.archiveInstance') {
                const query = connection('wf_document_instances as di')
                    .join('wf_documents as d', 'di.document_id', 'd.document_id')
                    .join('proj_projects as p', 'di.project_id', 'p.id')
                    .where({ 'di.instance_id': args.instanceId, 'di.org_id': scope.orgId, 'di.project_id': args.projectId });
                if (lock) query.forUpdate();
                const instance = await query.first('di.instance_id', 'di.instance_status', 'di.is_locked', 'di.title',
                    'd.name as templateName', 'p.name as projectName');
                if (!instance) fail('authorization_denied');
                if (instance.instance_status !== 'active' || Number(instance.is_locked) !== 0) fail('validation_error', 'document_not_archivable');
                const cycles = connection('wf_approval_cycles').where({ instance_id: args.instanceId });
                if (lock) cycles.forUpdate();
                const cycleRows = await cycles.select('cycle_id', 'status');
                if (cycleRows.some(row => !['approved', 'rejected', 'cancelled'].includes(row.status))) fail('validation_error', 'active_document_cycle');
                return { projectId: args.projectId, operation: tool.name, instance: JSON.parse(JSON.stringify(instance)),
                    cycleCount: cycleRows.length, activeCycleCount: 0 };
            }
            if (tool.name === 'documentTemplates.create') {
                if (lock) await connection('proj_projects').where({ id: args.projectId, org_id: scope.orgId }).forUpdate().first('id');
                const query = connection('wf_documents').where({ org_id: scope.orgId, project_id: args.projectId })
                    .whereRaw('LOWER(??) = ?', ['name', args.name.trim().toLowerCase()]);
                if (lock) query.forUpdate();
                if (await query.first('document_id')) fail('validation_error', 'duplicate_document_template');
                return { projectId: args.projectId, operation: tool.name, name: args.name.trim(), docType: args.docType };
            }
            if (tool.name === 'documentTemplates.update') {
                const query = connection('wf_documents').where({ document_id: args.documentId,
                    org_id: scope.orgId, project_id: args.projectId });
                if (lock) query.forUpdate();
                const template = await query.first('document_id', 'name', 'doc_type', 'description', 'is_active');
                if (!template) fail('authorization_denied');
                if (!sameName(template.name, args.expectedName)) fail('validation_error', 'document_template_name_mismatch');
                return { projectId: args.projectId, operation: tool.name, template: JSON.parse(JSON.stringify(template)) };
            }
            if (tool.name === 'tasks.deleteSelected') {
                const taskQuery = connection('proj_tasks as t').leftJoin('proj_task_categories as c', 't.category_id', 'c.id')
                    .join('proj_projects as p', 't.project_id', 'p.id')
                    .where('t.project_id', args.projectId).whereIn('t.id', args.taskIds);
                if (lock) taskQuery.forUpdate();
                const tasks = await taskQuery.select('t.id', 't.name', 't.task_code', 't.status', 't.priority', 't.category_id',
                    't.description', 't.start_date', 't.due_date', 't.sort_order', 't.updated_at', 'c.name as categoryName', 'p.name as projectName');
                if (tasks.length !== args.taskIds.length) fail('authorization_denied', 'task_delete_target_out_of_scope');
                if (tasks.some(task => ['in_review', 'pending_approval', 'review'].includes(String(task.status || '').toLowerCase()))) {
                    fail('validation_error', 'task_pending_approval_cannot_be_deleted');
                }
                const assigneeQuery = connection('proj_task_assignees as a')
                    .leftJoin('iam_users as u', 'a.user_id', 'u.id').whereIn('a.task_id', args.taskIds);
                if (lock) assigneeQuery.forUpdate();
                const assignees = await assigneeQuery.select('a.task_id', 'a.user_id', 'u.user_name');
                return { projectId: args.projectId, operation: tool.name,
                    tasks: JSON.parse(JSON.stringify(tasks)), assignees: JSON.parse(JSON.stringify(assignees)),
                    assigneeLinksRemoved: assignees.length, pendingApprovals: 0 };
            }
            if (tool.name === 'projectParties.add') {
                const contactQuery = connection('crm_contacts').where({ id: args.contactId, org_id: scope.orgId });
                if (lock) contactQuery.forUpdate();
                const contact = await contactQuery.first('id', 'name', 'category');
                if (!contact) fail('authorization_denied');
                const linkedQuery = connection('proj_parties').where({ project_id: args.projectId, contact_id: args.contactId });
                if (lock) linkedQuery.forUpdate();
                if (await linkedQuery.first('id')) fail('validation_error', 'project_party_already_linked');
                return { projectId: args.projectId, contact: JSON.parse(JSON.stringify(contact)) };
            }
            if (tool.name === 'projectParties.update') {
                const partyQuery = connection('proj_parties').where({ id: args.projectPartyId, project_id: args.projectId });
                if (lock) partyQuery.forUpdate();
                const party = await partyQuery.first('id', 'contact_id');
                if (!party) fail('authorization_denied');
                const contactQuery = connection('crm_contacts').where({ id: party.contact_id, org_id: scope.orgId });
                if (lock) contactQuery.forUpdate();
                const contact = await contactQuery.first('id', 'name', 'category');
                if (!contact) fail('authorization_denied');
                return { projectId: args.projectId, projectPartyId: args.projectPartyId, contact: JSON.parse(JSON.stringify(contact)) };
            }
            if (tool.name === 'projects.assignMember') {
                const userQuery = connection('iam_users').where({ id: args.userId, org_id: scope.orgId });
                if (lock) userQuery.forUpdate();
                if (!await userQuery.first('id')) fail('validation_error', 'project_member_not_in_organization');
                const memberQuery = connection('proj_members').where({ project_id: args.projectId, user_id: args.userId, org_id: scope.orgId });
                if (lock) memberQuery.forUpdate();
                if (await memberQuery.first('project_id')) fail('validation_error', 'project_member_already_assigned');
                return { projectId: args.projectId, userId: args.userId, restricted: true };
            }
            if (['tasks.assign', 'tasks.updateCategory', 'tasks.reorder'].includes(tool.name)) {
                const taskId = args.taskId;
                let task = null;
                if (taskId) {
                    const taskQuery = connection('proj_tasks').where({ id: taskId, project_id: args.projectId });
                    if (lock) taskQuery.forUpdate();
                    task = await taskQuery.first('id', 'name');
                    if (!task) fail('authorization_denied');
                }
                if (tool.name === 'tasks.updateCategory') {
                    const categoryQuery = connection('proj_task_categories').where({ id: args.categoryId, project_id: args.projectId });
                    if (lock) categoryQuery.forUpdate();
                    if (!await categoryQuery.first('id')) fail('authorization_denied');
                }
                if (tool.name === 'tasks.assign') {
                    const membersQuery = connection('proj_members as pm').join('iam_users as u', 'pm.user_id', 'u.id')
                        .where({ 'pm.project_id': args.projectId, 'pm.org_id': scope.orgId })
                        .whereIn('pm.user_id', args.assigneeIds);
                    if (lock) membersQuery.forUpdate();
                    const members = await membersQuery.select('pm.user_id as id', 'u.user_name as name');
                    if (members.length !== args.assigneeIds.length) fail('validation_error', 'assignee_not_project_member');
                    return { projectId: args.projectId, operation: tool.name, task: JSON.parse(JSON.stringify(task)),
                        members: JSON.parse(JSON.stringify(members)) };
                }
                if (tool.name === 'tasks.reorder') {
                    const table = args.type === 'task' ? 'proj_tasks' : 'proj_task_categories';
                    const query = connection(table).where({ project_id: args.projectId }).whereIn('id', args.items.map(item => item.id));
                    if (lock) query.forUpdate();
                    if ((await query.select('id')).length !== args.items.length) fail('validation_error', 'reorder_item_out_of_scope');
                }
                return { projectId: args.projectId, operation: tool.name };
            }
            if (tool.name === 'tasks.createCategory') {
                const duplicate = connection('proj_task_categories').where({ project_id: args.projectId }).whereRaw('LOWER(??) = ?', ['name', args.name.trim().toLowerCase()]);
                if (lock) duplicate.forUpdate();
                if (await duplicate.first('id')) fail('validation_error', 'duplicate_task_category');
                return { projectId: args.projectId, name: args.name.trim() };
            }
            if (['documents.requestRevision', 'documents.cancelCycle', 'documents.claimRevision'].includes(tool.name)) {
                const cycleQuery = connection('wf_approval_cycles as ac')
                    .join('wf_document_instances as di', 'ac.instance_id', 'di.instance_id')
                    .join('wf_documents as d', 'di.document_id', 'd.document_id')
                    .join('proj_projects as p', 'di.project_id', 'p.id')
                    .leftJoin('iam_users as holder', 'ac.current_holder_id', 'holder.id')
                    .leftJoin('iam_users as initiator', 'ac.initiated_by', 'initiator.id')
                    .where({ 'ac.cycle_id': args.cycleId, 'di.org_id': scope.orgId, 'di.project_id': args.projectId });
                if (lock) cycleQuery.forUpdate();
                const cycle = await cycleQuery.first('ac.cycle_id', 'ac.instance_id', 'ac.status', 'ac.current_level',
                    'ac.current_holder_id', 'ac.initiated_by', 'ac.version_number', 'di.is_locked', 'd.title as documentName',
                    'p.name as projectName', 'holder.user_name as holderName', 'initiator.user_name as initiatorName');
                if (!cycle) fail('authorization_denied');
                if (tool.name === 'documents.requestRevision'
                    && (cycle.status !== 'in_review' || Number(cycle.current_holder_id) !== Number(scope.userId))) {
                    fail('validation_error', 'document_cycle_not_revision_requestable');
                }
                if (tool.name === 'documents.claimRevision'
                    && (cycle.status !== 'revision_requested' || Number(cycle.initiated_by) !== Number(scope.userId))) {
                    fail('authorization_denied');
                }
                if (tool.name === 'documents.cancelCycle'
                    && (['approved', 'rejected', 'cancelled'].includes(String(cycle.status).toLowerCase())
                        || (Number(cycle.initiated_by) !== Number(scope.userId) && scope.userType !== 'admin'))) {
                    fail('authorization_denied');
                }
                return { projectId: args.projectId, cycleId: args.cycleId, operation: tool.name,
                    status: cycle.status, currentLevel: cycle.current_level, currentHolderId: cycle.current_holder_id,
                    initiatedBy: cycle.initiated_by, versionNumber: cycle.version_number, isLocked: cycle.is_locked,
                    documentName: cycle.documentName || 'Document', projectName: cycle.projectName || 'Project',
                    holderName: cycle.holderName || null, initiatorName: cycle.initiatorName || null,
                    comments: args.comments || null };
            }
            if (['meetings.create', 'meetings.update'].includes(tool.name)) {
                if (tool.name === 'meetings.update') {
                    const query = connection('proj_meetings').where({ id: args.meetingId, project_id: args.projectId });
                    if (lock) query.forUpdate();
                    if (!await query.first('id')) fail('authorization_denied');
                }
                return { projectId: args.projectId, operation: tool.name };
            }
            if (['directory.create', 'directory.update'].includes(tool.name)) {
                if (args.partyId) {
                    const party = connection('proj_parties').where({ id: args.partyId, project_id: args.projectId });
                    if (lock) party.forUpdate();
                    if (!await party.first('id')) fail('authorization_denied');
                }
                if (tool.name === 'directory.update') {
                    const query = connection('proj_directory').where({ id: args.directoryId, project_id: args.projectId });
                    if (lock) query.forUpdate();
                    if (!await query.first('id')) fail('authorization_denied');
                }
                return { projectId: args.projectId, operation: tool.name };
            }
            if (['summaries.create', 'summaries.update'].includes(tool.name)) {
                if (tool.name === 'summaries.update') {
                    const query = connection('proj_summary').where({ id: args.summaryId, project_id: args.projectId });
                    if (lock) query.forUpdate();
                    if (!await query.first('id')) fail('authorization_denied');
                }
                return { projectId: args.projectId, operation: tool.name };
            }
            if (['documents.saveDraft', 'documents.submitDraft', 'documents.requestRevision', 'documents.cancelCycle', 'documents.claimRevision'].includes(tool.name)) {
                const cycleQuery = connection('wf_approval_cycles as ac')
                    .join('wf_document_instances as di', 'ac.instance_id', 'di.instance_id')
                    .where({ 'ac.cycle_id': args.cycleId, 'di.org_id': scope.orgId, 'di.project_id': args.projectId });
                if (lock) cycleQuery.forUpdate();
                const cycle = await cycleQuery.first('ac.cycle_id', 'ac.instance_id', 'ac.current_holder_id', 'ac.current_level', 'ac.initiated_by', 'ac.status', 'di.document_id');
                if (!cycle) fail('authorization_denied');
                if (Number(cycle.current_holder_id) !== Number(scope.userId)) fail('authorization_denied');
                if (tool.name === 'documents.saveDraft' && !['drafting', 'revision_requested', 'in_review'].includes(cycle.status)) fail('validation_error', 'document_cycle_not_draftable');
                if (tool.name === 'documents.submitDraft') {
                    if (['approved', 'rejected', 'cancelled'].includes(cycle.status)) fail('validation_error', 'document_cycle_closed');
                    if (Number(cycle.current_level) === 0 && Number(cycle.initiated_by) !== Number(scope.userId)) fail('authorization_denied');
                    const documentQuery = connection('wf_documents').where({ document_id: cycle.document_id });
                    if (lock) documentQuery.forUpdate();
                    const document = await documentQuery.first('requires_approval');
                    // Avoid a hidden auto-approval/publish side effect. The regular
                    // approval operation handles configured approval decisions.
                    if (!document || Number(document.requires_approval) !== 1) fail('validation_error', 'document_auto_approval_restricted');
                }
                return { projectId: args.projectId, cycleId: args.cycleId, operation: tool.name };
            }
            if (tool.name.startsWith('qualityObservations.')) {
                if (tool.name !== 'qualityObservations.create') {
                    const query = connection('proj_qaqc_observations').where({ id: args.observationId, project_id: args.projectId });
                    if (lock) query.forUpdate();
                    const observation = await query.first('id', 'status', 'reported_by');
                    if (!observation) fail('authorization_denied');
                    if (String(observation.status).toUpperCase() !== 'PENDING') fail('validation_error', 'observation_not_pending');
                    if (tool.name === 'qualityObservations.update' && Number(observation.reported_by) !== Number(scope.userId)) fail('authorization_denied');
                    if (tool.name === 'qualityObservations.submitFix') stagedQualityAttachment(args, scope, true);
                }
                return { projectId: args.projectId, operation: tool.name };
            }
            if (tool.name.startsWith('qualityMethodologies.') || tool.name.startsWith('qualityChecklists.')) {
                const spec = qualityDocumentTable(tool.name);
                if (tool.name.endsWith('.update')) {
                    const query = connection(spec.table).where({ id: args.documentId, project_id: args.projectId });
                    if (lock) query.forUpdate();
                    if (!await query.first('id')) fail('authorization_denied');
                }
                if (args.uploadId) stagedQualityAttachment(args, scope);
                return { projectId: args.projectId, operation: tool.name };
            }
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
            if (tool.name === 'adminUsers.setSystemPermissions') {
                const changed = await trx('iam_users').where({ id: args.userId, org_id: scope.orgId })
                    .update({ system_permissions: JSON.stringify(args.permissions) });
                if (changed !== 1) fail('request_rejected', 'user_permissions_changed');
                return { id: args.userId };
            }
            if (tool.name === 'adminUsers.updateProfile') {
                const updates = Object.fromEntries(['user_name', 'email', 'phone_no']
                    .filter(key => args[key] !== undefined).map(key => [key, args[key].trim()]));
                const changed = await trx('iam_users').where({ id: args.userId, org_id: scope.orgId }).update(updates);
                if (changed !== 1) fail('request_rejected', 'user_profile_changed');
                return { id: args.userId };
            }
            if (tool.name === 'projects.setMemberPermissions') {
                const changed = await trx('proj_members').where({ project_id: args.projectId, user_id: args.userId,
                    org_id: scope.orgId }).update({ project_permissions: JSON.stringify(args.permissions) });
                if (changed !== 1) fail('request_rejected', 'project_member_changed');
                return { id: args.userId };
            }
            if (tool.name === 'permissionTemplates.create') {
                const [id] = await trx('iam_permission_templates').insert({ org_id: scope.orgId, name: args.name.trim(),
                    type: args.type, permissions: JSON.stringify(args.permissions) });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'permissionTemplates.update') {
                const updates = {};
                if (args.name !== undefined) updates.name = args.name.trim();
                if (args.permissions !== undefined) updates.permissions = JSON.stringify(args.permissions);
                const changed = await trx('iam_permission_templates').where({ id: args.templateId,
                    org_id: scope.orgId, type: args.type }).update(updates);
                if (changed !== 1) fail('request_rejected', 'permission_template_changed');
                return { id: args.templateId };
            }
            if (ADMIN_NAMED_TABLES[tool.name]) {
                const [table, column] = ADMIN_NAMED_TABLES[tool.name];
                const [id] = await trx(table).insert({ org_id: scope.orgId, [column]: args.name.trim() });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'documents.archiveInstance') {
                const changed = await trx('wf_document_instances').where({ instance_id: args.instanceId,
                    org_id: scope.orgId, project_id: args.projectId, instance_status: 'active', is_locked: 0 })
                    .update({ instance_status: 'archived' });
                if (changed !== 1) fail('request_rejected', 'document_instance_changed');
                return { id: args.instanceId, status: 'archived' };
            }
            if (tool.name === 'documentTemplates.create') {
                const [id] = await trx('wf_documents').insert({ org_id: scope.orgId, project_id: args.projectId,
                    name: args.name.trim(), doc_type: args.docType, description: args.description?.trim() || null,
                    created_by: scope.userId });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'documentTemplates.update') {
                const updates = Object.fromEntries(['name', 'description'].filter(key => args[key] !== undefined)
                    .map(key => [key, args[key].trim()]));
                if (!Object.keys(updates).length) fail('validation_error', 'empty_document_template_update');
                const changed = await trx('wf_documents').where({ document_id: args.documentId,
                    org_id: scope.orgId, project_id: args.projectId }).update(updates);
                if (changed !== 1) fail('request_rejected', 'document_template_changed');
                return { id: args.documentId };
            }
            if (tool.name === 'tasks.deleteSelected') {
                const taskIds = [...args.taskIds].sort((a, b) => a - b);
                const removedAssignees = await trx('proj_task_assignees').whereIn('task_id', taskIds).del();
                const removedTasks = await trx('proj_tasks').where({ project_id: args.projectId }).whereIn('id', taskIds).del();
                if (removedTasks !== taskIds.length) fail('request_rejected', 'task_delete_target_changed');
                return { id: args.projectId, deletedCount: removedTasks, assigneeLinksRemoved: removedAssignees };
            }
            if (tool.name === 'projectParties.add') {
                const [id] = await trx('proj_parties').insert({ project_id: args.projectId, contact_id: args.contactId });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'projectParties.update') {
                const party = await trx('proj_parties').where({ id: args.projectPartyId, project_id: args.projectId }).first('contact_id');
                if (!party) fail('request_rejected', 'project_party_changed');
                const updates = Object.fromEntries(Object.entries(args)
                    .filter(([key]) => !['projectId', 'projectPartyId'].includes(key))
                    .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
                updates.updated_at = trx.fn.now();
                const changed = await trx('crm_contacts').where({ id: party.contact_id, org_id: scope.orgId }).update(updates);
                if (changed !== 1) fail('execution_failure', 'project_party_update_not_applied');
                return { id: args.projectPartyId };
            }
            if (tool.name === 'projects.assignMember') {
                const [id] = await trx('proj_members').insert({ project_id: args.projectId, user_id: args.userId,
                    org_id: scope.orgId, project_permissions: null });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'tasks.assign') {
                await trx('proj_task_assignees').where({ task_id: args.taskId }).del();
                if (args.assigneeIds.length) await trx('proj_task_assignees').insert(args.assigneeIds.map(user_id => ({ task_id: args.taskId, user_id: String(user_id) })));
                return { id: args.taskId };
            }
            if (tool.name === 'tasks.createCategory') {
                const last = await trx('proj_task_categories').where({ project_id: args.projectId }).orderBy('sort_order', 'desc').first('sort_order');
                const [id] = await trx('proj_task_categories').insert({ project_id: args.projectId, name: args.name.trim(), sort_order: last ? Number(last.sort_order) + 10 : 10 });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'tasks.updateCategory') {
                const changed = await trx('proj_task_categories').where({ id: args.categoryId, project_id: args.projectId }).update({ name: args.name.trim(), updated_at: trx.fn.now() });
                if (changed !== 1) fail('execution_failure', 'task_category_update_not_applied');
                return { id: args.categoryId };
            }
            if (tool.name === 'tasks.reorder') {
                const table = args.type === 'task' ? 'proj_tasks' : 'proj_task_categories';
                for (const item of args.items) {
                    const changed = await trx(table).where({ id: item.id, project_id: args.projectId }).update({ sort_order: item.sortOrder });
                    if (changed !== 1) fail('execution_failure', 'task_reorder_not_applied');
                }
                return { id: args.projectId };
            }
            if (tool.name === 'meetings.create') {
                const last = await trx('proj_meetings').where({ project_id: args.projectId }).max('meeting_no as maxNo').first();
                const content = JSON.stringify({ time: args.time || '', status: args.status || 'scheduled', agenda_points: (args.agendaPoints || []).map((point, index) => ({ sl_no: index + 1, point })), mom_points: (args.momPoints || []).map((point, index) => ({ sl_no: index + 1, point })), attendance: {} });
                const [id] = await trx('proj_meetings').insert({ project_id: args.projectId, meeting_no: Number(last?.maxNo || 0) + 1, subject: args.subject.trim(), venue: args.venue?.trim() || '', date: args.date || new Date().toISOString().slice(0, 10), status: args.status || 'scheduled', content });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'meetings.update') {
                const current = await trx('proj_meetings').where({ id: args.meetingId, project_id: args.projectId }).first('content');
                if (!current) fail('request_rejected', 'meeting_changed');
                let content = {}; try { content = typeof current.content === 'string' ? JSON.parse(current.content) : (current.content || {}); } catch { content = {}; }
                if (args.time !== undefined) content.time = args.time;
                if (args.agendaPoints !== undefined) content.agenda_points = args.agendaPoints.map((point, index) => ({ sl_no: index + 1, point }));
                if (args.momPoints !== undefined) content.mom_points = args.momPoints.map((point, index) => ({ sl_no: index + 1, point }));
                const updates = Object.fromEntries(Object.entries(args).filter(([key]) => !['projectId', 'meetingId', 'time', 'agendaPoints', 'momPoints'].includes(key)).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
                updates.content = JSON.stringify(content);
                const changed = await trx('proj_meetings').where({ id: args.meetingId, project_id: args.projectId }).update(updates);
                if (changed !== 1) fail('execution_failure', 'meeting_update_not_applied');
                return { id: args.meetingId };
            }
            if (tool.name === 'directory.create') {
                const { projectId, partyId, ...data } = args;
                const [id] = await trx('proj_directory').insert({ project_id: projectId, party_id: partyId || null, ...data, created_at: trx.fn.now(), updated_at: trx.fn.now() });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'directory.update') {
                const updates = Object.fromEntries(Object.entries(args).filter(([key]) => !['projectId', 'directoryId'].includes(key)).map(([key, value]) => [key === 'partyId' ? 'party_id' : key, typeof value === 'string' ? value.trim() : value]));
                updates.updated_at = trx.fn.now();
                const changed = await trx('proj_directory').where({ id: args.directoryId, project_id: args.projectId }).update(updates);
                if (changed !== 1) fail('execution_failure', 'directory_update_not_applied');
                return { id: args.directoryId };
            }
            if (tool.name === 'summaries.create') {
                const [id] = await trx('proj_summary').insert({ project_id: args.projectId, title: args.title.trim(), details: args.details.trim(), status: args.status || 'pending', date: args.date || new Date().toISOString().slice(0, 10) });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'summaries.update') {
                const updates = Object.fromEntries(Object.entries(args).filter(([key]) => !['projectId', 'summaryId'].includes(key)).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
                const changed = await trx('proj_summary').where({ id: args.summaryId, project_id: args.projectId }).update(updates);
                if (changed !== 1) fail('execution_failure', 'summary_update_not_applied');
                return { id: args.summaryId };
            }
            if (tool.name === 'documents.saveDraft') {
                const cycle = await trx('wf_approval_cycles as ac').join('wf_document_instances as di', 'ac.instance_id', 'di.instance_id')
                    .where({ 'ac.cycle_id': args.cycleId, 'di.org_id': scope.orgId, 'di.project_id': args.projectId })
                    .first('ac.cycle_id', 'ac.current_holder_id', 'ac.current_level', 'ac.status');
                if (!cycle || Number(cycle.current_holder_id) !== Number(scope.userId)
                    || !['drafting', 'revision_requested', 'in_review'].includes(cycle.status)) fail('request_rejected', 'document_cycle_changed');
                const now = new Date();
                const changed = await trx('wf_approval_cycles').where({ cycle_id: args.cycleId }).update({ draft_content: JSON.stringify(args.content), last_draft_saved: now });
                if (changed !== 1) fail('execution_failure', 'document_draft_not_saved');
                const lastLog = await trx('wf_approval_logs').where({ cycle_id: args.cycleId, action: 'draft_saved' }).orderBy('acted_at', 'desc').first('acted_at');
                if (!lastLog || now - new Date(lastLog.acted_at) > 60000) {
                    await trx('wf_approval_logs').insert({ cycle_id: args.cycleId, action: 'draft_saved', level_order: cycle.current_level, acted_by: scope.userId });
                }
                return { id: args.cycleId };
            }
            if (tool.name === 'documents.submitDraft') {
                const cycle = await trx('wf_approval_cycles as ac').join('wf_document_instances as di', 'ac.instance_id', 'di.instance_id')
                    .where({ 'ac.cycle_id': args.cycleId, 'di.org_id': scope.orgId, 'di.project_id': args.projectId })
                    .first('ac.cycle_id', 'ac.instance_id', 'ac.current_holder_id', 'ac.current_level', 'ac.initiated_by', 'ac.status', 'ac.draft_content', 'di.document_id');
                if (!cycle || Number(cycle.current_holder_id) !== Number(scope.userId) || ['approved', 'rejected', 'cancelled'].includes(cycle.status)) fail('request_rejected', 'document_cycle_changed');
                if (Number(cycle.current_level) === 0 && Number(cycle.initiated_by) !== Number(scope.userId)) fail('authorization_denied');
                const document = await trx('wf_documents').where({ document_id: cycle.document_id }).first('requires_approval');
                if (!document || Number(document.requires_approval) !== 1) fail('validation_error', 'document_auto_approval_restricted');
                const approvers = await trx('wf_document_roles as dr').join('wf_approval_levels as al', 'dr.level_id', 'al.level_id')
                    .where({ 'dr.document_id': cycle.document_id, 'dr.role': 'approver' })
                    .select('dr.id', 'dr.user_id', 'al.level_order').orderBy([{ column: 'al.level_order', order: 'asc' }, { column: 'dr.id', order: 'asc' }]);
                if (!approvers.length || new Set(approvers.map(approver => String(approver.level_order))).size !== approvers.length) fail('validation_error', 'document_approval_chain_invalid');
                const currentIndex = Number(cycle.current_level) === 0 ? -1 : approvers.findIndex(approver => Number(approver.user_id) === Number(scope.userId) && Number(approver.level_order) === Number(cycle.current_level));
                if (Number(cycle.current_level) > 0 && currentIndex < 0) fail('authorization_denied');
                const nextApprover = approvers[currentIndex + 1];
                // Finalization can invoke arbitrary configured document mappings, so
                // the agent only advances an explicit approval chain.
                if (!nextApprover) fail('validation_error', 'document_finalization_restricted');
                await trx('wf_cycle_submissions').insert({ cycle_id: args.cycleId, level_order: cycle.current_level,
                    submitted_by: scope.userId, content_snapshot: cycle.draft_content, changes_summary: args.changes_summary || null });
                const changed = await trx('wf_approval_cycles').where({ cycle_id: args.cycleId }).update({ status: 'in_review',
                    current_level: nextApprover.level_order, current_holder_id: nextApprover.user_id });
                if (changed !== 1) fail('execution_failure', 'document_submit_not_applied');
                await trx('wf_document_instances').where({ instance_id: cycle.instance_id }).update({ locked_by: nextApprover.user_id });
                await trx('wf_approval_logs').insert({ cycle_id: args.cycleId, action: 'submitted', level_order: cycle.current_level,
                    acted_by: scope.userId, comments: args.comments || null });
                return { id: args.cycleId };
            }
            if (['documents.requestRevision', 'documents.cancelCycle', 'documents.claimRevision'].includes(tool.name)) {
                if (!trx?.isTransaction || !cycles) fail('execution_failure', 'caller_transaction_required');
                let result;
                if (tool.name === 'documents.requestRevision') {
                    result = await cycles.requestRevision(scope.orgId, args.cycleId, scope.userId, args.comments, { transaction: trx });
                } else if (tool.name === 'documents.cancelCycle') {
                    result = await cycles.cancelCycle(scope.orgId, args.cycleId, scope.userId, args.comments, { transaction: trx });
                } else {
                    result = await cycles.claimRevision(scope.orgId, args.cycleId, scope.userId, { transaction: trx });
                }
                if (!result || !result.status) fail('execution_failure', 'document_cycle_action_failed');
                return { id: args.cycleId, status: result.status };
            }
            if (tool.name === 'qualityObservations.create') {
                const [id] = await trx('proj_qaqc_observations').insert({ project_id: args.projectId, location: args.location.trim(), before_note: args.note.trim(), status: 'PENDING', reported_by: scope.userId, reported_at: trx.fn.now() });
                if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                return { id: Number(id) };
            }
            if (tool.name === 'qualityObservations.update') {
                const updates = Object.fromEntries(Object.entries(args).filter(([key]) => !['projectId', 'observationId'].includes(key)).map(([key, value]) => [key === 'note' ? 'before_note' : key, value.trim()]));
                updates.updated_at = trx.fn.now();
                const changed = await trx('proj_qaqc_observations').where({ id: args.observationId, project_id: args.projectId, status: 'PENDING' }).update(updates);
                if (changed !== 1) fail('execution_failure', 'observation_update_not_applied');
                return { id: args.observationId };
            }
            if (tool.name === 'qualityObservations.submitFix') {
                const attachment = stagedQualityAttachment(args, scope, true);
                const folder = `projects/org_${scope.orgId}/proj_${args.projectId}/qaqc`;
                const uploadedUrl = await storeQualityAttachment(fileFromAttachment(attachment), folder, qualityFileName(`obs_${args.observationId}_after`, args.observationId, attachment));
                if (!uploadedUrl) fail('execution_failure', 'quality_attachment_not_saved');
                const photos = JSON.stringify([{ url: uploadedUrl, label: 'Resolution View 1' }]);
                const changed = await trx('proj_qaqc_observations').where({ id: args.observationId, project_id: args.projectId, status: 'PENDING' }).update({
                    status: 'FIXED', after_photo_url: uploadedUrl, after_photos: photos, after_note: args.note?.trim() || null,
                    fixed_by: scope.userId, fixed_at: trx.fn.now()
                });
                if (changed !== 1) fail('execution_failure', 'observation_fix_not_applied');
                cleanupUpload(args.uploadId);
                return { id: args.observationId };
            }
            if (tool.name.startsWith('qualityMethodologies.') || tool.name.startsWith('qualityChecklists.')) {
                const spec = qualityDocumentTable(tool.name);
                if (tool.name.endsWith('.create')) {
                    const attachment = stagedQualityAttachment(args, scope);
                    const [id] = await trx(spec.table).insert({ project_id: args.projectId, title: args.title.trim(), file_url: 'pending_upload',
                        file_type: attachment.filename.split('.').pop()?.toUpperCase() || null, file_size: attachment.size,
                        uploaded_by: scope.userId, uploaded_at: trx.fn.now() });
                    if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
                    const url = await storeQualityAttachment(fileFromAttachment(attachment), `projects/org_${scope.orgId}/proj_${args.projectId}/${spec.folder}`,
                        qualityFileName(spec.prefix, id, attachment));
                    if (!url) fail('execution_failure', 'quality_attachment_not_saved');
                    const changed = await trx(spec.table).where({ id, project_id: args.projectId }).update({ file_url: url });
                    if (changed !== 1) fail('execution_failure', 'quality_document_not_saved');
                    cleanupUpload(args.uploadId);
                    return { id: Number(id) };
                }
                const updates = {};
                if (args.title !== undefined) updates.title = args.title.trim();
                if (args.uploadId !== undefined) {
                    const attachment = stagedQualityAttachment(args, scope);
                    const url = await storeQualityAttachment(fileFromAttachment(attachment), `projects/org_${scope.orgId}/proj_${args.projectId}/${spec.folder}`,
                        qualityFileName(spec.prefix, args.documentId, attachment));
                    if (!url) fail('execution_failure', 'quality_attachment_not_saved');
                    updates.file_url = url;
                    updates.file_type = attachment.filename.split('.').pop()?.toUpperCase() || null;
                    updates.file_size = attachment.size;
                    updates.uploaded_by = scope.userId;
                    updates.uploaded_at = trx.fn.now();
                }
                const changed = await trx(spec.table).where({ id: args.documentId, project_id: args.projectId }).update(updates);
                if (changed !== 1) fail('execution_failure', 'quality_document_update_not_applied');
                if (args.uploadId) cleanupUpload(args.uploadId);
                return { id: args.documentId };
            }
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
