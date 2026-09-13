/**
 * ADALAT360 - Timeline Routes
 * REST API for case timeline reconstruction
 */

import { Router } from 'express';
import { z } from 'zod';
import { getTimelineService } from '../intelligence/timeline/timeline.service.js';
import { authenticate, requireCaseAccess, userRateLimit } from '../middleware/auth/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { logAuditEvent } from '../services/audit.service.js';
import { CustodyAction } from '../types/database.js';

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

const timelineQuerySchema = z.object({
    query: z.object({
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        eventTypes: z.array(z.nativeEnum(CustodyAction)).optional(),
        actorIds: z.array(z.string().uuid()).optional(),
        resourceIds: z.array(z.string().uuid()).optional(),
        includeBlockchain: z.coerce.boolean().default(true),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(500).default(100),
    }),
});

const exportSchema = z.object({
    query: z.object({
        format: z.enum(['json', 'csv']).default('json'),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
    }),
});

const analyticsSchema = z.object({
    params: z.object({
        caseId: z.string().uuid(),
    }),
});

// ============================================================================
// GET CASE TIMELINE
// ============================================================================

router.get('/case/:caseId',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    userRateLimit(30, 60000, 'timeline_query'),
    validate(timelineQuerySchema),
    async (req, res, next) => {
        try {
            const timelineService = getTimelineService();
            const { caseId } = req.params;
            const { startDate, endDate, eventTypes, actorIds, resourceIds, includeBlockchain, page, limit } = req.query as any;
            const offset = (page - 1) * limit;

            const filter = {
                caseId,
                startDate,
                endDate,
                eventTypes,
                actorIds,
                resourceIds,
                includeBlockchain,
            };

            const result = await timelineService.getTimeline(filter, req.auth!.sub, req.auth!.role);

            // Apply pagination
            const paginatedEvents = result.events.slice(offset, offset + limit);

            await logAuditEvent({
                event_type: 'TIMELINE_QUERIED',
                event_category: 'TIMELINE',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'query_timeline',
                outcome: 'SUCCESS',
                resource_type: 'CASE',
                resource_id: caseId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { filter, results_count: result.events.length },
            });

            res.json({
                events: paginatedEvents,
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit),
                dateRange: result.dateRange,
                statistics: result.statistics,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// EXPORT TIMELINE
// ============================================================================

router.get('/case/:caseId/export',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    validate(exportSchema),
    async (req, res, next) => {
        try {
            const timelineService = getTimelineService();
            const { caseId } = req.params;
            const { format, startDate, endDate } = req.query as any;

            const filter = {
                caseId,
                startDate,
                endDate,
                includeBlockchain: true,
            };

            const data = await timelineService.exportTimeline(filter, format);

            const filename = `timeline-${caseId}-${new Date().toISOString().split('T')[0]}.${format}`;

            res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(data);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET CASE ANALYTICS
// ============================================================================

router.get('/case/:caseId/analytics',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    validate(analyticsSchema),
    async (req, res, next) => {
        try {
            const timelineService = getTimelineService();
            const analytics = await timelineService.getCaseAnalytics(req.params.caseId, req.auth!.sub, req.auth!.role);

            await logAuditEvent({
                event_type: 'CASE_ANALYTICS_QUERIED',
                event_category: 'ANALYTICS',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'query_case_analytics',
                outcome: 'SUCCESS',
                resource_type: 'CASE',
                resource_id: req.params.caseId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json(analytics);
        } catch (error) {
            next(error);
        }
    }
);

export default router;