import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { getUnit, convert, UNIT_REGISTRY } from '../../services/unitRegistry.js';
import { detectCycle, getCompositionColumns } from '../../services/compositionResolver.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function ensureResourceExists(orgId, id, dbClient = db) {
    const resource = await dbClient('res_resources').where({ id, org_id: orgId }).first();
    if (!resource) throw new AppError('Resource not found in your organization', 404);
    return resource;
}

async function ensureProjectExists(orgId, projectId, dbClient = db) {
    const project = await dbClient('proj_projects')
        .where({ id: projectId, org_id: orgId })
        .first('id', 'org_id');
    if (!project) throw new AppError('Project not found in your organization', 404);
    return project;
}

async function hasIndex(tableName, indexName) {
    const [rows] = await db.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', [tableName, indexName]);
    return rows.length > 0;
}

/**
 * Add composition versioning to installations that predate effective dates.
 * Existing rows are backfilled to their created date when available, or to
 * today's date as a last-resort migration baseline. No composition rows are
 * deleted by this initializer.
 */
export async function initializeResourceSchema() {
    if (await db.schema.hasTable('res_resources')) {
        if (!(await db.schema.hasColumn('res_resources', 'project_id'))) {
            await db.schema.alterTable('res_resources', table => table.integer('project_id').unsigned().nullable());
        }
        if (!(await db.schema.hasColumn('res_resources', 'parent_id'))) {
            await db.schema.alterTable('res_resources', table => table.integer('parent_id').unsigned().nullable());
        }

        if (!(await hasIndex('res_resources', 'idx_res_resources_org_name'))) {
            await db.schema.alterTable('res_resources', table => {
                table.index(['org_id', 'name'], 'idx_res_resources_org_name');
            });
        }

        // Master resource codes are unique within an organization, but a
        // project copy intentionally keeps the master's code. Include the
        // nullable project scope in the uniqueness rule so copies do not fail
        // with a duplicate-code error during import.
        if (await hasIndex('res_resources', 'uk_resource_code_org')) {
            await db.raw('ALTER TABLE ?? DROP INDEX ??', ['res_resources', 'uk_resource_code_org']);
        }
        if (!(await hasIndex('res_resources', 'uk_resource_code_org_project'))) {
            await db.schema.alterTable('res_resources', table => {
                table.unique(['org_id', 'code', 'project_id'], 'uk_resource_code_org_project');
            });
        }

        if (!(await hasIndex('res_resources', 'uq_project_resource_copy'))) {
            await db.schema.alterTable('res_resources', table => {
                table.unique(['parent_id', 'project_id'], 'uq_project_resource_copy');
            });
        }

        // These FKs are intentionally best-effort because older installations
        // may not have the project table available during an early boot.
        if (await db.schema.hasTable('proj_projects')) {
            const [projectFkRows] = await db.raw(
                `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'res_resources'
                   AND COLUMN_NAME = 'project_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
            );
            for (const row of projectFkRows) {
                if (row.REFERENCED_TABLE_NAME !== 'proj_projects') {
                    await db.raw('ALTER TABLE ?? DROP FOREIGN KEY ??', ['res_resources', row.CONSTRAINT_NAME]);
                }
            }
            if (!projectFkRows.some(row => row.REFERENCED_TABLE_NAME === 'proj_projects')) {
                await db.schema.alterTable('res_resources', table => {
                    table.foreign('project_id', 'fk_res_resources_project')
                        .references('id').inTable('proj_projects').onDelete('CASCADE');
                });
            }

            const [parentFkRows] = await db.raw(
                `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'res_resources'
                   AND COLUMN_NAME = 'parent_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
            );
            for (const row of parentFkRows) {
                if (row.REFERENCED_TABLE_NAME !== 'res_resources') {
                    await db.raw('ALTER TABLE ?? DROP FOREIGN KEY ??', ['res_resources', row.CONSTRAINT_NAME]);
                }
            }
            if (!parentFkRows.some(row => row.REFERENCED_TABLE_NAME === 'res_resources')) {
                await db.schema.alterTable('res_resources', table => {
                    table.foreign('parent_id', 'fk_res_resources_parent')
                        .references('id').inTable('res_resources').onDelete('CASCADE');
                });
            }
        }
    }

    if (await db.schema.hasTable('res_compositions')) {
        const hasCreatedAt = await db.schema.hasColumn('res_compositions', 'created_at');
        const hasEffectiveFrom = await db.schema.hasColumn('res_compositions', 'effective_from');
        const hasEffectiveTo = await db.schema.hasColumn('res_compositions', 'effective_to');
        const hasIsActive = await db.schema.hasColumn('res_compositions', 'is_active');

        if (!hasEffectiveFrom) {
            await db.schema.alterTable('res_compositions', table => table.date('effective_from').nullable());
        }
        if (!hasEffectiveTo) {
            await db.schema.alterTable('res_compositions', table => table.date('effective_to').nullable());
        }
        if (!hasIsActive) {
            await db.schema.alterTable('res_compositions', table => table.boolean('is_active').notNullable().defaultTo(1));
        } else {
            await db('res_compositions').whereNull('is_active').update({ is_active: 1 });
            await db.schema.alterTable('res_compositions', table => {
                table.boolean('is_active').notNullable().alter();
            });
        }

        const nullEffectiveFrom = await db('res_compositions').whereNull('effective_from').count('id as count').first();
        if (Number(nullEffectiveFrom?.count || 0) > 0) {
            if (hasCreatedAt) {
                await db('res_compositions')
                    .whereNull('effective_from')
                    .update({ effective_from: db.raw('DATE(created_at)') });
            }

            const stillNull = await db('res_compositions').whereNull('effective_from').count('id as count').first();
            if (Number(stillNull?.count || 0) > 0) {
                await db('res_compositions')
                    .whereNull('effective_from')
                    .update({ effective_from: db.raw('CURRENT_DATE') });
                console.warn('[Resource Schema] Backfilled composition effective_from using CURRENT_DATE for legacy rows without created_at.');
            }
        }

        // Make the version start mandatory after all legacy rows are backfilled.
        await db.schema.alterTable('res_compositions', table => {
            table.date('effective_from').notNullable().alter();
        });

        const compositionColumns = await getCompositionColumns(db);
        if (!(await hasIndex('res_compositions', 'idx_res_compositions_parent_effective'))) {
            await db.schema.alterTable('res_compositions', table => {
                table.index([compositionColumns.item, 'effective_from', 'effective_to'], 'idx_res_compositions_parent_effective');
            });
        }
        if (!(await hasIndex('res_compositions', 'idx_res_compositions_component'))) {
            await db.schema.alterTable('res_compositions', table => {
                table.index([compositionColumns.component], 'idx_res_compositions_component');
            });
        }
    }

}

const toIsoDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

// ─────────────────────────────────────────────────────────────────────────────
// Rates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a date/date-like value to the DATE format used by res_rates.
 * Keeping this in one place prevents timezone offsets from changing the
 * effective day when a caller passes a JavaScript Date.
 */
function toDateOnly(value, fallback = new Date()) {
    if (value === undefined || value === null || value === '') {
        value = fallback;
    }

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new AppError('Invalid rate date. Use YYYY-MM-DD.', 400);
    }

    return parsed.toISOString().slice(0, 10);
}

/**
 * Return the resource row whose rates should be used in a project. A project
 * copy is preferred, while a missing copy naturally falls back to the master.
 */
async function resolveProjectResourceId(orgId, resourceId, projectId, dbClient = db) {
    const resource = await ensureResourceExists(orgId, resourceId, dbClient);
    const masterId = resource.project_id ? resource.parent_id : resource.id;
    if (!projectId) return resource.id;
    if (resource.project_id && Number(resource.project_id) === Number(projectId)) return resource.id;

    const copy = await dbClient('res_resources')
        .where({ org_id: orgId, parent_id: masterId, project_id: projectId })
        .first('id');
    return copy?.id || masterId;
}

/**
 * Find the effective manual rate for a master resource or its project copy.
 * Rates never carry project_id; scope is resolved through res_resources.
 */
async function findEffectiveManualRate(orgId, resourceId, asOfDate, dbClient = db, projectId = null) {
    const targetResourceId = await resolveProjectResourceId(orgId, resourceId, projectId, dbClient);
    const targetResource = await ensureResourceExists(orgId, targetResourceId, dbClient);

    const scopedRate = await dbClient('res_rates as rr')
        .join('res_resources as r', 'rr.resource_id', 'r.id')
        .where('rr.resource_id', targetResource.id)
        .andWhere('r.org_id', orgId)
        .where('rr.is_active', 1)
        .whereNotNull('rr.rate')
        .andWhere('rr.effective_from', '<=', asOfDate)
        .andWhere(function () {
            this.whereNull('rr.effective_to').orWhere('rr.effective_to', '>=', asOfDate);
        })
        .select('rr.id', 'rr.resource_id', 'rr.rate', 'rr.unit_code', 'rr.effective_from', 'rr.effective_to', 'rr.is_active', 'rr.remarks')
        .orderBy('rr.effective_from', 'desc')
        .orderBy('rr.id', 'desc')
        .first();

    if (scopedRate || !targetResource.parent_id) return scopedRate;

    return dbClient('res_rates as rr')
        .join('res_resources as r', 'rr.resource_id', 'r.id')
        .where('rr.resource_id', targetResource.parent_id)
        .andWhere('r.org_id', orgId)
        .where('rr.is_active', 1)
        .whereNotNull('rr.rate')
        .andWhere('rr.effective_from', '<=', asOfDate)
        .andWhere(function () {
            this.whereNull('rr.effective_to').orWhere('rr.effective_to', '>=', asOfDate);
        })
        .select('rr.id', 'rr.resource_id', 'rr.rate', 'rr.unit_code', 'rr.effective_from', 'rr.effective_to', 'rr.is_active', 'rr.remarks')
        .orderBy('rr.effective_from', 'desc')
        .orderBy('rr.id', 'desc')
        .first();
}

/**
 * Find or create the resource row owned by a project. The helper only copies
 * the resource identity; rates and compositions are written separately.
 */
export async function findOrCreateProjectResource(orgId, resourceId, projectId, dbClient = db) {
    if (!projectId) return resourceId;
    await ensureProjectExists(orgId, projectId, dbClient);

    const resource = await ensureResourceExists(orgId, resourceId, dbClient);
    if (resource.project_id && Number(resource.project_id) === Number(projectId)) return resource.id;

    const masterId = resource.project_id ? resource.parent_id : resource.id;
    const master = await ensureResourceExists(orgId, masterId, dbClient);
    const existing = await dbClient('res_resources')
        .where({ org_id: orgId, parent_id: master.id, project_id: projectId })
        .first();
    if (existing) return existing.id;

    try {
        const [newId] = await dbClient('res_resources').insert({
            org_id: orgId,
            project_id: projectId,
            parent_id: master.id,
            name: master.name,
            code: master.code,
            type: master.type,
            base_unit_code: master.base_unit_code,
            description: master.description,
            remarks: master.remarks
        });
        return newId;
    } catch (error) {
        // A concurrent request may have won the unique copy race.
        const concurrentCopy = await dbClient('res_resources')
            .where({ org_id: orgId, parent_id: master.id, project_id: projectId })
            .first('id');
        if (concurrentCopy) return concurrentCopy.id;
        throw error;
    }
}

function subtractOneDay(dateOnly) {
    const date = new Date(`${dateOnly}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}

/**
 * Resolve a resource's rate using the Resource domain rule:
 *
 *   - an effective res_rates row is a manual rate;
 *   - an item without such a row is computed from its composition;
 *   - a base resource without a row has no rate and cannot be computed.
 *
 * The path set prevents recursive composition data from causing an endless
 * rate calculation. The returned unit is always the resource's base unit for
 * computed items, and the stored rate unit for manual rates.
 */
async function resolveRateInternal(orgId, resourceId, asOfDate, dbClient, path = new Set(), context = null, projectId = null) {
    const scopedResourceId = await resolveProjectResourceId(orgId, resourceId, projectId, dbClient);
    const numericResourceId = Number(scopedResourceId);
    let resource;
    if (context?.resourceCache?.has(numericResourceId)) {
        resource = context.resourceCache.get(numericResourceId);
    } else {
        resource = await dbClient('res_resources')
            .where({ id: scopedResourceId, org_id: orgId })
            .first();
        if (resource && context?.resourceCache) {
            context.resourceCache.set(numericResourceId, resource);
        }
    }

    if (!resource) {
        throw new AppError('Resource not found in your organization', 404);
    }

    if (path.has(numericResourceId)) {
        const chain = [...path, numericResourceId].join(' -> ');
        throw new AppError(`Circular composition detected while resolving rate: ${chain}`, 400);
    }

    if (context?.rateCache?.has(numericResourceId)) {
        return context.rateCache.get(numericResourceId);
    }

    let projectItemHasComposition = false;
    if (resource.project_id && resource.type === 'item') {
        const compositionColumns = await getCompositionColumns(dbClient);
        projectItemHasComposition = Boolean(
            await dbClient('res_compositions')
                .where(compositionColumns.item, resource.id)
                .first('id')
        );
    }

    let manualRate;
    if (context?.manualRateCache?.has(numericResourceId)) {
        manualRate = context.manualRateCache.get(numericResourceId);
    } else {
        manualRate = await findEffectiveManualRate(orgId, resourceId, asOfDate, dbClient, projectId);
        context?.manualRateCache?.set(numericResourceId, manualRate || null);
    }

    // An imported project item owns its own composition. If it has no manual
    // rate of its own, do not let the master's item-level rate short-circuit
    // that project composition; the component rates must be recalculated for
    // the project. Master fallback remains valid for project materials/labour
    // and for project items without a project composition.
    if (
        manualRate
        && resource.project_id
        && resource.type === 'item'
        && projectItemHasComposition
        && Number(manualRate.resource_id) !== Number(resource.id)
    ) {
        manualRate = null;
    }

    if (manualRate) {
        const storedRate = Number(manualRate.rate);
        if (!Number.isFinite(storedRate)) {
            throw new AppError(`Manual rate for resource "${resource.name}" is invalid`, 500);
        }

        const rateUnit = getUnit(manualRate.unit_code);
        const resourceUnit = getUnit(resource.base_unit_code);
        if (rateUnit.type !== resourceUnit.type) {
            throw new AppError(
                `Manual rate unit "${manualRate.unit_code}" is incompatible with resource base unit "${resource.base_unit_code}"`,
                400
            );
        }

        const resolved = {
            resourceId: resource.id,
            resourceName: resource.name,
            rate: storedRate,
            unitCode: manualRate.unit_code,
            source: 'manual',
            rateScope: Number(manualRate.resource_id) === Number(resource.id) && resource.project_id
                ? 'project'
                : 'master',
            rateId: manualRate.id,
            projectId: resource.project_id || null,
            effectiveFrom: toIsoDate(manualRate.effective_from),
            effectiveTo: toIsoDate(manualRate.effective_to),
            isActive: Number(manualRate.is_active) === 1,
            remarks: manualRate.remarks || null
        };
        context?.rateCache?.set(numericResourceId, resolved);
        return resolved;
    }

    if (resource.type !== 'item') {
        throw new AppError(
            `No effective manual rate is configured for resource "${resource.name}"`,
            404
        );
    }

    let compositions;
    if (context?.compositionCache?.has(numericResourceId)) {
        compositions = context.compositionCache.get(numericResourceId);
    } else {
        const compositionColumns = await getCompositionColumns(dbClient);
        compositions = await dbClient('res_compositions as c')
            .join('res_resources as component', `c.${compositionColumns.component}`, 'component.id')
            .where(`c.${compositionColumns.item}`, resource.id)
            .andWhere('c.effective_from', '<=', asOfDate)
            .andWhere(function () {
                this.whereNull('c.effective_to').orWhere('c.effective_to', '>=', asOfDate);
            })
            .andWhere('component.org_id', orgId)
            .select(
                `c.${compositionColumns.component} as component_resource_id`,
                'c.quantity',
                'c.unit_code',
                'c.effective_from',
                'c.effective_to',
                'component.name as component_name'
            );
        context?.compositionCache?.set(numericResourceId, compositions);
    }

    if (compositions.length === 0) {
        throw new AppError(
            `Item "${resource.name}" has no composition and no manual rate`,
            404
        );
    }

    const nextPath = new Set(path);
    nextPath.add(Number(resourceId));
    let total = 0;
    const breakdown = [];

    for (const composition of compositions) {
        const quantity = Number(composition.quantity);
        if (!Number.isFinite(quantity) || quantity < 0) {
            throw new AppError(
                `Invalid composition quantity for component "${composition.component_name}"`,
                400
            );
        }

        const componentRate = await resolveRateInternal(
            orgId,
            composition.component_resource_id,
            asOfDate,
            dbClient,
            nextPath,
            context,
            null
        );

        let quantityInRateUnit;
        try {
            quantityInRateUnit = convert(
                composition.unit_code,
                componentRate.unitCode,
                quantity
            );
        } catch (err) {
            throw new AppError(
                `Cannot convert composition quantity for component "${composition.component_name}": ${err.message}`,
                400
            );
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
            source: componentRate.source
        });
    }

    const resolved = {
        resourceId: resource.id,
        resourceName: resource.name,
        rate: total,
        unitCode: resource.base_unit_code,
        source: 'computed',
        rateScope: resource.project_id ? 'project' : 'master',
        asOfDate,
        effectiveFrom: toIsoDate(compositions[0].effective_from),
        effectiveTo: toIsoDate(compositions[0].effective_to),
        breakdown
    };
    context?.rateCache?.set(numericResourceId, resolved);
    return resolved;
}

/**
 * Public rate entry point. All callers should use this method rather than
 * joining res_rates or calculating composition costs themselves.
 */
export async function getResolvedRate(orgId, resourceId, asOfDate, projectId = null) {
    const effectiveDate = toDateOnly(asOfDate);
    if (projectId) await ensureProjectExists(orgId, projectId);
    try {
        return await resolveRateInternal(orgId, resourceId, effectiveDate, db, new Set(), null, projectId);
    } catch (err) {
        if (err.statusCode === 404 || err.message?.includes('no composition and no manual rate') || err.message?.includes('No effective manual rate')) {
            const scopedResourceId = await resolveProjectResourceId(orgId, resourceId, projectId, db);
            const resource = await ensureResourceExists(orgId, scopedResourceId, db);
            return {
                resourceId: resource.id,
                resourceName: resource.name,
                rate: null,
                unitCode: resource.base_unit_code,
                source: null,
                rateScope: null,
                projectId: resource.project_id || null,
                effectiveFrom: effectiveDate,
                effectiveTo: null,
                isActive: false,
                remarks: null
            };
        }
        throw err;
    }
}

/**
 * Resolve several resources for the same date without making the client fan
 * out into one HTTP request per component.
 */
export async function getResolvedRates(orgId, resourceIds, asOfDate, projectId = null) {
    const effectiveDate = toDateOnly(asOfDate);
    const uniqueIds = [...new Set(resourceIds.map(Number))];
    if (projectId) await ensureProjectExists(orgId, projectId);

    return Promise.all(uniqueIds.map(async resourceId => {
        try {
            const resolved = await resolveRateInternal(
                orgId,
                resourceId,
                effectiveDate,
                db,
                new Set(),
                null,
                projectId
            );
            return {
                resourceId,
                projectResourceId: resolved.resourceId,
                ...resolved,
                resourceId
            };
        } catch {
            return { resourceId, rate: null, source: null, unitCode: null };
        }
    }));
}

/**
 * Create a manual rate row. The presence of this row is what makes the rate
 * manual; no rate_type column is required for the current business rule.
 */
async function _writeManualRateVersion(orgId, resource, { rate, unit_code, effective_from, remarks }, dbClient = db) {
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
        throw new AppError(
            `Rate unit "${unit_code}" must match resource base unit category "${resource.base_unit_code}"`,
            400
        );
    }

    const effectiveFrom = toDateOnly(effective_from);

    // The active flag tracks the latest edit, while effective dates still
    // determine which historical row applies to a requested date.
    const activeRateQuery = dbClient('res_rates')
        .where({ resource_id: resource.id, is_active: 1 });

    const activeRate = await activeRateQuery
        .orderBy('id', 'desc')
        .forUpdate()
        .first('id', 'effective_from', 'effective_to');

    if (activeRate) {
        const activeFrom = toDateOnly(activeRate.effective_from);
        if (effectiveFrom <= activeFrom) {
            throw new AppError(
                `New rate version effective date (${effectiveFrom}) must be at least one day after the current active rate (${activeFrom}). To adjust the rate for ${activeFrom}, use "Edit Version".`,
                400
            );
        }

        await dbClient('res_rates').where({ id: activeRate.id }).update({
            is_active: 0,
            effective_to: subtractOneDay(effectiveFrom)
        });
    }

    const [insertId] = await dbClient('res_rates').insert({
        resource_id: resource.id,
        rate: numericRate,
        unit_code,
        effective_from: effectiveFrom,
        effective_to: null,
        is_active: 1,
        remarks: remarks || null
    });
    return insertId;
}

/**
 * Directly update an existing rate record (current or past rate).
 */
export async function updateRate(orgId, resourceId, rateId, rateData = {}, projectId = null) {
    if (projectId) await ensureProjectExists(orgId, projectId);
    const scopedResourceId = projectId
        ? await resolveProjectResourceId(orgId, resourceId, projectId)
        : resourceId;
    const resource = await ensureResourceExists(orgId, scopedResourceId);

    const numericRateId = parseInt(rateId, 10);
    if (Number.isNaN(numericRateId)) {
        throw new AppError('Invalid rate ID', 400);
    }

    return db.transaction(async (trx) => {
        const existingRate = await trx('res_rates')
            .where({ id: numericRateId, resource_id: resource.id })
            .first();

        if (!existingRate) {
            throw new AppError('Rate record not found for this resource', 404);
        }

        const updates = {};

        if (rateData.mode === 'computed' || rateData.rate === null) {
            updates.rate = null;
            if (rateData.remarks) updates.remarks = rateData.remarks;
        } else if (rateData.rate !== undefined && rateData.rate !== null && rateData.rate !== '') {
            const numericRate = Number(rateData.rate);
            if (!Number.isFinite(numericRate) || numericRate < 0) {
                throw new AppError('rate must be a non-negative number', 400);
            }
            updates.rate = numericRate;
        }

        if (rateData.unit_code) {
            const rateUnit = getUnit(rateData.unit_code);
            const resourceUnit = getUnit(resource.base_unit_code);
            if (rateUnit.type !== resourceUnit.type) {
                throw new AppError(
                    `Rate unit "${rateData.unit_code}" must match resource base unit category "${resource.base_unit_code}"`,
                    400
                );
            }
            updates.unit_code = rateData.unit_code;
        }

        if (rateData.effective_from !== undefined) {
            updates.effective_from = toDateOnly(rateData.effective_from);
        }

        if (rateData.effective_to !== undefined) {
            updates.effective_to = rateData.effective_to ? toDateOnly(rateData.effective_to) : null;
        }

        if (rateData.remarks !== undefined) {
            updates.remarks = rateData.remarks || null;
        }

        if (rateData.is_active !== undefined) {
            updates.is_active = Number(rateData.is_active) ? 1 : 0;
        } else if (updates.effective_to !== undefined) {
            updates.is_active = updates.effective_to === null ? 1 : 0;
        } else if (existingRate.effective_to === null) {
            updates.is_active = 1;
        }

        if (Object.keys(updates).length > 0) {
            await trx('res_rates').where({ id: numericRateId }).update(updates);
        }

        const updated = await trx('res_rates').where({ id: numericRateId }).first();
        return {
            ...updated,
            effective_from: toIsoDate(updated.effective_from),
            effective_to: toIsoDate(updated.effective_to)
        };
    });
}

export async function addRate(orgId, resourceId, rateData = {}) {
    const projectId = rateData.project_id || null;
    if (projectId) await ensureProjectExists(orgId, projectId);

    return db.transaction(async (trx) => {
        const requestedResource = await ensureResourceExists(orgId, resourceId, trx);
        let scopedResourceId;
        if (projectId && requestedResource.type === 'item') {
            scopedResourceId = await resolveProjectResourceId(orgId, resourceId, projectId, trx);
            const scopedResource = await ensureResourceExists(orgId, scopedResourceId, trx);
            if (!scopedResource.project_id || Number(scopedResource.project_id) !== Number(projectId)) {
                throw new AppError('Import this item into the project before adding a project rate', 400);
            }
        } else {
            scopedResourceId = await findOrCreateProjectResource(orgId, resourceId, projectId, trx);
        }
        const resource = await ensureResourceExists(orgId, scopedResourceId, trx);
        return _writeManualRateVersion(orgId, resource, rateData, trx);
    });
}

/**
 * Return all manual rate versions for a resource, newest first.
 */
export async function getRateHistory(orgId, resourceId, projectId = null) {
    if (projectId) await ensureProjectExists(orgId, projectId);
    const scopedResourceId = await resolveProjectResourceId(orgId, resourceId, projectId);
    const resource = await ensureResourceExists(orgId, scopedResourceId);

    // If this is a project copy and has no rate rows yet, auto-initialize its baseline rate from master catalog
    if (projectId && resource.parent_id) {
        const existingCount = await db('res_rates')
            .where('resource_id', scopedResourceId)
            .count('id as count')
            .first();

        if (Number(existingCount?.count || 0) === 0) {
            const masterResource = await ensureResourceExists(orgId, resource.parent_id);
            await ensureProjectRateFromMaster(orgId, masterResource, scopedResourceId, toDateOnly(), db);
        }
    }

    const query = db('res_rates as rr')
        .join('res_resources as r', 'rr.resource_id', 'r.id')
        .where('rr.resource_id', scopedResourceId)
        .andWhere('r.org_id', orgId)
        .select(
            'rr.id', 'rr.resource_id', 'rr.rate', 'rr.unit_code',
            'rr.effective_from', 'rr.effective_to', 'rr.is_active',
            'rr.remarks', 'rr.created_at', 'rr.updated_at'
        );

    const rows = await query
        .orderBy('rr.effective_from', 'desc')
        .orderBy('rr.id', 'desc');

    return rows.map(r => ({
        ...r,
        effective_from: toIsoDate(r.effective_from),
        effective_to: toIsoDate(r.effective_to)
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List resources with optional filters.
 * @param {number} orgId
 * @param {object} filters  { type:'material'|'item', search:'...', limit, offset }
 */
export async function getResources(orgId, {
    type,
    search,
    limit = 100,
    offset = 0,
    includeDetails = true,
    includeRates = true
} = {}) {
    const query = db('res_resources')
        .where('org_id', orgId)
        .whereNull('project_id')
        .select('id', 'name', 'code', 'type', 'description', 'remarks', 'base_unit_code', 'project_id', 'parent_id')
        .orderBy('name');

    if (type) query.where('type', type);
    if (search) query.where('name', 'like', `%${search}%`);

    query.limit(limit).offset(offset);
    const resources = await query;

    // Enrich with standard base unit name/symbol in-memory from UNIT_REGISTRY
    resources.forEach(r => {
        const u = UNIT_REGISTRY[r.base_unit_code];
        r.base_unit_name = u ? u.name : '';
        r.base_unit_symbol = u ? u.symbol : '';
    });

    if (resources.length > 0) {
        const resourceIds = resources.map(r => r.id);
        const asOfDate = toDateOnly();
        const compositionColumns = await getCompositionColumns(db);

        const [conversions, compositions, manualRates] = await Promise.all([
            includeDetails
                ? db('res_conversions')
                    .whereIn('resource_id', resourceIds)
                    .andWhere('org_id', orgId)
                    .select('id', 'resource_id', 'name', 'quantity', 'unit_code')
                : Promise.resolve([]),

            includeDetails
                ? db('res_compositions as c')
                    .join('res_resources as r2', `c.${compositionColumns.component}`, 'r2.id')
                    .whereIn(`c.${compositionColumns.item}`, resourceIds)
                    .andWhere('r2.org_id', orgId)
                    .andWhere('c.effective_from', '<=', asOfDate)
                    .andWhere(function () {
                        this.whereNull('c.effective_to').orWhere('c.effective_to', '>=', asOfDate);
                    })
                    .select(
                        'c.id',
                        `c.${compositionColumns.item} as parent_resource_id`,
                        `c.${compositionColumns.component} as component_resource_id`,
                        'r2.name as component_name',
                        'r2.code as component_code',
                        'c.quantity',
                        'c.unit_code',
                        'c.effective_from',
                        'c.effective_to'
                    )
                : Promise.resolve([]),

            includeRates
                ? db('res_rates as rr')
                    .whereIn('rr.resource_id', resourceIds)
                    .whereNotNull('rr.rate')
                    .andWhere('rr.effective_from', '<=', asOfDate)
                    .andWhere(function () {
                        this.whereNull('rr.effective_to').orWhere('rr.effective_to', '>=', asOfDate);
                    })
                    .select(
                        'rr.id',
                        'rr.resource_id',
                        'rr.rate',
                        'rr.unit_code',
                        'rr.effective_from',
                        'rr.effective_to',
                        'rr.is_active',
                        'rr.remarks'
                    )
                    .orderBy('rr.effective_from', 'desc')
                    .orderBy('rr.id', 'desc')
                : Promise.resolve([])
        ]);

        const conversionsByRes = {};
        conversions.forEach(c => {
            const u = UNIT_REGISTRY[c.unit_code];
            c.unit_name = u ? u.name : '';
            c.unit_symbol = u ? u.symbol : '';
            if (!conversionsByRes[c.resource_id]) conversionsByRes[c.resource_id] = [];
            conversionsByRes[c.resource_id].push(c);
        });

        const compositionsByRes = {};
        resourceIds.forEach(resourceId => {
            compositionsByRes[resourceId] = [];
        });
        compositions.forEach(c => {
            const u = UNIT_REGISTRY[c.unit_code];
            c.unit_name = u ? u.name : '';
            c.unit_symbol = u ? u.symbol : '';
            c.effective_from = toIsoDate(c.effective_from);
            c.effective_to = toIsoDate(c.effective_to);
            if (!compositionsByRes[c.parent_resource_id]) compositionsByRes[c.parent_resource_id] = [];
            compositionsByRes[c.parent_resource_id].push(c);
        });

        const manualRatesByResource = new Map();
        manualRates.forEach(rate => {
            const resourceId = Number(rate.resource_id);
            if (!manualRatesByResource.has(resourceId)) {
                manualRatesByResource.set(resourceId, rate);
            }
        });

        const resolutionContext = {
            resourceCache: new Map(resources.map(resource => [Number(resource.id), resource])),
            manualRateCache: new Map(resourceIds.map(resourceId => [Number(resourceId), manualRatesByResource.get(Number(resourceId)) || null])),
            compositionCache: new Map(resourceIds.map(resourceId => [Number(resourceId), compositionsByRes[resourceId] || []])),
            rateCache: new Map()
        };

        // Materials and labour only need a direct manual rate. Only composite
        // items need recursive resolution after the batch lookup.
        await Promise.all(resources.map(async (r) => {
            r.conversions = conversionsByRes[r.id] || [];
            r.compositions = compositionsByRes[r.id] || [];

            if (!includeRates) {
                r.rate = null;
                r.rate_source = null;
                r.rate_unit_code = null;
                return;
            }

            const manualRate = manualRatesByResource.get(Number(r.id));
            if (manualRate) {
                try {
                    const storedRate = Number(manualRate.rate);
                    const rateUnit = getUnit(manualRate.unit_code);
                    const resourceUnit = getUnit(r.base_unit_code);
                    if (!Number.isFinite(storedRate) || rateUnit.type !== resourceUnit.type) {
                        throw new Error('Invalid or incompatible manual rate');
                    }
                    r.rate = storedRate;
                    r.rate_source = 'manual';
                    r.rate_unit_code = manualRate.unit_code;
                    return;
                } catch {
                    // Keep the same nullable response behavior as the resolver.
                }
            }

            if (r.type !== 'item' || r.compositions.length === 0) {
                r.rate = null;
                r.rate_source = null;
                r.rate_unit_code = null;
                return;
            }

            try {
                const resolvedRate = await resolveRateInternal(orgId, r.id, asOfDate, db, new Set(), resolutionContext);
                r.rate = resolvedRate.rate;
                r.rate_source = resolvedRate.source;
                r.rate_unit_code = resolvedRate.unitCode;
            } catch (e) {
                r.rate = null;
                r.rate_source = null;
                r.rate_unit_code = null;
            }
        }));
    }

    return resources;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get single resource with full detail
// ─────────────────────────────────────────────────────────────────────────────

export async function getResourceById(orgId, id, asOfDate, projectId = null) {
    if (projectId) await ensureProjectExists(orgId, projectId);
    const scopedResourceId = projectId
        ? await resolveProjectResourceId(orgId, id, projectId)
        : id;
    const resource = await db('res_resources')
        .where({ id: scopedResourceId, org_id: orgId })
        .select('id', 'name', 'code', 'type', 'description', 'remarks', 'base_unit_code', 'project_id', 'parent_id')
        .first();

    if (!resource) throw new AppError('Resource not found in your organization', 404);

    // Enrich base unit details
    const baseUnit = UNIT_REGISTRY[resource.base_unit_code];
    resource.base_unit_name = baseUnit ? baseUnit.name : '';
    resource.base_unit_symbol = baseUnit ? baseUnit.symbol : '';

    // Fetch unit conversions
    const conversions = await db('res_conversions')
        .where({ resource_id: scopedResourceId, org_id: orgId })
        .select('id', 'name', 'quantity', 'unit_code');

    conversions.forEach(c => {
        const u = UNIT_REGISTRY[c.unit_code];
        c.unit_name = u ? u.name : '';
        c.unit_symbol = u ? u.symbol : '';
    });
    resource.conversions = conversions;

    // Fetch compositions (only meaningful for items)
    if (resource.type === 'item') {
        const compositionDate = toDateOnly(asOfDate);
        const compositionColumns = await getCompositionColumns(db);
        const compositions = await db('res_compositions as c')
            .join('res_resources as r2', `c.${compositionColumns.component}`, 'r2.id')
            .where(`c.${compositionColumns.item}`, scopedResourceId)
            .andWhere('r2.org_id', orgId)
            .andWhere('c.effective_from', '<=', compositionDate)
            .andWhere(function () {
                this.whereNull('c.effective_to').orWhere('c.effective_to', '>=', compositionDate);
            })
            .select(
                'c.id',
                `c.${compositionColumns.component} as component_resource_id`,
                'r2.name as component_name',
                'r2.code as component_code',
                'c.quantity',
                'c.unit_code',
                'c.effective_from',
                'c.effective_to'
            );

        compositions.forEach(c => {
            const u = UNIT_REGISTRY[c.unit_code];
            c.unit_name = u ? u.name : '';
            c.unit_symbol = u ? u.symbol : '';
            c.effective_from = toIsoDate(c.effective_from);
            c.effective_to = toIsoDate(c.effective_to);
        });
        resource.compositions = compositions;
    } else {
        resource.compositions = [];
    }

    return resource;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a resource.
 * For items, optionally pass compositions: [{ component_resource_id, quantity, unit_code }]
 */
async function _replaceConversions(orgId, resourceId, conversions, baseUnit, dbClient = db) {
    for (const conv of conversions) {
        if (!conv.name || !conv.quantity || !conv.unit_code) {
            throw new AppError('Each conversion must have name, quantity, and unit_code', 400);
        }
        
        let targetUnit;
        try {
            targetUnit = getUnit(conv.unit_code);
        } catch (err) {
            throw new AppError(err.message, 400);
        }

        if (targetUnit.type !== baseUnit.type) {
            throw new AppError(`Incompatible unit category: Conversion target unit "${conv.unit_code}" (${targetUnit.type}) must match resource base unit "${baseUnit.symbol}" (${baseUnit.type})`, 400);
        }
    }

    await dbClient('res_conversions').where('resource_id', resourceId).del();

    if (conversions.length > 0) {
        const rows = conversions.map(conv => ({
            org_id: orgId,
            resource_id: resourceId,
            name: conv.name,
            quantity: conv.quantity,
            unit_code: conv.unit_code
        }));
        await dbClient('res_conversions').insert(rows);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a resource.
 * For items, optionally pass compositions: [{ component_resource_id, quantity, unit_code }]
 */
export async function createResource(orgId, {
    name,
    code,
    type,
    base_unit_code,
    description,
    remarks,
    compositions = [],
    conversions = [],
    effective_from,
    rate,
    rate_unit_code,
    rate_effective_from,
    rate_remarks
}) {
    if (!name || !type || !base_unit_code) {
        throw new AppError('name, type, and base_unit_code are required', 400);
    }
    if (!['material', 'item', 'labour'].includes(type)) {
        throw new AppError('type must be "material", "item", or "labour"', 400);
    }

    // App-level validation for standard units
    let unit;
    try {
        unit = getUnit(base_unit_code);
    } catch (err) {
        throw new AppError(err.message, 400);
    }

    const insertId = await db.transaction(async (trx) => {
        const [id] = await trx('res_resources').insert({
            org_id: orgId,
            project_id: null,
            parent_id: null,
            name,
            code: code || null,
            type,
            base_unit_code,
            description: description || null,
            remarks: remarks || null
        });

        // Insert conversions
        if (conversions.length > 0) {
            await _replaceConversions(orgId, id, conversions, unit, trx);
        }

        if (rate !== undefined && rate !== null && rate !== '') {
            await _writeManualRateVersion(orgId, {
                id,
                type,
                base_unit_code
            }, {
                rate,
                unit_code: rate_unit_code || base_unit_code,
                effective_from: rate_effective_from,
                remarks: rate_remarks || remarks
            }, trx);
        }

        // If item, insert compositions
        if (type === 'item' && compositions.length > 0) {
            await _replaceCompositions(orgId, id, compositions, trx, effective_from);
        }

        return id;
    });

    return insertId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────────────────

export async function updateResource(orgId, id, {
    name,
    code,
    type,
    base_unit_code,
    description,
    remarks,
    compositions,
    conversions,
    effective_from,
    rate,
    rate_unit_code,
    rate_effective_from,
    rate_remarks
}) {
    const resource = await ensureResourceExists(orgId, id);

    await db.transaction(async (trx) => {
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (code !== undefined) updates.code = code;
        
        let activeType = resource.type;
        if (type !== undefined && type !== resource.type) {
            if (!['material', 'item', 'labour'].includes(type)) {
                throw new AppError('type must be "material", "item", or "labour"', 400);
            }
            if (type === 'item') {
                const compositionColumns = await getCompositionColumns(trx);
                const usedAsComponent = await trx('res_compositions')
                    .where(compositionColumns.component, id)
                    .count('id as cnt').first();
                if (parseInt(usedAsComponent.cnt) > 0) {
                    throw new AppError('Cannot change type to "item": resource is used as a component in other composite item recipes', 400);
                }
            }
            if (resource.type === 'item') {
                const compositionColumns = await getCompositionColumns(trx);
                await trx('res_compositions').where(compositionColumns.item, id).del();
            }
            updates.type = type;
            activeType = type;
        }

        let activeBaseUnitCode = resource.base_unit_code;
        if (base_unit_code !== undefined && base_unit_code !== resource.base_unit_code) {
            let newUnit;
            try {
                newUnit = getUnit(base_unit_code);
            } catch (err) {
                throw new AppError(err.message, 400);
            }

            if (resource.base_unit_code) {
                const oldUnit = getUnit(resource.base_unit_code);
                if (newUnit.type !== oldUnit.type) {
                    throw new AppError(
                        `Cannot change base unit category from "${resource.base_unit_code}" (${oldUnit.type}) to "${base_unit_code}" (${newUnit.type}). Unit changes must remain within the same measurement category (e.g., grams to kilograms, meters to centimeters) to preserve rate, conversion, and recipe integrity.`,
                        400
                    );
                }
            }

            updates.base_unit_code = base_unit_code;
            activeBaseUnitCode = base_unit_code;
        }
        if (description !== undefined) updates.description = description;
        if (remarks !== undefined) updates.remarks = remarks;

        if (Object.keys(updates).length > 0) {
            await trx('res_resources').where({ id, org_id: orgId }).update(updates);
        }

        const baseUnit = getUnit(activeBaseUnitCode);

        // Replace conversions if provided
        if (conversions !== undefined) {
            await _replaceConversions(orgId, id, conversions, baseUnit, trx);
        }

        // Replace compositions if provided (all resource types allowed)
        if (compositions !== undefined) {
            await _forceReplaceCompositions(orgId, id, compositions, trx, effective_from);
        }

        if (rate !== undefined && rate !== null && rate !== '') {
            await _writeManualRateVersion(orgId, {
                id,
                type: activeType,
                base_unit_code: activeBaseUnitCode
            }, {
                rate,
                unit_code: rate_unit_code || activeBaseUnitCode,
                effective_from: rate_effective_from,
                remarks: rate_remarks || remarks
            }, trx);
        }
    });

    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteResource(orgId, id) {
    const resource = await ensureResourceExists(orgId, id);
    if (resource.project_id) {
        throw new AppError('Project resource copies must be removed from the project resource screen', 400);
    }

    const compositionColumns = await getCompositionColumns(db);

    // Guard: referenced as a component in any composition
    const usedAsComponent = await db('res_compositions')
        .where(compositionColumns.component, id)
        .count('id as cnt').first();
    if (parseInt(usedAsComponent.cnt) > 0) {
        throw new AppError('Cannot delete: resource is used as a component in item compositions', 400);
    }

    // Cascade compositions and conversions manually
    await db('res_compositions').where(compositionColumns.item, id).del();
    await db('res_conversions').where('resource_id', id).del();
    // Rates reference the resource as well; remove them before deleting the
    // parent row when the database FK is not configured with ON DELETE CASCADE.
    await db('res_rates').where('resource_id', id).del();
    await db('res_resources').where({ id, org_id: orgId }).del();
    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compositions (items only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal helper — writes one effective-dated composition version for a
 * resource. Older versions remain available for historical reads.
 */
async function _replaceCompositions(orgId, parentResourceId, compositions, dbClient = db, requestedEffectiveFrom) {
    const compositionColumns = await getCompositionColumns(dbClient);
    const defaultEffectiveFrom = toDateOnly(requestedEffectiveFrom);
    const rowDates = compositions
        .map(c => c.effective_from)
        .filter(Boolean)
        .map(date => toDateOnly(date));
    const effectiveFrom = rowDates[0] || defaultEffectiveFrom;

    if (rowDates.some(date => date !== effectiveFrom)) {
        throw new AppError('All composition rows in one version must use the same effective_from date', 400);
    }

    // Versions are append-only. Reusing an effective date would rewrite the
    // composition that applies on that date, so every new version must start
    // after the latest recorded version.
    const latestVersion = await dbClient('res_compositions')
        .where(compositionColumns.item, parentResourceId)
        .max('effective_from as latest_effective_from')
        .first();
    if (latestVersion?.latest_effective_from) {
        const latestDate = toDateOnly(latestVersion.latest_effective_from);
        if (effectiveFrom <= latestDate) {
            throw new AppError(
                `Composition effective_from ${effectiveFrom} must be later than the latest version ${latestDate}`,
                400
            );
        }
    }

    const componentIds = new Set();
    for (const c of compositions) {
        if (!c.component_resource_id || c.quantity === undefined || c.quantity === null || c.quantity === '' || !c.unit_code) {
            throw new AppError('Each composition row must have component_resource_id, quantity, and unit_code', 400);
        }
        if (!Number.isFinite(Number(c.quantity)) || Number(c.quantity) < 0) {
            throw new AppError('Composition quantity must be a non-negative number', 400);
        }
        if (componentIds.has(Number(c.component_resource_id))) {
            throw new AppError(
                `Component resource id ${c.component_resource_id} appears more than once in the same composition version`,
                400
            );
        }
        componentIds.add(Number(c.component_resource_id));
        // App-level validation
        let inputUnit;
        try {
            inputUnit = getUnit(c.unit_code);
        } catch (err) {
            throw new AppError(err.message, 400);
        }

        const comp = await dbClient('res_resources').where({ id: c.component_resource_id, org_id: orgId }).first();
        if (!comp) throw new AppError(`Component resource id ${c.component_resource_id} not found in your organization`, 400);
        if (!['material', 'labour', 'item'].includes(comp.type)) {
            throw new AppError(`Component resource "${comp.name}" has an unsupported type`, 400);
        }

        // Unit category restriction removed — any unit is allowed in compositions

        // This check runs before any delete/insert and uses the same
        // transaction client as the eventual write.
        if (await detectCycle(parentResourceId, c.component_resource_id, dbClient, effectiveFrom)) {
            throw new AppError(
                `Composition would create a circular reference: ${parentResourceId} -> ${c.component_resource_id}`,
                400
            );
        }
    }

    // Close the currently active version before inserting the replacement.
    // An empty composition therefore represents an intentional clear rather
    // than falling back to an older version.
    await dbClient('res_compositions')
        .where(compositionColumns.item, parentResourceId)
        .andWhere('effective_from', '<', effectiveFrom)
        .andWhere(function () {
            this.whereNull('effective_to').orWhere('effective_to', '>=', effectiveFrom);
        })
        .update({
            effective_to: subtractOneDay(effectiveFrom),
            is_active: 0
        });

    if (compositions.length > 0) {
        const rows = compositions.map(c => ({
            [compositionColumns.item]: parentResourceId,
            [compositionColumns.component]: c.component_resource_id,
            quantity: c.quantity,
            unit_code: c.unit_code,
            effective_from: effectiveFrom,
            effective_to: null,
            is_active: 1
        }));
        await dbClient('res_compositions').insert(rows);
        
    }
}

/**
 * Force-replace compositions for a resource by wiping all existing rows and
 * reinserting. Used by the bulk grid-save flow where the user edits the
 * ingredient list inline and just wants the current state persisted — no
 * versioned history required.
 */
async function _forceReplaceCompositions(orgId, parentResourceId, compositions, dbClient = db, requestedEffectiveFrom) {
    const compositionColumns = await getCompositionColumns(dbClient);
    const effectiveFrom = toDateOnly(requestedEffectiveFrom) || toDateOnly(new Date());

    // Validate each component (no date check, no cycle check bypass — still safe)
    const componentIds = new Set();
    for (const c of compositions) {
        if (!c.component_resource_id || c.quantity === undefined || c.quantity === null || c.quantity === '' || !c.unit_code) {
            throw new AppError('Each composition row must have component_resource_id, quantity, and unit_code', 400);
        }
        if (!Number.isFinite(Number(c.quantity)) || Number(c.quantity) < 0) {
            throw new AppError('Composition quantity must be a non-negative number', 400);
        }
        if (componentIds.has(Number(c.component_resource_id))) {
            throw new AppError(
                `Component resource id ${c.component_resource_id} appears more than once in the same composition version`,
                400
            );
        }
        componentIds.add(Number(c.component_resource_id));

        const comp = await dbClient('res_resources').where({ id: c.component_resource_id, org_id: orgId }).first();
        if (!comp) throw new AppError(`Component resource id ${c.component_resource_id} not found in your organization`, 400);

        if (await detectCycle(parentResourceId, c.component_resource_id, dbClient, effectiveFrom)) {
            throw new AppError(
                `Composition would create a circular reference: ${parentResourceId} -> ${c.component_resource_id}`,
                400
            );
        }
    }

    // Wipe all existing compositions for this resource and reinsert
    await dbClient('res_compositions').where(compositionColumns.item, parentResourceId).del();

    if (compositions.length > 0) {
        const rows = compositions.map(c => ({
            [compositionColumns.item]: parentResourceId,
            [compositionColumns.component]: c.component_resource_id,
            quantity: c.quantity,
            unit_code: c.unit_code,
            effective_from: effectiveFrom,
            effective_to: null,
            is_active: 1
        }));
        await dbClient('res_compositions').insert(rows);
    }
}

async function ensureProjectRateFromMaster(orgId, masterResource, projectResourceId, importDate, trx) {
    const existingRate = await trx('res_rates')
        .where({ resource_id: projectResourceId, is_active: 1 })
        .whereNotNull('rate')
        .first('id');
    if (existingRate) return;

    // 1. Direct fast lookup for manual rate (instant indexed query for materials/labour)
    let resolvedRate = null;
    try {
        resolvedRate = await findEffectiveManualRate(orgId, masterResource.id, importDate, trx, null);
    } catch { }

    // 2. If no manual rate (e.g. composite item computed from recipes), resolve computed rate
    if (!resolvedRate || resolvedRate.rate === null || resolvedRate.rate === undefined) {
        try {
            resolvedRate = await resolveRateInternal(
                orgId,
                masterResource.id,
                importDate,
                trx,
                new Set(),
                null,
                null
            );
        } catch { }
    }

    if (resolvedRate && resolvedRate.rate !== null && resolvedRate.rate !== undefined) {
        await trx('res_rates').insert({
            resource_id: projectResourceId,
            rate: Number(resolvedRate.rate),
            unit_code: resolvedRate.unitCode || resolvedRate.unit_code || masterResource.base_unit_code,
            effective_from: importDate,
            effective_to: null,
            is_active: 1,
            remarks: 'Imported from master catalog'
        });
    }
}

/**
 * Import a resource (item, material, labour) into a project by creating its
 * project resource row, snapshotting any item recipe/compositions recursively,
 * and initializing its rate in res_rates from the master catalog.
 */
export async function importResourceToProject(orgId, projectId, masterResourceId, effectiveFrom) {
    await ensureProjectExists(orgId, projectId);
    const masterResource = await ensureResourceExists(orgId, masterResourceId);
    if (masterResource.project_id) {
        throw new AppError('Import must start from a master resource', 400);
    }

    const importDate = toDateOnly(effectiveFrom);
    return db.transaction(async trx => {
        const compositionColumns = await getCompositionColumns(trx);
        const projectResourceId = await findOrCreateProjectResource(orgId, masterResource.id, projectId, trx);

        // 1. Track all resources created/referenced during this import
        const importedPairs = [[masterResource, projectResourceId]];

        // 2. Snapshot composition recipes first
        const copyItemComposition = async (masterId, projectIdForItem, path = new Set()) => {
            if (path.has(Number(masterId))) {
                throw new AppError(`Circular composition detected while importing resource ${masterId}`, 400);
            }

            const existingProjectComposition = await trx('res_compositions')
                .where(compositionColumns.item, projectIdForItem)
                .first('id');
            if (existingProjectComposition) return;

            const masterComposition = await trx('res_compositions')
                .where(compositionColumns.item, masterId)
                .andWhere('effective_from', '<=', importDate)
                .andWhere(function () {
                    this.whereNull('effective_to').orWhere('effective_to', '>=', importDate);
                })
                .select(
                    `${compositionColumns.component} as component_resource_id`,
                    'quantity',
                    'unit_code'
                );

            if (masterComposition.length === 0) return;

            const nextPath = new Set(path);
            nextPath.add(Number(masterId));
            const rows = [];
            for (const composition of masterComposition) {
                const component = await ensureResourceExists(orgId, composition.component_resource_id, trx);
                const projectComponentId = await findOrCreateProjectResource(
                    orgId,
                    component.id,
                    projectId,
                    trx
                );

                importedPairs.push([component, projectComponentId]);

                await copyItemComposition(component.id, projectComponentId, nextPath);

                rows.push({
                    [compositionColumns.item]: projectIdForItem,
                    [compositionColumns.component]: projectComponentId,
                    quantity: composition.quantity,
                    unit_code: composition.unit_code,
                    effective_from: importDate,
                    effective_to: null,
                    is_active: 1
                });
            }

            await trx('res_compositions').insert(rows);
        };

        await copyItemComposition(masterResource.id, projectResourceId);

        // 3. Resolve and copy rates for all imported resources now that the composition tree is fully in place
        for (const [res, projId] of importedPairs) {
            await ensureProjectRateFromMaster(orgId, res, projId, importDate, trx);
        }

        return projectResourceId;
    });
}

export const importItemToProject = importResourceToProject;

/**
 * Public API to replace all compositions for an item resource.
 */
export async function setCompositions(orgId, resourceId, compositions, effectiveFrom, projectId = null) {
    if (projectId) await ensureProjectExists(orgId, projectId);
    const scopedItemId = projectId
        ? await resolveProjectResourceId(orgId, resourceId, projectId)
        : resourceId;
    const resource = await ensureResourceExists(orgId, scopedItemId);
    // Type restriction removed — compositions allowed for any resource type

    if (projectId) {
        const imported = await db('res_resources')
            .where({ id: scopedItemId, org_id: orgId, project_id: projectId })
            .first('id');
        if (!imported) {
            throw new AppError('Import this item into the project before editing its project composition', 400);
        }
    }

    await db.transaction(async (trx) => {
        const rows = projectId
            ? await Promise.all(compositions.map(async composition => ({
                ...composition,
                component_resource_id: await findOrCreateProjectResource(
                    orgId,
                    composition.component_resource_id,
                    projectId,
                    trx
                )
            })))
            : compositions;
        await _replaceCompositions(orgId, scopedItemId, rows, trx, effectiveFrom);
    });
    return true;
}

/**
 * Return every composition row/version for an item, newest version first.
 * Consumers can group rows by effective_from to render a version timeline.
 */
export async function getCompositionHistory(orgId, resourceId, projectId = null) {
    if (projectId) await ensureProjectExists(orgId, projectId);
    const scopedResourceId = projectId
        ? await resolveProjectResourceId(orgId, resourceId, projectId)
        : resourceId;
    const resource = await ensureResourceExists(orgId, scopedResourceId);
    if (resource.type !== 'item') return [];

    const compositionColumns = await getCompositionColumns(db);
    const rows = await db('res_compositions as c')
        .join('res_resources as component', `c.${compositionColumns.component}`, 'component.id')
        .where(`c.${compositionColumns.item}`, scopedResourceId)
        .andWhere('component.org_id', orgId)
        .select(
            'c.id',
            `c.${compositionColumns.item} as parent_resource_id`,
            `c.${compositionColumns.component} as component_resource_id`,
            'component.name as component_name',
            'component.code as component_code',
            'c.quantity',
            'c.unit_code',
            'c.effective_from',
            'c.effective_to',
            'c.is_active'
        )
        .orderBy('c.effective_from', 'desc')
        .orderBy('c.id', 'desc');

    return rows.map(row => ({
        ...row,
        effective_from: toIsoDate(row.effective_from),
        effective_to: toIsoDate(row.effective_to)
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit Conversions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a named unit conversion to a resource (e.g. 1 Bag = 50 kg).
 */
export async function addConversion(orgId, resourceId, { name, quantity, unit_code }) {
    const resource = await ensureResourceExists(orgId, resourceId);
    if (!name || !quantity || !unit_code) {
        throw new AppError('name, quantity, and unit_code are required for a conversion', 400);
    }
    // App-level validation
    let targetUnit;
    try {
        targetUnit = getUnit(unit_code);
    } catch (err) {
        throw new AppError(err.message, 400);
    }

    // Validate that the conversion target matches the resource's base unit category
    const resourceBaseUnit = getUnit(resource.base_unit_code);
    if (targetUnit.type !== resourceBaseUnit.type) {
        throw new AppError(`Incompatible unit category: Conversion target unit "${unit_code}" (${targetUnit.type}) must match resource base unit "${resource.base_unit_code}" (${resourceBaseUnit.type})`, 400);
    }

    const [insertId] = await db('res_conversions').insert({
        org_id: orgId,
        resource_id: resourceId,
        name,
        quantity,
        unit_code
    });
    return insertId;
}

/**
 * Remove a specific conversion by its own id.
 * Verifies that the conversion actually belongs to a resource in the user's org.
 */
export async function removeConversion(orgId, conversionId) {
    const conversion = await db('res_conversions as rc')
        .join('res_resources as r', 'rc.resource_id', 'r.id')
        .where('rc.id', conversionId)
        .andWhere('r.org_id', orgId)
        .select('rc.id')
        .first();

    if (!conversion) throw new AppError('Conversion not found in your organization', 404);

    await db('res_conversions').where({ id: conversionId }).del();
    return true;
}

export async function bulkInsertResources(orgId, resources) {
    if (!Array.isArray(resources)) {
        throw new AppError('Input must be an array of resources', 400);
    }

    const report = {
        successCount: 0,
        insertedIds: [],
        errors: []
    };

    // Run in transaction to guarantee consistency
    await db.transaction(async (trx) => {
        for (let i = 0; i < resources.length; i++) {
            const res = resources[i];
            const name = (res.name || res.Name || res['resource_name'] || res['Resource Name'] || res['item_name'] || res['Item Name'] || '').toString().trim();
            const code = (res.code || res.Code || res['resource_code'] || res['Resource Code'] || res['item_code'] || '') ? (res.code || res.Code || res['resource_code'] || res['Resource Code'] || res['item_code']).toString().trim() : null;
            const type = (res.type || res.Type || res['resource_type'] || res['Resource Type'] || 'material').toString().toLowerCase().trim();
            const base_unit_code = (res.base_unit_code || res.unit_code || res.unit || res.Unit || res['Base Unit'] || res['base_unit'] || res['Unit Code'] || res.base_unit_id || '').toString().trim();
            const description = (res.description || res.Description) ? (res.description || res.Description).toString().trim() : null;
            const remarks = (res.remarks || res.Remarks) ? (res.remarks || res.Remarks).toString().trim() : null;
            const rawRate = res.rate !== undefined ? res.rate : (res.Rate !== undefined ? res.Rate : (res['unit_price'] || res['price'] || res['Price']));
            const rate = (rawRate !== undefined && rawRate !== null && rawRate !== '') ? Number(rawRate) : undefined;
            const rate_unit_code = (res.rate_unit_code || res['Rate Unit'] || res['rate_unit'] || base_unit_code || '').toString().trim();
            const rate_effective_from = res.rate_effective_from || res.effective_from || res['Effective Date'] || res['effective_date'] || null;
            const rate_remarks = res.rate_remarks || res.remarks || null;
            const compositions = res.compositions;
            const conversions = res.conversions;
            const effective_from = res.effective_from;

            try {
                if (!name || !type || !base_unit_code) {
                    throw new Error('name, type, and base_unit_code are required');
                }
                if (!['material', 'item', 'labour'].includes(type)) {
                    throw new Error('type must be "material", "item", or "labour"');
                }

                // App-level validation
                const unit = getUnit(base_unit_code);

                // Insert resource
                const [insertId] = await trx('res_resources').insert({
                    org_id: orgId,
                    project_id: null,
                    parent_id: null,
                    name,
                    code: code || null,
                    type,
                    base_unit_code,
                    description: description || null,
                    remarks: remarks || null
                });

                if (rate !== undefined && !Number.isNaN(rate)) {
                    await _writeManualRateVersion(orgId, {
                        id: insertId,
                        type,
                        base_unit_code
                    }, {
                        rate,
                        unit_code: rate_unit_code || base_unit_code,
                        effective_from: rate_effective_from,
                        remarks: rate_remarks || remarks
                    }, trx);
                }

                // Handle custom conversions if provided
                if (Array.isArray(conversions) && conversions.length > 0) {
                    for (const conv of conversions) {
                        const { name: convName, quantity: convQty, unit_code: convUnitCode } = conv;
                        if (!convName || !convQty || !convUnitCode) {
                            throw new Error('Each conversion must have name, quantity, and unit_code');
                        }
                        
                        const convUnit = getUnit(convUnitCode);
                        if (convUnit.type !== unit.type) {
                            throw new Error(`Incompatible unit category: Conversion target unit "${convUnitCode}" (${convUnit.type}) must match resource base unit "${base_unit_code}" (${unit.type})`);
                        }

                        await trx('res_conversions').insert({
                            org_id: orgId,
                            resource_id: insertId,
                            name: convName,
                            quantity: convQty,
                            unit_code: convUnitCode
                        });
                    }
                }

                // Handle compositions if provided (all resource types allowed)
                if (Array.isArray(compositions) && compositions.length > 0) {
                    // All composition writes go through the same validator as
                    // normal create/update requests. This includes the
                    // transaction-scoped cycle check and effective-date logic.
                    await _replaceCompositions(orgId, insertId, compositions, trx, effective_from);
                }

                report.successCount++;
                report.insertedIds.push(insertId);

            } catch (err) {
                // Report the error details
                report.errors.push({
                    index: i,
                    name: name || 'Unknown',
                    error: err.message
                });
                // Throw to trigger rollback
                throw err;
            }
        }
    }).catch(err => {
        console.warn("Bulk import transaction rolled back due to error:", err.message);
    });

    return report;
}

export async function bulkValidateResources(orgId, resources) {
    if (!Array.isArray(resources)) {
        throw new AppError('Invalid resources data, array expected', 400);
    }

    const response = { duplicates: [], invalid_types: [], missing_fields: [], valid_count: 0 };
    const inputNames = new Set();
    const inputCodes = new Set();

    resources.forEach((r, idx) => {
        const name = (r.name || r.Name || r['resource_name'] || r['Resource Name'] || r['item_name'] || r['Item Name'] || '').toString().trim();
        const code = (r.code || r.Code || r['resource_code'] || r['Resource Code'] || r['item_code'] || '').toString().trim();
        const type = (r.type || r.Type || r['resource_type'] || r['Resource Type'] || '').toString().trim().toLowerCase();
        const unit = (r.base_unit_code || r.unit_code || r.unit || r.Unit || r['Base Unit'] || r['base_unit'] || r['Unit Code'] || r.base_unit_id || '').toString().trim();

        if (!name || !type || !unit) {
            response.missing_fields.push({
                row: idx + 1,
                name: name || null,
                reason: `Missing required field(s): ${[!name && 'Name', !type && 'Type', !unit && 'Unit'].filter(Boolean).join(', ')}`
            });
        }

        if (type && !['material', 'item', 'labour'].includes(type)) {
            response.invalid_types.push({
                row: idx + 1,
                type,
                reason: 'Type must be "material", "item", or "labour"'
            });
        }

        if (name) inputNames.add(name.toLowerCase());
        if (code) inputCodes.add(code.toLowerCase());
    });

    let existingResources = [];
    if (inputNames.size > 0 || inputCodes.size > 0) {
        existingResources = await db('res_resources')
            .where({ org_id: orgId })
            .whereNull('project_id')
            .where(function () {
                if (inputNames.size > 0) this.whereIn(db.raw('LOWER(name)'), Array.from(inputNames));
                if (inputCodes.size > 0) this.orWhereIn(db.raw('LOWER(code)'), Array.from(inputCodes));
            })
            .select('name', 'code');
    }

    const existingNameSet = new Set(existingResources.map(r => r.name?.toLowerCase()).filter(Boolean));
    const existingCodeSet = new Set(existingResources.map(r => r.code?.toLowerCase()).filter(Boolean));

    resources.forEach((r, index) => {
        const rowNum = index + 1;
        const name = (r.name || r.Name || r['resource_name'] || r['Resource Name'] || r['item_name'] || r['Item Name'] || '').toString().trim();
        const code = (r.code || r.Code || r['resource_code'] || r['Resource Code'] || r['item_code'] || '').toString().trim();
        const type = (r.type || r.Type || r['resource_type'] || r['Resource Type'] || '').toString().trim().toLowerCase();
        const unit = (r.base_unit_code || r.unit_code || r.unit || r.Unit || r['Base Unit'] || r['base_unit'] || r['Unit Code'] || r.base_unit_id || '').toString().trim();

        let hasError = false;

        if (!name || !type || !unit || !['material', 'item', 'labour'].includes(type)) {
            hasError = true;
        }

        if (name && existingNameSet.has(name.toLowerCase())) {
            response.duplicates.push({ row: rowNum, name, reason: `Resource with name "${name}" already exists` });
            hasError = true;
        }
        if (code && existingCodeSet.has(code.toLowerCase())) {
            response.duplicates.push({ row: rowNum, code, reason: `Resource with code "${code}" already exists` });
            hasError = true;
        }

        if (!hasError) {
            response.valid_count++;
        }
    });

    return response;
}

export async function bulkUpdateResources(orgId, resources) {
    if (!Array.isArray(resources)) {
        throw new AppError('Input must be an array of resources', 400);
    }

    const report = {
        successCount: 0,
        updatedIds: [],
        errors: []
    };

    await db.transaction(async (trx) => {
        for (let i = 0; i < resources.length; i++) {
            const res = resources[i];
            const {
                id,
                name,
                code,
                type,
                base_unit_code,
                description,
                remarks,
                compositions,
                effective_from,
                rate,
                rate_unit_code,
                rate_effective_from,
                rate_remarks
            } = res;

            try {
                if (!id) {
                    throw new Error('Resource ID is required for update');
                }

                const existing = await trx('res_resources').where({ id, org_id: orgId }).first();
                if (!existing) {
                    throw new Error(`Resource with ID ${id} not found in this organization`);
                }

                const updates = {};
                if (name !== undefined) updates.name = name;
                if (code !== undefined) updates.code = code || null;
                
                let activeType = existing.type;
                if (type !== undefined && type !== existing.type) {
                    if (!['material', 'item', 'labour'].includes(type)) {
                        throw new Error('type must be "material", "item", or "labour"');
                    }
                    if (type === 'item') {
                        const compositionColumns = await getCompositionColumns(trx);
                        const usedAsComponent = await trx('res_compositions')
                            .where(compositionColumns.component, id)
                            .count('id as cnt').first();
                        if (parseInt(usedAsComponent.cnt) > 0) {
                            throw new Error('Cannot change type to "item": resource is used as a component in other composite item recipes');
                        }
                    }
                    if (existing.type === 'item') {
                        const compositionColumns = await getCompositionColumns(trx);
                        await trx('res_compositions').where(compositionColumns.item, id).del();
                    }
                    updates.type = type;
                    activeType = type;
                }

                let activeBaseUnitCode = existing.base_unit_code;
                if (base_unit_code !== undefined && base_unit_code !== existing.base_unit_code) {
                    let newUnit;
                    try {
                        newUnit = getUnit(base_unit_code);
                    } catch (err) {
                        throw new Error(err.message);
                    }

                    if (existing.base_unit_code) {
                        const oldUnit = getUnit(existing.base_unit_code);
                        if (newUnit.type !== oldUnit.type) {
                            throw new Error(
                                `Cannot change base unit category from "${existing.base_unit_code}" (${oldUnit.type}) to "${base_unit_code}" (${newUnit.type}). Unit changes must remain within the same measurement category (e.g. grams to kilograms, meters to centimeters).`
                            );
                        }
                    }

                    updates.base_unit_code = base_unit_code;
                    activeBaseUnitCode = base_unit_code;
                }
                if (description !== undefined) updates.description = description || null;
                if (remarks !== undefined) updates.remarks = remarks || null;

                if (Object.keys(updates).length > 0) {
                    await trx('res_resources').where({ id, org_id: orgId }).update(updates);
                }

                if (compositions !== undefined) {
                    await _forceReplaceCompositions(orgId, id, compositions, trx, effective_from);
                }

                if (rate !== undefined && rate !== null && rate !== '') {
                    await _writeManualRateVersion(orgId, {
                        id,
                        type: activeType,
                        base_unit_code: activeBaseUnitCode
                    }, {
                        rate,
                        unit_code: rate_unit_code || activeBaseUnitCode,
                        effective_from: rate_effective_from,
                        remarks: rate_remarks || remarks
                    }, trx);
                }

                report.successCount++;
                report.updatedIds.push(id);

            } catch (err) {
                report.errors.push({
                    index: i,
                    id: id || 'Unknown',
                    name: name || 'Unknown',
                    error: err.message
                });
                throw err;
            }
        }
    }).catch(err => {
        console.warn("Bulk update transaction rolled back due to error:", err.message);
    });

    return report;
}

/**
 * Reverts an item back to a computed rate by closing its active manual
 * rate as of a given date, without inserting a replacement row.
 * Only valid for resources of type "item" — materials/labour have no
 * fallback pricing source, so they cannot be cleared.
 */
/**
 * Reverts an item back to a computed rate (in master catalog) or reverts a
 * project resource back to the master catalog rate by adding a new fallback rate row.
 */
export async function clearManualRate(orgId, resourceId, effectiveFrom, projectId = null, mode = null) {
    if (projectId) await ensureProjectExists(orgId, projectId);
    const scopedResourceId = projectId
        ? await resolveProjectResourceId(orgId, resourceId, projectId)
        : resourceId;
    const resource = await ensureResourceExists(orgId, scopedResourceId);
    const clearFrom = toDateOnly(effectiveFrom);

    return db.transaction(async (trx) => {
        const activeRateQuery = trx('res_rates')
            .where({ resource_id: scopedResourceId, is_active: 1 });

        const activeRate = await activeRateQuery
            .orderBy('id', 'desc')
            .forUpdate()
            .first('id', 'effective_from');

        if (projectId && mode !== 'computed') {
            // Mode: Revert to master catalog rate snapshot (freezes project rate to master value on clearFrom date)
            if (!resource.parent_id) {
                throw new AppError('Cannot revert to master: this project resource is not linked to a master parent item', 400);
            }
            const masterId = resource.parent_id;
            const masterResource = await ensureResourceExists(orgId, masterId, trx);
            let resolvedMasterRate = null;
            try {
                resolvedMasterRate = await resolveRateInternal(
                    orgId,
                    masterId,
                    clearFrom,
                    trx,
                    new Set(),
                    null,
                    null
                );
            } catch {
                resolvedMasterRate = await findEffectiveManualRate(orgId, masterId, clearFrom, trx, null);
            }

            if (!resolvedMasterRate || resolvedMasterRate.rate === null || resolvedMasterRate.rate === undefined) {
                throw new AppError(`Master resource "${masterResource.name}" has no rate to fallback to`, 400);
            }

            const snapshotUnitCode = resolvedMasterRate.unitCode || resolvedMasterRate.unit_code || masterResource.base_unit_code;
            const rateUnit = getUnit(snapshotUnitCode);
            const resourceUnit = getUnit(resource.base_unit_code);
            if (rateUnit.type !== resourceUnit.type) {
                throw new AppError(
                    `Master rate unit "${snapshotUnitCode}" (${rateUnit.type}) is incompatible with project resource base unit "${resource.base_unit_code}" (${resourceUnit.type})`,
                    400
                );
            }

            // Enforce date validation: revert date must be strictly after the current active rate start date
            if (activeRate) {
                const activeFrom = toDateOnly(activeRate.effective_from);
                if (clearFrom <= activeFrom) {
                    throw new AppError(
                        `Revert effective date (${clearFrom}) must be at least one day after the current active rate start date (${activeFrom}). To change past rates, use "Edit Version".`,
                        400
                    );
                }

                // Close active rate
                await trx('res_rates').where({ id: activeRate.id }).update({
                    is_active: 0,
                    effective_to: subtractOneDay(clearFrom)
                });
            }

            // Insert new independent frozen rate snapshot row for the project
            await trx('res_rates').insert({
                resource_id: scopedResourceId,
                rate: Number(resolvedMasterRate.rate),
                unit_code: resolvedMasterRate.unitCode || resolvedMasterRate.unit_code || masterResource.base_unit_code,
                effective_from: clearFrom,
                effective_to: null,
                is_active: 1,
                remarks: 'Reverted to master catalog rate snapshot'
            });

            // Fix any corrupted/inverted date ranges on this resource
            await trx('res_rates')
                .where({ resource_id: scopedResourceId })
                .whereRaw('effective_to IS NOT NULL AND effective_to < effective_from')
                .update({
                    effective_to: trx.raw('effective_from')
                });

            return true;
        }

        // Mode: Revert to computed recipe rate (applicable to items in master catalog or in projects)
        if (resource.type !== 'item') {
            throw new AppError('Only items can revert to a computed rate; materials and labour require a manual rate', 400);
        }

        if (activeRate) {
            const activeFrom = toDateOnly(activeRate.effective_from);
            const effectiveTo = clearFrom <= activeFrom ? activeFrom : subtractOneDay(clearFrom);
            await trx('res_rates').where({ resource_id: scopedResourceId, is_active: 1 }).update({
                is_active: 0,
                effective_to: effectiveTo
            });
        }

        // rate stays NULL — marks "computed from recipe"
        await trx('res_rates').insert({
            resource_id: scopedResourceId,
            rate: null,
            unit_code: resource.base_unit_code,
            effective_from: clearFrom,
            effective_to: null,
            is_active: 1,
            remarks: 'Reverted to computed recipe rate'
        });

        // Fix any corrupted/inverted date ranges on this resource
        await trx('res_rates')
            .where({ resource_id: scopedResourceId })
            .whereRaw('effective_to IS NOT NULL AND effective_to < effective_from')
            .update({
                effective_to: trx.raw('effective_from')
            });

        return true;
    });
}

export default {
    getResources,
    getResourceById,
    getResolvedRate,
    getResolvedRates,
    addRate,
    updateRate,
    getRateHistory,
    createResource,
    updateResource,
    deleteResource,
    initializeResourceSchema,
    findOrCreateProjectResource,
    importResourceToProject,
    importItemToProject,
    setCompositions,
    getCompositionHistory,
    addConversion,
    removeConversion,
    bulkInsertResources,
    bulkValidateResources,
    bulkUpdateResources,
    clearManualRate,
    getCompositionColumns
};
