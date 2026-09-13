/**
 * ADALAT360 - Blockchain Module Index
 * Exports all blockchain-related services and clients
 */

export * from './blockchain.service.js';
export * from './fabric-sdk/fabric-client.js';
export * from './chaincode/custody-ledger.js';

// Re-export types
export type {
    FabricConfig,
    CustodyEventData,
    CustodyEventResult,
    BlockData,
    DigitalSignatureData,
    BSACertificateData,
} from './fabric-sdk/fabric-client.js';

export type {
    CustodyEventInput,
    CustodyEventRecord,
    BlockVerificationResult,
    ChainIntegrityResult,
} from './blockchain.service.js';