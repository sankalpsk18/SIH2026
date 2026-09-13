"use strict";
/**
 * ADALAT360 - BSA Section 63 Certificate Routes
 * REST API for generating and verifying court-admissible certificates
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const bsa_certificate_service_js_1 = require("../intelligence/bsa-certificate/bsa-certificate.service.js");
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
const certificateIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        certificateId: zod_1.z.string().uuid(),
    }),
});
const certificateNumberParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        certificateNumber: zod_1.z.string().min(1),
    }),
});
const documentIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        documentId: zod_1.z.string().uuid(),
    }),
});
const generateCertificateSchema = zod_1.z.object({
    body: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
        documentId: zod_1.z.string().uuid(),
        section: zod_1.z.string().default('63'),
        subsection: zod_1.z.string().optional(),
        certificateType: zod_1.z.enum(['ELECTRONIC_RECORD', 'DIGITAL_SIGNATURE', 'COMPUTER_OUTPUT']).default('ELECTRONIC_RECORD'),
        validUntil: zod_1.z.coerce.date().optional(),
        customContent: zod_1.z.object({
            computerOutput: zod_1.z.object({
                description: zod_1.z.string().optional(),
                producedBy: zod_1.z.string().optional(),
                productionDate: zod_1.z.coerce.date().optional(),
                productionProcess: zod_1.z.string().optional(),
                responsiblePerson: zod_1.z.string().optional(),
                responsiblePersonRole: zod_1.z.string().optional(),
            }).optional(),
            conditions: zod_1.z.object({
                regularUse: zod_1.z.boolean().optional(),
                properOperation: zod_1.z.boolean().optional(),
                accurateReproduction: zod_1.z.boolean().optional(),
                informationSupplied: zod_1.z.boolean().optional(),
            }).optional(),
            certificateDetails: zod_1.z.object({
                identifier: zod_1.z.string().optional(),
                descriptionOfOutput: zod_1.z.string().optional(),
                particularsOfDevice: zod_1.z.string().optional(),
                particularsOfProcedure: zod_1.z.string().optional(),
                signatureOfPerson: zod_1.z.string().optional(),
                designationOfPerson: zod_1.z.string().optional(),
            }).optional(),
        }).optional(),
    }),
});
const revokeCertificateSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().min(1).max(500),
    }),
});
// ============================================================================
// GENERATE CERTIFICATE
// ============================================================================
router.post('/generate', (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.PROSECUTOR, database_js_1.UserRole.COURT, database_js_1.UserRole.CENTRAL_ADMIN), (0, auth_middleware_js_1.userRateLimit)(10, 3600000, 'bsa_generate'), // 10 per hour
(0, validate_middleware_js_1.validate)(generateCertificateSchema), async (req, res, next) => {
    try {
        const { caseId, documentId } = req.body;
        // Verify case access
        if (req.auth.role !== 'CENTRAL_ADMIN') {
            if (!req.auth.case_ids.includes(caseId)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this case' });
                return;
            }
        }
        // Verify document exists and belongs to case
        const { pgQuery } = await import('../config/database.js');
        const docResult = await pgQuery(`SELECT id FROM documents WHERE id = $1 AND case_id = $2 AND deleted_at IS NULL`, [documentId, caseId]);
        if (docResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found in this case' });
            return;
        }
        const bsaService = (0, bsa_certificate_service_js_1.getBsaCertificateService)();
        const result = await bsaService.generateCertificate(req.body, req.auth.sub);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'BSA_CERTIFICATE_GENERATED',
            event_category: 'BSA_CERTIFICATE',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'generate_certificate',
            outcome: 'SUCCESS',
            resource_type: 'BSA_CERTIFICATE',
            resource_id: result.certificate.id,
            request_id: req.headers['x-request-id'],
            metadata: {
                case_id: caseId,
                document_id: documentId,
                certificate_number: result.certificate.certificateNumber,
            },
        });
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// VERIFY CERTIFICATE (Public endpoint - no auth required for verification)
// ============================================================================
router.get('/verify/:certificateNumber', (0, validate_middleware_js_1.validate)(certificateNumberParamSchema), async (req, res, next) => {
    try {
        const bsaService = (0, bsa_certificate_service_js_1.getBsaCertificateService)();
        const result = await bsaService.verifyCertificate(req.params.certificateNumber);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET CERTIFICATE BY ID
// ============================================================================
router.get('/:certificateId', (0, validate_middleware_js_1.validate)(certificateIdParamSchema), async (req, res, next) => {
    try {
        const bsaService = (0, bsa_certificate_service_js_1.getBsaCertificateService)();
        const certificate = await bsaService.getCertificate(req.params.certificateId);
        if (!certificate) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Certificate not found' });
            return;
        }
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(certificate.caseId)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        res.json(certificate);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// LIST CERTIFICATES BY CASE
// ============================================================================
router.get('/case/:caseId', (0, validate_middleware_js_1.validate)(zod_1.z.object({ params: zod_1.z.object({ caseId: zod_1.z.string().uuid() }) })), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), async (req, res, next) => {
    try {
        const bsaService = (0, bsa_certificate_service_js_1.getBsaCertificateService)();
        const certificates = await bsaService.getCertificatesByCase(req.params.caseId);
        res.json(certificates);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// LIST CERTIFICATES BY DOCUMENT
// ============================================================================
router.get('/document/:documentId', (0, validate_middleware_js_1.validate)(documentIdParamSchema), async (req, res, next) => {
    try {
        const bsaService = (0, bsa_certificate_service_js_1.getBsaCertificateService)();
        const certificates = await bsaService.getCertificatesByDocument(req.params.documentId);
        // Check case access for first certificate
        if (certificates.length > 0 && req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(certificates[0].caseId)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        res.json(certificates);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// REVOKE CERTIFICATE
// ============================================================================
router.post('/:certificateId/revoke', (0, validate_middleware_js_1.validate)(certificateIdParamSchema), (0, auth_middleware_js_1.requireRole)(database_js_1.UserRole.PROSECUTOR, database_js_1.UserRole.COURT, database_js_1.UserRole.CENTRAL_ADMIN), (0, validate_middleware_js_1.validate)(revokeCertificateSchema), async (req, res, next) => {
    try {
        const bsaService = (0, bsa_certificate_service_js_1.getBsaCertificateService)();
        const certificate = await bsaService.getCertificate(req.params.certificateId);
        if (!certificate) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Certificate not found' });
            return;
        }
        // Check authority
        if (req.auth.role !== 'CENTRAL_ADMIN') {
            if (!req.auth.case_ids.includes(certificate.caseId)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this case' });
                return;
            }
        }
        await bsaService.revokeCertificate(req.params.certificateId, req.auth.sub, req.body.reason);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'BSA_CERTIFICATE_REVOKED',
            event_category: 'BSA_CERTIFICATE',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'revoke_certificate',
            outcome: 'SUCCESS',
            resource_type: 'BSA_CERTIFICATE',
            resource_id: req.params.certificateId,
            request_id: req.headers['x-request-id'],
            metadata: { reason: req.body.reason },
        });
        res.json({ message: 'Certificate revoked successfully' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// DOWNLOAD CERTIFICATE PDF
// ============================================================================
router.get('/:certificateId/pdf', (0, validate_middleware_js_1.validate)(certificateIdParamSchema), async (req, res, next) => {
    try {
        const bsaService = (0, bsa_certificate_service_js_1.getBsaCertificateService)();
        const certificate = await bsaService.getCertificate(req.params.certificateId);
        if (!certificate) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Certificate not found' });
            return;
        }
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(certificate.caseId)) {
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
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=bsa.routes.js.map