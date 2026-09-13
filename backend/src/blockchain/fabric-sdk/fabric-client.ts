/**
 * ADALAT360 - Hyperledger Fabric SDK Wrapper
 * Node.js client for interacting with the custody ledger chaincode
 */

import * as fs from 'fs';
import * as path from 'path';
import { Gateway, Wallets, GatewayOptions, Identity, SigningIdentity, Contract, Network } from 'fabric-network';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// FABRIC CLIENT CLASS
// ============================================================================

export class FabricClient {
    private gateway: Gateway | null = null;
    private contract: Contract | null = null;
    private network: Network | null = null;
    private config: FabricConfig;
    private connected: boolean = false;

    constructor(config: FabricConfig) {
        this.config = config;
    }

    // ========================================================================
    // CONNECTION MANAGEMENT
    // ========================================================================

    async connect(): Promise<void> {
        if (this.connected && this.gateway) {
            return;
        }

        try {
            // Load connection profile
            const ccpPath = path.resolve(this.config.connectionProfilePath);
            if (!fs.existsSync(ccpPath)) {
                throw new Error(`Connection profile not found at ${ccpPath}`);
            }
            const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

            // Create wallet
            const walletPath = path.resolve(this.config.walletPath);
            const wallet = await Wallets.newFileSystemWallet(walletPath);

            // Check if identity exists
            const identity = await wallet.get(this.config.userId);
            if (!identity) {
                throw new Error(`Identity ${this.config.userId} not found in wallet. Please enroll first.`);
            }

            // Connect to gateway
            const gatewayOptions: GatewayOptions = {
                wallet,
                identity: this.config.userId,
                discovery: { enabled: true, asLocalhost: config.env === 'development' },
                eventHandlerOptions: {
                    commitTimeout: 100,
                    strategy: undefined,
                },
            };

            this.gateway = new Gateway();
            await this.gateway.connect(ccp, gatewayOptions);

            // Get network and contract
            this.network = await this.gateway.getNetwork(this.config.channelName);
            this.contract = this.network.getContract(this.config.chaincodeName);

            this.connected = true;
            logger.info(`Connected to Fabric network: ${this.config.channelName}, chaincode: ${this.config.chaincodeName}`);

        } catch (error) {
            logger.error('Failed to connect to Fabric:', error);
            this.connected = false;
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.gateway) {
            this.gateway.disconnect();
            this.gateway = null;
            this.contract = null;
            this.network = null;
            this.connected = false;
            logger.info('Disconnected from Fabric network');
        }
    }

    isConnected(): boolean {
        return this.connected && this.gateway !== null;
    }

    // ========================================================================
    // CUSTODY EVENT OPERATIONS
    // ========================================================================

    async recordCustodyEvent(data: CustodyEventData): Promise<CustodyEventResult> {
        this.ensureConnected();

        try {
            const endorsementPolicy = data.endorsementPolicy || this.getDefaultEndorsementPolicy();

            const result = await this.contract!.submitTransaction(
                'recordCustodyEvent',
                data.txType,
                data.caseId || '',
                data.documentId || '',
                data.evidenceId || '',
                JSON.stringify(data.actionDetails),
                data.beforeStateHash || '',
                data.afterStateHash || '',
                data.digitalSignatureId || '',
                endorsementPolicy
            );

            const parsed = JSON.parse(result.toString());
            logger.info(`Custody event recorded: ${parsed.txId} in block ${parsed.blockNumber}`);

            return parsed;
        } catch (error) {
            logger.error('Failed to record custody event:', error);
            throw new Error(`Failed to record custody event: ${(error as Error).message}`);
        }
    }

    async queryCustodyEvent(txId: string): Promise<any> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryCustodyEvent', txId);
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to query custody event ${txId}:`, error);
            throw new Error(`Failed to query custody event: ${(error as Error).message}`);
        }
    }

    async queryCustodyEventsByCase(caseId: string): Promise<any[]> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryCustodyEventsByCase', caseId);
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to query custody events for case ${caseId}:`, error);
            throw new Error(`Failed to query custody events: ${(error as Error).message}`);
        }
    }

    async queryCustodyEventsByDocument(documentId: string): Promise<any[]> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryCustodyEventsByDocument', documentId);
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to query custody events for document ${documentId}:`, error);
            throw new Error(`Failed to query custody events: ${(error as Error).message}`);
        }
    }

    async queryCustodyEventsByEvidence(evidenceId: string): Promise<any[]> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryCustodyEventsByEvidence', evidenceId);
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to query custody events for evidence ${evidenceId}:`, error);
            throw new Error(`Failed to query custody events: ${(error as Error).message}`);
        }
    }

    // ========================================================================
    // BLOCK QUERY OPERATIONS
    // ========================================================================

    async queryBlock(blockNumber: number): Promise<BlockData> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryBlock', blockNumber.toString());
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to query block ${blockNumber}:`, error);
            throw new Error(`Failed to query block: ${(error as Error).message}`);
        }
    }

    async queryLatestBlock(): Promise<BlockData> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryLatestBlock');
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error('Failed to query latest block:', error);
            throw new Error(`Failed to query latest block: ${(error as Error).message}`);
        }
    }

    async queryBlockRange(startBlock: number, endBlock: number): Promise<BlockData[]> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryBlockRange', startBlock.toString(), endBlock.toString());
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to query block range ${startBlock}-${endBlock}:`, error);
            throw new Error(`Failed to query block range: ${(error as Error).message}`);
        }
    }

    async verifyChainIntegrity(startBlock: number, endBlock: number): Promise<any> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('verifyChainIntegrity', startBlock.toString(), endBlock.toString());
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to verify chain integrity ${startBlock}-${endBlock}:`, error);
            throw new Error(`Failed to verify chain integrity: ${(error as Error).message}`);
        }
    }

    // ========================================================================
    // DIGITAL SIGNATURE OPERATIONS
    // ========================================================================

    async registerDigitalSignature(data: DigitalSignatureData): Promise<any> {
        this.ensureConnected();

        try {
            const result = await this.contract!.submitTransaction(
                'registerDigitalSignature',
                data.signatureId,
                data.signerUserId,
                data.signerNodeId,
                data.signatureType,
                data.certificatePem,
                data.certificateSerial,
                data.certificateIssuer,
                data.certificateValidFrom,
                data.certificateValidTo,
                data.signedDataHash,
                data.signedDataType,
                data.signedDataId,
                data.signatureAlgorithm,
                data.signatureValue,
                data.signatureTimestamp
            );

            return JSON.parse(result.toString());
        } catch (error) {
            logger.error('Failed to register digital signature:', error);
            throw new Error(`Failed to register digital signature: ${(error as Error).message}`);
        }
    }

    async queryDigitalSignature(signatureId: string): Promise<any> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryDigitalSignature', signatureId);
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to query digital signature ${signatureId}:`, error);
            throw new Error(`Failed to query digital signature: ${(error as Error).message}`);
        }
    }

    async verifyDigitalSignature(signatureId: string, verifiedBy: string): Promise<any> {
        this.ensureConnected();

        try {
            const result = await this.contract!.submitTransaction('verifyDigitalSignature', signatureId, verifiedBy);
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to verify digital signature ${signatureId}:`, error);
            throw new Error(`Failed to verify digital signature: ${(error as Error).message}`);
        }
    }

    // ========================================================================
    // BSA CERTIFICATE OPERATIONS
    // ========================================================================

    async issueBSACertificate(data: BSACertificateData): Promise<any> {
        this.ensureConnected();

        try {
            const result = await this.contract!.submitTransaction(
                'issueBSACertificate',
                data.certificateId,
                data.certificateNumber,
                data.caseId,
                data.documentId,
                data.section,
                data.issuedBy,
                data.hashAlgorithm,
                data.fileHash,
                data.fileSizeBytes.toString(),
                data.metadataHash,
                JSON.stringify(data.custodyLedgerTxIds),
                data.chainOfCustodyHash,
                JSON.stringify(data.certificateContent),
                data.digitalSignatureId,
                data.qrCodeHash
            );

            return JSON.parse(result.toString());
        } catch (error) {
            logger.error('Failed to issue BSA certificate:', error);
            throw new Error(`Failed to issue BSA certificate: ${(error as Error).message}`);
        }
    }

    async queryBSACertificate(certificateId: string): Promise<any> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryBSACertificate', certificateId);
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to query BSA certificate ${certificateId}:`, error);
            throw new Error(`Failed to query BSA certificate: ${(error as Error).message}`);
        }
    }

    async queryBSACertificatesByCase(caseId: string): Promise<any[]> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryBSACertificatesByCase', caseId);
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to query BSA certificates for case ${caseId}:`, error);
            throw new Error(`Failed to query BSA certificates: ${(error as Error).message}`);
        }
    }

    // ========================================================================
    // ORGANIZATION OPERATIONS
    // ========================================================================

    async registerOrganization(mspId: string, nodeId: string, nodeType: string, certPem: string): Promise<any> {
        this.ensureConnected();

        try {
            const result = await this.contract!.submitTransaction(
                'registerOrganization',
                mspId,
                nodeId,
                nodeType,
                certPem
            );
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to register organization ${mspId}:`, error);
            throw new Error(`Failed to register organization: ${(error as Error).message}`);
        }
    }

    async queryOrganization(mspId: string): Promise<any> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryOrganization', mspId);
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error(`Failed to query organization ${mspId}:`, error);
            throw new Error(`Failed to query organization: ${(error as Error).message}`);
        }
    }

    async queryAllOrganizations(): Promise<any[]> {
        this.ensureConnected();

        try {
            const result = await this.contract!.evaluateTransaction('queryAllOrganizations');
            return JSON.parse(result.toString());
        } catch (error) {
            logger.error('Failed to query all organizations:', error);
            throw new Error(`Failed to query organizations: ${(error as Error).message}`);
        }
    }

    // ========================================================================
    // LEDGER INITIALIZATION
    // ========================================================================

    async initLedger(): Promise<string> {
        this.ensureConnected();

        try {
            const result = await this.contract!.submitTransaction('initLedger');
            return result.toString();
        } catch (error) {
            logger.error('Failed to initialize ledger:', error);
            throw new Error(`Failed to initialize ledger: ${(error as Error).message}`);
        }
    }

    // ========================================================================
    // EVENT LISTENING
    // ========================================================================

    async listenForEvents(eventName: string, callback: (event: any) => void): Promise<() => void> {
        this.ensureConnected();

        const listener = async (event: any) => {
            try {
                const payload = JSON.parse(event.payload.toString());
                callback({ ...event, payload });
            } catch (error) {
                logger.error(`Error processing event ${eventName}:`, error);
            }
        };

        await this.contract!.addContractListener(eventName, listener);

        // Return unsubscribe function
        return async () => {
            await this.contract!.removeContractListener(eventName, listener);
        };
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    private ensureConnected(): void {
        if (!this.connected || !this.contract) {
            throw new Error('Not connected to Fabric network. Call connect() first.');
        }
    }

    private getDefaultEndorsementPolicy(): string {
        // Default policy: AND('OfficerMSP.peer', 'ForensicLabMSP.peer')
        // This ensures at least one officer node AND one forensic lab node endorses
        return "AND('OfficerMSP.peer', 'ForensicLabMSP.peer')";
    }

    getContract(): Contract | null {
        return this.contract;
    }

    getGateway(): Gateway | null {
        return this.gateway;
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let fabricClientInstance: FabricClient | null = null;

export async function getFabricClient(organization?: string): Promise<FabricClient> {
    if (fabricClientInstance && fabricClientInstance.isConnected()) {
        return fabricClientInstance;
    }

    const org = organization || config.blockchain.organizations[0].mspId;
    const orgConfig = config.blockchain.organizations.find(o => o.mspId === org);

    if (!orgConfig) {
        throw new Error(`Organization ${org} not found in config`);
    }

    const clientConfig: FabricConfig = {
        connectionProfilePath: path.resolve('./fabric-config/connection-profile.json'),
        walletPath: config.blockchain.walletPath,
        organization: org,
        channelName: config.blockchain.network.channel,
        chaincodeName: config.blockchain.network.chaincode,
        userId: `admin_${org.toLowerCase()}`,
    };

    fabricClientInstance = new FabricClient(clientConfig);
    await fabricClientInstance.connect();

    return fabricClientInstance;
}

export async function closeFabricClient(): Promise<void> {
    if (fabricClientInstance) {
        await fabricClientInstance.disconnect();
        fabricClientInstance = null;
    }
}

// ============================================================================
// IDENTITY MANAGEMENT
// ============================================================================

export async function enrollAdmin(
    orgName: string,
    caUrl: string,
    adminId: string,
    adminSecret: string,
    walletPath: string,
    mspId: string
): Promise<void> {
    const { Gateway, Wallets } = await import('fabric-network');
    const FabricCAServices = (await import('fabric-ca-client')).default;

    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Check if already enrolled
    const existing = await wallet.get(adminId);
    if (existing) {
        logger.info(`Admin ${adminId} already enrolled`);
        return;
    }

    // Connect to CA
    const ca = new FabricCAServices(caUrl);
    const enrollment = await ca.enroll({ enrollmentID: adminId, enrollmentSecret: adminSecret });

    // Create identity
    const x509Identity = {
        credentials: {
            certificate: enrollment.certificate,
            privateKey: enrollment.key.toBytes(),
        },
        mspId,
        type: 'X.509',
    };

    await wallet.put(adminId, x509Identity);
    logger.info(`Admin ${adminId} enrolled successfully`);
}

export async function registerAndEnrollUser(
    orgName: string,
    caUrl: string,
    adminId: string,
    userId: string,
    walletPath: string,
    mspId: string,
    attrs?: Record<string, string>
): Promise<void> {
    const { Gateway, Wallets } = await import('fabric-network');
    const FabricCAServices = (await import('fabric-ca-client')).default;

    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Check if already enrolled
    const existing = await wallet.get(userId);
    if (existing) {
        logger.info(`User ${userId} already enrolled`);
        return;
    }

    // Get admin identity
    const adminIdentity = await wallet.get(adminId);
    if (!adminIdentity) {
        throw new Error(`Admin ${adminId} not found in wallet`);
    }

    // Connect to CA
    const ca = new FabricCAServices(caUrl);
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, adminId);

    // Register user
    const secret = await ca.register({
        affiliation: orgName.toLowerCase(),
        enrollmentID: userId,
        role: 'client',
        attrs: attrs ? Object.entries(attrs).map(([name, value]) => ({ name, value })) : [],
    }, adminUser);

    // Enroll user
    const enrollment = await ca.enroll({ enrollmentID: userId, enrollmentSecret: secret });

    // Create identity
    const x509Identity = {
        credentials: {
            certificate: enrollment.certificate,
            privateKey: enrollment.key.toBytes(),
        },
        mspId,
        type: 'X.509',
    };

    await wallet.put(userId, x509Identity);
    logger.info(`User ${userId} registered and enrolled successfully`);
}