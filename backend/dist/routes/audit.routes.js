"use strict";
/**
 * ADALAT360 - Audit Routes
 * REST API for audit logs and compliance reporting
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const audit_service_js_1 = require("../services/audit.service.js");
const auth_middleware_js_1 = require("../middleware/auth/auth.middleware.js");
const validate_middleware_js_1 = require("../middleware/validate.middleware.js");
const database_js_1 = require("../types/database.js");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_js_1.authenticate);
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
const auditQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        user_id: zod_1.z.string().uuid().optional(),
        event_type: zod_1.z.string().optional(),
        event_category: zod_1.z.string().optional(),
        resource_type: zod_1.z.string().optional(),
        resource_id: zod_1.z.string().uuid().optional(),
        action: zod_1.z.string().optional(),
        outcome: zod_1.z.enum(['SUCCESS', 'FAILURE', 'PARTIAL', 'DENIED', 'ERROR']).optional(),
        severity: zod_1.z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional(),
        start_date: zod_1.z.coerce.date().optional(),
        end_date: zod_1.z.coerce.date().optional(),
        correlation_id: zod_1.z.string().optional(),
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(1000).default(50),
    }),
});
const complianceReportSchema = zod_1.z.object({
    body: zod_1.z.object({
        start_date: zod_1.z.coerce.date(),
        end_date: zod_1.z.coerce.date(),
        user_ids: zod_1.z.array(zod_1.z.string().uuid()).optional(),
        event_categories: zod_1.z.array(zod_1.z.string()).optional(),
        severities: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
const exportAuditSchema = zod_1.z.object({
    query: zod_1.z.object({
        start_date: zod_1.z.coerce.date(),
        end_date: zod_1.z.coerce.date(),
        format: zod_1.z.enum(['json', 'csv']).default('json'),
        user_id: zod_1.z.string().uuid().optional(),
        event_type: zod_1.z.string().optional(),
        resource_type: zod_1.z.string().optional(),
        outcome: zod_1.z.enum(['SUCCESS', 'FAILURE', 'PARTIAL', 'DENIED', 'ERROR']).optional(),
    }),
});
const eventIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        eventId: zod_1.z.string().min(1),
    }),
});
const rtiAuditSchema = zod_1.z.object({
    params: zod_1.z.object({
        requestNumber: zod_1.z.string().min(1),
    }),
});
// ============================================================================
// QUERY AUDIT LOGS
// ============================================================================
router.get('/', (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.CENTRAL_ADMIN, database_js_1.UserRole.AUDITOR), (0, auth_middleware_js_1.userRateLimit)(30, 60000, 'audit_query'), (0, validate_middleware_js_1.validate)(auditQuerySchema), async (req, res, next) => {
    try {
        const auditService = (0, audit_service_js_1.getAuditService)();
        const result = await auditService.queryAuditLogs(req.query);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'AUDIT_QUERY',
            event_category: 'AUDIT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'query_audit_logs',
            outcome: 'SUCCESS',
            request_id: req.headers['x-request-id'],
            metadata: {
                filters: req.query,
                results_count: result.events.length,
            },
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET AUDIT EVENT BY ID
// ============================================================================
router.get('/events/:eventId', (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.CENTRAL_ADMIN, database_js_1.UserRole.AUDITOR), (0, validate_middleware_js_1.validate)(eventIdParamSchema), async (req, res, next) => {
    try {
        const auditService = (0, audit_service_js_1.getAuditService)();
        const event = await auditService.getAuditLogById(req.params.eventId);
        if (!event) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Audit event not found' });
            return;
        }
        res.json(event);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// USER AUDIT TRAIL
// ============================================================================
router.get('/user/:userId', (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.CENTRAL_ADMIN, database_js_1.UserRole.AUDITOR), (0, validate_middleware_js_1.validate)(zod_1.z.object({ params: zod_1.z.object({ userId: zod_1.z.string().uuid() }), query: zod_1.z.object({ limit: zod_1.z.coerce.number().int().positive().max(500).default(50) }) })), async (req, res, next) => {
    try {
        const auditService = (0, audit_service_js_1.getAuditService)();
        const events = await auditService.getUserAuditTrail(req.params.userId, req.query.limit);
        res.json(events);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// RESOURCE AUDIT TRAIL
// ============================================================================
router.get('/resource/:resourceType/:resourceId', (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.CENTRAL_ADMIN, database_js_1.UserRole.AUDITOR), (0, validate_middleware_js_1.validate)(zod_1.z.object({ params: zod_1.z.object({ resourceType: zod_1.z.string(), resourceId: zod_1.z.string().uuid() }), query: zod_1.z.object({ limit: zod_1.z.coerce.number().int().positive().max(500).default(50) }) })), async (req, res, next) => {
    try {
        const auditService = (0, audit_service_js_1.getAuditService)();
        const events = await auditService.getResourceAuditTrail(req.params.resourceType, req.params.resourceId, req.query.limit);
        res.json(events);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// COMPLIANCE REPORT
// ============================================================================
router.post('/compliance-report', (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.CENTRAL_ADMIN, database_js_1.UserRole.AUDITOR), (0, validate_middleware_js_1.validate)(complianceReportSchema), async (req, res, next) => {
    try {
        const auditService = (0, audit_service_js_1.getAuditService)();
        const report = await auditService.generateComplianceReport(req.body);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'COMPLIANCE_REPORT_GENERATED',
            event_category: 'AUDIT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'generate_compliance_report',
            outcome: 'SUCCESS',
            request_id: req.headers['x-request-id'],
            metadata: {
                period: { start: req.body.start_date, end: req.body.end_date },
                total_events: report.summary.total_events,
            },
        });
        res.json(report);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// EXPORT AUDIT LOGS
// ============================================================================
router.get('/export', (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.CENTRAL_ADMIN, database_js_1.UserRole.AUDITOR), (0, validate_middleware_js_1.validate)(exportAuditSchema), async (req, res, next) => {
    try {
        const auditService = (0, audit_service_js_1.getAuditService)();
        const data = await auditService.exportAuditLogs({
            start_date: req.query.start_date,
            end_date: req.query.end_date,
            format: req.query.format,
            filters: req.query,
        });
        const format = req.query.format || 'json';
        const filename = `audit-export-${new Date().toISOString().split('T')[0]}.${format}`;
        res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(data);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// RTI AUDIT TRAIL
// ============================================================================
router.get('/rti/:requestNumber', (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.CENTRAL_ADMIN, database_js_1.UserRole.AUDITOR), (0, validate_middleware_js_1.validate)(rtiAuditSchema), async (req, res, next) => {
    try {
        const auditService = (0, audit_service_js_1.getAuditService)();
        const events = await auditService.getRtiAuditTrail(req.params.requestNumber);
        res.json(events);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CLEANUP OLD LOGS (Admin only)
// ============================================================================
router.post('/cleanup', (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.CENTRAL_ADMIN), async (req, res, next) => {
    try {
        const { retentionDays = 2555 } = req.body; // 7 years default
        const auditService = (0, audit_service_js_1.getAuditService)();
        const deleted = await auditService.cleanupOldAuditLogs(retentionDays);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'AUDIT_CLEANUP',
            event_category: 'AUDIT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'cleanup_old_logs',
            outcome: 'SUCCESS',
            request_id: req.headers['x-request-id'],
            metadata: { deleted_count: deleted, retention_days: retentionDays },
        });
        res.json({ message: `Cleaned up ${deleted} old audit log entries`, deleted });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=audit.routes.js.map