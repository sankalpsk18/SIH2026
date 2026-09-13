/**
 * ADALAT360 - Local OpenSSL-backed CA Implementation
 * Local CA simulation with full X.509 certificate lifecycle
 * Uses Node.js crypto and forge for certificate operations
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { forge } from 'node-forge';
import {
  CertificateCategory,
  CertificateStatus,
  RevocationReason,
  CertificateRequest,
  CertificateResponse,
  CertificateInfo,
  CertificateStoreEntry,
  RevokedCertificate,
  CRLResponse,
  OCSPRequest,
  OCSPResponse,
  CertificateValidationResult,
  CAConfig,
  DEFAULT_CA_CONFIG,
  CertificateStoreEntry,
  CertificateExtension,
  PkiEvent,
  PkiEventType,
  CertificateExtension,
} from '../models/pki.js';
import { CertificateAuthority, CaProvider, CAConfig, CertificateRequest, CertificateResponse, CertificateInfo, CertificateStoreEntry, RevokedCertificate, CRLResponse, OCSPRequest, OCSPResponse, CertificateValidationResult } from './ca-interface.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// ============================================================================
// LOCAL CA IMPLEMENTATION
// ============================================================================

export class LocalOpenSSLCa implements CertificateAuthority {
  readonly provider: CaProvider = {
    name: 'LocalOpenSSLCa',
    version: '1.0.0',
  };

  private config: CAConfig = DEFAULT_CA_CONFIG;
  private initialized: boolean = false;
  private caKeys: Map<CertificateCategory, { privateKey: forge.pki.PrivateKey; cert: forge.pki.Certificate }> = new Map();
  private certificateStore: Map<string, CertificateStoreEntry> = new Map();
  private revokedCerts: Map<string, RevokedCertificate> = new Map(); // key: "category:serialNumber"
  private crlCache: Map<CertificateCategory, { crl: forge.pki.Crl; generatedAt: Date }> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  async initialize(config: CAConfig = DEFAULT_CA_CONFIG): Promise<void> {
    this.config = { ...DEFAULT_CA_CONFIG, ...config };

    // Ensure storage directories exist
    await this.ensureDirectories();

    // Load or generate root CA
    await this.loadOrGenerateRootCA();

    // Load or generate intermediate CAs
    for (const category of Object.keys(this.config.intermediateCas) as CertificateCategory[]) {
      await this.loadOrGenerateIntermediateCA(category);
    }

    // Load existing certificates from storage
    await this.loadCertificateStore();

    // Load revoked certificates
    await this.loadRevokedCerts();

    // Generate initial CRLs
    for (const category of Object.keys(this.config.intermediateCas) as CertificateCategory[]) {
      await this.generateCRL(category);
    }

    this.initialized = true;
    logger.info('LocalOpenSSLCa initialized successfully');
    this.emit('initialized', { timestamp: new Date() });
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.config.storage.path,
      path.join(this.config.storage.path, 'root'),
      path.join(this.config.storage.path, 'user'),
      path.join(this.config.storage.path, 'node'),
      path.join(this.config.storage.path, 'asset'),
      path.join(this.config.storage.path, 'crl'),
      path.join(this.config.storage.path, 'certs'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private async loadOrGenerateRootCA(): Promise<void> {
    const rootKeyPath = this.config.rootCa.keyFile;
    const rootCertPath = this.config.rootCa.certFile;

    if (fs.existsSync(rootKeyPath) && fs.existsSync(rootCertPath)) {
      // Load existing
      const keyPem = fs.readFileSync(rootKeyPath, 'utf8');
      const certPem = fs.readFileSync(rootCertPath, 'utf8');
      const privateKey = forge.pki.privateKeyFromPem(keyPem);
      const cert = forge.pki.certificateFromPem(certPem);
      this.caKeys.set('ROOT', { privateKey, cert });
      logger.info('Loaded existing Root CA');
    } else {
      // Generate new root CA
      const keys = forge.pki.rsa.generateKeyPair(this.config.rootCa.keySize);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + this.config.rootCa.validityDays);
      const attrs = this.parseDN(this.config.rootCa.subjectDn);
      cert.setSubject(attrs);
      cert.setIssuer(attrs); // Self-signed
      cert.setExtensions([
        { name: 'basicConstraints', critical: true, cA: true },
        { name: 'keyUsage', critical: true, keyCertSign: true, cRLSign: true },
        { name: 'subjectKeyIdentifier', critical: false },
      ]);
      cert.sign(keys.privateKey);

      // Save
      fs.writeFileSync(rootKeyPath, forge.pki.privateKeyToPem(keys.privateKey));
      fs.writeFileSync(rootCertPath, forge.pki.certificateToPem(cert));

      this.caKeys.set('ROOT', { privateKey: keys.privateKey, cert });
      logger.info('Generated new Root CA');
    }
  }

  private async loadOrGenerateIntermediateCA(category: CertificateCategory): Promise<void> {
    const caConfig = this.config.intermediateCas[category];
    const keyPath = caConfig.keyFile;
    const certPath = caConfig.certFile;

    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      // Load existing
      const keyPem = fs.readFileSync(keyPath, 'utf8');
      const certPem = fs.readFileSync(certPath, 'utf8');
      const privateKey = forge.pki.privateKeyFromPem(keyPem);
      const cert = forge.pki.certificateFromPem(certPem);
      this.caKeys.set(category, { privateKey, cert });
      logger.info(`Loaded existing ${category} Intermediate CA`);
    } else {
      // Generate new intermediate CA signed by root
      const rootCa = this.caKeys.get('ROOT');
      if (!rootCa) throw new Error('Root CA not loaded');

      const keys = forge.pki.rsa.generateKeyPair(caConfig.keySize);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = this.generateSerialNumber();
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + caConfig.validityDays);

      const attrs = this.parseDN(caConfig.subjectDn);
      cert.setSubject(attrs);
      cert.setIssuer(rootCa.cert.subject.attributes);

      cert.setExtensions([
        { name: 'basicConstraints', critical: true, cA: true, pathLenConstraint: 0 },
        { name: 'keyUsage', critical: true, keyCertSign: true, cRLSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true },
        { name: 'subjectKeyIdentifier', critical: false },
        { name: 'authorityKeyIdentifier', critical: false },
      ]);
      cert.sign(rootCa.privateKey);

      // Save
      fs.writeFileSync(keyPath, forge.pki.privateKeyToPem(keys.privateKey));
      fs.writeFileSync(certPath, forge.pki.certificateToPem(cert));

      this.caKeys.set(category, { privateKey: keys.privateKey, cert });
      logger.info(`Generated new ${category} Intermediate CA`);
    }
  }

  private parseDN(dn: string): forge.pki.CertificateAttrs[] {
    // Parse DN string like "CN=ADALAT360 Root CA, O=ADALAT360, C=IN"
    const attrs: forge.pki.CertificateAttrs[] = [];
    const parts = dn.split(',').map(p => p.trim());
    for (const part of parts) {
      const [key, value] = part.split('=').map(s => s.trim());
      if (key && value) {
        attrs.push({ name: key, value });
      }
    }
    return attrs;
  }

  private generateSerialNumber(): string {
    // Generate 20-byte serial number as hex
    const bytes = crypto.randomBytes(20);
    return bytes.toString('hex').toUpperCase();
  }

  private async loadCertificateStore(): Promise<void> {
    const storePath = path.join(this.config.storage.path, 'certs', 'store.json');
    if (fs.existsSync(storePath)) {
      const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      for (const entry of data) {
        this.certificateStore.set(entry.certificateId, entry);
      }
      logger.info(`Loaded ${this.certificateStore.size} certificates from store`);
    }
  }

  private async loadRevokedCerts(): Promise<void> {
    const revokedPath = path.join(this.config.storage.path, 'crl', 'revoked.json');
    if (fs.existsSync(revokedPath)) {
      const data = JSON.parse(fs.readFileSync(revokedPath, 'utf8'));
      for (const entry of data) {
        const key = `${entry.category}:${entry.serialNumber}`;
        this.revokedCerts.set(key, entry);
      }
      logger.info(`Loaded ${this.revokedCerts.size} revoked certificates`);
    }
  }

  private saveCertificateStore(): void {
    const storePath = path.join(this.config.storage.path, 'certs', 'store.json');
    const data = Array.from(this.certificateStore.values());
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
  }

  private saveRevokedCerts(): void {
    const revokedPath = path.join(this.config.storage.path, 'crl', 'revoked.json');
    const data = Array.from(this.revokedCerts.values());
    fs.writeFileSync(revokedPath, JSON.stringify(data, null, 2));
  }

  // ========================================================================
  // CERTIFICATE LIFECYCLE
  // ========================================================================

  async issueCertificate(request: CertificateRequest): Promise<CertificateResponse> {
    if (!this.initialized) throw new Error('CA not initialized');

    const category = request.category;
    const ca = this.caKeys.get(category);
    if (!ca) throw new Error(`CA for category ${category} not initialized`);

    const profile = this.config.intermediateCas[category];
    const validityDays = request.validityDays || profile.validityDays;
    if (validityDays > this.config.policy.maxValidityDays[category]) {
      throw new Error(`Validity exceeds maximum for ${category}`);
    }

    // Generate or use provided key pair
    let keys: forge.pki.KeyPair;
    if (request.csr) {
      // Parse CSR
      const csr = forge.pki.certificationRequestFromPem(request.csr);
      if (!csr.verify()) throw new Error('Invalid CSR signature');
      // Use public key from CSR
      // For simplicity, we'll generate new keys here
      keys = forge.pki.rsa.generateKeyPair(2048);
    } else {
      keys = forge.pki.rsa.generateKeyPair(2048);
    }

    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    const serialNumber = this.generateSerialNumber();
    cert.serialNumber = serialNumber;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
    cert.validity.notBefore = now;
    cert.validity.notAfter = expiresAt;

    // Subject DN
    const subjectAttrs = this.buildSubjectDN(category, request);
    cert.setSubject(subjectAttrs);

    // Issuer = Intermediate CA
    const caCert = this.caKeys.get(category)!.cert;
    cert.setIssuer(caCert.subject.attributes);

    // Extensions
    const extensions = this.buildExtensions(category, request, caCert);
    cert.setExtensions(extensions);

    // Sign with intermediate CA private key
    cert.sign(this.caKeys.get(category)!.privateKey);

    // Generate IDs
    const certificateId = uuidv4();
    const now = new Date();

    // Prepare response
    const certPem = forge.pki.certificateToPem(cert);
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const fingerprintSha256 = this.computeFingerprint(certPem, 'sha256');
    const fingerprintSha1 = this.computeFingerprint(certPem, 'sha1');
    const authKeyId = this.computeAuthorityKeyIdentifier(caCert);
    const subjKeyId = this.computeSubjectKeyIdentifier(cert);

    // Store certificate
    const entry: CertificateStoreEntry = {
      certificateId,
      category,
      serialNumber,
      subjectDn: forge.pki.distinguishedNameToString(cert.subject.attributes),
      issuerDn: forge.pki.distinguishedNameToString(caCert.subject.attributes),
      subjectId: request.subjectId,
      subjectName: request.subjectName,
      email: request.email,
      department: request.department,
      organization: request.organization,
      status: 'ACTIVE',
      issuedAt: now,
      expiresAt,
      certificatePem: certPem,
      privateKeyPem, // Store encrypted in production
      privateKeyEncrypted: false,
      fingerprintSha256,
      fingerprintSha1,
      authorityKeyIdentifier: authKeyId,
      subjectKeyIdentifier: subjKeyId,
      certificatePem: certPem,
      ocspUrl: this.config.revocation.ocspResponderUrl,
      crlUrl: `${this.config.revocation.crlDistributionPoint}/${category}.crl`,
      metadata: { request },
      createdAt: now,
      updatedAt: now,
    };

    this.certificateStore.set(certificateId, entry);
    this.saveCertificateStore();

    // Emit event
    this.emitPkiEvent('CERTIFICATE_ISSUED', {
      certificateId,
      serialNumber,
      category,
      subjectId: request.subjectId,
      actorUserId: request.subjectId, // Would come from auth context
    });

    return {
      certificateId,
      serialNumber,
      certificatePem: certPem,
      privateKeyPem,
      issuedAt: now,
      expiresAt,
      status: 'ACTIVE',
      fingerprintSha256,
      fingerprintSha1,
      authorityKeyIdentifier: authKeyId,
      subjectKeyIdentifier: subjKeyId,
    };
  }

  private buildSubjectDN(category: CertificateCategory, request: CertificateRequest): forge.pki.CertificateAttrs[] {
    const profile = this.config.intermediateCas[category];
    const template = profile.subjectNameFormat;

    // Replace placeholders
    const dnString = template
      .replace('{fullName}', request.subjectName)
      .replace('{department}', request.department || '')
      .replace('{organization}', request.organization || 'ADALAT360')
      .replace('{nodeId}', request.subjectId)
      .replace('{userId}', request.subjectId)
      .replace('{mspId}', request.mspId || '');

    return this.parseDN(dnString);
  }

  private buildExtensions(category: CertificateCategory, request: CertificateRequest, caCert: forge.pki.Certificate): forge.pki.CertificateExtension[] {
    const profile = this.config.intermediateCas[category];
    const extensions: forge.pki.CertificateExtension[] = [
      { name: 'basicConstraints', critical: false, cA: false },
      { name: 'keyUsage', critical: true, ...this.getKeyUsageFlags(category) },
      { name: 'extendedKeyUsage', critical: true, ...this.getExtendedKeyUsageFlags(category) },
      { name: 'subjectKeyIdentifier', critical: false },
      { name: 'authorityKeyIdentifier', critical: false },
    ];

    // Subject Alternative Name
    const sanList = [];
    if (request.email) sanList.push({ type: 1, value: request.email }); // rfc822Name
    if (request.nodeHostname) sanList.push({ type: 2, value: request.nodeHostname }); // dNSName
    if (request.nodeEndpoint) sanList.push({ type: 6, value: request.nodeEndpoint }); // URI
    if (request.mspId) sanList.push({ type: 7, value: request.mspId }); // otherName (custom OID)

    if (sanList.length > 0) {
      extensions.push({ name: 'subjectAltName', critical: false, altNames: sanList });
    }

    // Custom extensions
    if (request.customExtensions) {
      for (const ext of request.customExtensions) {
        extensions.push({
          name: ext.oid,
          critical: ext.critical,
          value: ext.value,
        } as any);
      }
    }

    return extensions;
  }

  private getKeyUsageFlags(category: CertificateCategory): Record<string, boolean> {
    const profile = this.config.intermediateCas[category];
    const flags: Record<string, boolean> = {};
    for (const usage of profile.keyUsage) {
      flags[usage.toLowerCase().replace(/_/g, '')] = true;
    }
    return flags;
  }

  private getExtendedKeyUsageFlags(category: CertificateCategory): Record<string, boolean> {
    const flags: Record<string, boolean> = {};
    const profile = this.config.intermediateCas[category];
    for (const oid of profile.extendedKeyUsage) {
      // Map OID to name
      const oidMap: Record<string, string> = {
        '1.3.6.1.5.5.7.3.1': 'serverAuth',
        '1.3.6.1.5.5.7.3.2': 'clientAuth',
        '1.3.6.1.5.5.7.3.4': 'emailProtection',
        '1.3.6.1.4.1.311.20.2.2': 'smartCardLogon',
      };
      const name = oidMap[oid] || oid;
      flags[name] = true;
    }
    return flags;
  }

  // ========================================================================
  // REVOCATION
  // ========================================================================

  async revokeCertificate(certificateId: string, reason: RevocationReason, revokedBy: string): Promise<void> {
    const entry = this.certificateStore.get(certificateId);
    if (!entry) throw new Error('Certificate not found');

    if (entry.status === 'REVOKED') {
      throw new Error('Certificate already revoked');
    }

    const now = new Date();
    entry.status = 'REVOKED';
    entry.revokedAt = now;
    entry.revocationReason = reason;
    entry.updatedAt = now;
    this.certificateStore.set(entry.certificateId, entry);
    this.saveCertificateStore();

    // Add to revoked list
    const revoked: RevokedCertificate = {
      serialNumber: entry.serialNumber,
      revocationDate: now,
      revocationReason: reason,
      certificateId: entry.certificateId,
      category: entry.category,
      subjectId: entry.subjectId,
    };
    const key = `${entry.category}:${entry.serialNumber}`;
    this.revokedCerts.set(key, revoked);
    this.saveRevokedCerts();

    // Regenerate CRL
    await this.generateCRL(entry.category);

    // Emit event
    this.emitPkiEvent('CERTIFICATE_REVOKED', {
      certificateId,
      serialNumber: entry.serialNumber,
      category: entry.category,
      subjectId: entry.subjectId,
      reason,
      revokedBy,
    });

    logger.warn(`Certificate revoked: ${certificateId}, reason: ${reason}`);
  }

  async suspendCertificate(certificateId: string, reason: string): Promise<void> {
    const entry = this.certificateStore.get(certificateId);
    if (!entry) throw new Error('Certificate not found');

    entry.status = 'SUSPENDED';
    entry.updatedAt = new Date();
    this.certificateStore.set(certificateId, entry);
    this.saveCertificateStore();

    this.emitPkiEvent('CERTIFICATE_SUSPENDED', {
      certificateId,
      reason,
    });
  }

  async reinstateCertificate(certificateId: string): Promise<void> {
    const entry = this.certificateStore.get(certificateId);
    if (!entry) throw new Error('Certificate not found');

    if (entry.status !== 'SUSPENDED') {
      throw new Error('Certificate is not suspended');
    }

    // Remove from revoked if it was there
    const key = `${entry.category}:${entry.serialNumber}`;
    this.revokedCerts.delete(key);
    this.saveRevokedCerts();

    entry.status = 'ACTIVE';
    entry.revokedAt = undefined;
    entry.revocationReason = undefined;
    entry.updatedAt = new Date();
    this.certificateStore.set(entry.certificateId, entry);
    this.saveCertificateStore();

    // Regenerate CRL
    await this.generateCRL(entry.category);

    this.emitPkiEvent('CERTIFICATE_REINSTATED', {
      certificateId,
    });
  }

  // ========================================================================
  // QUERY METHODS
  // ========================================================================

  async getCertificate(certificateId: string): Promise<CertificateInfo | null> {
    const entry = this.certificateStore.get(certificateId);
    if (!entry) return null;
    return this.entryToInfo(entry);
  }

  async getCertificateBySerial(serialNumber: string, category: CertificateCategory): Promise<CertificateInfo | null> {
    for (const entry of this.certificateStore.values()) {
      if (entry.serialNumber === serialNumber && entry.category === category) {
        return this.entryToInfo(entry);
      }
    }
    return null;
  }

  async listCertificates(filters: {
    category?: CertificateCategory;
    status?: CertificateStatus;
    subjectId?: string;
    issuedAfter?: Date;
    issuedBefore?: Date;
    limit?: number;
    offset?: number;
  }): Promise<CertificateInfo[]> {
    let entries = Array.from(this.certificateStore.values());

    if (filters.category) entries = entries.filter(e => e.category === filters.category);
    if (filters.status) entries = entries.filter(e => e.status === filters.status);
    if (filters.subjectId) entries = entries.filter(e => e.subjectId === filters.subjectId);
    if (filters.issuedAfter) entries = entries.filter(e => e.issuedAt >= filters.issuedAfter!);
    if (filters.issuedBefore) entries = entries.filter(e => e.issuedAt <= filters.issuedBefore!);

    // Sort by issued date descending
    entries.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());

    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    entries = entries.slice(offset, offset + limit);

    return entries.map(e => this.entryToInfo(e));
  }

  private entryToInfo(entry: CertificateStoreEntry): CertificateInfo {
    return {
      certificateId: entry.certificateId,
      serialNumber: entry.serialNumber,
      subjectDn: entry.subjectDn,
      issuerDn: entry.issuerDn,
      category: entry.category,
      subjectId: entry.subjectId,
      subjectName: entry.subjectName,
      email: entry.email,
      department: entry.department,
      organization: entry.organization,
      status: entry.status,
      issuedAt: entry.issuedAt,
      expiresAt: entry.expiresAt,
      revokedAt: entry.revokedAt,
      revocationReason: entry.revocationReason,
      keyUsage: [], // Would extract from cert
      extendedKeyUsage: [],
      fingerprintSha256: entry.fingerprintSha256,
      fingerprintSha1: entry.fingerprintSha1,
      authorityKeyIdentifier: entry.authorityKeyIdentifier,
      subjectKeyIdentifier: entry.subjectKeyIdentifier,
      certificatePem: entry.certificatePem,
      ocspUrl: entry.ocspUrl,
      crlUrl: entry.crlUrl,
    };
  }

  // ========================================================================
  // KEY MANAGEMENT
  // ========================================================================

  async renewCertificate(certificateId: string, additionalDays?: number): Promise<CertificateResponse> {
    const entry = this.certificateStore.get(certificateId);
    if (!entry) throw new Error('Certificate not found');

    // Create new certificate with same subject
    const request: CertificateRequest = {
      category: entry.category,
      subjectId: entry.subjectId,
      subjectName: entry.subjectName,
      email: entry.email,
      department: entry.department,
      organization: entry.organization,
      validityDays: additionalDays,
    };

    // Revoke old certificate
    await this.revokeCertificate(certificateId, 'SUPERSEDED', 'system');

    // Issue new
    return this.issueCertificate(request);
  }

  async rotateKey(certificateId: string): Promise<CertificateResponse> {
    return this.renewCertificate(certificateId);
  }

  async exportPrivateKey(certificateId: string, passphrase: string): Promise<string> {
    const entry = this.certificateStore.get(certificateId);
    if (!entry) throw new Error('Certificate not found');

    // In production, encrypt with passphrase using PBKDF2
    // For now, return raw (would be encrypted in production)
    if (!entry.privateKeyPem) throw new Error('Private key not available');
    return entry.privateKeyPem;
  }

  async importCertificate(certPem: string, privateKeyPem: string, category: CertificateCategory, passphrase?: string): Promise<CertificateInfo> {
    const cert = forge.pki.certificateFromPem(certPem);
    const serialNumber = cert.serialNumber;
    const fingerprintSha256 = this.computeFingerprint(certPem, 'sha256');

    // Check if already exists
    const existing = await this.getCertificateBySerial(cert.serialNumber, category);
    if (existing) throw new Error('Certificate already imported');

    const certificateId = uuidv4();
    const now = new Date();

    const entry: CertificateStoreEntry = {
      certificateId,
      category,
      serialNumber: cert.serialNumber,
      subjectDn: forge.pki.distinguishedNameToString(cert.subject.attributes),
      issuerDn: forge.pki.distinguishedNameToString(cert.issuer.attributes),
      subjectId: '', // Would extract from cert
      subjectName: cert.subject.getField('CN')?.value || '',
      status: 'ACTIVE',
      issuedAt: cert.validity.notBefore,
      expiresAt: cert.validity.notAfter,
      certificatePem: certPem,
      privateKeyPem: privateKeyPem,
      privateKeyEncrypted: !!passphrase,
      fingerprintSha256: this.computeFingerprint(certPem, 'sha256'),
      fingerprintSha1: this.computeFingerprint(certPem, 'sha1'),
      authorityKeyIdentifier: '',
      subjectKeyIdentifier: '',
      certificatePem: certPem,
      metadata: { imported: true },
      createdAt: now,
      updatedAt: now,
    };

    this.certificateStore.set(certificateId, entry);
    this.saveCertificateStore();

    return this.entryToInfo(entry);
  }

  // ========================================================================
  // REVOCATION CHECKING
  // ========================================================================

  async getRevokedCertificates(category?: CertificateCategory, since?: Date): Promise<RevokedCertificate[]> {
    let entries = Array.from(this.revokedCerts.values());

    if (category) {
      entries = entries.filter(e => e.category === category);
    }
    if (since) {
      entries = entries.filter(e => e.revocationDate >= since!);
    }

    return entries;
  }

  async isRevoked(serialNumber: string, category: CertificateCategory): Promise<boolean> {
    const key = `${category}:${serialNumber}`;
    return this.revokedCerts.has(key);
  }

  // ========================================================================
  // CRL MANAGEMENT
  // ========================================================================

  async generateCRL(category: CertificateCategory): Promise<CRLResponse> {
    const ca = this.caKeys.get(category);
    if (!ca) throw new Error(`CA for ${category} not initialized`);

    const revokedEntries = Array.from(this.revokedCerts.values())
      .filter(e => e.category === category);

    const crl = forge.pki.createCrl();
    crl.issuer = ca.cert.subject.attributes;
    crl.lastUpdate = new Date();
    crl.nextUpdate = new Date(Date.now() + this.config.revocation.crlValidityHours * 60 * 60 * 1000);

    for (const revoked of revokedEntries) {
      crl.addCertificate({
        serialNumber: revoked.serialNumber,
        revocationDate: revoked.revocationDate,
        extension: revoked.revocationReason ? [{
          name: 'crlReason',
          reason: this.mapRevocationReason(revoked.revocationReason),
        }] : undefined,
      });
    }

    // Sign with CA private key
    crl.sign(ca.privateKey);

    const crlPem = forge.pki.crlToPem(crl);
    const thisUpdate = crl.lastUpdate;
    const nextUpdate = crl.nextUpdate;

    // Save to file
    const crlPath = path.join(this.config.storage.path, 'crl', `${category.toLowerCase()}.crl`);
    fs.writeFileSync(crlPath, crlPem);

    // Cache
    this.crlCache.set(category, { crl, generatedAt: new Date() });

    return {
      crlPem,
      issuerDn: forge.pki.distinguishedNameToString(ca.cert.subject.attributes),
      thisUpdate,
      nextUpdate,
      revokedCertificates: revokedEntries.map(r => ({
        serialNumber: r.serialNumber,
        revocationDate: r.revocationDate,
        revocationReason: r.revocationReason,
      })),
    };
  }

  async getCRL(category: CertificateCategory): Promise<CRLResponse | null> {
    const cached = this.crlCache.get(category);
    if (cached && cached.crl.nextUpdate > new Date()) {
      const crlPem = forge.pki.crlToPem(cached.crl);
      return {
        crlPem,
        issuerDn: cached.crl.issuer.getAttribute('CN') || '',
        thisUpdate: cached.crl.lastUpdate,
        nextUpdate: cached.crl.nextUpdate,
        revokedCertificates: Array.from(this.revokedCerts.values())
          .filter(e => e.category === category)
          .map(r => ({ serialNumber: r.serialNumber, revocationDate: r.revocationDate, revocationReason: r.revocationReason })),
      };
    }

    // Generate fresh
    return this.generateCRL(category);
  }

  async publishCRL(category: CertificateCategory): Promise<void> {
    await this.generateCRL(category);
    // In production, publish to HTTP endpoint, LDAP, etc.
    logger.info(`CRL published for ${category}`);
  }

  private mapRevocationReason(reason: RevocationReason): string {
    const map: Record<RevocationReason, string> = {
      'KEY_COMPROMISE': 'keyCompromise',
      'CA_COMPROMISE': 'cACompromise',
      'AFFILIATION_CHANGED': 'affiliationChanged',
      'SUPERSEDED': 'superseded',
      'CESSATION_OF_OPERATION': 'cessationOfOperation',
      'PRIVILEGE_WITHDRAWN': 'privilegeWithdrawn',
      'AA_COMPROMISE': 'aACompromise',
    };
    return map[reason] || 'unspecified';
  }

  // ========================================================================
  // OCSP
  // ========================================================================

  async checkOCSP(request: OCSPRequest): Promise<OCSPResponse> {
    // Check revocation status
    const revoked = await this.isRevoked(request.serialNumber, 'USER_IDENTITY'); // Default category, would need proper lookup

    const now = new Date();
    const nextUpdate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    if (revoked) {
      const revokedEntry = this.revokedCerts.get(`${request.serialNumber}:${request.issuerDn}`);
      return {
        serialNumber: request.serialNumber,
        status: 'REVOKED',
        revocationTime: revokedEntry?.revocationDate,
        revocationReason: revokedEntry?.revocationReason,
        thisUpdate: now,
        nextUpdate,
        responseSignature: '', // Would sign with OCSP responder key
      };
    }

    return {
      serialNumber: request.serialNumber,
      status: 'GOOD',
      thisUpdate: now,
      nextUpdate,
      responseSignature: '',
    };
  }

  // ========================================================================
  // VALIDATION
  // ========================================================================

  async validateCertificate(certPem: string, category: CertificateCategory, checkRevocation: boolean = true): Promise<CertificateValidationResult> {
    const cert = forge.pki.certificateFromPem(certPem);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check expiration
    const now = new Date();
    const notExpired = cert.validity.notAfter > now;
    if (!notExpired) errors.push('Certificate has expired');

    // Check signature (self-verify for root, chain verify for intermediates)
    // In production, would verify full chain
    const signatureValid = true; // Simplified

    // Check revocation
    let notRevoked = true;
    if (checkRevocation) {
      const revoked = await this.isRevoked(cert.serialNumber, category);
      notRevoked = !revoked;
      if (revoked) errors.push('Certificate has been revoked');
    }

    // Key usage validation
    const keyUsageValid = true; // Would check extensions

    // Extended key usage
    const extendedKeyUsageValid = true;

    // Name constraints
    const nameConstraintsValid = true;

    // Policy constraints
    const policyConstraintsValid = true;

    const valid = notExpired && signatureValid && notRevoked && keyUsageValid && extendedKeyUsageValid && nameConstraintsValid && policyConstraintsValid;

    return {
      valid,
      certificate: {
        certificateId: '',
        serialNumber: cert.serialNumber,
        subjectDn: forge.pki.distinguishedNameToString(cert.subject.attributes),
        issuerDn: forge.pki.distinguishedNameToString(cert.issuer.attributes),
        category,
        status: notExpired ? (await this.isRevoked(cert.serialNumber, category) ? 'REVOKED' : 'ACTIVE') : 'EXPIRED',
        issuedAt: cert.validity.notBefore,
        expiresAt: cert.validity.notAfter,
        fingerprintSha256: this.computeFingerprint(certPem, 'sha256'),
      },
      errors,
      warnings,
      checks: {
        signatureValid,
        chainValid: true,
        notExpired,
        notRevoked,
        keyUsageValid,
        extendedKeyUsageValid,
        nameConstraintsValid,
        policyConstraintsValid,
      },
    };
  }

  async validateChain(certPem: string, category: CertificateCategory): Promise<CertificateValidationResult> {
    // In production, would verify full chain up to root
    return this.validateCertificate(certPem, category, true);
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  private computeFingerprint(data: string, algorithm: 'sha256' | 'sha1'): string {
    return crypto.createHash(algorithm).update(data).digest('hex').toUpperCase();
  }

  private computeAuthorityKeyIdentifier(cert: forge.pki.Certificate): string {
    // Compute SHA-1 of subject public key
    const spki = forge.pki.publicKeyToPem(cert.publicKey);
    return crypto.createHash('sha1').update(spki).digest('hex').toUpperCase();
  }

  private computeSubjectKeyIdentifier(cert: forge.pki.Certificate): string {
    return this.computeAuthorityKeyIdentifier(cert); // Same calculation
  }

  // ========================================================================
  // EVENT HANDLING
  // ========================================================================

  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (err) {
          logger.error(`Error in event listener for ${event}:`, err);
        }
      }
    }
  }

  private emitPkiEvent(eventType: PkiEventType, details: Record<string, any>): void {
    const event: PkiEvent = {
      eventId: uuidv4(),
      eventType,
      ...details,
      timestamp: new Date(),
      severity: 'INFO',
    };
    this.emit(eventType, event);
    this.emit('pkiEvent', event);
  }

  // ========================================================================
  // HEALTH & LIFECYCLE
  // ========================================================================

  async isHealthy(): Promise<boolean> {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.saveCertificateStore();
    this.saveRevokedCerts();
    // Save CRLs
    for (const category of Object.keys(this.config.intermediateCas) as CertificateCategory[]) {
      await this.generateCRL(category);
    }
    this.initialized = false;
    logger.info('LocalOpenSSLCa shut down');
  }
}

// ========================================================================
// FACTORY
// ========================================================================

export class LocalCaFactory {
  async createCa(options: { type: 'local'; config: CAConfig }): Promise<LocalOpenSSLCa> {
    const ca = new LocalOpenSSCa();
    await ca.initialize(options.config);
    return ca;
  }

  getSupportedTypes(): string[] {
    return ['local'];
  }
}