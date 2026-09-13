/**
 * ADALAT360 - Blockchain Routes
 * REST API for custody ledger queries and chain verification
 */

import { Router } from 'express';
import { z } from 'zod';
import { getBlockchainService } from '@blockchain/blockchain.service.js';
import { authenticate, requireRole, userRateLimit } from '@middleware/auth/auth.middleware.js';
import { validate } from '@middleware/validate.middleware.js';
import { logAuditEvent } from '@services/audit.service.js';
import { CustodyAction, ConsensusStatus, UserRole } from '@types/database.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const custodyEventQuerySchema = z.object({
    query: z.object({
        caseId: z.string().uuid().optional(),
        documentId: z.string().uuid().optional(),
        evidenceId: z.string().uuid().optional(),
        actorUserId: z.string().uuid().optional(),
        txType: z.nativeEnum(CustodyAction).optional(),
        consensusStatus: z.nativeEnum(ConsensusStatus).optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
    }),
});

const blockQuerySchema = z.object({
    query: z.object({
        startBlock: z.coerce.number().int().positive().optional(),
        endBlock: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(1000).default(100),
    }),
});

const txIdParamSchema = z.object({
    params: z.object({
        txId: z.string().min(1),
    }),
});

const blockNumberParamSchema = z.object({
    params: z.object({
        blockNumber: z.coerce.number().int().positive(),
    }),
});

const verifyChainSchema = z.object({
    body: z.object({
        startBlock: z.coerce.number().int().positive().default(1),
        endBlock: z.coerce.number().int().positive().optional(),
    }),
});

// ============================================================================
// GET CUSTODY EVENTS
// ============================================================================

router.get('/events',
    userRateLimit(50, 60000, 'blockchain_events'),
    validate(custodyEventQuerySchema),
    async (req, res, next) => {
        try {
            const blockchainService = getBlockchainService();
            const { caseId, documentId, evidenceId, actorUserId, txType, consensusStatus, startDate, endDate, page, limit } = req.query as any;
            const offset = (page - 1) * limit;

            // Admins and auditors can query all, others only their cases
            let queryCaseId = caseId;
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (caseId && !req.auth!.case_ids.includes(caseId)) {
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
            } else if (documentId) {
                events = await blockchainService.getCustodyEventsByDocument(documentId);
            } else if (evidenceId) {
                events = await blockchainService.getCustodyEventsByEvidence(evidenceId);
            } else if (actorUserId) {
                events = await blockchainService.getCustodyEventsByActor(actorUserId, limit);
            } else {
                res.status(400).json({ error: 'BAD_REQUEST', message: 'At least one filter required' });
                return;
            }

            // Apply additional filters
            let filtered = events;
            if (txType) filtered = filtered.filter(e => e.tx_type === txType);
            if (consensusStatus) filtered = filtered.filter(e => e.consensus_status === consensusStatus);
            if (startDate) filtered = filtered.filter(e => new Date(e.tx_timestamp) >= startDate);
            if (endDate) filtered = filtered.filter(e => new Date(e.tx_timestamp) <= endDate);

            const total = filtered.length;
            const paginated = filtered.slice(offset, offset + limit);

            res.json({
                events: paginated,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET CUSTODY EVENT BY TX ID
// ============================================================================

router.get('/events/:txId',
    validate(txIdParamSchema),
    async (req, res, next) => {
        try {
            const blockchainService = getBlockchainService();
            const event = await blockchainService.getCustodyEvent(req.params.txId);

            if (!event) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Custody event not found' });
                return;
            }

            // Check case access
            if (event.case_id && req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (!req.auth!.case_ids.includes(event.case_id)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                    return;
                }
            }

            res.json(event);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET BLOCK
// ============================================================================

router.get('/blocks/:blockNumber',
    validate(blockNumberParamSchema),
    async (req, res, next) => {
        try {
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
                return;
            }

            const blockchainService = getBlockchainService();
            const block = await blockchainService.getBlock(req.params.blockNumber);

            if (!block) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Block not found' });
                return;
            }

            res.json(block);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET LATEST BLOCK
// ============================================================================

router.get('/blocks/latest',
    async (req, res, next) => {
        try {
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
                return;
            }

            const blockchainService = getBlockchainService();
            const block = await blockchainService.getLatestBlock();

            if (!block) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'No blocks found' });
                return;
            }

            res.json(block);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// VERIFY CHAIN INTEGRITY
// ============================================================================

router.post('/verify-chain',
    validate(verifyChainSchema),
    async (req, res, next) => {
        try {
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
                return;
            }

            const { startBlock, endBlock } = req.body;
            const blockchainService = getBlockchainService();

            const end = endBlock || (await blockchainService.getLatestBlock())?.blockNumber || startBlock + 1000;

            const result = await blockchainService.verifyChainIntegrity(startBlock, end);

            await logAuditEvent({
                event_type: 'BLOCKCHAIN_CHAIN_VERIFICATION',
                event_category: 'BLOCKCHAIN',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'verify_chain_integrity',
                outcome: result.valid ? 'SUCCESS' : 'FAILURE',
                request_id: req.headers['x-request-id'] as string,
                metadata: {
                    start_block: startBlock,
                    end_block: end,
                    valid: result.valid,
                    checked_blocks: result.checked_blocks,
                    errors: result.errors,
                },
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// FULL CHAIN VERIFICATION
// ============================================================================

router.post('/verify-full-chain',
    async (req, res, next) => {
        try {
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
                return;
            }

            const blockchainService = getBlockchainService();
            const result = await blockchainService.verifyFullChainIntegrity();

            await logAuditEvent({
                event_type: 'BLOCKCHAIN_FULL_VERIFICATION',
                event_category: 'BLOCKCHAIN',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'verify_full_chain',
                outcome: result.valid ? 'SUCCESS' : 'FAILURE',
                request_id: req.headers['x-request-id'] as string,
                metadata: {
                    last_block_number: result.last_block_number,
                    verified_blocks: result.verified_blocks,
                    errors: result.errors,
                },
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET ORGANIZATIONS
// ============================================================================

router.get('/organizations',
    async (req, res, next) => {
        try {
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
                return;
            }

            const blockchainService = getBlockchainService();
            const orgs = await blockchainService['client']?.queryAllOrganizations() || [];

            res.json(orgs);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// INIT LEDGER (Admin only, one-time)
// ============================================================================

router.post('/init-ledger',
    async (req, res, next) => {
        try {
            if (req.auth!.role !== 'CENTRAL_ADMIN') {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Central Admin access required' });
                return;
            }

            const blockchainService = getBlockchainService();
            const result = await blockchainService['client']?.initLedger() || 'Ledger initialized (simulated)';

            await logAuditEvent({
                event_type: 'BLOCKCHAIN_LEDGER_INIT',
                event_category: 'BLOCKCHAIN',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'init_ledger',
                outcome: 'SUCCESS',
                request_id: req.headers['x-request-id'] as string,
            });

            res.json({ message: result });
        } catch (error) {
            next(error);
        }
    }
);

export default router;