import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { isAdmin } from '../../utils/userUtils.js';

const CONTENT_TABLES = [
    { name: 'wf_document_lines', pk: 'line_id' },
    { name: 'pdoc_directory', pk: 'pd_id' },
    { name: 'pdoc_vendors', pk: 'pv_id' },
    { name: 'pdoc_staff_responsible', pk: 'psrr_id' },
    { name: 'pdoc_summary', pk: 'id' },
    {
        name: 'pdoc_meeting',
        pk: 'meeting_id',
        children: [{ name: 'pdoc_meeting_participants', fk: 'meeting_id', pk: 'id' }]
    }
];


// Enrich pdoc_vendors rows with details from crm_contacts
async function enrichVendorRows(rows) {
    if (!rows || rows.length === 0) return rows;
    const vendorIds = rows.map(r => r.vendors_id).filter(Boolean);
    if (vendorIds.length === 0) return [];

    const contacts = await db('crm_contacts as c')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.job_id')
        .whereIn('c.id', vendorIds)
        .where(function () {
            this.whereNull('c.category')
                .orWhereRaw('LOWER(??) NOT IN (?, ?)', ['c.category', 'client', 'pmc']);
        })
        .select('c.id', 'c.name', 'c.contact_person', 'c.mobile', 'c.email', 'jn.job_name as job_nature');

    const contactMap = {};
    for (const c of contacts) contactMap[c.id] = c;

    return rows
        .filter(row => contactMap[row.vendors_id])
        .map(row => ({
            ...row,
            name: contactMap[row.vendors_id].name || null,
            contact_person: contactMap[row.vendors_id].contact_person || null,
            mobile: contactMap[row.vendors_id].mobile || null,
            email: contactMap[row.vendors_id].email || null,
            job_nature: contactMap[row.vendors_id].job_nature || null
        }));
}

async function verifyAccess(orgId, instanceId, userId) {
    const instance = await db('wf_document_instances')
        .where({ instance_id: instanceId, org_id: orgId })
        .first();

    if (!instance) throw new AppError('Document instance not found', 404);

    // 1. Allow if user is an admin
    const user = await db('iam_users').where({ user_id: userId }).first();
    const isUserAdmin = isAdmin(user);
    if (isUserAdmin) {
        return instance;
    }

    // 2. Allow if user is an assigned workflow participant (approver/reporter)
    const role = await db('wf_document_roles')
        .where({ document_id: instance.document_id, user_id: userId })
        .whereIn('role', ['approver', 'reporter'])
        .first();
    if (role) {
        return instance;
    }

    // 3. Allow if user is assigned to the project and has 'General Documents' read/write permission
    const member = await db('proj_members')
        .where({ project_id: instance.project_id, user_id: userId, org_id: orgId })
        .first();
    if (member) {
        let projectPerms = member.project_permissions;
        if (typeof projectPerms === 'string') {
            try { projectPerms = JSON.parse(projectPerms); } catch (e) { projectPerms = {}; }
        }
        const generalDocsLvl = projectPerms?.['General Documents'] || 'none';
        const hasReadAccess = ['view', 'edit', 'read', 'write'].includes(generalDocsLvl.toLowerCase());
        if (hasReadAccess) {
            return instance;
        }
    }

    throw new AppError('Unauthorized: You do not have access to read this document', 403);
}

export async function getApprovedContent(orgId, instanceId, userId, versionIdParam) {
    const instance = await verifyAccess(orgId, instanceId, userId);

    let targetVersionId = versionIdParam;
    if (!targetVersionId) {
        targetVersionId = instance.latest_approved_version_id;
    }

    if (!targetVersionId) {
        return {
            metadata: null,
            content: {},
            message: 'Document has not been approved yet.'
        };
    }

    const versionMeta = await db('wf_document_versions as document_versions')
        .select('document_versions.*', 'users.user_name as final_approved_by_name')
        .leftJoin('iam_users as users', 'document_versions.final_approved_by', 'users.user_id')
        .where('document_versions.version_id', targetVersionId)
        .first();

    if (!versionMeta) throw new AppError('Version not found', 404);

    const contentData = {};

    for (const tableConf of CONTENT_TABLES) {
        let rows = await db(tableConf.name).where({
            instance_id: instanceId,
            version_id: targetVersionId
        });

        if (rows.length > 0) {
            // Enrich vendor rows with details from crm_contacts
            if (tableConf.name === 'pdoc_vendors') {
                rows = await enrichVendorRows(rows);
            }
            if (tableConf.children) {
                // Fetch and attach child rows
                for (let row of rows) {
                    for (const childConf of tableConf.children) {
                        row[childConf.name] = await db(childConf.name)
                            .where(childConf.fk, row[tableConf.pk]);
                    }
                }
            }
            contentData[tableConf.name] = rows;
        }
    }

    return {
        metadata: versionMeta,
        content: contentData
    };
}

export async function getDraftContent(orgId, instanceId, userId) {
    const instance = await verifyAccess(orgId, instanceId, userId);

    const activeCycle = await db('wf_approval_cycles')
        .where({ instance_id: instanceId })
        .whereIn('status', ['drafting', 'revision_requested', 'in_review'])
        .first();

    if (!activeCycle) {
        throw new AppError('No active draft cycle exists for this instance', 404);
    }

    const contentData = {};

    for (const tableConf of CONTENT_TABLES) {
        let rows = await db(tableConf.name)
            .where({ instance_id: instanceId, cycle_id: activeCycle.cycle_id })
            .whereNull('version_id');

        if (rows.length > 0) {
            // Enrich vendor rows with details from crm_contacts
            if (tableConf.name === 'pdoc_vendors') {
                rows = await enrichVendorRows(rows);
            }
            if (tableConf.children) {
                for (let row of rows) {
                    for (const childConf of tableConf.children) {
                        row[childConf.name] = await db(childConf.name)
                            .where(childConf.fk, row[tableConf.pk]);
                    }
                }
            }
            contentData[tableConf.name] = rows;
        }
    }

    let parsedDraftContent = null;
    try {
        parsedDraftContent = activeCycle.draft_content ? JSON.parse(activeCycle.draft_content) : null;
    } catch (e) {
        parsedDraftContent = activeCycle.draft_content;
    }

    return {
        cycle_status: activeCycle.status,
        last_draft_saved: activeCycle.last_draft_saved,
        draft_content_json: parsedDraftContent,
        content_tables: contentData
    };
}

export async function listVersions(orgId, instanceId, userId) {
    await verifyAccess(orgId, instanceId, userId);

    return await db('wf_document_versions as document_versions')
        .select(
            'document_versions.version_id',
            'document_versions.version_number',
            'document_versions.approved_at',
            'users.user_name as final_approved_by_name'
        )
        .leftJoin('iam_users as users', 'document_versions.final_approved_by', 'users.user_id')
        .where('document_versions.instance_id', instanceId)
        .orderBy('document_versions.version_number', 'desc');
}

export default {
    getApprovedContent,
    getDraftContent,
    listVersions
};
