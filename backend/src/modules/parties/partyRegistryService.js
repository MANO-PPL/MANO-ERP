import db from '../../config/database.js';
import { PartyRegistryError, PartyRegistryErrorCodes } from './partyRegistryErrors.js';

/**
 * Single exported constant defining categories considered suppliers by default.
 * Exact comparison is enforced.
 */
export const SUPPLIER_CATEGORIES = ['Supplier'];

export function parsePartyOverrides(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return { ...raw };
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Only category and job_nature can be overridden per project.
 */
export function buildProjectOverrides(existingRaw, incoming = {}, master = {}) {
    const next = parsePartyOverrides(existingRaw);

    if (incoming.category !== undefined) {
        const val = incoming.category ? String(incoming.category).trim() : null;
        if (!val || (master.category && val.toLowerCase() === String(master.category).trim().toLowerCase())) {
            delete next.category;
        } else {
            next.category = val;
        }
    }

    if (incoming.job_nature !== undefined) {
        const val = incoming.job_nature ? String(incoming.job_nature).trim() : null;
        if (!val || (master.job_nature && val.toLowerCase() === String(master.job_nature).trim().toLowerCase())) {
            delete next.job_nature;
        } else {
            next.job_nature = val;
        }
    }

    return Object.keys(next).length > 0 ? next : null;
}

/**
 * Computes and persists project-level category/job_nature overrides on a proj_parties row.
 */
export async function saveProjectOverrides(connection, projPartyRow, incoming = {}, master = {}) {
    const nextOverrides = buildProjectOverrides(projPartyRow.overrides, incoming, master);
    await connection('proj_parties')
        .where({ id: projPartyRow.id })
        .update({ overrides: nextOverrides ? JSON.stringify(nextOverrides) : null });
    return nextOverrides;
}

export function applyPartyOverrides(row) {
    const ov = parsePartyOverrides(row.overrides);
    return {
        ...row,
        category: ov.category || row.category,
        job_nature: ov.job_nature || row.job_nature,
        overrides: Object.keys(ov).length > 0 ? ov : null
    };
}

/**
 * Computes supplier status from category and project overrides.
 */
export function computePartySupplierStatus(category, overridesOrFlag) {
    if (overridesOrFlag !== null && typeof overridesOrFlag === 'object') {
        const hasCatOverride = Boolean(overridesOrFlag.category);
        const effectiveCategory = hasCatOverride ? overridesOrFlag.category : category;
        return {
            isSupplier: SUPPLIER_CATEGORIES.includes(effectiveCategory),
            supplierSource: hasCatOverride ? 'override' : 'category'
        };
    }
    const hasOverride = overridesOrFlag !== null && overridesOrFlag !== undefined;
    const isSupplier = hasOverride
        ? Boolean(overridesOrFlag)
        : SUPPLIER_CATEGORIES.includes(category);
    const supplierSource = hasOverride ? 'override' : 'category';
    return { isSupplier, supplierSource };
}

/**
 * Fetches a single project party with supplier classification.
 * Scoped to orgId via proj_projects and crm_contacts.
 * Returns stable PARTY_NOT_FOUND for missing or foreign-org parties.
 */
export async function getParty(orgId, pvId, connection = db) {
    const numericOrgId = Number(orgId);
    const numericPvId = Number(pvId);
    if (!numericOrgId || isNaN(numericOrgId) || !numericPvId || isNaN(numericPvId)) {
        throw new PartyRegistryError(
            PartyRegistryErrorCodes.PARTY_NOT_FOUND,
            `Party ${pvId} not found`
        );
    }

    const row = await connection('proj_parties as pp')
        .join('proj_projects as p', 'pp.project_id', 'p.id')
        .join('crm_contacts as c', 'pp.contact_id', 'c.id')
        .where('pp.id', numericPvId)
        .where('p.org_id', numericOrgId)
        .where('c.org_id', numericOrgId)
        .select(
            'pp.id as pvId',
            'pp.project_id as projectId',
            'pp.contact_id as contactId',
            'pp.overrides as overrides',
            'c.name as name',
            'c.category as category'
        )
        .first();

    if (!row) {
        throw new PartyRegistryError(
            PartyRegistryErrorCodes.PARTY_NOT_FOUND,
            `Party ${pvId} not found`
        );
    }

    return formatRegistryParty(row);
}

function formatRegistryParty(row) {
    const overrides = parsePartyOverrides(row.overrides);
    const { isSupplier, supplierSource } = computePartySupplierStatus(row.category, overrides);

    return {
        pvId: Number(row.pvId),
        projectId: Number(row.projectId),
        contactId: Number(row.contactId),
        name: row.name,
        category: overrides.category || row.category,
        overrides: Object.keys(overrides).length > 0 ? overrides : null,
        isSupplier,
        supplierSource,
    };
}

/**
 * Validates an array of party IDs for a project in a single call.
 * Returns Map<pvId, partyObject>.
 * Throws an error listing every ID that is missing or in another project.
 */
export async function getPartiesByIds(orgId, projectId, pvIds, connection = db) {
    const numericOrgId = Number(orgId);
    const numericProjectId = Number(projectId);
    if (!numericOrgId || isNaN(numericOrgId) || !numericProjectId || isNaN(numericProjectId)) {
        throw new PartyRegistryError(
            PartyRegistryErrorCodes.PARTY_INVALID_VALUE,
            'Valid orgId and projectId are required'
        );
    }

    if (!Array.isArray(pvIds)) {
        throw new PartyRegistryError(
            PartyRegistryErrorCodes.PARTY_INVALID_VALUE,
            'pvIds must be an array'
        );
    }

    if (pvIds.length === 0) {
        return new Map();
    }

    const distinctIds = [...new Set(pvIds.map(Number))];
    const invalidFormatIds = distinctIds.filter(id => isNaN(id) || id <= 0);
    if (invalidFormatIds.length > 0) {
        throw new PartyRegistryError(
            PartyRegistryErrorCodes.PARTY_INVALID_VALUE,
            `Invalid party ID format: [${invalidFormatIds.join(', ')}]`
        );
    }

    // Verify project exists within caller organization
    const project = await connection('proj_projects')
        .where({ id: numericProjectId, org_id: numericOrgId })
        .first('id');
    if (!project) {
        throw new PartyRegistryError(
            PartyRegistryErrorCodes.PARTY_NOT_FOUND,
            `Project ${projectId} not found`
        );
    }

    // Query parties matching requested IDs within caller org
    const rows = await connection('proj_parties as pp')
        .join('proj_projects as p', 'pp.project_id', 'p.id')
        .join('crm_contacts as c', 'pp.contact_id', 'c.id')
        .whereIn('pp.id', distinctIds)
        .where('p.org_id', numericOrgId)
        .where('c.org_id', numericOrgId)
        .select(
            'pp.id as pvId',
            'pp.project_id as projectId',
            'pp.contact_id as contactId',
            'pp.overrides as overrides',
            'c.name as name',
            'c.category as category'
        );

    const foundMap = new Map();
    for (const row of rows) {
        foundMap.set(Number(row.pvId), row);
    }

    const missingIds = [];
    const wrongProjectIds = [];

    for (const id of distinctIds) {
        if (!foundMap.has(id)) {
            missingIds.push(id);
        } else {
            const row = foundMap.get(id);
            if (Number(row.projectId) !== numericProjectId) {
                wrongProjectIds.push(id);
            }
        }
    }

    if (missingIds.length > 0 || wrongProjectIds.length > 0) {
        const issues = [];
        if (missingIds.length > 0) {
            issues.push(`missing [${missingIds.join(', ')}]`);
        }
        if (wrongProjectIds.length > 0) {
            issues.push(`wrong project [${wrongProjectIds.join(', ')}]`);
        }
        const code = wrongProjectIds.length > 0
            ? PartyRegistryErrorCodes.PARTY_NOT_IN_PROJECT
            : PartyRegistryErrorCodes.PARTY_NOT_FOUND;

        throw new PartyRegistryError(
            code,
            `Party validation failed for project ${projectId}: ${issues.join('; ')}`,
            { missingIds, wrongProjectIds, invalidIds: [...missingIds, ...wrongProjectIds] }
        );
    }

    const resultMap = new Map();
    for (const id of distinctIds) {
        const row = foundMap.get(id);
        const overrides = parsePartyOverrides(row.overrides);
        const { isSupplier, supplierSource } = computePartySupplierStatus(row.category, overrides);
        resultMap.set(id, {
            pvId: Number(row.pvId),
            projectId: Number(row.projectId),
            contactId: Number(row.contactId),
            name: row.name,
            category: overrides.category || row.category,
            overrides: Object.keys(overrides).length > 0 ? overrides : null,
            isSupplier,
            supplierSource,
        });
    }

    return resultMap;
}

/**
 * Lists parties for a project with optional filters (category, isSupplier, search).
 * Enforces organization boundary via proj_projects.org_id and crm_contacts.org_id.
 */
export async function listProjectParties(orgId, projectId, filters = {}, connection = db) {
    const numericOrgId = Number(orgId);
    const numericProjectId = Number(projectId);
    if (!numericOrgId || isNaN(numericOrgId) || !numericProjectId || isNaN(numericProjectId)) {
        throw new PartyRegistryError(
            PartyRegistryErrorCodes.PARTY_NOT_FOUND,
            `Project ${projectId} not found`
        );
    }

    const project = await connection('proj_projects')
        .where({ id: numericProjectId, org_id: numericOrgId })
        .first('id');
    if (!project) {
        throw new PartyRegistryError(
            PartyRegistryErrorCodes.PARTY_NOT_FOUND,
            `Project ${projectId} not found`
        );
    }

    const { category, isSupplier, search } = filters || {};

    let query = connection('proj_parties as pp')
        .join('proj_projects as p', 'pp.project_id', 'p.id')
        .join('crm_contacts as c', 'pp.contact_id', 'c.id')
        .where('pp.project_id', numericProjectId)
        .where('p.org_id', numericOrgId)
        .where('c.org_id', numericOrgId)
        .select(
            'pp.id as pvId',
            'pp.project_id as projectId',
            'pp.contact_id as contactId',
            'pp.overrides as overrides',
            'c.name as name',
            'c.category as category'
        )
        .orderBy('c.name', 'asc')
        .orderBy('pp.id', 'asc');

    if (category !== undefined && category !== null && String(category).trim() !== '') {
        const cat = String(category).trim();
        query = query.whereRaw("COALESCE(JSON_UNQUOTE(JSON_EXTRACT(pp.overrides, '$.category')), c.category) = ?", [cat]);
    }

    if (search !== undefined && search !== null && String(search).trim() !== '') {
        const term = `%${String(search).trim()}%`;
        query = query.where('c.name', 'like', term);
    }

    const rows = await query;
    let parties = rows.map(formatRegistryParty);

    if (isSupplier !== undefined && isSupplier !== null) {
        const targetIsSupplier = Boolean(isSupplier);
        parties = parties.filter(p => p.isSupplier === targetIsSupplier);
    }

    return parties;
}

/**
 * Asserts that a party exists and belongs to the given project.
 * Throws PARTY_NOT_IN_PROJECT if the party exists in the org but belongs to another project.
 * Throws PARTY_NOT_FOUND if the party does not exist in the caller org.
 */
export async function assertProjectParty(orgId, pvId, projectId, connection = db) {
    const party = await getParty(orgId, pvId, connection);
    if (party.projectId !== Number(projectId)) {
        throw new PartyRegistryError(
            PartyRegistryErrorCodes.PARTY_NOT_IN_PROJECT,
            `Party ${pvId} is not in project ${projectId}`,
            { pvId: Number(pvId), expectedProjectId: Number(projectId), actualProjectId: party.projectId }
        );
    }
    return party;
}

/**
 * Returns boolean indicating whether party has unlimited supply allocation capacity.
 */
export async function isSupplier(orgId, pvId, connection = db) {
    const party = await getParty(orgId, pvId, connection);
    return party.isSupplier;
}

export async function setPartyOverrides(orgId, pvId, incoming = {}, options = {}, connection = db) {
    const numericOrgId = Number(orgId);
    const numericPvId = Number(pvId);

    const existing = await connection('proj_parties as pp')
        .join('proj_projects as p', 'pp.project_id', 'p.id')
        .join('crm_contacts as c', 'pp.contact_id', 'c.id')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.id')
        .where({ 'pp.id': numericPvId, 'p.org_id': numericOrgId, 'c.org_id': numericOrgId })
        .select('pp.overrides', 'c.category', 'jn.job_name as job_nature')
        .first();

    if (!existing) {
        throw new PartyRegistryError(
            PartyRegistryErrorCodes.PARTY_NOT_FOUND,
            `Party ${pvId} not found`
        );
    }

    const next = buildProjectOverrides(existing.overrides, incoming, {
        category: existing.category,
        job_nature: existing.job_nature
    });

    await connection('proj_parties')
        .where('id', numericPvId)
        .update({ overrides: next ? JSON.stringify(next) : null });

    return await getParty(numericOrgId, numericPvId, connection);
}

/**
 * Compatibility helper: maps boolean supplier override to category override in proj_parties.overrides JSON.
 */
export async function setSupplierOverride(orgId, pvId, value, options = {}, connection = db) {
    if (value !== true && value !== false && value !== null) {
        throw new PartyRegistryError(
            PartyRegistryErrorCodes.PARTY_INVALID_VALUE,
            `Invalid supplier override value "${value}". Must be true, false, or null.`
        );
    }

    const numericOrgId = Number(orgId);
    const numericPvId = Number(pvId);
    const current = await getParty(numericOrgId, numericPvId, connection);
    const next = parsePartyOverrides(current.overrides);

    if (value === null) {
        delete next.category;
    } else {
        next.category = value ? 'Supplier' : 'Contractor';
    }

    await connection('proj_parties')
        .where('id', numericPvId)
        .update({
            overrides: Object.keys(next).length > 0 ? JSON.stringify(next) : null
        });

    return await getParty(numericOrgId, numericPvId, connection);
}

export default {
    SUPPLIER_CATEGORIES,
    parsePartyOverrides,
    buildProjectOverrides,
    applyPartyOverrides,
    computePartySupplierStatus,
    getParty,
    getPartiesByIds,
    listProjectParties,
    assertProjectParty,
    isSupplier,
    setPartyOverrides,
    setSupplierOverride,
};
