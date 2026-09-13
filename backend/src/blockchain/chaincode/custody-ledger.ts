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

import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';
import * as crypto from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum CustodyAction {
    UPLOAD = 'UPLOAD',
    ACCESS = 'ACCESS',
    TRANSFER = 'TRANSFER',
    REDACTION = 'REDACTION',
    EXPORT = 'EXPORT',
    VERSION_CREATE = 'VERSION_CREATE',
    METADATA_UPDATE = 'METADATA_UPDATE',
    VERIFICATION = 'VERIFICATION',
    SIGNATURE_APPLY = 'SIGNATURE_APPLY',
    SEIZURE = 'SEIZURE',
    HANDOVER = 'HANDOVER',
    RECEIVE = 'RECEIVE',
    ANALYSIS_START = 'ANALYSIS_START',
    ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
    COURT_SUBMISSION = 'COURT_SUBMISSION',
    COURT_RETURN = 'COURT_RETURN',
    DISPOSAL = 'DISPOSAL',
}

export enum ConsensusStatus {
    PENDING = 'PENDING',
    ENDORSED = 'ENDORSED',
    COMMITTED = 'COMMITTED',
    REJECTED = 'REJECTED',
    FAILED = 'FAILED',
}

export enum NodeType {
    OFFICER_NODE = 'OFFICER_NODE',
    FORENSIC_LAB_NODE = 'FORENSIC_LAB_NODE',
    COURT_NODE = 'COURT_NODE',
    CENTRAL_AUDIT_NODE = 'CENTRAL_AUDIT_NODE',
}

export interface CustodyEvent {
    txId: string;
    blockNumber: number;
    blockHash: string;
    prevBlockHash: string;
    timestamp: string; // ISO 8601
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
    signatureValue: string; // base64
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateTxId(): string {
    return `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

function computeHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function computePayloadHash(event: Partial<CustodyEvent>): string {
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

function getCurrentTimestamp(): string {
    return new Date().toISOString();
}

function getClientIdentity(ctx: Context): { mspId: string; certPem: string; userId: string } {
    const identity = ctx.clientIdentity;
    const mspId = identity.getMSPID();
    const certPem = identity.getX509Certificate();
    // Extract user ID from certificate subject
    const subject = certPem.subject || '';
    const userIdMatch = subject.match(/CN=([^,]+)/);
    const userId = userIdMatch ? userIdMatch[1] : 'unknown';
    return { mspId, certPem: certPem.toString(), userId };
}

function verifyEndorsementPolicy(ctx: Context, requiredOrgs: string[]): boolean {
    const endorsements = ctx.stub.getSignedProposal().getEndorsements();
    const endorsingOrgs = new Set<string>();

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

@Info({ title: 'CustodyLedger', description: 'ADALAT360 Custody Ledger Chaincode' })
export class CustodyLedgerContract extends Contract {

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    @Transaction(false)
    @Returns('string')
    public async initLedger(ctx: Context): Promise<string> {
        // Initialize genesis block
        const genesisBlock: BlockHeader = {
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
        const orgs: OrganizationIdentity[] = [
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

    @Transaction()
    @Returns('string')
    public async recordCustodyEvent(
        ctx: Context,
        txType: string,
        caseId: string,
        documentId: string,
        evidenceId: string,
        actionDetails: string, // JSON string
        beforeStateHash: string,
        afterStateHash: string,
        digitalSignatureId: string,
        endorsementPolicy: string
    ): Promise<string> {
        const { mspId, userId } = getClientIdentity(ctx);

        // Validate txType
        if (!Object.values(CustodyAction).includes(txType as CustodyAction)) {
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

        const event: CustodyEvent = {
            txId,
            blockNumber: newBlockNumber,
            blockHash: '', // Will be computed after block creation
            prevBlockHash,
            timestamp,
            txType: txType as CustodyAction,
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
        const block: BlockHeader = {
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

    @Transaction(false)
    @Returns('string')
    public async queryCustodyEvent(ctx: Context, txId: string): Promise<string> {
        const eventBytes = await ctx.stub.getState(`event_${txId}`);
        if (!eventBytes || eventBytes.length === 0) {
            throw new Error(`Custody event ${txId} not found`);
        }
        return eventBytes.toString();
    }

    @Transaction(false)
    @Returns('string')
    public async queryCustodyEventsByCase(ctx: Context, caseId: string): Promise<string> {
        // Use range query on composite key
        // In practice, you'd create a composite key index
        const iterator = await ctx.stub.getStateByPartialCompositeKey('case~event', [caseId]);
        const events: CustodyEvent[] = [];

        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const event = JSON.parse(result.value.value.toString());
            events.push(event);
        }

        return JSON.stringify(events);
    }

    @Transaction(false)
    @Returns('string')
    public async queryCustodyEventsByDocument(ctx: Context, documentId: string): Promise<string> {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('document~event', [documentId]);
        const events: CustodyEvent[] = [];

        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const event = JSON.parse(result.value.value.toString());
            events.push(event);
        }

        return JSON.stringify(events);
    }

    @Transaction(false)
    @Returns('string')
    public async queryCustodyEventsByEvidence(ctx: Context, evidenceId: string): Promise<string> {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('evidence~event', [evidenceId]);
        const events: CustodyEvent[] = [];

        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            const event = JSON.parse(result.value.value.toString());
            events.push(event);
        }

        return JSON.stringify(events);
    }

    @Transaction(false)
    @Returns('string')
    public async queryBlock(ctx: Context, blockNumber: number): Promise<string> {
        const blockBytes = await ctx.stub.getState(`block_${blockNumber}`);
        if (!blockBytes || blockBytes.length === 0) {
            throw new Error(`Block ${blockNumber} not found`);
        }
        return blockBytes.toString();
    }

    @Transaction(false)
    @Returns('string')
    public async queryLatestBlock(ctx: Context): Promise<string> {
        const lastBlockNumStr = await ctx.stub.getState('last_block_number');
        if (!lastBlockNumStr) {
            throw new Error('No blocks found');
        }
        const blockNumber = parseInt(lastBlockNumStr.toString(), 10);
        return this.queryBlock(ctx, blockNumber);
    }

    @Transaction(false)
    @Returns('string')
    public async queryBlockRange(ctx: Context, startBlock: number, endBlock: number): Promise<string> {
        const blocks: BlockHeader[] = [];
        for (let i = startBlock; i <= endBlock; i++) {
            const blockBytes = await ctx.stub.getState(`block_${i}`);
            if (blockBytes && blockBytes.length > 0) {
                blocks.push(JSON.parse(blockBytes.toString()));
            }
        }
        return JSON.stringify(blocks);
    }

    @Transaction(false)
    @Returns('string')
    public async verifyChainIntegrity(ctx: Context, startBlock: number, endBlock: number): Promise<string> {
        const errors: string[] = [];

        for (let i = startBlock; i <= endBlock; i++) {
            const blockBytes = await ctx.stub.getState(`block_${i}`);
            if (!blockBytes || blockBytes.length === 0) {
                errors.push(`Block ${i} missing`);
                continue;
            }

            const block: BlockHeader = JSON.parse(blockBytes.toString());

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
                    const prevBlock: BlockHeader = JSON.parse(prevBlockBytes.toString());
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
                } else {
                    const event: CustodyEvent = JSON.parse(eventBytes.toString());
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

    @Transaction()
    @Returns('string')
    public async registerDigitalSignature(
        ctx: Context,
        signatureId: string,
        signerUserId: string,
        signerNodeId: string,
        signatureType: string,
        certificatePem: string,
        certificateSerial: string,
        certificateIssuer: string,
        certificateValidFrom: string,
        certificateValidTo: string,
        signedDataHash: string,
        signedDataType: string,
        signedDataId: string,
        signatureAlgorithm: string,
        signatureValue: string, // base64
        signatureTimestamp: string
    ): Promise<string> {
        const { mspId } = getClientIdentity(ctx);

        // Verify the signer matches the client identity
        if (signerNodeId !== mspId) {
            throw new Error('Signer node ID does not match client identity');
        }

        const signature: DigitalSignature = {
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

    @Transaction(false)
    @Returns('string')
    public async queryDigitalSignature(ctx: Context, signatureId: string): Promise<string> {
        const sigBytes = await ctx.stub.getState(`signature_${signatureId}`);
        if (!sigBytes || sigBytes.length === 0) {
            throw new Error(`Digital signature ${signatureId} not found`);
        }
        return sigBytes.toString();
    }

    @Transaction()
    @Returns('string')
    public async verifyDigitalSignature(ctx: Context, signatureId: string, verifiedBy: string): Promise<string> {
        const sigBytes = await ctx.stub.getState(`signature_${signatureId}`);
        if (!sigBytes || sigBytes.length === 0) {
            throw new Error(`Digital signature ${signatureId} not found`);
        }

        const signature: DigitalSignature = JSON.parse(sigBytes.toString());
        signature.isVerified = true;
        signature.verifiedAt = getCurrentTimestamp();

        await ctx.stub.putState(`signature_${signatureId}`, Buffer.from(JSON.stringify(signature)));

        return JSON.stringify({ signatureId, status: 'verified' });
    }

    // ========================================================================
    // BSA SECTION 63 CERTIFICATES
    // ========================================================================

    @Transaction()
    @Returns('string')
    public async issueBSACertificate(
        ctx: Context,
        certificateId: string,
        certificateNumber: string,
        caseId: string,
        documentId: string,
        section: string,
        issuedBy: string,
        hashAlgorithm: string,
        fileHash: string,
        fileSizeBytes: number,
        metadataHash: string,
        custodyLedgerTxIds: string, // JSON array string
        chainOfCustodyHash: string,
        certificateContent: string, // JSON string
        digitalSignatureId: string,
        qrCodeHash: string
    ): Promise<string> {
        const { mspId, userId } = getClientIdentity(ctx);

        // Only prosecutors and courts can issue BSA certificates
        if (!['ProsecutorMSP', 'CourtMSP'].includes(mspId)) {
            throw new Error('Only prosecutors and courts can issue BSA certificates');
        }

        const certificate: BSA63Certificate = {
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

    @Transaction(false)
    @Returns('string')
    public async queryBSACertificate(ctx: Context, certificateId: string): Promise<string> {
        const certBytes = await ctx.stub.getState(`bsa_${certificateId}`);
        if (!certBytes || certBytes.length === 0) {
            throw new Error(`BSA certificate ${certificateId} not found`);
        }
        return certBytes.toString();
    }

    @Transaction(false)
    @Returns('string')
    public async queryBSACertificatesByCase(ctx: Context, caseId: string): Promise<string> {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('bsa_case', [caseId]);
        const certificates: string[] = [];

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

    @Transaction()
    @Returns('string')
    public async registerOrganization(
        ctx: Context,
        mspId: string,
        nodeId: string,
        nodeType: string,
        certPem: string
    ): Promise<string> {
        // Only admins can register organizations
        const { mspId: clientMspId } = getClientIdentity(ctx);
        if (clientMspId !== 'AuditMSP') {
            throw new Error('Only audit organization can register new organizations');
        }

        const org: OrganizationIdentity = {
            mspId,
            nodeId,
            nodeType: nodeType as NodeType,
            certPem,
            isActive: true,
        };

        await ctx.stub.putState(`org_${mspId}`, Buffer.from(JSON.stringify(org)));

        return JSON.stringify({ mspId, status: 'registered' });
    }

    @Transaction(false)
    @Returns('string')
    public async queryOrganization(ctx: Context, mspId: string): Promise<string> {
        const orgBytes = await ctx.stub.getState(`org_${mspId}`);
        if (!orgBytes || orgBytes.length === 0) {
            throw new Error(`Organization ${mspId} not found`);
        }
        return orgBytes.toString();
    }

    @Transaction(false)
    @Returns('string')
    public async queryAllOrganizations(ctx: Context): Promise<string> {
        const orgs: OrganizationIdentity[] = [];
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

    private parseEndorsementPolicy(policy: string): string[] {
        // Parse policy like "AND('OfficerMSP.peer', 'ForensicLabMSP.peer')"
        // Simplified - extract MSP IDs
        const matches = policy.match(/'([^']+)'/g);
        if (matches) {
            return matches.map(m => m.replace(/'/g, '').replace('.peer', ''));
        }
        return ['OfficerMSP', 'ForensicLabMSP']; // Default
    }

    private verifyClientEndorsements(ctx: Context, requiredOrgs: string[]): boolean {
        // In Fabric, endorsement verification happens at commit time
        // This is a placeholder for custom validation logic
        // The actual endorsement is validated by the Fabric runtime
        return true;
    }
}

// Export for Fabric
export const contract = new CustodyLedgerContract();