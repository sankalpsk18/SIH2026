"use strict";
/**
 * ADALAT360 - Collaboration Routes
 * Activity feed, handoff/assign actions, notifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const collaboration_service_js_1 = require("../services/collaboration.service.js");
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
const caseIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
    }),
});
const handoffIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        handoffId: zod_1.z.string().uuid(),
    }),
});
const activityIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        activityId: zod_1.z.string().uuid(),
    }),
});
const notificationIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        notificationId: zod_1.z.string().uuid(),
    }),
});
const createHandoffSchema = zod_1.z.object({
    body: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
        handoff_type: zod_1.z.nativeEnum(database_js_1.HandoffType),
        title: zod_1.z.string().min(1).max(200),
        description: zod_1.z.string().optional(),
        resource_type: zod_1.z.enum(['CASE', 'DOCUMENT', 'EVIDENCE']),
        resource_id: zod_1.z.string().uuid(),
        to_user_id: zod_1.z.string().uuid(),
        expires_in_hours: zod_1.z.coerce.number().int().positive().max(168).optional(), // Max 1 week
        metadata: zod_1.z.record(zod_1.z.any()).optional(),
    }),
});
const handoffActionSchema = zod_1.z.object({
    body: zod_1.z.object({
        action: zod_1.z.enum(['ACCEPT', 'DECLINE']),
        reason: zod_1.z.string().optional(),
    }).refine(data => data.action !== 'DECLINE' || (data.reason && data.reason.length > 0), {
        message: 'Decline reason is required',
        path: ['reason'],
    }),
});
const activityQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        case_id: zod_1.z.string().uuid(),
        activity_types: zod_1.z.array(zod_1.z.nativeEnum(database_js_1.ActivityType)).optional(),
        actor_user_ids: zod_1.z.array(zod_1.z.string().uuid()).optional(),
        date_from: zod_1.z.coerce.date().optional(),
        date_to: zod_1.z.coerce.date().optional(),
        visibility: zod_1.z.nativeEnum(database_js_1.ActivityVisibility).optional(),
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
        sort_by: zod_1.z.enum(['created_at', 'activity_type']).default('created_at'),
        sort_order: zod_1.z.enum(['asc', 'desc']).default('desc'),
    }),
});
const handoffQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        case_id: zod_1.z.string().uuid().optional(),
        status: zod_1.z.array(zod_1.z.nativeEnum(database_js_1.HandoffStatus)).optional(),
        handoff_type: zod_1.z.array(zod_1.z.nativeEnum(database_js_1.HandoffType)).optional(),
        from_user_id: zod_1.z.string().uuid().optional(),
        to_user_id: zod_1.z.string().uuid().optional(),
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    }),
});
const notificationQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
        unread_only: zod_1.z.coerce.boolean().default(false),
    }),
});
const commentCreateSchema = zod_1.z.object({
    body: zod_1.z.object({
        case_id: zod_1.z.string().uuid(),
        activity_id: zod_1.z.string().uuid(),
        content: zod_1.z.string().min(1).max(5000),
        parent_comment_id: zod_1.z.string().uuid().optional(),
        mentioned_user_ids: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    }),
});
const commentIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        commentId: zod_1.z.string().uuid(),
    }),
});
// ============================================================================
// ACTIVITY FEED ROUTES
// ============================================================================
router.get('/activity-feed', (0, auth_middleware_js_1.userRateLimit)(60, 60000, 'activity_feed'), (0, validate_middleware_js_1.validate)(activityQuerySchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const result = await collaborationService.queryActivityFeed(req.query, req.auth.sub, req.auth.role, req.auth.case_ids);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get('/activity-feed/:activityId', (0, validate_middleware_js_1.validate)(activityIdParamSchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const activity = await collaborationService.getActivityEntry(req.params.activityId);
        if (!activity) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Activity not found' });
            return;
        }
        // Check access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(activity.case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        res.json(activity);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// HANDOFF ROUTES
// ============================================================================
router.post('/handoffs', (0, auth_middleware_js_1.userRateLimit)(20, 60000, 'handoff_create'), (0, validate_middleware_js_1.validate)(createHandoffSchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const handoff = await collaborationService.createHandoff(req.body, req.auth.sub);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'HANDOFF_INITIATED',
            event_category: 'COLLABORATION',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'create_handoff',
            outcome: 'SUCCESS',
            resource_type: req.body.resource_type,
            resource_id: req.body.resource_id,
            request_id: req.headers['x-request-id'],
            metadata: { handoff_id: handoff.id, handoff_type: req.body.handoff_type },
        });
        res.status(201).json(handoff);
    }
    catch (error) {
        next(error);
    }
});
router.get('/handoffs', (0, validate_middleware_js_1.validate)(handoffQuerySchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const result = await collaborationService.queryHandoffs(req.query, req.auth.sub, req.auth.role, req.auth.case_ids);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get('/handoffs/:handoffId', (0, validate_middleware_js_1.validate)(handoffIdParamSchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const handoff = await collaborationService.getHandoff(req.params.handoffId, req.auth.sub, req.auth.role, req.auth.case_ids);
        if (!handoff) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Handoff not found' });
            return;
        }
        res.json(handoff);
    }
    catch (error) {
        next(error);
    }
});
router.post('/handoffs/:handoffId/action', (0, validate_middleware_js_1.validate)(handoffIdParamSchema), (0, validate_middleware_js_1.validate)(handoffActionSchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const handoff = await collaborationService.actOnHandoff(req.params.handoffId, req.auth.sub, req.body);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: req.body.action === 'ACCEPT' ? 'HANDOFF_ACCEPTED' : 'HANDOFF_DECLINED',
            event_category: 'COLLABORATION',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: req.body.action.toLowerCase() + '_handoff',
            outcome: 'SUCCESS',
            resource_type: 'HANDOFF',
            resource_id: req.params.handoffId,
            request_id: req.headers['x-request-id'],
            metadata: { handoff_id: req.params.handoffId },
        });
        res.json(handoff);
    }
    catch (error) {
        next(error);
    }
});
router.post('/handoffs/:handoffId/cancel', (0, validate_middleware_js_1.validate)(handoffIdParamSchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const handoff = await collaborationService.cancelHandoff(req.params.handoffId, req.auth.sub);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'HANDOFF_CANCELLED',
            event_category: 'COLLABORATION',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'cancel_handoff',
            outcome: 'SUCCESS',
            resource_type: 'HANDOFF',
            resource_id: req.params.handoffId,
            request_id: req.headers['x-request-id'],
        });
        res.json(handoff);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// NOTIFICATIONS ROUTES
// ============================================================================
router.get('/notifications', (0, validate_middleware_js_1.validate)(notificationQuerySchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const { page, limit, unread_only } = req.query;
        // Filter by read status if unread_only
        const result = await collaborationService.getUserNotifications(req.auth.sub, page, limit);
        let notifications = result.notifications;
        if (unread_only) {
            notifications = notifications.filter(n => !n.read);
        }
        res.json({
            notifications,
            total: result.total,
            page,
            limit,
            total_pages: Math.ceil(result.total / limit),
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/notifications/:notificationId/read', (0, validate_middleware_js_1.validate)(notificationIdParamSchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        await collaborationService.markNotificationRead(req.params.notificationId, req.auth.sub);
        res.json({ message: 'Notification marked as read' });
    }
    catch (error) {
        next(error);
    }
});
router.post('/notifications/read-all', async (req, res, next) => {
    try {
        // Mark all as read - would need implementation
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// COMMENTS ROUTES
// ============================================================================
router.post('/comments', (0, validate_middleware_js_1.validate)(commentCreateSchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const comment = await collaborationService.addComment(req.body, req.auth.sub);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'COMMENT_ADDED',
            event_category: 'COLLABORATION',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'add_comment',
            outcome: 'SUCCESS',
            resource_type: 'COMMENT',
            resource_id: comment.id,
            request_id: req.headers['x-request-id'],
        });
        res.status(201).json(comment);
    }
    catch (error) {
        next(error);
    }
});
router.get('/activity-feed/:activityId/comments', (0, validate_middleware_js_1.validate)(activityIdParamSchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const comments = await collaborationService.getCommentsForActivity(req.params.activityId);
        res.json(comments);
    }
    catch (error) {
        next(error);
    }
});
router.delete('/comments/:commentId', (0, validate_middleware_js_1.validate)(commentIdParamSchema), async (req, res, next) => {
    try {
        // Soft delete comment - would need implementation
        res.json({ message: 'Comment deleted' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// REAL-TIME EVENTS (for polling)
// ============================================================================
router.get('/realtime/events', (0, validate_middleware_js_1.validate)(zod_1.z.object({
    query: zod_1.z.object({
        case_id: zod_1.z.string().uuid().optional(),
        since: zod_1.z.coerce.date().optional(),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
    }),
})), async (req, res, next) => {
    try {
        // In production, this would query Redis pub/sub or a message queue
        // For now, return from MongoDB
        const mongoDb = await (await import('../config/database.js')).getMongoDb();
        const query = { timestamp: { $gte: req.query.since || new Date(Date.now() - 5 * 60 * 1000) } };
        if (req.query.case_id) {
            query.case_id = req.query.case_id;
        }
        const events = await mongoDb.collection('realtime_events')
            .find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(req.query.limit) || 50)
            .toArray();
        res.json({ events });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// HANDOFF PERMISSIONS
// ============================================================================
router.get('/handoffs/permissions/:caseId', (0, validate_middleware_js_1.validate)(caseIdParamSchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const permissions = await collaborationService.getHandoffPermissions(req.auth.sub, req.params.caseId, req.auth.role);
        res.json(permissions);
    }
    catch (error) {
        next(error);
    }
});
router.get('/activity-feed/permissions/:caseId', (0, validate_middleware_js_1.validate)(caseIdParamSchema), async (req, res, next) => {
    try {
        const collaborationService = (0, collaboration_service_js_1.getCollaborationService)();
        const permissions = await collaborationService.getActivityFeedPermissions(req.auth.sub, req.params.caseId, req.auth.role);
        res.json(permissions);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=collaboration.routes.js.map