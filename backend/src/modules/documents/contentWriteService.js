import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

// Centralized helper to assert that the caller is the current_holder_id and cycle is active
async function verifyWriteAccess(orgId, cycleId, userId) {
    const cycle = await db('wf_approval_cycles as approval_cycles')
        .join('wf_document_instances as document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
        .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
        .select('approval_cycles.*', 'document_instances.project_id')
        .first();

    if (!cycle) throw new AppError('Cycle not found', 404);

    if (cycle.current_holder_id !== userId) {
        throw new AppError('Only the current holder can modify content', 403);
    }

    if (!['drafting', 'revision_requested', 'in_review'].includes(cycle.status)) {
        throw new AppError('Cycle is not active for editing', 400);
    }

    return cycle;
}

// Map of allowed columns per table to filter out frontend-supplied UI helper properties before database operations
const ALLOWED_COLUMNS = {
    wf_document_lines: ['line_id', 'instance_id', 'cycle_id', 'version_id', 'line_type', 'sort_order', 'effective_date', 'remarks', 'metadata', 'created_at', 'updated_at'],
    pdoc_vendors: ['pv_id', 'project_id', 'instance_id', 'cycle_id', 'version_id', 'vendors_id', 'created_at', 'updated_at'],
    pdoc_directory: ['pd_id', 'project_id', 'instance_id', 'cycle_id', 'version_id', 'pv_id', 'contact_person', 'designation', 'responsibilities', 'mobile_no', 'email', 'address_line', 'created_at', 'updated_at'],
    proj_summary: ['id', 'project_id', 'instance_id', 'cycle_id', 'version_id', 'title', 'details', 'status', 'date', 'created_at', 'updated_at'],
    pdoc_meeting: ['meeting_id', 'project_id', 'instance_id', 'cycle_id', 'version_id', 'meeting_type', 'meeting_no', 'date', 'time', 'location', 'subject', 'content', 'created_at', 'updated_at'],
    pdoc_meeting_participants: ['id', 'meeting_id', 'pd_id', 'created_at', 'updated_at']
};

function filterTableColumns(tableName, data) {
    const allowed = ALLOWED_COLUMNS[tableName];
    if (!allowed) return data;
    const filtered = {};
    for (const key of Object.keys(data)) {
        if (allowed.includes(key)) {
            filtered[key] = data[key];
        }
    }
    return filtered;
}

// Generic helpers
export async function addDraftRow(orgId, cycleId, userId, tableName, data) {
    const cycle = await verifyWriteAccess(orgId, cycleId, userId);

    const insertData = {
        ...data,
        project_id: cycle.project_id,
        instance_id: cycle.instance_id,
        cycle_id: cycleId,
        version_id: null
    };

    const filteredInsert = filterTableColumns(tableName, insertData);
    const [newId] = await db(tableName).insert(filteredInsert);
    return newId;
}

export async function updateDraftRow(orgId, cycleId, userId, tableName, pkColumn, pkValue, data) {
    await verifyWriteAccess(orgId, cycleId, userId);

    const filteredUpdate = filterTableColumns(tableName, data);
    const updated = await db(tableName)
        .where(pkColumn, pkValue)
        .where({ cycle_id: cycleId })
        .whereNull('version_id')
        .update(filteredUpdate);

    if (!updated) {
        throw new AppError('Draft row not found or cannot be modified', 404);
    }
    return true;
}

export async function deleteDraftRow(orgId, cycleId, userId, tableName, pkColumn, pkValue) {
    await verifyWriteAccess(orgId, cycleId, userId);

    const deleted = await db(tableName)
        .where(pkColumn, pkValue)
        .where({ cycle_id: cycleId })
        .whereNull('version_id')
        .del();

    if (!deleted) {
        throw new AppError('Draft row not found or cannot be deleted (already approved)', 404);
    }
    return true;
}

// Upsert for episodic headers (MoM, Agenda, Summary)
export async function upsertEpisodicHeader(orgId, cycleId, userId, tableName, data) {
    const cycle = await verifyWriteAccess(orgId, cycleId, userId);

    const existing = await db(tableName)
        .where({ cycle_id: cycleId })
        .whereNull('version_id')
        .first();

    const filteredData = filterTableColumns(tableName, data);

    if (existing) {
        // Assume pk is the first key or known. Since we just update where cycle_id matches
        await db(tableName)
            .where({ cycle_id: cycleId })
            .whereNull('version_id')
            .update(filteredData);
        return true;
    } else {
        const insertData = {
            ...filteredData,
            project_id: cycle.project_id,
            instance_id: cycle.instance_id,
            cycle_id: cycleId,
            version_id: null
        };
        await db(tableName).insert(insertData);
        return true;
    }
}

// Upsert for episodic meeting headers (combining MoM and Agenda)
export async function upsertEpisodicMeetingHeader(orgId, cycleId, userId, meetingType, data) {
    const cycle = await verifyWriteAccess(orgId, cycleId, userId);

    const { participants, content, ...rest } = data;
    if (rest.meeting_no !== undefined) {
        const parsedNo = parseInt(rest.meeting_no, 10);
        rest.meeting_no = isNaN(parsedNo) ? null : parsedNo;
    }

    const dbData = {
        ...rest,
        content: content ? (typeof content === 'string' ? content : JSON.stringify(content)) : null
    };

    if (!(await db.schema.hasTable('pdoc_meeting'))) return true;

    const existing = await db('pdoc_meeting')
        .where({ cycle_id: cycleId, meeting_type: meetingType })
        .whereNull('version_id')
        .first();

    const filteredData = filterTableColumns('pdoc_meeting', dbData);

    if (existing) {
        await db('pdoc_meeting')
            .where({ cycle_id: cycleId, meeting_type: meetingType })
            .whereNull('version_id')
            .update(filteredData);
        return true;
    } else {
        const insertData = {
            ...filteredData,
            project_id: cycle.project_id,
            meeting_type: meetingType,
            instance_id: cycle.instance_id,
            cycle_id: cycleId,
            version_id: null
        };
        await db('pdoc_meeting').insert(insertData);
        return true;
    }
}

// Specific Table Handlers for clarity (optional but helps matching the routes explicitly)
export const directory = {
    add: (orgId, cycleId, userId, data) => addDraftRow(orgId, cycleId, userId, 'pdoc_directory', data),
    update: (orgId, cycleId, userId, pdId, data) => updateDraftRow(orgId, cycleId, userId, 'pdoc_directory', 'pd_id', pdId, data),
    delete: (orgId, cycleId, userId, pdId) => deleteDraftRow(orgId, cycleId, userId, 'pdoc_directory', 'pd_id', pdId)
};

export const vendors = {
    add: (orgId, cycleId, userId, data) => addDraftRow(orgId, cycleId, userId, 'pdoc_vendors', data),
    delete: (orgId, cycleId, userId, pvId) => deleteDraftRow(orgId, cycleId, userId, 'pdoc_vendors', 'pv_id', pvId)
};

export const mom = {
    updateHeader: (orgId, cycleId, userId, data) => upsertEpisodicMeetingHeader(orgId, cycleId, userId, 'mom', data),
    addParticipant: async (orgId, cycleId, userId, pdId) => {
        // We need the draft meeting_id first to link the participant
        const cycle = await verifyWriteAccess(orgId, cycleId, userId);
        const header = await db('pdoc_meeting')
            .where({ cycle_id: cycleId, meeting_type: 'mom' })
            .whereNull('version_id')
            .first();

        if (!header) throw new AppError('MoM header must be created before adding participants', 400);

        await db('pdoc_meeting_participants').insert({
            meeting_id: header.meeting_id,
            pd_id: pdId
        });
        return true;
    },
    removeParticipant: async (orgId, cycleId, userId, pmpId) => {
        await verifyWriteAccess(orgId, cycleId, userId);

        // Ensure participant belongs to a draft mom header
        const participant = await db('pdoc_meeting_participants').where({ id: pmpId }).first();
        if (!participant) throw new AppError('Participant not found', 404);

        const header = await db('pdoc_meeting').where({ meeting_id: participant.meeting_id }).first();
        if (!header || header.version_id !== null || header.cycle_id != cycleId) {
            throw new AppError('Cannot delete participant from approved MoM', 403);
        }

        await db('pdoc_meeting_participants').where({ id: pmpId }).del();
        return true;
    }
};

export const agenda = {
    updateHeader: (orgId, cycleId, userId, data) => upsertEpisodicMeetingHeader(orgId, cycleId, userId, 'agenda', data),
    addParticipant: async (orgId, cycleId, userId, pdId) => {
        const cycle = await verifyWriteAccess(orgId, cycleId, userId);
        const header = await db('pdoc_meeting')
            .where({ cycle_id: cycleId, meeting_type: 'agenda' })
            .whereNull('version_id')
            .first();

        if (!header) throw new AppError('Agenda header must be created before adding participants', 400);

        await db('pdoc_meeting_participants').insert({
            meeting_id: header.meeting_id,
            pd_id: pdId
        });
        return true;
    },
    removeParticipant: async (orgId, cycleId, userId, papId) => {
        await verifyWriteAccess(orgId, cycleId, userId);

        const participant = await db('pdoc_meeting_participants').where({ id: papId }).first();
        if (!participant) throw new AppError('Participant not found', 404);

        const header = await db('pdoc_meeting').where({ meeting_id: participant.meeting_id }).first();
        if (!header || header.version_id !== null || header.cycle_id != cycleId) {
            throw new AppError('Cannot delete participant from approved Agenda', 403);
        }

        await db('pdoc_meeting_participants').where({ id: papId }).del();
        return true;
    }
};


export const summary = {
    add: (orgId, cycleId, userId, data) => addDraftRow(orgId, cycleId, userId, 'proj_summary', data),
    update: (orgId, cycleId, userId, id, data) => updateDraftRow(orgId, cycleId, userId, 'proj_summary', 'id', id, data),
    delete: (orgId, cycleId, userId, id) => deleteDraftRow(orgId, cycleId, userId, 'proj_summary', 'id', id)
};

export const lines = {
    add: (orgId, cycleId, userId, data) => addDraftRow(orgId, cycleId, userId, 'wf_document_lines', data),
    update: (orgId, cycleId, userId, id, data) => updateDraftRow(orgId, cycleId, userId, 'wf_document_lines', 'line_id', id, data),
    delete: (orgId, cycleId, userId, id) => deleteDraftRow(orgId, cycleId, userId, 'wf_document_lines', 'line_id', id)
};

export const attachments = {
    addAttachment: async (instanceId, userId, { file_name, file_url, file_type }) => {
        if (!file_name || !file_url || !file_type) {
            throw new AppError('file_name, file_url, and file_type are required', 400);
        }
        const [id] = await db('wf_document_attachments').insert({
            instance_id: instanceId,
            file_name,
            file_url,
            file_type,
            uploaded_by: userId
        });
        return id;
    },
    removeAttachment: async (instanceId, attachmentId) => {
        const deleted = await db('wf_document_attachments')
            .where({ id: attachmentId, instance_id: instanceId })
            .del();
        if (!deleted) throw new AppError('Attachment not found', 404);
        return true;
    },
    getAttachments: async (instanceId) => {
        return await db('wf_document_attachments')
            .where({ instance_id: instanceId })
            .orderBy('created_at', 'desc');
    }
};

export default {
    directory,
    vendors,
    mom,
    agenda,
    summary,
    lines,
    attachments
};
