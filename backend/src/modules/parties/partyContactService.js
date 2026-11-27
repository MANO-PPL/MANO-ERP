import db from '../../config/database.js';
import AppError from '../../utils/AppError.js';

const pick = (obj, keys) => keys.reduce((acc, k) => {
    if (obj[k] !== undefined) acc[k] = obj[k];
    return acc;
}, {});

async function assertScopedParty(connection, orgId, partyId) {
    const party = await connection('crm_contacts').where({ id: partyId, org_id: orgId }).first();
    if (!party) throw new AppError('Party not found', 404);
    return party;
}

async function writeAudit(connection, { orgId, entityId, action, beforeData = null, afterData = null, reason = null, userId = null }) {
    if (!(await connection.schema.hasTable('crm_change_log'))) return;
    await connection('crm_change_log').insert({
        org_id: orgId,
        entity_id: entityId,
        action,
        before_data: beforeData ? JSON.stringify(beforeData) : null,
        after_data: afterData ? JSON.stringify(afterData) : null,
        reason: reason || null,
        user_id: userId || null,
        at: connection.fn.now()
    });
}

/**
 * Sync the active primary POC (or next active POC) back to parent crm_contacts cache fields.
 */
export async function syncPrimaryToParent(connection, orgId, partyId) {
    let primary = await connection('crm_contact_persons')
        .where({ contact_id: partyId, status: 'active', is_primary: 1 })
        .orderBy('id', 'asc')
        .first();

    if (!primary) {
        const nextActive = await connection('crm_contact_persons')
            .where({ contact_id: partyId, status: 'active' })
            .orderBy('id', 'asc')
            .first();
        if (nextActive) {
            await connection('crm_contact_persons')
                .where({ id: nextActive.id, contact_id: partyId })
                .update({ is_primary: 1, updated_at: connection.fn.now() });
            primary = { ...nextActive, is_primary: 1 };
        }
    }

    await connection('crm_contacts')
        .where({ id: partyId, org_id: orgId })
        .update({
            contact_person: primary?.name || null,
            designation: primary?.designation || null,
            telephone_no: primary?.telephone_no || null,
            mobile: primary?.mobile || null,
            email: primary?.email || null,
            updated_at: connection.fn.now()
        });

    return primary || null;
}

export async function listContactPersons(orgId, partyId, connection = db) {
    await assertScopedParty(connection, orgId, partyId);
    return connection('crm_contact_persons')
        .where({ contact_id: partyId, status: 'active' })
        .orderBy('is_primary', 'desc')
        .orderBy('id', 'asc');
}

export async function getContactSummariesByPartyIds(orgId, partyIds, connection = db) {
    if (!Array.isArray(partyIds) || partyIds.length === 0) return {};
    const rows = await connection('crm_contact_persons as cp')
        .join('crm_contacts as c', 'cp.contact_id', 'c.id')
        .where({ 'c.org_id': orgId, 'cp.status': 'active' })
        .whereIn('cp.contact_id', partyIds)
        .orderBy('cp.is_primary', 'desc')
        .orderBy('cp.id', 'asc')
        .select('cp.*');

    return rows.reduce((acc, row) => {
        if (!acc[row.contact_id]) {
            acc[row.contact_id] = { count: 0, primary: row };
        }
        acc[row.contact_id].count += 1;
        return acc;
    }, {});
}

export function overlayPrimaryContact(party, primary) {
    const contactPerson = primary ? primary.name : party.contact_person;
    const designation = primary ? primary.designation : party.designation;
    const telephoneNo = primary ? primary.telephone_no : party.telephone_no;
    const mobile = primary ? primary.mobile : party.mobile;
    const email = primary ? primary.email : party.email;
    const phone = telephoneNo || mobile || null;

    return {
        ...party,
        contact_person: contactPerson || null,
        designation: designation || null,
        telephone_no: phone,
        contact_no: phone,
        telephone: telephoneNo || null,
        mobile: mobile || null,
        email: email || null
    };
}

export async function getContactCountsByPartyIds(orgId, partyIds, connection = db) {
    const summaries = await getContactSummariesByPartyIds(orgId, partyIds, connection);
    return Object.fromEntries(Object.entries(summaries).map(([id, s]) => [id, s.count]));
}

export async function addContactPerson(orgId, partyId, data, options = {}) {
    const name = String(data.name || '').trim();
    if (!name) throw new AppError('Contact person name is required', 400);

    const run = async (trx) => {
        await assertScopedParty(trx, orgId, partyId);

        const existingCountRow = await trx('crm_contact_persons')
            .where({ contact_id: partyId, status: 'active' })
            .count('* as total')
            .first();
        const isFirst = Number(existingCountRow?.total || 0) === 0;
        const makePrimary = isFirst || Boolean(data.is_primary);

        if (makePrimary) {
            await trx('crm_contact_persons')
                .where({ contact_id: partyId })
                .update({ is_primary: 0 });
        }

        const [newId] = await trx('crm_contact_persons').insert({
            contact_id: partyId,
            name,
            designation: data.designation || null,
            department: data.department || null,
            telephone_no: data.telephone_no ?? data.contact_no ?? null,
            mobile: data.mobile || null,
            email: data.email || null,
            is_primary: makePrimary ? 1 : 0,
            status: 'active',
            created_by: options.userId || null,
            updated_by: options.userId || null
        });

        const created = await trx('crm_contact_persons').where({ id: newId, contact_id: partyId }).first();
        if (makePrimary) {
            await syncPrimaryToParent(trx, orgId, partyId);
        }

        if (!options.skipAuditLog) {
            await writeAudit(trx, {
                orgId,
                entityId: partyId,
                action: 'contact_add',
                afterData: pick(created, ['id', 'name', 'designation', 'telephone_no', 'mobile', 'email', 'is_primary']),
                userId: options.userId
            });
        }

        return created;
    };

    return options.transaction ? run(options.transaction) : db.transaction(run);
}

/**
 * Updates an existing contact person by ID or active name match, otherwise creates a new one.
 */
export async function upsertContactPerson(orgId, partyId, personId, data, options = {}) {
    const run = async (trx) => {
        const numericId = personId && !String(personId).startsWith('temp_') ? Number(personId) : null;
        if (numericId && !isNaN(numericId)) {
            const exists = await trx('crm_contact_persons').where({ id: numericId, contact_id: partyId }).first();
            if (exists) {
                return updateContactPerson(
                    orgId,
                    partyId,
                    numericId,
                    { ...data, name: data.name || exists.name },
                    { ...options, transaction: trx }
                );
            }
        }

        const targetName = String(data.name || '').trim();
        if (targetName) {
            const existingByName = await trx('crm_contact_persons')
                .where({ contact_id: partyId, status: 'active' })
                .whereRaw('LOWER(TRIM(name)) = ?', [targetName.toLowerCase()])
                .first();

            if (existingByName) {
                return updateContactPerson(
                    orgId,
                    partyId,
                    existingByName.id,
                    {
                        name: targetName,
                        designation: data.designation ?? existingByName.designation,
                        department: data.department ?? existingByName.department,
                        mobile: data.mobile ?? existingByName.mobile,
                        email: data.email ?? existingByName.email
                    },
                    { ...options, transaction: trx }
                );
            }
        }

        return addContactPerson(orgId, partyId, data, { ...options, transaction: trx });
    };

    return options.transaction ? run(options.transaction) : db.transaction(run);
}

export async function updateContactPerson(orgId, partyId, personId, data, options = {}) {
    const run = async (trx) => {
        await assertScopedParty(trx, orgId, partyId);
        const existing = await trx('crm_contact_persons')
            .where({ id: personId, contact_id: partyId })
            .first();
        if (!existing) throw new AppError('Contact person not found', 404);

        const makePrimary = data.is_primary === true || data.is_primary === 1;
        if (makePrimary) {
            await trx('crm_contact_persons')
                .where({ contact_id: partyId })
                .whereNot({ id: personId })
                .update({ is_primary: 0 });
        }

        const updateData = { updated_at: trx.fn.now() };
        if (data.name !== undefined) {
            const trimmed = String(data.name).trim();
            if (!trimmed) throw new AppError('Contact person name is required', 400);
            updateData.name = trimmed;
        }
        if (data.designation !== undefined) updateData.designation = data.designation || null;
        if (data.department !== undefined) updateData.department = data.department || null;
        if (data.telephone_no !== undefined) updateData.telephone_no = data.telephone_no || null;
        else if (data.contact_no !== undefined) updateData.telephone_no = data.contact_no || null;
        if (data.mobile !== undefined) updateData.mobile = data.mobile || null;
        if (data.email !== undefined) updateData.email = data.email || null;
        if (data.is_primary !== undefined) updateData.is_primary = makePrimary ? 1 : 0;
        if (options.userId) updateData.updated_by = options.userId;

        await trx('crm_contact_persons')
            .where({ id: personId, contact_id: partyId })
            .update(updateData);

        const updated = await trx('crm_contact_persons').where({ id: personId, contact_id: partyId }).first();
        if (updated.is_primary || existing.is_primary) {
            await syncPrimaryToParent(trx, orgId, partyId);
        }

        if (!options.skipAuditLog) {
            await writeAudit(trx, {
                orgId,
                entityId: partyId,
                action: 'contact_update',
                beforeData: pick(existing, ['name', 'designation', 'telephone_no', 'mobile', 'email', 'is_primary']),
                afterData: pick(updated, ['name', 'designation', 'telephone_no', 'mobile', 'email', 'is_primary']),
                userId: options.userId
            });
        }

        return updated;
    };

    return options.transaction ? run(options.transaction) : db.transaction(run);
}

export async function setPrimaryContactPerson(orgId, partyId, personId, options = {}) {
    const run = async (trx) => {
        await assertScopedParty(trx, orgId, partyId);
        const existing = await trx('crm_contact_persons')
            .where({ id: personId, contact_id: partyId, status: 'active' })
            .first();
        if (!existing) throw new AppError('Contact person not found', 404);

        await trx('crm_contact_persons')
            .where({ contact_id: partyId })
            .update({ is_primary: 0 });
        await trx('crm_contact_persons')
            .where({ id: personId, contact_id: partyId })
            .update({ is_primary: 1, updated_by: options.userId || null, updated_at: trx.fn.now() });

        await syncPrimaryToParent(trx, orgId, partyId);
        const updated = await trx('crm_contact_persons').where({ id: personId, contact_id: partyId }).first();

        if (!options.skipAuditLog) {
            await writeAudit(trx, {
                orgId,
                entityId: partyId,
                action: 'contact_primary',
                afterData: { id: updated.id, name: updated.name },
                userId: options.userId
            });
        }

        return updated;
    };

    return options.transaction ? run(options.transaction) : db.transaction(run);
}

export async function deleteContactPerson(orgId, partyId, personId, options = {}) {
    const run = async (trx) => {
        await assertScopedParty(trx, orgId, partyId);
        const existing = await trx('crm_contact_persons')
            .where({ id: personId, contact_id: partyId })
            .first();
        if (!existing) throw new AppError('Contact person not found', 404);

        await trx('crm_contact_persons')
            .where({ id: personId, contact_id: partyId })
            .del();

        if (existing.is_primary) {
            await syncPrimaryToParent(trx, orgId, partyId);
        }

        if (!options.skipAuditLog) {
            await writeAudit(trx, {
                orgId,
                entityId: partyId,
                action: 'contact_delete',
                beforeData: pick(existing, ['id', 'name', 'designation', 'telephone_no', 'mobile', 'email', 'is_primary']),
                reason: options.reason || null,
                userId: options.userId
            });
        }

        return { deleted: true };
    };

    return options.transaction ? run(options.transaction) : db.transaction(run);
}

/**
 * Sync contact persons from createParty / updateParty payloads (either array or flat fields).
 */
export async function syncFromPartyPayload(connection, orgId, partyId, data, options = {}) {
    if (Array.isArray(data.contact_persons)) {
        const cleaned = data.contact_persons
            .map((cp) => ({
                id: cp.id && !String(cp.id).startsWith('temp_') ? Number(cp.id) : null,
                name: String(cp.name || '').trim(),
                designation: cp.designation || null,
                department: cp.department || null,
                telephone_no: cp.telephone_no ?? cp.contact_no ?? null,
                mobile: cp.mobile || null,
                email: cp.email || null,
                is_primary: Boolean(cp.is_primary)
            }))
            .filter((cp) => cp.name);

        if (cleaned.length === 0) {
            await connection('crm_contact_persons').where({ contact_id: partyId }).del();
            await syncPrimaryToParent(connection, orgId, partyId);
            return;
        }

        const primaryIdx = Math.max(0, cleaned.findIndex((cp) => cp.is_primary));
        await connection('crm_contact_persons').where({ contact_id: partyId }).del();

        await connection('crm_contact_persons').insert(
            cleaned.map((cp, idx) => ({
                contact_id: partyId,
                name: cp.name,
                designation: cp.designation,
                department: cp.department,
                telephone_no: cp.telephone_no,
                mobile: cp.mobile,
                email: cp.email,
                is_primary: idx === primaryIdx ? 1 : 0,
                status: 'active',
                created_by: options.userId || null,
                updated_by: options.userId || null
            }))
        );

        await syncPrimaryToParent(connection, orgId, partyId);
        return;
    }

    const flatKeys = ['contact_person', 'designation', 'telephone_no', 'contact_no', 'mobile', 'email'];
    if (!flatKeys.some((k) => data[k] !== undefined)) return;

    const primary = await connection('crm_contact_persons')
        .where({ contact_id: partyId, status: 'active' })
        .orderBy('is_primary', 'desc')
        .orderBy('id', 'asc')
        .first();

    const resolvedPhone = data.telephone_no !== undefined ? data.telephone_no : data.contact_no;

    if (primary) {
        const updateData = { updated_at: connection.fn.now() };
        if (data.contact_person !== undefined) updateData.name = String(data.contact_person || '').trim() || primary.name;
        if (data.designation !== undefined) updateData.designation = data.designation || null;
        if (resolvedPhone !== undefined) updateData.telephone_no = resolvedPhone || null;
        if (data.mobile !== undefined) updateData.mobile = data.mobile || null;
        if (data.email !== undefined) updateData.email = data.email || null;
        if (options.userId) updateData.updated_by = options.userId;

        await connection('crm_contact_persons')
            .where({ id: primary.id, contact_id: partyId })
            .update(updateData);
        return;
    }

    const hasAnyValue = Boolean(
        String(data.contact_person || '').trim() ||
        resolvedPhone ||
        data.mobile ||
        data.email
    );
    if (!hasAnyValue) return;

    await connection('crm_contact_persons').insert({
        contact_id: partyId,
        name: String(data.contact_person || '').trim() || String(options.partyName || data.name || 'Primary Contact').trim(),
        designation: data.designation || null,
        telephone_no: resolvedPhone || null,
        mobile: data.mobile || null,
        email: data.email || null,
        is_primary: 1,
        status: 'active',
        created_by: options.userId || null,
        updated_by: options.userId || null
    });
}

export default {
    syncPrimaryToParent,
    listContactPersons,
    getContactSummariesByPartyIds,
    getContactCountsByPartyIds,
    overlayPrimaryContact,
    addContactPerson,
    upsertContactPerson,
    updateContactPerson,
    setPrimaryContactPerson,
    deleteContactPerson,
    syncFromPartyPayload
};
