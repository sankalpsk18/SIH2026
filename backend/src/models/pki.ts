/**
 * ADALAT360 - PKI Models
 * Cross-cutting X.509 Certificate Management
 * Single trust root for users, blockchain nodes, and asset custody actors
 */

import { UserRole, AssetState } from './database.js';

// ============================================================================
// CERTIFICATE CATEGORIES & TYPES
// ============================================================================

export type CertificateCategory =
  | 'USER_IDENTITY'
  | 'BLOCKCHAIN_NODE'
  | 'ASSET_CUSTODY_ACTOR';

export type CertificateStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SUSPENDED';

export type RevocationReason =
  | 'KEY_COMPROMISE'
  | 'CA_COMPROMISE'
  | 'AFFILIATION_CHANGED'
  | 'SUPERSEDED'
  | 'CESSATION_OF_OPERATION'
  | 'PRIVILEGE_WITHDRAWN'
  | 'AA_COMPROMISE';

export type KeyUsage =
  | 'DIGITAL_SIGNATURE'
  | 'NON_REPUDIATION'
  | 'KEY_ENCIPHERMENT'
  | 'DATA_ENCIPHERMENT'
  | 'KEY_AGREEMENT'
  | 'CERT_SIGN'
  | 'CRL_SIGN'
  | 'ENCIPHER_ONLY'
  | 'DECIPHER_ONLY';

// ============================================================================
// CERTIFICATE PROFILE DEFINITIONS
// ============================================================================

export interface CertificateProfile {
  category: CertificateCategory;
  keyUsage: KeyUsage[];
  extendedKeyUsage: string[]; // OIDs
  validityDays: number;
  subjectNameFormat: string; // Template for subject DN
  requiredExtensions: CertificateExtension[];
}

export const CERTIFICATE_PROFILES: Record<CertificateCategory, CertificateProfile> = {
  USER_IDENTITY: {
    category: 'USER_IDENTITY',
    keyUsage: ['DIGITAL_SIGNATURE', 'NON_REPUDIATION', 'KEY_ENCIPHERMENT'],
    extendedKeyUsage: [
      '1.3.6.1.5.5.7.3.2', // Client Authentication
      '1.3.6.1.5.5.7.3.4', // Email Protection
      '1.3.6.1.4.1.311.20.2.2', // Smart Card Logon
    ],
    validityDays: 365, // 1 year
    subjectNameFormat: 'CN={fullName}, OU={department}, O=ADALAT360, C=IN',
    requiredExtensions: [
      { oid: '2.5.29.15', critical: true, value: 'digitalSignature, nonRepudiation, keyEncipherment' }, // KeyUsage
      { oid: '2.5.29.37', critical: true, value: 'clientAuth, emailProtection' }, // ExtendedKeyUsage
      { oid: '2.5.29.17', critical: false, value: 'email:{email}' }, // SubjectAltName
      { oid: '1.3.6.1.4.1.311.20.2.3', critical: false, value: '{userId}' }, // UserPrincipalName
    ],
  },
  BLOCKCHAIN_NODE: {
    category: 'BLOCKCHAIN_NODE',
    keyUsage: ['DIGITAL_SIGNATURE', 'NON_REPUDIATION', 'KEY_AGREEMENT'],
    extendedKeyUsage: [
      '1.3.6.1.5.5.7.3.1', // Server Authentication
      '1.3.6.1.5.5.7.3.2', // Client Authentication
    ],
    validityDays: 730, // 2 years
    subjectNameFormat: 'CN={nodeId}, OU={organization}, O=ADALAT360, C=IN',
    requiredExtensions: [
      { oid: '2.5.29.15', critical: true, value: 'digitalSignature, nonRepudiation, keyAgreement' },
      { oid: '2.5.29.37', critical: true, value: 'serverAuth, clientAuth' },
      { oid: '2.5.29.17', critical: false, value: 'dns:{nodeHostname}, uri:{nodeEndpoint}' },
      { oid: '1.3.6.1.4.1.311.20.2.3', critical: false, value: '{mspId}' },
    ],
  },
  ASSET_CUSTODY_ACTOR: {
    category: 'ASSET_CUSTODY_ACTOR',
    keyUsage: ['DIGITAL_SIGNATURE', 'NON_REPUDIATION'],
    extendedKeyUsage: [
      '1.3.6.1.5.5.7.3.2', // Client Authentication
    ],
    validityDays: 365, // 1 year
    subjectNameFormat: 'CN={userId}, OU={department}, O=ADALAT360, C=IN',
    requiredExtensions: [
      { oid: '2.5.29.15', critical: true, value: 'digitalSignature, nonRepudiation' },
      { oid: '2.5.29.37', critical: true, value: 'clientAuth' },
      { oid: '2.5.29.17', critical: false, value: 'email:{email}' },
    ],
  },
};

// ============================================================================
// CERTIFICATE EXTENSION
// ============================================================================

export interface CertificateExtension {
  oid: string;
  critical: boolean;
  value: string; // Template with placeholders
}

// ============================================================================
// CERTIFICATE REQUEST & RESPONSE
// ============================================================================

export interface CertificateRequest {
  category: CertificateCategory;
  subjectId: string; // userId, nodeId, or actorId
  subjectName: string; // Full name or node identifier
  email?: string;
  department?: string;
  organization?: string;
  nodeHostname?: string;
  nodeEndpoint?: string;
  mspId?: string;
  publicKey?: string; // PEM format (if CSR provided)
  csr?: string; // PEM format CSR (optional)
  keyType?: 'RSA' | 'ECDSA';
  keySize?: number;
  validityDays?: number; // Override default
  customExtensions?: CertificateExtension[];
}

export interface CertificateResponse {
  certificateId: string;
  serialNumber: string;
  certificatePem: string;
  privateKeyPem?: string; // Only returned once on generation
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

// ============================================================================
// CRL / OCSP
// ============================================================================

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

// ============================================================================
// CA CONFIGURATION
// ============================================================================

export interface CAConfig {
  // Root CA
  rootCa: {
    subjectDn: string;
    keyType: 'RSA' | 'ECDSA';
    keySize: number;
    validityDays: number;
    keyFile: string; // Path to private key
    certFile: string; // Path to certificate
  };
  // Intermediate CAs per category
  intermediateCas: Record<CertificateCategory, {
    subjectDn: string;
    keyType: 'RSA' | 'ECDSA';
    keySize: number;
    validityDays: number;
    keyFile: string;
    certFile: string;
  }>;
  // Storage
  storage: {
    type: 'filesystem' | 'database' | 'hsm' | 'vault';
    path?: string;
    connectionString?: string;
  };
  // Revocation
  revocation: {
    crlEnabled: boolean;
    crlValidityHours: number;
    crlDistributionPoint: string;
    ocspEnabled: boolean;
    ocspResponderUrl: string;
  };
  // Policy
  policy: {
    maxValidityDays: Record<CertificateCategory, number>;
    keyRotationDays: number;
    autoRenewalDaysBeforeExpiry: number;
  };
}

export const DEFAULT_CA_CONFIG: CAConfig = {
  rootCa: {
    subjectDn: 'CN=ADALAT360 Root CA, O=ADALAT360, C=IN',
    keyType: 'RSA',
    keySize: 4096,
    validityDays: 3650, // 10 years
    keyFile: './pki/root/private.key',
    certFile: './pki/root/cert.pem',
  },
  intermediateCas: {
    USER_IDENTITY: {
      subjectDn: 'CN=ADALAT360 User CA, O=ADALAT360, C=IN',
      keyType: 'RSA',
      keySize: 2048,
      validityDays: 1825, // 5 years
      keyFile: './pki/user/private.key',
      certFile: './pki/user/cert.pem',
    },
    BLOCKCHAIN_NODE: {
      subjectDn: 'CN=ADALAT360 Node CA, O=ADALAT360, C=IN',
      keyType: 'ECDSA',
      keySize: 256, // P-256
      validityDays: 1825,
      keyFile: './pki/node/private.key',
      certFile: './pki/node/cert.pem',
    },
    ASSET_CUSTODY_ACTOR: {
      subjectDn: 'CN=ADALAT360 Asset Actor CA, O=ADALAT360, C=IN',
      keyType: 'RSA',
      keySize: 2048,
      validityDays: 1825,
      keyFile: './pki/asset/private.key',
      certFile: './pki/asset/cert.pem',
    },
  },
  storage: {
    type: 'filesystem',
    path: './pki/store',
  },
  revocation: {
    crlEnabled: true,
    crlValidityHours: 24,
    crlDistributionPoint: 'http://pki.adalat360.gov.in/crl',
    ocspEnabled: true,
    ocspResponderUrl: 'http://ocsp.adalat360.gov.in',
  },
  policy: {
    maxValidityDays: {
      USER_IDENTITY: 365,
      BLOCKCHAIN_NODE: 730,
      ASSET_CUSTODY_ACTOR: 365,
    },
    keyRotationDays: 730,
    autoRenewalDaysBeforeExpiry: 30,
  },
};

// ============================================================================
// CERTIFICATE STORE ENTRY
// ============================================================================

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
  privateKeyPem?: string; // Encrypted if stored
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

// ============================================================================
// VALIDATION RESULT
// ============================================================================

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

// ============================================================================
// PKI EVENTS (for audit logging)
// ============================================================================

export type PkiEventType =
  | 'CERTIFICATE_ISSUED'
  | 'CERTIFICATE_RENEWED'
  | 'CERTIFICATE_REVOKED'
  | 'CERTIFICATE_EXPIRED'
  | 'CERTIFICATE_SUSPENDED'
  | 'CERTIFICATE_REINSTATED'
  | 'CRL_PUBLISHED'
  | 'OCSP_RESPONSE_GENERATED'
  | 'KEY_ROTATION_INITIATED'
  | 'KEY_ROTATION_COMPLETED'
  | 'CA_KEY_COMPROMISE'
  | 'PRIVATE_KEY_COMPROMISE';

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