/**
 * ADALAT360 - BSA Section 63 Certificate Routes
 * REST API for generating and verifying court-admissible certificates
 */

import { Router } from 'express';
import { z } from 'zod';
import { getBsaCertificateService } from '@intelligence/bsa-certificate/bsa-certificate.service.js';
import { authenticate, requireRole, requireCaseAccess, requireCasePermission, userRateLimit } from '@middleware/auth/auth.middleware.js';
import { validate } from '@middleware/validate.middleware.js';
import { logAuditEvent } from '@services/audit.service.js';
import { UserRole, PermissionLevel } from '@types/database.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const certificateIdParamSchema = z.object({
    params: z.object({
        certificateId: z.string().uuid(),
    }),
});

const certificateNumberParamSchema = z.object({
    params: z.object({
        certificateNumber: z.string().min(1),
    }),
});

const documentIdParamSchema = z.object({
    params: z.object({
        documentId: z.string().uuid(),
    }),
});

const generateCertificateSchema = z.object({
    body: z.object({
        caseId: z.string().uuid(),
        documentId: z.string().uuid(),
        section: z.string().default('63'),
        subsection: z.string().optional(),
        certificateType: z.enum(['ELECTRONIC_RECORD', 'DIGITAL_SIGNATURE', 'COMPUTER_OUTPUT']).default('ELECTRONIC_RECORD'),
        validUntil: z.coerce.date().optional(),
        customContent: z.object({
            computerOutput: z.object({
                description: z.string().optional(),
                producedBy: z.string().optional(),
                productionDate: z.coerce.date().optional(),
                productionProcess: z.string().optional(),
                responsiblePerson: z.string().optional(),
                responsiblePersonRole: z.string().optional(),
            }).optional(),
            conditions: z.object({
                regularUse: z.boolean().optional(),
                properOperation: z.boolean().optional(),
                accurateReproduction: z.boolean().optional(),
                informationSupplied: z.boolean().optional(),
            }).optional(),
            certificateDetails: z.object({
                identifier: z.string().optional(),
                descriptionOfOutput: z.string().optional(),
                particularsOfDevice: z.string().optional(),
                particularsOfProcedure: z.string().optional(),
                signatureOfPerson: z.string().optional(),
                designationOfPerson: z.string().optional(),
            }).optional(),
        }).optional(),
    }),
});

const revokeCertificateSchema = z.object({
    body: z.object({
        reason: z.string().min(1).max(500),
    }),
});

// ============================================================================
// GENERATE CERTIFICATE
// ============================================================================

router.post('/generate',
    requireRole(UserRole.PROSECUTOR, UserRole.COURT, UserRole.CENTRAL_ADMIN),
    userRateLimit(10, 3600000, 'bsa_generate'), // 10 per hour
    validate(generateCertificateSchema),
    async (req, res, next) => {
        try {
            const { caseId, documentId } = req.body;

            // Verify case access
            if (req.auth!.role !== 'CENTRAL_ADMIN') {
                if (!req.auth!.case_ids.includes(caseId)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this case' });
                    return;
                }
            }

            // Verify document exists and belongs to case
            const { pgQuery } = await import('../config/database.js');
            const docResult = await pgQuery(
                `SELECT id FROM documents WHERE id = $1 AND case_id = $2 AND deleted_at IS NULL`,
                [documentId, caseId]
            );

            if (docResult.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found in this case' });
                return;
            }

            const bsaService = getBsaCertificateService();
            const result = await bsaService.generateCertificate(req.body, req.auth!.sub);

            await logAuditEvent({
                event_type: 'BSA_CERTIFICATE_GENERATED',
                event_category: 'BSA_CERTIFICATE',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'generate_certificate',
                outcome: 'SUCCESS',
                resource_type: 'BSA_CERTIFICATE',
                resource_id: result.certificate.id,
                request_id: req.headers['x-request-id'] as string,
                metadata: {
                    case_id: caseId,
                    document_id: documentId,
                    certificate_number: result.certificate.certificateNumber,
                },
            });

            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// VERIFY CERTIFICATE (Public endpoint - no auth required for verification)
// ============================================================================

router.get('/verify/:certificateNumber',
    validate(certificateNumberParamSchema),
    async (req, res, next) => {
        try {
            const bsaService = getBsaCertificateService();
            const result = await bsaService.verifyCertificate(req.params.certificateNumber);

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET CERTIFICATE BY ID
// ============================================================================

router.get('/:certificateId',
    validate(certificateIdParamSchema),
    async (req, res, next) => {
        try {
            const bsaService = getBsaCertificateService();
            const certificate = await bsaService.getCertificate(req.params.certificateId);

            if (!certificate) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Certificate not found' });
                return;
            }

            // Check case access
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (!req.auth!.case_ids.includes(certificate.caseId)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                    return;
                }
            }

            res.json(certificate);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// LIST CERTIFICATES BY CASE
// ============================================================================

router.get('/case/:caseId',
    validate(z.object({ params: z.object({ caseId: z.string().uuid() }) })),
    requireCaseAccess('caseId'),
    async (req, res, next) => {
        try {
            const bsaService = getBsaCertificateService();
            const certificates = await bsaService.getCertificatesByCase(req.params.caseId);
            res.json(certificates);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// LIST CERTIFICATES BY DOCUMENT
// ============================================================================

router.get('/document/:documentId',
    validate(documentIdParamSchema),
    async (req, res, next) => {
        try {
            const bsaService = getBsaCertificateService();
            const certificates = await bsaService.getCertificatesByDocument(req.params.documentId);

            // Check case access for first certificate
            if (certificates.length > 0 && req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (!req.auth!.case_ids.includes(certificates[0].caseId)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                    return;
                }
            }

            res.json(certificates);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// REVOKE CERTIFICATE
// ============================================================================

router.post('/:certificateId/revoke',
    validate(certificateIdParamSchema),
    requireRole(UserRole.PROSECUTOR, UserRole.COURT, UserRole.CENTRAL_ADMIN),
    validate(revokeCertificateSchema),
    async (req, res, next) => {
        try {
            const bsaService = getBsaCertificateService();
            const certificate = await bsaService.getCertificate(req.params.certificateId);

            if (!certificate) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Certificate not found' });
                return;
            }

            // Check authority
            if (req.auth!.role !== 'CENTRAL_ADMIN') {
                if (!req.auth!.case_ids.includes(certificate.caseId)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this case' });
                    return;
                }
            }

            await bsaService.revokeCertificate(req.params.certificateId, req.auth!.sub, req.body.reason);

            await logAuditEvent({
                event_type: 'BSA_CERTIFICATE_REVOKED',
                event_category: 'BSA_CERTIFICATE',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'revoke_certificate',
                outcome: 'SUCCESS',
                resource_type: 'BSA_CERTIFICATE',
                resource_id: req.params.certificateId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { reason: req.body.reason },
            });

            res.json({ message: 'Certificate revoked successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// DOWNLOAD CERTIFICATE PDF
// ============================================================================

router.get('/:certificateId/pdf',
    validate(certificateIdParamSchema),
    async (req, res, next) => {
        try {
            const bsaService = getBsaCertificateService();
            const certificate = await bsaService.getCertificate(req.params.certificateId);

            if (!certificate) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Certificate not found' });
                return;
            }

            // Check case access
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (!req.auth!.case_ids.includes(certificate.caseId)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                    return;
                }
            }

            // In production, generate and stream PDF
            // For now, return placeholder
            res.json({
                message: 'PDF generation endpoint',
                certificate_number: certificate.certificateNumber,
                pdf_url: certificate.pdfUrl || `/api/v1/bsa/${certificate.id}/pdf`,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;