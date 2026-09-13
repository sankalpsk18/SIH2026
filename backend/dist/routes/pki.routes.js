"use strict";
/**
 * ADALAT360 - PKI Routes
 * REST API for certificate management
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const pki_service_js_1 = require("../pki/pki.service.js");
const auth_middleware_js_1 = require("../middleware/auth/auth.middleware.js");
const validate_middleware_js_1 = require("../middleware/validate.middleware.js");
const database_js_1 = require("../types/database.js");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_js_1.authenticate);
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
const issueUserCertSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string().uuid(),
        fullName: zod_1.z.string().min(2).max(255),
        email: zod_1.z.string().email(),
        department: zod_1.z.string().min(2).max(100),
    }),
});
const issueNodeCertSchema = zod_1.z.object({
    body: zod_1.z.object({
        nodeId: zod_1.z.string().min(1).max(100),
        organization: zod_1.z.string().min(2).max(200),
        nodeHostname: zod_1.z.string().min(1).max(255),
        nodeEndpoint: zod_1.z.string().url(),
        mspId: zod_1.z.string().min(1).max(100),
    }),
});
const issueAssetActorCertSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string().uuid(),
    }),
});
const revokeCertSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.nativeEnum(database_js_1.RevocationReason),
    }),
});
const renewCertSchema = zod_1.z.object({
    body: zod_1.z.object({
        additionalDays: zod_1.z.coerce.number().int().positive().optional(),
    }),
});
const validateCertSchema = zod_1.z.object({
    body: zod_1.z.object({
        certificatePem: zod_1.z.string().min(1),
        category: zod_1.z.nativeEnum(database_js_1.CertificateCategory),
        checkRevocation: zod_1.z.boolean().default(true),
    }),
});
const categoryParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        category: zod_1.z.nativeEnum(database_js_1.CertificateCategory),
    }),
});
const certIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        certId: zod_1.z.string().uuid(),
    }),
});
const userIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: zod_1.z.string().uuid(),
    }),
});
const nodeIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        nodeId: zod_1.z.string().min(1),
    }),
});
const crlCategoryParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        category: zod_1.z.nativeEnum(database_js_1.CertificateCategory),
    }),
});
// ============================================================================
// USER CERTIFICATES
// ============================================================================
// Issue user certificate (Admin only)
router.post('/users/certificate', (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.CENTRAL_ADMIN, database_js_1.UserRole.AUDITOR), (0, auth_middleware_js_1.userRateLimit)(10, 3600000, 'pki_user_cert_issue'), (0, validate_middleware_js_1.validate)(issueUserCertSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { userId, fullName, email, department } = req.body;
        const result = await pkiService.issueUserCertificate(userId, fullName, email, department);
        res.status(201).json({
            message: 'User certificate issued successfully',
            certificate: result,
        });
    }
    catch (error) {
        next(error);
    }
});
// Get user certificate
router.get('/users/:userId/certificate', (0, validate_middleware_js_1.validate)(userIdParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const cert = await pkiService.getUserCertificate(req.params.userId);
        if (!cert) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'User has no certificate' });
            return;
        }
        // Check access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (req.auth.sub !== req.params.userId) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        res.json(cert);
    }
    catch (error) {
        next(error);
    }
});
// Revoke user certificate
router.post('/users/:userId/certificate/revoke', (0, validate_middleware_js_1.validate)(userIdParamSchema), (0, validate_middleware_js_1.validate)(revokeCertSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { reason } = req.body;
        // Check permission
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (req.auth.sub !== req.params.userId) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot revoke other users\' certificates' });
                return;
            }
        }
        await pkiService.revokeUserCertificate(req.params.userId, reason, req.auth.sub);
        res.json({ message: 'User certificate revoked successfully' });
    }
    catch (error) {
        next(error);
    }
});
// Renew user certificate
router.post('/users/:userId/certificate/renew', (0, validate_middleware_js_1.validate)(userIdParamSchema), (0, validate_middleware_js_1.validate)(renewCertSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { additionalDays } = req.body;
        const result = await pkiService.renewUserCertificate(req.params.userId);
        res.json({
            message: 'User certificate renewed successfully',
            certificate: result,
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// BLOCKCHAIN NODE CERTIFICATES
// ============================================================================
// Issue node certificate (Admin only)
router.post('/nodes/certificate', (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.CENTRAL_ADMIN, database_js_1.UserRole.AUDITOR), (0, validate_middleware_js_1.validate)(issueNodeCertSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { nodeId, organization, nodeHostname, nodeEndpoint, mspId } = req.body;
        const result = await pkiService.issueNodeCertificate(nodeId, organization, nodeHostname, nodeEndpoint, mspId);
        res.status(201).json({
            message: 'Node certificate issued successfully',
            certificate: result,
        });
    }
    catch (error) {
        next(error);
    }
});
// Get node certificate
router.get('/nodes/:nodeId/certificate', (0, validate_middleware_js_1.validate)(nodeIdParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const cert = await pkiService.getNodeCertificate(req.params.nodeId);
        if (!cert) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Node has no certificate' });
            return;
        }
        res.json(cert);
    }
    catch (error) {
        next(error);
    }
});
// Revoke node certificate
router.post('/nodes/:nodeId/certificate/revoke', (0, validate_middleware_js_1.validate)(nodeIdParamSchema), (0, validate_middleware_js_1.validate)(revokeCertSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { reason } = req.body;
        await pkiService.revokeNodeCertificate(req.params.nodeId, reason);
        res.json({ message: 'Node certificate revoked successfully' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// ASSET ACTOR CERTIFICATES
// ============================================================================
// Issue asset actor certificate
router.post('/asset-actors/certificate', (0, validate_middleware_js_1.validate)(issueAssetActorCertSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { userId } = req.body;
        // Check permission
        if (req.auth.sub !== userId && req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot request certificate for another user' });
            return;
        }
        const result = await pkiService.issueAssetActorCertificate(userId);
        res.status(201).json({
            message: 'Asset actor certificate issued successfully',
            certificate: result,
        });
    }
    catch (error) {
        next(error);
    }
});
// Get asset actor certificate
router.get('/asset-actors/:userId/certificate', (0, validate_middleware_js_1.validate)(userIdParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const cert = await pkiService.getAssetActorCertificate(req.params.userId);
        if (!cert) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'User has no asset actor certificate' });
            return;
        }
        res.json(cert);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CERTIFICATE VALIDATION
// ============================================================================
// Validate certificate
router.post('/validate', (0, validate_middleware_js_1.validate)(validateCertSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { certificatePem, category, checkRevocation } = req.body;
        const result = await pkiService.validateCertificate(certificatePem, category, checkRevocation);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Validate for custody transaction
router.post('/validate/custody', (0, validate_middleware_js_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        certificatePem: zod_1.z.string().min(1),
        category: zod_1.z.nativeEnum(database_js_1.CertificateCategory),
    }),
})), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { certificatePem, category } = req.body;
        const result = await pkiService.validateCustodyTransaction(certificatePem, category);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Validate user for operation
router.post('/validate/user/:userId', (0, validate_middleware_js_1.validate)(userIdParamSchema), (0, validate_middleware_js_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        operation: zod_1.z.string().min(1),
    }),
})), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { operation } = req.body;
        const result = await pkiService.validateUserForOperation(req.params.userId, operation);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Validate node for endorsement
router.post('/validate/node/:nodeId', (0, validate_middleware_js_1.validate)(nodeIdParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const result = await pkiService.validateNodeForEndorsement(req.params.nodeId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Validate asset actor for transition
router.post('/validate/asset-actor/:userId', (0, validate_middleware_js_1.validate)(userIdParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const result = await pkiService.validateAssetActorForTransition(req.params.userId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Validate asset state transition
router.post('/validate/asset-transition/:userId', (0, validate_middleware_js_1.validate)(userIdParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const result = await pkiService.validateAssetStateTransition(req.params.userId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// REVOCATION CHECKING
// ============================================================================
router.get('/revoked/check', (0, validate_middleware_js_1.validate)(zod_1.z.object({
    query: zod_1.z.object({
        serialNumber: zod_1.z.string().min(1),
        category: zod_1.z.nativeEnum(database_js_1.CertificateCategory),
    }),
})), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { serialNumber, category } = req.query;
        const revoked = await pkiService.isCertificateRevoked(serialNumber, category);
        res.json({ revoked });
    }
    catch (error) {
        next(error);
    }
});
router.get('/revoked/check/node/:nodeId', (0, validate_middleware_js_1.validate)(nodeIdParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const revoked = await pkiService.checkRevocationBeforeEndorsement(req.params.nodeId);
        res.json({ revoked });
    }
    catch (error) {
        next(error);
    }
});
router.get('/revoked/check/asset-actor/:userId', (0, validate_middleware_js_1.validate)(userIdParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const revoked = await pkiService.checkRevocationBeforeAssetTransition(req.params.userId);
        res.json({ revoked });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CRL / OCSP
// ============================================================================
router.post('/crl/publish', (0, validate_middleware_js_1.validate)(categoryParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        await pkiService.publishCRLs();
        res.json({ message: 'CRLs published successfully' });
    }
    catch (error) {
        next(error);
    }
});
router.get('/crl/:category', (0, validate_middleware_js_1.validate)(crlCategoryParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const crlPem = await pkiService.getCRL(req.params.category);
        res.setHeader('Content-Type', 'application/pkix-crl');
        res.send(crlPem);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// KEY ROTATION
// ============================================================================
router.post('/users/:userId/rotate-keys', (0, validate_middleware_js_1.validate)(userIdParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        // Check permission
        if (req.auth.sub !== req.params.userId && req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot rotate keys for another user' });
            return;
        }
        const result = await pkiService.rotateUserKeys(req.params.userId);
        res.json({
            message: 'User keys rotated successfully',
            certificate: result,
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CERTIFICATE CHAIN VALIDATION
// ============================================================================
router.post('/validate/chain', (0, validate_middleware_js_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        certificatePem: zod_1.z.string().min(1),
        category: zod_1.z.nativeEnum(database_js_1.CertificateCategory),
    }),
})), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { certificatePem, category } = req.body;
        const result = await pkiService.validateCertificateChain(certificatePem, category);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// AUDIT & COMPLIANCE
// ============================================================================
router.get('/audit/:certificateId', (0, validate_middleware_js_1.validate)(certIdParamSchema), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const trail = await pkiService.getCertificateAuditTrail(req.params.certificateId);
        res.json(trail);
    }
    catch (error) {
        next(error);
    }
});
router.get('/revoked/report', (0, validate_middleware_js_1.validate)(zod_1.z.object({
    query: zod_1.z.object({
        category: zod_1.z.nativeEnum(database_js_1.CertificateCategory).optional(),
        since: zod_1.z.coerce.date().optional(),
    }),
})), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { category, since } = req.query;
        const report = await pkiService.getRevokedCertificatesReport(category, since);
        res.json(report);
    }
    catch (error) {
        next(error);
    }
});
router.get('/expiring', (0, validate_middleware_js_1.validate)(zod_1.z.object({
    query: zod_1.z.object({
        days: zod_1.z.coerce.number().int().positive().max(365).default(30),
    }),
})), async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const { days } = req.query;
        const expiring = await pkiService.getExpiringCertificates(days);
        res.json({ expiring, count: expiring.length });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// HEALTH CHECK
// ============================================================================
router.get('/health', async (req, res, next) => {
    try {
        const pkiService = (0, pki_service_js_1.getPkiService)();
        const health = await pkiService.healthCheck();
        res.json(health);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=pki.routes.js.map