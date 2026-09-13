/**
 * ADALAT360 - Document Ingestion Service
 * Main service orchestrating file upload, validation, OCR, hashing, versioning, and storage
 */
import multer from 'multer';
import { DocumentPublic, UploadRequest, UploadResponse, DocumentVersion, DocumentType, DocumentStatus } from '../models/document.js';
export declare class DocumentIngestionService {
    private initialized;
    initialize(): Promise<void>;
    uploadDocument(file: Express.Multer.File, request: UploadRequest, userId: string, userNodeId: string): Promise<UploadResponse>;
    private processOcrAsync;
    private processEntitiesAsync;
    getDocument(documentId: string): Promise<DocumentPublic | null>;
    getDocumentWithVersions(documentId: string): Promise<{
        document: DocumentPublic;
        versions: DocumentVersion[];
    } | null>;
    listDocuments(filters: {
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
    }>;
    getDocumentStream(documentId: string): Promise<{
        stream: NodeJS.ReadableStream;
        filename: string;
        mimeType: string;
        size: number;
    } | null>;
    updateDocument(documentId: string, file: Express.Multer.File, changesSummary: string, userId: string, userNodeId: string): Promise<UploadResponse>;
    redactDocument(documentId: string, redactions: Array<{
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
        label?: string;
    }>, reason: string, userId: string, userNodeId: string): Promise<{
        originalDocument: DocumentPublic;
        redactedDocument: DocumentPublic;
    }>;
    exportDocuments(documentIds: string[], format: 'pdf' | 'zip' | 'original', userId: string, userNodeId: string): Promise<{
        exportId: string;
        downloadUrl: string;
    }>;
    deleteDocument(documentId: string, userId: string, userNodeId: string): Promise<void>;
    private generateDocumentNumber;
    private toPublic;
    private toVersion;
}
export declare const uploadMiddleware: multer.Multer;
export declare function getDocumentIngestionService(): DocumentIngestionService;
export declare function initializeDocumentIngestion(): Promise<DocumentIngestionService>;
//# sourceMappingURL=ingestion.service.d.ts.map