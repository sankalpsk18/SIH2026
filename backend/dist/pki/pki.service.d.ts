/**
 * ADALAT360 - PKI Service
 * High-level service integrating CA with users, blockchain nodes, and asset custody actors
 */
import { CertificateCategory, CertificateValidationResult } from '../models/pki.js';
export declare class PkiService {
    private factory;
    private ca;
    private initialized;
    initialize(config?: any): Promise<void>;
    issueUserCertificate(userId: string, subjectName: string, email: string, department: string): Promise<any>;
    getUserCertificate(userId: string): Promise<any | null>;
    revokeUserCertificate(userId: string, reason: string, revokedBy: string): Promise<void>;
    renewUserCertificate(userId: string): Promise<any>;
    issueNodeCertificate(nodeId: string, organization: string, nodeHostname: string, nodeEndpoint: string, mspId: string): Promise<any>;
    getNodeCertificate(nodeId: string): Promise<any | null>;
    revokeNodeCertificate(nodeId: string, reason: string): Promise<void>;
    issueAssetActorCertificate(userId: string): Promise<any>;
    getAssetActorCertificate(userId: string): Promise<any | null>;
    validateUserForOperation(userId: string, operation: string): Promise<CertificateValidationResult>;
    validateNodeForEndorsement(nodeId: string): Promise<CertificateValidationResult>;
    validateAssetActorForTransition(userId: string): Promise<CertificateValidationResult>;
    validateCustodyTransaction(certPem: string, category: CertificateCategory): Promise<CertificateValidationResult>;
    validateAssetStateTransition(userId: string): Promise<CertificateValidationResult>;
    isCertificateRevoked(serialNumber: string, category: CertificateCategory): Promise<boolean>;
    checkRevocationBeforeEndorsement(nodeId: string): Promise<boolean>;
    checkRevocationBeforeAssetTransition(userId: string): Promise<boolean>;
    publishCRLs(): Promise<void>;
    getCRL(category: string): Promise<string>;
    rotateUserKeys(userId: string): Promise<any>;
    rotateNodeKeys(nodeId: string): Promise<any>;
    validateCertificateChain(certPem: string, category: string): Promise<any>;
    getCertificateAuditTrail(certificateId: string): Promise<any[]>;
    getRevokedCertificatesReport(category?: string, since?: Date): Promise<any[]>;
    healthCheck(): Promise<any>;
    getExpiringCertificates(days?: number): Promise<any[]>;
    getCa(): Promise<any>;
}
export declare function getPkiService(): PkiService;
export declare function initializePki(config?: any): Promise<PkiService>;
//# sourceMappingURL=pki.service.d.ts.map