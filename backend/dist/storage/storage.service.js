"use strict";
/**
 * ADALAT360 - Storage Service
 * Encrypted object storage with S3/MinIO backend and envelope encryption
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
exports.getStorageService = getStorageService;
exports.initializeStorage = initializeStorage;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const stream_1 = require("stream");
const index_js_1 = require("../../config/index.js");
const logger_js_1 = require("../../utils/logger.js");
const kms_service_js_1 = require("./kms/kms.service.js");
const crypto = __importStar(require("crypto"));
// ============================================================================
// ENVELOPE ENCRYPTION HELPERS
// ============================================================================
async function envelopeEncrypt(data, keyId, context) {
    const kms = (0, kms_service_js_1.getKmsProvider)();
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
async function envelopeDecrypt(request) {
    const kms = (0, kms_service_js_1.getKmsProvider)();
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
let s3Client = null;
function getS3Client() {
    if (!s3Client) {
        s3Client = new client_s3_1.S3Client({
            region: index_js_1.config.storage.region,
            endpoint: index_js_1.config.storage.endpoint,
            credentials: {
                accessKeyId: index_js_1.config.storage.accessKeyId,
                secretAccessKey: index_js_1.config.storage.secretAccessKey,
            },
            forcePathStyle: index_js_1.config.storage.forcePathStyle,
        });
    }
    return s3Client;
}
// ============================================================================
// STORAGE SERVICE CLASS
// ============================================================================
class StorageService {
    defaultKeyId = 'default';
    initialized = false;
    async initialize() {
        if (this.initialized)
            return;
        // Ensure default key exists
        const kms = (0, kms_service_js_1.getKmsProvider)();
        try {
            await kms.describeKey(this.defaultKeyId);
        }
        catch {
            await kms.createKey('Default ADALAT360 encryption key', { purpose: 'document-storage' });
        }
        // Ensure bucket exists
        await this.ensureBucket();
        this.initialized = true;
        logger_js_1.logger.info('Storage service initialized');
    }
    async ensureBucket() {
        // In production, create bucket if not exists
        // For MinIO, bucket creation is typically done via mc CLI or console
        logger_js_1.logger.info(`Using bucket: ${index_js_1.config.storage.bucket}`);
    }
    // ========================================================================
    // ENCRYPT AND STORE
    // ========================================================================
    async encryptAndStore(data, key, caseId, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }
        const encryptionKeyId = options.encryptionKeyId || this.defaultKeyId;
        const context = { case_id: caseId, object_key: key };
        let dataBuffer;
        if (Buffer.isBuffer(data)) {
            dataBuffer = data;
        }
        else {
            // Stream to buffer
            const chunks = [];
            for await (const chunk of data) {
                chunks.push(chunk);
            }
            dataBuffer = Buffer.concat(chunks);
        }
        // Envelope encryption
        const envelope = await envelopeEncrypt(dataBuffer, encryptionKeyId, context);
        // Prepare metadata for S3
        const s3Metadata = {
            'x-amz-meta-encryption-algorithm': envelope.algorithm,
            'x-amz-meta-encryption-key-id': envelope.keyId,
            'x-amz-meta-encryption-iv': envelope.iv.toString('base64'),
            'x-amz-meta-encryption-auth-tag': envelope.authTag.toString('base64'),
            'x-amz-meta-encrypted-data-key': envelope.encryptedDataKey.toString('base64'),
            ...options.metadata,
        };
        // Upload to S3/MinIO
        const client = getS3Client();
        const command = new client_s3_1.PutObjectCommand({
            Bucket: index_js_1.config.storage.bucket,
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
    async retrieveAndDecrypt(key, expectedHash) {
        if (!this.initialized) {
            await this.initialize();
        }
        const client = getS3Client();
        const command = new client_s3_1.GetObjectCommand({
            Bucket: index_js_1.config.storage.bucket,
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
        const encryptedData = await this.streamToBuffer(response.Body);
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
    async retrieveStream(key, expectedHash) {
        // For streaming decryption, we need a transform stream
        // This is a simplified version - in production, use a proper decrypt stream
        const data = await this.retrieveAndDecrypt(key, expectedHash);
        return stream_1.Readable.from(data);
    }
    // ========================================================================
    // DELETE
    // ========================================================================
    async deleteObject(key) {
        const client = getS3Client();
        await client.send(new client_s3_1.DeleteObjectCommand({
            Bucket: index_js_1.config.storage.bucket,
            Key: key,
        }));
    }
    // ========================================================================
    // OBJECT METADATA
    // ========================================================================
    async getObjectMetadata(key) {
        const client = getS3Client();
        try {
            const response = await client.send(new client_s3_1.HeadObjectCommand({
                Bucket: index_js_1.config.storage.bucket,
                Key: key,
            }));
            const metadata = response.Metadata || {};
            return {
                key,
                bucket: index_js_1.config.storage.bucket,
                size: response.ContentLength || 0,
                etag: response.ETag || '',
                lastModified: response.LastModified || new Date(),
                contentType: response.ContentType || 'application/octet-stream',
                metadata: Object.fromEntries(Object.entries(metadata).filter(([k]) => !k.startsWith('x-amz-meta-encryption'))),
                encryption: {
                    algorithm: metadata['x-amz-meta-encryption-algorithm'] || 'AES-256-GCM',
                    keyId: metadata['x-amz-meta-encryption-key-id'] || this.defaultKeyId,
                    iv: metadata['x-amz-meta-encryption-iv'] || '',
                    authTag: metadata['x-amz-meta-encryption-auth-tag'] || '',
                },
                versionId: response.VersionId,
                isEncrypted: true,
            };
        }
        catch (error) {
            if (error.name === 'NotFound')
                return null;
            throw error;
        }
    }
    // ========================================================================
    // PRESIGNED URLS
    // ========================================================================
    async getPresignedUrl(options) {
        const client = getS3Client();
        let command;
        switch (options.operation) {
            case 'get':
                command = new client_s3_1.GetObjectCommand({
                    Bucket: options.bucket,
                    Key: options.key,
                });
                break;
            case 'put':
                command = new client_s3_1.PutObjectCommand({
                    Bucket: options.bucket,
                    Key: options.key,
                    ContentType: options.contentType,
                });
                break;
            case 'delete':
                command = new client_s3_1.DeleteObjectCommand({
                    Bucket: options.bucket,
                    Key: options.key,
                });
                break;
            default:
                throw new Error(`Unsupported operation: ${options.operation}`);
        }
        return (0, s3_request_presigner_1.getSignedUrl)(client, command, { expiresIn: options.expiresIn });
    }
    // ========================================================================
    // MULTIPART UPLOAD (for large files)
    // ========================================================================
    async initiateMultipartUpload(key, encryptionKeyId) {
        const client = getS3Client();
        const response = await client.send(new client_s3_1.CreateMultipartUploadCommand({
            Bucket: index_js_1.config.storage.bucket,
            Key: key,
            Metadata: {
                'x-amz-meta-encryption-key-id': encryptionKeyId || this.defaultKeyId,
            },
        }));
        return {
            uploadId: response.UploadId,
            key,
            bucket: index_js_1.config.storage.bucket,
            encryptionKeyId: encryptionKeyId || this.defaultKeyId,
        };
    }
    async uploadPart(upload) {
        const client = getS3Client();
        const response = await client.send(new client_s3_1.UploadPartCommand({
            Bucket: upload.bucket,
            Key: upload.key,
            UploadId: upload.uploadId,
            PartNumber: upload.partNumber,
            Body: upload.body,
        }));
        return response.ETag || '';
    }
    async completeMultipartUpload(complete) {
        const client = getS3Client();
        const response = await client.send(new client_s3_1.CompleteMultipartUploadCommand({
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
    async abortMultipartUpload(uploadId, key) {
        const client = getS3Client();
        await client.send(new client_s3_1.AbortMultipartUploadCommand({
            Bucket: index_js_1.config.storage.bucket,
            Key: key,
            UploadId: uploadId,
        }));
    }
    // ========================================================================
    // LIST OBJECTS
    // ========================================================================
    async listObjects(prefix, maxKeys = 1000) {
        const client = getS3Client();
        const response = await client.send(new client_s3_1.ListObjectsV2Command({
            Bucket: index_js_1.config.storage.bucket,
            Prefix: prefix,
            MaxKeys: maxKeys,
        }));
        return (response.Contents || []).map(obj => ({
            key: obj.Key,
            bucket: index_js_1.config.storage.bucket,
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
    async copyObject(sourceKey, destKey) {
        const client = getS3Client();
        await client.send(new client_s3_1.CopyObjectCommand({
            Bucket: index_js_1.config.storage.bucket,
            CopySource: `${index_js_1.config.storage.bucket}/${sourceKey}`,
            Key: destKey,
            MetadataDirective: 'COPY',
        }));
    }
    // ========================================================================
    // TAGGING
    // ========================================================================
    async getTags(key) {
        const client = getS3Client();
        const response = await client.send(new client_s3_1.GetObjectTaggingCommand({
            Bucket: index_js_1.config.storage.bucket,
            Key: key,
        }));
        return Object.fromEntries((response.TagSet || []).map(t => [t.Key, t.Value]));
    }
    async setTags(key, tags) {
        const client = getS3Client();
        await client.send(new client_s3_1.PutObjectTaggingCommand({
            Bucket: index_js_1.config.storage.bucket,
            Key: key,
            Tagging: {
                TagSet: Object.entries(tags).map(([k, v]) => ({ Key: k, Value: v })),
            },
        }));
    }
    // ========================================================================
    // HELPER METHODS
    // ========================================================================
    async streamToBuffer(stream) {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }
    // ========================================================================
    // KEY MANAGEMENT (delegated to KMS)
    // ========================================================================
    async createEncryptionKey(description, tags) {
        const kms = (0, kms_service_js_1.getKmsProvider)();
        const key = await kms.createKey(description, tags);
        return key.key_id;
    }
    async rotateEncryptionKey(keyId) {
        const kms = (0, kms_service_js_1.getKmsProvider)();
        await kms.rotateKey(keyId);
    }
}
exports.StorageService = StorageService;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let storageServiceInstance = null;
function getStorageService() {
    if (!storageServiceInstance) {
        storageServiceInstance = new StorageService();
    }
    return storageServiceInstance;
}
async function initializeStorage() {
    const service = getStorageService();
    await service.initialize();
    return service;
}
//# sourceMappingURL=storage.service.js.map