/**
 * ADALAT360 - Storage Models
 * TypeScript interfaces for encrypted storage management
 */
export interface EncryptionKey {
    id: string;
    key_id: string;
    algorithm: string;
    key_spec: string;
    origin: 'LOCAL' | 'AWS_KMS' | 'AZURE_KEY_VAULT' | 'GCP_KMS' | 'HASHICORP_VAULT';
    created_at: Date;
    expires_at?: Date;
    status: 'ACTIVE' | 'DISABLED' | 'PENDING_DELETION' | 'DELETED';
    description?: string;
    tags?: Record<string, string>;
}
export interface EncryptionResult {
    encryptedData: Buffer;
    keyId: string;
    algorithm: string;
    iv: Buffer;
    authTag: Buffer;
    keyVersion?: string;
}
export interface DecryptionRequest {
    encryptedData: Buffer;
    keyId: string;
    algorithm: string;
    iv: Buffer;
    authTag: Buffer;
    keyVersion?: string;
}
export interface StorageObject {
    key: string;
    bucket: string;
    size: number;
    etag: string;
    lastModified: Date;
    contentType: string;
    metadata: Record<string, string>;
    encryption: {
        algorithm: string;
        keyId: string;
        iv: string;
        authTag: string;
    };
    versionId?: string;
    isEncrypted: boolean;
}
export interface StorageUploadOptions {
    key: string;
    bucket: string;
    body: Buffer | NodeJS.ReadableStream;
    contentType: string;
    metadata?: Record<string, string>;
    encryptionKeyId?: string;
    tags?: Record<string, string>;
}
export interface StorageDownloadOptions {
    key: string;
    bucket: string;
    versionId?: string;
    range?: {
        start: number;
        end: number;
    };
}
export interface PresignedUrlOptions {
    key: string;
    bucket: string;
    expiresIn: number;
    operation: 'get' | 'put' | 'delete';
    contentType?: string;
}
export interface KmsProvider {
    name: 'local' | 'aws' | 'azure' | 'gcp' | 'hashicorp';
    encrypt: (plaintext: Buffer, keyId: string, context?: Record<string, string>) => Promise<EncryptionResult>;
    decrypt: (request: DecryptionRequest) => Promise<Buffer>;
    generateDataKey: (keyId: string, keySpec: string, context?: Record<string, string>) => Promise<{
        plaintextKey: Buffer;
        encryptedKey: Buffer;
        keyId: string;
    }>;
    createKey: (description: string, tags?: Record<string, string>) => Promise<EncryptionKey>;
    rotateKey: (keyId: string) => Promise<EncryptionKey>;
    describeKey: (keyId: string) => Promise<EncryptionKey>;
    scheduleKeyDeletion: (keyId: string, pendingWindowDays: number) => Promise<void>;
    cancelKeyDeletion: (keyId: string) => Promise<void>;
}
export interface LocalKmsConfig {
    masterKey: Buffer;
    keyStore: Map<string, Buffer>;
}
export interface EnvelopeEncryptionResult {
    encryptedData: Buffer;
    encryptedDataKey: Buffer;
    keyId: string;
    algorithm: string;
    iv: Buffer;
    authTag: Buffer;
}
export interface EnvelopeDecryptionRequest {
    encryptedData: Buffer;
    encryptedDataKey: Buffer;
    keyId: string;
    algorithm: string;
    iv: Buffer;
    authTag: Buffer;
}
export interface MultipartUploadInit {
    uploadId: string;
    key: string;
    bucket: string;
    encryptionKeyId: string;
}
export interface MultipartUploadPart {
    uploadId: string;
    key: string;
    bucket: string;
    partNumber: number;
    body: Buffer;
}
export interface MultipartUploadComplete {
    uploadId: string;
    key: string;
    bucket: string;
    parts: Array<{
        partNumber: number;
        etag: string;
    }>;
}
export interface EncryptedReadStream extends NodeJS.ReadableStream {
    decrypt: () => NodeJS.ReadableStream;
}
export interface EncryptedWriteStream extends NodeJS.WritableStream {
    finalize: () => Promise<{
        keyId: string;
        iv: Buffer;
        authTag: Buffer;
    }>;
}
//# sourceMappingURL=storage.d.ts.map