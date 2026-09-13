/**
 * ADALAT360 - CA Interface
 * Abstract interface for Certificate Authority operations
 * Implementations: LocalOpenSSLCa, HashiCorpVaultCa, AWSCa, AzureKeyVaultCa, etc.
 */
import { CertificateCategory, CertificateStatus, RevocationReason, CertificateRequest, CertificateResponse, CertificateInfo, RevokedCertificate, CRLResponse, OCSPRequest, OCSPResponse, CertificateValidationResult, CAConfig } from '../models/pki.js';
export interface CaProvider {
    name: string;
    version: string;
    initialize(config: CAConfig): Promise<void>;
    isHealthy(): Promise<boolean>;
    shutdown(): Promise<void>;
}
export interface CertificateAuthority {
    readonly provider: CaProvider;
    issueCertificate(request: CertificateRequest): Promise<CertificateResponse>;
    renewCertificate(certificateId: string, additionalDays?: number): Promise<CertificateResponse>;
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
    rotateKey(certificateId: string): Promise<CertificateResponse>;
    exportPrivateKey(certificateId: string, passphrase: string): Promise<string>;
    importCertificate(certPem: string, privateKeyPem: string, category: CertificateCategory, passphrase?: string): Promise<CertificateInfo>;
    getRevokedCertificates(category?: CertificateCategory, since?: Date): Promise<RevokedCertificate[]>;
    isRevoked(serialNumber: string, category: CertificateCategory): Promise<boolean>;
    generateCRL(category: CertificateCategory): Promise<CRLResponse>;
    getCRL(category: CertificateCategory): Promise<CRLResponse | null>;
    publishCRL(category: CertificateCategory): Promise<void>;
    checkOCSP(request: OCSPRequest): Promise<OCSPResponse>;
    validateCertificate(certPem: string, category: CertificateCategory, checkRevocation?: boolean): Promise<CertificateValidationResult>;
    validateChain(certPem: string, category: CertificateCategory): Promise<CertificateValidationResult>;
    on(event: string, listener: (event: any) => void): void;
    emit(event: string, data: any): void;
}
export type CaType = 'local' | 'vault' | 'aws' | 'azure' | 'gcp' | 'custom';
export interface CaFactoryOptions {
    type: CaType;
    config: CAConfig;
    customProvider?: CertificateAuthority;
}
export interface CaFactory {
    createCa(options: CaFactoryOptions): Promise<CertificateAuthority>;
    getSupportedTypes(): CaType[];
}
//# sourceMappingURL=ca-interface.d.ts.map