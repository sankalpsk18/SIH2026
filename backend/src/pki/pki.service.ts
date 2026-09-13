/**
 * ADALAT360 - PKI Service
 * High-level service integrating CA with users, blockchain nodes, and asset custody actors
 */

import { getPkiFactory } from './pki.factory.js';
import { getBlockchainService } from '../blockchain/blockchain.service.js';
import { getAssetLifecycleService } from '../asset-lifecycle/asset-lifecycle.service.js';
import { getPkiFactory, LocalOpenSSLCa } from './pki.factory.js';
import { LocalOpenSSLCa } from './local-ca.js';
import { CertificateCategory, CertificateStatus, CertificateRequest, CertificateInfo, RevocationReason, CertificateValidationResult } from '../models/pki.js';
import { pgQuery, pgTransaction } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { logAuditEvent } from '../services/audit.service.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// PKI SERVICE CLASS
// ============================================================================

export class PkiService {
  private factory: any;
  private ca: any;
  private initialized: boolean = false;

  async initialize(config?: any): Promise<void> {
    if (this.initialized) return;

    const { getPkiFactory } = await import('./pki.factory.js');
    const { LocalOpenSSLCa } = await import('./local-ca.js');

    this.factory = getPkiFactory();
    const ca = await this.factory.createCa({
      type: 'local',
      config: {
        storage: {
          type: 'filesystem',
          path: './pki/store',
        },
      },
    });

    this.ca = ca;
    this.initialized = true;
    logger.info('PKI Service initialized');
  }

  // ========================================================================
  // USER IDENTITY CERTIFICATES
  // ========================================================================

  async issueUserCertificate(userId: string, subjectName: string, email: string, department: string): Promise<any> {
    const request = {
      category: 'USER_IDENTITY' as const,
      subjectId: userId,
      subjectName,
      email,
      department,
      organization: 'ADALAT360',
    };

    const result = await this.ca.issueCertificate(request);

    // Store certificate reference in user record
    await pgQuery(
      `UPDATE users SET x509_cert_pem = $1, x509_cert_serial = $2, x509_cert_issued_at = NOW(), x509_cert_expires_at = $3 WHERE id = $4`,
      [result.certificatePem, result.serialNumber, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), userId]
    );

    await logAuditEvent({
      event_type: 'USER_CERTIFICATE_ISSUED',
      event_category: 'PKI',
      user_id: userId,
      action: 'issue_user_certificate',
      outcome: 'SUCCESS',
      resource_type: 'USER_CERTIFICATE',
      metadata: { serial_number: result.serialNumber },
    });

    return result;
  }

  async getUserCertificate(userId: string): Promise<any | null> {
    const result = await pgQuery(
      `SELECT x509_cert_pem, x509_cert_serial, x509_cert_issued_at, x509_cert_expires_at FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0 || !result.rows[0].x509_cert_pem) return null;

    const row = result.rows[0];
    return {
      certificatePem: row.x509_cert_pem,
      serialNumber: row.x509_cert_serial,
      issuedAt: row.x509_cert_issued_at,
      expiresAt: row.x509_cert_expires_at,
    };
  }

  async revokeUserCertificate(userId: string, reason: string, revokedBy: string): Promise<void> {
    const userCert = await this.getUserCertificate(userId);
    if (!userCert) throw new Error('User has no certificate');

    // Find certificate by serial number
    const certs = await this.ca.listCertificates({
      category: 'USER_IDENTITY',
      subjectId: userId,
    });

    for (const cert of certs) {
      if (cert.serialNumber === userCert.serialNumber) {
        await this.ca.revokeCertificate(cert.certificateId, 'PRIVILEGE_WITHDRAWN', revokedBy);
        break;
      }
    }

    // Clear user certificate fields
    await pgQuery(
      `UPDATE users SET x509_cert_pem = NULL, x509_cert_serial = NULL, x509_cert_issued_at = NULL, x509_cert_expires_at = NULL WHERE id = $1`,
      [userId]
    );

    await logAuditEvent({
      event_type: 'USER_CERTIFICATE_REVOKED',
      event_category: 'PKI',
      user_id: userId,
      action: 'revoke_user_certificate',
      outcome: 'SUCCESS',
      resource_type: 'USER_CERTIFICATE',
      metadata: { serial_number: userCert.serialNumber, reason },
    });
  }

  async renewUserCertificate(userId: string): Promise<any> {
    const userCert = await this.getUserCertificate(userId);
    if (!userCert) throw new Error('User has no certificate to renew');

    const certs = await this.ca.listCertificates({
      category: 'USER_IDENTITY',
      subjectId: userId,
    });

    for (const cert of certs) {
      if (cert.serialNumber === userCert.serialNumber) {
        const renewed = await this.ca.renewCertificate(cert.certificateId);
        // Update user record
        await pgQuery(
          `UPDATE users SET x509_cert_pem = $1, x509_cert_serial = $2, x509_cert_issued_at = NOW(), x509_cert_expires_at = $3 WHERE id = $4`,
          [renewed.certificatePem, renewed.serialNumber, renewed.expiresAt, userId]
        );
        return renewed;
      }
    }
    throw new Error('Certificate not found for renewal');
  }

  // ========================================================================
  // BLOCKCHAIN NODE CERTIFICATES
  // ========================================================================

  async issueNodeCertificate(nodeId: string, organization: string, nodeHostname: string, nodeEndpoint: string, mspId: string): Promise<any> {
    const request = {
      category: 'BLOCKCHAIN_NODE' as const,
      subjectId: nodeId,
      subjectName: nodeId,
      organization,
      nodeHostname,
      nodeEndpoint,
      mspId,
    };

    const result = await this.ca.issueCertificate(request);

    await logAuditEvent({
      event_type: 'NODE_CERTIFICATE_ISSUED',
      event_category: 'PKI',
      action: 'issue_node_certificate',
      outcome: 'SUCCESS',
      resource_type: 'NODE_CERTIFICATE',
      metadata: { node_id: nodeId, serial_number: result.serialNumber },
    });

    return result;
  }

  async getNodeCertificate(nodeId: string): Promise<any | null> {
    const certs = await this.ca.listCertificates({
      category: 'BLOCKCHAIN_NODE',
      subjectId: nodeId,
    });
    return certs.length > 0 ? certs[0] : null;
  }

  async revokeNodeCertificate(nodeId: string, reason: string): Promise<void> {
    const certs = await this.ca.listCertificates({
      category: 'BLOCKCHAIN_NODE',
      subjectId: nodeId,
    });

    for (const cert of certs) {
      if (cert.status === 'ACTIVE') {
        await this.ca.revokeCertificate(cert.certificateId, 'CESSATION_OF_OPERATION', 'system');
      }
    }
  }

  // ========================================================================
  // ASSET CUSTODY ACTOR CERTIFICATES
  // ========================================================================

  async issueAssetActorCertificate(userId: string): Promise<any> {
    // Check if user already has asset actor certificate
    const existing = await this.ca.listCertificates({
      category: 'ASSET_CUSTODY_ACTOR',
      subjectId: userId,
    });

    if (existing.length > 0) {
      const active = existing.find(c => c.status === 'ACTIVE');
      if (active) return active;
    }

    // Get user details
    const userResult = await pgQuery(
      `SELECT full_name, email, department FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    const user = userResult.rows[0];

    const request = {
      category: 'ASSET_CUSTODY_ACTOR' as const,
      subjectId: userId,
      subjectName: user.full_name,
      email: user.email,
      department: user.department,
    };

    const result = await this.ca.issueCertificate(request);

    await logAuditEvent({
      event_type: 'ASSET_ACTOR_CERTIFICATE_ISSUED',
      event_category: 'PKI',
      user_id: userId,
      action: 'issue_asset_actor_certificate',
      outcome: 'SUCCESS',
      resource_type: 'ASSET_ACTOR_CERTIFICATE',
      metadata: { serial_number: result.serialNumber },
    });

    return result;
  }

  async getAssetActorCertificate(userId: string): Promise<any | null> {
    const certs = await this.ca.listCertificates({
      category: 'ASSET_CUSTODY_ACTOR',
      subjectId: userId,
    });
    return certs.find(c => c.status === 'ACTIVE') || null;
  }

  // ========================================================================
  // CERTIFICATE VALIDATION FOR OPERATIONS
  // ========================================================================

  async validateUserForOperation(userId: string, operation: string): Promise<CertificateValidationResult> {
    const cert = await this.getUserCertificate(userId);
    if (!cert) {
      return { valid: false, errors: ['No certificate found'], checks: {} as any };
    }

    return this.ca.validateCertificate(cert.certificatePem, 'USER_IDENTITY', true);
  }

  async validateNodeForEndorsement(nodeId: string): Promise<CertificateValidationResult> {
    const cert = await this.getNodeCertificate(nodeId);
    if (!cert) {
      return { valid: false, errors: ['Node has no valid certificate'], checks: {} as any };
    }

    return this.ca.validateCertificate(cert.certificatePem, 'BLOCKCHAIN_NODE', true);
  }

  async validateAssetActorForTransition(userId: string): Promise<CertificateValidationResult> {
    const cert = await this.getAssetActorCertificate(userId);
    if (!cert) {
      return { valid: false, errors: ['User has no asset actor certificate'], checks: {} as any };
    }

    return this.ca.validateCertificate(cert.certificatePem, 'ASSET_CUSTODY_ACTOR', true);
  }

  // ========================================================================
  // CROSS-VALIDATION (CUSTODY LEDGER INTEGRATION)
  // ========================================================================

  async validateCustodyTransaction(certPem: string, category: CertificateCategory): Promise<CertificateValidationResult> {
    return this.ca.validateCertificate(certPem, category, true);
  }

  async validateAssetStateTransition(userId: string): Promise<CertificateValidationResult> {
    // Asset custody actors use the same cert as users but with ASSET_CUSTODY_ACTOR category
    // In practice, the same user certificate is used but validated against ASSET_CUSTODY_ACTOR profile
    const userCert = await this.getUserCertificate(userId);
    if (!userCert) {
      return { valid: false, errors: ['No certificate found'], checks: {} as any };
    }

    // Validate against ASSET_CUSTODY_ACTOR profile (same key, different extended key usage)
    return this.ca.validateCertificate(userCert.certificatePem, 'ASSET_CUSTODY_ACTOR', true);
  }

  // ========================================================================
  // CERTIFICATE REVOCATION CHECKING (for blockchain endorsement)
  // ========================================================================

  async isCertificateRevoked(serialNumber: string, category: CertificateCategory): Promise<boolean> {
    return this.ca.isRevoked(serialNumber, category);
  }

  async checkRevocationBeforeEndorsement(nodeId: string): Promise<boolean> {
    const cert = await this.getNodeCertificate(nodeId);
    if (!cert) return false;

    return this.ca.isRevoked(cert.serialNumber, 'BLOCKCHAIN_NODE');
  }

  async checkRevocationBeforeAssetTransition(userId: string): Promise<boolean> {
    const cert = await this.getAssetActorCertificate(userId);
    if (!cert) return false;

    return this.ca.isRevoked(cert.serialNumber, 'ASSET_CUSTODY_ACTOR');
  }

  // ========================================================================
  // CRL / OCSP INTEGRATION
  // ========================================================================

  async publishCRLs(): Promise<void> {
    await this.ca.publishCRL('USER_IDENTITY');
    await this.ca.publishCRL('BLOCKCHAIN_NODE');
    await this.ca.publishCRL('ASSET_CUSTODY_ACTOR');
  }

  async getCRL(category: string): Promise<string> {
    const result = await this.ca.getCRL(category as any);
    return result?.crlPem || '';
  }

  // ========================================================================
  // KEY ROTATION
  // ========================================================================

  async rotateUserKeys(userId: string): Promise<any> {
    const userCert = await this.getUserCertificate(userId);
    if (!userCert) throw new Error('No certificate to rotate');

    // Revoke old
    await this.revokeUserCertificate(userId, 'SUPERSEDED', 'system');

    // Issue new
    const userResult = await pgQuery(`SELECT full_name, email, department FROM users WHERE id = $1`, [userId]);
    const user = userResult.rows[0];

    return this.issueUserCertificate(userId, user.full_name, user.email, user.department);
  }

  async rotateNodeKeys(nodeId: string): Promise<any> {
    // Similar to user rotation but for nodes
    // Would need node details from config
    throw new Error('Not implemented yet');
  }

  // ========================================================================
  // CERTIFICATE CHAIN VALIDATION (for custody ledger)
  // ========================================================================

  async validateCertificateChain(certPem: string, category: string): Promise<any> {
    return this.ca.validateChain(certPem, category);
  }

  // ========================================================================
  // AUDIT & COMPLIANCE
  // ========================================================================

  async getCertificateAuditTrail(certificateId: string): Promise<any[]> {
    const result = await pgQuery(
      `SELECT * FROM audit_logs WHERE metadata->>'certificate_id' = $1 ORDER BY occurred_at DESC`,
      [certificateId]
    );
    return result.rows;
  }

  async getRevokedCertificatesReport(category?: string, since?: Date): Promise<any[]> {
    return this.ca.getRevokedCertificates(category as any, since);
  }

  // ========================================================================
  // HEALTH & MONITORING
  // ========================================================================

  async healthCheck(): Promise<any> {
    const factoryHealth = await this.factory.healthCheck();
    const caHealthy = await this.ca.isHealthy();

    return {
      factory: factoryHealth,
      ca: caHealthy,
      overall: caHealthy && Object.values(factoryHealth).every(v => v),
      timestamp: new Date(),
    };
  }

  async getExpiringCertificates(days: number = 30): Promise<any[]> {
    const expiring = [];
    const categories = ['USER_IDENTITY', 'BLOCKCHAIN_NODE', 'ASSET_CUSTODY_ACTOR'] as const;

    for (const category of categories) {
      const certs = await this.ca.listCertificates({ category, status: 'ACTIVE' });
      const now = new Date();
      const threshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      for (const cert of certs) {
        if (new Date(cert.expiresAt) <= threshold) {
          expiring.push({ ...cert, daysUntilExpiry: Math.ceil((new Date(cert.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) });
        }
      }
    }

    return expiring.sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  async getCa(): Promise<any> {
    if (!this.ca) {
      this.ca = await this.factory.getCa();
    }
    return this.ca;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let pkiServiceInstance: PkiService | null = null;

export function getPkiService(): PkiService {
  if (!pkiServiceInstance) {
    pkiServiceInstance = new PkiService();
  }
  return pkiServiceInstance;
}

export async function initializePki(config?: any): Promise<PkiService> {
  const service = getPkiService();
  await service.initialize(config);
  return service;
}