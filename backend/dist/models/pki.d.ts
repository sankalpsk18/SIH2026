/**
 * ADALAT360 - PKI Models
 * Cross-cutting X.509 Certificate Management
 * Single trust root for users, blockchain nodes, and asset custody actors
 */
export type CertificateCategory = 'USER_IDENTITY' | 'BLOCKCHAIN_NODE' | 'ASSET_CUSTODY_ACTOR';
export type CertificateStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';
export type RevocationReason = 'KEY_COMPROMISE' | 'CA_COMPROMISE' | 'AFFILIATION_CHANGED' | 'SUPERSEDED' | 'CESSATION_OF_OPERATION' | 'PRIVILEGE_WITHDRAWN' | 'AA_COMPROMISE';
export type KeyUsage = 'DIGITAL_SIGNATURE' | 'NON_REPUDIATION' | 'KEY_ENCIPHERMENT' | 'DATA_ENCIPHERMENT' | 'KEY_AGREEMENT' | 'CERT_SIGN' | 'CRL_SIGN' | 'ENCIPHER_ONLY' | 'DECIPHER_ONLY';
export interface CertificateProfile {
    category: CertificateCategory;
    keyUsage: KeyUsage[];
    extendedKeyUsage: string[];
    validityDays: number;
    subjectNameFormat: string;
    requiredExtensions: CertificateExtension[];
}
export declare const CERTIFICATE_PROFILES: Record<CertificateCategory, CertificateProfile>;
export interface CertificateExtension {
    oid: string;
    critical: boolean;
    value: string;
}
export interface CertificateRequest {
    category: CertificateCategory;
    subjectId: string;
    subjectName: string;
    email?: string;
    department?: string;
    organization?: string;
    nodeHostname?: string;
    nodeEndpoint?: string;
    mspId?: string;
    publicKey?: string;
    csr?: string;
    keyType?: 'RSA' | 'ECDSA';
    keySize?: number;
    validityDays?: number;
    customExtensions?: CertificateExtension[];
}
export interface CertificateResponse {
    certificateId: string;
    serialNumber: string;
    certificatePem: string;
    privateKeyPem?: string;
    issuedAt: Date;
    expiresAt: Date;
    status: CertificateStatus;
    fingerprintSha256: string;
    fingerprintSha1: string;
    authorityKeyIdentifier: string;
    subjectKeyIdentifier: string;
}
export interface CertificateInfo {
    certificateId: string;
    serialNumber: string;
    subjectDn: string;
    issuerDn: string;
    category: CertificateCategory;
    subjectId: string;
    subjectName: string;
    email?: string;
    department?: string;
    organization?: string;
    status: CertificateStatus;
    issuedAt: Date;
    expiresAt: Date;
    revokedAt?: Date;
    revocationReason?: RevocationReason;
    keyUsage: KeyUsage[];
    extendedKeyUsage: string[];
    fingerprintSha256: string;
    fingerprintSha1: string;
    authorityKeyIdentifier: string;
    subjectKeyIdentifier: string;
    certificatePem: string;
    ocspUrl?: string;
    crlUrl?: string;
}
export interface RevokedCertificate {
    serialNumber: string;
    revocationDate: Date;
    revocationReason: RevocationReason;
    certificateId: string;
    category: CertificateCategory;
    subjectId: string;
}
export interface CRLEntry {
    serialNumber: string;
    revocationDate: Date;
    revocationReason: RevocationReason;
}
export interface CRLResponse {
    crlPem: string;
    issuerDn: string;
    thisUpdate: Date;
    nextUpdate: Date;
    revokedCertificates: CRLEntry[];
}
export interface OCSPRequest {
    serialNumber: string;
    issuerDn: string;
}
export interface OCSPResponse {
    serialNumber: string;
    status: 'GOOD' | 'REVOKED' | 'UNKNOWN';
    revocationTime?: Date;
    revocationReason?: RevocationReason;
    thisUpdate: Date;
    nextUpdate: Date;
    responseSignature: string;
}
export interface CAConfig {
    rootCa: {
        subjectDn: string;
        keyType: 'RSA' | 'ECDSA';
        keySize: number;
        validityDays: number;
        keyFile: string;
        certFile: string;
    };
    intermediateCas: Record<CertificateCategory, {
        subjectDn: string;
        keyType: 'RSA' | 'ECDSA';
        keySize: number;
        validityDays: number;
        keyFile: string;
        certFile: string;
    }>;
    storage: {
        type: 'filesystem' | 'database' | 'hsm' | 'vault';
        path?: string;
        connectionString?: string;
    };
    revocation: {
        crlEnabled: boolean;
        crlValidityHours: number;
        crlDistributionPoint: string;
        ocspEnabled: boolean;
        ocspResponderUrl: string;
    };
    policy: {
        maxValidityDays: Record<CertificateCategory, number>;
        keyRotationDays: number;
        autoRenewalDaysBeforeExpiry: number;
    };
}
export declare const DEFAULT_CA_CONFIG: CAConfig;
export interface CertificateStoreEntry {
    certificateId: string;
    category: CertificateCategory;
    serialNumber: string;
    subjectDn: string;
    issuerDn: string;
    subjectId: string;
    subjectName: string;
    email?: string;
    department?: string;
    organization?: string;
    status: CertificateStatus;
    issuedAt: Date;
    expiresAt: Date;
    revokedAt?: Date;
    revocationReason?: RevocationReason;
    certificatePem: string;
    privateKeyPem?: string;
    privateKeyEncrypted: boolean;
    fingerprintSha256: string;
    fingerprintSha1: string;
    authorityKeyIdentifier: string;
    subjectKeyIdentifier: string;
    certificatePem: string;
    ocspUrl?: string;
    crlUrl?: string;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface CertificateValidationResult {
    valid: boolean;
    certificate?: CertificateInfo;
    errors: string[];
    warnings: string[];
    checks: {
        signatureValid: boolean;
        chainValid: boolean;
        notExpired: boolean;
        notRevoked: boolean;
        keyUsageValid: boolean;
        extendedKeyUsageValid: boolean;
        nameConstraintsValid: boolean;
        policyConstraintsValid: boolean;
    };
}
export type PkiEventType = 'CERTIFICATE_ISSUED' | 'CERTIFICATE_RENEWED' | 'CERTIFICATE_REVOKED' | 'CERTIFICATE_EXPIRED' | 'CERTIFICATE_SUSPENDED' | 'CERTIFICATE_REINSTATED' | 'CRL_PUBLISHED' | 'OCSP_RESPONSE_GENERATED' | 'KEY_ROTATION_INITIATED' | 'KEY_ROTATION_COMPLETED' | 'CA_KEY_COMPROMISE' | 'PRIVATE_KEY_COMPROMISE';
export interface PkiEvent {
    eventId: string;
    eventType: PkiEventType;
    certificateId?: string;
    serialNumber?: string;
    category?: CertificateCategory;
    subjectId?: string;
    actorUserId?: string;
    details: Record<string, any>;
    timestamp: Date;
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
}
//# sourceMappingURL=pki.d.ts.map