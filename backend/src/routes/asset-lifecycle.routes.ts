/**
 * ADALAT360 - Asset Lifecycle Routes
 * Police Asset Lifecycle Management with state machine, QR codes, and blockchain integration
 */

import { Router } from 'express';
import { z } from 'zod';
import { getAssetLifecycleService } from '@services/asset-lifecycle.service.js';
import { authenticate, requireCaseAccess, requireCasePermission, userRateLimit } from '@middleware/auth/auth.middleware.js';
import { validate } from '@middleware/validate.middleware.js';
import { logAuditEvent } from '@services/audit.service.js';
import { AssetState, AssetCategory, AssetTransition, CustodyAction } from '@types/database.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const assetIdParamSchema = z.object({
    params: z.object({
        assetId: z.string().uuid(),
    }),
});

const assetIdByAssetIdParamSchema = z.object({
    params: z.object({
        assetId: z.string().min(1), // Human-readable asset ID like AST/CASE/YYYY/NNNNN
    }),
});

const createAssetSchema = z.object({
    body: z.object({
        caseId: z.string().uuid(),
        name: z.string().min(1).max(500),
        description: z.string().optional(),
        category: z.nativeEnum(AssetCategory),
        sub_category: z.string().max(100).optional(),
        seized_at: z.coerce.date(),
        seized_by_user_id: z.string().uuid(),
        seized_location: z.object({
            address: z.string().min(1).max(500),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
            landmark: z.string().optional(),
        }),
        seized_from: z.string().max(500).optional(),
        panchnama_reference: z.string().max(200).optional(),
        seizure_memo_number: z.string().max(100).optional(),
        weight_grams: z.number().positive().optional(),
        dimensions_cm: z.object({
            length: z.number().positive(),
            width: z.number().positive(),
            height: z.number().positive(),
        }).optional(),
        photographs: z.array(z.string().url()).optional(),
        distinguishing_features: z.string().optional(),
        serial_number: z.string().max(100).optional(),
        manufacturer: z.string().max(100).optional(),
        model: z.string().max(100).optional(),
        current_location: z.object({
            facility: z.string().min(1).max(200),
            room: z.string().max(100).optional(),
            shelf: z.string().max(100).optional(),
            address: z.string().min(1).max(500),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
        }).optional(),
        container_seal_number: z.string().max(100).optional(),
        seal_intact: z.boolean().default(true),
        storage_condition: z.string().max(200).optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.any()).optional(),
    }),
});

const transitionAssetSchema = z.object({
    body: z.object({
        to_state: z.nativeEnum(AssetState),
        location: z.object({
            facility: z.string().min(1).max(200),
            room: z.string().max(100).optional(),
            address: z.string().min(1).max(500),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
        }).optional(),
        seal_number: z.string().max(100).optional(),
        seal_intact: z.boolean().optional(),
        condition_notes: z.string().max(1000).optional(),
        witness_user_id: z.string().uuid().optional(),
        disposal_initiated_by: z.string().uuid().optional(),
        disposal_approved_by: z.string().uuid().optional(),
        disposal_authorization: z.string().optional(),
        metadata: z.record(z.any()).optional(),
    }),
});

const disposalApprovalSchema = z.object({
    body: z.object({
        asset_id: z.string().uuid(),
        disposal_method: z.string().min(1).max(200),
        disposal_authorization: z.string().min(1).max(500),
        approved_by: z.string().uuid(),
        expires_in_hours: z.coerce.number().int().positive().max(168).optional(), // Max 1 week
    }),
});

const disposalApprovalActionSchema = z.object({
    body: z.object({
        action: z.enum(['APPROVE', 'REJECT']),
        reason: z.string().optional(),
    }).refine(data => data.action !== 'REJECT' || (data.reason && data.reason.length > 0), {
        message: 'Rejection reason is required',
        path: ['reason'],
    }),
});

const assetQuerySchema = z.object({
    query: z.object({
        case_id: z.string().uuid().optional(),
        current_state: z.array(z.nativeEnum(AssetState)).optional(),
        category: z.array(z.nativeEnum(AssetCategory)).optional(),
        seized_by_user_id: z.string().uuid().optional(),
        current_holder_user_id: z.string().uuid().optional(),
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        search: z.string().optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
    }),
});

const qrScanSchema = z.object({
    body: z.object({
        qr_payload: z.string().min(1),
    }),
});

const disposalApprovalIdParamSchema = z.object({
    params: z.object({
        approvalId: z.string().uuid(),
    }),
});

// ============================================================================
// ASSET CREATION
// ============================================================================

router.post('/',
    userRateLimit(20, 60000, 'asset_create'),
    validate(createAssetSchema),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const asset = await assetLifecycleService.createAsset(req.body, req.auth!.sub);

            await logAuditEvent({
                event_type: 'ASSET_CREATED',
                event_category: 'ASSET_LIFECYCLE',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'create_asset',
                outcome: 'SUCCESS',
                resource_type: 'ASSET',
                resource_id: asset.id,
                request_id: req.headers['x-request-id'] as string,
                metadata: {
                    asset_id: asset.asset_id,
                    asset_category: req.body.category,
                    asset_name: req.body.name,
                },
            });

            res.status(201).json(asset);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// ASSET LISTING
// ============================================================================

router.get('/',
    userRateLimit(60, 60000, 'asset_list'),
    validate(assetQuerySchema),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const result = await assetLifecycleService.queryAssets(req.query as any);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// ASSET STATISTICS
// ============================================================================

router.get('/statistics',
    validate(z.object({
        query: z.object({
            case_id: z.string().uuid().optional(),
        }),
    })),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const stats = await assetLifecycleService.getAssetStatistics(req.query.case_id as string | undefined);
            res.json(stats);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET ASSET BY ID
// ============================================================================

router.get('/:assetId',
    validate(assetIdParamSchema),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const asset = await assetLifecycleService.getAsset(req.params.assetId);

            if (!asset) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });
                return;
            }

            // Check case access
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (!req.auth!.case_ids.includes(asset.case_id)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this asset' });
                    return;
                }
            }

            res.json(asset);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET ASSET BY HUMAN-READABLE ASSET ID
// ============================================================================

router.get('/by-asset-id/:assetId',
    validate(assetIdByAssetIdParamSchema),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const asset = await assetLifecycleService.getAssetByAssetId(req.params.assetId);

            if (!asset) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });
                return;
            }

            // Check case access
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (!req.auth!.case_ids.includes(asset.case_id)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this asset' });
                    return;
                }
            }

            res.json(asset);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// QR CODE SCAN
// ============================================================================

router.post('/qr/scan',
    validate(qrScanSchema),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const result = await assetLifecycleService.scanAssetQR(req.body.qr_payload);

            // Check case access
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (!req.auth!.case_ids.includes(result.asset.case_id)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this asset' });
                    return;
                }
            }

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET ASSET QR CODE
// ============================================================================

router.get('/:assetId/qr-code',
    validate(assetIdParamSchema),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const asset = await assetLifecycleService.getAsset(req.params.assetId);

            if (!asset) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });
                return;
            }

            // Check case access
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (!req.auth!.case_ids.includes(asset.case_id)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                    return;
                }
            }

            res.json({
                asset_id: asset.asset_id,
                qr_code_hash: asset.qr_code_hash,
                qr_code_image_url: asset.qr_code_image_url,
                qr_code_payload: asset.qr_code_payload,
                current_state: asset.current_state,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// STATE TRANSITION
// ============================================================================

router.post('/:assetId/transition',
    validate(assetIdParamSchema),
    validate(transitionAssetSchema),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const asset = await assetLifecycleService.transitionAssetState(
                { asset_id: req.params.assetId, ...req.body },
                req.auth!.sub
            );

            await logAuditEvent({
                event_type: 'ASSET_STATE_TRANSITION',
                event_category: 'ASSET_LIFECYCLE',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'asset_state_transition',
                outcome: 'SUCCESS',
                resource_type: 'ASSET',
                resource_id: req.params.assetId,
                request_id: req.headers['x-request-id'] as string,
                metadata: {
                    from_state: req.body.from_state,
                    to_state: req.body.to_state,
                    transition: req.body.transition,
                },
            });

            res.json(asset);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET STATE HISTORY
// ============================================================================

router.get('/:assetId/history',
    validate(assetIdParamSchema),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const asset = await assetLifecycleService.getAsset(req.params.assetId);

            if (!asset) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });
                return;
            }

            // Check case access
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (!req.auth!.case_ids.includes(asset.case_id)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                    return;
                }
            }

            const history = await assetLifecycleService.getAssetStateHistory(req.params.assetId);
            res.json(history);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// DISPOSAL APPROVAL (Maker-Checker)
// ============================================================================

router.post('/disposal-approvals',
    validate(disposalApprovalSchema),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const approval = await assetLifecycleService.createDisposalApproval(req.body, req.auth!.sub);

            await logAuditEvent({
                event_type: 'DISPOSAL_APPROVAL_REQUESTED',
                event_category: 'ASSET_LIFECYCLE',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'request_disposal_approval',
                outcome: 'SUCCESS',
                resource_type: 'DISPOSAL_APPROVAL',
                resource_id: approval.id,
                request_id: req.headers['x-request-id'] as string,
            });

            res.status(201).json(approval);
        } catch (error) {
            next(error);
        }
    }
);

router.post('/disposal-approvals/:approvalId/action',
    validate(disposalApprovalIdParamSchema),
    validate(disposalApprovalActionSchema),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();

            let approval;
            if (req.body.action === 'APPROVE') {
                approval = await assetLifecycleService.approveDisposal(req.params.approvalId, req.auth!.sub);
            } else {
                if (!req.body.reason) {
                    res.status(400).json({ error: 'BAD_REQUEST', message: 'Rejection reason is required' });
                    return;
                }
                approval = await assetLifecycleService.rejectDisposal(req.params.approvalId, req.auth!.sub, req.body.reason);
            }

            await logAuditEvent({
                event_type: req.body.action === 'APPROVE' ? 'DISPOSAL_APPROVED' : 'DISPOSAL_REJECTED',
                event_category: 'ASSET_LIFECYCLE',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: req.body.action.toLowerCase() + '_disposal_approval',
                outcome: 'SUCCESS',
                resource_type: 'DISPOSAL_APPROVAL',
                resource_id: req.params.approvalId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json(approval);
        } catch (error) {
            next(error);
        }
    }
);

router.get('/disposal-approvals/:approvalId',
    validate(disposalApprovalIdParamSchema),
    async (req, res, next) => {
        try {
            // In a real implementation, this would be in the service
            const result = await pgQuery(
                `SELECT * FROM disposal_approvals WHERE id = $1`,
                [req.params.approvalId]
            );

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Disposal approval not found' });
                return;
            }

            res.json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET STATE HISTORY
// ============================================================================

router.get('/:assetId/state-history',
    validate(assetIdParamSchema),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const asset = await assetLifecycleService.getAsset(req.params.assetId);

            if (!asset) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });
                return;
            }

            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (!req.auth!.case_ids.includes(asset.case_id)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                    return;
                }
            }

            const history = await assetLifecycleService.getAssetStateHistory(req.params.assetId);
            res.json(history);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// ASSET STATISTICS
// ============================================================================

router.get('/case/:caseId/statistics',
    validate(z.object({ params: z.object({ caseId: z.string().uuid() }) })),
    async (req, res, next) => {
        try {
            const assetLifecycleService = getAssetLifecycleService();
            const stats = await assetLifecycleService.getAssetStatistics(req.params.caseId);
            res.json(stats);
        } catch (error) {
            next(error);
        }
    }
);

export default router;