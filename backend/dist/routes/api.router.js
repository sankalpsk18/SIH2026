"use strict";
/**
 * ADALAT360 - Main API Router
 * Aggregates all route modules with proper prefixes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_js_1 = __importDefault(require("./auth.routes.js"));
const cases_routes_js_1 = __importDefault(require("./cases.routes.js"));
const documents_routes_js_1 = __importDefault(require("./documents.routes.js"));
const evidence_routes_js_1 = __importDefault(require("./evidence.routes.js"));
const search_routes_js_1 = __importDefault(require("./search.routes.js"));
const blockchain_routes_js_1 = __importDefault(require("./blockchain.routes.js"));
const bsa_routes_js_1 = __importDefault(require("./bsa.routes.js"));
const audit_routes_js_1 = __importDefault(require("./audit.routes.js"));
const admin_routes_js_1 = __importDefault(require("./admin.routes.js"));
const rti_routes_js_1 = __importDefault(require("./rti.routes.js"));
const timeline_routes_js_1 = __importDefault(require("./timeline.routes.js"));
const entity_graph_routes_js_1 = __importDefault(require("./entity-graph.routes.js"));
const collaboration_routes_js_1 = __importDefault(require("./collaboration.routes.js"));
const asset_lifecycle_routes_js_1 = __importDefault(require("./asset-lifecycle.routes.js"));
const pki_routes_js_1 = __importDefault(require("./pki.routes.js"));
const index_js_1 = require("../config/index.js");
const router = (0, express_1.Router)();
const apiPrefix = index_js_1.config.server.apiPrefix;
// ============================================================================
// PUBLIC ROUTES (no authentication required for some)
// ============================================================================
// Auth routes (login, refresh, etc. - handled internally)
router.use(`${apiPrefix}/auth`, auth_routes_js_1.default);
// BSA certificate verification (public endpoint)
router.use(`${apiPrefix}/bsa/verify`, bsa_routes_js_1.default);
// RTI request number lookup (public)
router.get(`${apiPrefix}/rti/number/:requestNumber`, async (req, res, next) => {
    // Forward to RTI routes
    next();
});
// ============================================================================
// PROTECTED ROUTES (all require authentication via middleware in each route)
// ============================================================================
router.use(`${apiPrefix}/cases`, cases_routes_js_1.default);
router.use(`${apiPrefix}/documents`, documents_routes_js_1.default);
router.use(`${apiPrefix}/evidence`, evidence_routes_js_1.default);
router.use(`${apiPrefix}/search`, search_routes_js_1.default);
router.use(`${apiPrefix}/blockchain`, blockchain_routes_js_1.default);
router.use(`${apiPrefix}/bsa`, bsa_routes_js_1.default);
router.use(`${apiPrefix}/audit`, audit_routes_js_1.default);
router.use(`${apiPrefix}/admin`, admin_routes_js_1.default);
router.use(`${apiPrefix}/rti`, rti_routes_js_1.default);
router.use(`${apiPrefix}/timeline`, timeline_routes_js_1.default);
router.use(`${apiPrefix}/entity-graph`, entity_graph_routes_js_1.default);
// New collaboration routes
router.use(`${apiPrefix}/collaboration`, collaboration_routes_js_1.default);
// New asset lifecycle routes
router.use(`${apiPrefix}/assets`, asset_lifecycle_routes_js_1.default);
// PKI routes
router.use(`${apiPrefix}/pki`, pki_routes_js_1.default);
// ============================================================================
// API INFO ENDPOINT
// ============================================================================
router.get(`${apiPrefix}`, (req, res) => {
    res.json({
        name: 'ADALAT360 API',
        version: '1.0.0',
        description: 'Secure Digital Document Management System for Legal & Investigation Documents',
        documentation: `${req.protocol}://${req.get('host')}/api-docs`,
        health: `${req.protocol}://${req.get('host')}/health`,
        endpoints: {
            auth: `${apiPrefix}/auth`,
            cases: `${apiPrefix}/cases`,
            documents: `${apiPrefix}/documents`,
            evidence: `${apiPrefix}/evidence`,
            search: `${apiPrefix}/search`,
            blockchain: `${apiPrefix}/blockchain`,
            bsa: `${apiPrefix}/bsa`,
            audit: `${apiPrefix}/audit`,
            admin: `${apiPrefix}/admin`,
            rti: `${apiPrefix}/rti`,
            timeline: `${apiPrefix}/timeline`,
            entityGraph: `${apiPrefix}/entity-graph`,
            collaboration: `${apiPrefix}/collaboration`,
            assets: `${apiPrefix}/assets`,
            pki: `${apiPrefix}/pki`,
        },
    });
});
// ============================================================================
// API DOCUMENTATION (Swagger/OpenAPI)
// ============================================================================
router.get(`${apiPrefix}/docs`, (req, res) => {
    // In production, serve Swagger UI
    res.json({
        message: 'API Documentation',
        swaggerUrl: `${req.protocol}://${req.get('host')}/api-docs/swagger.json`,
        redocUrl: `${req.protocol}://${req.get('host')}/api-docs/redoc`,
    });
});
exports.default = router;
//# sourceMappingURL=api.router.js.map