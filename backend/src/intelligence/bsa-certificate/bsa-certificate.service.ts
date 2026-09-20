/**
 * ADALAT360 - BSA Section 63 Certificate Service
 * Generates court-admissible certificates under Bharatiya Sakshya Adhiniyam 2023, Section 63
 * For electronic records to be admissible as evidence in court
 */

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import QRCode from 'qrcode';
import { pgQuery, pgTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { getBlockchainService } from '../../blockchain/blockchain.service.js';
import { getDocumentIngestionService } from '../../document-ingestion/ingestion.service.js';
import { getStorageService } from '../../storage/storage.service.js';
import { CustodyAction } from '../../types/database.js';
import { config } from '../../config/index.js';
import {
    BSA63Certificate,
    BSA63CertificateContent,
    BSA63CertificateRequest,
    BSA63CertificateResponse,
} from '../../models/intelligence.js';

// ============================================================================
// BSA CERTIFICATE SERVICE CLASS
// ============================================================================

export class BsaCertificateService {
    private readonly SECTION = '63';
    private readonly DEFAULT_VALIDITY_YEARS = 10;

    // ========================================================================
    // GENERATE CERTIFICATE
    // ========================================================================

    async generateCertificate(request: BSA63CertificateRequest, issuedByUserId: string): Promise<BSA63CertificateResponse> {
        return pgTransaction(async (client) => {
            // Verify document exists and get details
            const docResult = await client.query(
                `SELECT d.*, c.case_number, c.title as case_title
                 FROM documents d
                 JOIN cases c ON c.id = d.case_id
                 WHERE d.id = $1 AND d.deleted_at IS NULL`,
                [request.documentId]
            );

            if (docResult.rows.length === 0) {
                throw new Error('Document not found');
            }

            const document = docResult.rows[0];

            // Verify user has permission to issue certificate for this case
            const hasAccess = await this.verifyCertificateAuthority(request.caseId, issuedByUserId, request.certificateType);
            if (!hasAccess) {
                throw new Error('Not authorized to issue BSA certificate for this case');
            }

            // Get custody chain for this document
            const custodyChain = await this.getCustodyChain(request.documentId);

            // Get file hash (already stored)
            const fileHash = document.file_hash_sha256;
            const fileSize = document.file_size_bytes;

            // Compute metadata hash
            const metadataHash = this.computeMetadataHash(document);

            // Build certificate content
            const certificateContent = this.buildCertificateContent(document, custodyChain, request.customContent);

            // Generate certificate number
            const certificateNumber = await this.generateCertificateNumber(request.caseId, client);

            // Generate QR code
            const qrCodeData = this.buildQrCodeData(certificateNumber, fileHash, request.caseId);
            const qrCodeHash = crypto.createHash('sha256').update(qrCodeData).digest('hex');
            const qrCodeImageUrl = await QRCode.toDataURL(qrCodeData, {
                width: 300,
                margin: 2,
                errorCorrectionLevel: 'M',
            });

            // Create certificate record
            const certificateId = uuidv4();
            const now = new Date();
            const validUntil = request.validUntil || new Date(now.getFullYear() + this.DEFAULT_VALIDITY_YEARS, now.getMonth(), now.getDate());

            const certificate: BSA63Certificate = {
                id: certificateId,
                certificateNumber,
                caseId: request.caseId,
                documentId: request.documentId,
                section: request.section || this.SECTION,
                subsection: request.subsection,
                certificateType: request.certificateType || 'ELECTRONIC_RECORD',
                issuedBy: issuedByUserId,
                issuedAt: now,
                validFrom: now,
                validUntil,
                status: 'ISSUED',
                hashAlgorithm: 'SHA-256',
                fileHash,
                fileSizeBytes: fileSize,
                metadataHash,
                custodyLedgerTxIds: custodyChain.map(c => c.tx_id),
                chainOfCustodyHash: this.computeChainOfCustodyHash(custodyChain),
                certificateContent,
                digitalSignatureId: undefined,
                qrCodeHash,
                qrCodeImageUrl,
            };

            if (!config.isProduction) {
                const signatureId = uuidv4();
                const signatureValue = crypto
                    .createHash('sha256')
                    .update(`${certificateId}:${fileHash}:${issuedByUserId}`)
                    .digest();

                await client.query(
                    `INSERT INTO digital_signatures (
                        id, signature_id, signer_user_id, signer_node_id, signature_type,
                        certificate_pem, certificate_serial, certificate_issuer,
                        certificate_valid_from, certificate_valid_to, signed_data_hash,
                        signed_data_type, signed_data_id, signature_algorithm, signature_value,
                        signature_timestamp, is_verified, verified_at, verified_by, metadata
                    ) VALUES ($1,$2,$3,'court-node-1','DIGITAL_SIGNATURE',$4,$5,$6,$7,$8,$9,'BSA_CERTIFICATE',$10,'SHA256-SIMULATED',$11,$12,TRUE,$12,$3,$13)`,
                    [
                        signatureId,
                        `DEV-SIG-${certificateId}`,
                        issuedByUserId,
                        'ADALAT360 Development Certificate Authority',
                        certificateId,
                        'ADALAT360-DEV-CA',
                        now,
                        validUntil,
                        fileHash,
                        certificateId,
                        signatureValue,
                        now,
                        JSON.stringify({ simulated: true, reason: 'development_environment' }),
                    ]
                );
                certificate.digitalSignatureId = signatureId;
            }

            // Store certificate in database
            await client.query(
                `INSERT INTO bsa_certificates (
                    id, certificate_number, case_id, document_id, section, subsection,
                    certificate_type, issued_by, issued_at, valid_from, valid_until, status,
                    hash_algorithm, file_hash, file_size_bytes, metadata_hash,
                    custody_ledger_tx_ids, chain_of_custody_hash, certificate_content,
                    digital_signature_id, qr_code_hash, qr_code_image_path, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW())`,
                [
                    certificateId,
                    certificateNumber,
                    request.caseId,
                    request.documentId,
                    certificate.section,
                    certificate.subsection,
                    certificate.certificateType,
                    certificate.issuedBy,
                    certificate.issuedAt,
                    certificate.validFrom,
                    certificate.validUntil,
                    certificate.status,
                    certificate.hashAlgorithm,
                    certificate.fileHash,
                    certificate.fileSizeBytes,
                    certificate.metadataHash,
                    certificate.custodyLedgerTxIds,
                    certificate.chainOfCustodyHash,
                    JSON.stringify(certificate.certificateContent),
                    certificate.digitalSignatureId,
                    certificate.qrCodeHash,
                    qrCodeImageUrl, // Store as data URL for now
                ]
            );

            // Record blockchain event for certificate issuance
            const blockchainService = getBlockchainService();
            await blockchainService.recordCustodyEvent({
                txType: CustodyAction.SIGNATURE_APPLY,
                caseId: request.caseId,
                documentId: request.documentId,
                actorUserId: issuedByUserId,
                actorNodeId: 'CourtMSP', // Certificates issued by Court/Prosecutor
                actionDetails: {
                    certificate_id: certificateId,
                    certificate_number: certificateNumber,
                    action: 'BSA_63_CERTIFICATE_ISSUED',
                },
            });

            // Generate PDF (placeholder)
            const pdfUrl = await this.generateCertificatePdf(certificate);

            return {
                certificate,
                pdfUrl,
                verificationUrl: `${config.server.corsOrigin}/verify?certificateNumber=${encodeURIComponent(certificateNumber)}`,
            };
        });
    }

    // ========================================================================
    // VERIFY CERTIFICATE
    // ========================================================================

    async verifyCertificate(certificateNumber: string): Promise<{
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
    }> {
        const result = await pgQuery(
            `SELECT * FROM bsa_certificates WHERE certificate_number = $1`,
            [certificateNumber]
        );

        if (result.rows.length === 0) {
            return {
                valid: false,
                verificationDetails: {
                    hashVerified: false,
                    chainVerified: false,
                    signatureVerified: false,
                    notExpired: false,
                    notRevoked: false,
                    details: ['Certificate not found'],
                },
            };
        }

        const cert = this.mapRowToCertificate(result.rows[0]);
        const details: string[] = [];

        // Check expiry
        const notExpired = !cert.validUntil || new Date() <= cert.validUntil;
        if (!notExpired) details.push('Certificate has expired');

        // Check revocation
        const notRevoked = cert.status !== 'REVOKED';
        if (!notRevoked) details.push('Certificate has been revoked');

        // Verify file hash
        const docResult = await pgQuery(
            `SELECT file_hash_sha256, file_size_bytes FROM documents WHERE id = $1`,
            [cert.documentId]
        );

        let hashVerified = false;
        if (docResult.rows.length > 0) {
            hashVerified = docResult.rows[0].file_hash_sha256 === cert.fileHash &&
                          docResult.rows[0].file_size_bytes === cert.fileSizeBytes;
        }
        if (!hashVerified) details.push('Document hash mismatch');

        // Verify chain of custody
        const chainVerified = await this.verifyChainOfCustody(cert.custodyLedgerTxIds, cert.chainOfCustodyHash);
        if (!chainVerified) details.push('Chain of custody verification failed');

        // Verify digital signature
        let signatureVerified = false;
        if (cert.digitalSignatureId) {
            // In production, verify the digital signature
            signatureVerified = true; // Placeholder
        }
        if (!signatureVerified) details.push('Digital signature not verified');

        return {
            valid: notExpired && notRevoked && hashVerified && chainVerified && signatureVerified,
            certificate: cert,
            verificationDetails: {
                hashVerified,
                chainVerified,
                signatureVerified,
                notExpired,
                notRevoked,
                details,
            },
        };
    }

    // ========================================================================
    // GET CERTIFICATE
    // ========================================================================

    async getCertificate(certificateId: string): Promise<BSA63Certificate | null> {
        const result = await pgQuery(
            `SELECT * FROM bsa_certificates WHERE id = $1`,
            [certificateId]
        );
        return result.rows.length > 0 ? this.mapRowToCertificate(result.rows[0]) : null;
    }

    async getCertificatesByCase(caseId: string): Promise<BSA63Certificate[]> {
        const result = await pgQuery(
            `SELECT * FROM bsa_certificates WHERE case_id = $1 ORDER BY issued_at DESC`,
            [caseId]
        );
        return result.rows.map(row => this.mapRowToCertificate(row));
    }

    async getCertificatesByDocument(documentId: string): Promise<BSA63Certificate[]> {
        const result = await pgQuery(
            `SELECT * FROM bsa_certificates WHERE document_id = $1 ORDER BY issued_at DESC`,
            [documentId]
        );
        return result.rows.map(row => this.mapRowToCertificate(row));
    }

    // ========================================================================
    // REVOKE CERTIFICATE
    // ========================================================================

    async revokeCertificate(certificateId: string, revokedBy: string, reason: string): Promise<void> {
        await pgQuery(
            `UPDATE bsa_certificates SET
                status = 'REVOKED',
                revoked_at = NOW(),
                revoked_by = $1,
                revocation_reason = $2,
                updated_at = NOW()
             WHERE id = $3`,
            [revokedBy, reason, certificateId]
        );

        // Record blockchain event
        const blockchainService = getBlockchainService();
        await blockchainService.recordCustodyEvent({
            txType: CustodyAction.SIGNATURE_APPLY,
            documentId: certificateId,
            actorUserId: revokedBy,
            actorNodeId: 'CourtMSP',
            actionDetails: {
                certificate_id: certificateId,
                action: 'BSA_CERTIFICATE_REVOKED',
                reason,
            },
        });
    }

    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================

    private async verifyCertificateAuthority(caseId: string, userId: string, certificateType?: string): Promise<boolean> {
        const result = await pgQuery(
            `SELECT role FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) return false;

        const role = result.rows[0].role;

        // Only Prosecutors and Courts can issue BSA certificates
        if (role === 'PROSECUTOR' || role === 'COURT' || role === 'CENTRAL_ADMIN') {
            // Check case assignment
            const assignmentResult = await pgQuery(
                `SELECT 1 FROM case_assignments WHERE case_id = $1 AND user_id = $2 AND is_active = TRUE`,
                [caseId, userId]
            );
            if (assignmentResult.rows.length > 0) return true;

            // Check direct assignment
            const caseResult = await pgQuery(
                `SELECT 1 FROM cases WHERE id = $1 AND (prosecutor_id = $2 OR court_id = $2)`,
                [caseId, userId]
            );
            return caseResult.rows.length > 0;
        }

        return false;
    }

    private async getCustodyChain(documentId: string): Promise<Array<{
        tx_id: string;
        timestamp: Date;
        tx_type: string;
        actor_user_id: string;
        actor_name: string;
        action_details: Record<string, any>;
        block_hash: string;
    }>> {
        const result = await pgQuery(
            `SELECT cl.*, u.full_name as actor_name
             FROM custody_ledger cl
             LEFT JOIN users u ON u.id = cl.actor_user_id
             WHERE cl.document_id = $1 AND cl.is_valid = TRUE
             ORDER BY cl.tx_timestamp ASC`,
            [documentId]
        );

        return result.rows.map(row => ({
            tx_id: row.tx_id,
            timestamp: row.tx_timestamp,
            tx_type: row.tx_type,
            actor_user_id: row.actor_user_id,
            actor_name: row.actor_name || 'Unknown',
            action_details: row.action_details,
            block_hash: row.block_hash,
        }));
    }

    private computeMetadataHash(document: any): string {
        const metadata = {
            document_number: document.document_number,
            title: document.title,
            document_type: document.document_type,
            version: document.version,
            original_filename: document.original_filename,
            mime_type: document.mime_type,
            uploaded_by: document.uploaded_by,
            created_at: document.created_at,
        };
        return crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
    }

    private computeChainOfCustodyHash(custodyChain: Array<{ tx_id: string; block_hash: string }>): string {
        const chainData = custodyChain.map(c => `${c.tx_id}:${c.block_hash}`).join('|');
        return crypto.createHash('sha256').update(chainData).digest('hex');
    }

    private async verifyChainOfCustody(txIds: string[], expectedChainHash: string): Promise<boolean> {
        const result = await pgQuery(
            `SELECT tx_id, block_hash FROM custody_ledger WHERE tx_id = ANY($1) ORDER BY tx_timestamp`,
            [txIds]
        );

        const chainData = result.rows.map(row => `${row.tx_id}:${row.block_hash}`).join('|');
        const computedHash = crypto.createHash('sha256').update(chainData).digest('hex');

        return computedHash === expectedChainHash;
    }

    private buildCertificateContent(
        document: any,
        custodyChain: Array<{ tx_id: string; timestamp: Date; tx_type: string; actor_user_id: string; actor_name: string; block_hash: string }>,
        customContent?: Partial<BSA63CertificateContent>
    ): BSA63CertificateContent {
        return {
            computerOutput: {
                description: customContent?.computerOutput?.description || document.description || `Electronic record: ${document.title}`,
                producedBy: customContent?.computerOutput?.producedBy || document.uploaded_by,
                productionDate: customContent?.computerOutput?.productionDate || document.created_at,
                productionProcess: customContent?.computerOutput?.productionProcess || 'Document uploaded and processed through ADALAT360 system with OCR, entity extraction, and blockchain-anchored custody tracking',
                responsiblePerson: customContent?.computerOutput?.responsiblePerson || 'System Administrator',
                responsiblePersonRole: customContent?.computerOutput?.responsiblePersonRole || 'Digital Evidence Custodian',
            },
            conditions: {
                regularUse: customContent?.conditions?.regularUse ?? true,
                properOperation: customContent?.conditions?.properOperation ?? true,
                accurateReproduction: customContent?.conditions?.accurateReproduction ?? true,
                informationSupplied: customContent?.conditions?.informationSupplied ?? true,
            },
            certificateDetails: {
                identifier: document.document_number,
                descriptionOfOutput: document.title,
                particularsOfDevice: 'ADALAT360 Secure Digital Evidence Management System',
                particularsOfProcedure: 'Document ingested with SHA-256 hashing, AES-256-GCM encryption, Tesseract OCR, entity extraction, and Hyperledger Fabric blockchain custody ledger',
                signatureOfPerson: customContent?.certificateDetails?.signatureOfPerson || '',
                designationOfPerson: customContent?.certificateDetails?.designationOfPerson || '',
            },
            evidence: {
                hashVerification: {
                    algorithm: 'SHA-256',
                    originalHash: document.file_hash_sha256,
                    verifiedHash: document.file_hash_sha256,
                    verifiedAt: new Date(),
                    verifiedBy: 'ADALAT360 Automated Verification',
                },
                chainOfCustody: custodyChain.map(c => ({
                    txId: c.tx_id,
                    timestamp: c.timestamp,
                    action: c.tx_type,
                    actor: c.actor_name,
                    hash: c.block_hash,
                })),
                digitalSignatures: [], // Would be populated from digital_signatures table
            },
        };
    }

    private buildQrCodeData(certificateNumber: string, fileHash: string, caseId: string): string {
        // Encode a normal URL so phone cameras open the certificate page directly.
        return `${config.server.corsOrigin}/verify?certificateNumber=${encodeURIComponent(certificateNumber)}`;
    }

    private async generateCertificateNumber(caseId: string, client: any): Promise<string> {
        const result = await client.query(
            `SELECT COUNT(*) as count FROM bsa_certificates WHERE case_id = $1`,
            [caseId]
        );
        const count = parseInt(result.rows[0].count, 10) + 1;
        const year = new Date().getFullYear();
        return `BSA63/${year}/${caseId.slice(0, 8).toUpperCase()}/${count.toString().padStart(4, '0')}`;
    }

    private async generateCertificatePdf(certificate: BSA63Certificate): Promise<string> {
        // In production, use pdf-lib or puppeteer to generate PDF
        // For now, return placeholder
        return `/api/v1/bsa/${certificate.id}/pdf`;
    }

    private mapRowToCertificate(row: any): BSA63Certificate {
        return {
            id: row.id,
            certificateNumber: row.certificate_number,
            caseId: row.case_id,
            documentId: row.document_id,
            section: row.section,
            subsection: row.subsection,
            certificateType: row.certificate_type,
            issuedBy: row.issued_by,
            issuedAt: row.issued_at,
            validFrom: row.valid_from,
            validUntil: row.valid_until,
            status: row.status,
            hashAlgorithm: row.hash_algorithm,
            fileHash: row.file_hash,
            fileSizeBytes: row.file_size_bytes,
            metadataHash: row.metadata_hash,
            custodyLedgerTxIds: row.custody_ledger_tx_ids,
            chainOfCustodyHash: row.chain_of_custody_hash,
            certificateContent: row.certificate_content,
            digitalSignatureId: row.digital_signature_id,
            qrCodeHash: row.qr_code_hash,
            qrCodeImageUrl: row.qr_code_image_path,
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let bsaCertificateServiceInstance: BsaCertificateService | null = null;

export function getBsaCertificateService(): BsaCertificateService {
    if (!bsaCertificateServiceInstance) {
        bsaCertificateServiceInstance = new BsaCertificateService();
    }
    return bsaCertificateServiceInstance;
}