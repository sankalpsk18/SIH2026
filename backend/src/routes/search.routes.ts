/**
 * ADALAT360 - Search Routes
 * REST API for permission-filtered semantic and keyword search
 */

import { Router } from 'express';
import { z } from 'zod';
import { getSearchService } from '@intelligence/search/search.service.js';
import { authenticate, userRateLimit } from '@middleware/auth/auth.middleware.js';
import { validate } from '@middleware/validate.middleware.js';
import { logAuditEvent } from '@services/audit.service.js';
import { DocumentType, EvidenceType, UserRole } from '@types/database.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const searchQuerySchema = z.object({
    body: z.object({
        query: z.string().min(1).max(1000),
        caseId: z.string().uuid().optional(),
        documentTypes: z.array(z.nativeEnum(DocumentType)).optional(),
        evidenceTypes: z.array(z.nativeEnum(EvidenceType)).optional(),
        tags: z.array(z.string()).optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        authorIds: z.array(z.string().uuid()).optional(),
        entities: z.object({
            persons: z.array(z.string()).optional(),
            organizations: z.array(z.string()).optional(),
            locations: z.array(z.string()).optional(),
        }).optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        semanticSearch: z.boolean().default(false),
        highlight: z.boolean().default(true),
    }),
});

const suggestionsQuerySchema = z.object({
    query: z.object({
        q: z.string().min(1).max(100),
        caseId: z.string().uuid().optional(),
    }),
});

const reindexSchema = z.object({
    params: z.object({
        caseId: z.string().uuid(),
    }),
});

// ============================================================================
// SEARCH
// ============================================================================

router.post('/',
    userRateLimit(30, 60000, 'search'),
    validate(searchQuerySchema),
    async (req, res, next) => {
        try {
            const searchService = getSearchService();

            // Get user's accessible case IDs
            const userCaseIds = req.auth!.role === 'CENTRAL_ADMIN' || req.auth!.role === 'AUDITOR'
                ? [] // Will be handled by search service
                : req.auth!.case_ids;

            const result = await searchService.search(
                req.body,
                req.auth!.sub,
                req.auth!.role,
                userCaseIds
            );

            // Audit log
            await logAuditEvent({
                event_type: 'SEARCH_PERFORMED',
                event_category: 'SEARCH',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'search',
                outcome: 'SUCCESS',
                request_id: req.headers['x-request-id'] as string,
                metadata: {
                    query: req.body.query,
                    case_id: req.body.caseId,
                    semantic: req.body.semanticSearch,
                    results_count: result.results.length,
                    took_ms: result.tookMs,
                },
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// SEARCH SUGGESTIONS
// ============================================================================

router.get('/suggestions',
    validate(suggestionsQuerySchema),
    async (req, res, next) => {
        try {
            const { q, caseId } = req.query as any;
            const searchService = getSearchService();

            const userCaseIds = req.auth!.role === 'CENTRAL_ADMIN' || req.auth!.role === 'AUDITOR'
                ? []
                : req.auth!.case_ids;

            // Filter caseId if provided
            let accessibleCaseIds = userCaseIds;
            if (caseId && userCaseIds.includes(caseId)) {
                accessibleCaseIds = [caseId];
            } else if (caseId && !userCaseIds.includes(caseId) && req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this case' });
                return;
            }

            const suggestions = await searchService['getSuggestions'](q, accessibleCaseIds);
            res.json({ suggestions });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// REINDEX CASE (Admin only)
// ============================================================================

router.post('/reindex/:caseId',
    validate(reindexSchema),
    authenticate,
    async (req, res, next) => {
        try {
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
                return;
            }

            const { caseId } = req.params;
            const searchService = getSearchService();

            await searchService.reindexCase(caseId);

            await logAuditEvent({
                event_type: 'SEARCH_REINDEX',
                event_category: 'SEARCH',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'reindex_case',
                outcome: 'SUCCESS',
                resource_type: 'CASE',
                resource_id: caseId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json({ message: 'Case reindexed successfully' });
        } catch (error) {
            next(error);
        }
    }
);

export default router;