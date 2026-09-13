"use strict";
/**
 * ADALAT360 - Timeline Routes
 * REST API for case timeline reconstruction
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const timeline_service_js_1 = require("../intelligence/timeline/timeline.service.js");
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
const timelineQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        startDate: zod_1.z.coerce.date().optional(),
        endDate: zod_1.z.coerce.date().optional(),
        eventTypes: zod_1.z.array(zod_1.z.nativeEnum(database_js_1.CustodyAction)).optional(),
        actorIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
        resourceIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
        includeBlockchain: zod_1.z.coerce.boolean().default(true),
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(500).default(100),
    }),
});
const exportSchema = zod_1.z.object({
    query: zod_1.z.object({
        format: zod_1.z.enum(['json', 'csv']).default('json'),
        startDate: zod_1.z.coerce.date().optional(),
        endDate: zod_1.z.coerce.date().optional(),
    }),
});
const analyticsSchema = zod_1.z.object({
    params: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
    }),
});
// ============================================================================
// GET CASE TIMELINE
// ============================================================================
router.get('/case/:caseId', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, auth_middleware_js_1.userRateLimit)(30, 60000, 'timeline_query'), (0, validate_middleware_js_1.validate)(timelineQuerySchema), async (req, res, next) => {
    try {
        const timelineService = (0, timeline_service_js_1.getTimelineService)();
        const { caseId } = req.params;
        const { startDate, endDate, eventTypes, actorIds, resourceIds, includeBlockchain, page, limit } = req.query;
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
        const result = await timelineService.getTimeline(filter, req.auth.sub, req.auth.role);
        // Apply pagination
        const paginatedEvents = result.events.slice(offset, offset + limit);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'TIMELINE_QUERIED',
            event_category: 'TIMELINE',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'query_timeline',
            outcome: 'SUCCESS',
            resource_type: 'CASE',
            resource_id: caseId,
            request_id: req.headers['x-request-id'],
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
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// EXPORT TIMELINE
// ============================================================================
router.get('/case/:caseId/export', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, validate_middleware_js_1.validate)(exportSchema), async (req, res, next) => {
    try {
        const timelineService = (0, timeline_service_js_1.getTimelineService)();
        const { caseId } = req.params;
        const { format, startDate, endDate } = req.query;
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
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET CASE ANALYTICS
// ============================================================================
router.get('/case/:caseId/analytics', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, validate_middleware_js_1.validate)(analyticsSchema), async (req, res, next) => {
    try {
        const timelineService = (0, timeline_service_js_1.getTimelineService)();
        const analytics = await timelineService.getCaseAnalytics(req.params.caseId, req.auth.sub, req.auth.role);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'CASE_ANALYTICS_QUERIED',
            event_category: 'ANALYTICS',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'query_case_analytics',
            outcome: 'SUCCESS',
            resource_type: 'CASE',
            resource_id: req.params.caseId,
            request_id: req.headers['x-request-id'],
        });
        res.json(analytics);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=timeline.routes.js.map