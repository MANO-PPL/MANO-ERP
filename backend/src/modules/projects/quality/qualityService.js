import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import S3Service from '../../shared/s3Service.js';
import fs from 'fs';
import path from 'path';

/**
 * Automatically checks and initializes QA/QC schema
 */
export async function initializeQualitySchema() {
    const hasQaqcTable = await db.schema.hasTable('proj_qaqc_observations');
    if (!hasQaqcTable) {
        await db.schema.createTable('proj_qaqc_observations', (table) => {
            table.increments('id').primary();
            table.integer('project_id').unsigned().notNullable().references('id').inTable('proj_projects').onDelete('CASCADE');
            table.string('location').notNullable();
            table.string('before_photo_url', 512).nullable();
            table.text('before_photos').nullable();
            table.text('before_note').nullable();
            table.string('status').notNullable().defaultTo('PENDING'); // PENDING, FIXED, APPROVED

            // Reporter
            table.integer('reported_by').unsigned().notNullable().references('user_id').inTable('iam_users').onDelete('CASCADE');
            table.timestamp('reported_at').defaultTo(db.fn.now());

            // Fixer (when status is FIXED or APPROVED)
            table.integer('fixed_by').unsigned().nullable().references('user_id').inTable('iam_users').onDelete('SET NULL');
            table.timestamp('fixed_at').nullable();
            table.string('after_photo_url', 512).nullable();
            table.text('after_photos').nullable();
            table.text('after_note').nullable();

            // Approver (when status is APPROVED)
            table.integer('approved_by').unsigned().nullable().references('user_id').inTable('iam_users').onDelete('SET NULL');
            table.timestamp('approved_at').nullable();

            table.timestamps(true, true);
        });
        console.log('Created table: proj_qaqc_observations');
    } else {
        const hasBeforePhotos = await db.schema.hasColumn('proj_qaqc_observations', 'before_photos');
        if (!hasBeforePhotos) {
            await db.schema.table('proj_qaqc_observations', (table) => {
                table.text('before_photos').nullable();
                table.text('after_photos').nullable();
            });
            console.log('Added before_photos and after_photos columns to proj_qaqc_observations');
        }
    }

    const hasMethodologyTable = await db.schema.hasTable('proj_quality_methodologies');
    if (!hasMethodologyTable) {
        await db.schema.createTable('proj_quality_methodologies', (table) => {
            table.increments('id').primary();
            table.integer('project_id').unsigned().notNullable().references('id').inTable('proj_projects').onDelete('CASCADE');
            table.string('title').notNullable();
            table.string('file_url', 512).notNullable();
            table.string('file_type').nullable();
            table.integer('file_size').unsigned().nullable();
            table.integer('uploaded_by').unsigned().notNullable().references('user_id').inTable('iam_users').onDelete('CASCADE');
            table.timestamp('uploaded_at').defaultTo(db.fn.now());
            table.timestamps(true, true);
        });
        console.log('Created table: proj_quality_methodologies');
    }

    const hasChecklistTable = await db.schema.hasTable('proj_quality_checklists');
    if (!hasChecklistTable) {
        await db.schema.createTable('proj_quality_checklists', (table) => {
            table.increments('id').primary();
            table.integer('project_id').unsigned().notNullable().references('id').inTable('proj_projects').onDelete('CASCADE');
            table.string('title').notNullable();
            table.string('file_url', 512).notNullable();
            table.string('file_type').nullable();
            table.integer('file_size').unsigned().nullable();
            table.integer('uploaded_by').unsigned().notNullable().references('user_id').inTable('iam_users').onDelete('CASCADE');
            table.timestamp('uploaded_at').defaultTo(db.fn.now());
            table.timestamps(true, true);
        });
        console.log('Created table: proj_quality_checklists');
    }
}



/**
 * Helper to upload a file to S3 with local disk fallback
 */
async function uploadQualityFile(file, folder, filename) {
    if (!file) return null;
    try {
        // Attempt to upload to S3 first
        return await S3Service.uploadFile(file.buffer, filename, folder, file.mimetype);
    } catch (s3Error) {
        console.warn('S3 upload failed, falling back to local disk storage:', s3Error.message);

        // Define local directory
        const localDir = path.join(process.cwd(), 'uploads', 'qaqc');
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        // Write file locally
        const localFilePath = path.join(localDir, filename);
        fs.writeFileSync(localFilePath, file.buffer);

        // Return relative path accessible via vite proxy (/uploads/qaqc/...)
        return `/uploads/qaqc/${filename}`;
    }
}

/**
 * Helper to delete a file (works for both S3 and local files)
 */
async function deleteQualityFile(fileUrl) {
    if (!fileUrl) return;

    // Check if it is a local fallback file
    if (fileUrl.startsWith('/uploads/qaqc/')) {
        try {
            const filename = fileUrl.replace('/uploads/qaqc/', '');
            const filePath = path.join(process.cwd(), 'uploads', 'qaqc', filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (err) {
            console.error('Failed to delete local file:', err.message);
        }
    } else {
        // S3 file deletion
        try {
            // Extract S3 key from URL
            const marker = '.amazonaws.com/';
            const index = fileUrl.indexOf(marker);
            if (index !== -1) {
                const s3Key = fileUrl.substring(index + marker.length);
                await S3Service.deleteFile(s3Key);
            }
        } catch (err) {
            console.error('Failed to delete S3 file:', err.message);
        }
    }
}

function getS3KeyFromUrl(url) {
    if (!url) return null;
    const marker = '.amazonaws.com/';
    const index = url.indexOf(marker);
    if (index !== -1) {
        return url.substring(index + marker.length);
    }
    return null;
}

async function presignUrl(url) {
    if (!url) return null;
    // If it's a local fallback path, return it directly
    if (url.startsWith('/uploads/')) return url;

    const key = getS3KeyFromUrl(url);
    if (!key) return url;
    try {
        return await S3Service.getFileSignedUrl(key);
    } catch (e) {
        console.warn(`[S3 Presign Warning] Failed to generate signed URL for key ${key}:`, e.message);
        return url;
    }
}

/**
 * Fetch all quality observations for a project
 */
export async function getObservations(projectId) {
    const list = await db('proj_qaqc_observations as q')
        .leftJoin('iam_users as reporter', 'q.reported_by', 'reporter.user_id')
        .leftJoin('iam_users as fixer', 'q.fixed_by', 'fixer.user_id')
        .leftJoin('iam_users as approver', 'q.approved_by', 'approver.user_id')
        .where('q.project_id', projectId)
        .select([
            'q.*',
            'reporter.user_name as reported_by_name',
            'reporter.email as reported_by_email',
            'fixer.user_name as fixed_by_name',
            'fixer.email as fixed_by_email',
            'approver.user_name as approved_by_name',
            'approver.email as approved_by_email'
        ])
        .orderBy('q.reported_at', 'desc');

    for (const item of list) {
        // Parse before_photos
        let beforePhotosList = [];
        if (item.before_photos) {
            try {
                beforePhotosList = typeof item.before_photos === 'string' ? JSON.parse(item.before_photos) : item.before_photos;
            } catch (e) {
                beforePhotosList = [];
            }
        }
        if (!beforePhotosList.length && item.before_photo_url) {
            beforePhotosList = [{ url: item.before_photo_url, label: 'Main Defect Photo' }];
        }
        for (const p of beforePhotosList) {
            p.url = await presignUrl(p.url);
        }
        item.before_photos = beforePhotosList;
        item.before_photo_url = beforePhotosList[0]?.url || await presignUrl(item.before_photo_url);

        // Parse after_photos
        let afterPhotosList = [];
        if (item.after_photos) {
            try {
                afterPhotosList = typeof item.after_photos === 'string' ? JSON.parse(item.after_photos) : item.after_photos;
            } catch (e) {
                afterPhotosList = [];
            }
        }
        if (!afterPhotosList.length && item.after_photo_url) {
            afterPhotosList = [{ url: item.after_photo_url, label: 'Main Resolution Photo' }];
        }
        for (const p of afterPhotosList) {
            p.url = await presignUrl(p.url);
        }
        item.after_photos = afterPhotosList;
        item.after_photo_url = afterPhotosList[0]?.url || await presignUrl(item.after_photo_url);
    }

    return list;
}

/**
 * Fetch a single observation by ID
 */
export async function getObservationById(projectId, obsId) {
    const obs = await db('proj_qaqc_observations')
        .where({ id: obsId, project_id: projectId })
        .first();
    if (!obs) {
        throw new AppError('Observation not found', 404);
    }
    return obs;
}

/**
 * Create a new quality observation (starts as PENDING)
 */
export async function createObservation(projectId, { location, note, files, labels, userId }) {
    if (!location) {
        throw new AppError('Location / Area is required', 400);
    }

    const orgId = await db('proj_projects')
        .where('id', projectId)
        .select('org_id')
        .first()
        .then(r => r?.org_id);
    if (!orgId) {
        throw new AppError('Project organization not found', 404);
    }

    // Insert observation record first to get insert ID
    const [insertedId] = await db('proj_qaqc_observations').insert({
        project_id: projectId,
        location: location.trim(),
        before_note: note ? note.trim() : null,
        status: 'PENDING',
        reported_by: userId,
        reported_at: db.fn.now()
    });

    const photoList = [];
    if (files && files.length > 0) {
        const folder = `projects/org_${orgId}/proj_${projectId}/qaqc`;
        for (let idx = 0; idx < files.length; idx++) {
            const file = files[idx];
            const label = (labels && labels[idx]) ? labels[idx] : `Defect View ${idx + 1}`;
            const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filename = `obs_${insertedId}_before_${idx}_${Date.now()}_${cleanName}`;
            const uploadedUrl = await uploadQualityFile(file, folder, filename);
            if (uploadedUrl) {
                photoList.push({ url: uploadedUrl, label });
            }
        }
    }

    const firstPhotoUrl = photoList[0]?.url || null;
    await db('proj_qaqc_observations')
        .where('id', insertedId)
        .update({ 
            before_photo_url: firstPhotoUrl,
            before_photos: photoList.length ? JSON.stringify(photoList) : null
        });

    return {
        id: insertedId,
        before_photo_url: await presignUrl(firstPhotoUrl),
        before_photos: await Promise.all(photoList.map(async p => ({ ...p, url: await presignUrl(p.url) })))
    };
}

/**
 * Update an existing pending observation
 * Rule: only reported_by (issuer) can update, and only if PENDING
 */
export async function updateObservation(projectId, obsId, { location, note, files, labels, clearPhotos }, userId) {
    const obs = await getObservationById(projectId, obsId);

    // Enforcement: only issuer can edit
    if (obs.reported_by !== userId) {
        throw new AppError('Unauthorized: Only the employee who reported this issue can edit it', 403);
    }

    // Enforcement: only in PENDING state
    if (obs.status !== 'PENDING') {
        throw new AppError('Forbidden: Once an issue is fixed or approved, it cannot be modified', 400);
    }

    const orgId = await db('proj_projects')
        .where('id', projectId)
        .select('org_id')
        .first()
        .then(r => r?.org_id);

    const updateData = {};
    if (location) updateData.location = location.trim();
    if (note !== undefined) updateData.before_note = note ? note.trim() : null;

    let photoList = [];
    if (obs.before_photos) {
        try {
            photoList = typeof obs.before_photos === 'string' ? JSON.parse(obs.before_photos) : obs.before_photos;
        } catch (e) {
            photoList = [];
        }
    } else if (obs.before_photo_url) {
        photoList = [{ url: obs.before_photo_url, label: 'Main Defect Photo' }];
    }

    if (clearPhotos === 'true' || clearPhotos === true) {
        for (const p of photoList) {
            await deleteQualityFile(p.url);
        }
        photoList = [];
    }

    if (files && files.length > 0) {
        const folder = `projects/org_${orgId}/proj_${projectId}/qaqc`;
        for (let idx = 0; idx < files.length; idx++) {
            const file = files[idx];
            const label = (labels && labels[idx]) ? labels[idx] : `Defect View ${photoList.length + 1}`;
            const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filename = `obs_${obsId}_before_${photoList.length}_${Date.now()}_${cleanName}`;
            const uploadedUrl = await uploadQualityFile(file, folder, filename);
            if (uploadedUrl) {
                photoList.push({ url: uploadedUrl, label });
            }
        }
    }

    updateData.before_photo_url = photoList[0]?.url || null;
    updateData.before_photos = photoList.length ? JSON.stringify(photoList) : null;

    await db('proj_qaqc_observations')
        .where('id', obsId)
        .update(updateData);

    return {
        id: obsId,
        before_photo_url: await presignUrl(updateData.before_photo_url),
        before_photos: await Promise.all(photoList.map(async p => ({ ...p, url: await presignUrl(p.url) })))
    };
}

/**
 * Submit rectification work (status becomes FIXED)
 * Rule: can be resolved by any person with access, only if PENDING
 */
export async function submitFix(projectId, obsId, { note, files, labels }, userId) {
    const obs = await getObservationById(projectId, obsId);

    // Enforcement: only in PENDING state
    if (obs.status !== 'PENDING') {
        throw new AppError('Forbidden: This observation has already been resolved or closed', 400);
    }

    if (!files || files.length === 0) {
        throw new AppError('At least one resolution photo is required to submit a fix', 400);
    }

    const orgId = await db('proj_projects')
        .where('id', projectId)
        .select('org_id')
        .first()
        .then(r => r?.org_id);

    const folder = `projects/org_${orgId}/proj_${projectId}/qaqc`;
    const photoList = [];
    for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        const label = (labels && labels[idx]) ? labels[idx] : `Resolution View ${idx + 1}`;
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `obs_${obsId}_after_${idx}_${Date.now()}_${cleanName}`;
        const uploadedUrl = await uploadQualityFile(file, folder, filename);
        if (uploadedUrl) {
            photoList.push({ url: uploadedUrl, label });
        }
    }

    const firstPhotoUrl = photoList[0]?.url || null;
    await db('proj_qaqc_observations')
        .where('id', obsId)
        .update({
            status: 'FIXED',
            after_photo_url: firstPhotoUrl,
            after_photos: photoList.length ? JSON.stringify(photoList) : null,
            after_note: note ? note.trim() : null,
            fixed_by: userId,
            fixed_at: db.fn.now()
        });

    return {
        id: obsId,
        after_photo_url: await presignUrl(firstPhotoUrl),
        after_photos: await Promise.all(photoList.map(async p => ({ ...p, url: await presignUrl(p.url) })))
    };
}

/**
 * Approve rectification work (status becomes APPROVED)
 * Rule: only if FIXED
 */
export async function approveFix(projectId, obsId, userId) {
    const obs = await getObservationById(projectId, obsId);

    // Enforcement: only if status is FIXED
    if (obs.status !== 'FIXED') {
        throw new AppError('Forbidden: Observation must be fixed and pending approval to be approved', 400);
    }

    await db('proj_qaqc_observations')
        .where('id', obsId)
        .update({
            status: 'APPROVED',
            approved_by: userId,
            approved_at: db.fn.now()
        });

    return {
        id: obsId
    };
}

/**
 * Delete an observation
 */
export async function deleteObservation(projectId, obsId) {
    const obs = await getObservationById(projectId, obsId);

    // Delete photos associated
    if (obs.before_photo_url) {
        await deleteQualityFile(obs.before_photo_url);
    }
    if (obs.after_photo_url) {
        await deleteQualityFile(obs.after_photo_url);
    }

    await db('proj_qaqc_observations')
        .where({ id: obsId, project_id: projectId })
        .delete();

    return {
        id: obsId
    };
}

/**
 * Fetch all methodology documents for a project
 */
export async function getMethodologies(projectId) {
    const list = await db('proj_quality_methodologies as m')
        .leftJoin('iam_users as uploader', 'm.uploaded_by', 'uploader.user_id')
        .where('m.project_id', projectId)
        .select([
            'm.*',
            'uploader.user_name as uploaded_by_name',
            'uploader.email as uploaded_by_email'
        ])
        .orderBy('m.uploaded_at', 'desc');

    // Pre-sign S3 URLs dynamically
    for (const item of list) {
        item.file_url = await presignUrl(item.file_url);
    }

    return list;
}

/**
 * Upload & create a methodology document
 */
export async function createMethodology(projectId, { title, file, userId }) {
    if (!title) {
        throw new AppError('Document title is required', 400);
    }
    if (!file) {
        throw new AppError('File is required', 400);
    }

    const orgId = await db('proj_projects')
        .where('id', projectId)
        .select('org_id')
        .first()
        .then(r => r?.org_id);
    if (!orgId) {
        throw new AppError('Project organization not found', 404);
    }

    // Insert initial record to get insert ID
    const [insertedId] = await db('proj_quality_methodologies').insert({
        project_id: projectId,
        title: title.trim(),
        file_url: 'temp_url', // Will update right after upload
        file_type: file.originalname.split('.').pop()?.toUpperCase() || null,
        file_size: file.size,
        uploaded_by: userId,
        uploaded_at: db.fn.now()
    });

    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `methodology_${insertedId}_${Date.now()}_${cleanName}`;
    const folder = `projects/org_${orgId}/proj_${projectId}/methodology`;

    let fileUrl = null;
    try {
        fileUrl = await uploadQualityFile(file, folder, filename);
    } catch (uploadError) {
        // Cleanup the record on failure
        await db('proj_quality_methodologies').where('id', insertedId).delete();
        throw uploadError;
    }

    // Update with S3 / local fallback file URL
    await db('proj_quality_methodologies')
        .where('id', insertedId)
        .update({ file_url: fileUrl });

    const doc = await db('proj_quality_methodologies').where('id', insertedId).first();
    doc.file_url = await presignUrl(doc.file_url);

    return doc;
}

/**
 * Delete a methodology document
 */
export async function deleteMethodology(projectId, docId) {
    const doc = await db('proj_quality_methodologies')
        .where({ id: docId, project_id: projectId })
        .first();
    if (!doc) {
        throw new AppError('Methodology document not found', 404);
    }

    // Delete file from S3 / local disk
    if (doc.file_url) {
        await deleteQualityFile(doc.file_url);
    }

    await db('proj_quality_methodologies')
        .where({ id: docId, project_id: projectId })
        .delete();

    return { id: docId };
}

/**
 * Fetch all checklist & snaglist documents for a project
 */
export async function getChecklists(projectId) {
    const list = await db('proj_quality_checklists as c')
        .leftJoin('iam_users as uploader', 'c.uploaded_by', 'uploader.user_id')
        .where('c.project_id', projectId)
        .select([
            'c.*',
            'uploader.user_name as uploaded_by_name',
            'uploader.email as uploaded_by_email'
        ])
        .orderBy('c.uploaded_at', 'desc');

    // Pre-sign S3 URLs dynamically
    for (const item of list) {
        item.file_url = await presignUrl(item.file_url);
    }

    return list;
}

/**
 * Upload & create a checklist & snaglist document
 */
export async function createChecklist(projectId, { title, file, userId }) {
    if (!title) {
        throw new AppError('Document title is required', 400);
    }
    if (!file) {
        throw new AppError('File is required', 400);
    }

    const orgId = await db('proj_projects')
        .where('id', projectId)
        .select('org_id')
        .first()
        .then(r => r?.org_id);
    if (!orgId) {
        throw new AppError('Project organization not found', 404);
    }

    // Insert initial record to get insert ID
    const [insertedId] = await db('proj_quality_checklists').insert({
        project_id: projectId,
        title: title.trim(),
        file_url: 'temp_url', // Will update right after upload
        file_type: file.originalname.split('.').pop()?.toUpperCase() || null,
        file_size: file.size,
        uploaded_by: userId,
        uploaded_at: db.fn.now()
    });

    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `checklist_${insertedId}_${Date.now()}_${cleanName}`;
    const folder = `projects/org_${orgId}/proj_${projectId}/check_snag`;

    let fileUrl = null;
    try {
        fileUrl = await uploadQualityFile(file, folder, filename);
    } catch (uploadError) {
        // Cleanup on failure
        await db('proj_quality_checklists').where('id', insertedId).delete();
        throw uploadError;
    }

    // Update with S3 / local fallback file URL
    await db('proj_quality_checklists')
        .where('id', insertedId)
        .update({ file_url: fileUrl });

    const doc = await db('proj_quality_checklists').where('id', insertedId).first();
    doc.file_url = await presignUrl(doc.file_url);

    return doc;
}

/**
 * Delete a checklist & snaglist document
 */
export async function deleteChecklist(projectId, docId) {
    const doc = await db('proj_quality_checklists')
        .where({ id: docId, project_id: projectId })
        .first();
    if (!doc) {
        throw new AppError('Checklist document not found', 404);
    }

    // Delete file from S3 / local disk
    if (doc.file_url) {
        await deleteQualityFile(doc.file_url);
    }

    await db('proj_quality_checklists')
        .where({ id: docId, project_id: projectId })
        .delete();

    return { id: docId };
}

export default {
    initializeQualitySchema,
    getObservations,
    getObservationById,
    createObservation,
    updateObservation,
    submitFix,
    approveFix,
    deleteObservation,
    getMethodologies,
    createMethodology,
    deleteMethodology,
    getChecklists,
    createChecklist,
    deleteChecklist
};


