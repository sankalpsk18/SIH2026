"use strict";
/**
 * ADALAT360 - Document Ingestion Service
 * Main service orchestrating file upload, validation, OCR, hashing, versioning, and storage
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMiddleware = exports.DocumentIngestionService = void 0;
exports.getDocumentIngestionService = getDocumentIngestionService;
exports.initializeDocumentIngestion = initializeDocumentIngestion;
const uuid_1 = require("uuid");
const multer_1 = __importDefault(require("multer"));
const index_js_1 = require("../config/index.js");
const logger_js_1 = require("../utils/logger.js");
const database_js_1 = require("../config/database.js");
const blockchain_service_js_1 = require("../blockchain/blockchain.service.js");
const ocr_service_js_1 = require("./ocr/ocr-service.js");
const entity_extractor_js_1 = require("./metadata/entity-extractor.js");
const version_manager_js_1 = require("./versioning/version-manager.js");
const storage_service_js_1 = require("../storage/storage.service.js");
const database_js_2 = require("../types/database.js");
const document_js_1 = require("../models/document.js");
// ============================================================================
// FILE VALIDATION
// ============================================================================
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/bmp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
];
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'doc', 'docx', 'txt', 'rtf'];
const MAGIC_BYTES = {
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/tiff': [[0x49, 0x49, 0x2A, 0x00], [0x4D, 0x4D, 0x00, 0x2A]], // II* or MM
    'image/bmp': [[0x42, 0x4D]], // BM
    'application/msword': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]], // OLE
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]], // ZIP (docx)
    'text/plain': [], // No magic bytes
    'application/rtf': [[0x7B, 0x5C, 0x72, 0x74, 0x66]], // {\rtf
};
async function validateFile(file) {
    const errors = [];
    const warnings = [];
    // Check file size
    if (file.size > index_js_1.config.ingestion.maxFileSize) {
        errors.push(`File size ${file.size} exceeds maximum allowed ${index_js_1.config.ingestion.maxFileSize} bytes`);
    }
    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        errors.push(`MIME type ${file.mimetype} not allowed`);
    }
    // Check extension
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`File extension .${ext} not allowed`);
    }
    // Check magic bytes (file signature)
    if (file.buffer && MAGIC_BYTES[file.mimetype]) {
        const signatures = MAGIC_BYTES[file.mimetype];
        const matches = signatures.some(sig => sig.every((byte, i) => file.buffer[i] === byte));
        if (!matches) {
            warnings.push(`File signature doesn't match declared MIME type ${file.mimetype}`);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        detectedMimeType: file.mimetype,
        detectedExtension: ext,
    };
}
// Placeholder for virus scanning
async function scanForVirus(_file) {
    // In production, integrate with ClamAV or cloud virus scanning
    return {
        clean: true,
        threats: [],
        scannedAt: new Date(),
        scannerVersion: 'mock-1.0',
    };
}
// ============================================================================
// DOCUMENT INGESTION SERVICE
// ============================================================================
class DocumentIngestionService {
    initialized = false;
    async initialize() {
        if (this.initialized)
            return;
        // Initialize sub-services
        await Promise.all([
            (0, ocr_service_js_1.getOcrService)().initialize(),
            (0, entity_extractor_js_1.getEntityExtractor)().initialize(),
        ]);
        this.initialized = true;
        logger_js_1.logger.info('Document ingestion service initialized');
    }
    // ========================================================================
    // MAIN UPLOAD METHOD
    // ========================================================================
    async uploadDocument(file, request, userId, userNodeId) {
        if (!this.initialized) {
            await this.initialize();
        }
        // Validate file
        const validation = await validateFile(file);
        if (!validation.valid) {
            throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
        }
        // Virus scan
        const virusScan = await scanForVirus(file);
        if (!virusScan.clean) {
            throw new Error(`Virus scan failed: ${virusScan.threats.join(', ')}`);
        }
        // Compute file hash
        const { computeBufferHash } = await import('./hashing/file-hasher.js');
        const hashResult = computeBufferHash(file.buffer);
        const fileHash = hashResult.hash;
        // Check for duplicate hash in case
        const existingHash = await (0, database_js_1.pgQuery)(`SELECT id FROM documents WHERE case_id = $1 AND file_hash_sha256 = $2 AND deleted_at IS NULL`, [request.caseId, fileHash]);
        if (existingHash.rows.length > 0) {
            logger_js_1.logger.warn(`Duplicate file hash detected for case ${request.caseId}`);
            // Could either reject or allow with warning
        }
        return (0, database_js_1.pgTransaction)(async (client) => {
            const documentId = (0, uuid_1.v4)();
            const now = new Date();
            const version = 1;
            // Generate stored filename
            const ext = file.originalname.split('.').pop() || '';
            const storedFilename = `${documentId}_v${version}.${ext}`;
            const storagePath = `${request.caseId}/${storedFilename}`;
            // Encrypt and store file
            const storageService = (0, storage_service_js_1.getStorageService)();
            const encryptionResult = await storageService.encryptAndStore(file.buffer, storagePath, request.caseId);
            // Extract metadata
            const metadata = await (0, ocr_service_js_1.getOcrService)().extractMetadata(file.originalname);
            metadata.hash_verification = {
                verified: true,
                algorithm: 'SHA-256',
                expected_hash: fileHash,
            };
            // Create document record
            const documentNumber = await this.generateDocumentNumber(request.caseId, client);
            await client.query(`INSERT INTO documents (
                    id, case_id, document_number, title, description, document_type,
                    status, version, is_latest_version, original_filename, stored_filename,
                    mime_type, file_size_bytes, file_hash_sha256, file_hash_algorithm,
                    storage_path, storage_bucket, encryption_key_id, encryption_algorithm,
                    metadata, tags, uploaded_by, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW())`, [
                documentId,
                request.caseId,
                documentNumber,
                request.title,
                request.description || null,
                request.documentType,
                document_js_1.DocumentStatus.SUBMITTED,
                version,
                true,
                file.originalname,
                storedFilename,
                file.mimetype,
                file.size,
                fileHash,
                'SHA-256',
                storagePath,
                index_js_1.config.storage.bucket,
                encryptionResult.keyId,
                encryptionResult.algorithm,
                JSON.stringify(metadata),
                request.tags || [],
                userId,
            ]);
            // Record initial version
            await client.query(`INSERT INTO document_versions (
                    id, document_id, version, file_hash_sha256,
                    storage_path, file_size_bytes, metadata, created_by, created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`, [
                (0, uuid_1.v4)(),
                documentId,
                version,
                fileHash,
                storagePath,
                file.size,
                JSON.stringify(metadata),
                userId,
            ]);
            // Process OCR asynchronously (don't block upload)
            this.processOcrAsync(documentId, storagePath, request.ocrLanguage || 'eng', fileHash, userId, userNodeId);
            // Process entity extraction asynchronously
            this.processEntitiesAsync(documentId, fileHash, userId, userNodeId);
            // Record custody event
            const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
            const custodyResult = await blockchainService.recordCustodyEvent({
                txType: database_js_2.CustodyAction.UPLOAD,
                caseId: request.caseId,
                documentId,
                actorUserId: userId,
                actorNodeId: userNodeId,
                actionDetails: {
                    original_filename: file.originalname,
                    file_size_bytes: file.size,
                    mime_type: file.mimetype,
                    document_type: request.documentType,
                    document_number: documentNumber,
                    encryption_key_id: encryptionResult.keyId,
                },
            });
            // Get created document
            const docResult = await client.query(`SELECT * FROM documents WHERE id = $1`, [documentId]);
            return {
                document: this.toPublic(docResult.rows[0]),
                version: this.toVersion(docResult.rows[0]),
                custodyEvent: {
                    txId: custodyResult.tx_id,
                    blockNumber: custodyResult.block_number,
                    blockHash: custodyResult.block_hash,
                },
            };
        });
    }
    // ========================================================================
    // ASYNC OCR PROCESSING
    // ========================================================================
    async processOcrAsync(documentId, storagePath, language, fileHash, userId, userNodeId) {
        try {
            const storageService = (0, storage_service_js_1.getStorageService)();
            const fileBuffer = await storageService.retrieveAndDecrypt(storagePath, fileHash);
            const ocrResult = await (0, ocr_service_js_1.getOcrService)().recognizeFromBuffer(fileBuffer, { language });
            // Update document with OCR results
            await (0, database_js_1.pgQuery)(`UPDATE documents SET
                    ocr_text = $1,
                    ocr_language = $2,
                    ocr_confidence = $3,
                    ocr_processed_at = NOW(),
                    metadata = jsonb_set(metadata, '{ocr_pages}', $4::jsonb)
                 WHERE id = $5`, [
                ocrResult.text,
                language,
                ocrResult.confidence,
                JSON.stringify(ocrResult.pages),
                documentId,
            ]);
            // Record OCR custody event
            const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
            await blockchainService.recordCustodyEvent({
                txType: database_js_2.CustodyAction.METADATA_UPDATE,
                documentId,
                actorUserId: userId,
                actorNodeId: userNodeId,
                actionDetails: {
                    ocr_processed: true,
                    language,
                    confidence: ocrResult.confidence,
                    page_count: ocrResult.pages.length,
                },
            });
            logger_js_1.logger.info(`OCR completed for document ${documentId}: ${ocrResult.confidence}% confidence`);
        }
        catch (error) {
            logger_js_1.logger.error(`Async OCR failed for document ${documentId}:`, error);
        }
    }
    // ========================================================================
    // ASYNC ENTITY EXTRACTION
    // ========================================================================
    async processEntitiesAsync(documentId, fileHash, userId, userNodeId) {
        try {
            // Get OCR text
            const docResult = await (0, database_js_1.pgQuery)(`SELECT ocr_text FROM documents WHERE id = $1`, [documentId]);
            const ocrText = docResult.rows[0]?.ocr_text;
            if (!ocrText) {
                logger_js_1.logger.warn(`No OCR text for entity extraction on document ${documentId}`);
                return;
            }
            // Extract entities
            const entities = await (0, entity_extractor_js_1.getEntityExtractor)().extract(ocrText);
            // Update document with entities
            await (0, database_js_1.pgQuery)(`UPDATE documents SET extracted_entities = $1 WHERE id = $2`, [JSON.stringify(entities), documentId]);
            // Also update MongoDB metadata
            // In production, update MongoDB document_metadata collection
            // Record entity extraction event
            const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
            await blockchainService.recordCustodyEvent({
                txType: database_js_2.CustodyAction.METADATA_UPDATE,
                documentId,
                actorUserId: userId,
                actorNodeId: userNodeId,
                actionDetails: {
                    entities_extracted: true,
                    entity_counts: {
                        persons: entities.persons.length,
                        organizations: entities.organizations.length,
                        locations: entities.locations.length,
                        case_numbers: entities.case_numbers.length,
                        ipc_sections: entities.ipc_sections.length,
                    },
                },
            });
            logger_js_1.logger.info(`Entity extraction completed for document ${documentId}`);
        }
        catch (error) {
            logger_js_1.logger.error(`Async entity extraction failed for document ${documentId}:`, error);
        }
    }
    // ========================================================================
    // DOCUMENT RETRIEVAL
    // ========================================================================
    async getDocument(documentId) {
        const result = await (0, database_js_1.pgQuery)(`SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL`, [documentId]);
        return result.rows[0] ? this.toPublic(result.rows[0]) : null;
    }
    async getDocumentWithVersions(documentId) {
        const doc = await this.getDocument(documentId);
        if (!doc)
            return null;
        const versions = await (0, version_manager_js_1.getVersionManager)().getVersionHistory(documentId);
        return { document: doc, versions };
    }
    async listDocuments(filters) {
        const conditions = ['deleted_at IS NULL'];
        const params = [];
        let paramIndex = 1;
        if (filters.caseId) {
            conditions.push(`case_id = $${paramIndex++}`);
            params.push(filters.caseId);
        }
        if (filters.documentType) {
            conditions.push(`document_type = $${paramIndex++}`);
            params.push(filters.documentType);
        }
        if (filters.status) {
            conditions.push(`status = $${paramIndex++}`);
            params.push(filters.status);
        }
        if (filters.uploadedBy) {
            conditions.push(`uploaded_by = $${paramIndex++}`);
            params.push(filters.uploadedBy);
        }
        if (filters.tags && filters.tags.length > 0) {
            conditions.push(`tags && $${paramIndex++}`);
            params.push(filters.tags);
        }
        const whereClause = conditions.join(' AND ');
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;
        params.push(limit, offset);
        const [docsResult, countResult] = await Promise.all([
            (0, database_js_1.pgQuery)(`SELECT * FROM documents WHERE ${whereClause} AND is_latest_version = TRUE ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`, params),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as total FROM documents WHERE ${whereClause} AND is_latest_version = TRUE`, params.slice(0, -2)),
        ]);
        const total = parseInt(countResult.rows[0].total, 10);
        return {
            documents: docsResult.rows.map(d => this.toPublic(d)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    // ========================================================================
    // DOCUMENT DOWNLOAD/STREAM
    // ========================================================================
    async getDocumentStream(documentId) {
        const doc = await (0, database_js_1.pgQuery)(`SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL`, [documentId]);
        if (doc.rows.length === 0)
            return null;
        const document = doc.rows[0];
        const storageService = (0, storage_service_js_1.getStorageService)();
        const stream = await storageService.retrieveStream(document.storage_path, document.file_hash_sha256);
        return {
            stream,
            filename: document.original_filename,
            mimeType: document.mime_type,
            size: document.file_size_bytes,
        };
    }
    // ========================================================================
    // DOCUMENT UPDATE (creates new version)
    // ========================================================================
    async updateDocument(documentId, file, changesSummary, userId, userNodeId) {
        return (0, version_manager_js_1.getVersionManager)().createVersion({
            documentId,
            file,
            changesSummary,
            fileHash: (await import('./hashing/file-hasher.js')).computeBufferHash(file.buffer).hash,
            ocrText: undefined,
            metadata: {},
            uploadedBy: userId,
        });
    }
    // ========================================================================
    // REDACTION
    // ========================================================================
    async redactDocument(documentId, redactions, reason, userId, userNodeId) {
        // This would:
        // 1. Retrieve original document
        // 2. Apply redactions using sharp/pdf-lib
        // 3. Store redacted version
        // 4. Create new version with REDACTION custody event
        // 5. Return both documents
        throw new Error('Redaction not yet implemented');
    }
    // ========================================================================
    // EXPORT
    // ========================================================================
    async exportDocuments(documentIds, format, userId, userNodeId) {
        // Record export custody event
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        for (const docId of documentIds) {
            await blockchainService.recordCustodyEvent({
                txType: database_js_2.CustodyAction.EXPORT,
                documentId: docId,
                actorUserId: userId,
                actorNodeId: userNodeId,
                actionDetails: {
                    export_format: format,
                    exported_document_ids: documentIds,
                },
            });
        }
        // In production, create export package
        const exportId = (0, uuid_1.v4)();
        return {
            exportId,
            downloadUrl: `/api/v1/exports/${exportId}/download`,
        };
    }
    // ========================================================================
    // DOCUMENT DELETION (soft delete)
    // ========================================================================
    async deleteDocument(documentId, userId, userNodeId) {
        await (0, database_js_1.pgQuery)(`UPDATE documents SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [documentId]);
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: database_js_2.CustodyAction.VERSION_CREATE, // Or new action type
            documentId,
            actorUserId: userId,
            actorNodeId: userNodeId,
            actionDetails: {
                action: 'soft_delete',
            },
        });
    }
    // ========================================================================
    // HELPER METHODS
    // ========================================================================
    async generateDocumentNumber(caseId, client) {
        const result = await client.query(`SELECT COUNT(*) as count FROM documents WHERE case_id = $1`, [caseId]);
        const count = parseInt(result.rows[0].count, 10) + 1;
        return `DOC/${caseId.slice(0, 8)}/${count.toString().padStart(5, '0')}`;
    }
    toPublic(doc) {
        return {
            id: doc.id,
            case_id: doc.case_id,
            document_number: doc.document_number,
            title: doc.title,
            description: doc.description,
            document_type: doc.document_type,
            status: doc.status,
            version: doc.version,
            is_latest_version: doc.is_latest_version,
            original_filename: doc.original_filename,
            mime_type: doc.mime_type,
            file_size_bytes: doc.file_size_bytes,
            file_hash_sha256: doc.file_hash_sha256,
            ocr_text: doc.ocr_text,
            ocr_confidence: doc.ocr_confidence,
            tags: doc.tags,
            uploaded_by: doc.uploaded_by,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
        };
    }
    toVersion(doc) {
        return {
            id: (0, uuid_1.v4)(),
            document_id: doc.id,
            version: doc.version,
            file_hash_sha256: doc.file_hash_sha256,
            storage_path: doc.storage_path,
            file_size_bytes: doc.file_size_bytes,
            metadata: doc.metadata,
            created_by: doc.uploaded_by,
            created_at: doc.created_at,
        };
    }
}
exports.DocumentIngestionService = DocumentIngestionService;
// ============================================================================
// MULTER CONFIGURATION
// ============================================================================
exports.uploadMiddleware = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: index_js_1.config.ingestion.maxFileSize,
        files: 1,
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`File type ${file.mimetype} not allowed`));
        }
    },
});
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let ingestionServiceInstance = null;
function getDocumentIngestionService() {
    if (!ingestionServiceInstance) {
        ingestionServiceInstance = new DocumentIngestionService();
    }
    return ingestionServiceInstance;
}
async function initializeDocumentIngestion() {
    const service = getDocumentIngestionService();
    await service.initialize();
    return service;
}
//# sourceMappingURL=ingestion.service.js.map