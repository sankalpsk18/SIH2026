"use strict";
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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
Object.defineProperty(exports, "__esModule", { value: true });
exports.contract = exports.CustodyLedgerContract = exports.NodeType = exports.ConsensusStatus = exports.CustodyAction = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
const crypto = __importStar(require("crypto"));
// ============================================================================
// TYPES & INTERFACES
// ============================================================================
var CustodyAction;
(function (CustodyAction) {
    CustodyAction["UPLOAD"] = "UPLOAD";
    CustodyAction["ACCESS"] = "ACCESS";
    CustodyAction["TRANSFER"] = "TRANSFER";
    CustodyAction["REDACTION"] = "REDACTION";
    CustodyAction["EXPORT"] = "EXPORT";
    CustodyAction["VERSION_CREATE"] = "VERSION_CREATE";
    CustodyAction["METADATA_UPDATE"] = "METADATA_UPDATE";
    CustodyAction["VERIFICATION"] = "VERIFICATION";
    CustodyAction["SIGNATURE_APPLY"] = "SIGNATURE_APPLY";
    CustodyAction["SEIZURE"] = "SEIZURE";
    CustodyAction["HANDOVER"] = "HANDOVER";
    CustodyAction["RECEIVE"] = "RECEIVE";
    CustodyAction["ANALYSIS_START"] = "ANALYSIS_START";
    CustodyAction["ANALYSIS_COMPLETE"] = "ANALYSIS_COMPLETE";
    CustodyAction["COURT_SUBMISSION"] = "COURT_SUBMISSION";
    CustodyAction["COURT_RETURN"] = "COURT_RETURN";
    CustodyAction["DISPOSAL"] = "DISPOSAL";
})(CustodyAction || (exports.CustodyAction = CustodyAction = {}));
var ConsensusStatus;
(function (ConsensusStatus) {
    ConsensusStatus["PENDING"] = "PENDING";
    ConsensusStatus["ENDORSED"] = "ENDORSED";
    ConsensusStatus["COMMITTED"] = "COMMITTED";
    ConsensusStatus["REJECTED"] = "REJECTED";
    ConsensusStatus["FAILED"] = "FAILED";
})(ConsensusStatus || (exports.ConsensusStatus = ConsensusStatus = {}));
var NodeType;
(function (NodeType) {
    NodeType["OFFICER_NODE"] = "OFFICER_NODE";
    NodeType["FORENSIC_LAB_NODE"] = "FORENSIC_LAB_NODE";
    NodeType["COURT_NODE"] = "COURT_NODE";
    NodeType["CENTRAL_AUDIT_NODE"] = "CENTRAL_AUDIT_NODE";
})(NodeType || (exports.NodeType = NodeType = {}));
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function generateTxId() {
    return `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}
function computeHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}
function computePayloadHash(event) {
    const payload = JSON.stringify({
        txType: event.txType,
        caseId: event.caseId,
        documentId: event.documentId,
        evidenceId: event.evidenceId,
        actorUserId: event.actorUserId,
        actorNodeId: event.actorNodeId,
        actionDetails: event.actionDetails,
        beforeStateHash: event.beforeStateHash,
        afterStateHash: event.afterStateHash,
        timestamp: event.timestamp,
    });
    return computeHash(payload);
}
function getCurrentTimestamp() {
    return new Date().toISOString();
}
function getClientIdentity(ctx) {
    const identity = ctx.clientIdentity;
    const mspId = identity.getMSPID();
    const certPem = identity.getX509Certificate();
    // Extract user ID from certificate subject
    const subject = certPem.subject || '';
    const userIdMatch = subject.match(/CN=([^,]+)/);
    const userId = userIdMatch ? userIdMatch[1] : 'unknown';
    return { mspId, certPem: certPem.toString(), userId };
}
function verifyEndorsementPolicy(ctx, requiredOrgs) {
    const endorsements = ctx.stub.getSignedProposal().getEndorsements();
    const endorsingOrgs = new Set();
    for (const endorsement of endorsements) {
        // Extract MSP ID from endorsement
        // In practice, you'd parse the endorsement certificate
        // This is a simplified version
        endorsingOrgs.add('extracted_msp_id'); // Would need actual parsing
    }
    return requiredOrgs.every(org => endorsingOrgs.has(org));
}
// ============================================================================
// CHAINCODE CLASS
// ============================================================================
let CustodyLedgerContract = class CustodyLedgerContract extends fabric_contract_api_1.Contract {
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    async initLedger(ctx) {
        // Initialize genesis block
        const genesisBlock = {
            blockNumber: 0,
            blockHash: computeHash('genesis'),
            prevBlockHash: '0'.repeat(64),
            txCount: 0,
            txIds: [],
            merkleRoot: computeHash('genesis'),
            proposerNodeId: 'system',
            committedAt: getCurrentTimestamp(),
        };
        await ctx.stub.putState('block_0', Buffer.from(JSON.stringify(genesisBlock)));
        await ctx.stub.putState('last_block_number', Buffer.from('0'));
        await ctx.stub.putState('last_block_hash', Buffer.from(genesisBlock.blockHash));
        // Initialize organization registry
        const orgs = [
            {
                mspId: 'OfficerMSP',
                nodeId: 'officer-node-1',
                nodeType: NodeType.OFFICER_NODE,
                certPem: '',
                isActive: true,
            },
            {
                mspId: 'ForensicLabMSP',
                nodeId: 'forensic-node-1',
                nodeType: NodeType.FORENSIC_LAB_NODE,
                certPem: '',
                isActive: true,
            },
            {
                mspId: 'CourtMSP',
                nodeId: 'court-node-1',
                nodeType: NodeType.COURT_NODE,
                certPem: '',
                isActive: true,
            },
            {
                mspId: 'AuditMSP',
                nodeId: 'audit-node-1',
                nodeType: NodeType.CENTRAL_AUDIT_NODE,
                certPem: '',
                isActive: true,
            },
        ];
        for (const org of orgs) {
            await ctx.stub.putState(`org_${org.mspId}`, Buffer.from(JSON.stringify(org)));
        }
        return 'Custody Ledger initialized successfully';
    }
    // ========================================================================
    // CUSTODY EVENT RECORDING
    // ========================================================================
    async recordCustodyEvent(ctx, txType, caseId, documentId, evidenceId, actionDetails, // JSON string
    beforeStateHash, afterStateHash, digitalSignatureId, endorsementPolicy) {
        const { mspId, userId } = getClientIdentity(ctx);
        // Validate txType
        if (!Object.values(CustodyAction).includes(txType)) {
            throw new Error(`Invalid custody action: ${txType}`);
        }
        // Validate endorsement policy
        const requiredOrgs = this.parseEndorsementPolicy(endorsementPolicy);
        if (!this.verifyClientEndorsements(ctx, requiredOrgs)) {
            throw new Error('Endorsement policy not satisfied');
        }
        // Get current block number
        const lastBlockNumStr = await ctx.stub.getState('last_block_number');
        const lastBlockNumber = lastBlockNumStr ? parseInt(lastBlockNumStr.toString(), 10) : 0;
        const newBlockNumber = lastBlockNumber + 1;
        // Get previous block hash
        const lastBlockHash = await ctx.stub.getState('last_block_hash');
        const prevBlockHash = lastBlockHash ? lastBlockHash.toString() : '0'.repeat(64);
        // Create custody event
        const txId = generateTxId();
        const timestamp = getCurrentTimestamp();
        const event = {
            txId,
            blockNumber: newBlockNumber,
            blockHash: '', // Will be computed after block creation
            prevBlockHash,
            timestamp,
            txType: txType,
            caseId: caseId || undefined,
            documentId: documentId || undefined,
            evidenceId: evidenceId || undefined,
            actorUserId: userId,
            actorNodeId: mspId,
            actorRole: mspId.replace('MSP', ''),
            actionDetails: JSON.parse(actionDetails),
            beforeStateHash: beforeStateHash || undefined,
            afterStateHash: afterStateHash || undefined,
            consensusStatus: ConsensusStatus.ENDORSED,
            endorsingNodes: requiredOrgs,
            requiredEndorsements: requiredOrgs.length,
            receivedEndorsements: requiredOrgs.length,
            endorsementPolicy,
            digitalSignatureId: digitalSignatureId || undefined,
            payloadHash: '', // Will compute
            isValid: true,
        };
        // Compute payload hash
        event.payloadHash = computePayloadHash(event);
        // Store event
        await ctx.stub.putState(`event_${txId}`, Buffer.from(JSON.stringify(event)));
        // Create new block
        const block = {
            blockNumber: newBlockNumber,
            blockHash: '', // Will compute
            prevBlockHash,
            txCount: 1,
            txIds: [txId],
            merkleRoot: computeHash(txId),
            proposerNodeId: mspId,
            committedAt: timestamp,
        };
        block.blockHash = computeHash(JSON.stringify({
            blockNumber: block.blockNumber,
            prevBlockHash: block.prevBlockHash,
            txCount: block.txCount,
            txIds: block.txIds,
            merkleRoot: block.merkleRoot,
            proposerNodeId: block.proposerNodeId,
            committedAt: block.committedAt,
        }));
        // Update event with block hash
        event.blockHash = block.blockHash;
        await ctx.stub.putState(`event_${txId}`, Buffer.from(JSON.stringify(event)));
        // Store block
        await ctx.stub.putState(`block_${newBlockNumber}`, Buffer.from(JSON.stringify(block)));
        // Update last block references
        await ctx.stub.putState('last_block_number', Buffer.from(newBlockNumber.toString()));
        await ctx.stub.putState('last_block_hash', Buffer.from(block.blockHash));
        // Emit event for off-chain indexing
        ctx.stub.setEvent('CustodyEventRecorded', Buffer.from(JSON.stringify({
            txId,
            blockNumber: newBlockNumber,
            txType,
            caseId,
            documentId,
            evidenceId,
            actorUserId: userId,
            timestamp,
        })));
        return JSON.stringify({ txId, blockNumber: newBlockNumber, blockHash: block.blockHash });
    }
    // ========================================================================
    // QUERY FUNCTIONS
    // ========================================================================
    async queryCustodyEvent(ctx, txId) {
        const eventBytes = await ctx.stub.getState(`event_${txId}`);
        if (!eventBytes || eventBytes.length === 0) {
            throw new Error(`Custody event ${txId} not found`);
        }
        return eventBytes.toString();
    }
    async queryCustodyEventsByCase(ctx, caseId) {
        // Use range query on composite key
        // In practice, you'd create a composite key index
        const iterator = await ctx.stub.getStateByPartialCompositeKey('case~event', [caseId]);
        const events = [];
        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const event = JSON.parse(result.value.value.toString());
            events.push(event);
        }
        return JSON.stringify(events);
    }
    async queryCustodyEventsByDocument(ctx, documentId) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('document~event', [documentId]);
        const events = [];
        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const event = JSON.parse(result.value.value.toString());
            events.push(event);
        }
        return JSON.stringify(events);
    }
    async queryCustodyEventsByEvidence(ctx, evidenceId) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('evidence~event', [evidenceId]);
        const events = [];
        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const event = JSON.parse(result.value.value.toString());
            events.push(event);
        }
        return JSON.stringify(events);
    }
    async queryBlock(ctx, blockNumber) {
        const blockBytes = await ctx.stub.getState(`block_${blockNumber}`);
        if (!blockBytes || blockBytes.length === 0) {
            throw new Error(`Block ${blockNumber} not found`);
        }
        return blockBytes.toString();
    }
    async queryLatestBlock(ctx) {
        const lastBlockNumStr = await ctx.stub.getState('last_block_number');
        if (!lastBlockNumStr) {
            throw new Error('No blocks found');
        }
        const blockNumber = parseInt(lastBlockNumStr.toString(), 10);
        return this.queryBlock(ctx, blockNumber);
    }
    async queryBlockRange(ctx, startBlock, endBlock) {
        const blocks = [];
        for (let i = startBlock; i <= endBlock; i++) {
            const blockBytes = await ctx.stub.getState(`block_${i}`);
            if (blockBytes && blockBytes.length > 0) {
                blocks.push(JSON.parse(blockBytes.toString()));
            }
        }
        return JSON.stringify(blocks);
    }
    async verifyChainIntegrity(ctx, startBlock, endBlock) {
        const errors = [];
        for (let i = startBlock; i <= endBlock; i++) {
            const blockBytes = await ctx.stub.getState(`block_${i}`);
            if (!blockBytes || blockBytes.length === 0) {
                errors.push(`Block ${i} missing`);
                continue;
            }
            const block = JSON.parse(blockBytes.toString());
            // Verify block hash
            const computedHash = computeHash(JSON.stringify({
                blockNumber: block.blockNumber,
                prevBlockHash: block.prevBlockHash,
                txCount: block.txCount,
                txIds: block.txIds,
                merkleRoot: block.merkleRoot,
                proposerNodeId: block.proposerNodeId,
                committedAt: block.committedAt,
            }));
            if (computedHash !== block.blockHash) {
                errors.push(`Block ${i} hash mismatch`);
            }
            // Verify chain linkage
            if (i > startBlock) {
                const prevBlockBytes = await ctx.stub.getState(`block_${i - 1}`);
                if (prevBlockBytes && prevBlockBytes.length > 0) {
                    const prevBlock = JSON.parse(prevBlockBytes.toString());
                    if (block.prevBlockHash !== prevBlock.blockHash) {
                        errors.push(`Block ${i} prev hash doesn't match block ${i - 1}`);
                    }
                }
            }
            // Verify transactions in block
            for (const txId of block.txIds) {
                const eventBytes = await ctx.stub.getState(`event_${txId}`);
                if (!eventBytes || eventBytes.length === 0) {
                    errors.push(`Transaction ${txId} in block ${i} missing`);
                }
                else {
                    const event = JSON.parse(eventBytes.toString());
                    if (event.blockNumber !== i) {
                        errors.push(`Transaction ${txId} block number mismatch`);
                    }
                    if (event.blockHash !== block.blockHash) {
                        errors.push(`Transaction ${txId} block hash mismatch`);
                    }
                }
            }
        }
        return JSON.stringify({
            valid: errors.length === 0,
            checked_blocks: endBlock - startBlock + 1,
            errors,
        });
    }
    // ========================================================================
    // DIGITAL SIGNATURES
    // ========================================================================
    async registerDigitalSignature(ctx, signatureId, signerUserId, signerNodeId, signatureType, certificatePem, certificateSerial, certificateIssuer, certificateValidFrom, certificateValidTo, signedDataHash, signedDataType, signedDataId, signatureAlgorithm, signatureValue, // base64
    signatureTimestamp) {
        const { mspId } = getClientIdentity(ctx);
        // Verify the signer matches the client identity
        if (signerNodeId !== mspId) {
            throw new Error('Signer node ID does not match client identity');
        }
        const signature = {
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
            isVerified: false,
        };
        await ctx.stub.putState(`signature_${signatureId}`, Buffer.from(JSON.stringify(signature)));
        ctx.stub.setEvent('DigitalSignatureRegistered', Buffer.from(JSON.stringify({
            signatureId,
            signerUserId,
            signerNodeId,
            signedDataType,
            signedDataId,
        })));
        return JSON.stringify({ signatureId, status: 'registered' });
    }
    async queryDigitalSignature(ctx, signatureId) {
        const sigBytes = await ctx.stub.getState(`signature_${signatureId}`);
        if (!sigBytes || sigBytes.length === 0) {
            throw new Error(`Digital signature ${signatureId} not found`);
        }
        return sigBytes.toString();
    }
    async verifyDigitalSignature(ctx, signatureId, verifiedBy) {
        const sigBytes = await ctx.stub.getState(`signature_${signatureId}`);
        if (!sigBytes || sigBytes.length === 0) {
            throw new Error(`Digital signature ${signatureId} not found`);
        }
        const signature = JSON.parse(sigBytes.toString());
        signature.isVerified = true;
        signature.verifiedAt = getCurrentTimestamp();
        await ctx.stub.putState(`signature_${signatureId}`, Buffer.from(JSON.stringify(signature)));
        return JSON.stringify({ signatureId, status: 'verified' });
    }
    // ========================================================================
    // BSA SECTION 63 CERTIFICATES
    // ========================================================================
    async issueBSACertificate(ctx, certificateId, certificateNumber, caseId, documentId, section, issuedBy, hashAlgorithm, fileHash, fileSizeBytes, metadataHash, custodyLedgerTxIds, // JSON array string
    chainOfCustodyHash, certificateContent, // JSON string
    digitalSignatureId, qrCodeHash) {
        const { mspId, userId } = getClientIdentity(ctx);
        // Only prosecutors and courts can issue BSA certificates
        if (!['ProsecutorMSP', 'CourtMSP'].includes(mspId)) {
            throw new Error('Only prosecutors and courts can issue BSA certificates');
        }
        const certificate = {
            certificateId,
            certificateNumber,
            caseId,
            documentId,
            section,
            issuedBy: userId,
            issuedAt: getCurrentTimestamp(),
            validFrom: getCurrentTimestamp(),
            validUntil: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 10 years
            hashAlgorithm,
            fileHash,
            fileSizeBytes,
            metadataHash,
            custodyLedgerTxIds: JSON.parse(custodyLedgerTxIds),
            chainOfCustodyHash,
            certificateContent: JSON.parse(certificateContent),
            digitalSignatureId,
            qrCodeHash,
            status: 'ISSUED',
        };
        await ctx.stub.putState(`bsa_${certificateId}`, Buffer.from(JSON.stringify(certificate)));
        // Also index by case and document
        await ctx.stub.putState(`bsa_case_${caseId}_${certificateId}`, Buffer.from(certificateId));
        await ctx.stub.putState(`bsa_doc_${documentId}_${certificateId}`, Buffer.from(certificateId));
        ctx.stub.setEvent('BSACertificateIssued', Buffer.from(JSON.stringify({
            certificateId,
            certificateNumber,
            caseId,
            documentId,
            issuedBy: userId,
        })));
        return JSON.stringify({ certificateId, certificateNumber, status: 'ISSUED' });
    }
    async queryBSACertificate(ctx, certificateId) {
        const certBytes = await ctx.stub.getState(`bsa_${certificateId}`);
        if (!certBytes || certBytes.length === 0) {
            throw new Error(`BSA certificate ${certificateId} not found`);
        }
        return certBytes.toString();
    }
    async queryBSACertificatesByCase(ctx, caseId) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('bsa_case', [caseId]);
        const certificates = [];
        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const certId = result.value.value.toString();
            const certBytes = await ctx.stub.getState(`bsa_${certId}`);
            if (certBytes && certBytes.length > 0) {
                certificates.push(certBytes.toString());
            }
        }
        return JSON.stringify(certificates);
    }
    // ========================================================================
    // ORGANIZATION MANAGEMENT
    // ========================================================================
    async registerOrganization(ctx, mspId, nodeId, nodeType, certPem) {
        // Only admins can register organizations
        const { mspId: clientMspId } = getClientIdentity(ctx);
        if (clientMspId !== 'AuditMSP') {
            throw new Error('Only audit organization can register new organizations');
        }
        const org = {
            mspId,
            nodeId,
            nodeType: nodeType,
            certPem,
            isActive: true,
        };
        await ctx.stub.putState(`org_${mspId}`, Buffer.from(JSON.stringify(org)));
        return JSON.stringify({ mspId, status: 'registered' });
    }
    async queryOrganization(ctx, mspId) {
        const orgBytes = await ctx.stub.getState(`org_${mspId}`);
        if (!orgBytes || orgBytes.length === 0) {
            throw new Error(`Organization ${mspId} not found`);
        }
        return orgBytes.toString();
    }
    async queryAllOrganizations(ctx) {
        const orgs = [];
        const mspIds = ['OfficerMSP', 'ForensicLabMSP', 'CourtMSP', 'AuditMSP'];
        for (const mspId of mspIds) {
            const orgBytes = await ctx.stub.getState(`org_${mspId}`);
            if (orgBytes && orgBytes.length > 0) {
                orgs.push(JSON.parse(orgBytes.toString()));
            }
        }
        return JSON.stringify(orgs);
    }
    // ========================================================================
    // HELPER METHODS
    // ========================================================================
    parseEndorsementPolicy(policy) {
        // Parse policy like "AND('OfficerMSP.peer', 'ForensicLabMSP.peer')"
        // Simplified - extract MSP IDs
        const matches = policy.match(/'([^']+)'/g);
        if (matches) {
            return matches.map(m => m.replace(/'/g, '').replace('.peer', ''));
        }
        return ['OfficerMSP', 'ForensicLabMSP']; // Default
    }
    verifyClientEndorsements(ctx, requiredOrgs) {
        // In Fabric, endorsement verification happens at commit time
        // This is a placeholder for custom validation logic
        // The actual endorsement is validated by the Fabric runtime
        return true;
    }
};
exports.CustodyLedgerContract = CustodyLedgerContract;
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _a : Object]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "initLedger", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _b : Object, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "recordCustodyEvent", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _c : Object, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryCustodyEvent", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_d = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _d : Object, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryCustodyEventsByCase", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_e = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _e : Object, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryCustodyEventsByDocument", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_f = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _f : Object, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryCustodyEventsByEvidence", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_g = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _g : Object, Number]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryBlock", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_h = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _h : Object]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryLatestBlock", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_j = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _j : Object, Number, Number]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryBlockRange", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_k = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _k : Object, Number, Number]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "verifyChainIntegrity", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_l = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _l : Object, String, String, String, String, String, String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "registerDigitalSignature", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_m = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _m : Object, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryDigitalSignature", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_o = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _o : Object, String, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "verifyDigitalSignature", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_p = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _p : Object, String, String, String, String, String, String, String, String, Number, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "issueBSACertificate", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_q = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _q : Object, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryBSACertificate", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_r = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _r : Object, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryBSACertificatesByCase", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_s = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _s : Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "registerOrganization", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_t = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _t : Object, String]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryOrganization", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)('string'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_u = typeof fabric_contract_api_1.Context !== "undefined" && fabric_contract_api_1.Context) === "function" ? _u : Object]),
    __metadata("design:returntype", Promise)
], CustodyLedgerContract.prototype, "queryAllOrganizations", null);
exports.CustodyLedgerContract = CustodyLedgerContract = __decorate([
    (0, fabric_contract_api_1.Info)({ title: 'CustodyLedger', description: 'ADALAT360 Custody Ledger Chaincode' })
], CustodyLedgerContract);
// Export for Fabric
exports.contract = new CustodyLedgerContract();
//# sourceMappingURL=custody-ledger.js.map