/**
 * ADALAT360 - Local OpenSSL-backed CA Implementation
 * Local CA simulation with full X.509 certificate lifecycle
 * Uses Node.js crypto and forge for certificate operations
 */
import { CertificateCategory, CertificateStatus, RevocationReason, CertificateRequest, CertificateResponse, CertificateInfo, RevokedCertificate, CRLResponse, OCSPRequest, OCSPResponse, CertificateValidationResult, CAConfig } from '../models/pki.js';
import { CertificateAuthority, CaProvider } from './ca-interface.js';
export declare class LocalOpenSSLCa implements CertificateAuthority {
    readonly provider: CaProvider;
    private config;
    private initialized;
    private caKeys;
    private certificateStore;
    private revokedCerts;
    private crlCache;
    private eventListeners;
    initialize(config?: CAConfig): Promise<void>;
    private ensureDirectories;
    private loadOrGenerateRootCA;
    private loadOrGenerateIntermediateCA;
    private parseDN;
    private generateSerialNumber;
    private loadCertificateStore;
    private loadRevokedCerts;
    private saveCertificateStore;
    private saveRevokedCerts;
    issueCertificate(request: CertificateRequest): Promise<CertificateResponse>;
    private buildSubjectDN;
    private buildExtensions;
    private getKeyUsageFlags;
    private getExtendedKeyUsageFlags;
    revokeCertificate(certificateId: string, reason: RevocationReason, revokedBy: string): Promise<void>;
    suspendCertificate(certificateId: string, reason: string): Promise<void>;
    reinstateCertificate(certificateId: string): Promise<void>;
    getCertificate(certificateId: string): Promise<CertificateInfo | null>;
    getCertificateBySerial(serialNumber: string, category: CertificateCategory): Promise<CertificateInfo | null>;
    listCertificates(filters: {
        category?: CertificateCategory;
        status?: CertificateStatus;
        subjectId?: string;
        issuedAfter?: Date;
        issuedBefore?: Date;
        limit?: number;
        offset?: number;
    }): Promise<CertificateInfo[]>;
    private entryToInfo;
    renewCertificate(certificateId: string, additionalDays?: number): Promise<CertificateResponse>;
    rotateKey(certificateId: string): Promise<CertificateResponse>;
    exportPrivateKey(certificateId: string, passphrase: string): Promise<string>;
    importCertificate(certPem: string, privateKeyPem: string, category: CertificateCategory, passphrase?: string): Promise<CertificateInfo>;
    getRevokedCertificates(category?: CertificateCategory, since?: Date): Promise<RevokedCertificate[]>;
    isRevoked(serialNumber: string, category: CertificateCategory): Promise<boolean>;
    generateCRL(category: CertificateCategory): Promise<CRLResponse>;
    getCRL(category: CertificateCategory): Promise<CRLResponse | null>;
    publishCRL(category: CertificateCategory): Promise<void>;
    private mapRevocationReason;
    checkOCSP(request: OCSPRequest): Promise<OCSPResponse>;
    validateCertificate(certPem: string, category: CertificateCategory, checkRevocation?: boolean): Promise<CertificateValidationResult>;
    validateChain(certPem: string, category: CertificateCategory): Promise<CertificateValidationResult>;
    private computeFingerprint;
    private computeAuthorityKeyIdentifier;
    private computeSubjectKeyIdentifier;
    on(event: string, listener: Function): void;
    emit(event: string, data: any): void;
    private emitPkiEvent;
    isHealthy(): Promise<boolean>;
    shutdown(): Promise<void>;
}
export declare class LocalCaFactory {
    createCa(options: {
        type: 'local';
        config: CAConfig;
    }): Promise<LocalOpenSSLCa>;
    getSupportedTypes(): string[];
}
//# sourceMappingURL=local-ca.d.ts.map