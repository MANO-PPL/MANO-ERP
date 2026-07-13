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

    const [newId] = await db(tableName).insert(insertData);
    return newId;
}

export async function updateDraftRow(orgId, cycleId, userId, tableName, pkColumn, pkValue, data) {
    await verifyWriteAccess(orgId, cycleId, userId);

    const updated = await db(tableName)
        .where(pkColumn, pkValue)
        .where({ cycle_id: cycleId })
        .whereNull('version_id')
        .update(data);

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

    if (existing) {
        // Assume pk is the first key or known. Since we just update where cycle_id matches
        await db(tableName)
            .where({ cycle_id: cycleId })
            .whereNull('version_id')
            .update(data);
        return true;
    } else {
        const insertData = {
            ...data,
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

    const existing = await db('pdoc_meeting')
        .where({ cycle_id: cycleId, meeting_type: meetingType })
        .whereNull('version_id')
        .first();

    if (existing) {
        await db('pdoc_meeting')
            .where({ cycle_id: cycleId, meeting_type: meetingType })
            .whereNull('version_id')
            .update(dbData);
        return true;
    } else {
        const insertData = {
            ...dbData,
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

export const staff = {
    add: (orgId, cycleId, userId, data) => addDraftRow(orgId, cycleId, userId, 'pdoc_staff_responsible', data),
    update: (orgId, cycleId, userId, psrrId, data) => updateDraftRow(orgId, cycleId, userId, 'pdoc_staff_responsible', 'psrr_id', psrrId, data),
    delete: (orgId, cycleId, userId, psrrId) => deleteDraftRow(orgId, cycleId, userId, 'pdoc_staff_responsible', 'psrr_id', psrrId)
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
    update: (orgId, cycleId, userId, data) => upsertEpisodicHeader(orgId, cycleId, userId, 'pdoc_summary', data)
};

export default {
    directory,
    vendors,
    staff,
    mom,
    agenda,
    summary
};
