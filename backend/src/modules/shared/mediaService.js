import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';
import s3Service from './s3Service.js';
import { processImageToWebp } from './imageProcessor.js';
import AppError from '../../utils/AppError.js';

// Cache presigned URLs in memory so identical URLs are returned across requests,
// allowing browsers to utilize HTTP disk/memory cache without re-fetching on tab switches.
const presignedUrlCache = new Map();
const CACHE_TTL_MS = 6 * 24 * 60 * 60 * 1000; // 6 days (AWS SigV4 max is 7 days)

class MediaService {
    /**
     * Check if S3 credentials and bucket are configured in environment
     */
    isS3Configured() {
        return Boolean(
            (process.env.S3_BUCKET || process.env.AWS_BUCKET_NAME || process.env.AWS_BUCKET) &&
            (process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) &&
            (process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
        );
    }

    /**
     * Build standard multi-tenant folder path
     */
    buildFolderPath({ orgId, module = 'catalog', subfolder = 'resources', projectId = null }) {
        if (!orgId) throw new AppError('orgId is required for storage path', 500);

        if (projectId) {
            return `org_${orgId}/projects/proj_${projectId}/${module}/${subfolder}`;
        }
        return `org_${orgId}/${module}/${subfolder}`;
    }

    /**
     * Upload and optimize an image file buffer
     * - Auto-converts to WebP
     * - Resizes to max bounding box (1200x1200)
     * - Saves to S3 or local uploads/ directory
     *
     * @returns {Promise<{ url: string, key: string, sizeBytes: number }>}
     */
    async uploadImage({
        fileBuffer,
        orgId,
        module = 'catalog',
        subfolder = 'resources',
        entityId = 'item',
        projectId = null,
        maxWidth = 1200,
        maxHeight = 1200,
        quality = 80
    }) {
        if (!fileBuffer) {
            throw new AppError('No file buffer provided for upload', 400);
        }

        // 1. Process and convert to WebP
        const processed = await processImageToWebp(fileBuffer, { maxWidth, maxHeight, quality });

        // 2. Build multi-tenant directory path & unique file name
        const folder = this.buildFolderPath({ orgId, module, subfolder, projectId });
        const hash = crypto.randomBytes(4).toString('hex');
        const fileName = `${entityId}_${Date.now()}_${hash}.webp`;
        const key = `${folder}/${fileName}`;

        // 3. Storage dispatch: S3 if configured, else local /uploads/ fallback
        if (this.isS3Configured()) {
            const s3Url = await s3Service.uploadFile(processed.buffer, fileName, folder, processed.contentType);
            return {
                url: s3Url,
                key,
                sizeBytes: processed.sizeBytes
            };
        } else {
            // Local filesystem storage
            const targetDir = path.join(process.cwd(), 'uploads', folder);
            await fsPromises.mkdir(targetDir, { recursive: true });
            const filePath = path.join(targetDir, fileName);
            await fsPromises.writeFile(filePath, processed.buffer);

            // Normalized public URL accessible via express static
            const normalizedUrl = `/uploads/${folder}/${fileName}`.replace(/\\/g, '/');
            return {
                url: normalizedUrl,
                key,
                sizeBytes: processed.sizeBytes
            };
        }
    }

    /**
     * Delete an existing media file from S3 or local storage
     * Safe operation: logs errors but does not crash if file was already deleted.
     */
    async deleteMedia(fileUrl) {
        if (!fileUrl || typeof fileUrl !== 'string') return;

        try {
            // Local upload path
            if (fileUrl.startsWith('/uploads/') || fileUrl.startsWith('uploads/')) {
                const relativePath = fileUrl.replace(/^\/?uploads\//, '');
                const fullPath = path.join(process.cwd(), 'uploads', relativePath);
                if (fs.existsSync(fullPath)) {
                    await fsPromises.unlink(fullPath);
                }
                return;
            }

            // S3 storage URL
            if (fileUrl.includes('.amazonaws.com/')) {
                const key = this.extractS3Key(fileUrl);
                if (key) {
                    presignedUrlCache.delete(key);
                    if (this.isS3Configured()) {
                        await s3Service.deleteFile(key);
                    }
                }
            }
        } catch (err) {
            console.warn(`[mediaService] Non-fatal deleteMedia warning for ${fileUrl}:`, err.message);
        }
    }

    /**
     * Extract S3 object key from a full S3 URL or relative key
     */
    extractS3Key(url) {
        if (!url || typeof url !== 'string') return null;
        const cleanUrl = url.split('?')[0];
        const marker = '.amazonaws.com/';
        const index = cleanUrl.indexOf(marker);
        if (index !== -1) {
            return decodeURIComponent(cleanUrl.substring(index + marker.length));
        }
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('/uploads/')) {
            return cleanUrl.startsWith('/') ? cleanUrl.substring(1) : cleanUrl;
        }
        return null;
    }

    /**
     * Presign an S3 URL so private bucket assets load cleanly in the browser
     * Uses memory cache so the browser sees an identical URL across queries and tab switches.
     * Default expiresIn: 7 days (604,800 seconds)
     */
    async presignUrl(url, expiresIn = 604800) {
        if (!url || typeof url !== 'string') return url;
        if (url.startsWith('/uploads/') || url.startsWith('uploads/')) return url;

        if (!this.isS3Configured()) return url;

        const key = this.extractS3Key(url);
        if (!key) return url;

        const cached = presignedUrlCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.url;
        }

        try {
            const signed = await s3Service.getFileSignedUrl(key, expiresIn);
            presignedUrlCache.set(key, {
                url: signed,
                expiresAt: Date.now() + CACHE_TTL_MS
            });
            return signed;
        } catch (err) {
            console.warn(`[mediaService] Presign URL failed for key ${key}:`, err.message);
            return url;
        }
    }

    /**
     * Presign image URL on a single entity object
     */
    async presignEntity(item, field = 'image_url') {
        if (!item) return item;
        if (item[field]) {
            item[field] = await this.presignUrl(item[field]);
        }
        return item;
    }

    /**
     * Presign image URLs on an array of entity objects
     */
    async presignEntities(items, field = 'image_url') {
        if (!Array.isArray(items) || items.length === 0) return items;
        return Promise.all(items.map(item => this.presignEntity(item, field)));
    }
}

export default new MediaService();
