import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import {
    getAvailableContactCandidates,
    linkContactsToProject
} from '../../clients/clientService.js';
import { findOrCreateJobNature } from '../../shared/jobNatureService.js';

// Project parties are stored in pdoc_parties and resolved from CRM contacts.

const FIELD_MAP = {
    name: 'c.name',
    category: 'c.category',
    location: 'c.address',
    email: 'c.email',
    contact_person: 'c.contact_person',
    mobile: 'c.mobile',
    website: 'c.website',
    job_nature: 'jn.job_name',
    address: 'c.address',
    telephone_no: 'c.telephone_no',
};

/**
 * Create the direct project-party table on installations that still have only
 * the legacy approval-backed pdoc_vendors table. The legacy table is kept for
 * the other document workflows; Project Parties uses this table exclusively.
 */
export async function initializeProjectPartiesSchema() {
    if (await db.schema.hasTable('pdoc_parties')) {
        const hasPartyId = await db.schema.hasColumn('pdoc_parties', 'party_id');
        const hasLegacyPartyColumn = await db.schema.hasColumn('pdoc_parties', 'vendors_id');
        if (!hasPartyId && hasLegacyPartyColumn) {
            await db.schema.alterTable('pdoc_parties', (table) => {
                table.renameColumn('vendors_id', 'party_id');
            });
            console.log('Renamed pdoc_parties.vendors_id to pdoc_parties.party_id');
        }
        return;
    }

    const [hasProjects, hasContacts] = await Promise.all([
        db.schema.hasTable('proj_projects'),
        db.schema.hasTable('crm_contacts'),
    ]);
    if (!hasProjects || !hasContacts) return;

    await db.schema.createTable('pdoc_parties', (table) => {
        table.increments('pv_id').primary();
        table.integer('project_id').unsigned().notNullable();
        table.integer('party_id').unsigned().notNullable();
        table.timestamp('created_at').nullable().defaultTo(db.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(db.fn.now());
        table.timestamp('deleted_at').nullable();

        table.index('project_id', 'fk_pp_project');
        table.index('party_id', 'fk_pp_party');
        table.unique(['project_id', 'party_id'], 'uq_pdoc_parties_project_party');
        table.foreign('project_id', 'fk_pp_project_ref')
            .references('id')
            .inTable('proj_projects')
            .onDelete('CASCADE');
        table.foreign('party_id', 'fk_pp_party_ref')
            .references('id')
            .inTable('crm_contacts')
            .onDelete('RESTRICT');
    });

    // Preserve existing direct project-party IDs because pdoc_directory rows
    // already reference the legacy pv_id values.
    if (await db.schema.hasTable('pdoc_vendors')) {
        await db.raw(`
            INSERT INTO pdoc_parties
                (pv_id, project_id, party_id, created_at, updated_at, deleted_at)
            SELECT pv.pv_id, pv.project_id, pv.vendors_id,
                   pv.created_at, pv.updated_at, pv.deleted_at
            FROM pdoc_vendors pv
            INNER JOIN crm_contacts c ON c.id = pv.vendors_id
            WHERE pv.instance_id IS NULL
              AND pv.cycle_id IS NULL
              AND pv.version_id IS NULL
              AND pv.deleted_at IS NULL
        `);
    }

    console.log('Created table: pdoc_parties');
}

/* -------------------------------------------------------
   FETCH PROJECT PARTIES
-------------------------------------------------------- */
export async function getProjectParties(projectId, fields, orgId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    if (orgId) {
        const project = await db('proj_projects').where({ id: projectId, org_id: orgId }).first();
        if (!project) throw new AppError('Project not found', 404);
    }

    const BASE_FIELDS = [
        'pp.pv_id as pv_id',
        'pp.party_id as party_id',
        'c.category as category',
    ];

    let selectedFields = [...BASE_FIELDS];

    if (fields) {
        const requestedFields = fields.split(',').map(f => f.trim());
        const dynamicFields = requestedFields
            .filter(f => FIELD_MAP[f] && f !== 'category')
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

    const parties = await db('pdoc_parties as pp')
        // A project-party link without a live CRM contact is not renderable.
        // Exclude orphaned links instead of returning rows full of nulls.
        .join('crm_contacts as c', 'pp.party_id', 'c.id')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.job_id')
        .where('pp.project_id', projectId)
        .whereNull('pp.deleted_at')
        .select(selectedFields)
        .orderBy('c.name', 'asc');

    return { parties, count: parties.length };
}

/* -------------------------------------------------------
   FETCH AVAILABLE CRM PARTIES FOR A PROJECT
-------------------------------------------------------- */
export async function getAvailableProjectParties(projectId, orgId, query = {}) {
    if (!projectId) throw new AppError('projectId is required', 400);

    // Keep this legacy picker endpoint limited to contacts that can still be
    // newly linked. The scope-aware endpoint is exposed as /available-contacts.
    return getAvailableContactCandidates(orgId, projectId, query);
}

/* -------------------------------------------------------
   ADD PARTIES TO PROJECT (bulk)
-------------------------------------------------------- */
export async function addPartiesToProject(projectId, partyIds, orgId) {
    const linked = await linkContactsToProject(orgId, projectId, partyIds);
    return linked.map(item => item.project_party_id);
}

/* -------------------------------------------------------
   DELETE PARTIES FROM PROJECT (bulk by pp_ids)
-------------------------------------------------------- */
export async function removePartiesFromProject(projectId, ppIds) {
    const existing = await db('pdoc_parties')
        .where('project_id', projectId)
        .whereIn('pv_id', ppIds);

    if (existing.length === 0) {
        throw new AppError('No matching project parties found', 404);
    }

    const existingPvIds = existing.map(e => e.pv_id);
    const notFound = ppIds.filter(id => !existingPvIds.includes(id));

    const deletedCount = await db('pdoc_parties')
        .where('project_id', projectId)
        .whereIn('pv_id', ppIds)
        .del();

    return { deletedCount, deletedPvIds: existingPvIds, notFoundPvIds: notFound };
}

export default {
    getProjectParties,
    getAvailableProjectParties,
    addPartiesToProject,
    removePartiesFromProject,
};
