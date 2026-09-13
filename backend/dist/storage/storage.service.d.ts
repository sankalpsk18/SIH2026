/**
 * ADALAT360 - Storage Service
 * Encrypted object storage with S3/MinIO backend and envelope encryption
 */
import { Readable } from 'stream';
import { StorageObject, PresignedUrlOptions, MultipartUploadInit, MultipartUploadPart, MultipartUploadComplete } from '../../models/storage.js';
export declare class StorageService {
    private defaultKeyId;
    private initialized;
    initialize(): Promise<void>;
    private ensureBucket;
    encryptAndStore(data: Buffer | NodeJS.ReadableStream, key: string, caseId: string, options?: {
        contentType?: string;
        metadata?: Record<string, string>;
        encryptionKeyId?: string;
        tags?: Record<string, string>;
    }): Promise<{
        keyId: string;
        algorithm: string;
        iv: Buffer;
        authTag: Buffer;
        etag: string;
    }>;
    retrieveAndDecrypt(key: string, expectedHash?: string): Promise<Buffer>;
    retrieveStream(key: string, expectedHash?: string): Promise<Readable>;
    deleteObject(key: string): Promise<void>;
    getObjectMetadata(key: string): Promise<StorageObject | null>;
    getPresignedUrl(options: PresignedUrlOptions): Promise<string>;
    initiateMultipartUpload(key: string, encryptionKeyId?: string): Promise<MultipartUploadInit>;
    uploadPart(upload: MultipartUploadPart): Promise<string>;
    completeMultipartUpload(complete: MultipartUploadComplete): Promise<{
        keyId: string;
        etag: string;
    }>;
    abortMultipartUpload(uploadId: string, key: string): Promise<void>;
    listObjects(prefix: string, maxKeys?: number): Promise<StorageObject[]>;
    copyObject(sourceKey: string, destKey: string): Promise<void>;
    getTags(key: string): Promise<Record<string, string>>;
    setTags(key: string, tags: Record<string, string>): Promise<void>;
    private streamToBuffer;
    createEncryptionKey(description: string, tags?: Record<string, string>): Promise<string>;
    rotateEncryptionKey(keyId: string): Promise<void>;
}
export declare function getStorageService(): StorageService;
export declare function initializeStorage(): Promise<StorageService>;
//# sourceMappingURL=storage.service.d.ts.map