import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';

dotenv.config();

class S3Service {
    constructor() {
        this.s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
        this.bucketName = process.env.AWS_BUCKET_NAME;
    }

    /**
     * Upload a file to S3
     * @param {Buffer} fileBuffer - The file content buffer
     * @param {string} fileName - The name of the file
     * @param {string} folder - The folder path in S3 (optional)
     * @param {string} contentType - MIME type of the file
     */
    async uploadFile(fileBuffer, fileName, folder = '', contentType) {
        const key = folder ? `${folder}/${fileName}` : fileName;
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: contentType,
        });

        try {
            await this.s3.send(command);
            return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        } catch (error) {
            console.error('S3 Upload Error:', error);
            throw new AppError('Failed to upload file to S3', 500);
        }
    }

    /**
     * Delete a file from S3
     * @param {string} key - The S3 object key (path/filename)
     */
    async deleteFile(key) {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        try {
            await this.s3.send(command);
            return true;
        } catch (error) {
            console.error('S3 Delete Error:', error);
            throw new AppError('Failed to delete file from S3', 500);
        }
    }

    /**
     * Get a signed URL for reading a private file
     * @param {string} key - The S3 object key
     * @param {number} expiresIn - Expiration time in seconds (default 3600)
     */
    async getFileSignedUrl(key, expiresIn = 3600) {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        try {
            const url = await getSignedUrl(this.s3, command, { expiresIn });
            return url;
        } catch (error) {
            console.error('S3 Signed URL Error:', error);
            throw new AppError('Failed to generate signed URL', 500);
        }
    }
}

export default new S3Service();
