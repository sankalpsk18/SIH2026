"use strict";
/**
 * ADALAT360 - PKI Models
 * Cross-cutting X.509 Certificate Management
 * Single trust root for users, blockchain nodes, and asset custody actors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CA_CONFIG = exports.CERTIFICATE_PROFILES = void 0;
exports.CERTIFICATE_PROFILES = {
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
exports.DEFAULT_CA_CONFIG = {
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
//# sourceMappingURL=pki.js.map