import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import S3Service from '../../shared/s3Service.js';

/**
 * Automatically checks and initializes drawings tables
 */
export async function initializeDrawingsSchema() {
    const hasCategoriesTable = await db.schema.hasTable('proj_drawing_categories');
    if (!hasCategoriesTable) {
        await db.schema.createTable('proj_drawing_categories', (table) => {
            table.increments('id').primary();
            table.integer('project_id').unsigned().notNullable().references('id').inTable('proj_projects').onDelete('CASCADE');
            table.string('name').notNullable();
            table.string('icon_key').defaultTo('Folder');
            table.integer('sort_order').defaultTo(0);
            table.timestamps(true, true);
        });
        console.log('Created table: proj_drawing_categories');
    }

    const hasDrawingsTable = await db.schema.hasTable('proj_drawings');
    if (!hasDrawingsTable) {
        await db.schema.createTable('proj_drawings', (table) => {
            table.increments('id').primary();
            table.integer('drawing_group_id').unsigned().nullable().references('id').inTable('proj_drawings').onDelete('CASCADE');
            table.integer('project_id').unsigned().notNullable().references('id').inTable('proj_projects').onDelete('CASCADE');
            table.integer('category_id').unsigned().notNullable().references('id').inTable('proj_drawing_categories').onDelete('CASCADE');
            table.string('title').notNullable();
            table.integer('revision_number').unsigned().notNullable().defaultTo(1);
            table.string('dwg_url', 512).nullable();
            table.string('pdf_url', 512).nullable();
            table.text('description').nullable();
            table.integer('sort_order').defaultTo(0);
            table.integer('uploaded_by').unsigned().notNullable().references('user_id').inTable('iam_users').onDelete('CASCADE');
            table.timestamp('uploaded_at').defaultTo(db.fn.now());
            table.timestamps(true, true);
        });
        console.log('Created table: proj_drawings');
    }
}

/**
 * Extracts S3 key from S3 URL
 */
function getS3KeyFromUrl(url) {
    if (!url) return null;
    const marker = '.amazonaws.com/';
    const index = url.indexOf(marker);
    if (index !== -1) {
        return url.substring(index + marker.length);
    }
    return null;
}

/**
 * Delete S3 files associated with a drawing row
 */
async function deleteDrawingRowS3Files(row) {
    if (!row) return;
    try {
        if (row.dwg_url) {
            const key = getS3KeyFromUrl(row.dwg_url);
            if (key) await S3Service.deleteFile(key);
        }
        if (row.pdf_url) {
            const key = getS3KeyFromUrl(row.pdf_url);
            if (key) await S3Service.deleteFile(key);
        }
    } catch (e) {
        console.error(`[S3 Delete Warning] Failed to delete S3 file for drawing row ${row.id}:`, e.message);
    }
}

/**
 * Presign S3 URL if present
 */
async function presignUrl(url) {
    if (!url) return null;
    const key = getS3KeyFromUrl(url);
    if (!key) return url;
    try {
        return await S3Service.getFileSignedUrl(key);
    } catch (e) {
        console.error(`[S3 Presign Warning] Failed to generate signed URL for key ${key}:`, e.message);
        return url;
    }
}

// ─── Categories Services ──────────────────────────────────────────────────────

export async function getCategories(projectId) {
    return await db('proj_drawing_categories')
        .where('project_id', projectId)
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'asc');
}

export async function createCategory(projectId, { name, icon_key }) {
    if (!name || !name.trim()) {
        throw new AppError('Category name is required', 400);
    }
    
    // Get highest sort order
    const maxOrderRow = await db('proj_drawing_categories')
        .where('project_id', projectId)
        .max('sort_order as max_order')
        .first();
    const nextOrder = (maxOrderRow?.max_order || 0) + 1;

    const [id] = await db('proj_drawing_categories').insert({
        project_id: projectId,
        name: name.trim(),
        icon_key: icon_key || 'Folder',
        sort_order: nextOrder
    });
    return id;
}

export async function updateCategory(projectId, categoryId, { name, icon_key }) {
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (icon_key !== undefined) updates.icon_key = icon_key;

    if (Object.keys(updates).length === 0) return true;

    const affected = await db('proj_drawing_categories')
        .where({ id: categoryId, project_id: projectId })
        .update(updates);

    if (affected === 0) {
        throw new AppError('Category not found or does not belong to this project', 404);
    }
    return true;
}

export async function deleteCategory(projectId, categoryId, confirm = false) {
    // Check if category exists
    const category = await db('proj_drawing_categories')
        .where({ id: categoryId, project_id: projectId })
        .first();
    if (!category) {
        throw new AppError('Category not found', 404);
    }

    // Count drawings linked to this category
    // Since revisions are separate rows, we group by drawing_group_id to get the unique drawing entity count
    const uniqueDrawingsCountRow = await db('proj_drawings')
        .where({ category_id: categoryId })
        .countDistinct('drawing_group_id as count')
        .first();
    const count = parseInt(uniqueDrawingsCountRow?.count || 0);

    if (count > 0 && !confirm) {
        return { hasDrawings: true, count };
    }

    // If we are deleting, fetch all drawing rows in this category first to clean up S3 files
    const rows = await db('proj_drawings').where('category_id', categoryId);
    for (const row of rows) {
        await deleteDrawingRowS3Files(row);
    }

    // Delete category (cascades database deletes to drawings via FK)
    await db('proj_drawing_categories')
        .where({ id: categoryId, project_id: projectId })
        .del();

    return { success: true };
}

// ─── Drawings Services ────────────────────────────────────────────────────────

export async function getDrawings(projectId, categoryId) {
    // 1. Get category name for naming prefix
    const category = await db('proj_drawing_categories')
        .where({ id: categoryId, project_id: projectId })
        .first();
    if (!category) {
        throw new AppError('Category not found', 404);
    }

    // 2. Fetch the latest row for each drawing group in this category
    const subquery = db('proj_drawings')
        .select('drawing_group_id', db.raw('MAX(revision_number) as max_rev'))
        .where('category_id', categoryId)
        .groupBy('drawing_group_id')
        .as('latest');

    const drawingsList = await db('proj_drawings as d')
        .join(subquery, function() {
            this.on('d.drawing_group_id', '=', 'latest.drawing_group_id')
                .andOn('d.revision_number', '=', 'latest.max_rev');
        })
        .join('iam_users as u', 'd.uploaded_by', 'u.user_id')
        .select(
            'd.*',
            'u.user_name as uploader_name',
            'u.email as uploader_email'
        )
        .orderBy('d.sort_order', 'asc')
        .orderBy('d.id', 'asc');

    // 3. For each drawing, fetch its complete revision history sorted by revision_number DESC
    const result = [];
    for (let i = 0; i < drawingsList.length; i++) {
        const drawing = drawingsList[i];
        
        // Fetch uploader info and fields for all revisions in this group
        const revisions = await db('proj_drawings as d')
            .join('iam_users as u', 'd.uploaded_by', 'u.user_id')
            .where('d.drawing_group_id', drawing.drawing_group_id)
            .select(
                'd.id',
                'd.revision_number',
                'd.dwg_url',
                'd.pdf_url',
                'd.description',
                'd.uploaded_at',
                'u.user_name as uploader_name',
                'u.email as uploader_email'
            )
            .orderBy('d.revision_number', 'desc');

        // Presign URLs on the fly
        const latestDwgUrl = await presignUrl(drawing.dwg_url);
        const latestPdfUrl = await presignUrl(drawing.pdf_url);
        
        const mappedRevisions = [];
        for (const r of revisions) {
            mappedRevisions.push({
                id: r.id,
                rev: `R${r.revision_number}`,
                revisionNumber: r.revision_number,
                dwgUrl: await presignUrl(r.dwg_url),
                pdfUrl: await presignUrl(r.pdf_url),
                description: r.description || '',
                uploadedAt: r.uploaded_at,
                uploaderName: r.uploader_name,
                uploaderEmail: r.uploader_email
            });
        }

        result.push({
            id: drawing.drawing_group_id,
            latestRowId: drawing.id,
            title: drawing.title,
            sort_order: drawing.sort_order,
            latestRevision: drawing.revision_number,
            latestDwgUrl,
            latestPdfUrl,
            latestDescription: drawing.description,
            latestUploadedAt: drawing.uploaded_at,
            latestUploaderName: drawing.uploader_name,
            revisions: mappedRevisions
        });
    }

    return result;
}

export async function uploadDrawingRecord(projectId, { categoryId, title, description, drawingGroupId, dwgFile, pdfFile, userId }) {
    // Validate category belongs to project
    const category = await db('proj_drawing_categories')
        .where({ id: categoryId, project_id: projectId })
        .first();
    if (!category) {
        throw new AppError('Category not found', 404);
    }

    const orgId = await db('proj_projects').where('id', projectId).select('org_id').first().then(r => r?.org_id);
    if (!orgId) {
        throw new AppError('Project organization not found', 404);
    }

    let drawingGroup = drawingGroupId ? parseInt(drawingGroupId) : null;
    let nextRev = 1;
    let finalTitle = title ? title.trim() : '';
    let currentSortOrder = 0;

    if (drawingGroup) {
        // Revision upload: Find highest revision number & details of existing drawing
        const existingLatest = await db('proj_drawings')
            .where({ drawing_group_id: drawingGroup, category_id: categoryId })
            .orderBy('revision_number', 'desc')
            .first();

        if (!existingLatest) {
            throw new AppError('Drawing group not found in this category', 404);
        }

        nextRev = existingLatest.revision_number + 1;
        if (!finalTitle) finalTitle = existingLatest.title; // Inherit title if not provided
        currentSortOrder = existingLatest.sort_order;
    } else {
        // New drawing R1: Get next sort order
        if (!finalTitle) {
            throw new AppError('Drawing title is required', 400);
        }
        const maxSortRow = await db('proj_drawings')
            .where({ category_id: categoryId })
            .max('sort_order as max_sort')
            .first();
        currentSortOrder = (maxSortRow?.max_sort || 0) + 1;
    }

    // Insert dummy/initial row in transaction to obtain row ID for path name generation
    let rowId;
    await db.transaction(async (trx) => {
        const [insertedId] = await trx('proj_drawings').insert({
            drawing_group_id: drawingGroup || null, // Will update self-reference later if group ID is null
            project_id: projectId,
            category_id: categoryId,
            title: finalTitle,
            revision_number: nextRev,
            description: description ? description.trim() : null,
            sort_order: currentSortOrder,
            uploaded_by: userId
        });
        rowId = insertedId;
        
        // If this is a new drawing, its group ID equals its first revision row ID
        if (!drawingGroup) {
            drawingGroup = rowId;
            await trx('proj_drawings')
                .where('id', rowId)
                .update({ drawing_group_id: drawingGroup });
        }
    });

    // Upload files to S3 with group and revision references in folder hierarchy
    const s3Folder = `drawings/org_${orgId}/proj_${projectId}/cat_${categoryId}`;
    let dwgUrl = null;
    let pdfUrl = null;

    if (dwgFile) {
        const cleanName = dwgFile.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `draw_${drawingGroup}_rev_${nextRev}_${Date.now()}_${cleanName}`;
        dwgUrl = await S3Service.uploadFile(dwgFile.buffer, filename, s3Folder, dwgFile.mimetype);
    }
    if (pdfFile) {
        const cleanName = pdfFile.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `draw_${drawingGroup}_rev_${nextRev}_${Date.now()}_${cleanName}`;
        pdfUrl = await S3Service.uploadFile(pdfFile.buffer, filename, s3Folder, pdfFile.mimetype);
    }

    // Update drawing row with S3 file URLs
    await db('proj_drawings')
        .where('id', rowId)
        .update({
            dwg_url: dwgUrl,
            pdf_url: pdfUrl
        });

    return {
        id: drawingGroup,
        rowId,
        revision: `R${nextRev}`
    };
}

export async function updateDrawingTitle(projectId, categoryId, drawingGroupId, { title, description }) {
    const updateData = {};
    if (title && title.trim()) {
        updateData.title = title.trim();
    }
    if (description !== undefined) {
        updateData.description = description ? description.trim() : '';
    }

    if (Object.keys(updateData).length === 0) {
        throw new AppError('Nothing to update', 400);
    }

    // Since we maintain title and remarks across revisions, we update matching rows with the same drawing_group_id!
    const affected = await db('proj_drawings')
        .where({ drawing_group_id: drawingGroupId, category_id: categoryId, project_id: projectId })
        .update(updateData);

    if (affected === 0) {
        throw new AppError('Drawing not found or does not belong to this project/category', 404);
    }
    return true;
}

export async function deleteDrawing(projectId, categoryId, drawingGroupId) {
    // Fetch all rows belonging to this drawing group to clean up S3 files
    const rows = await db('proj_drawings')
        .where({ drawing_group_id: drawingGroupId, category_id: categoryId, project_id: projectId });

    if (rows.length === 0) {
        throw new AppError('Drawing not found', 404);
    }

    // Delete S3 files for all revisions in this group
    for (const row of rows) {
        await deleteDrawingRowS3Files(row);
    }

    // Delete parent/child rows (drawing_group_id cascade deletes all revisions)
    await db('proj_drawings')
        .where({ drawing_group_id: drawingGroupId, category_id: categoryId, project_id: projectId })
        .del();

    return true;
}

export async function reorderDrawings(projectId, categoryId, orderArray) {
    if (!Array.isArray(orderArray)) {
        throw new AppError('order array is required', 400);
    }

    await db.transaction(async (trx) => {
        for (const item of orderArray) {
            const { id, sort_order } = item;
            // Update sort_order for ALL rows in that drawing group
            await trx('proj_drawings')
                .where({ drawing_group_id: id, category_id: categoryId, project_id: projectId })
                .update({ sort_order });
        }
    });
    return true;
}

export default {
    initializeDrawingsSchema,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getDrawings,
    uploadDrawingRecord,
    updateDrawingTitle,
    deleteDrawing,
    reorderDrawings
};
