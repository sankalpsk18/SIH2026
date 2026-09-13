/**
 * ADALAT360 - Storage Service
 * Encrypted object storage with S3/MinIO backend and envelope encryption
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListObjectsV2Command, GetObjectTaggingCommand, PutObjectTaggingCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { config } from '@config/index.js';
import { logger } from '@utils/logger.js';
import { getKmsProvider } from './kms/kms.service.js';
import * as crypto from 'crypto';
import {
    StorageObject,
    StorageUploadOptions,
    StorageDownloadOptions,
    PresignedUrlOptions,
    EncryptionResult,
    DecryptionRequest,
    EnvelopeEncryptionResult,
    EnvelopeDecryptionRequest,
    MultipartUploadInit,
    MultipartUploadPart,
    MultipartUploadComplete,
} from '@models/storage.js';

// ============================================================================
// ENVELOPE ENCRYPTION HELPERS
// ============================================================================

async function envelopeEncrypt(
    data: Buffer,
    keyId: string,
    context?: Record<string, string>
): Promise<EnvelopeEncryptionResult> {
    const kms = getKmsProvider();

    // Generate data encryption key
    const { plaintextKey, encryptedKey } = await kms.generateDataKey(keyId, 'AES_256', context);

    // Encrypt data with DEK
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', plaintextKey, iv);
    if (context) {
        cipher.setAAD(Buffer.from(JSON.stringify(context)));
    }
    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Clear plaintext key from memory
    plaintextKey.fill(0);

    return {
        encryptedData,
        encryptedDataKey: encryptedKey,
        keyId,
        algorithm: 'AES-256-GCM',
        iv,
        authTag,
    };
}

async function envelopeDecrypt(request: EnvelopeDecryptionRequest): Promise<Buffer> {
    const kms = getKmsProvider();

    // Decrypt the data key
    const decryptedKey = await kms.decrypt({
        encryptedData: request.encryptedDataKey,
        keyId: request.keyId,
        algorithm: request.algorithm,
        iv: Buffer.alloc(0), // Embedded in encryptedDataKey for AWS KMS
        authTag: Buffer.alloc(0),
    });

    // Decrypt data with DEK
    const decipher = crypto.createDecipheriv(request.algorithm, decryptedKey, request.iv);
    decipher.setAuthTag(request.authTag);
    const decryptedData = Buffer.concat([decipher.update(request.encryptedData), decipher.final()]);

    // Clear decrypted key from memory
    decryptedKey.fill(0);

    return decryptedData;
}

// ============================================================================
// S3 CLIENT SETUP
// ============================================================================

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
    if (!s3Client) {
        s3Client = new S3Client({
            region: config.storage.region,
            endpoint: config.storage.endpoint,
            credentials: {
                accessKeyId: config.storage.accessKeyId,
                secretAccessKey: config.storage.secretAccessKey,
            },
            forcePathStyle: config.storage.forcePathStyle,
        });
    }
    return s3Client;
}

// ============================================================================
// STORAGE SERVICE CLASS
// ============================================================================

export class StorageService {
    private defaultKeyId: string = 'default';
    private initialized: boolean = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Ensure default key exists
        const kms = getKmsProvider();
        try {
            await kms.describeKey(this.defaultKeyId);
        } catch {
            await kms.createKey('Default ADALAT360 encryption key', { purpose: 'document-storage' });
        }

        // Ensure bucket exists
        await this.ensureBucket();

        this.initialized = true;
        logger.info('Storage service initialized');
    }

    private async ensureBucket(): Promise<void> {
        // In production, create bucket if not exists
        // For MinIO, bucket creation is typically done via mc CLI or console
        logger.info(`Using bucket: ${config.storage.bucket}`);
    }

    // ========================================================================
    // ENCRYPT AND STORE
    // ========================================================================

    async encryptAndStore(
        data: Buffer | NodeJS.ReadableStream,
        key: string,
        caseId: string,
        options: {
            contentType?: string;
            metadata?: Record<string, string>;
            encryptionKeyId?: string;
            tags?: Record<string, string>;
        } = {}
    ): Promise<{ keyId: string; algorithm: string; iv: Buffer; authTag: Buffer; etag: string }> {
        if (!this.initialized) {
            await this.initialize();
        }

        const encryptionKeyId = options.encryptionKeyId || this.defaultKeyId;
        const context = { case_id: caseId, object_key: key };

        let dataBuffer: Buffer;
        if (Buffer.isBuffer(data)) {
            dataBuffer = data;
        } else {
            // Stream to buffer
            const chunks: Buffer[] = [];
            for await (const chunk of data) {
                chunks.push(chunk);
            }
            dataBuffer = Buffer.concat(chunks);
        }

        // Envelope encryption
        const envelope = await envelopeEncrypt(dataBuffer, encryptionKeyId, context);

        // Prepare metadata for S3
        const s3Metadata: Record<string, string> = {
            'x-amz-meta-encryption-algorithm': envelope.algorithm,
            'x-amz-meta-encryption-key-id': envelope.keyId,
            'x-amz-meta-encryption-iv': envelope.iv.toString('base64'),
            'x-amz-meta-encryption-auth-tag': envelope.authTag.toString('base64'),
            'x-amz-meta-encrypted-data-key': envelope.encryptedDataKey.toString('base64'),
            ...options.metadata,
        };

        // Upload to S3/MinIO
        const client = getS3Client();
        const command = new PutObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
            Body: envelope.encryptedData,
            ContentType: options.contentType || 'application/octet-stream',
            Metadata: s3Metadata,
            Tagging: options.tags ? Object.entries(options.tags).map(([k, v]) => `${k}=${v}`).join('&') : undefined,
        });

        const response = await client.send(command);

        return {
            keyId: envelope.keyId,
            algorithm: envelope.algorithm,
            iv: envelope.iv,
            authTag: envelope.authTag,
            etag: response.ETag || '',
        };
    }

    // ========================================================================
    // RETRIEVE AND DECRYPT
    // ========================================================================

    async retrieveAndDecrypt(key: string, expectedHash?: string): Promise<Buffer> {
        if (!this.initialized) {
            await this.initialize();
        }

        const client = getS3Client();
        const command = new GetObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
        });

        const response = await client.send(command);

        // Extract encryption metadata
        const metadata = response.Metadata || {};
        const algorithm = metadata['x-amz-meta-encryption-algorithm'] || 'AES-256-GCM';
        const keyId = metadata['x-amz-meta-encryption-key-id'] || this.defaultKeyId;
        const iv = Buffer.from(metadata['x-amz-meta-encryption-iv'] || '', 'base64');
        const authTag = Buffer.from(metadata['x-amz-meta-encryption-auth-tag'] || '', 'base64');
        const encryptedDataKey = Buffer.from(metadata['x-amz-meta-encrypted-data-key'] || '', 'base64');

        // Read encrypted data
        const encryptedData = await this.streamToBuffer(response.Body as Readable);

        // Envelope decryption
        const decrypted = await envelopeDecrypt({
            encryptedData,
            encryptedDataKey,
            keyId,
            algorithm,
            iv,
            authTag,
        });

        // Verify hash if provided
        if (expectedHash) {
            const { computeBufferHash } = await import('../document-ingestion/hashing/file-hasher.js');
            const actualHash = computeBufferHash(decrypted).hash;
            if (actualHash !== expectedHash) {
                throw new Error(`Hash verification failed: expected ${expectedHash}, got ${actualHash}`);
            }
        }

        return decrypted;
    }

    async retrieveStream(key: string, expectedHash?: string): Promise<Readable> {
        // For streaming decryption, we need a transform stream
        // This is a simplified version - in production, use a proper decrypt stream
        const data = await this.retrieveAndDecrypt(key, expectedHash);
        return Readable.from(data);
    }

    // ========================================================================
    // DELETE
    // ========================================================================

    async deleteObject(key: string): Promise<void> {
        const client = getS3Client();
        await client.send(new DeleteObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
        }));
    }

    // ========================================================================
    // OBJECT METADATA
    // ========================================================================

    async getObjectMetadata(key: string): Promise<StorageObject | null> {
        const client = getS3Client();
        try {
            const response = await client.send(new HeadObjectCommand({
                Bucket: config.storage.bucket,
                Key: key,
            }));

            const metadata = response.Metadata || {};

            return {
                key,
                bucket: config.storage.bucket,
                size: response.ContentLength || 0,
                etag: response.ETag || '',
                lastModified: response.LastModified || new Date(),
                contentType: response.ContentType || 'application/octet-stream',
                metadata: Object.fromEntries(
                    Object.entries(metadata).filter(([k]) => !k.startsWith('x-amz-meta-encryption'))
                ),
                encryption: {
                    algorithm: metadata['x-amz-meta-encryption-algorithm'] || 'AES-256-GCM',
                    keyId: metadata['x-amz-meta-encryption-key-id'] || this.defaultKeyId,
                    iv: metadata['x-amz-meta-encryption-iv'] || '',
                    authTag: metadata['x-amz-meta-encryption-auth-tag'] || '',
                },
                versionId: response.VersionId,
                isEncrypted: true,
            };
        } catch (error: any) {
            if (error.name === 'NotFound') return null;
            throw error;
        }
    }

    // ========================================================================
    // PRESIGNED URLS
    // ========================================================================

    async getPresignedUrl(options: PresignedUrlOptions): Promise<string> {
        const client = getS3Client();

        let command: any;
        switch (options.operation) {
            case 'get':
                command = new GetObjectCommand({
                    Bucket: options.bucket,
                    Key: options.key,
                });
                break;
            case 'put':
                command = new PutObjectCommand({
                    Bucket: options.bucket,
                    Key: options.key,
                    ContentType: options.contentType,
                });
                break;
            case 'delete':
                command = new DeleteObjectCommand({
                    Bucket: options.bucket,
                    Key: options.key,
                });
                break;
            default:
                throw new Error(`Unsupported operation: ${options.operation}`);
        }

        return getSignedUrl(client, command, { expiresIn: options.expiresIn });
    }

    // ========================================================================
    // MULTIPART UPLOAD (for large files)
    // ========================================================================

    async initiateMultipartUpload(key: string, encryptionKeyId?: string): Promise<MultipartUploadInit> {
        const client = getS3Client();
        const response = await client.send(new CreateMultipartUploadCommand({
            Bucket: config.storage.bucket,
            Key: key,
            Metadata: {
                'x-amz-meta-encryption-key-id': encryptionKeyId || this.defaultKeyId,
            },
        }));

        return {
            uploadId: response.UploadId!,
            key,
            bucket: config.storage.bucket,
            encryptionKeyId: encryptionKeyId || this.defaultKeyId,
        };
    }

    async uploadPart(upload: MultipartUploadPart): Promise<string> {
        const client = getS3Client();
        const response = await client.send(new UploadPartCommand({
            Bucket: upload.bucket,
            Key: upload.key,
            UploadId: upload.uploadId,
            PartNumber: upload.partNumber,
            Body: upload.body,
        }));

        return response.ETag || '';
    }

    async completeMultipartUpload(complete: MultipartUploadComplete): Promise<{ keyId: string; etag: string }> {
        const client = getS3Client();
        const response = await client.send(new CompleteMultipartUploadCommand({
            Bucket: complete.bucket,
            Key: complete.key,
            UploadId: complete.uploadId,
            MultipartUpload: {
                Parts: complete.parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag })),
            },
        }));

        return {
            keyId: this.defaultKeyId,
            etag: response.ETag || '',
        };
    }

    async abortMultipartUpload(uploadId: string, key: string): Promise<void> {
        const client = getS3Client();
        await client.send(new AbortMultipartUploadCommand({
            Bucket: config.storage.bucket,
            Key: key,
            UploadId: uploadId,
        }));
    }

    // ========================================================================
    // LIST OBJECTS
    // ========================================================================

    async listObjects(prefix: string, maxKeys: number = 1000): Promise<StorageObject[]> {
        const client = getS3Client();
        const response = await client.send(new ListObjectsV2Command({
            Bucket: config.storage.bucket,
            Prefix: prefix,
            MaxKeys: maxKeys,
        }));

        return (response.Contents || []).map(obj => ({
            key: obj.Key!,
            bucket: config.storage.bucket,
            size: obj.Size || 0,
            etag: obj.ETag || '',
            lastModified: obj.LastModified || new Date(),
            contentType: 'application/octet-stream', // Would need HEAD for actual type
            metadata: {},
            encryption: {
                algorithm: 'AES-256-GCM',
                keyId: this.defaultKeyId,
                iv: '',
                authTag: '',
            },
            isEncrypted: true,
        }));
    }

    // ========================================================================
    // COPY OBJECT (server-side, preserves encryption)
    // ========================================================================

    async copyObject(sourceKey: string, destKey: string): Promise<void> {
        const client = getS3Client();
        await client.send(new CopyObjectCommand({
            Bucket: config.storage.bucket,
            CopySource: `${config.storage.bucket}/${sourceKey}`,
            Key: destKey,
            MetadataDirective: 'COPY',
        }));
    }

    // ========================================================================
    // TAGGING
    // ========================================================================

    async getTags(key: string): Promise<Record<string, string>> {
        const client = getS3Client();
        const response = await client.send(new GetObjectTaggingCommand({
            Bucket: config.storage.bucket,
            Key: key,
        }));

        return Object.fromEntries((response.TagSet || []).map(t => [t.Key!, t.Value!]));
    }

    async setTags(key: string, tags: Record<string, string>): Promise<void> {
        const client = getS3Client();
        await client.send(new PutObjectTaggingCommand({
            Bucket: config.storage.bucket,
            Key: key,
            Tagging: {
                TagSet: Object.entries(tags).map(([k, v]) => ({ Key: k, Value: v })),
            },
        }));
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    private async streamToBuffer(stream: Readable): Promise<Buffer> {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }

    // ========================================================================
    // KEY MANAGEMENT (delegated to KMS)
    // ========================================================================

    async createEncryptionKey(description: string, tags?: Record<string, string>): Promise<string> {
        const kms = getKmsProvider();
        const key = await kms.createKey(description, tags);
        return key.key_id;
    }

    async rotateEncryptionKey(keyId: string): Promise<void> {
        const kms = getKmsProvider();
        await kms.rotateKey(keyId);
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
    if (!storageServiceInstance) {
        storageServiceInstance = new StorageService();
    }
    return storageServiceInstance;
}

export async function initializeStorage(): Promise<StorageService> {
    const service = getStorageService();
    await service.initialize();
    return service;
}