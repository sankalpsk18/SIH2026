/**
 * ADALAT360 - Document Version Manager
 * Immutable versioning system for documents
 * Every edit creates a new version; originals are never overwritten
 */

import { v4 as uuidv4 } from 'uuid';
import { pgQuery, pgTransaction } from '../../config/database.js';
import { getBlockchainService } from '../../blockchain/blockchain.service.js';
import { CustodyAction, ConsensusStatus } from '../../types/database.js';
import { logger } from '../../utils/logger.js';
import {
    Document,
    DocumentVersion,
    VersionCreateRequest,
    VersionResponse,
    DocumentPublic,
} from '../../models/document.js';

// ============================================================================
// VERSION MANAGER CLASS
// ============================================================================

export class VersionManager {
    // ========================================================================
    // CREATE NEW VERSION
    // ========================================================================

    async createVersion(request: VersionCreateRequest): Promise<VersionResponse> {
        return pgTransaction(async (client) => {
            // Get current document
            const docResult = await client.query<Document>(
                `SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL`,
                [request.documentId]
            );

            if (docResult.rows.length === 0) {
                throw new Error('Document not found');
            }

            const currentDoc = docResult.rows[0];

            // Verify file hash
            // In production, compute hash from uploaded file
            // For now, we'll accept it as part of request
            // const newFileHash = request.fileHash; // Would come from file hasher

            const newVersion = currentDoc.version + 1;
            const versionId = uuidv4();
            const now = new Date();

            // Generate stored filename for new version
            const ext = currentDoc.original_filename.split('.').pop() || '';
            const storedFilename = `${currentDoc.id}_v${newVersion}.${ext}`;
            const storagePath = `${currentDoc.case_id}/${storedFilename}`;

            // Create new document version (becomes latest)
            // First, mark old version as not latest
            await client.query(
                `UPDATE documents SET is_latest_version = FALSE, updated_at = NOW() WHERE id = $1`,
                [request.documentId]
            );

            // Insert new version as latest
            const newDocId = uuidv4();
            await client.query(
                `INSERT INTO documents (
                    id, case_id, document_number, title, description, document_type,
                    status, version, is_latest_version, parent_document_id,
                    original_filename, stored_filename, mime_type, file_size_bytes,
                    file_hash_sha256, file_hash_algorithm, storage_path, storage_bucket,
                    encryption_key_id, encryption_algorithm, metadata, tags,
                    uploaded_by, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW())
                RETURNING *`,
                [
                    newDocId,
                    currentDoc.case_id,
                    currentDoc.document_number, // Same document number
                    currentDoc.title,
                    currentDoc.description,
                    currentDoc.document_type,
                    currentDoc.status,
                    newVersion,
                    true, // is_latest_version
                    currentDoc.id, // parent_document_id
                    currentDoc.original_filename,
                    storedFilename,
                    currentDoc.mime_type,
                    request.file.size, // file_size_bytes
                    request.fileHash, // file_hash_sha256
                    currentDoc.file_hash_algorithm,
                    storagePath,
                    currentDoc.storage_bucket,
                    currentDoc.encryption_key_id,
                    currentDoc.encryption_algorithm,
                    currentDoc.metadata,
                    currentDoc.tags,
                    request.uploadedBy,
                ]
            );

            // Store in document_versions table
            await client.query(
                `INSERT INTO document_versions (
                    id, document_id, version, file_hash_sha256,
                    storage_path, file_size_bytes, changes_summary,
                    ocr_text, metadata, created_by, created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
                [
                    uuidv4(),
                    currentDoc.id, // Original document ID
                    newVersion,
                    request.fileHash,
                    storagePath,
                    request.file.size,
                    request.changesSummary,
                    request.ocrText || null,
                    JSON.stringify(request.metadata || {}),
                    request.uploadedBy,
                ]
            );

            // Record custody event
            const blockchainService = getBlockchainService();
            await blockchainService.recordCustodyEvent({
                txType: CustodyAction.VERSION_CREATE,
                caseId: currentDoc.case_id,
                documentId: newDocId,
                actorUserId: request.uploadedBy,
                actorNodeId: 'OfficerMSP', // Would come from user context
                actionDetails: {
                    original_document_id: currentDoc.id,
                    version: newVersion,
                    changes_summary: request.changesSummary,
                    file_size_bytes: request.file.size,
                    mime_type: request.file.mimetype,
                },
            });

            // Get the new document
            const newDocResult = await client.query<Document>(
                `SELECT * FROM documents WHERE id = $1`,
                [newDocId]
            );

            const newDoc = newDocResult.rows[0];
            const version = newDocResult.rows[0];

            return {
                document: this.toPublic(newDoc),
                newVersion: this.toVersion(newDoc),
                custodyEvent: {
                    txId: '', // Would come from blockchain service
                    blockNumber: 0,
                    blockHash: '',
                },
            };
        });
    }

    // ========================================================================
    // GET VERSION HISTORY
    // ========================================================================

    async getVersionHistory(documentId: string): Promise<DocumentVersion[]> {
        const result = await pgQuery<DocumentVersion>(
            `SELECT * FROM document_versions WHERE document_id = $1 ORDER BY version ASC`,
            [documentId]
        );
        return result.rows;
    }

    async getVersion(documentId: string, version: number): Promise<DocumentVersion | null> {
        const result = await pgQuery<DocumentVersion>(
            `SELECT * FROM document_versions WHERE document_id = $1 AND version = $2`,
            [documentId, version]
        );
        return result.rows[0] || null;
    }

    async getLatestVersion(documentId: string): Promise<Document | null> {
        const result = await pgQuery<Document>(
            `SELECT * FROM documents WHERE id = $1 AND is_latest_version = TRUE AND deleted_at IS NULL`,
            [documentId]
        );
        return result.rows[0] || null;
    }

    // ========================================================================
    // GET ALL VERSIONS OF A DOCUMENT LINEAGE
    // ========================================================================

    async getDocumentLineage(documentId: string): Promise<Document[]> {
        // Find root document
        let rootResult = await pgQuery<Document>(
            `SELECT * FROM documents WHERE id = $1`,
            [documentId]
        );

        if (rootResult.rows.length === 0) return [];

        let rootDoc = rootResult.rows[0];
        while (rootDoc.parent_document_id) {
            const parentResult = await pgQuery<Document>(
                `SELECT * FROM documents WHERE id = $1`,
                [rootDoc.parent_document_id]
            );
            if (parentResult.rows.length === 0) break;
            rootDoc = parentResult.rows[0];
        }

        // Get all descendants
        const result = await pgQuery<Document>(
            `SELECT * FROM documents WHERE parent_document_id = $1 OR id = $1 ORDER BY version ASC`,
            [rootDoc.id]
        );

        return result.rows;
    }

    // ========================================================================
    // REVERT TO PREVIOUS VERSION
    // ========================================================================

    async revertToVersion(
        documentId: string,
        targetVersion: number,
        userId: string,
        reason: string
    ): Promise<VersionResponse> {
        return pgTransaction(async (client) => {
            // Get target version
            const targetDoc = await this.getVersion(documentId, targetVersion);
            if (!targetDoc) {
                throw new Error(`Version ${targetVersion} not found`);
            }

            // Get current latest
            const currentDoc = await this.getLatestVersion(documentId);
            if (!currentDoc) {
                throw new Error('Current document not found');
            }

            if (currentDoc.version === targetVersion) {
                throw new Error('Already at target version');
            }

            // Create new version based on target
            const newVersion = currentDoc.version + 1;
            const newDocId = uuidv4();
            const ext = currentDoc.original_filename.split('.').pop() || '';
            const storedFilename = `${documentId}_v${newVersion}.${ext}`;
            const storagePath = `${currentDoc.case_id}/${storedFilename}`;

            // Mark old as not latest
            await client.query(
                `UPDATE documents SET is_latest_version = FALSE, updated_at = NOW() WHERE id = $1`,
                [currentDoc.id]
            );

            // Create reverted version
            await client.query(
                `INSERT INTO documents (
                    id, case_id, document_number, title, description, document_type,
                    status, version, is_latest_version, parent_document_id,
                    original_filename, stored_filename, mime_type, file_size_bytes,
                    file_hash_sha256, file_hash_algorithm, storage_path, storage_bucket,
                    encryption_key_id, encryption_algorithm, metadata, tags,
                    uploaded_by, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW())`,
                [
                    newDocId,
                    currentDoc.case_id,
                    currentDoc.document_number,
                    currentDoc.title,
                    currentDoc.description,
                    currentDoc.document_type,
                    currentDoc.status,
                    newVersion,
                    true,
                    currentDoc.id,
                    currentDoc.original_filename,
                    storedFilename,
                    currentDoc.mime_type,
                    targetDoc.file_size_bytes || currentDoc.file_size_bytes,
                    targetDoc.file_hash_sha256,
                    currentDoc.file_hash_algorithm,
                    storagePath, // In reality, would copy file from target version's storage
                    currentDoc.storage_bucket,
                    currentDoc.encryption_key_id,
                    currentDoc.encryption_algorithm,
                    currentDoc.metadata,
                    currentDoc.tags,
                    userId,
                ]
            );

            // Record in versions table
            await client.query(
                `INSERT INTO document_versions (
                    id, document_id, version, file_hash_sha256,
                    storage_path, file_size_bytes, changes_summary,
                    metadata, created_by, created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
                [
                    uuidv4(),
                    documentId,
                    newVersion,
                    targetDoc.file_hash_sha256,
                    storagePath,
                    targetDoc.file_size_bytes || currentDoc.file_size_bytes,
                    `Reverted to version ${targetVersion}: ${reason}`,
                    JSON.stringify({ reverted_from: targetVersion, reason }),
                    userId,
                ]
            );

            // Record custody event
            const blockchainService = getBlockchainService();
            await blockchainService.recordCustodyEvent({
                txType: CustodyAction.VERSION_CREATE,
                caseId: currentDoc.case_id,
                documentId: newDocId,
                actorUserId: userId,
                actorNodeId: 'OfficerMSP',
                actionDetails: {
                    original_document_id: currentDoc.id,
                    version: newVersion,
                    reverted_from: targetVersion,
                    reason,
                },
            });

            // Get new document
            const newDocResult = await client.query<Document>(
                `SELECT * FROM documents WHERE id = $1`,
                [newDocId]
            );

            return {
                document: this.toPublic(newDocResult.rows[0]),
                newVersion: this.toVersion(newDocResult.rows[0]),
                custodyEvent: { txId: '', blockNumber: 0, blockHash: '' },
            };
        });
    }

    // ========================================================================
    // COMPARE VERSIONS
    // ========================================================================

    async compareVersions(documentId: string, version1: number, version2: number): Promise<{
        version1: DocumentVersion;
        version2: DocumentVersion;
        hashMatch: boolean;
        sizeDifference: number;
    }> {
        const [v1, v2] = await Promise.all([
            this.getVersion(documentId, version1),
            this.getVersion(documentId, version2),
        ]);

        if (!v1 || !v2) {
            throw new Error('One or both versions not found');
        }

        return {
            version1: v1,
            version2: v2,
            hashMatch: v1.file_hash_sha256 === v2.file_hash_sha256,
            sizeDifference: (v2.file_size_bytes || 0) - (v1.file_size_bytes || 0),
        };
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

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
            id: uuidv4(), // Would be the actual version record ID
            document_id: doc.id,
            version: doc.version,
            file_hash_sha256: doc.file_hash_sha256,
            storage_path: doc.storage_path,
            file_size_bytes: doc.file_size_bytes,
            changes_summary: undefined,
            ocr_text: doc.ocr_text,
            metadata: doc.metadata,
            created_by: doc.uploaded_by,
            created_at: doc.created_at,
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let versionManagerInstance: VersionManager | null = null;

export function getVersionManager(): VersionManager {
    if (!versionManagerInstance) {
        versionManagerInstance = new VersionManager();
    }
    return versionManagerInstance;
}