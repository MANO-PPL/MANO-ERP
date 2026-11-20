import sharp from 'sharp';
import AppError from '../../utils/AppError.js';

/**
 * Image Processing Pipeline
 * - Accepts incoming image buffer (PNG, JPG, JPEG, WEBP, GIF, etc.)
 * - Downscales to standard max bounding box (default: 1200x1200)
 * - Converts to optimized .webp with 80% quality (near-lossless, 75-85% size reduction)
 */
export async function processImageToWebp(fileBuffer, { maxWidth = 1200, maxHeight = 1200, quality = 80 } = {}) {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
        throw new AppError('Invalid image buffer provided', 400);
    }

    try {
        const pipeline = sharp(fileBuffer, { failOnError: false, limitInputPixels: 100000000 })
            .rotate() // Auto-orient based on EXIF
            .resize({
                width: maxWidth,
                height: maxHeight,
                fit: 'inside', // Don't crop, preserve aspect ratio
                withoutEnlargement: true // Don't upscale smaller icons/images
            })
            .webp({
                quality,
                effort: 4 // Good balance of compression speed & efficiency
            });

        const outputBuffer = await pipeline.toBuffer();
        const metadata = await sharp(outputBuffer).metadata();

        return {
            buffer: outputBuffer,
            contentType: 'image/webp',
            extension: '.webp',
            width: metadata.width,
            height: metadata.height,
            sizeBytes: outputBuffer.length
        };
    } catch (err) {
        console.error('Image processing failure:', err);
        throw new AppError('Failed to process image. File may be corrupted or in an unsupported format.', 422);
    }
}
