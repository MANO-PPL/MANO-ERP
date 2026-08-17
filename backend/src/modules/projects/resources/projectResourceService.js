import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import resourceService from '../../inventory/resourceService.js';
import { getCompositionColumns } from '../../../services/compositionResolver.js';

/**
 * Compatibility adapter for the existing project resource routes.
 *
 * Project scope is now represented by a copied res_resources row. This file
 * deliberately contains no project_id reads/writes against res_rates or
 * res_compositions; those tables only reference the scoped resource id.
 */
export async function initializeProjectResourceSchema() {
    return resourceService.initializeResourceSchema();
}

async function ensureProject(orgId, projectId, dbClient = db) {
    const project = await dbClient('proj_projects')
        .where({ id: projectId, org_id: orgId })
        .first('id');
    if (!project) throw new AppError('Project not found in your organization', 404);
    return project;
}

async function findProjectCopy(orgId, projectId, resourceId, dbClient = db) {
    await ensureProject(orgId, projectId, dbClient);
    const copy = await dbClient('res_resources')
        .where({ org_id: orgId, project_id: projectId })
        .andWhere(function () {
            this.where('id', resourceId).orWhere('parent_id', resourceId);
        })
        .first();
    if (!copy) throw new AppError('Resource is not imported into this project', 404);
    return copy;
}

export async function getResolvedRate(orgId, projectId, resourceId, asOfDate) {
    await ensureProject(orgId, projectId);
    return resourceService.getResolvedRate(orgId, resourceId, asOfDate, projectId);
}

export async function getResolvedRates(orgId, projectId, resourceIds, asOfDate) {
    await ensureProject(orgId, projectId);
    return resourceService.getResolvedRates(orgId, resourceIds, asOfDate, projectId);
}

export async function addRate(orgId, projectId, resourceId, rateData = {}) {
    await ensureProject(orgId, projectId);
    return resourceService.addRate(orgId, resourceId, { ...rateData, project_id: projectId });
}

export async function getRateHistory(orgId, projectId, resourceId) {
    await ensureProject(orgId, projectId);
    return resourceService.getRateHistory(orgId, resourceId, projectId);
}

export async function listProjectResources(orgId, projectId) {
    await ensureProject(orgId, projectId);

    return db('res_resources')
        .where({ org_id: orgId, project_id: projectId })
        .select(
            'id as project_resource_id',
            'parent_id as resource_id',
            'id',
            'parent_id',
            'name',
            'code',
            'type',
            'base_unit_code',
            'description',
            'remarks',
            'project_id'
        )
        .orderBy('name');
}

export async function removeProjectResource(orgId, projectId, resourceId) {
    const copy = await findProjectCopy(orgId, projectId, resourceId);
    const compositionColumns = await getCompositionColumns(db);

    const usedAsComponent = await db('res_compositions')
        .where(compositionColumns.component, copy.id)
        .count('id as count')
        .first();
    if (Number(usedAsComponent?.count || 0) > 0) {
        throw new AppError('Cannot remove this project resource because it is used in another project composition', 400);
    }

    await db.transaction(async trx => {
        await trx('res_compositions').where(compositionColumns.item, copy.id).del();
        await trx('res_rates').where('resource_id', copy.id).del();
        await trx('res_conversions').where('resource_id', copy.id).del();
        await trx('res_resources').where({ id: copy.id, org_id: orgId, project_id: projectId }).del();
    });
    return true;
}

export async function clearRate(orgId, projectId, resourceId, effectiveFrom) {
    await ensureProject(orgId, projectId);
    return resourceService.clearManualRate(orgId, resourceId, effectiveFrom, projectId);
}

export async function importResourceToProject(orgId, projectId, resourceId, effectiveFrom) {
    return resourceService.importItemToProject(orgId, projectId, resourceId, effectiveFrom);
}

export async function importBatchResourcesToProject(orgId, projectId, resourceIds, effectiveFrom) {
    await ensureProject(orgId, projectId);
    const results = [];
    for (const resId of resourceIds) {
        try {
            const res = await resourceService.importItemToProject(orgId, projectId, resId, effectiveFrom);
            results.push({ resourceId: resId, status: 'fulfilled', result: res });
        } catch (err) {
            results.push({ resourceId: resId, status: 'rejected', reason: err.message });
        }
    }
    return results;
}

export async function setCompositions(orgId, projectId, resourceId, compositions, effectiveFrom) {
    await ensureProject(orgId, projectId);
    return resourceService.setCompositions(orgId, resourceId, compositions, effectiveFrom, projectId);
}

export async function getCompositionHistory(orgId, projectId, resourceId) {
    await ensureProject(orgId, projectId);
    return resourceService.getCompositionHistory(orgId, resourceId, projectId);
}

export default {
    initializeProjectResourceSchema,
    getResolvedRate,
    getResolvedRates,
    addRate,
    getRateHistory,
    listProjectResources,
    removeProjectResource,
    clearRate,
    importResourceToProject,
    importBatchResourcesToProject,
    setCompositions,
    getCompositionHistory
};
