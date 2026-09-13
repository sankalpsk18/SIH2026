"use strict";
/**
 * ADALAT360 - KMS Service
 * Abstract interface for Key Management Systems
 * Supports: Local (development), AWS KMS, Azure Key Vault, GCP KMS, HashiCorp Vault
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
exports.getKmsProvider = getKmsProvider;
exports.initializeKms = initializeKms;
const crypto = __importStar(require("crypto"));
const index_js_1 = require("../../config/index.js");
const logger_js_1 = require("../../utils/logger.js");
// ============================================================================
// LOCAL KMS (Development/Testing)
// ============================================================================
class LocalKmsProvider {
    name = 'local';
    masterKey;
    keyStore = new Map();
    constructor() {
        // Derive master key from config
        const masterKeyHex = index_js_1.config.encryption.masterKey || crypto.randomBytes(32).toString('hex');
        this.masterKey = Buffer.from(masterKeyHex, 'hex');
        if (this.masterKey.length !== 32) {
            throw new Error('Master key must be 32 bytes (256 bits)');
        }
        logger_js_1.logger.warn('Using LOCAL KMS - NOT SUITABLE FOR PRODUCTION');
    }
    async encrypt(plaintext, keyId, context) {
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
    async decrypt(request) {
        const keyData = this.keyStore.get(request.keyId);
        if (!keyData) {
            throw new Error(`Key ${request.keyId} not found`);
        }
        const decipher = crypto.createDecipheriv(request.algorithm, keyData.key, request.iv);
        decipher.setAuthTag(request.authTag);
        const decrypted = Buffer.concat([decipher.update(request.encryptedData), decipher.final()]);
        return decrypted;
    }
    async generateDataKey(keyId, keySpec, context) {
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
    async createKey(description, tags) {
        const keyId = `local-key-${crypto.randomBytes(16).toString('hex')}`;
        const key = crypto.randomBytes(32);
        const encryptionKey = {
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
    async rotateKey(keyId) {
        const keyData = this.keyStore.get(keyId);
        if (!keyData) {
            throw new Error(`Key ${keyId} not found`);
        }
        // Generate new key material
        const newKey = crypto.randomBytes(32);
        const newKeyId = `${keyId}-v${Date.now()}`;
        const newEncryptionKey = {
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
    async describeKey(keyId) {
        const keyData = this.keyStore.get(keyId);
        if (!keyData) {
            throw new Error(`Key ${keyId} not found`);
        }
        return keyData.metadata;
    }
    async scheduleKeyDeletion(keyId, pendingWindowDays) {
        const keyData = this.keyStore.get(keyId);
        if (!keyData) {
            throw new Error(`Key ${keyId} not found`);
        }
        keyData.metadata.status = 'PENDING_DELETION';
        keyData.metadata.expires_at = new Date(Date.now() + pendingWindowDays * 24 * 60 * 60 * 1000);
    }
    async cancelKeyDeletion(keyId) {
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
class AwsKmsProvider {
    name = 'aws';
    client = null;
    initialized = false;
    async initialize() {
        if (this.initialized)
            return;
        try {
            const { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand, CreateKeyCommand, DescribeKeyCommand, EnableKeyRotationCommand, ScheduleKeyDeletionCommand, CancelKeyDeletionCommand } = await import('@aws-sdk/client-kms');
            this.client = new KMSClient({
                region: index_js_1.config.kms.region,
                endpoint: index_js_1.config.kms.endpoint || undefined,
                credentials: index_js_1.config.kms.accessKeyId && index_js_1.config.kms.secretAccessKey ? {
                    accessKeyId: index_js_1.config.kms.accessKeyId,
                    secretAccessKey: index_js_1.config.kms.secretAccessKey,
                } : undefined,
            });
            this.initialized = true;
            logger_js_1.logger.info('AWS KMS provider initialized');
        }
        catch (error) {
            logger_js_1.logger.error('Failed to initialize AWS KMS:', error);
            throw error;
        }
    }
    async encrypt(plaintext, keyId, context) {
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
            encryptedData: response.CiphertextBlob,
            keyId: response.KeyId,
            algorithm: 'AWS-KMS-AES-256-GCM',
            iv: Buffer.alloc(0), // Embedded in ciphertext
            authTag: Buffer.alloc(0), // Embedded in ciphertext
        };
    }
    async decrypt(request) {
        await this.initialize();
        const { DecryptCommand } = await import('@aws-sdk/client-kms');
        const command = new DecryptCommand({
            CiphertextBlob: request.encryptedData,
            EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
        });
        const response = await this.client.send(command);
        return response.Plaintext;
    }
    async generateDataKey(keyId, keySpec, context) {
        await this.initialize();
        const { GenerateDataKeyCommand } = await import('@aws-sdk/client-kms');
        const command = new GenerateDataKeyCommand({
            KeyId: keyId,
            KeySpec: keySpec,
            EncryptionContext: context,
        });
        const response = await this.client.send(command);
        return {
            plaintextKey: response.Plaintext,
            encryptedKey: response.CiphertextBlob,
            keyId: response.KeyId,
        };
    }
    async createKey(description, tags) {
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
        const keyId = createResponse.KeyMetadata.KeyId;
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
    async rotateKey(keyId) {
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
            created_at: response.KeyMetadata.CreationDate,
            status: response.KeyMetadata.KeyState,
            description: response.KeyMetadata.Description,
        };
    }
    async describeKey(keyId) {
        await this.initialize();
        const { DescribeKeyCommand } = await import('@aws-sdk/client-kms');
        const response = await this.client.send(new DescribeKeyCommand({ KeyId: keyId }));
        return {
            id: crypto.randomUUID(),
            key_id: keyId,
            algorithm: 'AWS-KMS-AES-256-GCM',
            key_spec: 'AES_256',
            origin: 'AWS_KMS',
            created_at: response.KeyMetadata.CreationDate,
            status: response.KeyMetadata.KeyState,
            description: response.KeyMetadata.Description,
        };
    }
    async scheduleKeyDeletion(keyId, pendingWindowDays) {
        await this.initialize();
        const { ScheduleKeyDeletionCommand } = await import('@aws-sdk/client-kms');
        await this.client.send(new ScheduleKeyDeletionCommand({ KeyId: keyId, PendingWindowInDays: pendingWindowDays }));
    }
    async cancelKeyDeletion(keyId) {
        await this.initialize();
        const { CancelKeyDeletionCommand } = await import('@aws-sdk/client-kms');
        await this.client.send(new CancelKeyDeletionCommand({ KeyId: keyId }));
    }
}
// ============================================================================
// AZURE KEY VAULT PROVIDER (Placeholder)
// ============================================================================
class AzureKeyVaultProvider {
    name = 'azure';
    async encrypt(_plaintext, _keyId, _context) {
        throw new Error('Azure Key Vault provider not yet implemented');
    }
    async decrypt(_request) {
        throw new Error('Azure Key Vault provider not yet implemented');
    }
    async generateDataKey(_keyId, _keySpec, _context) {
        throw new Error('Azure Key Vault provider not yet implemented');
    }
    async createKey(_description, _tags) {
        throw new Error('Azure Key Vault provider not yet implemented');
    }
    async rotateKey(_keyId) {
        throw new Error('Azure Key Vault provider not yet implemented');
    }
    async describeKey(_keyId) {
        throw new Error('Azure Key Vault provider not yet implemented');
    }
    async scheduleKeyDeletion(_keyId, _pendingWindowDays) {
        throw new Error('Azure Key Vault provider not yet implemented');
    }
    async cancelKeyDeletion(_keyId) {
        throw new Error('Azure Key Vault provider not yet implemented');
    }
}
// ============================================================================
// GCP KMS PROVIDER (Placeholder)
// ============================================================================
class GcpKmsProvider {
    name = 'gcp';
    async encrypt(_plaintext, _keyId, _context) {
        throw new Error('GCP KMS provider not yet implemented');
    }
    async decrypt(_request) {
        throw new Error('GCP KMS provider not yet implemented');
    }
    async generateDataKey(_keyId, _keySpec, _context) {
        throw new Error('GCP KMS provider not yet implemented');
    }
    async createKey(_description, _tags) {
        throw new Error('GCP KMS provider not yet implemented');
    }
    async rotateKey(_keyId) {
        throw new Error('GCP KMS provider not yet implemented');
    }
    async describeKey(_keyId) {
        throw new Error('GCP KMS provider not yet implemented');
    }
    async scheduleKeyDeletion(_keyId, _pendingWindowDays) {
        throw new Error('GCP KMS provider not yet implemented');
    }
    async cancelKeyDeletion(_keyId) {
        throw new Error('GCP KMS provider not yet implemented');
    }
}
// ============================================================================
// HASHICORP VAULT PROVIDER (Placeholder)
// ============================================================================
class HashiCorpVaultProvider {
    name = 'hashicorp';
    async encrypt(_plaintext, _keyId, _context) {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }
    async decrypt(_request) {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }
    async generateDataKey(_keyId, _keySpec, _context) {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }
    async createKey(_description, _tags) {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }
    async rotateKey(_keyId) {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }
    async describeKey(_keyId) {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }
    async scheduleKeyDeletion(_keyId, _pendingWindowDays) {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }
    async cancelKeyDeletion(_keyId) {
        throw new Error('HashiCorp Vault provider not yet implemented');
    }
}
// ============================================================================
// KMS FACTORY
// ============================================================================
let kmsProviderInstance = null;
function getKmsProvider() {
    if (kmsProviderInstance) {
        return kmsProviderInstance;
    }
    switch (index_js_1.config.kms.provider) {
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
async function initializeKms() {
    const provider = getKmsProvider();
    if ('initialize' in provider && typeof provider.initialize === 'function') {
        await provider.initialize();
    }
    return provider;
}
//# sourceMappingURL=kms.service.js.map