"use strict";
/**
 * ADALAT360 - Search Routes
 * REST API for permission-filtered semantic and keyword search
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const search_service_js_1 = require("../intelligence/search/search.service.js");
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
const searchQuerySchema = zod_1.z.object({
    body: zod_1.z.object({
        query: zod_1.z.string().min(1).max(1000),
        caseId: zod_1.z.string().uuid().optional(),
        documentTypes: zod_1.z.array(zod_1.z.nativeEnum(database_js_1.DocumentType)).optional(),
        evidenceTypes: zod_1.z.array(zod_1.z.nativeEnum(database_js_1.EvidenceType)).optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        dateFrom: zod_1.z.coerce.date().optional(),
        dateTo: zod_1.z.coerce.date().optional(),
        authorIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
        entities: zod_1.z.object({
            persons: zod_1.z.array(zod_1.z.string()).optional(),
            organizations: zod_1.z.array(zod_1.z.string()).optional(),
            locations: zod_1.z.array(zod_1.z.string()).optional(),
        }).optional(),
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
        semanticSearch: zod_1.z.boolean().default(false),
        highlight: zod_1.z.boolean().default(true),
    }),
});
const suggestionsQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        q: zod_1.z.string().min(1).max(100),
        caseId: zod_1.z.string().uuid().optional(),
    }),
});
const reindexSchema = zod_1.z.object({
    params: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
    }),
});
// ============================================================================
// SEARCH
// ============================================================================
router.post('/', (0, auth_middleware_js_1.userRateLimit)(30, 60000, 'search'), (0, validate_middleware_js_1.validate)(searchQuerySchema), async (req, res, next) => {
    try {
        const searchService = (0, search_service_js_1.getSearchService)();
        // Get user's accessible case IDs
        const userCaseIds = req.auth.role === 'CENTRAL_ADMIN' || req.auth.role === 'AUDITOR'
            ? [] // Will be handled by search service
            : req.auth.case_ids;
        const result = await searchService.search(req.body, req.auth.sub, req.auth.role, userCaseIds);
        // Audit log
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'SEARCH_PERFORMED',
            event_category: 'SEARCH',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'search',
            outcome: 'SUCCESS',
            request_id: req.headers['x-request-id'],
            metadata: {
                query: req.body.query,
                case_id: req.body.caseId,
                semantic: req.body.semanticSearch,
                results_count: result.results.length,
                took_ms: result.tookMs,
            },
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// SEARCH SUGGESTIONS
// ============================================================================
router.get('/suggestions', (0, validate_middleware_js_1.validate)(suggestionsQuerySchema), async (req, res, next) => {
    try {
        const { q, caseId } = req.query;
        const searchService = (0, search_service_js_1.getSearchService)();
        const userCaseIds = req.auth.role === 'CENTRAL_ADMIN' || req.auth.role === 'AUDITOR'
            ? []
            : req.auth.case_ids;
        // Filter caseId if provided
        let accessibleCaseIds = userCaseIds;
        if (caseId && userCaseIds.includes(caseId)) {
            accessibleCaseIds = [caseId];
        }
        else if (caseId && !userCaseIds.includes(caseId) && req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this case' });
            return;
        }
        const suggestions = await searchService['getSuggestions'](q, accessibleCaseIds);
        res.json({ suggestions });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// REINDEX CASE (Admin only)
// ============================================================================
router.post('/reindex/:caseId', (0, validate_middleware_js_1.validate)(reindexSchema), auth_middleware_js_1.authenticate, async (req, res, next) => {
    try {
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
            return;
        }
        const { caseId } = req.params;
        const searchService = (0, search_service_js_1.getSearchService)();
        await searchService.reindexCase(caseId);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'SEARCH_REINDEX',
            event_category: 'SEARCH',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'reindex_case',
            outcome: 'SUCCESS',
            resource_type: 'CASE',
            resource_id: caseId,
            request_id: req.headers['x-request-id'],
        });
        res.json({ message: 'Case reindexed successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=search.routes.js.map