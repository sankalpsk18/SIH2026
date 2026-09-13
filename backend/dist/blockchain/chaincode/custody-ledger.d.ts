/**
 * ADALAT360 - Hyperledger Fabric Chaincode (Smart Contract)
 * Custody Ledger for Legal Evidence Management
 *
 * This chaincode implements the core custody ledger logic with:
 * - Multi-organization endorsement policies
 * - Immutable transaction recording
 * - Anti-tampering enforcement
 * - BSA Section 63 compliance
 *
 * Compile with: tsc --target ES2020 --module commonjs --outDir ./dist custody-ledger.ts
 * Package as: .tar.gz for Fabric deployment
 */
import { Context, Contract } from 'fabric-contract-api';
export declare enum CustodyAction {
    UPLOAD = "UPLOAD",
    ACCESS = "ACCESS",
    TRANSFER = "TRANSFER",
    REDACTION = "REDACTION",
    EXPORT = "EXPORT",
    VERSION_CREATE = "VERSION_CREATE",
    METADATA_UPDATE = "METADATA_UPDATE",
    VERIFICATION = "VERIFICATION",
    SIGNATURE_APPLY = "SIGNATURE_APPLY",
    SEIZURE = "SEIZURE",
    HANDOVER = "HANDOVER",
    RECEIVE = "RECEIVE",
    ANALYSIS_START = "ANALYSIS_START",
    ANALYSIS_COMPLETE = "ANALYSIS_COMPLETE",
    COURT_SUBMISSION = "COURT_SUBMISSION",
    COURT_RETURN = "COURT_RETURN",
    DISPOSAL = "DISPOSAL"
}
export declare enum ConsensusStatus {
    PENDING = "PENDING",
    ENDORSED = "ENDORSED",
    COMMITTED = "COMMITTED",
    REJECTED = "REJECTED",
    FAILED = "FAILED"
}
export declare enum NodeType {
    OFFICER_NODE = "OFFICER_NODE",
    FORENSIC_LAB_NODE = "FORENSIC_LAB_NODE",
    COURT_NODE = "COURT_NODE",
    CENTRAL_AUDIT_NODE = "CENTRAL_AUDIT_NODE"
}
export interface CustodyEvent {
    txId: string;
    blockNumber: number;
    blockHash: string;
    prevBlockHash: string;
    timestamp: string;
    txType: CustodyAction;
    caseId?: string;
    documentId?: string;
    evidenceId?: string;
    actorUserId: string;
    actorNodeId: string;
    actorRole: string;
    actionDetails: Record<string, any>;
    beforeStateHash?: string;
    afterStateHash?: string;
    consensusStatus: ConsensusStatus;
    endorsingNodes: string[];
    requiredEndorsements: number;
    receivedEndorsements: number;
    endorsementPolicy: string;
    digitalSignatureId?: string;
    payloadHash: string;
    isValid: boolean;
    validationError?: string;
}
export interface BlockHeader {
    blockNumber: number;
    blockHash: string;
    prevBlockHash: string;
    txCount: number;
    txIds: string[];
    merkleRoot: string;
    proposerNodeId: string;
    committedAt: string;
}
export interface DigitalSignature {
    signatureId: string;
    signerUserId: string;
    signerNodeId: string;
    signatureType: string;
    certificatePem: string;
    certificateSerial: string;
    certificateIssuer: string;
    certificateValidFrom: string;
    certificateValidTo: string;
    signedDataHash: string;
    signedDataType: string;
    signedDataId: string;
    signatureAlgorithm: string;
    signatureValue: string;
    signatureTimestamp: string;
    isVerified: boolean;
    verifiedAt?: string;
}
export interface BSA63Certificate {
    certificateId: string;
    certificateNumber: string;
    caseId: string;
    documentId: string;
    section: string;
    issuedBy: string;
    issuedAt: string;
    validFrom: string;
    validUntil?: string;
    hashAlgorithm: string;
    fileHash: string;
    fileSizeBytes: number;
    metadataHash: string;
    custodyLedgerTxIds: string[];
    chainOfCustodyHash: string;
    certificateContent: Record<string, any>;
    digitalSignatureId?: string;
    qrCodeHash: string;
    status: string;
}
export interface OrganizationIdentity {
    mspId: string;
    nodeId: string;
    nodeType: NodeType;
    certPem: string;
    isActive: boolean;
}
export declare class CustodyLedgerContract extends Contract {
    initLedger(ctx: Context): Promise<string>;
    recordCustodyEvent(ctx: Context, txType: string, caseId: string, documentId: string, evidenceId: string, actionDetails: string, // JSON string
    beforeStateHash: string, afterStateHash: string, digitalSignatureId: string, endorsementPolicy: string): Promise<string>;
    queryCustodyEvent(ctx: Context, txId: string): Promise<string>;
    queryCustodyEventsByCase(ctx: Context, caseId: string): Promise<string>;
    queryCustodyEventsByDocument(ctx: Context, documentId: string): Promise<string>;
    queryCustodyEventsByEvidence(ctx: Context, evidenceId: string): Promise<string>;
    queryBlock(ctx: Context, blockNumber: number): Promise<string>;
    queryLatestBlock(ctx: Context): Promise<string>;
    queryBlockRange(ctx: Context, startBlock: number, endBlock: number): Promise<string>;
    verifyChainIntegrity(ctx: Context, startBlock: number, endBlock: number): Promise<string>;
    registerDigitalSignature(ctx: Context, signatureId: string, signerUserId: string, signerNodeId: string, signatureType: string, certificatePem: string, certificateSerial: string, certificateIssuer: string, certificateValidFrom: string, certificateValidTo: string, signedDataHash: string, signedDataType: string, signedDataId: string, signatureAlgorithm: string, signatureValue: string, // base64
    signatureTimestamp: string): Promise<string>;
    queryDigitalSignature(ctx: Context, signatureId: string): Promise<string>;
    verifyDigitalSignature(ctx: Context, signatureId: string, verifiedBy: string): Promise<string>;
    issueBSACertificate(ctx: Context, certificateId: string, certificateNumber: string, caseId: string, documentId: string, section: string, issuedBy: string, hashAlgorithm: string, fileHash: string, fileSizeBytes: number, metadataHash: string, custodyLedgerTxIds: string, // JSON array string
    chainOfCustodyHash: string, certificateContent: string, // JSON string
    digitalSignatureId: string, qrCodeHash: string): Promise<string>;
    queryBSACertificate(ctx: Context, certificateId: string): Promise<string>;
    queryBSACertificatesByCase(ctx: Context, caseId: string): Promise<string>;
    registerOrganization(ctx: Context, mspId: string, nodeId: string, nodeType: string, certPem: string): Promise<string>;
    queryOrganization(ctx: Context, mspId: string): Promise<string>;
    queryAllOrganizations(ctx: Context): Promise<string>;
    private parseEndorsementPolicy;
    private verifyClientEndorsements;
}
export declare const contract: CustodyLedgerContract;
//# sourceMappingURL=custody-ledger.d.ts.map