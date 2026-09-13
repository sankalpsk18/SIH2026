/**
 * ADALAT360 - Document Version Manager
 * Immutable versioning system for documents
 * Every edit creates a new version; originals are never overwritten
 */
import { Document, DocumentVersion, VersionCreateRequest, VersionResponse } from '../../models/document.js';
export declare class VersionManager {
    createVersion(request: VersionCreateRequest): Promise<VersionResponse>;
    getVersionHistory(documentId: string): Promise<DocumentVersion[]>;
    getVersion(documentId: string, version: number): Promise<DocumentVersion | null>;
    getLatestVersion(documentId: string): Promise<Document | null>;
    getDocumentLineage(documentId: string): Promise<Document[]>;
    revertToVersion(documentId: string, targetVersion: number, userId: string, reason: string): Promise<VersionResponse>;
    compareVersions(documentId: string, version1: number, version2: number): Promise<{
        version1: DocumentVersion;
        version2: DocumentVersion;
        hashMatch: boolean;
        sizeDifference: number;
    }>;
    private toPublic;
    private toVersion;
}
export declare function getVersionManager(): VersionManager;
//# sourceMappingURL=version-manager.d.ts.map