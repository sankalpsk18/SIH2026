"use strict";
/**
 * ADALAT360 - Hyperledger Fabric SDK Wrapper
 * Node.js client for interacting with the custody ledger chaincode
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
exports.FabricClient = void 0;
exports.getFabricClient = getFabricClient;
exports.closeFabricClient = closeFabricClient;
exports.enrollAdmin = enrollAdmin;
exports.registerAndEnrollUser = registerAndEnrollUser;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fabric_network_1 = require("fabric-network");
const index_js_1 = require("../../config/index.js");
const logger_js_1 = require("../../utils/logger.js");
// ============================================================================
// FABRIC CLIENT CLASS
// ============================================================================
class FabricClient {
    gateway = null;
    contract = null;
    network = null;
    config;
    connected = false;
    constructor(config) {
        this.config = config;
    }
    // ========================================================================
    // CONNECTION MANAGEMENT
    // ========================================================================
    async connect() {
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
            const wallet = await fabric_network_1.Wallets.newFileSystemWallet(walletPath);
            // Check if identity exists
            const identity = await wallet.get(this.config.userId);
            if (!identity) {
                throw new Error(`Identity ${this.config.userId} not found in wallet. Please enroll first.`);
            }
            // Connect to gateway
            const gatewayOptions = {
                wallet,
                identity: this.config.userId,
                discovery: { enabled: true, asLocalhost: index_js_1.config.env === 'development' },
                eventHandlerOptions: {
                    commitTimeout: 100,
                    strategy: undefined,
                },
            };
            this.gateway = new fabric_network_1.Gateway();
            await this.gateway.connect(ccp, gatewayOptions);
            // Get network and contract
            this.network = await this.gateway.getNetwork(this.config.channelName);
            this.contract = this.network.getContract(this.config.chaincodeName);
            this.connected = true;
            logger_js_1.logger.info(`Connected to Fabric network: ${this.config.channelName}, chaincode: ${this.config.chaincodeName}`);
        }
        catch (error) {
            logger_js_1.logger.error('Failed to connect to Fabric:', error);
            this.connected = false;
            throw error;
        }
    }
    async disconnect() {
        if (this.gateway) {
            this.gateway.disconnect();
            this.gateway = null;
            this.contract = null;
            this.network = null;
            this.connected = false;
            logger_js_1.logger.info('Disconnected from Fabric network');
        }
    }
    isConnected() {
        return this.connected && this.gateway !== null;
    }
    // ========================================================================
    // CUSTODY EVENT OPERATIONS
    // ========================================================================
    async recordCustodyEvent(data) {
        this.ensureConnected();
        try {
            const endorsementPolicy = data.endorsementPolicy || this.getDefaultEndorsementPolicy();
            const result = await this.contract.submitTransaction('recordCustodyEvent', data.txType, data.caseId || '', data.documentId || '', data.evidenceId || '', JSON.stringify(data.actionDetails), data.beforeStateHash || '', data.afterStateHash || '', data.digitalSignatureId || '', endorsementPolicy);
            const parsed = JSON.parse(result.toString());
            logger_js_1.logger.info(`Custody event recorded: ${parsed.txId} in block ${parsed.blockNumber}`);
            return parsed;
        }
        catch (error) {
            logger_js_1.logger.error('Failed to record custody event:', error);
            throw new Error(`Failed to record custody event: ${error.message}`);
        }
    }
    async queryCustodyEvent(txId) {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryCustodyEvent', txId);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to query custody event ${txId}:`, error);
            throw new Error(`Failed to query custody event: ${error.message}`);
        }
    }
    async queryCustodyEventsByCase(caseId) {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryCustodyEventsByCase', caseId);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to query custody events for case ${caseId}:`, error);
            throw new Error(`Failed to query custody events: ${error.message}`);
        }
    }
    async queryCustodyEventsByDocument(documentId) {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryCustodyEventsByDocument', documentId);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to query custody events for document ${documentId}:`, error);
            throw new Error(`Failed to query custody events: ${error.message}`);
        }
    }
    async queryCustodyEventsByEvidence(evidenceId) {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryCustodyEventsByEvidence', evidenceId);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to query custody events for evidence ${evidenceId}:`, error);
            throw new Error(`Failed to query custody events: ${error.message}`);
        }
    }
    // ========================================================================
    // BLOCK QUERY OPERATIONS
    // ========================================================================
    async queryBlock(blockNumber) {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryBlock', blockNumber.toString());
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to query block ${blockNumber}:`, error);
            throw new Error(`Failed to query block: ${error.message}`);
        }
    }
    async queryLatestBlock() {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryLatestBlock');
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error('Failed to query latest block:', error);
            throw new Error(`Failed to query latest block: ${error.message}`);
        }
    }
    async queryBlockRange(startBlock, endBlock) {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryBlockRange', startBlock.toString(), endBlock.toString());
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to query block range ${startBlock}-${endBlock}:`, error);
            throw new Error(`Failed to query block range: ${error.message}`);
        }
    }
    async verifyChainIntegrity(startBlock, endBlock) {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('verifyChainIntegrity', startBlock.toString(), endBlock.toString());
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to verify chain integrity ${startBlock}-${endBlock}:`, error);
            throw new Error(`Failed to verify chain integrity: ${error.message}`);
        }
    }
    // ========================================================================
    // DIGITAL SIGNATURE OPERATIONS
    // ========================================================================
    async registerDigitalSignature(data) {
        this.ensureConnected();
        try {
            const result = await this.contract.submitTransaction('registerDigitalSignature', data.signatureId, data.signerUserId, data.signerNodeId, data.signatureType, data.certificatePem, data.certificateSerial, data.certificateIssuer, data.certificateValidFrom, data.certificateValidTo, data.signedDataHash, data.signedDataType, data.signedDataId, data.signatureAlgorithm, data.signatureValue, data.signatureTimestamp);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error('Failed to register digital signature:', error);
            throw new Error(`Failed to register digital signature: ${error.message}`);
        }
    }
    async queryDigitalSignature(signatureId) {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryDigitalSignature', signatureId);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to query digital signature ${signatureId}:`, error);
            throw new Error(`Failed to query digital signature: ${error.message}`);
        }
    }
    async verifyDigitalSignature(signatureId, verifiedBy) {
        this.ensureConnected();
        try {
            const result = await this.contract.submitTransaction('verifyDigitalSignature', signatureId, verifiedBy);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to verify digital signature ${signatureId}:`, error);
            throw new Error(`Failed to verify digital signature: ${error.message}`);
        }
    }
    // ========================================================================
    // BSA CERTIFICATE OPERATIONS
    // ========================================================================
    async issueBSACertificate(data) {
        this.ensureConnected();
        try {
            const result = await this.contract.submitTransaction('issueBSACertificate', data.certificateId, data.certificateNumber, data.caseId, data.documentId, data.section, data.issuedBy, data.hashAlgorithm, data.fileHash, data.fileSizeBytes.toString(), data.metadataHash, JSON.stringify(data.custodyLedgerTxIds), data.chainOfCustodyHash, JSON.stringify(data.certificateContent), data.digitalSignatureId, data.qrCodeHash);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error('Failed to issue BSA certificate:', error);
            throw new Error(`Failed to issue BSA certificate: ${error.message}`);
        }
    }
    async queryBSACertificate(certificateId) {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryBSACertificate', certificateId);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to query BSA certificate ${certificateId}:`, error);
            throw new Error(`Failed to query BSA certificate: ${error.message}`);
        }
    }
    async queryBSACertificatesByCase(caseId) {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryBSACertificatesByCase', caseId);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to query BSA certificates for case ${caseId}:`, error);
            throw new Error(`Failed to query BSA certificates: ${error.message}`);
        }
    }
    // ========================================================================
    // ORGANIZATION OPERATIONS
    // ========================================================================
    async registerOrganization(mspId, nodeId, nodeType, certPem) {
        this.ensureConnected();
        try {
            const result = await this.contract.submitTransaction('registerOrganization', mspId, nodeId, nodeType, certPem);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to register organization ${mspId}:`, error);
            throw new Error(`Failed to register organization: ${error.message}`);
        }
    }
    async queryOrganization(mspId) {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryOrganization', mspId);
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to query organization ${mspId}:`, error);
            throw new Error(`Failed to query organization: ${error.message}`);
        }
    }
    async queryAllOrganizations() {
        this.ensureConnected();
        try {
            const result = await this.contract.evaluateTransaction('queryAllOrganizations');
            return JSON.parse(result.toString());
        }
        catch (error) {
            logger_js_1.logger.error('Failed to query all organizations:', error);
            throw new Error(`Failed to query organizations: ${error.message}`);
        }
    }
    // ========================================================================
    // LEDGER INITIALIZATION
    // ========================================================================
    async initLedger() {
        this.ensureConnected();
        try {
            const result = await this.contract.submitTransaction('initLedger');
            return result.toString();
        }
        catch (error) {
            logger_js_1.logger.error('Failed to initialize ledger:', error);
            throw new Error(`Failed to initialize ledger: ${error.message}`);
        }
    }
    // ========================================================================
    // EVENT LISTENING
    // ========================================================================
    async listenForEvents(eventName, callback) {
        this.ensureConnected();
        const listener = async (event) => {
            try {
                const payload = JSON.parse(event.payload.toString());
                callback({ ...event, payload });
            }
            catch (error) {
                logger_js_1.logger.error(`Error processing event ${eventName}:`, error);
            }
        };
        await this.contract.addContractListener(eventName, listener);
        // Return unsubscribe function
        return async () => {
            await this.contract.removeContractListener(eventName, listener);
        };
    }
    // ========================================================================
    // HELPER METHODS
    // ========================================================================
    ensureConnected() {
        if (!this.connected || !this.contract) {
            throw new Error('Not connected to Fabric network. Call connect() first.');
        }
    }
    getDefaultEndorsementPolicy() {
        // Default policy: AND('OfficerMSP.peer', 'ForensicLabMSP.peer')
        // This ensures at least one officer node AND one forensic lab node endorses
        return "AND('OfficerMSP.peer', 'ForensicLabMSP.peer')";
    }
    getContract() {
        return this.contract;
    }
    getGateway() {
        return this.gateway;
    }
}
exports.FabricClient = FabricClient;
// ============================================================================
// FACTORY FUNCTION
// ============================================================================
let fabricClientInstance = null;
async function getFabricClient(organization) {
    if (fabricClientInstance && fabricClientInstance.isConnected()) {
        return fabricClientInstance;
    }
    const org = organization || index_js_1.config.blockchain.organizations[0].mspId;
    const orgConfig = index_js_1.config.blockchain.organizations.find(o => o.mspId === org);
    if (!orgConfig) {
        throw new Error(`Organization ${org} not found in config`);
    }
    const clientConfig = {
        connectionProfilePath: path.resolve('./fabric-config/connection-profile.json'),
        walletPath: index_js_1.config.blockchain.walletPath,
        organization: org,
        channelName: index_js_1.config.blockchain.network.channel,
        chaincodeName: index_js_1.config.blockchain.network.chaincode,
        userId: `admin_${org.toLowerCase()}`,
    };
    fabricClientInstance = new FabricClient(clientConfig);
    await fabricClientInstance.connect();
    return fabricClientInstance;
}
async function closeFabricClient() {
    if (fabricClientInstance) {
        await fabricClientInstance.disconnect();
        fabricClientInstance = null;
    }
}
// ============================================================================
// IDENTITY MANAGEMENT
// ============================================================================
async function enrollAdmin(orgName, caUrl, adminId, adminSecret, walletPath, mspId) {
    const { Gateway, Wallets } = await import('fabric-network');
    const FabricCAServices = (await import('fabric-ca-client')).default;
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    // Check if already enrolled
    const existing = await wallet.get(adminId);
    if (existing) {
        logger_js_1.logger.info(`Admin ${adminId} already enrolled`);
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
    logger_js_1.logger.info(`Admin ${adminId} enrolled successfully`);
}
async function registerAndEnrollUser(orgName, caUrl, adminId, userId, walletPath, mspId, attrs) {
    const { Gateway, Wallets } = await import('fabric-network');
    const FabricCAServices = (await import('fabric-ca-client')).default;
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    // Check if already enrolled
    const existing = await wallet.get(userId);
    if (existing) {
        logger_js_1.logger.info(`User ${userId} already enrolled`);
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
    logger_js_1.logger.info(`User ${userId} registered and enrolled successfully`);
}
//# sourceMappingURL=fabric-client.js.map