/**
 * ADALAT360 - KMS Service
 * Abstract interface for Key Management Systems
 * Supports: Local (development), AWS KMS, Azure Key Vault, GCP KMS, HashiCorp Vault
 */

import * as crypto from 'crypto';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import {
    KmsProvider,
    EncryptionKey,
    EncryptionResult,
    DecryptionRequest,
} from '../../models/storage.js';

// ============================================================================
// LOCAL KMS (Development/Testing)
// ============================================================================

class LocalKmsProvider implements KmsProvider {
    name = 'local' as const;
    private masterKey: Buffer;
    private keyStore: Map<string, { key: Buffer; metadata: EncryptionKey }> = new Map();

    constructor() {
        // Derive master key from config
        const masterKeyHex = config.encryption.masterKey || crypto.randomBytes(32).toString('hex');
        this.masterKey = Buffer.from(masterKeyHex, 'hex');
        if (this.masterKey.length !== 32) {
            throw new Error('Master key must be 32 bytes (256 bits)');
        }
        logger.warn('Using LOCAL KMS - NOT SUITABLE FOR PRODUCTION');
    }

    async encrypt(plaintext: Buffer, keyId: string, context?: Record<string, string>): Promise<EncryptionResult> {
        const keyData = this.keyStore.get(keyId);
        if (!keyData) {
            throw new Error(`Key ${keyId} not found`);
        }

        // Generate random IV
        const iv = crypto.randomBytes(12); // 96-bit for GCM

        // Encrypt with data key
        const cipher = crypto.createCipheriv('aes-256-gcm', keyData.key, iv);
        if (context) {
            cipher.setAAD(Buffer.from(JSON.stringify(context)));
        }

        const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const authTag = cipher.getAuthTag();

        return {
            encryptedData: encrypted,
            keyId,
            algorithm: 'AES-256-GCM',
            iv,
            authTag,
        };
    }

    async decrypt(request: DecryptionRequest): Promise<Buffer> {
        const keyData = this.keyStore.get(request.keyId);
        if (!keyData) {
            throw new Error(`Key ${request.keyId} not found`);
        }

        const decipher = crypto.createDecipheriv(request.algorithm, keyData.key, request.iv);
        decipher.setAuthTag(request.authTag);

        const decrypted = Buffer.concat([decipher.update(request.encryptedData), decipher.final()]);
        return decrypted;
    }

    async generateDataKey(keyId: string, keySpec: string, context?: Record<string, string>): Promise<{
        plaintextKey: Buffer;
        encryptedKey: Buffer;
        keyId: string;
    }> {
        const keyData = this.keyStore.get(keyId);
        if (!keyData) {
            throw new Error(`Key ${keyId} not found`);
        }

        // Generate new data encryption key
        const plaintextKey = crypto.randomBytes(32); // AES-256

        // Encrypt the DEK with the master key (key wrapping)
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', keyData.key, iv);
        if (context) {
            cipher.setAAD(Buffer.from(JSON.stringify(context)));
        }
        const encryptedKey = Buffer.concat([cipher.update(plaintextKey), cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Store IV and authTag with encrypted key
        const wrappedKey = Buffer.concat([iv, encryptedKey, authTag]);

        return {
            plaintextKey,
            encryptedKey: wrappedKey,
            keyId,
        };
    }

    async createKey(description: string, tags?: Record<string, string>): Promise<EncryptionKey> {
        const keyId = `local-key-${crypto.randomBytes(16).toString('hex')}`;
        const key = crypto.randomBytes(32);

        const encryptionKey: EncryptionKey = {
            id: crypto.randomUUID(),
            key_id: keyId,
            algorithm: 'AES-256-GCM',
            key_spec: 'AES_256',
            origin: 'LOCAL',
            created_at: new Date(),
            status: 'ACTIVE',
            description,
            tags,
        };

        this.keyStore.set(keyId, { key, metadata: encryptionKey });
        return encryptionKey;
    }

    async rotateKey(keyId: string): Promise<EncryptionKey> {
        const keyData = this.keyStore.get(keyId);
        if (!keyData) {
            throw new Error(`Key ${keyId} not found`);
        }

        // Generate new key material
        const newKey = crypto.randomBytes(32);
        const newKeyId = `${keyId}-v${Date.now()}`;

        const newEncryptionKey: EncryptionKey = {
            ...keyData.metadata,
            id: crypto.randomUUID(),
            key_id: newKeyId,
            created_at: new Date(),
        };

        // Mark old key as rotated (keep for decryption of old data)
        keyData.metadata.status = 'DISABLED';
        this.keyStore.set(newKeyId, { key: newKey, metadata: newEncryptionKey });

        return newEncryptionKey;
    }

    async describeKey(keyId: string): Promise<EncryptionKey> {
        const keyData = this.keyStore.get(keyId);
        if (!keyData) {
            throw new Error(`Key ${keyId} not found`);
        }
        return keyData.metadata;
    }

    async scheduleKeyDeletion(keyId: string, pendingWindowDays: number): Promise<void> {
        const keyData = this.keyStore.get(keyId);
        if (!keyData) {
            throw new Error(`Key ${keyId} not found`);
        }

        keyData.metadata.status = 'PENDING_DELETION';
        keyData.metadata.expires_at = new Date(Date.now() + pendingWindowDays * 24 * 60 * 60 * 1000);
    }

    async cancelKeyDeletion(keyId: string): Promise<void> {
        const keyData = this.keyStore.get(keyId);
        if (!keyData) {
            throw new Error(`Key ${keyId} not found`);
        }

        keyData.metadata.status = 'ACTIVE';
        keyData.metadata.expires_at = undefined;
    }
}

// ============================================================================
// AWS KMS PROVIDER
// ============================================================================

class AwsKmsProvider implements KmsProvider {
    name = 'aws' as const;
    private client: any = null;
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            const { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand, CreateKeyCommand, DescribeKeyCommand, EnableKeyRotationCommand, ScheduleKeyDeletionCommand, CancelKeyDeletionCommand } = await import('@aws-sdk/client-kms');

            this.client = new KMSClient({
                region: config.kms.region,
                endpoint: config.kms.endpoint || undefined,
                credentials: config.kms.accessKeyId && config.kms.secretAccessKey ? {
                    accessKeyId: config.kms.accessKeyId,
                    secretAccessKey: config.kms.secretAccessKey,
                } : undefined,
            });

            this.initialized = true;
            logger.info('AWS KMS provider initialized');
        } catch (error) {
            logger.error('Failed to initialize AWS KMS:', error);
            throw error;
        }
    }

    async encrypt(plaintext: Buffer, keyId: string, context?: Record<string, string>): Promise<EncryptionResult> {
        await this.initialize();
        const { EncryptCommand } = await import('@aws-sdk/client-kms');

        const command = new EncryptCommand({
            KeyId: keyId,
            Plaintext: plaintext,
            EncryptionContext: context,
            EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
        });

        const response = await this.client.send(command);
        // AWS KMS returns ciphertext blob with embedded IV/authTag
        return {
            encryptedData: response.CiphertextBlob!,
            keyId: response.KeyId!,
            algorithm: 'AWS-KMS-AES-256-GCM',
            iv: Buffer.alloc(0), // Embedded in ciphertext
            authTag: Buffer.alloc(0), // Embedded in ciphertext
        };
    }

    async decrypt(request: DecryptionRequest): Promise<Buffer> {
        await this.initialize();
        const { DecryptCommand } = await import('@aws-sdk/client-kms');

        const command = new DecryptCommand({
            CiphertextBlob: request.encryptedData,
            EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
        });

        const response = await this.client.send(command);
        return response.Plaintext!;
    }

    async generateDataKey(keyId: string, keySpec: string, context?: Record<string, string>): Promise<{
        plaintextKey: Buffer;
        encryptedKey: Buffer;
        keyId: string;
    }> {
        await this.initialize();
        const { GenerateDataKeyCommand } = await import('@aws-sdk/client-kms');

        const command = new GenerateDataKeyCommand({
            KeyId: keyId,
            KeySpec: keySpec as any,
            EncryptionContext: context,
        });

        const response = await this.client.send(command);
        return {
            plaintextKey: response.Plaintext!,
            encryptedKey: response.CiphertextBlob!,
            keyId: response.KeyId!,
        };
    }

    async createKey(description: string, tags?: Record<string, string>): Promise<EncryptionKey> {
        await this.initialize();
        const { CreateKeyCommand, EnableKeyRotationCommand } = await import('@aws-sdk/client-kms');

        const createCommand = new CreateKeyCommand({
            Description: description,
            KeyUsage: 'ENCRYPT_DECRYPT',
            KeySpec: 'SYMMETRIC_DEFAULT',
            Origin: 'AWS_KMS',
            Tags: tags ? Object.entries(tags).map(([k, v]) => ({ TagKey: k, TagValue: v })) : [],
        });

        const createResponse = await this.client.send(createCommand);
        const keyId = createResponse.KeyMetadata!.KeyId!;

        // Enable automatic rotation
        await this.client.send(new EnableKeyRotationCommand({ KeyId: keyId }));

        return {
            id: crypto.randomUUID(),
            key_id: keyId,
            algorithm: 'AWS-KMS-AES-256-GCM',
            key_spec: 'AES_256',
            origin: 'AWS_KMS',
            created_at: new Date(),
            status: 'ACTIVE',
            description,
            tags,
        };
    }

    async rotateKey(keyId: string): Promise<EncryptionKey> {
        await this.initialize();
        // AWS KMS handles rotation automatically when enabled
        const { DescribeKeyCommand } = await import('@aws-sdk/client-kms');
        const response = await this.client.send(new DescribeKeyCommand({ KeyId: keyId }));
        return {
            id: crypto.randomUUID(),
            key_id: keyId,
            algorithm: 'AWS-KMS-AES-256-GCM',
            key_spec: 'AES_256',
            origin: 'AWS_KMS',
            created_at: response.KeyMetadata!.CreationDate!,
            status: response.KeyMetadata!.KeyState!,
            description: response.KeyMetadata!.Description,
        };
    }

    async describeKey(keyId: string): Promise<EncryptionKey> {
        await this.initialize();
        const { DescribeKeyCommand } = await import('@aws-sdk/client-kms');
        const response = await this.client.send(new DescribeKeyCommand({ KeyId: keyId }));
        return {
            id: crypto.randomUUID(),
            key_id: keyId,
            algorithm: 'AWS-KMS-AES-256-GCM',
            key_spec: 'AES_256',
            origin: 'AWS_KMS',
            created_at: response.KeyMetadata!.CreationDate!,
            status: response.KeyMetadata!.KeyState!,
            description: response.KeyMetadata!.Description,
        };
    }

    async scheduleKeyDeletion(keyId: string, pendingWindowDays: number): Promise<void> {
        await this.initialize();
        const { ScheduleKeyDeletionCommand } = await import('@aws-sdk/client-kms');
        await this.client.send(new ScheduleKeyDeletionCommand({ KeyId: keyId, PendingWindowInDays: pendingWindowDays }));
    }

    async cancelKeyDeletion(keyId: string): Promise<void> {
        await this.initialize();
        const { CancelKeyDeletionCommand } = await import('@aws-sdk/client-kms');
        await this.client.send(new CancelKeyDeletionCommand({ KeyId: keyId }));
    }
}

// ============================================================================
// AZURE KEY VAULT PROVIDER (Placeholder)
// ============================================================================

class AzureKeyVaultProvider implements KmsProvider {
    name = 'azure' as const;

    async encrypt(_plaintext: Buffer, _keyId: string, _context?: Record<string, string>): Promise<EncryptionResult> {
        throw new Error('Azure Key Vault provider not yet implemented');
    }

    async decrypt(_request: DecryptionRequest): Promise<Buffer> {
        throw new Error('Azure Key Vault provider not yet implemented');
    }

    async generateDataKey(_keyId: string, _keySpec: string, _context?: Record<string, string>): Promise<{ plaintextKey: Buffer; encryptedKey: Buffer; keyId: string }> {
        throw new Error('Azure Key Vault provider not yet implemented');
    }

    async createKey(_description: string, _tags?: Record<string, string>): Promise<EncryptionKey> {
        throw new Error('Azure Key Vault provider not yet implemented');
    }

    async rotateKey(_keyId: string): Promise<EncryptionKey> {
        throw new Error('Azure Key Vault provider not yet implemented');
    }

    async describeKey(_keyId: string): Promise<EncryptionKey> {
        throw new Error('Azure Key Vault provider not yet implemented');
    }

    async scheduleKeyDeletion(_keyId: string, _pendingWindowDays: number): Promise<void> {
        throw new Error('Azure Key Vault provider not yet implemented');
    }

    async cancelKeyDeletion(_keyId: string): Promise<void> {
        throw new Error('Azure Key Vault provider not yet implemented');
    }
}

// ============================================================================
// GCP KMS PROVIDER (Placeholder)
// ============================================================================

class GcpKmsProvider implements KmsProvider {
    name = 'gcp' as const;

    async encrypt(_plaintext: Buffer, _keyId: string, _context?: Record<string, string>): Promise<EncryptionResult> {
        throw new Error('GCP KMS provider not yet implemented');
    }

    async decrypt(_request: DecryptionRequest): Promise<Buffer> {
        throw new Error('GCP KMS provider not yet implemented');
    }

    async generateDataKey(_keyId: string, _keySpec: string, _context?: Record<string, string>): Promise<{ plaintextKey: Buffer; encryptedKey: Buffer; keyId: string }> {
        throw new Error('GCP KMS provider not yet implemented');
    }

    async createKey(_description: string, _tags?: Record<string, string>): Promise<EncryptionKey> {
        throw new Error('GCP KMS provider not yet implemented');
    }

    async rotateKey(_keyId: string): Promise<EncryptionKey> {
        throw new Error('GCP KMS provider not yet implemented');
    }

    async describeKey(_keyId: string): Promise<EncryptionKey> {
        throw new Error('GCP KMS provider not yet implemented');
    }

    async scheduleKeyDeletion(_keyId: string, _pendingWindowDays: number): Promise<void> {
        throw new Error('GCP KMS provider not yet implemented');
    }

    async cancelKeyDeletion(_keyId: string): Promise<void> {
        throw new Error('GCP KMS provider not yet implemented');
    }
}

// ============================================================================
// HASHICORP VAULT PROVIDER (Placeholder)
// ============================================================================

class HashiCorpVaultProvider implements KmsProvider {
    name = 'hashicorp' as const;

    async encrypt(_plaintext: Buffer, _keyId: string, _context?: Record<string, string>): Promise<EncryptionResult> {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }

    async decrypt(_request: DecryptionRequest): Promise<Buffer> {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }

    async generateDataKey(_keyId: string, _keySpec: string, _context?: Record<string, string>): Promise<{ plaintextKey: Buffer; encryptedKey: Buffer; keyId: string }> {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }

    async createKey(_description: string, _tags?: Record<string, string>): Promise<EncryptionKey> {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }

    async rotateKey(_keyId: string): Promise<EncryptionKey> {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }

    async describeKey(_keyId: string): Promise<EncryptionKey> {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }

    async scheduleKeyDeletion(_keyId: string, _pendingWindowDays: number): Promise<void> {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }

    async cancelKeyDeletion(_keyId: string): Promise<void> {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }
}

// ============================================================================
// KMS FACTORY
// ============================================================================

let kmsProviderInstance: KmsProvider | null = null;

export function getKmsProvider(): KmsProvider {
    if (kmsProviderInstance) {
        return kmsProviderInstance;
    }

    switch (config.kms.provider) {
        case 'aws':
            kmsProviderInstance = new AwsKmsProvider();
            break;
        case 'azure':
            kmsProviderInstance = new AzureKeyVaultProvider();
            break;
        case 'gcp':
            kmsProviderInstance = new GcpKmsProvider();
            break;
        case 'hashicorp':
            kmsProviderInstance = new HashiCorpVaultProvider();
            break;
        case 'local':
        default:
            kmsProviderInstance = new LocalKmsProvider();
            break;
    }

    return kmsProviderInstance;
}

export async function initializeKms(): Promise<KmsProvider> {
    const provider = getKmsProvider();
    if ('initialize' in provider && typeof provider.initialize === 'function') {
        await provider.initialize();
    }
    return provider;
}