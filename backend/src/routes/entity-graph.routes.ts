/**
 * ADALAT360 - Entity Graph Routes
 * REST API for entity relationship graphs and link analysis
 */

import { Router } from 'express';
import { z } from 'zod';
import { getEntityGraphService } from '../intelligence/entity-graph/entity-graph.service.js';
import { authenticate, requireCaseAccess, userRateLimit } from '../middleware/auth/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { logAuditEvent } from '../services/audit.service.js';

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

const graphQuerySchema = z.object({
    query: z.object({
        entityTypes: z.array(z.enum(['PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'LEGAL_REFERENCE', 'DOCUMENT', 'EVIDENCE'])).optional(),
        minWeight: z.coerce.number().int().positive().default(1),
        maxDepth: z.coerce.number().int().positive().max(10).default(3),
        includeDocuments: z.coerce.boolean().default(true),
        includeEvidence: z.coerce.boolean().default(true),
    }),
});

const pathQuerySchema = z.object({
    query: z.object({
        source: z.string().min(1),
        target: z.string().min(1),
    }),
});

const centralEntitiesSchema = z.object({
    query: z.object({
        topN: z.coerce.number().int().positive().max(50).default(10),
    }),
});

const communitiesSchema = z.object({
    params: z.object({
        caseId: z.string().uuid(),
    }),
});

// ============================================================================
// BUILD ENTITY GRAPH
// ============================================================================

router.get('/case/:caseId',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    userRateLimit(20, 60000, 'entity_graph'),
    validate(graphQuerySchema),
    async (req, res, next) => {
        try {
            const entityGraphService = getEntityGraphService();
            const { caseId } = req.params;
            const { entityTypes, minWeight, maxDepth, includeDocuments, includeEvidence } = req.query as any;

            const options = {
                caseId,
                entityTypes,
                minWeight,
                maxDepth,
                includeDocuments,
                includeEvidence,
            };

            const graph = await entityGraphService.buildGraph(options);

            await logAuditEvent({
                event_type: 'ENTITY_GRAPH_QUERIED',
                event_category: 'ENTITY_GRAPH',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'query_entity_graph',
                outcome: 'SUCCESS',
                resource_type: 'CASE',
                resource_id: caseId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { options, nodes: graph.nodes.length, edges: graph.edges.length },
            });

            res.json(graph);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// FIND SHORTEST PATH BETWEEN ENTITIES
// ============================================================================

router.get('/case/:caseId/path',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    validate(pathQuerySchema),
    async (req, res, next) => {
        try {
            const entityGraphService = getEntityGraphService();
            const { caseId } = req.params;
            const { source, target } = req.query as any;

            const path = await entityGraphService.findShortestPath(caseId, source, target);

            if (!path) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'No path found between entities' });
                return;
            }

            await logAuditEvent({
                event_type: 'ENTITY_PATH_QUERIED',
                event_category: 'ENTITY_GRAPH',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'find_entity_path',
                outcome: 'SUCCESS',
                resource_type: 'CASE',
                resource_id: caseId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { source, target, path_length: path.length },
            });

            res.json({ path });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET CENTRAL ENTITIES (Degree Centrality)
// ============================================================================

router.get('/case/:caseId/central',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    validate(centralEntitiesSchema),
    async (req, res, next) => {
        try {
            const entityGraphService = getEntityGraphService();
            const { caseId } = req.params;
            const { topN } = req.query as any;

            const centralEntities = await entityGraphService.getCentralEntities(caseId, topN);

            await logAuditEvent({
                event_type: 'CENTRAL_ENTITIES_QUERIED',
                event_category: 'ENTITY_GRAPH',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'query_central_entities',
                outcome: 'SUCCESS',
                resource_type: 'CASE',
                resource_id: caseId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { topN },
            });

            res.json({ centralEntities });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET COMMUNITIES
// ============================================================================

router.get('/case/:caseId/communities',
    validate(communitiesSchema),
    requireCaseAccess('caseId'),
    async (req, res, next) => {
        try {
            const entityGraphService = getEntityGraphService();
            const { caseId } = req.params;

            const communities = await entityGraphService.getCommunities(caseId);

            await logAuditEvent({
                event_type: 'ENTITY_COMMUNITIES_QUERIED',
                event_category: 'ENTITY_GRAPH',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'query_entity_communities',
                outcome: 'SUCCESS',
                resource_type: 'CASE',
                resource_id: caseId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { community_count: communities.length },
            });

            res.json({ communities });
        } catch (error) {
            next(error);
        }
    }
);

export default router;