/**
 * ADALAT360 - Document Models
 * TypeScript interfaces for document management
 */

import { DocumentType, DocumentStatus, CustodyAction } from '../types/database.js';

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export interface Document {
    id: string;
    case_id: string;
    document_number: string;
    title: string;
    description?: string;
    document_type: DocumentType;
    status: DocumentStatus;
    version: number;
    is_latest_version: boolean;
    parent_document_id?: string;
    original_filename: string;
    stored_filename: string;
    mime_type: string;
    file_size_bytes: number;
    file_hash_sha256: string;
    file_hash_algorithm: string;
    storage_path: string;
    storage_bucket: string;
    encryption_key_id?: string;
    encryption_algorithm: string;
    ocr_text?: string;
    ocr_language: string;
    ocr_confidence?: number;
    ocr_processed_at?: Date;
    metadata: Record<string, any>;
    extracted_entities: Record<string, any>;
    tags: string[];
    uploaded_by: string;
    verified_by?: string;
    verified_at?: Date;
    approved_by?: string;
    approved_at?: Date;
    created_at: Date;
    updated_at: Date;
    deleted_at?: Date;
}

export interface DocumentPublic {
    id: string;
    case_id: string;
    document_number: string;
    title: string;
    description?: string;
    document_type: DocumentType;
    status: DocumentStatus;
    version: number;
    is_latest_version: boolean
    original_filename: string;
    mime_type: string;
    file_size_bytes: number;
    file_hash_sha256: string;
    ocr_text?: string;
    ocr_confidence?: number;
    tags: string[];
    uploaded_by: string;
    created_at: Date;
    updated_at: Date;
}

export interface DocumentVersion {
    id: string;
    document_id: string;
    version: number;
    file_hash_sha256: string;
    storage_path: string;
    file_size_bytes: number;
    changes_summary?: string;
    ocr_text?: string;
    metadata: Record<string, any>;
    created_by: string;
    created_at: Date;
}

// ============================================================================
// UPLOAD TYPES
// ============================================================================

export interface UploadRequest {
    caseId: string;
    title: string;
    description?: string;
    documentType: DocumentType;
    tags?: string[];
    ocrLanguage?: string;
}

export interface UploadResponse {
    document: DocumentPublic;
    version: DocumentVersion;
    custodyEvent: {
        txId: string;
        blockNumber: number;
        blockHash: string;
    };
}

export interface MultipartUploadRequest {
    case_id: string;
    title: string;
    description?: string;
    document_type: DocumentType;
    tags?: string;
    ocr_language?: string;
    file: Express.Multer.File;
}

// ============================================================================
// OCR TYPES
// ============================================================================

export interface OcrResult {
    text: string;
    confidence: number;
    language: string;
    pages: OcrPageResult[];
    processing_time_ms: number;
}

export interface OcrPageResult {
    page_number: number;
    text: string;
    confidence: number;
    bbox?: number[]; // [x1, y1, x2, y2]
    words?: OcrWordResult[];
}

export interface OcrWordResult {
    text: string;
    confidence: number;
    bbox: number[];
}

export interface OcrOptions {
    language?: string;
    dpi?: number;
    psm?: number; // Page segmentation mode
    oem?: number; // OCR engine mode
}

// ============================================================================
// ENTITY EXTRACTION TYPES
// ============================================================================

export interface ExtractedEntities {
    persons: string[];
    organizations: string[];
    locations: string[];
    dates: string[];
    case_numbers: string[];
    ipc_sections: string[];
    bns_sections: string[];
    phone_numbers: string[];
    email_addresses: string[];
    vehicle_numbers: string[];
    aadhaar_numbers: string[];
    pan_numbers: string[];
    bank_accounts: string[];
    custom_entities: Record<string, string[]>;
}

export interface EntityExtractionOptions {
    model?: string;
    language?: string;
    custom_patterns?: Record<string, RegExp>;
}

// ============================================================================
// METADATA EXTRACTION TYPES
// ============================================================================

export interface DocumentMetadata {
    author?: string;
    creator_tool?: string;
    creation_date?: Date;
    modification_date?: Date;
    page_count?: number;
    word_count?: number;
    character_count?: number;
    language?: string;
    device_info?: Record<string, any>;
    location?: Record<string, any>;
    camera_info?: Record<string, any>;
    gps_coordinates?: Record<string, any>;
    hash_verification?: {
        verified: boolean;
        algorithm: string;
        expected_hash?: string;
    };
}

// ============================================================================
// VERSIONING TYPES
// ============================================================================

export interface VersionCreateRequest {
    documentId: string;
    file: Express.Multer.File;
    changesSummary: string;
    uploadedBy: string;
}

export interface VersionResponse {
    document: DocumentPublic;
    newVersion: DocumentVersion;
    custodyEvent: {
        txId: string;
        blockNumber: number;
        blockHash: string;
    };
}

// ============================================================================
// SEARCH & FILTER TYPES
// ============================================================================

export interface DocumentFilter {
    caseId?: string;
    documentType?: DocumentType;
    status?: DocumentStatus;
    uploadedBy?: string;
    tags?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    hasOcr?: boolean;
    searchText?: string;
}

export interface DocumentListOptions {
    filter?: DocumentFilter;
    page: number;
    limit: number;
    sortBy?: 'created_at' | 'updated_at' | 'title' | 'document_number';
    sortOrder?: 'asc' | 'desc';
}

export interface DocumentListResponse {
    documents: DocumentPublic[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ============================================================================
// REDACTION TYPES
// ============================================================================

export interface RedactionRequest {
    documentId: string;
    redactions: RedactionArea[];
    reason: string;
    redactedBy: string;
}

export interface RedactionArea {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
}

export interface RedactionResponse {
    originalDocument: DocumentPublic;
    redactedDocument: DocumentPublic;
    redactionLog: RedactionLogEntry;
    custodyEvent: {
        txId: string;
        blockNumber: number;
        blockHash: string;
    };
}

export interface RedactionLogEntry {
    id: string;
    document_id: string;
    original_document_id: string;
    redactions: RedactionArea[];
    reason: string;
    redacted_by: string;
    redacted_at: Date;
    blockchain_tx_id: string;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export interface ExportRequest {
    documentIds: string[];
    format: 'pdf' | 'zip' | 'original';
    watermark?: boolean;
    watermarkText?: string;
    password?: string;
    requestedBy: string;
}

export interface ExportResponse {
    exportId: string;
    downloadUrl: string;
    expiresAt: Date;
    custodyEvent: {
        txId: string;
        blockNumber: number;
        blockHash: string;
    };
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface FileValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    detectedMimeType?: string;
    detectedExtension?: string;
}

export interface VirusScanResult {
    clean: boolean;
    threats: string[];
    scannedAt: Date;
    scannerVersion: string;
}

// ============================================================================
// DOCUMENT EVENT TYPES (for blockchain)
// ============================================================================

export interface DocumentCustodyEventData {
    txType: CustodyAction;
    caseId: string;
    documentId: string;
    actorUserId: string;
    actorNodeId: string;
    actionDetails: {
        original_filename?: string;
        file_size_bytes?: number;
        mime_type?: string;
        version?: number;
        changes_summary?: string;
        ocr_processed?: boolean;
        entities_extracted?: boolean;
        metadata_updated?: Record<string, any>;
        redaction_applied?: boolean;
        export_format?: string;
    };
    beforeStateHash?: string;
    afterStateHash?: string;
    digitalSignatureId?: string;
}