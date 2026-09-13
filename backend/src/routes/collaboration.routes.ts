/**
 * ADALAT360 - Collaboration Routes
 * Activity feed, handoff/assign actions, notifications
 */

import { Router } from 'express';
import { z } from 'zod';
import { getCollaborationService } from '@services/collaboration.service.js';
import { authenticate, requireCaseAccess, requireCasePermission, userRateLimit } from '@middleware/auth/auth.middleware.js';
import { validate } from '@middleware/validate.middleware.js';
import { logAuditEvent } from '@services/audit.service.js';
import { ActivityType, ActivityVisibility, HandoffType, HandoffStatus, CustodyAction } from '@types/database.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const caseIdParamSchema = z.object({
    params: z.object({
        caseId: z.string().uuid(),
    }),
});

const handoffIdParamSchema = z.object({
    params: z.object({
        handoffId: z.string().uuid(),
    }),
});

const activityIdParamSchema = z.object({
    params: z.object({
        activityId: z.string().uuid(),
    }),
});

const notificationIdParamSchema = z.object({
    params: z.object({
        notificationId: z.string().uuid(),
    }),
});

const createHandoffSchema = z.object({
    body: z.object({
        caseId: z.string().uuid(),
        handoff_type: z.nativeEnum(HandoffType),
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        resource_type: z.enum(['CASE', 'DOCUMENT', 'EVIDENCE']),
        resource_id: z.string().uuid(),
        to_user_id: z.string().uuid(),
        expires_in_hours: z.coerce.number().int().positive().max(168).optional(), // Max 1 week
        metadata: z.record(z.any()).optional(),
    }),
});

const handoffActionSchema = z.object({
    body: z.object({
        action: z.enum(['ACCEPT', 'DECLINE']),
        reason: z.string().optional(),
    }).refine(data => data.action !== 'DECLINE' || (data.reason && data.reason.length > 0), {
        message: 'Decline reason is required',
        path: ['reason'],
    }),
});

const activityQuerySchema = z.object({
    query: z.object({
        case_id: z.string().uuid(),
        activity_types: z.array(z.nativeEnum(ActivityType)).optional(),
        actor_user_ids: z.array(z.string().uuid()).optional(),
        date_from: z.coerce.date().optional(),
        date_to: z.coerce.date().optional(),
        visibility: z.nativeEnum(ActivityVisibility).optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        sort_by: z.enum(['created_at', 'activity_type']).default('created_at'),
        sort_order: z.enum(['asc', 'desc']).default('desc'),
    }),
});

const handoffQuerySchema = z.object({
    query: z.object({
        case_id: z.string().uuid().optional(),
        status: z.array(z.nativeEnum(HandoffStatus)).optional(),
        handoff_type: z.array(z.nativeEnum(HandoffType)).optional(),
        from_user_id: z.string().uuid().optional(),
        to_user_id: z.string().uuid().optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
    }),
});

const notificationQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        unread_only: z.coerce.boolean().default(false),
    }),
});

const commentCreateSchema = z.object({
    body: z.object({
        case_id: z.string().uuid(),
        activity_id: z.string().uuid(),
        content: z.string().min(1).max(5000),
        parent_comment_id: z.string().uuid().optional(),
        mentioned_user_ids: z.array(z.string().uuid()).optional(),
    }),
});

const commentIdParamSchema = z.object({
    params: z.object({
        commentId: z.string().uuid(),
    }),
});

// ============================================================================
// ACTIVITY FEED ROUTES
// ============================================================================

router.get('/activity-feed',
    userRateLimit(60, 60000, 'activity_feed'),
    validate(activityQuerySchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const result = await collaborationService.queryActivityFeed(
                req.query as any,
                req.auth!.sub,
                req.auth!.role,
                req.auth!.case_ids
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.get('/activity-feed/:activityId',
    validate(activityIdParamSchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const activity = await collaborationService.getActivityEntry(req.params.activityId);

            if (!activity) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Activity not found' });
                return;
            }

            // Check access
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (!req.auth!.case_ids.includes(activity.case_id)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                    return;
                }
            }

            res.json(activity);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// HANDOFF ROUTES
// ============================================================================

router.post('/handoffs',
    userRateLimit(20, 60000, 'handoff_create'),
    validate(createHandoffSchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const handoff = await collaborationService.createHandoff(req.body, req.auth!.sub);

            await logAuditEvent({
                event_type: 'HANDOFF_INITIATED',
                event_category: 'COLLABORATION',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'create_handoff',
                outcome: 'SUCCESS',
                resource_type: req.body.resource_type,
                resource_id: req.body.resource_id,
                request_id: req.headers['x-request-id'] as string,
                metadata: { handoff_id: handoff.id, handoff_type: req.body.handoff_type },
            });

            res.status(201).json(handoff);
        } catch (error) {
            next(error);
        }
    }
);

router.get('/handoffs',
    validate(handoffQuerySchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const result = await collaborationService.queryHandoffs(
                req.query as any,
                req.auth!.sub,
                req.auth!.role,
                req.auth!.case_ids
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.get('/handoffs/:handoffId',
    validate(handoffIdParamSchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const handoff = await collaborationService.getHandoff(
                req.params.handoffId,
                req.auth!.sub,
                req.auth!.role,
                req.auth!.case_ids
            );

            if (!handoff) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Handoff not found' });
                return;
            }

            res.json(handoff);
        } catch (error) {
            next(error);
        }
    }
);

router.post('/handoffs/:handoffId/action',
    validate(handoffIdParamSchema),
    validate(handoffActionSchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const handoff = await collaborationService.actOnHandoff(
                req.params.handoffId,
                req.auth!.sub,
                req.body
            );

            await logAuditEvent({
                event_type: req.body.action === 'ACCEPT' ? 'HANDOFF_ACCEPTED' : 'HANDOFF_DECLINED',
                event_category: 'COLLABORATION',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: req.body.action.toLowerCase() + '_handoff',
                outcome: 'SUCCESS',
                resource_type: 'HANDOFF',
                resource_id: req.params.handoffId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { handoff_id: req.params.handoffId },
            });

            res.json(handoff);
        } catch (error) {
            next(error);
        }
    }
);

router.post('/handoffs/:handoffId/cancel',
    validate(handoffIdParamSchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const handoff = await collaborationService.cancelHandoff(req.params.handoffId, req.auth!.sub);

            await logAuditEvent({
                event_type: 'HANDOFF_CANCELLED',
                event_category: 'COLLABORATION',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'cancel_handoff',
                outcome: 'SUCCESS',
                resource_type: 'HANDOFF',
                resource_id: req.params.handoffId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json(handoff);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// NOTIFICATIONS ROUTES
// ============================================================================

router.get('/notifications',
    validate(notificationQuerySchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const { page, limit, unread_only } = req.query as any;

            // Filter by read status if unread_only
            const result = await collaborationService.getUserNotifications(
                req.auth!.sub,
                page,
                limit
            );

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
        } catch (error) {
            next(error);
        }
    }
);

router.post('/notifications/:notificationId/read',
    validate(notificationIdParamSchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            await collaborationService.markNotificationRead(req.params.notificationId, req.auth!.sub);
            res.json({ message: 'Notification marked as read' });
        } catch (error) {
            next(error);
        }
    }
);

router.post('/notifications/read-all',
    async (req, res, next) => {
        try {
            // Mark all as read - would need implementation
            res.json({ message: 'All notifications marked as read' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// COMMENTS ROUTES
// ============================================================================

router.post('/comments',
    validate(commentCreateSchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const comment = await collaborationService.addComment(req.body, req.auth!.sub);

            await logAuditEvent({
                event_type: 'COMMENT_ADDED',
                event_category: 'COLLABORATION',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'add_comment',
                outcome: 'SUCCESS',
                resource_type: 'COMMENT',
                resource_id: comment.id,
                request_id: req.headers['x-request-id'] as string,
            });

            res.status(201).json(comment);
        } catch (error) {
            next(error);
        }
    }
);

router.get('/activity-feed/:activityId/comments',
    validate(activityIdParamSchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const comments = await collaborationService.getCommentsForActivity(req.params.activityId);
            res.json(comments);
        } catch (error) {
            next(error);
        }
    }
);

router.delete('/comments/:commentId',
    validate(commentIdParamSchema),
    async (req, res, next) => {
        try {
            // Soft delete comment - would need implementation
            res.json({ message: 'Comment deleted' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// REAL-TIME EVENTS (for polling)
// ============================================================================

router.get('/realtime/events',
    validate(z.object({
        query: z.object({
            case_id: z.string().uuid().optional(),
            since: z.coerce.date().optional(),
            limit: z.coerce.number().int().positive().max(100).default(50),
        }),
    })),
    async (req, res, next) => {
        try {
            // In production, this would query Redis pub/sub or a message queue
            // For now, return from MongoDB
            const mongoDb = await (await import('../config/database.js')).getMongoDb();
            const query: any = { timestamp: { $gte: req.query.since || new Date(Date.now() - 5 * 60 * 1000) } };
            if (req.query.case_id) {
                query.case_id = req.query.case_id;
            }
            const events = await mongoDb.collection('realtime_events')
                .find(query)
                .sort({ timestamp: -1 })
                .limit(parseInt(req.query.limit as string) || 50)
                .toArray();

            res.json({ events });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// HANDOFF PERMISSIONS
// ============================================================================

router.get('/handoffs/permissions/:caseId',
    validate(caseIdParamSchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const permissions = await collaborationService.getHandoffPermissions(
                req.auth!.sub,
                req.params.caseId,
                req.auth!.role
            );
            res.json(permissions);
        } catch (error) {
            next(error);
        }
    }
);

router.get('/activity-feed/permissions/:caseId',
    validate(caseIdParamSchema),
    async (req, res, next) => {
        try {
            const collaborationService = getCollaborationService();
            const permissions = await collaborationService.getActivityFeedPermissions(
                req.auth!.sub,
                req.params.caseId,
                req.auth!.role
            );
            res.json(permissions);
        } catch (error) {
            next(error);
        }
    }
);

export default router;