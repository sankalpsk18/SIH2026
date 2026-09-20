/**
 * ADALAT360 - Main API Router
 * Aggregates all route modules with proper prefixes
 */

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import caseRoutes from './cases.routes.js';
import documentRoutes from './documents.routes.js';
import evidenceRoutes from './evidence.routes.js';
import searchRoutes from './search.routes.js';
import blockchainRoutes from './blockchain.routes.js';
import bsaRoutes from './bsa.routes.js';
import auditRoutes from './audit.routes.js';
import adminRoutes from './admin.routes.js';
import rtiRoutes from './rti.routes.js';
import timelineRoutes from './timeline.routes.js';
import entityGraphRoutes from './entity-graph.routes.js';
import collaborationRoutes from './collaboration.routes.js';
import assetLifecycleRoutes from './asset-lifecycle.routes.js';
import pkiRoutes from './pki.routes.js';
import { config } from '@config/index.js';
import { getBsaCertificateService } from '@intelligence/bsa-certificate/bsa-certificate.service.js';
import { authenticate, requireRole } from '@middleware/auth/auth.middleware.js';
import { UserRole } from '@types/database.js';

const router = Router();

const apiPrefix = config.server.apiPrefix;

// ============================================================================
// PUBLIC ROUTES (no authentication required for some)
// ============================================================================

// Auth routes (login, refresh, etc. - handled internally)
router.use(`${apiPrefix}/auth`, authRoutes);

// BSA certificate verification (public endpoint). Query parameters are used
// because certificate numbers contain slash characters.
router.get(`${apiPrefix}/bsa/verify`, authenticate, requireRole(UserRole.CENTRAL_ADMIN), async (req, res, next) => {
    try {
        const certificateNumber = String(req.query.certificateNumber || '').trim();
        if (!certificateNumber) {
            res.status(400).json({ error: 'VALIDATION_ERROR', message: 'certificateNumber is required' });
            return;
        }
        const result = await getBsaCertificateService().verifyCertificate(certificateNumber);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// RTI request number lookup (public)
router.get(`${apiPrefix}/rti/number/:requestNumber`, async (req, res, next) => {
    // Forward to RTI routes
    next();
});

// ============================================================================
// PROTECTED ROUTES (all require authentication via middleware in each route)
// ============================================================================

router.use(`${apiPrefix}/cases`, caseRoutes);
router.use(`${apiPrefix}/documents`, documentRoutes);
router.use(`${apiPrefix}/evidence`, evidenceRoutes);
router.use(`${apiPrefix}/search`, searchRoutes);
router.use(`${apiPrefix}/blockchain`, blockchainRoutes);
router.use(`${apiPrefix}/bsa`, bsaRoutes);
router.use(`${apiPrefix}/audit`, auditRoutes);
router.use(`${apiPrefix}/admin`, adminRoutes);
router.use(`${apiPrefix}/rti`, rtiRoutes);
router.use(`${apiPrefix}/timeline`, timelineRoutes);
router.use(`${apiPrefix}/entity-graph`, entityGraphRoutes);

// New collaboration routes
router.use(`${apiPrefix}/collaboration`, collaborationRoutes);

// New asset lifecycle routes
router.use(`${apiPrefix}/assets`, assetLifecycleRoutes);

// PKI routes
router.use(`${apiPrefix}/pki`, pkiRoutes);

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

export default router;