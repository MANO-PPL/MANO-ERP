import multer from 'multer';
import AppError from '../../utils/AppError.js';

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
]);

const storage = multer.memoryStorage();

export const singleImageUpload = (fieldName = 'image', { maxFileSizeMb = 30 } = {}) => {
    const maxBytes = maxFileSizeMb * 1024 * 1024;

    function fileFilter(req, file, cb) {
        if (!file || !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
            return cb(new AppError(`Invalid image type. Supported formats: PNG, JPG, JPEG, WEBP, GIF (Max ${maxFileSizeMb}MB)`, 400), false);
        }
        cb(null, true);
    }

    const upload = multer({
        storage,
        limits: {
            fileSize: maxBytes
        },
        fileFilter
    }).single(fieldName);

    return (req, res, next) => {
        upload(req, res, (err) => {
            if (err) {
                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return next(new AppError(`Image size exceeds ${maxFileSizeMb}MB limit. Please upload an image under ${maxFileSizeMb}MB.`, 400));
                    }
                    return next(new AppError(`Upload error: ${err.message}`, 400));
                }
                return next(err);
            }
            next();
        });
    };
};
