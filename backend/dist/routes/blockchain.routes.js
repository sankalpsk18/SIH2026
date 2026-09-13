"use strict";
/**
 * ADALAT360 - Blockchain Routes
 * REST API for custody ledger queries and chain verification
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const blockchain_service_js_1 = require("../blockchain/blockchain.service.js");
const auth_middleware_js_1 = require("../middleware/auth/auth.middleware.js");
const validate_middleware_js_1 = require("../middleware/validate.middleware.js");
const audit_service_js_1 = require("../services/audit.service.js");
const database_js_1 = require("../types/database.js");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_js_1.authenticate);
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
const custodyEventQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        caseId: zod_1.z.string().uuid().optional(),
        documentId: zod_1.z.string().uuid().optional(),
        evidenceId: zod_1.z.string().uuid().optional(),
        actorUserId: zod_1.z.string().uuid().optional(),
        txType: zod_1.z.nativeEnum(database_js_1.CustodyAction).optional(),
        consensusStatus: zod_1.z.nativeEnum(database_js_1.ConsensusStatus).optional(),
        startDate: zod_1.z.coerce.date().optional(),
        endDate: zod_1.z.coerce.date().optional(),
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    }),
});
const blockQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        startBlock: zod_1.z.coerce.number().int().positive().optional(),
        endBlock: zod_1.z.coerce.number().int().positive().optional(),
        limit: zod_1.z.coerce.number().int().positive().max(1000).default(100),
    }),
});
const txIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        txId: zod_1.z.string().min(1),
    }),
});
const blockNumberParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        blockNumber: zod_1.z.coerce.number().int().positive(),
    }),
});
const verifyChainSchema = zod_1.z.object({
    body: zod_1.z.object({
        startBlock: zod_1.z.coerce.number().int().positive().default(1),
        endBlock: zod_1.z.coerce.number().int().positive().optional(),
    }),
});
// ============================================================================
// GET CUSTODY EVENTS
// ============================================================================
router.get('/events', (0, auth_middleware_js_1.userRateLimit)(50, 60000, 'blockchain_events'), (0, validate_middleware_js_1.validate)(custodyEventQuerySchema), async (req, res, next) => {
    try {
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        const { caseId, documentId, evidenceId, actorUserId, txType, consensusStatus, startDate, endDate, page, limit } = req.query;
        const offset = (page - 1) * limit;
        // Admins and auditors can query all, others only their cases
        let queryCaseId = caseId;
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (caseId && !req.auth.case_ids.includes(caseId)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this case' });
                return;
            }
            // If no caseId provided, we'd need to query across all accessible cases
            // For simplicity, require caseId for non-admins
            if (!caseId) {
                res.status(400).json({ error: 'BAD_REQUEST', message: 'caseId is required for non-admin users' });
                return;
            }
        }
        let events;
        if (caseId) {
            events = await blockchainService.getCustodyEventsByCase(caseId);
        }
        else if (documentId) {
            events = await blockchainService.getCustodyEventsByDocument(documentId);
        }
        else if (evidenceId) {
            events = await blockchainService.getCustodyEventsByEvidence(evidenceId);
        }
        else if (actorUserId) {
            events = await blockchainService.getCustodyEventsByActor(actorUserId, limit);
        }
        else {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'At least one filter required' });
            return;
        }
        // Apply additional filters
        let filtered = events;
        if (txType)
            filtered = filtered.filter(e => e.tx_type === txType);
        if (consensusStatus)
            filtered = filtered.filter(e => e.consensus_status === consensusStatus);
        if (startDate)
            filtered = filtered.filter(e => new Date(e.tx_timestamp) >= startDate);
        if (endDate)
            filtered = filtered.filter(e => new Date(e.tx_timestamp) <= endDate);
        const total = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);
        res.json({
            events: paginated,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET CUSTODY EVENT BY TX ID
// ============================================================================
router.get('/events/:txId', (0, validate_middleware_js_1.validate)(txIdParamSchema), async (req, res, next) => {
    try {
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        const event = await blockchainService.getCustodyEvent(req.params.txId);
        if (!event) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Custody event not found' });
            return;
        }
        // Check case access
        if (event.case_id && req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(event.case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        res.json(event);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET BLOCK
// ============================================================================
router.get('/blocks/:blockNumber', (0, validate_middleware_js_1.validate)(blockNumberParamSchema), async (req, res, next) => {
    try {
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
            return;
        }
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        const block = await blockchainService.getBlock(req.params.blockNumber);
        if (!block) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Block not found' });
            return;
        }
        res.json(block);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET LATEST BLOCK
// ============================================================================
router.get('/blocks/latest', async (req, res, next) => {
    try {
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
            return;
        }
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        const block = await blockchainService.getLatestBlock();
        if (!block) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'No blocks found' });
            return;
        }
        res.json(block);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// VERIFY CHAIN INTEGRITY
// ============================================================================
router.post('/verify-chain', (0, validate_middleware_js_1.validate)(verifyChainSchema), async (req, res, next) => {
    try {
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
            return;
        }
        const { startBlock, endBlock } = req.body;
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        const end = endBlock || (await blockchainService.getLatestBlock())?.blockNumber || startBlock + 1000;
        const result = await blockchainService.verifyChainIntegrity(startBlock, end);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'BLOCKCHAIN_CHAIN_VERIFICATION',
            event_category: 'BLOCKCHAIN',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'verify_chain_integrity',
            outcome: result.valid ? 'SUCCESS' : 'FAILURE',
            request_id: req.headers['x-request-id'],
            metadata: {
                start_block: startBlock,
                end_block: end,
                valid: result.valid,
                checked_blocks: result.checked_blocks,
                errors: result.errors,
            },
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// FULL CHAIN VERIFICATION
// ============================================================================
router.post('/verify-full-chain', async (req, res, next) => {
    try {
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
            return;
        }
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        const result = await blockchainService.verifyFullChainIntegrity();
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'BLOCKCHAIN_FULL_VERIFICATION',
            event_category: 'BLOCKCHAIN',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'verify_full_chain',
            outcome: result.valid ? 'SUCCESS' : 'FAILURE',
            request_id: req.headers['x-request-id'],
            metadata: {
                last_block_number: result.last_block_number,
                verified_blocks: result.verified_blocks,
                errors: result.errors,
            },
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET ORGANIZATIONS
// ============================================================================
router.get('/organizations', async (req, res, next) => {
    try {
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
            return;
        }
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        const orgs = await blockchainService['client']?.queryAllOrganizations() || [];
        res.json(orgs);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// INIT LEDGER (Admin only, one-time)
// ============================================================================
router.post('/init-ledger', async (req, res, next) => {
    try {
        if (req.auth.role !== 'CENTRAL_ADMIN') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Central Admin access required' });
            return;
        }
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        const result = await blockchainService['client']?.initLedger() || 'Ledger initialized (simulated)';
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'BLOCKCHAIN_LEDGER_INIT',
            event_category: 'BLOCKCHAIN',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'init_ledger',
            outcome: 'SUCCESS',
            request_id: req.headers['x-request-id'],
        });
        res.json({ message: result });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=blockchain.routes.js.map