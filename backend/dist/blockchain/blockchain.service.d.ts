/**
 * ADALAT360 - Blockchain Service
 * High-level service for custody ledger operations
 * Handles integration between application layer and Fabric SDK
 */
import { CustodyAction, ConsensusStatus } from '../types/database.js';
export interface CustodyEventInput {
    txType: CustodyAction;
    caseId?: string;
    documentId?: string;
    evidenceId?: string;
    actorUserId: string;
    actorNodeId: string;
    actionDetails: Record<string, any>;
    beforeStateHash?: string;
    afterStateHash?: string;
    digitalSignatureId?: string;
    endorsementPolicy?: string;
}
export interface CustodyEventRecord {
    id: string;
    tx_id: string;
    block_number: number;
    block_hash: string;
    prev_block_hash: string;
    tx_timestamp: Date;
    tx_type: CustodyAction;
    case_id?: string;
    document_id?: string;
    evidence_id?: string;
    actor_user_id: string;
    actor_node_id: string;
    action_details: Record<string, any>;
    before_state_hash?: string;
    after_state_hash?: string;
    consensus_status: ConsensusStatus;
    endorsing_nodes: string[];
    required_endorsements: number;
    received_endorsements: number;
    endorsement_policy: string;
    digital_signature_id?: string;
    payload_hash: string;
    is_valid: boolean;
    validation_error?: string;
    created_at: Date;
}
export interface BlockVerificationResult {
    valid: boolean;
    checked_blocks: number;
    errors: string[];
}
export interface ChainIntegrityResult {
    valid: boolean;
    last_block_number: number;
    last_block_hash: string;
    verified_blocks: number;
    errors: string[];
}
export declare class BlockchainService {
    private client;
    private initialized;
    initialize(organization?: string): Promise<void>;
    shutdown(): Promise<void>;
    isReady(): boolean;
    recordCustodyEvent(input: CustodyEventInput): Promise<CustodyEventRecord>;
    getCustodyEvent(txId: string): Promise<CustodyEventRecord | null>;
    getCustodyEventsByCase(caseId: string): Promise<CustodyEventRecord[]>;
    getCustodyEventsByDocument(documentId: string): Promise<CustodyEventRecord[]>;
    getCustodyEventsByEvidence(evidenceId: string): Promise<CustodyEventRecord[]>;
    getCustodyEventsByActor(userId: string, limit?: number): Promise<CustodyEventRecord[]>;
    getBlock(blockNumber: number): Promise<any>;
    getLatestBlock(): Promise<any>;
    verifyChainIntegrity(startBlock: number, endBlock: number): Promise<BlockVerificationResult>;
    registerDigitalSignature(signatureId: string, signerUserId: string, signerNodeId: string, signatureType: string, certificatePem: string, certificateSerial: string, certificateIssuer: string, certificateValidFrom: string, certificateValidTo: string, signedDataHash: string, signedDataType: string, signedDataId: string, signatureAlgorithm: string, signatureValue: string, signatureTimestamp: string): Promise<any>;
    issueBSACertificate(data: {
        certificateId: string;
        certificateNumber: string;
        caseId: string;
        documentId: string;
        section: string;
        issuedBy: string;
        hashAlgorithm: string;
        fileHash: string;
        fileSizeBytes: number;
        metadataHash: string;
        custodyLedgerTxIds: string[];
        chainOfCustodyHash: string;
        certificateContent: Record<string, any>;
        digitalSignatureId: string;
        qrCodeHash: string;
    }): Promise<any>;
    verifyFullChainIntegrity(): Promise<ChainIntegrityResult>;
    private mirrorToPostgres;
    private verifyChainIntegrityPostgres;
    private computePayloadHash;
    private mapRowToRecord;
    private mapFabricEventToRecord;
    private simulateCustodyEvent;
    private getDefaultEndorsementPolicy;
}
export declare function getBlockchainService(): BlockchainService;
export declare function initializeBlockchain(organization?: string): Promise<BlockchainService>;
export declare function shutdownBlockchain(): Promise<void>;
//# sourceMappingURL=blockchain.service.d.ts.map