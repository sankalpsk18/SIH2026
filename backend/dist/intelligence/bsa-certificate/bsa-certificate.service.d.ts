/**
 * ADALAT360 - BSA Section 63 Certificate Service
 * Generates court-admissible certificates under Bharatiya Sakshya Adhiniyam 2023, Section 63
 * For electronic records to be admissible as evidence in court
 */
import { BSA63Certificate, BSA63CertificateRequest, BSA63CertificateResponse } from '../../models/intelligence.js';
export declare class BsaCertificateService {
    private readonly SECTION;
    private readonly DEFAULT_VALIDITY_YEARS;
    generateCertificate(request: BSA63CertificateRequest, issuedByUserId: string): Promise<BSA63CertificateResponse>;
    verifyCertificate(certificateNumber: string): Promise<{
        valid: boolean;
        certificate?: BSA63Certificate;
        verificationDetails: {
            hashVerified: boolean;
            chainVerified: boolean;
            signatureVerified: boolean;
            notExpired: boolean;
            notRevoked: boolean;
            details: string[];
        };
    }>;
    getCertificate(certificateId: string): Promise<BSA63Certificate | null>;
    getCertificatesByCase(caseId: string): Promise<BSA63Certificate[]>;
    getCertificatesByDocument(documentId: string): Promise<BSA63Certificate[]>;
    revokeCertificate(certificateId: string, revokedBy: string, reason: string): Promise<void>;
    private verifyCertificateAuthority;
    private getCustodyChain;
    private computeMetadataHash;
    private computeChainOfCustodyHash;
    private verifyChainOfCustody;
    private buildCertificateContent;
    private buildQrCodeData;
    private generateCertificateNumber;
    private generateCertificatePdf;
    private mapRowToCertificate;
}
export declare function getBsaCertificateService(): BsaCertificateService;
//# sourceMappingURL=bsa-certificate.service.d.ts.map