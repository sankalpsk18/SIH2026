"use strict";
/**
 * ADALAT360 - Entity Graph Routes
 * REST API for entity relationship graphs and link analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const entity_graph_service_js_1 = require("../intelligence/entity-graph/entity-graph.service.js");
const auth_middleware_js_1 = require("../middleware/auth/auth.middleware.js");
const validate_middleware_js_1 = require("../middleware/validate.middleware.js");
const audit_service_js_1 = require("../services/audit.service.js");
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
const graphQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        entityTypes: zod_1.z.array(zod_1.z.enum(['PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'LEGAL_REFERENCE', 'DOCUMENT', 'EVIDENCE'])).optional(),
        minWeight: zod_1.z.coerce.number().int().positive().default(1),
        maxDepth: zod_1.z.coerce.number().int().positive().max(10).default(3),
        includeDocuments: zod_1.z.coerce.boolean().default(true),
        includeEvidence: zod_1.z.coerce.boolean().default(true),
    }),
});
const pathQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        source: zod_1.z.string().min(1),
        target: zod_1.z.string().min(1),
    }),
});
const centralEntitiesSchema = zod_1.z.object({
    query: zod_1.z.object({
        topN: zod_1.z.coerce.number().int().positive().max(50).default(10),
    }),
});
const communitiesSchema = zod_1.z.object({
    params: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
    }),
});
// ============================================================================
// BUILD ENTITY GRAPH
// ============================================================================
router.get('/case/:caseId', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, auth_middleware_js_1.userRateLimit)(20, 60000, 'entity_graph'), (0, validate_middleware_js_1.validate)(graphQuerySchema), async (req, res, next) => {
    try {
        const entityGraphService = (0, entity_graph_service_js_1.getEntityGraphService)();
        const { caseId } = req.params;
        const { entityTypes, minWeight, maxDepth, includeDocuments, includeEvidence } = req.query;
        const options = {
            caseId,
            entityTypes,
            minWeight,
            maxDepth,
            includeDocuments,
            includeEvidence,
        };
        const graph = await entityGraphService.buildGraph(options);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'ENTITY_GRAPH_QUERIED',
            event_category: 'ENTITY_GRAPH',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'query_entity_graph',
            outcome: 'SUCCESS',
            resource_type: 'CASE',
            resource_id: caseId,
            request_id: req.headers['x-request-id'],
            metadata: { options, nodes: graph.nodes.length, edges: graph.edges.length },
        });
        res.json(graph);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// FIND SHORTEST PATH BETWEEN ENTITIES
// ============================================================================
router.get('/case/:caseId/path', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, validate_middleware_js_1.validate)(pathQuerySchema), async (req, res, next) => {
    try {
        const entityGraphService = (0, entity_graph_service_js_1.getEntityGraphService)();
        const { caseId } = req.params;
        const { source, target } = req.query;
        const path = await entityGraphService.findShortestPath(caseId, source, target);
        if (!path) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'No path found between entities' });
            return;
        }
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'ENTITY_PATH_QUERIED',
            event_category: 'ENTITY_GRAPH',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'find_entity_path',
            outcome: 'SUCCESS',
            resource_type: 'CASE',
            resource_id: caseId,
            request_id: req.headers['x-request-id'],
            metadata: { source, target, path_length: path.length },
        });
        res.json({ path });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET CENTRAL ENTITIES (Degree Centrality)
// ============================================================================
router.get('/case/:caseId/central', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, validate_middleware_js_1.validate)(centralEntitiesSchema), async (req, res, next) => {
    try {
        const entityGraphService = (0, entity_graph_service_js_1.getEntityGraphService)();
        const { caseId } = req.params;
        const { topN } = req.query;
        const centralEntities = await entityGraphService.getCentralEntities(caseId, topN);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'CENTRAL_ENTITIES_QUERIED',
            event_category: 'ENTITY_GRAPH',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'query_central_entities',
            outcome: 'SUCCESS',
            resource_type: 'CASE',
            resource_id: caseId,
            request_id: req.headers['x-request-id'],
            metadata: { topN },
        });
        res.json({ centralEntities });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET COMMUNITIES
// ============================================================================
router.get('/case/:caseId/communities', (0, validate_middleware_js_1.validate)(communitiesSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), async (req, res, next) => {
    try {
        const entityGraphService = (0, entity_graph_service_js_1.getEntityGraphService)();
        const { caseId } = req.params;
        const communities = await entityGraphService.getCommunities(caseId);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'ENTITY_COMMUNITIES_QUERIED',
            event_category: 'ENTITY_GRAPH',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'query_entity_communities',
            outcome: 'SUCCESS',
            resource_type: 'CASE',
            resource_id: caseId,
            request_id: req.headers['x-request-id'],
            metadata: { community_count: communities.length },
        });
        res.json({ communities });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=entity-graph.routes.js.map