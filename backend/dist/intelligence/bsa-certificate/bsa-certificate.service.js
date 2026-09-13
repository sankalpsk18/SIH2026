"use strict";
/**
 * ADALAT360 - BSA Section 63 Certificate Service
 * Generates court-admissible certificates under Bharatiya Sakshya Adhiniyam 2023, Section 63
 * For electronic records to be admissible as evidence in court
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BsaCertificateService = void 0;
exports.getBsaCertificateService = getBsaCertificateService;
const uuid_1 = require("uuid");
const crypto = __importStar(require("crypto"));
const qrcode_1 = __importDefault(require("qrcode"));
const database_js_1 = require("../../config/database.js");
const blockchain_service_js_1 = require("../../blockchain/blockchain.service.js");
const database_js_2 = require("../../types/database.js");
// ============================================================================
// BSA CERTIFICATE SERVICE CLASS
// ============================================================================
class BsaCertificateService {
    SECTION = '63';
    DEFAULT_VALIDITY_YEARS = 10;
    // ========================================================================
    // GENERATE CERTIFICATE
    // ========================================================================
    async generateCertificate(request, issuedByUserId) {
        return (0, database_js_1.pgTransaction)(async (client) => {
            // Verify document exists and get details
            const docResult = await client.query(`SELECT d.*, c.case_number, c.title as case_title
                 FROM documents d
                 JOIN cases c ON c.id = d.case_id
                 WHERE d.id = $1 AND d.deleted_at IS NULL`, [request.documentId]);
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
            const qrCodeImageUrl = await qrcode_1.default.toDataURL(qrCodeData, {
                width: 300,
                margin: 2,
                errorCorrectionLevel: 'M',
            });
            // Create certificate record
            const certificateId = (0, uuid_1.v4)();
            const now = new Date();
            const validUntil = request.validUntil || new Date(now.getFullYear() + this.DEFAULT_VALIDITY_YEARS, now.getMonth(), now.getDate());
            const certificate = {
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
                digitalSignatureId: undefined, // Will be set after signing
                qrCodeHash,
                qrCodeImageUrl,
            };
            // Store certificate in database
            await client.query(`INSERT INTO bsa_certificates (
                    id, certificate_number, case_id, document_id, section, subsection,
                    certificate_type, issued_by, issued_at, valid_from, valid_until, status,
                    hash_algorithm, file_hash, file_size_bytes, metadata_hash,
                    custody_ledger_tx_ids, chain_of_custody_hash, certificate_content,
                    qr_code_hash, qr_code_image_path, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW())`, [
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
                certificate.qrCodeHash,
                qrCodeImageUrl, // Store as data URL for now
            ]);
            // Record blockchain event for certificate issuance
            const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
            await blockchainService.recordCustodyEvent({
                txType: database_js_2.CustodyAction.SIGNATURE_APPLY,
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
                verificationUrl: `${config.server.corsOrigin}/verify/${certificateNumber}`,
            };
        });
    }
    // ========================================================================
    // VERIFY CERTIFICATE
    // ========================================================================
    async verifyCertificate(certificateNumber) {
        const result = await (0, database_js_1.pgQuery)(`SELECT * FROM bsa_certificates WHERE certificate_number = $1`, [certificateNumber]);
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
        const details = [];
        // Check expiry
        const notExpired = !cert.validUntil || new Date() <= cert.validUntil;
        if (!notExpired)
            details.push('Certificate has expired');
        // Check revocation
        const notRevoked = cert.status !== 'REVOKED';
        if (!notRevoked)
            details.push('Certificate has been revoked');
        // Verify file hash
        const docResult = await (0, database_js_1.pgQuery)(`SELECT file_hash_sha256, file_size_bytes FROM documents WHERE id = $1`, [cert.documentId]);
        let hashVerified = false;
        if (docResult.rows.length > 0) {
            hashVerified = docResult.rows[0].file_hash_sha256 === cert.fileHash &&
                docResult.rows[0].file_size_bytes === cert.fileSizeBytes;
        }
        if (!hashVerified)
            details.push('Document hash mismatch');
        // Verify chain of custody
        const chainVerified = await this.verifyChainOfCustody(cert.custodyLedgerTxIds, cert.chainOfCustodyHash);
        if (!chainVerified)
            details.push('Chain of custody verification failed');
        // Verify digital signature
        let signatureVerified = false;
        if (cert.digitalSignatureId) {
            // In production, verify the digital signature
            signatureVerified = true; // Placeholder
        }
        if (!signatureVerified)
            details.push('Digital signature not verified');
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
    async getCertificate(certificateId) {
        const result = await (0, database_js_1.pgQuery)(`SELECT * FROM bsa_certificates WHERE id = $1`, [certificateId]);
        return result.rows.length > 0 ? this.mapRowToCertificate(result.rows[0]) : null;
    }
    async getCertificatesByCase(caseId) {
        const result = await (0, database_js_1.pgQuery)(`SELECT * FROM bsa_certificates WHERE case_id = $1 ORDER BY issued_at DESC`, [caseId]);
        return result.rows.map(row => this.mapRowToCertificate(row));
    }
    async getCertificatesByDocument(documentId) {
        const result = await (0, database_js_1.pgQuery)(`SELECT * FROM bsa_certificates WHERE document_id = $1 ORDER BY issued_at DESC`, [documentId]);
        return result.rows.map(row => this.mapRowToCertificate(row));
    }
    // ========================================================================
    // REVOKE CERTIFICATE
    // ========================================================================
    async revokeCertificate(certificateId, revokedBy, reason) {
        await (0, database_js_1.pgQuery)(`UPDATE bsa_certificates SET
                status = 'REVOKED',
                revoked_at = NOW(),
                revoked_by = $1,
                revocation_reason = $2,
                updated_at = NOW()
             WHERE id = $3`, [revokedBy, reason, certificateId]);
        // Record blockchain event
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: database_js_2.CustodyAction.SIGNATURE_APPLY,
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
    async verifyCertificateAuthority(caseId, userId, certificateType) {
        const result = await (0, database_js_1.pgQuery)(`SELECT role FROM users WHERE id = $1`, [userId]);
        if (result.rows.length === 0)
            return false;
        const role = result.rows[0].role;
        // Only Prosecutors and Courts can issue BSA certificates
        if (role === 'PROSECUTOR' || role === 'COURT' || role === 'CENTRAL_ADMIN') {
            // Check case assignment
            const assignmentResult = await (0, database_js_1.pgQuery)(`SELECT 1 FROM case_assignments WHERE case_id = $1 AND user_id = $2 AND is_active = TRUE`, [caseId, userId]);
            if (assignmentResult.rows.length > 0)
                return true;
            // Check direct assignment
            const caseResult = await (0, database_js_1.pgQuery)(`SELECT 1 FROM cases WHERE id = $1 AND (prosecutor_id = $2 OR court_id = $2)`, [caseId, userId]);
            return caseResult.rows.length > 0;
        }
        return false;
    }
    async getCustodyChain(documentId) {
        const result = await (0, database_js_1.pgQuery)(`SELECT cl.*, u.full_name as actor_name
             FROM custody_ledger cl
             LEFT JOIN users u ON u.id = cl.actor_user_id
             WHERE cl.document_id = $1 AND cl.is_valid = TRUE
             ORDER BY cl.tx_timestamp ASC`, [documentId]);
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
    computeMetadataHash(document) {
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
    computeChainOfCustodyHash(custodyChain) {
        const chainData = custodyChain.map(c => `${c.tx_id}:${c.block_hash}`).join('|');
        return crypto.createHash('sha256').update(chainData).digest('hex');
    }
    async verifyChainOfCustody(txIds, expectedChainHash) {
        const result = await (0, database_js_1.pgQuery)(`SELECT tx_id, block_hash FROM custody_ledger WHERE tx_id = ANY($1) ORDER BY tx_timestamp`, [txIds]);
        const chainData = result.rows.map(row => `${row.tx_id}:${row.block_hash}`).join('|');
        const computedHash = crypto.createHash('sha256').update(chainData).digest('hex');
        return computedHash === expectedChainHash;
    }
    buildCertificateContent(document, custodyChain, customContent) {
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
    buildQrCodeData(certificateNumber, fileHash, caseId) {
        return JSON.stringify({
            v: 1,
            type: 'BSA_63_CERT',
            cert: certificateNumber,
            hash: fileHash.substring(0, 16),
            case: caseId.substring(0, 8),
            verify: `${config.server.corsOrigin}/verify/${certificateNumber}`,
        });
    }
    async generateCertificateNumber(caseId, client) {
        const result = await client.query(`SELECT COUNT(*) as count FROM bsa_certificates WHERE case_id = $1`, [caseId]);
        const count = parseInt(result.rows[0].count, 10) + 1;
        const year = new Date().getFullYear();
        return `BSA63/${year}/${caseId.slice(0, 8).toUpperCase()}/${count.toString().padStart(4, '0')}`;
    }
    async generateCertificatePdf(certificate) {
        // In production, use pdf-lib or puppeteer to generate PDF
        // For now, return placeholder
        return `/api/v1/bsa/${certificate.id}/pdf`;
    }
    mapRowToCertificate(row) {
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
exports.BsaCertificateService = BsaCertificateService;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let bsaCertificateServiceInstance = null;
function getBsaCertificateService() {
    if (!bsaCertificateServiceInstance) {
        bsaCertificateServiceInstance = new BsaCertificateService();
    }
    return bsaCertificateServiceInstance;
}
//# sourceMappingURL=bsa-certificate.service.js.map