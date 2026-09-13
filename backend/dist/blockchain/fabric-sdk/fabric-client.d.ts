/**
 * ADALAT360 - Hyperledger Fabric SDK Wrapper
 * Node.js client for interacting with the custody ledger chaincode
 */
import { Gateway, Contract } from 'fabric-network';
export interface FabricConfig {
    connectionProfilePath: string;
    walletPath: string;
    organization: string;
    channelName: string;
    chaincodeName: string;
    userId: string;
}
export interface CustodyEventData {
    txType: string;
    caseId?: string;
    documentId?: string;
    evidenceId?: string;
    actionDetails: Record<string, any>;
    beforeStateHash?: string;
    afterStateHash?: string;
    digitalSignatureId?: string;
    endorsementPolicy?: string;
}
export interface CustodyEventResult {
    txId: string;
    blockNumber: number;
    blockHash: string;
    event: any;
}
export interface BlockData {
    blockNumber: number;
    blockHash: string;
    prevBlockHash: string;
    txCount: number;
    txIds: string[];
    merkleRoot: string;
    proposerNodeId: string;
    committedAt: string;
}
export interface DigitalSignatureData {
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
}
export interface BSACertificateData {
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
}
export declare class FabricClient {
    private gateway;
    private contract;
    private network;
    private config;
    private connected;
    constructor(config: FabricConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    recordCustodyEvent(data: CustodyEventData): Promise<CustodyEventResult>;
    queryCustodyEvent(txId: string): Promise<any>;
    queryCustodyEventsByCase(caseId: string): Promise<any[]>;
    queryCustodyEventsByDocument(documentId: string): Promise<any[]>;
    queryCustodyEventsByEvidence(evidenceId: string): Promise<any[]>;
    queryBlock(blockNumber: number): Promise<BlockData>;
    queryLatestBlock(): Promise<BlockData>;
    queryBlockRange(startBlock: number, endBlock: number): Promise<BlockData[]>;
    verifyChainIntegrity(startBlock: number, endBlock: number): Promise<any>;
    registerDigitalSignature(data: DigitalSignatureData): Promise<any>;
    queryDigitalSignature(signatureId: string): Promise<any>;
    verifyDigitalSignature(signatureId: string, verifiedBy: string): Promise<any>;
    issueBSACertificate(data: BSACertificateData): Promise<any>;
    queryBSACertificate(certificateId: string): Promise<any>;
    queryBSACertificatesByCase(caseId: string): Promise<any[]>;
    registerOrganization(mspId: string, nodeId: string, nodeType: string, certPem: string): Promise<any>;
    queryOrganization(mspId: string): Promise<any>;
    queryAllOrganizations(): Promise<any[]>;
    initLedger(): Promise<string>;
    listenForEvents(eventName: string, callback: (event: any) => void): Promise<() => void>;
    private ensureConnected;
    private getDefaultEndorsementPolicy;
    getContract(): Contract | null;
    getGateway(): Gateway | null;
}
export declare function getFabricClient(organization?: string): Promise<FabricClient>;
export declare function closeFabricClient(): Promise<void>;
export declare function enrollAdmin(orgName: string, caUrl: string, adminId: string, adminSecret: string, walletPath: string, mspId: string): Promise<void>;
export declare function registerAndEnrollUser(orgName: string, caUrl: string, adminId: string, userId: string, walletPath: string, mspId: string, attrs?: Record<string, string>): Promise<void>;
//# sourceMappingURL=fabric-client.d.ts.map