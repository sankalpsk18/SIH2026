"use strict";
/**
 * ADALAT360 - Documents Routes
 * REST API for document management
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_js_1 = require("../config/database.js");
const ingestion_service_js_1 = require("../document-ingestion/ingestion.service.js");
const version_manager_js_1 = require("../document-ingestion/versioning/version-manager.js");
const blockchain_service_js_1 = require("../blockchain/blockchain.service.js");
const auth_middleware_js_1 = require("../middleware/auth/auth.middleware.js");
const validate_middleware_js_1 = require("../middleware/validate.middleware.js");
const ingestion_service_js_2 = require("../document-ingestion/ingestion.service.js");
const audit_service_js_1 = require("../services/audit.service.js");
const database_js_2 = require("../types/database.js");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_js_1.authenticate);
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
const documentIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        documentId: zod_1.z.string().uuid(),
    }),
});
const caseIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
    }),
});
const createDocumentSchema = zod_1.z.object({
    body: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
        title: zod_1.z.string().min(1).max(500),
        description: zod_1.z.string().optional(),
        documentType: zod_1.z.nativeEnum(database_js_2.DocumentType),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        ocrLanguage: zod_1.z.string().default('eng'),
    }),
});
const updateDocumentSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().max(500).optional(),
        description: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(database_js_2.DocumentStatus).optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
const versionCreateSchema = zod_1.z.object({
    body: zod_1.z.object({
        changesSummary: zod_1.z.string().min(1).max(1000),
    }),
});
const redactionSchema = zod_1.z.object({
    body: zod_1.z.object({
        redactions: zod_1.z.array(zod_1.z.object({
            page: zod_1.z.number().int().positive(),
            x: zod_1.z.number().min(0),
            y: zod_1.z.number().min(0),
            width: zod_1.z.number().positive(),
            height: zod_1.z.number().positive(),
            label: zod_1.z.string().optional(),
        })).min(1),
        reason: zod_1.z.string().min(1).max(500),
    }),
});
const exportSchema = zod_1.z.object({
    body: zod_1.z.object({
        documentIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
        format: zod_1.z.enum(['pdf', 'zip', 'original']),
        watermark: zod_1.z.boolean().default(true),
        watermarkText: zod_1.z.string().optional(),
        password: zod_1.z.string().optional(),
    }),
});
const documentQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
        documentType: zod_1.z.nativeEnum(database_js_2.DocumentType).optional(),
        status: zod_1.z.nativeEnum(database_js_2.DocumentStatus).optional(),
        uploadedBy: zod_1.z.string().uuid().optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        search: zod_1.z.string().optional(),
    }),
});
// ============================================================================
// LIST DOCUMENTS (case-scoped)
// ============================================================================
router.get('/case/:caseId', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, validate_middleware_js_1.validate)(documentQuerySchema), async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { page, limit, documentType, status, uploadedBy, tags, search } = req.query;
        const offset = (page - 1) * limit;
        const conditions = ['d.case_id = $1', 'd.deleted_at IS NULL', 'd.is_latest_version = TRUE'];
        const params = [caseId];
        let paramIndex = 2;
        if (documentType) {
            conditions.push(`d.document_type = $${paramIndex++}`);
            params.push(documentType);
        }
        if (status) {
            conditions.push(`d.status = $${paramIndex++}`);
            params.push(status);
        }
        if (uploadedBy) {
            conditions.push(`d.uploaded_by = $${paramIndex++}`);
            params.push(uploadedBy);
        }
        if (tags && tags.length > 0) {
            conditions.push(`d.tags && $${paramIndex++}`);
            params.push(tags);
        }
        if (search) {
            conditions.push(`(
                    d.title ILIKE $${paramIndex} OR
                    d.description ILIKE $${paramIndex} OR
                    d.ocr_text ILIKE $${paramIndex} OR
                    d.original_filename ILIKE $${paramIndex}
                )`);
            params.push(`%${search}%`);
            paramIndex++;
        }
        const whereClause = conditions.join(' AND ');
        params.push(limit, offset);
        const [docsResult, countResult] = await Promise.all([
            (0, database_js_1.pgQuery)(`SELECT d.*, u.full_name as uploaded_by_name
                     FROM documents d
                     LEFT JOIN users u ON u.id = d.uploaded_by
                     WHERE ${whereClause}
                     ORDER BY d.created_at DESC
                     LIMIT $${paramIndex++} OFFSET $${paramIndex}`, params),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as total FROM documents d WHERE ${whereClause}`, params.slice(0, -2)),
        ]);
        res.json({
            documents: docsResult.rows,
            total: parseInt(countResult.rows[0].total, 10),
            page,
            limit,
            totalPages: Math.ceil(parseInt(countResult.rows[0].total, 10) / limit),
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET DOCUMENT BY ID
// ============================================================================
router.get('/:documentId', (0, validate_middleware_js_1.validate)(documentIdParamSchema), async (req, res, next) => {
    try {
        const result = await (0, database_js_1.pgQuery)(`SELECT d.*, u.full_name as uploaded_by_name, u.full_name as verified_by_name, u.full_name as approved_by_name
                 FROM documents d
                 LEFT JOIN users u ON u.id = d.uploaded_by
                 WHERE d.id = $1 AND d.deleted_at IS NULL`, [req.params.documentId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });
            return;
        }
        const document = result.rows[0];
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            const hasAccess = req.auth.case_ids.includes(document.case_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this document' });
                return;
            }
        }
        res.json(document);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// UPLOAD DOCUMENT
// ============================================================================
router.post('/', (0, auth_middleware_js_1.userRateLimit)(20, 60000, 'documents_upload'), ingestion_service_js_2.uploadMiddleware.single('file'), (0, validate_middleware_js_1.validate)(createDocumentSchema), async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'File is required' });
            return;
        }
        const ingestionService = (0, ingestion_service_js_1.getDocumentIngestionService)();
        const userNodeId = req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' :
            req.auth.role === 'AUDITOR' ? 'AuditMSP' :
                req.auth.role === 'FORENSIC_LAB' ? 'ForensicLabMSP' :
                    req.auth.role === 'PROSECUTOR' ? 'OfficerMSP' :
                        req.auth.role === 'COURT' ? 'CourtMSP' : 'OfficerMSP';
        const result = await ingestionService.uploadDocument(req.file, {
            caseId: req.body.caseId,
            title: req.body.title,
            description: req.body.description,
            documentType: req.body.documentType,
            tags: req.body.tags,
            ocrLanguage: req.body.ocrLanguage,
        }, req.auth.sub, userNodeId);
        // Audit log
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'DOCUMENT_UPLOADED',
            event_category: 'DOCUMENT_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'upload_document',
            outcome: 'SUCCESS',
            resource_type: 'DOCUMENT',
            resource_id: result.document.id,
            request_id: req.headers['x-request-id'],
            metadata: {
                case_id: req.body.caseId,
                document_type: req.body.documentType,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
            },
        });
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// UPDATE DOCUMENT METADATA
// ============================================================================
router.patch('/:documentId', (0, validate_middleware_js_1.validate)(documentIdParamSchema), (0, validate_middleware_js_1.validate)(updateDocumentSchema), async (req, res, next) => {
    try {
        const { documentId } = req.params;
        const updates = req.body;
        // Get document for case access check
        const docResult = await (0, database_js_1.pgQuery)(`SELECT case_id FROM documents WHERE id = $1 AND deleted_at IS NULL`, [documentId]);
        if (docResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });
            return;
        }
        // Check case access and permission
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(docResult.rows[0].case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        const fields = [];
        const values = [];
        let paramIndex = 1;
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                fields.push(`${key} = $${paramIndex++}`);
                values.push(value);
            }
        }
        if (fields.length === 0) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'No fields to update' });
            return;
        }
        fields.push(`updated_at = NOW()`);
        values.push(documentId);
        const result = await (0, database_js_1.pgQuery)(`UPDATE documents SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`, values);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });
            return;
        }
        // Record blockchain event
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: database_js_2.CustodyAction.METADATA_UPDATE,
            caseId: docResult.rows[0].case_id,
            documentId,
            actorUserId: req.auth.sub,
            actorNodeId: req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
            actionDetails: { updated_fields: Object.keys(updates) },
        });
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CREATE NEW VERSION
// ============================================================================
router.post('/:documentId/versions', (0, validate_middleware_js_1.validate)(documentIdParamSchema), ingestion_service_js_2.uploadMiddleware.single('file'), (0, validate_middleware_js_1.validate)(versionCreateSchema), async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'File is required for new version' });
            return;
        }
        const { documentId } = req.params;
        // Get current document for case access
        const docResult = await (0, database_js_1.pgQuery)(`SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL`, [documentId]);
        if (docResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });
            return;
        }
        const document = docResult.rows[0];
        // Check case access and write permission
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(document.case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        const userNodeId = req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' :
            req.auth.role === 'AUDITOR' ? 'AuditMSP' :
                req.auth.role === 'FORENSIC_LAB' ? 'ForensicLabMSP' :
                    req.auth.role === 'PROSECUTOR' ? 'OfficerMSP' :
                        req.auth.role === 'COURT' ? 'CourtMSP' : 'OfficerMSP';
        const { computeBufferHash } = await import('../document-ingestion/hashing/file-hasher.js');
        const fileHash = computeBufferHash(req.file.buffer).hash;
        const versionManager = (0, version_manager_js_1.getVersionManager)();
        const result = await versionManager.createVersion({
            documentId,
            file: req.file,
            changesSummary: req.body.changesSummary,
            fileHash,
            ocrText: undefined,
            metadata: {},
            uploadedBy: req.auth.sub,
        });
        // Audit log
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'DOCUMENT_VERSION_CREATED',
            event_category: 'DOCUMENT_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'create_version',
            outcome: 'SUCCESS',
            resource_type: 'DOCUMENT',
            resource_id: documentId,
            request_id: req.headers['x-request-id'],
            metadata: { new_version: result.newVersion.version, changes: req.body.changesSummary },
        });
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET VERSION HISTORY
// ============================================================================
router.get('/:documentId/versions', (0, validate_middleware_js_1.validate)(documentIdParamSchema), async (req, res, next) => {
    try {
        const { documentId } = req.params;
        const docResult = await (0, database_js_1.pgQuery)(`SELECT case_id FROM documents WHERE id = $1 AND deleted_at IS NULL`, [documentId]);
        if (docResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });
            return;
        }
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(docResult.rows[0].case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        const versionManager = (0, version_manager_js_1.getVersionManager)();
        const versions = await versionManager.getVersionHistory(documentId);
        res.json(versions);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// DOWNLOAD DOCUMENT
// ============================================================================
router.get('/:documentId/download', (0, validate_middleware_js_1.validate)(documentIdParamSchema), async (req, res, next) => {
    try {
        const { documentId } = req.params;
        const docResult = await (0, database_js_1.pgQuery)(`SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL`, [documentId]);
        if (docResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });
            return;
        }
        const document = docResult.rows[0];
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(document.case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        // Record access event
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: database_js_2.CustodyAction.ACCESS,
            caseId: document.case_id,
            documentId,
            actorUserId: req.auth.sub,
            actorNodeId: req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
            actionDetails: { action: 'DOWNLOAD' },
        });
        // Get file stream
        const ingestionService = (0, ingestion_service_js_1.getDocumentIngestionService)();
        const streamResult = await ingestionService.getDocumentStream(documentId);
        if (!streamResult) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'File not found in storage' });
            return;
        }
        res.setHeader('Content-Type', streamResult.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.original_filename}"`);
        res.setHeader('Content-Length', streamResult.size);
        res.setHeader('X-File-Hash', document.file_hash_sha256);
        streamResult.stream.pipe(res);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// DOCUMENT REDACTION
// ============================================================================
router.post('/:documentId/redact', (0, validate_middleware_js_1.validate)(documentIdParamSchema), (0, validate_middleware_js_1.validate)(redactionSchema), async (req, res, next) => {
    try {
        const { documentId } = req.params;
        const { redactions, reason } = req.body;
        // Check access and permission
        const docResult = await (0, database_js_1.pgQuery)(`SELECT case_id FROM documents WHERE id = $1 AND deleted_at IS NULL`, [documentId]);
        if (docResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });
            return;
        }
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(docResult.rows[0].case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        // In production, call ingestionService.redactDocument
        // For now, return not implemented
        res.status(501).json({
            error: 'NOT_IMPLEMENTED',
            message: 'Redaction feature not yet implemented',
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// EXPORT DOCUMENTS
// ============================================================================
router.post('/export', (0, validate_middleware_js_1.validate)(exportSchema), async (req, res, next) => {
    try {
        const { documentIds, format, watermark, watermarkText, password } = req.body;
        // Verify access to all documents
        for (const docId of documentIds) {
            const docResult = await (0, database_js_1.pgQuery)(`SELECT case_id FROM documents WHERE id = $1 AND deleted_at IS NULL`, [docId]);
            if (docResult.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: `Document ${docId} not found` });
                return;
            }
            if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
                if (!req.auth.case_ids.includes(docResult.rows[0].case_id)) {
                    res.status(403).json({ error: 'FORBIDDEN', message: `Access denied to document ${docId}` });
                    return;
                }
            }
        }
        const ingestionService = (0, ingestion_service_js_1.getDocumentIngestionService)();
        const userNodeId = req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP';
        const result = await ingestionService.exportDocuments(documentIds, format, req.auth.sub, userNodeId);
        // Audit log
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'DOCUMENTS_EXPORTED',
            event_category: 'DOCUMENT_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'export_documents',
            outcome: 'SUCCESS',
            resource_type: 'DOCUMENT',
            resource_id: documentIds[0],
            request_id: req.headers['x-request-id'],
            metadata: { document_ids: documentIds, format, watermark, watermarkText },
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// DELETE DOCUMENT (soft delete)
// ============================================================================
router.delete('/:documentId', (0, validate_middleware_js_1.validate)(documentIdParamSchema), async (req, res, next) => {
    try {
        const { documentId } = req.params;
        const docResult = await (0, database_js_1.pgQuery)(`SELECT case_id FROM documents WHERE id = $1 AND deleted_at IS NULL`, [documentId]);
        if (docResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });
            return;
        }
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(docResult.rows[0].case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        const ingestionService = (0, ingestion_service_js_1.getDocumentIngestionService)();
        const userNodeId = req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP';
        await ingestionService.deleteDocument(documentId, req.auth.sub, userNodeId);
        res.json({ message: 'Document deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=documents.routes.js.map