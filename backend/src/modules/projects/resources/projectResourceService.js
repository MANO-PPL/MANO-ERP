import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import { getUnit, convert } from '../../../services/unitRegistry.js';

const rateProjectForeignKey = 'fk_res_rates_project';
const compositionProjectForeignKey = 'fk_comp_project';

const toIsoDate = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
};

function toDateOnly(value, fallback = new Date()) {
    if (value === undefined || value === null || value === '') value = fallback;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new AppError('Invalid date. Use YYYY-MM-DD.', 400);
    return parsed.toISOString().slice(0, 10);
}

function subtractOneDay(dateOnly) {
    const date = new Date(`${dateOnly}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}

async function hasIndex(tableName, indexName) {
    const [rows] = await db.raw(
        `SELECT 1
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND INDEX_NAME = ?
         LIMIT 1`,
        [tableName, indexName]
    );
    return rows.length > 0;
}

async function getIndexColumns(tableName, indexName) {
    const [rows] = await db.raw(
        `SELECT COLUMN_NAME
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND INDEX_NAME = ?
         ORDER BY SEQ_IN_INDEX`,
        [tableName, indexName]
    );
    return rows.map(row => row.COLUMN_NAME);
}

async function getUniqueIndexes(tableName) {
    const [rows] = await db.raw('SHOW INDEX FROM ??', [tableName]);
    const indexes = new Map();
    rows.forEach(row => {
        if (Number(row.Non_unique) !== 0 || row.Key_name === 'PRIMARY') return;
        if (!indexes.has(row.Key_name)) indexes.set(row.Key_name, []);
        indexes.get(row.Key_name).push(row.Column_name);
    });
    return indexes;
}

async function hasForeignKey(tableName, constraintName) {
    const [rows] = await db.raw(
        `SELECT CONSTRAINT_NAME
         FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND CONSTRAINT_NAME = ?
           AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
        [tableName, constraintName]
    );
    return rows.length > 0;
}

async function getForeignKeyTarget(tableName, constraintName) {
    const [rows] = await db.raw(
        `SELECT REFERENCED_TABLE_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND CONSTRAINT_NAME = ?
         LIMIT 1`,
        [tableName, constraintName]
    );
    return rows[0]?.REFERENCED_TABLE_NAME || null;
}

async function dropForeignKeyIfPresent(tableName, constraintName) {
    if (await hasForeignKey(tableName, constraintName)) {
        await db.raw('ALTER TABLE ?? DROP FOREIGN KEY ??', [tableName, constraintName]);
    }
}

async function ensureProjectForeignKey(tableName, columnName, constraintName) {
    const target = await getForeignKeyTarget(tableName, constraintName);
    if (target && target !== 'proj_projects') {
        await db.raw('ALTER TABLE ?? DROP FOREIGN KEY ??', [tableName, constraintName]);
    }

    if (!(await hasForeignKey(tableName, constraintName))) {
        await db.schema.alterTable(tableName, table => {
            table.foreign(columnName, constraintName)
                .references('id')
                .inTable('proj_projects')
                .onDelete('CASCADE');
        });
    }
}

/**
 * Project-scoped schema. Rates and compositions are stored directly with
 * project_id so project membership is derived from those rows.
 */
export async function initializeProjectResourceSchema() {
    const [hasProjects, hasRates, hasCompositions] = await Promise.all([
        db.schema.hasTable('proj_projects'),
        db.schema.hasTable('res_rates'),
        db.schema.hasTable('res_compositions')
    ]);
    if (!hasProjects) return;

    if (hasRates) {
        if (!(await db.schema.hasColumn('res_rates', 'project_id'))) {
            await db.schema.alterTable('res_rates', table => table.integer('project_id').unsigned().nullable());
        }

        // Remove the earlier allocation-table FK if that version was already
        // applied in this database.
        await dropForeignKeyIfPresent('res_rates', 'fk_res_rates_project_resource');
        await ensureProjectForeignKey('res_rates', 'project_id', rateProjectForeignKey);

        if (!(await hasIndex('res_rates', 'idx_res_rates_project_effective'))) {
            await db.schema.alterTable('res_rates', table => {
                table.index(['project_id', 'resource_id', 'effective_from', 'effective_to'], 'idx_res_rates_project_effective');
            });
        }
        if (!(await hasIndex('res_rates', 'idx_res_rates_resource_effective'))) {
            await db.schema.alterTable('res_rates', table => {
                table.index(['resource_id', 'project_id', 'effective_from', 'effective_to'], 'idx_res_rates_resource_effective');
            });
        }
    }

    if (hasCompositions) {
        if (!(await db.schema.hasColumn('res_compositions', 'project_id'))) {
            await db.schema.alterTable('res_compositions', table => table.integer('project_id').unsigned().nullable());
        }
        await ensureProjectForeignKey('res_compositions', 'project_id', compositionProjectForeignKey);

        if (!(await hasIndex('res_compositions', 'idx_res_compositions_project_effective'))) {
            await db.schema.alterTable('res_compositions', table => {
                table.index(['project_id', 'parent_resource_id', 'effective_from', 'effective_to'], 'idx_res_compositions_project_effective');
            });
        }

        // The old uniqueness rule did not include project scope. Rebuild only
        // this named rule so master and project versions can coexist.
        const expectedUniqueColumns = [
            'parent_resource_id',
            'component_resource_id',
            'project_id',
            'effective_from'
        ];

        // Older installations may have used a different name for the unique
        // rule. Drop only unique composition indexes that omit project scope;
        // otherwise a master row would still block the same project version.
        const uniqueIndexes = await getUniqueIndexes('res_compositions');
        for (const [indexName, columns] of uniqueIndexes.entries()) {
            const isCompositionUniqueness = columns.includes('parent_resource_id')
                && columns.includes('component_resource_id')
                && columns.includes('effective_from')
                && !columns.includes('project_id');
            if (isCompositionUniqueness && indexName !== 'uq_composition_active') {
                await db.raw('ALTER TABLE ?? DROP INDEX ??', ['res_compositions', indexName]);
            }
        }
        if (await hasIndex('res_compositions', 'uq_composition_active')) {
            const actualColumns = await getIndexColumns('res_compositions', 'uq_composition_active');
            if (actualColumns.join('|') !== expectedUniqueColumns.join('|')) {
                await db.raw('ALTER TABLE ?? DROP INDEX ??', ['res_compositions', 'uq_composition_active']);
            }
        }
        if (!(await hasIndex('res_compositions', 'uq_composition_active'))) {
            await db.schema.alterTable('res_compositions', table => {
                table.unique(expectedUniqueColumns, 'uq_composition_active');
            });
        }
    }
}

async function ensureProjectExists(orgId, projectId, dbClient = db) {
    const project = await dbClient('proj_projects')
        .where({ id: projectId, org_id: orgId })
        .first('id', 'org_id');
    if (!project) throw new AppError('Project not found in your organization', 404);
    return project;
}

async function ensureResourceExists(orgId, resourceId, dbClient = db) {
    const resource = await dbClient('res_resources')
        .where({ id: resourceId, org_id: orgId })
        .first();
    if (!resource) throw new AppError('Resource not found in your organization', 404);
    return resource;
}

function addCompositionScope(query, projectId) {
    if (projectId === null || projectId === undefined) return query.whereNull('c.project_id');
    return query.where('c.project_id', projectId);
}

async function findEffectiveRate(orgId, resourceId, asOfDate, projectId, dbClient = db) {
    const query = dbClient('res_rates as rr')
        .join('res_resources as r', 'rr.resource_id', 'r.id')
        .where('rr.resource_id', resourceId)
        .andWhere('r.org_id', orgId)
        .whereNotNull('rr.rate')
        .andWhere('rr.effective_from', '<=', asOfDate)
        .andWhere(function () {
            this.whereNull('rr.effective_to').orWhere('rr.effective_to', '>=', asOfDate);
        });

    if (projectId === null || projectId === undefined) query.whereNull('rr.project_id');
    else query.andWhere('rr.project_id', projectId);

    return query
        .select('rr.id', 'rr.resource_id', 'rr.project_id', 'rr.rate', 'rr.unit_code', 'rr.effective_from', 'rr.effective_to', 'rr.is_active', 'rr.remarks')
        .orderBy('rr.effective_from', 'desc')
        .orderBy('rr.id', 'desc')
        .first();
}

async function resolveProjectRateInternal(orgId, projectId, resourceId, asOfDate, path = new Set(), dbClient = db) {
    const resource = await dbClient('res_resources')
        .where({ id: resourceId, org_id: orgId })
        .first();
    if (!resource) throw new AppError('Resource not found in your organization', 404);

    if (path.has(Number(resourceId))) {
        const chain = [...path, Number(resourceId)].join(' -> ');
        throw new AppError(`Circular composition detected while resolving rate: ${chain}`, 400);
    }

    // A project rate wins. If there is no project rate, the master rate wins.
    const manualRate = await findEffectiveRate(orgId, resourceId, asOfDate, projectId, dbClient)
        || await findEffectiveRate(orgId, resourceId, asOfDate, null, dbClient);

    if (manualRate) {
        const storedRate = Number(manualRate.rate);
        if (!Number.isFinite(storedRate)) throw new AppError(`Manual rate for resource "${resource.name}" is invalid`, 500);

        const rateUnit = getUnit(manualRate.unit_code);
        const resourceUnit = getUnit(resource.base_unit_code);
        if (rateUnit.type !== resourceUnit.type) {
            throw new AppError(`Manual rate unit "${manualRate.unit_code}" is incompatible with resource base unit "${resource.base_unit_code}"`, 400);
        }

        return {
            resourceId: resource.id,
            resourceName: resource.name,
            rate: storedRate,
            unitCode: manualRate.unit_code,
            source: 'manual',
            rateScope: Number(manualRate.project_id) === Number(projectId) ? 'project' : 'master',
            rateId: manualRate.id,
            projectId: manualRate.project_id,
            effectiveFrom: toIsoDate(manualRate.effective_from),
            effectiveTo: toIsoDate(manualRate.effective_to),
            isActive: Number(manualRate.is_active) === 1,
            remarks: manualRate.remarks || null
        };
    }

    if (resource.type !== 'item') {
        throw new AppError(`No effective manual rate is configured for resource "${resource.name}"`, 404);
    }

    const compositions = await addCompositionScope(dbClient('res_compositions as c'), projectId)
        .join('res_resources as component', 'c.component_resource_id', 'component.id')
        .where('c.parent_resource_id', resource.id)
        .andWhere('c.effective_from', '<=', asOfDate)
        .andWhere(function () {
            this.whereNull('c.effective_to').orWhere('c.effective_to', '>=', asOfDate);
        })
        .andWhere('component.org_id', orgId)
        .select('c.component_resource_id', 'c.quantity', 'c.unit_code', 'c.effective_from', 'c.effective_to', 'component.name as component_name');

    if (compositions.length === 0) {
        throw new AppError(`Item "${resource.name}" has not been imported into this project and has no project composition`, 400);
    }

    const nextPath = new Set(path);
    nextPath.add(Number(resourceId));
    let total = 0;
    const breakdown = [];

    for (const composition of compositions) {
        const quantity = Number(composition.quantity);
        if (!Number.isFinite(quantity) || quantity < 0) {
            throw new AppError(`Invalid composition quantity for component "${composition.component_name}"`, 400);
        }

        const componentRate = await resolveProjectRateInternal(
            orgId,
            projectId,
            composition.component_resource_id,
            asOfDate,
            nextPath,
            dbClient
        );

        let quantityInRateUnit;
        try {
            quantityInRateUnit = convert(composition.unit_code, componentRate.unitCode, quantity);
        } catch (err) {
            throw new AppError(`Cannot convert composition quantity for component "${composition.component_name}": ${err.message}`, 400);
        }

        const componentCost = quantityInRateUnit * componentRate.rate;
        total += componentCost;
        breakdown.push({
            resourceId: componentRate.resourceId,
            resourceName: componentRate.resourceName,
            quantity,
            quantityUnitCode: composition.unit_code,
            rate: componentRate.rate,
            rateUnitCode: componentRate.unitCode,
            cost: componentCost,
            source: componentRate.source,
            rateScope: componentRate.rateScope
        });
    }

    return {
        resourceId: resource.id,
        resourceName: resource.name,
        rate: total,
        unitCode: resource.base_unit_code,
        source: 'computed',
        rateScope: 'project',
        asOfDate,
        effectiveFrom: toIsoDate(compositions[0].effective_from),
        effectiveTo: toIsoDate(compositions[0].effective_to),
        breakdown
    };
}

export async function getResolvedRate(orgId, projectId, resourceId, asOfDate) {
    await ensureProjectExists(orgId, projectId);
    const [resolvedRate] = await resolveProjectRatesBatch(
        orgId,
        projectId,
        [resourceId],
        asOfDate,
        true
    );
    return resolvedRate;
}

/**
 * Resolve several project resources for one date in a single API call.
 * Individual missing rates remain nullable so one unpriced resource does not
 * prevent the rest of the project resource list from rendering.
 */
async function resolveProjectRatesBatch(orgId, projectId, resourceIds, asOfDate, throwErrors = false) {
    const effectiveDate = toDateOnly(asOfDate);
    const uniqueIds = [...new Set(resourceIds.map(Number))];

    if (uniqueIds.length === 0) return [];

    // Load the project graph and all candidate rates in batches. The previous
    // implementation resolved every item independently, repeating the same
    // resource, project-rate, master-rate, and composition queries for shared
    // components.
    const projectCompositions = await db('res_compositions as c')
        .join('res_resources as component', 'c.component_resource_id', 'component.id')
        .where('c.project_id', projectId)
        .andWhere('c.effective_from', '<=', effectiveDate)
        .andWhere(function () {
            this.whereNull('c.effective_to').orWhere('c.effective_to', '>=', effectiveDate);
        })
        .andWhere('component.org_id', orgId)
        .select(
            'c.parent_resource_id',
            'c.component_resource_id',
            'c.quantity',
            'c.unit_code',
            'c.effective_from',
            'c.effective_to',
            'component.name as component_name'
        );

    const allResourceIds = [...new Set([
        ...uniqueIds,
        ...projectCompositions.map(row => Number(row.parent_resource_id)),
        ...projectCompositions.map(row => Number(row.component_resource_id))
    ])];

    const [resources, projectRates, masterRates] = await Promise.all([
        db('res_resources')
            .where('org_id', orgId)
            .whereIn('id', allResourceIds)
            .select('id', 'name', 'type', 'base_unit_code'),
        db('res_rates as rr')
            .where('rr.project_id', projectId)
            .whereIn('rr.resource_id', allResourceIds)
            .whereNotNull('rr.rate')
            .andWhere('rr.effective_from', '<=', effectiveDate)
            .andWhere(function () {
                this.whereNull('rr.effective_to').orWhere('rr.effective_to', '>=', effectiveDate);
            })
            .select('rr.id', 'rr.resource_id', 'rr.project_id', 'rr.rate', 'rr.unit_code', 'rr.effective_from', 'rr.effective_to', 'rr.is_active', 'rr.remarks')
            .orderBy('rr.effective_from', 'desc')
            .orderBy('rr.id', 'desc'),
        db('res_rates as rr')
            .whereNull('rr.project_id')
            .whereIn('rr.resource_id', allResourceIds)
            .whereNotNull('rr.rate')
            .andWhere('rr.effective_from', '<=', effectiveDate)
            .andWhere(function () {
                this.whereNull('rr.effective_to').orWhere('rr.effective_to', '>=', effectiveDate);
            })
            .select('rr.id', 'rr.resource_id', 'rr.project_id', 'rr.rate', 'rr.unit_code', 'rr.effective_from', 'rr.effective_to', 'rr.is_active', 'rr.remarks')
            .orderBy('rr.effective_from', 'desc')
            .orderBy('rr.id', 'desc')
    ]);

    const resourceById = new Map(resources.map(resource => [Number(resource.id), resource]));
    const projectRateByResource = new Map();
    projectRates.forEach(rate => {
        const resourceId = Number(rate.resource_id);
        if (!projectRateByResource.has(resourceId)) projectRateByResource.set(resourceId, rate);
    });
    const masterRateByResource = new Map();
    masterRates.forEach(rate => {
        const resourceId = Number(rate.resource_id);
        if (!masterRateByResource.has(resourceId)) masterRateByResource.set(resourceId, rate);
    });
    const compositionsByParent = new Map();
    projectCompositions.forEach(composition => {
        const parentId = Number(composition.parent_resource_id);
        if (!compositionsByParent.has(parentId)) compositionsByParent.set(parentId, []);
        compositionsByParent.get(parentId).push(composition);
    });

    const resolvedCache = new Map();
    const resolveFromBatch = (resourceId, path = new Set()) => {
        const numericResourceId = Number(resourceId);
        const resource = resourceById.get(numericResourceId);
        if (!resource) throw new AppError('Resource not found in your organization', 404);

        if (path.has(numericResourceId)) {
            const chain = [...path, numericResourceId].join(' -> ');
            throw new AppError(`Circular composition detected while resolving rate: ${chain}`, 400);
        }

        if (resolvedCache.has(numericResourceId)) return resolvedCache.get(numericResourceId);

        const manualRate = projectRateByResource.get(numericResourceId) || masterRateByResource.get(numericResourceId);
        if (manualRate) {
            const storedRate = Number(manualRate.rate);
            if (!Number.isFinite(storedRate)) throw new AppError(`Manual rate for resource "${resource.name}" is invalid`, 500);

            const rateUnit = getUnit(manualRate.unit_code);
            const resourceUnit = getUnit(resource.base_unit_code);
            if (rateUnit.type !== resourceUnit.type) {
                throw new AppError(`Manual rate unit "${manualRate.unit_code}" is incompatible with resource base unit "${resource.base_unit_code}"`, 400);
            }

            const resolved = {
                resourceId: resource.id,
                resourceName: resource.name,
                rate: storedRate,
                unitCode: manualRate.unit_code,
                source: 'manual',
                rateScope: Number(manualRate.project_id) === Number(projectId) ? 'project' : 'master',
                rateId: manualRate.id,
                projectId: manualRate.project_id,
                effectiveFrom: toIsoDate(manualRate.effective_from),
                effectiveTo: toIsoDate(manualRate.effective_to),
                isActive: Number(manualRate.is_active) === 1,
                remarks: manualRate.remarks || null
            };
            resolvedCache.set(numericResourceId, resolved);
            return resolved;
        }

        if (resource.type !== 'item') {
            throw new AppError(`No effective manual rate is configured for resource "${resource.name}"`, 404);
        }

        const compositions = compositionsByParent.get(numericResourceId) || [];
        if (compositions.length === 0) {
            throw new AppError(`Item "${resource.name}" has not been imported into this project and has no project composition`, 400);
        }

        const nextPath = new Set(path);
        nextPath.add(numericResourceId);
        let total = 0;
        const breakdown = [];

        for (const composition of compositions) {
            const quantity = Number(composition.quantity);
            if (!Number.isFinite(quantity) || quantity < 0) {
                throw new AppError(`Invalid composition quantity for component "${composition.component_name}"`, 400);
            }

            const componentRate = resolveFromBatch(composition.component_resource_id, nextPath);
            let quantityInRateUnit;
            try {
                quantityInRateUnit = convert(composition.unit_code, componentRate.unitCode, quantity);
            } catch (err) {
                throw new AppError(`Cannot convert composition quantity for component "${composition.component_name}": ${err.message}`, 400);
            }

            const componentCost = quantityInRateUnit * componentRate.rate;
            total += componentCost;
            breakdown.push({
                resourceId: componentRate.resourceId,
                resourceName: componentRate.resourceName,
                quantity,
                quantityUnitCode: composition.unit_code,
                rate: componentRate.rate,
                rateUnitCode: componentRate.unitCode,
                cost: componentCost,
                source: componentRate.source,
                rateScope: componentRate.rateScope
            });
        }

        const resolved = {
            resourceId: resource.id,
            resourceName: resource.name,
            rate: total,
            unitCode: resource.base_unit_code,
            source: 'computed',
            rateScope: 'project',
            asOfDate: effectiveDate,
            effectiveFrom: toIsoDate(compositions[0].effective_from),
            effectiveTo: toIsoDate(compositions[0].effective_to),
            breakdown
        };
        resolvedCache.set(numericResourceId, resolved);
        return resolved;
    };

    return uniqueIds.map(resourceId => {
        try {
            return { resourceId, ...resolveFromBatch(resourceId) };
        } catch (error) {
            if (throwErrors) throw error;
            return { resourceId, rate: null, source: null, unitCode: null };
        }
    });
}

export async function getResolvedRates(orgId, projectId, resourceIds, asOfDate) {
    await ensureProjectExists(orgId, projectId);
    return resolveProjectRatesBatch(orgId, projectId, resourceIds, asOfDate);
}

async function writeProjectRate(orgId, projectId, resource, { rate, unit_code, effective_from, remarks }) {
    const numericRate = Number(rate);
    if (rate === undefined || rate === null || rate === '' || !Number.isFinite(numericRate) || numericRate < 0) {
        throw new AppError('rate must be a non-negative number', 400);
    }
    if (!unit_code) throw new AppError('unit_code is required for a rate', 400);

    let rateUnit;
    try {
        rateUnit = getUnit(unit_code);
    } catch (err) {
        throw new AppError(err.message, 400);
    }
    const resourceUnit = getUnit(resource.base_unit_code);
    if (rateUnit.type !== resourceUnit.type) {
        throw new AppError(`Rate unit "${unit_code}" must match resource base unit category "${resource.base_unit_code}"`, 400);
    }

    const effectiveFrom = toDateOnly(effective_from);
    return db.transaction(async trx => {
        const latestRate = await trx('res_rates')
            .where({ project_id: projectId, resource_id: resource.id })
            .max('effective_from as latest_effective_from')
            .first();
        if (latestRate?.latest_effective_from) {
            const latestDate = toDateOnly(latestRate.latest_effective_from);
            if (effectiveFrom <= latestDate) {
                throw new AppError(`New rate effective_from ${effectiveFrom} must be later than the latest rate ${latestDate}`, 400);
            }
        }

        const activeRate = await trx('res_rates')
            .where({ project_id: projectId, resource_id: resource.id, is_active: 1 })
            .orderBy('id', 'desc')
            .forUpdate()
            .first('id', 'effective_from');

        if (activeRate) {
            const activeFrom = toDateOnly(activeRate.effective_from);
            if (effectiveFrom < activeFrom) {
                throw new AppError(`New rate effective_from ${effectiveFrom} cannot be earlier than the active rate ${activeFrom}`, 400);
            }
            await trx('res_rates').where({ id: activeRate.id }).update({
                is_active: 0,
                effective_to: effectiveFrom === activeFrom ? effectiveFrom : subtractOneDay(effectiveFrom)
            });
        }

        const [insertId] = await trx('res_rates').insert({
            project_id: projectId,
            resource_id: resource.id,
            rate: numericRate,
            unit_code,
            effective_from: effectiveFrom,
            effective_to: null,
            is_active: 1,
            remarks: remarks || null
        });
        return insertId;
    });
}

export async function addRate(orgId, projectId, resourceId, rateData) {
    const resource = await ensureResourceExists(orgId, resourceId);
    await ensureProjectExists(orgId, projectId);
    return writeProjectRate(orgId, projectId, resource, rateData);
}

export async function getRateHistory(orgId, projectId, resourceId) {
    await ensureProjectExists(orgId, projectId);
    await ensureResourceExists(orgId, resourceId);

    const rows = await db('res_rates as rr')
        .join('res_resources as r', 'rr.resource_id', 'r.id')
        .where({ 'rr.project_id': projectId, 'rr.resource_id': resourceId })
        .andWhere('r.org_id', orgId)
        .select('rr.id', 'rr.resource_id', 'rr.project_id', 'rr.rate', 'rr.unit_code', 'rr.effective_from', 'rr.effective_to', 'rr.is_active', 'rr.remarks', 'rr.created_at', 'rr.updated_at')
        .orderBy('rr.effective_from', 'desc')
        .orderBy('rr.id', 'desc');

    return rows.map(row => ({
        ...row,
        effective_from: toIsoDate(row.effective_from),
        effective_to: toIsoDate(row.effective_to)
    }));
}

export async function listProjectResources(orgId, projectId) {
    await ensureProjectExists(orgId, projectId);

    // proj_resources is the project membership source of truth. The fallback
    // keeps older installations working until that table is available.
    if (await db.schema.hasTable('proj_resources')) {
        return db('res_resources as r')
            .where('r.org_id', orgId)
            .where(function () {
                this.whereIn('r.id', db('proj_resources')
                    .where({ org_id: orgId, project_id: projectId, is_deleted: 0 })
                    .select('resource_id'))
                    .orWhereIn('r.id', db('res_rates')
                        .where('project_id', projectId)
                        .select('resource_id'))
                    .orWhereIn('r.id', db('res_compositions')
                        .where('project_id', projectId)
                        .select('parent_resource_id'));
            })
            .select(
                'r.id as project_resource_id',
                'r.id as resource_id',
                'r.name',
                'r.code',
                'r.type',
                'r.base_unit_code'
            )
            .distinct()
            .orderBy('r.name');
    }

    return db('res_resources')
        .where('org_id', orgId)
        .where(function () {
            this.whereIn('id', db('res_rates')
                .where('project_id', projectId)
                .select('resource_id'))
                .orWhereIn('id', db('res_compositions')
                    .where('project_id', projectId)
                    .select('parent_resource_id'));
        })
        .select('id as project_resource_id', 'id as resource_id', 'name', 'code', 'type', 'base_unit_code')
        .orderBy('name');
}

export async function removeProjectResource(orgId, projectId, resourceId) {
    await ensureProjectExists(orgId, projectId);
    await ensureResourceExists(orgId, resourceId);

    const [deletedRateRows, deletedCompositionRows] = await Promise.all([
        db('res_rates').where({ project_id: projectId, resource_id: resourceId }).del(),
        db('res_compositions').where({ project_id: projectId, parent_resource_id: resourceId }).del()
    ]);

    let deletedMembershipRows = 0;
    if (await db.schema.hasTable('proj_resources')) {
        deletedMembershipRows = await db('proj_resources')
            .where({ project_id: projectId, resource_id: resourceId })
            .update({ is_deleted: 1 });
    }

    if (!deletedRateRows && !deletedCompositionRows && !deletedMembershipRows) {
        throw new AppError('Resource is not imported into this project', 404);
    }
    return true;
}

export async function clearRate(orgId, projectId, resourceId, effectiveFrom) {
    await ensureProjectExists(orgId, projectId);
    await ensureResourceExists(orgId, resourceId);
    const clearFrom = toDateOnly(effectiveFrom);

    return db.transaction(async trx => {
        const activeRate = await trx('res_rates')
            .where({ project_id: projectId, resource_id: resourceId, is_active: 1 })
            .whereNotNull('rate')
            .orderBy('id', 'desc')
            .forUpdate()
            .first('id', 'effective_from');

        if (!activeRate) throw new AppError('This resource has no active project rate to revert', 400);

        const activeFrom = toDateOnly(activeRate.effective_from);
        if (clearFrom < activeFrom) {
            throw new AppError(`Cannot clear a project rate effective before its own start date ${activeFrom}`, 400);
        }

        await trx('res_rates').where({ id: activeRate.id }).update({
            is_active: 0,
            effective_to: subtractOneDay(clearFrom)
        });
        return true;
    });
}

async function ensureProjectCompositionImported(projectId, resourceId, dbClient = db) {
    const imported = await dbClient('res_compositions')
        .where({ project_id: projectId, parent_resource_id: resourceId })
        .first('id');
    if (!imported) {
        throw new AppError('Import this item into the project before editing or resolving its project composition', 400);
    }
}

function buildCompositionLockKey(projectId, resourceId) {
    return `project-composition:${projectId}:${resourceId}`;
}

async function withCompositionWriteLock(dbClient, projectId, resourceId, action) {
    const lockKey = buildCompositionLockKey(projectId, resourceId);

    const [lockRows] = await dbClient.raw('SELECT GET_LOCK(?, 10) AS lock_acquired', [lockKey]);
    const lockAcquired = Array.isArray(lockRows) ? lockRows[0]?.lock_acquired : lockRows?.[0]?.lock_acquired;
    if (Number(lockAcquired) !== 1) {
        throw new AppError('Another composition save is already in progress for this project item. Please try again.', 409);
    }

    try {
        return await action();
    } finally {
        await dbClient.raw('SELECT RELEASE_LOCK(?)', [lockKey]);
    }
}

async function validateCompositionRows(orgId, compositions, dbClient = db) {
    const componentIds = new Set();
    for (const composition of compositions) {
        if (!composition.component_resource_id || composition.quantity === undefined || composition.quantity === null || composition.quantity === '' || !composition.unit_code) {
            throw new AppError('Each composition row must have component_resource_id, quantity, and unit_code', 400);
        }
        if (Number(composition.quantity) < 0 || !Number.isFinite(Number(composition.quantity))) {
            throw new AppError('Composition quantity must be a non-negative number', 400);
        }
        if (componentIds.has(Number(composition.component_resource_id))) {
            throw new AppError(`Component resource id ${composition.component_resource_id} appears more than once in the same composition version`, 400);
        }
        componentIds.add(Number(composition.component_resource_id));

        let inputUnit;
        try {
            inputUnit = getUnit(composition.unit_code);
        } catch (err) {
            throw new AppError(err.message, 400);
        }

        const component = await dbClient('res_resources')
            .where({ id: composition.component_resource_id, org_id: orgId })
            .first('id', 'name', 'type', 'base_unit_code');
        if (!component) throw new AppError(`Component resource id ${composition.component_resource_id} not found in your organization`, 400);
        if (component.type !== 'material' && component.type !== 'labour') {
            throw new AppError(`Component resource "${component.name}" must be of type 'material' or 'labour'`, 400);
        }

        const componentUnit = getUnit(component.base_unit_code);
        if (inputUnit.type !== componentUnit.type) {
            throw new AppError(`Incompatible unit category: Recipe unit "${composition.unit_code}" (${inputUnit.type}) must match component base unit "${component.base_unit_code}" (${componentUnit.type})`, 400);
        }
    }
}

async function activateProjectResourceMembership(orgId, projectId, resourceId, dbClient = db) {
    if (!(await dbClient.schema.hasTable('proj_resources'))) return;

    const existing = await dbClient('proj_resources')
        .where({ project_id: projectId, resource_id: resourceId })
        .first('project_id');

    if (existing) {
        await dbClient('proj_resources')
            .where({ project_id: projectId, resource_id: resourceId })
            .update({ org_id: orgId, is_deleted: 0 });
    } else {
        await dbClient('proj_resources').insert({
            org_id: orgId,
            project_id: projectId,
            resource_id: resourceId,
            is_deleted: 0
        });
    }
}

async function replaceProjectCompositions(orgId, projectId, parentResourceId, compositions, dbClient = db, requestedEffectiveFrom) {
    const effectiveFrom = toDateOnly(
        compositions.find(row => row.effective_from)?.effective_from || requestedEffectiveFrom
    );
    const rowDates = compositions.filter(row => row.effective_from).map(row => toDateOnly(row.effective_from));
    if (rowDates.some(date => date !== effectiveFrom)) {
        throw new AppError('All composition rows in one version must use the same effective_from date', 400);
    }

    const latest = await dbClient('res_compositions')
        .where({ project_id: projectId, parent_resource_id: parentResourceId })
        .max('effective_from as latest_effective_from')
        .first();
    if (latest?.latest_effective_from && effectiveFrom <= toDateOnly(latest.latest_effective_from)) {
        throw new AppError(`Composition effective_from ${effectiveFrom} must be later than the latest version ${toDateOnly(latest.latest_effective_from)}`, 400);
    }

    await validateCompositionRows(orgId, compositions, dbClient);

    await dbClient('res_compositions')
        .where({ project_id: projectId, parent_resource_id: parentResourceId, effective_from: effectiveFrom })
        .del();

    await dbClient('res_compositions')
        .where({ project_id: projectId, parent_resource_id: parentResourceId })
        .andWhere('effective_from', '<', effectiveFrom)
        .andWhere(function () {
            this.whereNull('effective_to').orWhere('effective_to', '>=', effectiveFrom);
        })
        .update({ effective_to: subtractOneDay(effectiveFrom), is_active: 0 });

    if (compositions.length > 0) {
        await dbClient('res_compositions').insert(compositions.map(row => ({
            project_id: projectId,
            parent_resource_id: parentResourceId,
            component_resource_id: row.component_resource_id,
            quantity: row.quantity,
            unit_code: row.unit_code,
            effective_from: effectiveFrom,
            effective_to: null,
            is_active: 1
        })));
    }
}

/**
 * Import a resource into a project. All resource types become project
 * members; item imports additionally snapshot the currently effective master
 * composition. A resource can only be imported once per project.
 */
export async function importResourceToProject(orgId, projectId, resourceId, effectiveFrom) {
    await ensureProjectExists(orgId, projectId);
    const resource = await ensureResourceExists(orgId, resourceId);

    const importDate = toDateOnly(effectiveFrom);
    return db.transaction(async trx => {
        if (resource.type === 'item') {
            const alreadyImported = await trx('res_compositions')
                .where({ parent_resource_id: resourceId, project_id: projectId })
                .first('id');
            if (alreadyImported) {
                throw new AppError('This item has already been imported into this project', 400);
            }

            const masterRows = await trx('res_compositions')
                .whereNull('project_id')
                .where({ parent_resource_id: resourceId })
                .andWhere('effective_from', '<=', importDate)
                .andWhere(function () {
                    this.whereNull('effective_to').orWhere('effective_to', '>=', importDate);
                })
                .select('component_resource_id', 'quantity', 'unit_code');

            if (masterRows.length === 0) {
                throw new AppError('This item has no effective master composition to import', 400);
            }

            await validateCompositionRows(orgId, masterRows, trx);
            await trx('res_compositions').insert(masterRows.map(row => ({
                project_id: projectId,
                parent_resource_id: resourceId,
                component_resource_id: row.component_resource_id,
                quantity: row.quantity,
                unit_code: row.unit_code,
                effective_from: importDate,
                effective_to: null,
                is_active: 1
            })));
            await activateProjectResourceMembership(orgId, projectId, resourceId, trx);
            return true;
        }

        const alreadyImported = await trx('res_rates')
            .where({ resource_id: resourceId, project_id: projectId })
            .first('id');
        if (alreadyImported) {
            throw new AppError('This resource has already been imported into this project', 400);
        }

        const masterRate = await findEffectiveRate(orgId, resourceId, importDate, null, trx);
        if (!masterRate) {
            throw new AppError(`Resource "${resource.name}" has no master rate to import`, 400);
        }

        await trx('res_rates').insert({
            resource_id: resourceId,
            project_id: projectId,
            rate: masterRate.rate,
            unit_code: masterRate.unit_code,
            effective_from: importDate,
            effective_to: null,
            is_active: 1,
            remarks: masterRate.remarks || 'Imported from master rate'
        });
        await activateProjectResourceMembership(orgId, projectId, resourceId, trx);
        return true;
    });
}

export async function setCompositions(orgId, projectId, resourceId, compositions, effectiveFrom) {
    await initializeProjectResourceSchema();
    await ensureProjectExists(orgId, projectId);
    const resource = await ensureResourceExists(orgId, resourceId);
    if (resource.type !== 'item') throw new AppError('Compositions can only be set for resources of type "item"', 400);
    await ensureProjectCompositionImported(projectId, resourceId);

    await withCompositionWriteLock(db, projectId, resourceId, async () => {
        await db.transaction(async trx => {
            await replaceProjectCompositions(orgId, projectId, resourceId, compositions, trx, effectiveFrom);
        });
    });
    return true;
}

export async function getCompositionHistory(orgId, projectId, resourceId) {
    await ensureProjectExists(orgId, projectId);
    const resource = await ensureResourceExists(orgId, resourceId);
    if (resource.type !== 'item') return [];

    const rows = await db('res_compositions as c')
        .join('res_resources as component', 'c.component_resource_id', 'component.id')
        .where({ 'c.project_id': projectId, 'c.parent_resource_id': resourceId })
        .andWhere('component.org_id', orgId)
        .select('c.id', 'c.project_id', 'c.parent_resource_id', 'c.component_resource_id', 'component.name as component_name', 'component.code as component_code', 'c.quantity', 'c.unit_code', 'c.effective_from', 'c.effective_to', 'c.is_active')
        .orderBy('c.effective_from', 'desc')
        .orderBy('c.id', 'desc');

    return rows.map(row => ({
        ...row,
        effective_from: toIsoDate(row.effective_from),
        effective_to: toIsoDate(row.effective_to)
    }));
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
    setCompositions,
    getCompositionHistory
};
