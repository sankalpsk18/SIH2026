/**
 * ADALAT360 - PKI Routes
 * REST API for certificate management
 */

import { Router } from 'express';
import { z } from 'zod';
import { getPkiService } from '@pki/pki.service.js';
import { authenticate, requireRole, userRateLimit } from '@middleware/auth/auth.middleware.js';
import { validate } from '@middleware/validate.middleware.js';
import { logAuditEvent } from '@services/audit.service.js';
import { UserRole, CertificateCategory, RevocationReason } from '@types/database.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const issueUserCertSchema = z.object({
    body: z.object({
        userId: z.string().uuid(),
        fullName: z.string().min(2).max(255),
        email: z.string().email(),
        department: z.string().min(2).max(100),
    }),
});

const issueNodeCertSchema = z.object({
    body: z.object({
        nodeId: z.string().min(1).max(100),
        organization: z.string().min(2).max(200),
        nodeHostname: z.string().min(1).max(255),
        nodeEndpoint: z.string().url(),
        mspId: z.string().min(1).max(100),
    }),
});

const issueAssetActorCertSchema = z.object({
    body: z.object({
        userId: z.string().uuid(),
    }),
});

const revokeCertSchema = z.object({
    body: z.object({
        reason: z.nativeEnum(RevocationReason),
    }),
});

const renewCertSchema = z.object({
    body: z.object({
        additionalDays: z.coerce.number().int().positive().optional(),
    }),
});

const validateCertSchema = z.object({
    body: z.object({
        certificatePem: z.string().min(1),
        category: z.nativeEnum(CertificateCategory),
        checkRevocation: z.boolean().default(true),
    }),
});

const categoryParamSchema = z.object({
    params: z.object({
        category: z.nativeEnum(CertificateCategory),
    }),
});

const certIdParamSchema = z.object({
    params: z.object({
        certId: z.string().uuid(),
    }),
});

const userIdParamSchema = z.object({
    params: z.object({
        userId: z.string().uuid(),
    }),
});

const nodeIdParamSchema = z.object({
    params: z.object({
        nodeId: z.string().min(1),
    }),
});

const crlCategoryParamSchema = z.object({
    params: z.object({
        category: z.nativeEnum(CertificateCategory),
    }),
});

// ============================================================================
// USER CERTIFICATES
// ============================================================================

// Issue user certificate (Admin only)
router.post('/users/certificate',
    requireRole(UserRole.CENTRAL_ADMIN, UserRole.AUDITOR),
    userRateLimit(10, 3600000, 'pki_user_cert_issue'),
    validate(issueUserCertSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { userId, fullName, email, department } = req.body;

            const result = await pkiService.issueUserCertificate(userId, fullName, email, department);

            res.status(201).json({
                message: 'User certificate issued successfully',
                certificate: result,
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get user certificate
router.get('/users/:userId/certificate',
    validate(userIdParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const cert = await pkiService.getUserCertificate(req.params.userId);

            if (!cert) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'User has no certificate' });
                return;
            }

            // Check access
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (req.auth!.sub !== req.params.userId) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                    return;
                }
            }

            res.json(cert);
        } catch (error) {
            next(error);
        }
    }
);

// Revoke user certificate
router.post('/users/:userId/certificate/revoke',
    validate(userIdParamSchema),
    validate(revokeCertSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { reason } = req.body;

            // Check permission
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (req.auth!.sub !== req.params.userId) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot revoke other users\' certificates' });
                    return;
                }
            }

            await pkiService.revokeUserCertificate(req.params.userId, reason, req.auth!.sub);

            res.json({ message: 'User certificate revoked successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// Renew user certificate
router.post('/users/:userId/certificate/renew',
    validate(userIdParamSchema),
    validate(renewCertSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { additionalDays } = req.body;

            const result = await pkiService.renewUserCertificate(req.params.userId);

            res.json({
                message: 'User certificate renewed successfully',
                certificate: result,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// BLOCKCHAIN NODE CERTIFICATES
// ============================================================================

// Issue node certificate (Admin only)
router.post('/nodes/certificate',
    requireRole(UserRole.CENTRAL_ADMIN, UserRole.AUDITOR),
    validate(issueNodeCertSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { nodeId, organization, nodeHostname, nodeEndpoint, mspId } = req.body;

            const result = await pkiService.issueNodeCertificate(nodeId, organization, nodeHostname, nodeEndpoint, mspId);

            res.status(201).json({
                message: 'Node certificate issued successfully',
                certificate: result,
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get node certificate
router.get('/nodes/:nodeId/certificate',
    validate(nodeIdParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const cert = await pkiService.getNodeCertificate(req.params.nodeId);

            if (!cert) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Node has no certificate' });
                return;
            }

            res.json(cert);
        } catch (error) {
            next(error);
        }
    }
);

// Revoke node certificate
router.post('/nodes/:nodeId/certificate/revoke',
    validate(nodeIdParamSchema),
    validate(revokeCertSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { reason } = req.body;

            await pkiService.revokeNodeCertificate(req.params.nodeId, reason);

            res.json({ message: 'Node certificate revoked successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// ASSET ACTOR CERTIFICATES
// ============================================================================

// Issue asset actor certificate
router.post('/asset-actors/certificate',
    validate(issueAssetActorCertSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { userId } = req.body;

            // Check permission
            if (req.auth!.sub !== userId && req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot request certificate for another user' });
                return;
            }

            const result = await pkiService.issueAssetActorCertificate(userId);

            res.status(201).json({
                message: 'Asset actor certificate issued successfully',
                certificate: result,
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get asset actor certificate
router.get('/asset-actors/:userId/certificate',
    validate(userIdParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const cert = await pkiService.getAssetActorCertificate(req.params.userId);

            if (!cert) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'User has no asset actor certificate' });
                return;
            }

            res.json(cert);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// CERTIFICATE VALIDATION
// ============================================================================

// Validate certificate
router.post('/validate',
    validate(validateCertSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { certificatePem, category, checkRevocation } = req.body;

            const result = await pkiService.validateCertificate(certificatePem, category, checkRevocation);

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// Validate for custody transaction
router.post('/validate/custody',
    validate(z.object({
        body: z.object({
            certificatePem: z.string().min(1),
            category: z.nativeEnum(CertificateCategory),
        }),
    })),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { certificatePem, category } = req.body;

            const result = await pkiService.validateCustodyTransaction(certificatePem, category);

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// Validate user for operation
router.post('/validate/user/:userId',
    validate(userIdParamSchema),
    validate(z.object({
        body: z.object({
            operation: z.string().min(1),
        }),
    })),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { operation } = req.body;

            const result = await pkiService.validateUserForOperation(req.params.userId, operation);

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// Validate node for endorsement
router.post('/validate/node/:nodeId',
    validate(nodeIdParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const result = await pkiService.validateNodeForEndorsement(req.params.nodeId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// Validate asset actor for transition
router.post('/validate/asset-actor/:userId',
    validate(userIdParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const result = await pkiService.validateAssetActorForTransition(req.params.userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// Validate asset state transition
router.post('/validate/asset-transition/:userId',
    validate(userIdParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const result = await pkiService.validateAssetStateTransition(req.params.userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// REVOCATION CHECKING
// ============================================================================

router.get('/revoked/check',
    validate(z.object({
        query: z.object({
            serialNumber: z.string().min(1),
            category: z.nativeEnum(CertificateCategory),
        }),
    })),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { serialNumber, category } = req.query;

            const revoked = await pkiService.isCertificateRevoked(serialNumber as string, category as CertificateCategory);

            res.json({ revoked });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/revoked/check/node/:nodeId',
    validate(nodeIdParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const revoked = await pkiService.checkRevocationBeforeEndorsement(req.params.nodeId);
            res.json({ revoked });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/revoked/check/asset-actor/:userId',
    validate(userIdParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const revoked = await pkiService.checkRevocationBeforeAssetTransition(req.params.userId);
            res.json({ revoked });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// CRL / OCSP
// ============================================================================

router.post('/crl/publish',
    validate(categoryParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            await pkiService.publishCRLs();
            res.json({ message: 'CRLs published successfully' });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/crl/:category',
    validate(crlCategoryParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const crlPem = await pkiService.getCRL(req.params.category);

            res.setHeader('Content-Type', 'application/pkix-crl');
            res.send(crlPem);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// KEY ROTATION
// ============================================================================

router.post('/users/:userId/rotate-keys',
    validate(userIdParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();

            // Check permission
            if (req.auth!.sub !== req.params.userId && req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot rotate keys for another user' });
                return;
            }

            const result = await pkiService.rotateUserKeys(req.params.userId);

            res.json({
                message: 'User keys rotated successfully',
                certificate: result,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// CERTIFICATE CHAIN VALIDATION
// ============================================================================

router.post('/validate/chain',
    validate(z.object({
        body: z.object({
            certificatePem: z.string().min(1),
            category: z.nativeEnum(CertificateCategory),
        }),
    })),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { certificatePem, category } = req.body;

            const result = await pkiService.validateCertificateChain(certificatePem, category);

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// AUDIT & COMPLIANCE
// ============================================================================

router.get('/audit/:certificateId',
    validate(certIdParamSchema),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const trail = await pkiService.getCertificateAuditTrail(req.params.certificateId);
            res.json(trail);
        } catch (error) {
            next(error);
        }
    }
);

router.get('/revoked/report',
    validate(z.object({
        query: z.object({
            category: z.nativeEnum(CertificateCategory).optional(),
            since: z.coerce.date().optional(),
        }),
    })),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { category, since } = req.query;

            const report = await pkiService.getRevokedCertificatesReport(category as CertificateCategory, since as Date);

            res.json(report);
        } catch (error) {
            next(error);
        }
    }
);

router.get('/expiring',
    validate(z.object({
        query: z.object({
            days: z.coerce.number().int().positive().max(365).default(30),
        }),
    })),
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const { days } = req.query;

            const expiring = await pkiService.getExpiringCertificates(days);

            res.json({ expiring, count: expiring.length });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// HEALTH CHECK
// ============================================================================

router.get('/health',
    async (req, res, next) => {
        try {
            const pkiService = getPkiService();
            const health = await pkiService.healthCheck();
            res.json(health);
        } catch (error) {
            next(error);
        }
    }
);

export default router;