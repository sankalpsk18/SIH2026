"use strict";
/**
 * ADALAT360 - Asset Lifecycle Routes
 * Police Asset Lifecycle Management with state machine, QR codes, and blockchain integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const asset_lifecycle_service_js_1 = require("../services/asset-lifecycle.service.js");
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
const assetIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        assetId: zod_1.z.string().uuid(),
    }),
});
const assetIdByAssetIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        assetId: zod_1.z.string().min(1), // Human-readable asset ID like AST/CASE/YYYY/NNNNN
    }),
});
const createAssetSchema = zod_1.z.object({
    body: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
        name: zod_1.z.string().min(1).max(500),
        description: zod_1.z.string().optional(),
        category: zod_1.z.nativeEnum(database_js_1.AssetCategory),
        sub_category: zod_1.z.string().max(100).optional(),
        seized_at: zod_1.z.coerce.date(),
        seized_by_user_id: zod_1.z.string().uuid(),
        seized_location: zod_1.z.object({
            address: zod_1.z.string().min(1).max(500),
            latitude: zod_1.z.number().optional(),
            longitude: zod_1.z.number().optional(),
            landmark: zod_1.z.string().optional(),
        }),
        seized_from: zod_1.z.string().max(500).optional(),
        panchnama_reference: zod_1.z.string().max(200).optional(),
        seizure_memo_number: zod_1.z.string().max(100).optional(),
        weight_grams: zod_1.z.number().positive().optional(),
        dimensions_cm: zod_1.z.object({
            length: zod_1.z.number().positive(),
            width: zod_1.z.number().positive(),
            height: zod_1.z.number().positive(),
        }).optional(),
        photographs: zod_1.z.array(zod_1.z.string().url()).optional(),
        distinguishing_features: zod_1.z.string().optional(),
        serial_number: zod_1.z.string().max(100).optional(),
        manufacturer: zod_1.z.string().max(100).optional(),
        model: zod_1.z.string().max(100).optional(),
        current_location: zod_1.z.object({
            facility: zod_1.z.string().min(1).max(200),
            room: zod_1.z.string().max(100).optional(),
            shelf: zod_1.z.string().max(100).optional(),
            address: zod_1.z.string().min(1).max(500),
            latitude: zod_1.z.number().optional(),
            longitude: zod_1.z.number().optional(),
        }).optional(),
        container_seal_number: zod_1.z.string().max(100).optional(),
        seal_intact: zod_1.z.boolean().default(true),
        storage_condition: zod_1.z.string().max(200).optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        metadata: zod_1.z.record(zod_1.z.any()).optional(),
    }),
});
const transitionAssetSchema = zod_1.z.object({
    body: zod_1.z.object({
        to_state: zod_1.z.nativeEnum(database_js_1.AssetState),
        location: zod_1.z.object({
            facility: zod_1.z.string().min(1).max(200),
            room: zod_1.z.string().max(100).optional(),
            address: zod_1.z.string().min(1).max(500),
            latitude: zod_1.z.number().optional(),
            longitude: zod_1.z.number().optional(),
        }).optional(),
        seal_number: zod_1.z.string().max(100).optional(),
        seal_intact: zod_1.z.boolean().optional(),
        condition_notes: zod_1.z.string().max(1000).optional(),
        witness_user_id: zod_1.z.string().uuid().optional(),
        disposal_initiated_by: zod_1.z.string().uuid().optional(),
        disposal_approved_by: zod_1.z.string().uuid().optional(),
        disposal_authorization: zod_1.z.string().optional(),
        metadata: zod_1.z.record(zod_1.z.any()).optional(),
    }),
});
const disposalApprovalSchema = zod_1.z.object({
    body: zod_1.z.object({
        asset_id: zod_1.z.string().uuid(),
        disposal_method: zod_1.z.string().min(1).max(200),
        disposal_authorization: zod_1.z.string().min(1).max(500),
        approved_by: zod_1.z.string().uuid(),
        expires_in_hours: zod_1.z.coerce.number().int().positive().max(168).optional(), // Max 1 week
    }),
});
const disposalApprovalActionSchema = zod_1.z.object({
    body: zod_1.z.object({
        action: zod_1.z.enum(['APPROVE', 'REJECT']),
        reason: zod_1.z.string().optional(),
    }).refine(data => data.action !== 'REJECT' || (data.reason && data.reason.length > 0), {
        message: 'Rejection reason is required',
        path: ['reason'],
    }),
});
const assetQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        case_id: zod_1.z.string().uuid().optional(),
        current_state: zod_1.z.array(zod_1.z.nativeEnum(database_js_1.AssetState)).optional(),
        category: zod_1.z.array(zod_1.z.nativeEnum(database_js_1.AssetCategory)).optional(),
        seized_by_user_id: zod_1.z.string().uuid().optional(),
        current_holder_user_id: zod_1.z.string().uuid().optional(),
        date_from: zod_1.z.coerce.date().optional(),
        date_to: zod_1.z.coerce.date().optional(),
        search: zod_1.z.string().optional(),
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    }),
});
const qrScanSchema = zod_1.z.object({
    body: zod_1.z.object({
        qr_payload: zod_1.z.string().min(1),
    }),
});
const disposalApprovalIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        approvalId: zod_1.z.string().uuid(),
    }),
});
// ============================================================================
// ASSET CREATION
// ============================================================================
router.post('/', (0, auth_middleware_js_1.userRateLimit)(20, 60000, 'asset_create'), (0, validate_middleware_js_1.validate)(createAssetSchema), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const asset = await assetLifecycleService.createAsset(req.body, req.auth.sub);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'ASSET_CREATED',
            event_category: 'ASSET_LIFECYCLE',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'create_asset',
            outcome: 'SUCCESS',
            resource_type: 'ASSET',
            resource_id: asset.id,
            request_id: req.headers['x-request-id'],
            metadata: {
                asset_id: asset.asset_id,
                asset_category: req.body.category,
                asset_name: req.body.name,
            },
        });
        res.status(201).json(asset);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// ASSET LISTING
// ============================================================================
router.get('/', (0, auth_middleware_js_1.userRateLimit)(60, 60000, 'asset_list'), (0, validate_middleware_js_1.validate)(assetQuerySchema), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const result = await assetLifecycleService.queryAssets(req.query);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// ASSET STATISTICS
// ============================================================================
router.get('/statistics', (0, validate_middleware_js_1.validate)(zod_1.z.object({
    query: zod_1.z.object({
        case_id: zod_1.z.string().uuid().optional(),
    }),
})), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const stats = await assetLifecycleService.getAssetStatistics(req.query.case_id);
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET ASSET BY ID
// ============================================================================
router.get('/:assetId', (0, validate_middleware_js_1.validate)(assetIdParamSchema), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const asset = await assetLifecycleService.getAsset(req.params.assetId);
        if (!asset) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });
            return;
        }
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(asset.case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this asset' });
                return;
            }
        }
        res.json(asset);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET ASSET BY HUMAN-READABLE ASSET ID
// ============================================================================
router.get('/by-asset-id/:assetId', (0, validate_middleware_js_1.validate)(assetIdByAssetIdParamSchema), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const asset = await assetLifecycleService.getAssetByAssetId(req.params.assetId);
        if (!asset) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });
            return;
        }
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(asset.case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this asset' });
                return;
            }
        }
        res.json(asset);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// QR CODE SCAN
// ============================================================================
router.post('/qr/scan', (0, validate_middleware_js_1.validate)(qrScanSchema), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const result = await assetLifecycleService.scanAssetQR(req.body.qr_payload);
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(result.asset.case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this asset' });
                return;
            }
        }
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET ASSET QR CODE
// ============================================================================
router.get('/:assetId/qr-code', (0, validate_middleware_js_1.validate)(assetIdParamSchema), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const asset = await assetLifecycleService.getAsset(req.params.assetId);
        if (!asset) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });
            return;
        }
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(asset.case_id)) {
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
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// STATE TRANSITION
// ============================================================================
router.post('/:assetId/transition', (0, validate_middleware_js_1.validate)(assetIdParamSchema), (0, validate_middleware_js_1.validate)(transitionAssetSchema), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const asset = await assetLifecycleService.transitionAssetState({ asset_id: req.params.assetId, ...req.body }, req.auth.sub);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'ASSET_STATE_TRANSITION',
            event_category: 'ASSET_LIFECYCLE',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'asset_state_transition',
            outcome: 'SUCCESS',
            resource_type: 'ASSET',
            resource_id: req.params.assetId,
            request_id: req.headers['x-request-id'],
            metadata: {
                from_state: req.body.from_state,
                to_state: req.body.to_state,
                transition: req.body.transition,
            },
        });
        res.json(asset);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET STATE HISTORY
// ============================================================================
router.get('/:assetId/history', (0, validate_middleware_js_1.validate)(assetIdParamSchema), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const asset = await assetLifecycleService.getAsset(req.params.assetId);
        if (!asset) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });
            return;
        }
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(asset.case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        const history = await assetLifecycleService.getAssetStateHistory(req.params.assetId);
        res.json(history);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// DISPOSAL APPROVAL (Maker-Checker)
// ============================================================================
router.post('/disposal-approvals', (0, validate_middleware_js_1.validate)(disposalApprovalSchema), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const approval = await assetLifecycleService.createDisposalApproval(req.body, req.auth.sub);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'DISPOSAL_APPROVAL_REQUESTED',
            event_category: 'ASSET_LIFECYCLE',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'request_disposal_approval',
            outcome: 'SUCCESS',
            resource_type: 'DISPOSAL_APPROVAL',
            resource_id: approval.id,
            request_id: req.headers['x-request-id'],
        });
        res.status(201).json(approval);
    }
    catch (error) {
        next(error);
    }
});
router.post('/disposal-approvals/:approvalId/action', (0, validate_middleware_js_1.validate)(disposalApprovalIdParamSchema), (0, validate_middleware_js_1.validate)(disposalApprovalActionSchema), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        let approval;
        if (req.body.action === 'APPROVE') {
            approval = await assetLifecycleService.approveDisposal(req.params.approvalId, req.auth.sub);
        }
        else {
            if (!req.body.reason) {
                res.status(400).json({ error: 'BAD_REQUEST', message: 'Rejection reason is required' });
                return;
            }
            approval = await assetLifecycleService.rejectDisposal(req.params.approvalId, req.auth.sub, req.body.reason);
        }
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: req.body.action === 'APPROVE' ? 'DISPOSAL_APPROVED' : 'DISPOSAL_REJECTED',
            event_category: 'ASSET_LIFECYCLE',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: req.body.action.toLowerCase() + '_disposal_approval',
            outcome: 'SUCCESS',
            resource_type: 'DISPOSAL_APPROVAL',
            resource_id: req.params.approvalId,
            request_id: req.headers['x-request-id'],
        });
        res.json(approval);
    }
    catch (error) {
        next(error);
    }
});
router.get('/disposal-approvals/:approvalId', (0, validate_middleware_js_1.validate)(disposalApprovalIdParamSchema), async (req, res, next) => {
    try {
        // In a real implementation, this would be in the service
        const result = await pgQuery(`SELECT * FROM disposal_approvals WHERE id = $1`, [req.params.approvalId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Disposal approval not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET STATE HISTORY
// ============================================================================
router.get('/:assetId/state-history', (0, validate_middleware_js_1.validate)(assetIdParamSchema), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const asset = await assetLifecycleService.getAsset(req.params.assetId);
        if (!asset) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });
            return;
        }
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(asset.case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        const history = await assetLifecycleService.getAssetStateHistory(req.params.assetId);
        res.json(history);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// ASSET STATISTICS
// ============================================================================
router.get('/case/:caseId/statistics', (0, validate_middleware_js_1.validate)(zod_1.z.object({ params: zod_1.z.object({ caseId: zod_1.z.string().uuid() }) })), async (req, res, next) => {
    try {
        const assetLifecycleService = (0, asset_lifecycle_service_js_1.getAssetLifecycleService)();
        const stats = await assetLifecycleService.getAssetStatistics(req.params.caseId);
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=asset-lifecycle.routes.js.map