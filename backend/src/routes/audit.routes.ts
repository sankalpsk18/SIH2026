/**
 * ADALAT360 - Audit Routes
 * REST API for audit logs and compliance reporting
 */

import { Router } from 'express';
import { z } from 'zod';
import { pgQuery } from '@config/database.js';
import { getAuditService, logAuditEvent } from '@services/audit.service.js';
import { authenticate, requireRole, userRateLimit } from '@middleware/auth/auth.middleware.js';
import { validate } from '@middleware/validate.middleware.js';
import { UserRole } from '@types/database.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const auditQuerySchema = z.object({
    query: z.object({
        user_id: z.string().uuid().optional(),
        event_type: z.string().optional(),
        event_category: z.string().optional(),
        resource_type: z.string().optional(),
        resource_id: z.string().uuid().optional(),
        action: z.string().optional(),
        outcome: z.enum(['SUCCESS', 'FAILURE', 'PARTIAL', 'DENIED', 'ERROR']).optional(),
        severity: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional(),
        start_date: z.coerce.date().optional(),
        end_date: z.coerce.date().optional(),
        correlation_id: z.string().optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(1000).default(50),
    }),
});

const complianceReportSchema = z.object({
    body: z.object({
        start_date: z.coerce.date(),
        end_date: z.coerce.date(),
        user_ids: z.array(z.string().uuid()).optional(),
        event_categories: z.array(z.string()).optional(),
        severities: z.array(z.string()).optional(),
    }),
});

const exportAuditSchema = z.object({
    query: z.object({
        start_date: z.coerce.date(),
        end_date: z.coerce.date(),
        format: z.enum(['json', 'csv']).default('json'),
        user_id: z.string().uuid().optional(),
        event_type: z.string().optional(),
        resource_type: z.string().optional(),
        outcome: z.enum(['SUCCESS', 'FAILURE', 'PARTIAL', 'DENIED', 'ERROR']).optional(),
    }),
});

const eventIdParamSchema = z.object({
    params: z.object({
        eventId: z.string().min(1),
    }),
});

const rtiAuditSchema = z.object({
    params: z.object({
        requestNumber: z.string().min(1),
    }),
});

// ============================================================================
// QUERY AUDIT LOGS
// ============================================================================

router.get('/',
    requireRole(UserRole.CENTRAL_ADMIN, UserRole.AUDITOR),
    userRateLimit(30, 60000, 'audit_query'),
    validate(auditQuerySchema),
    async (req, res, next) => {
        try {
            const auditService = getAuditService();
            const result = await auditService.queryAuditLogs(req.query as any);

            await logAuditEvent({
                event_type: 'AUDIT_QUERY',
                event_category: 'AUDIT',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'query_audit_logs',
                outcome: 'SUCCESS',
                request_id: req.headers['x-request-id'] as string,
                metadata: {
                    filters: req.query,
                    results_count: result.events.length,
                },
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET AUDIT EVENT BY ID
// ============================================================================

router.get('/events/:eventId',
    requireRole(UserRole.CENTRAL_ADMIN, UserRole.AUDITOR),
    validate(eventIdParamSchema),
    async (req, res, next) => {
        try {
            const auditService = getAuditService();
            const event = await auditService.getAuditLogById(req.params.eventId);

            if (!event) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Audit event not found' });
                return;
            }

            res.json(event);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// USER AUDIT TRAIL
// ============================================================================

router.get('/user/:userId',
    requireRole(UserRole.CENTRAL_ADMIN, UserRole.AUDITOR),
    validate(z.object({ params: z.object({ userId: z.string().uuid() }), query: z.object({ limit: z.coerce.number().int().positive().max(500).default(50) }) })),
    async (req, res, next) => {
        try {
            const auditService = getAuditService();
            const events = await auditService.getUserAuditTrail(req.params.userId, req.query.limit as number);
            res.json(events);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// RESOURCE AUDIT TRAIL
// ============================================================================

router.get('/resource/:resourceType/:resourceId',
    requireRole(UserRole.CENTRAL_ADMIN, UserRole.AUDITOR),
    validate(z.object({ params: z.object({ resourceType: z.string(), resourceId: z.string().uuid() }), query: z.object({ limit: z.coerce.number().int().positive().max(500).default(50) }) })),
    async (req, res, next) => {
        try {
            const auditService = getAuditService();
            const events = await auditService.getResourceAuditTrail(req.params.resourceType, req.params.resourceId, req.query.limit as number);
            res.json(events);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// COMPLIANCE REPORT
// ============================================================================

router.post('/compliance-report',
    requireRole(UserRole.CENTRAL_ADMIN, UserRole.AUDITOR),
    validate(complianceReportSchema),
    async (req, res, next) => {
        try {
            const auditService = getAuditService();
            const report = await auditService.generateComplianceReport(req.body);

            await logAuditEvent({
                event_type: 'COMPLIANCE_REPORT_GENERATED',
                event_category: 'AUDIT',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'generate_compliance_report',
                outcome: 'SUCCESS',
                request_id: req.headers['x-request-id'] as string,
                metadata: {
                    period: { start: req.body.start_date, end: req.body.end_date },
                    total_events: report.summary.total_events,
                },
            });

            res.json(report);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// EXPORT AUDIT LOGS
// ============================================================================

router.get('/export',
    requireRole(UserRole.CENTRAL_ADMIN, UserRole.AUDITOR),
    validate(exportAuditSchema),
    async (req, res, next) => {
        try {
            const auditService = getAuditService();
            const data = await auditService.exportAuditLogs({
                start_date: req.query.start_date as any,
                end_date: req.query.end_date as any,
                format: req.query.format as any,
                filters: req.query as any,
            });

            const format = req.query.format || 'json';
            const filename = `audit-export-${new Date().toISOString().split('T')[0]}.${format}`;

            res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(data);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// RTI AUDIT TRAIL
// ============================================================================

router.get('/rti/:requestNumber',
    requireRole(UserRole.CENTRAL_ADMIN, UserRole.AUDITOR),
    validate(rtiAuditSchema),
    async (req, res, next) => {
        try {
            const auditService = getAuditService();
            const events = await auditService.getRtiAuditTrail(req.params.requestNumber);
            res.json(events);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// CLEANUP OLD LOGS (Admin only)
// ============================================================================

router.post('/cleanup',
    requireRole(UserRole.CENTRAL_ADMIN),
    async (req, res, next) => {
        try {
            const { retentionDays = 2555 } = req.body; // 7 years default
            const auditService = getAuditService();
            const deleted = await auditService.cleanupOldAuditLogs(retentionDays);

            await logAuditEvent({
                event_type: 'AUDIT_CLEANUP',
                event_category: 'AUDIT',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'cleanup_old_logs',
                outcome: 'SUCCESS',
                request_id: req.headers['x-request-id'] as string,
                metadata: { deleted_count: deleted, retention_days: retentionDays },
            });

            res.json({ message: `Cleaned up ${deleted} old audit log entries`, deleted });
        } catch (error) {
            next(error);
        }
    }
);

export default router;