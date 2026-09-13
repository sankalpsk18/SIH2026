/**
 * ADALAT360 - Document Ingestion Service
 * Main service orchestrating file upload, validation, OCR, hashing, versioning, and storage
 */

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import multer from 'multer';
import { config } from '@config/index.js';
import { logger } from '@utils/logger.js';
import { pgQuery, pgTransaction } from '@config/database.js';
import { getBlockchainService } from '@blockchain/blockchain.service.js';
import { getOcrService } from './ocr/ocr-service.js';
import { getEntityExtractor } from './metadata/entity-extractor.js';
import { getVersionManager } from './versioning/version-manager.js';
import { getStorageService } from '@storage/storage.service.js';
import { CustodyAction, ConsensusStatus } from '@types/database.js';
import { logAuditEvent } from '@services/audit.service.js';
import {
    Document,
    DocumentPublic,
    UploadRequest,
    UploadResponse,
    DocumentVersion,
    DocumentType,
    DocumentStatus,
    FileValidationResult,
    VirusScanResult,
    ExtractedEntities,
    DocumentMetadata,
    OcrResult,
} from '../models/document.js';

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

const MAGIC_BYTES: Record<string, number[][]> = {
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

async function validateFile(file: Express.Multer.File): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (file.size > config.ingestion.maxFileSize) {
        errors.push(`File size ${file.size} exceeds maximum allowed ${config.ingestion.maxFileSize} bytes`);
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
        const matches = signatures.some(sig =>
            sig.every((byte, i) => file.buffer![i] === byte)
        );
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
async function scanForVirus(_file: Express.Multer.File): Promise<VirusScanResult> {
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

export class DocumentIngestionService {
    private initialized: boolean = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Initialize sub-services
        await Promise.all([
            getOcrService().initialize(),
            getEntityExtractor().initialize(),
        ]);

        this.initialized = true;
        logger.info('Document ingestion service initialized');
    }

    // ========================================================================
    // MAIN UPLOAD METHOD
    // ========================================================================

    async uploadDocument(
        file: Express.Multer.File,
        request: UploadRequest,
        userId: string,
        userNodeId: string
    ): Promise<UploadResponse> {
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
        const existingHash = await pgQuery(
            `SELECT id FROM documents WHERE case_id = $1 AND file_hash_sha256 = $2 AND deleted_at IS NULL`,
            [request.caseId, fileHash]
        );

        if (existingHash.rows.length > 0) {
            logger.warn(`Duplicate file hash detected for case ${request.caseId}`);
            // Could either reject or allow with warning
        }

        return pgTransaction(async (client) => {
            const documentId = uuidv4();
            const now = new Date();
            const version = 1;

            // Generate stored filename
            const ext = file.originalname.split('.').pop() || '';
            const storedFilename = `${documentId}_v${version}.${ext}`;
            const storagePath = `${request.caseId}/${storedFilename}`;

            // Encrypt and store file
            const storageService = getStorageService();
            const encryptionResult = await storageService.encryptAndStore(
                file.buffer,
                storagePath,
                request.caseId
            );

            // Extract metadata
            const metadata = await getOcrService().extractMetadata(file.originalname);
            metadata.hash_verification = {
                verified: true,
                algorithm: 'SHA-256',
                expected_hash: fileHash,
            };

            // Create document record
            const documentNumber = await this.generateDocumentNumber(request.caseId, client);

            await client.query(
                `INSERT INTO documents (
                    id, case_id, document_number, title, description, document_type,
                    status, version, is_latest_version, original_filename, stored_filename,
                    mime_type, file_size_bytes, file_hash_sha256, file_hash_algorithm,
                    storage_path, storage_bucket, encryption_key_id, encryption_algorithm,
                    metadata, tags, uploaded_by, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW())`,
                [
                    documentId,
                    request.caseId,
                    documentNumber,
                    request.title,
                    request.description || null,
                    request.documentType,
                    DocumentStatus.SUBMITTED,
                    version,
                    true,
                    file.originalname,
                    storedFilename,
                    file.mimetype,
                    file.size,
                    fileHash,
                    'SHA-256',
                    storagePath,
                    config.storage.bucket,
                    encryptionResult.keyId,
                    encryptionResult.algorithm,
                    JSON.stringify(metadata),
                    request.tags || [],
                    userId,
                ]
            );

            // Record initial version
            await client.query(
                `INSERT INTO document_versions (
                    id, document_id, version, file_hash_sha256,
                    storage_path, file_size_bytes, metadata, created_by, created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
                [
                    uuidv4(),
                    documentId,
                    version,
                    fileHash,
                    storagePath,
                    file.size,
                    JSON.stringify(metadata),
                    userId,
                ]
            );

            // Process OCR asynchronously (don't block upload)
            this.processOcrAsync(documentId, storagePath, request.ocrLanguage || 'eng', fileHash, userId, userNodeId);

            // Process entity extraction asynchronously
            this.processEntitiesAsync(documentId, fileHash, userId, userNodeId);

            // Record custody event
            const blockchainService = getBlockchainService();
            const custodyResult = await blockchainService.recordCustodyEvent({
                txType: CustodyAction.UPLOAD,
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
            const docResult = await client.query<Document>(
                `SELECT * FROM documents WHERE id = $1`,
                [documentId]
            );

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

    private async processOcrAsync(
        documentId: string,
        storagePath: string,
        language: string,
        fileHash: string,
        userId: string,
        userNodeId: string
    ): Promise<void> {
        try {
            const storageService = getStorageService();
            const fileBuffer = await storageService.retrieveAndDecrypt(storagePath, fileHash);

            const ocrResult = await getOcrService().recognizeFromBuffer(fileBuffer, { language });

            // Update document with OCR results
            await pgQuery(
                `UPDATE documents SET
                    ocr_text = $1,
                    ocr_language = $2,
                    ocr_confidence = $3,
                    ocr_processed_at = NOW(),
                    metadata = jsonb_set(metadata, '{ocr_pages}', $4::jsonb)
                 WHERE id = $5`,
                [
                    ocrResult.text,
                    language,
                    ocrResult.confidence,
                    JSON.stringify(ocrResult.pages),
                    documentId,
                ]
            );

            // Record OCR custody event
            const blockchainService = getBlockchainService();
            await blockchainService.recordCustodyEvent({
                txType: CustodyAction.METADATA_UPDATE,
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

            logger.info(`OCR completed for document ${documentId}: ${ocrResult.confidence}% confidence`);
        } catch (error) {
            logger.error(`Async OCR failed for document ${documentId}:`, error);
        }
    }

    // ========================================================================
    // ASYNC ENTITY EXTRACTION
    // ========================================================================

    private async processEntitiesAsync(
        documentId: string,
        fileHash: string,
        userId: string,
        userNodeId: string
    ): Promise<void> {
        try {
            // Get OCR text
            const docResult = await pgQuery(
                `SELECT ocr_text FROM documents WHERE id = $1`,
                [documentId]
            );

            const ocrText = docResult.rows[0]?.ocr_text;
            if (!ocrText) {
                logger.warn(`No OCR text for entity extraction on document ${documentId}`);
                return;
            }

            // Extract entities
            const entities = await getEntityExtractor().extract(ocrText);

            // Update document with entities
            await pgQuery(
                `UPDATE documents SET extracted_entities = $1 WHERE id = $2`,
                [JSON.stringify(entities), documentId]
            );

            // Also update MongoDB metadata
            // In production, update MongoDB document_metadata collection

            // Record entity extraction event
            const blockchainService = getBlockchainService();
            await blockchainService.recordCustodyEvent({
                txType: CustodyAction.METADATA_UPDATE,
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

            logger.info(`Entity extraction completed for document ${documentId}`);
        } catch (error) {
            logger.error(`Async entity extraction failed for document ${documentId}:`, error);
        }
    }

    // ========================================================================
    // DOCUMENT RETRIEVAL
    // ========================================================================

    async getDocument(documentId: string): Promise<DocumentPublic | null> {
        const result = await pgQuery<Document>(
            `SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL`,
            [documentId]
        );
        return result.rows[0] ? this.toPublic(result.rows[0]) : null;
    }

    async getDocumentWithVersions(documentId: string): Promise<{
        document: DocumentPublic;
        versions: DocumentVersion[];
    } | null> {
        const doc = await this.getDocument(documentId);
        if (!doc) return null;

        const versions = await getVersionManager().getVersionHistory(documentId);
        return { document: doc, versions };
    }

    async listDocuments(filters: {
        caseId?: string;
        documentType?: DocumentType;
        status?: DocumentStatus;
        uploadedBy?: string;
        tags?: string[];
        page?: number;
        limit?: number;
    }): Promise<{
        documents: DocumentPublic[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const conditions: string[] = ['deleted_at IS NULL'];
        const params: any[] = [];
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
            pgQuery<Document>(
                `SELECT * FROM documents WHERE ${whereClause} AND is_latest_version = TRUE ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
                params
            ),
            pgQuery(
                `SELECT COUNT(*) as total FROM documents WHERE ${whereClause} AND is_latest_version = TRUE`,
                params.slice(0, -2)
            ),
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

    async getDocumentStream(documentId: string): Promise<{
        stream: NodeJS.ReadableStream;
        filename: string;
        mimeType: string;
        size: number;
    } | null> {
        const doc = await pgQuery<Document>(
            `SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL`,
            [documentId]
        );

        if (doc.rows.length === 0) return null;

        const document = doc.rows[0];
        const storageService = getStorageService();
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

    async updateDocument(
        documentId: string,
        file: Express.Multer.File,
        changesSummary: string,
        userId: string,
        userNodeId: string
    ): Promise<UploadResponse> {
        return getVersionManager().createVersion({
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

    async redactDocument(
        documentId: string,
        redactions: Array<{ page: number; x: number; y: number; width: number; height: number; label?: string }>,
        reason: string,
        userId: string,
        userNodeId: string
    ): Promise<{ originalDocument: DocumentPublic; redactedDocument: DocumentPublic }> {
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

    async exportDocuments(
        documentIds: string[],
        format: 'pdf' | 'zip' | 'original',
        userId: string,
        userNodeId: string
    ): Promise<{ exportId: string; downloadUrl: string }> {
        // Record export custody event
        const blockchainService = getBlockchainService();
        for (const docId of documentIds) {
            await blockchainService.recordCustodyEvent({
                txType: CustodyAction.EXPORT,
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
        const exportId = uuidv4();
        return {
            exportId,
            downloadUrl: `/api/v1/exports/${exportId}/download`,
        };
    }

    // ========================================================================
    // DOCUMENT DELETION (soft delete)
    // ========================================================================

    async deleteDocument(documentId: string, userId: string, userNodeId: string): Promise<void> {
        await pgQuery(
            `UPDATE documents SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [documentId]
        );

        const blockchainService = getBlockchainService();
        await blockchainService.recordCustodyEvent({
            txType: CustodyAction.VERSION_CREATE, // Or new action type
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

    private async generateDocumentNumber(caseId: string, client: any): Promise<string> {
        const result = await client.query(
            `SELECT COUNT(*) as count FROM documents WHERE case_id = $1`,
            [caseId]
        );
        const count = parseInt(result.rows[0].count, 10) + 1;
        return `DOC/${caseId.slice(0, 8)}/${count.toString().padStart(5, '0')}`;
    }

    private toPublic(doc: Document): DocumentPublic {
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

    private toVersion(doc: Document): DocumentVersion {
        return {
            id: uuidv4(),
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

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

export const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.ingestion.maxFileSize,
        files: 1,
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} not allowed`));
        }
    },
});

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let ingestionServiceInstance: DocumentIngestionService | null = null;

export function getDocumentIngestionService(): DocumentIngestionService {
    if (!ingestionServiceInstance) {
        ingestionServiceInstance = new DocumentIngestionService();
    }
    return ingestionServiceInstance;
}

export async function initializeDocumentIngestion(): Promise<DocumentIngestionService> {
    const service = getDocumentIngestionService();
    await service.initialize();
    return service;
}