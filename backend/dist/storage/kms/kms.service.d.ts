/**
 * ADALAT360 - KMS Service
 * Abstract interface for Key Management Systems
 * Supports: Local (development), AWS KMS, Azure Key Vault, GCP KMS, HashiCorp Vault
 */
import { KmsProvider } from '../../models/storage.js';
export declare function getKmsProvider(): KmsProvider;
export declare function initializeKms(): Promise<KmsProvider>;
//# sourceMappingURL=kms.service.d.ts.map