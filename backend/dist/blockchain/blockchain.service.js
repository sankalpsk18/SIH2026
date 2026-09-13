"use strict";
/**
 * ADALAT360 - Blockchain Service
 * High-level service for custody ledger operations
 * Handles integration between application layer and Fabric SDK
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
exports.BlockchainService = void 0;
exports.getBlockchainService = getBlockchainService;
exports.initializeBlockchain = initializeBlockchain;
exports.shutdownBlockchain = shutdownBlockchain;
const uuid_1 = require("uuid");
const crypto = __importStar(require("crypto"));
const index_js_1 = require("../config/index.js");
const logger_js_1 = require("../utils/logger.js");
const fabric_client_js_1 = require("./fabric-sdk/fabric-client.js");
const database_js_1 = require("../config/database.js");
const database_js_2 = require("../types/database.js");
const audit_service_js_1 = require("../services/audit.service.js");
// ============================================================================
// BLOCKCHAIN SERVICE CLASS
// ============================================================================
class BlockchainService {
    client = null;
    initialized = false;
    async initialize(organization) {
        if (this.initialized && this.client) {
            return;
        }
        if (!index_js_1.config.blockchain.enabled) {
            logger_js_1.logger.warn('Blockchain is disabled in config');
            this.initialized = true;
            return;
        }
        try {
            this.client = await (0, fabric_client_js_1.getFabricClient)(organization);
            this.initialized = true;
            logger_js_1.logger.info('Blockchain service initialized');
        }
        catch (error) {
            logger_js_1.logger.error('Failed to initialize blockchain service:', error);
            throw error;
        }
    }
    async shutdown() {
        await (0, fabric_client_js_1.closeFabricClient)();
        this.client = null;
        this.initialized = false;
    }
    isReady() {
        return this.initialized && this.client !== null && this.client.isConnected();
    }
    // ========================================================================
    // CUSTODY EVENT RECORDING
    // ========================================================================
    async recordCustodyEvent(input) {
        if (!index_js_1.config.blockchain.enabled) {
            // Simulate for development
            return this.simulateCustodyEvent(input);
        }
        if (!this.isReady()) {
            await this.initialize();
        }
        try {
            // Record on Fabric
            const result = await this.client.recordCustodyEvent({
                txType: input.txType,
                caseId: input.caseId,
                documentId: input.documentId,
                evidenceId: input.evidenceId,
                actionDetails: input.actionDetails,
                beforeStateHash: input.beforeStateHash,
                afterStateHash: input.afterStateHash,
                digitalSignatureId: input.digitalSignatureId,
                endorsementPolicy: input.endorsementPolicy,
            });
            // Mirror to PostgreSQL for query performance
            const record = await this.mirrorToPostgres(input, result);
            // Audit log
            await (0, audit_service_js_1.logBlockchainEvent)(result.txId, input.txType, input.actorUserId, input.caseId ? 'CASE' : input.documentId ? 'DOCUMENT' : 'EVIDENCE', input.caseId || input.documentId || input.evidenceId || '', 'SUCCESS', {
                block_number: result.blockNumber,
                block_hash: result.blockHash,
                endorsing_nodes: result.event?.endorsingNodes || [],
            });
            return record;
        }
        catch (error) {
            logger_js_1.logger.error('Failed to record custody event:', error);
            // Audit failure
            await (0, audit_service_js_1.logBlockchainEvent)('failed', input.txType, input.actorUserId, input.caseId ? 'CASE' : input.documentId ? 'DOCUMENT' : 'EVIDENCE', input.caseId || input.documentId || input.evidenceId || '', 'FAILURE', { error: error.message });
            throw error;
        }
    }
    // ========================================================================
    // QUERY OPERATIONS
    // ========================================================================
    async getCustodyEvent(txId) {
        // First try PostgreSQL (fast)
        const pgResult = await (0, database_js_1.pgQuery)(`SELECT * FROM custody_ledger WHERE tx_id = $1`, [txId]);
        if (pgResult.rows.length > 0) {
            return this.mapRowToRecord(pgResult.rows[0]);
        }
        // Fallback to Fabric
        if (index_js_1.config.blockchain.enabled && this.isReady()) {
            try {
                const fabricResult = await this.client.queryCustodyEvent(txId);
                return this.mapFabricEventToRecord(fabricResult);
            }
            catch {
                return null;
            }
        }
        return null;
    }
    async getCustodyEventsByCase(caseId) {
        const pgResult = await (0, database_js_1.pgQuery)(`SELECT * FROM custody_ledger WHERE case_id = $1 ORDER BY tx_timestamp DESC`, [caseId]);
        return pgResult.rows.map(row => this.mapRowToRecord(row));
    }
    async getCustodyEventsByDocument(documentId) {
        const pgResult = await (0, database_js_1.pgQuery)(`SELECT * FROM custody_ledger WHERE document_id = $1 ORDER BY tx_timestamp DESC`, [documentId]);
        return pgResult.rows.map(row => this.mapRowToRecord(row));
    }
    async getCustodyEventsByEvidence(evidenceId) {
        const pgResult = await (0, database_js_1.pgQuery)(`SELECT * FROM custody_ledger WHERE evidence_id = $1 ORDER BY tx_timestamp DESC`, [evidenceId]);
        return pgResult.rows.map(row => this.mapRowToRecord(row));
    }
    async getCustodyEventsByActor(userId, limit = 100) {
        const pgResult = await (0, database_js_1.pgQuery)(`SELECT * FROM custody_ledger WHERE actor_user_id = $1 ORDER BY tx_timestamp DESC LIMIT $2`, [userId, limit]);
        return pgResult.rows.map(row => this.mapRowToRecord(row));
    }
    // ========================================================================
    // BLOCK OPERATIONS
    // ========================================================================
    async getBlock(blockNumber) {
        // Try PostgreSQL first
        const pgResult = await (0, database_js_1.pgQuery)(`SELECT * FROM blockchain_blocks WHERE block_number = $1`, [blockNumber]);
        if (pgResult.rows.length > 0) {
            return pgResult.rows[0];
        }
        // Fallback to Fabric
        if (index_js_1.config.blockchain.enabled && this.isReady()) {
            return this.client.queryBlock(blockNumber);
        }
        return null;
    }
    async getLatestBlock() {
        if (index_js_1.config.blockchain.enabled && this.isReady()) {
            return this.client.queryLatestBlock();
        }
        const pgResult = await (0, database_js_1.pgQuery)(`SELECT * FROM blockchain_blocks ORDER BY block_number DESC LIMIT 1`);
        return pgResult.rows[0] || null;
    }
    async verifyChainIntegrity(startBlock, endBlock) {
        if (index_js_1.config.blockchain.enabled && this.isReady()) {
            return this.client.verifyChainIntegrity(startBlock, endBlock);
        }
        // Verify using PostgreSQL mirror
        return this.verifyChainIntegrityPostgres(startBlock, endBlock);
    }
    // ========================================================================
    // DIGITAL SIGNATURES
    // ========================================================================
    async registerDigitalSignature(signatureId, signerUserId, signerNodeId, signatureType, certificatePem, certificateSerial, certificateIssuer, certificateValidFrom, certificateValidTo, signedDataHash, signedDataType, signedDataId, signatureAlgorithm, signatureValue, signatureTimestamp) {
        if (!index_js_1.config.blockchain.enabled) {
            return { signatureId, status: 'registered (simulated)' };
        }
        if (!this.isReady()) {
            await this.initialize();
        }
        return this.client.registerDigitalSignature({
            signatureId,
            signerUserId,
            signerNodeId,
            signatureType,
            certificatePem,
            certificateSerial,
            certificateIssuer,
            certificateValidFrom,
            certificateValidTo,
            signedDataHash,
            signedDataType,
            signedDataId,
            signatureAlgorithm,
            signatureValue,
            signatureTimestamp,
        });
    }
    // ========================================================================
    // BSA CERTIFICATES
    // ========================================================================
    async issueBSACertificate(data) {
        if (!index_js_1.config.blockchain.enabled) {
            return { certificateId: data.certificateId, status: 'ISSUED (simulated)' };
        }
        if (!this.isReady()) {
            await this.initialize();
        }
        return this.client.issueBSACertificate(data);
    }
    // ========================================================================
    // CHAIN INTEGRITY VERIFICATION (PostgreSQL mirror)
    // ========================================================================
    async verifyFullChainIntegrity() {
        const lastBlock = await (0, database_js_1.pgQuery)(`SELECT block_number, block_hash FROM blockchain_blocks ORDER BY block_number DESC LIMIT 1`);
        if (lastBlock.rows.length === 0) {
            return {
                valid: true,
                last_block_number: 0,
                last_block_hash: '',
                verified_blocks: 0,
                errors: ['No blocks found'],
            };
        }
        const lastBlockNumber = lastBlock.rows[0].block_number;
        const lastBlockHash = lastBlock.rows[0].block_hash;
        // Verify in chunks
        const chunkSize = 100;
        const errors = [];
        let verifiedBlocks = 0;
        for (let start = 1; start <= lastBlockNumber; start += chunkSize) {
            const end = Math.min(start + chunkSize - 1, lastBlockNumber);
            const result = await this.verifyChainIntegrityPostgres(start, end);
            if (!result.valid) {
                errors.push(...result.errors);
            }
            else {
                verifiedBlocks += (end - start + 1);
            }
        }
        return {
            valid: errors.length === 0,
            last_block_number: lastBlockNumber,
            last_block_hash: lastBlockHash,
            verified_blocks: verifiedBlocks,
            errors,
        };
    }
    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================
    async mirrorToPostgres(input, result) {
        const recordId = (0, uuid_1.v4)();
        const payloadHash = this.computePayloadHash(input);
        await (0, database_js_1.pgQuery)(`INSERT INTO custody_ledger (
                id, tx_id, block_number, block_hash, prev_block_hash, tx_timestamp,
                tx_type, case_id, document_id, evidence_id, actor_user_id, actor_node_id,
                action_details, before_state_hash, after_state_hash, consensus_status,
                endorsing_nodes, required_endorsements, received_endorsements,
                endorsement_policy, digital_signature_id, payload_hash, is_valid
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
            ON CONFLICT (tx_id) DO UPDATE SET
                block_number = EXCLUDED.block_number,
                block_hash = EXCLUDED.block_hash,
                consensus_status = EXCLUDED.consensus_status,
                received_endorsements = EXCLUDED.received_endorsements
            `, [
            recordId,
            result.txId,
            result.blockNumber,
            result.blockHash,
            result.event?.prevBlockHash || '',
            new Date(),
            input.txType,
            input.caseId || null,
            input.documentId || null,
            input.evidenceId || null,
            input.actorUserId,
            input.actorNodeId,
            JSON.stringify(input.actionDetails),
            input.beforeStateHash || null,
            input.afterStateHash || null,
            database_js_2.ConsensusStatus.COMMITTED,
            result.event?.endorsingNodes || [],
            result.event?.requiredEndorsements || 2,
            result.event?.receivedEndorsements || 2,
            input.endorsementPolicy || this.getDefaultEndorsementPolicy(),
            input.digitalSignatureId || null,
            payloadHash,
            true,
        ]);
        // Also store block if new
        await (0, database_js_1.pgQuery)(`INSERT INTO blockchain_blocks (
                block_number, block_hash, prev_block_hash, tx_count, tx_ids,
                merkle_root, proposer_node_id, committed_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (block_number) DO NOTHING`, [
            result.blockNumber,
            result.blockHash,
            result.event?.prevBlockHash || '',
            1,
            [result.txId],
            crypto.createHash('sha256').update(result.txId).digest('hex'),
            input.actorNodeId,
            new Date(),
        ]);
        return {
            id: recordId,
            tx_id: result.txId,
            block_number: result.blockNumber,
            block_hash: result.blockHash,
            prev_block_hash: result.event?.prevBlockHash || '',
            tx_timestamp: new Date(),
            tx_type: input.txType,
            case_id: input.caseId,
            document_id: input.documentId,
            evidence_id: input.evidenceId,
            actor_user_id: input.actorUserId,
            actor_node_id: input.actorNodeId,
            action_details: input.actionDetails,
            before_state_hash: input.beforeStateHash,
            after_state_hash: input.afterStateHash,
            consensus_status: database_js_2.ConsensusStatus.COMMITTED,
            endorsing_nodes: result.event?.endorsingNodes || [],
            required_endorsements: result.event?.requiredEndorsements || 2,
            received_endorsements: result.event?.receivedEndorsements || 2,
            endorsement_policy: input.endorsementPolicy || this.getDefaultEndorsementPolicy(),
            digital_signature_id: input.digitalSignatureId,
            payload_hash: payloadHash,
            is_valid: true,
            created_at: new Date(),
        };
    }
    async verifyChainIntegrityPostgres(startBlock, endBlock) {
        const errors = [];
        for (let i = startBlock; i <= endBlock; i++) {
            const blockResult = await (0, database_js_1.pgQuery)(`SELECT * FROM blockchain_blocks WHERE block_number = $1`, [i]);
            if (blockResult.rows.length === 0) {
                errors.push(`Block ${i} missing`);
                continue;
            }
            const block = blockResult.rows[0];
            // Verify hash
            const computedHash = crypto.createHash('sha256')
                .update(JSON.stringify({
                blockNumber: block.block_number,
                prevBlockHash: block.prev_block_hash,
                txCount: block.tx_count,
                txIds: block.tx_ids,
                merkleRoot: block.merkle_root,
                proposerNodeId: block.proposer_node_id,
                committedAt: block.committed_at,
            }))
                .digest('hex');
            if (computedHash !== block.block_hash) {
                errors.push(`Block ${i} hash mismatch`);
            }
            // Verify linkage
            if (i > startBlock) {
                const prevResult = await (0, database_js_1.pgQuery)(`SELECT block_hash FROM blockchain_blocks WHERE block_number = $1`, [i - 1]);
                if (prevResult.rows.length > 0 && block.prev_block_hash !== prevResult.rows[0].block_hash) {
                    errors.push(`Block ${i} prev hash doesn't match block ${i - 1}`);
                }
            }
        }
        return {
            valid: errors.length === 0,
            checked_blocks: endBlock - startBlock + 1,
            errors,
        };
    }
    computePayloadHash(input) {
        const payload = JSON.stringify({
            txType: input.txType,
            caseId: input.caseId,
            documentId: input.documentId,
            evidenceId: input.evidenceId,
            actorUserId: input.actorUserId,
            actorNodeId: input.actorNodeId,
            actionDetails: input.actionDetails,
            beforeStateHash: input.beforeStateHash,
            afterStateHash: input.afterStateHash,
            timestamp: new Date().toISOString(),
        });
        return crypto.createHash('sha256').update(payload).digest('hex');
    }
    mapRowToRecord(row) {
        return {
            id: row.id,
            tx_id: row.tx_id,
            block_number: row.block_number,
            block_hash: row.block_hash,
            prev_block_hash: row.prev_block_hash,
            tx_timestamp: row.tx_timestamp,
            tx_type: row.tx_type,
            case_id: row.case_id,
            document_id: row.document_id,
            evidence_id: row.evidence_id,
            actor_user_id: row.actor_user_id,
            actor_node_id: row.actor_node_id,
            action_details: row.action_details,
            before_state_hash: row.before_state_hash,
            after_state_hash: row.after_state_hash,
            consensus_status: row.consensus_status,
            endorsing_nodes: row.endorsing_nodes,
            required_endorsements: row.required_endorsements,
            received_endorsements: row.received_endorsements,
            endorsement_policy: row.endorsement_policy,
            digital_signature_id: row.digital_signature_id,
            payload_hash: row.payload_hash,
            is_valid: row.is_valid,
            validation_error: row.validation_error,
            created_at: row.created_at,
        };
    }
    mapFabricEventToRecord(event) {
        return {
            id: (0, uuid_1.v4)(),
            tx_id: event.txId,
            block_number: event.blockNumber,
            block_hash: event.blockHash,
            prev_block_hash: event.prevBlockHash,
            tx_timestamp: new Date(event.timestamp),
            tx_type: event.txType,
            case_id: event.caseId,
            document_id: event.documentId,
            evidence_id: event.evidenceId,
            actor_user_id: event.actorUserId,
            actor_node_id: event.actorNodeId,
            action_details: event.actionDetails,
            before_state_hash: event.beforeStateHash,
            after_state_hash: event.afterStateHash,
            consensus_status: event.consensusStatus,
            endorsing_nodes: event.endorsingNodes,
            required_endorsements: event.requiredEndorsements,
            received_endorsements: event.receivedEndorsements,
            endorsement_policy: event.endorsementPolicy,
            digital_signature_id: event.digitalSignatureId,
            payload_hash: event.payloadHash,
            is_valid: event.isValid,
            validation_error: event.validationError,
            created_at: new Date(),
        };
    }
    simulateCustodyEvent(input) {
        // Development simulation
        const txId = `sim_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
        const blockNumber = Math.floor(Math.random() * 1000000);
        const blockHash = crypto.createHash('sha256').update(txId).digest('hex');
        return {
            id: (0, uuid_1.v4)(),
            tx_id: txId,
            block_number: blockNumber,
            block_hash: blockHash,
            prev_block_hash: crypto.createHash('sha256').update('prev').digest('hex'),
            tx_timestamp: new Date(),
            tx_type: input.txType,
            case_id: input.caseId,
            document_id: input.documentId,
            evidence_id: input.evidenceId,
            actor_user_id: input.actorUserId,
            actor_node_id: input.actorNodeId,
            action_details: input.actionDetails,
            before_state_hash: input.beforeStateHash,
            after_state_hash: input.afterStateHash,
            consensus_status: database_js_2.ConsensusStatus.COMMITTED,
            endorsing_nodes: ['OfficerMSP', 'ForensicLabMSP'],
            required_endorsements: 2,
            received_endorsements: 2,
            endorsement_policy: input.endorsementPolicy || "AND('OfficerMSP.peer', 'ForensicLabMSP.peer')",
            digital_signature_id: input.digitalSignatureId,
            payload_hash: this.computePayloadHash(input),
            is_valid: true,
            created_at: new Date(),
        };
    }
    getDefaultEndorsementPolicy() {
        return "AND('OfficerMSP.peer', 'ForensicLabMSP.peer')";
    }
}
exports.BlockchainService = BlockchainService;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let blockchainServiceInstance = null;
function getBlockchainService() {
    if (!blockchainServiceInstance) {
        blockchainServiceInstance = new BlockchainService();
    }
    return blockchainServiceInstance;
}
async function initializeBlockchain(organization) {
    const service = getBlockchainService();
    await service.initialize(organization);
    return service;
}
async function shutdownBlockchain() {
    if (blockchainServiceInstance) {
        await blockchainServiceInstance.shutdown();
        blockchainServiceInstance = null;
    }
}
//# sourceMappingURL=blockchain.service.js.map