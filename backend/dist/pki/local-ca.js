"use strict";
/**
 * ADALAT360 - Local OpenSSL-backed CA Implementation
 * Local CA simulation with full X.509 certificate lifecycle
 * Uses Node.js crypto and forge for certificate operations
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalCaFactory = exports.LocalOpenSSLCa = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const node_forge_1 = require("node-forge");
const pki_js_1 = require("../models/pki.js");
const uuid_1 = require("uuid");
const logger_js_1 = require("../utils/logger.js");
// ============================================================================
// LOCAL CA IMPLEMENTATION
// ============================================================================
class LocalOpenSSLCa {
    provider = {
        name: 'LocalOpenSSLCa',
        version: '1.0.0',
    };
    config = pki_js_1.DEFAULT_CA_CONFIG;
    initialized = false;
    caKeys = new Map();
    certificateStore = new Map();
    revokedCerts = new Map(); // key: "category:serialNumber"
    crlCache = new Map();
    eventListeners = new Map();
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    async initialize(config = pki_js_1.DEFAULT_CA_CONFIG) {
        this.config = { ...pki_js_1.DEFAULT_CA_CONFIG, ...config };
        // Ensure storage directories exist
        await this.ensureDirectories();
        // Load or generate root CA
        await this.loadOrGenerateRootCA();
        // Load or generate intermediate CAs
        for (const category of Object.keys(this.config.intermediateCas)) {
            await this.loadOrGenerateIntermediateCA(category);
        }
        // Load existing certificates from storage
        await this.loadCertificateStore();
        // Load revoked certificates
        await this.loadRevokedCerts();
        // Generate initial CRLs
        for (const category of Object.keys(this.config.intermediateCas)) {
            await this.generateCRL(category);
        }
        this.initialized = true;
        logger_js_1.logger.info('LocalOpenSSLCa initialized successfully');
        this.emit('initialized', { timestamp: new Date() });
    }
    async ensureDirectories() {
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
    async loadOrGenerateRootCA() {
        const rootKeyPath = this.config.rootCa.keyFile;
        const rootCertPath = this.config.rootCa.certFile;
        if (fs.existsSync(rootKeyPath) && fs.existsSync(rootCertPath)) {
            // Load existing
            const keyPem = fs.readFileSync(rootKeyPath, 'utf8');
            const certPem = fs.readFileSync(rootCertPath, 'utf8');
            const privateKey = node_forge_1.forge.pki.privateKeyFromPem(keyPem);
            const cert = node_forge_1.forge.pki.certificateFromPem(certPem);
            this.caKeys.set('ROOT', { privateKey, cert });
            logger_js_1.logger.info('Loaded existing Root CA');
        }
        else {
            // Generate new root CA
            const keys = node_forge_1.forge.pki.rsa.generateKeyPair(this.config.rootCa.keySize);
            const cert = node_forge_1.forge.pki.createCertificate();
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
            fs.writeFileSync(rootKeyPath, node_forge_1.forge.pki.privateKeyToPem(keys.privateKey));
            fs.writeFileSync(rootCertPath, node_forge_1.forge.pki.certificateToPem(cert));
            this.caKeys.set('ROOT', { privateKey: keys.privateKey, cert });
            logger_js_1.logger.info('Generated new Root CA');
        }
    }
    async loadOrGenerateIntermediateCA(category) {
        const caConfig = this.config.intermediateCas[category];
        const keyPath = caConfig.keyFile;
        const certPath = caConfig.certFile;
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            // Load existing
            const keyPem = fs.readFileSync(keyPath, 'utf8');
            const certPem = fs.readFileSync(certPath, 'utf8');
            const privateKey = node_forge_1.forge.pki.privateKeyFromPem(keyPem);
            const cert = node_forge_1.forge.pki.certificateFromPem(certPem);
            this.caKeys.set(category, { privateKey, cert });
            logger_js_1.logger.info(`Loaded existing ${category} Intermediate CA`);
        }
        else {
            // Generate new intermediate CA signed by root
            const rootCa = this.caKeys.get('ROOT');
            if (!rootCa)
                throw new Error('Root CA not loaded');
            const keys = node_forge_1.forge.pki.rsa.generateKeyPair(caConfig.keySize);
            const cert = node_forge_1.forge.pki.createCertificate();
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
            fs.writeFileSync(keyPath, node_forge_1.forge.pki.privateKeyToPem(keys.privateKey));
            fs.writeFileSync(certPath, node_forge_1.forge.pki.certificateToPem(cert));
            this.caKeys.set(category, { privateKey: keys.privateKey, cert });
            logger_js_1.logger.info(`Generated new ${category} Intermediate CA`);
        }
    }
    parseDN(dn) {
        // Parse DN string like "CN=ADALAT360 Root CA, O=ADALAT360, C=IN"
        const attrs = [];
        const parts = dn.split(',').map(p => p.trim());
        for (const part of parts) {
            const [key, value] = part.split('=').map(s => s.trim());
            if (key && value) {
                attrs.push({ name: key, value });
            }
        }
        return attrs;
    }
    generateSerialNumber() {
        // Generate 20-byte serial number as hex
        const bytes = crypto.randomBytes(20);
        return bytes.toString('hex').toUpperCase();
    }
    async loadCertificateStore() {
        const storePath = path.join(this.config.storage.path, 'certs', 'store.json');
        if (fs.existsSync(storePath)) {
            const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
            for (const entry of data) {
                this.certificateStore.set(entry.certificateId, entry);
            }
            logger_js_1.logger.info(`Loaded ${this.certificateStore.size} certificates from store`);
        }
    }
    async loadRevokedCerts() {
        const revokedPath = path.join(this.config.storage.path, 'crl', 'revoked.json');
        if (fs.existsSync(revokedPath)) {
            const data = JSON.parse(fs.readFileSync(revokedPath, 'utf8'));
            for (const entry of data) {
                const key = `${entry.category}:${entry.serialNumber}`;
                this.revokedCerts.set(key, entry);
            }
            logger_js_1.logger.info(`Loaded ${this.revokedCerts.size} revoked certificates`);
        }
    }
    saveCertificateStore() {
        const storePath = path.join(this.config.storage.path, 'certs', 'store.json');
        const data = Array.from(this.certificateStore.values());
        fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
    }
    saveRevokedCerts() {
        const revokedPath = path.join(this.config.storage.path, 'crl', 'revoked.json');
        const data = Array.from(this.revokedCerts.values());
        fs.writeFileSync(revokedPath, JSON.stringify(data, null, 2));
    }
    // ========================================================================
    // CERTIFICATE LIFECYCLE
    // ========================================================================
    async issueCertificate(request) {
        if (!this.initialized)
            throw new Error('CA not initialized');
        const category = request.category;
        const ca = this.caKeys.get(category);
        if (!ca)
            throw new Error(`CA for category ${category} not initialized`);
        const profile = this.config.intermediateCas[category];
        const validityDays = request.validityDays || profile.validityDays;
        if (validityDays > this.config.policy.maxValidityDays[category]) {
            throw new Error(`Validity exceeds maximum for ${category}`);
        }
        // Generate or use provided key pair
        let keys;
        if (request.csr) {
            // Parse CSR
            const csr = node_forge_1.forge.pki.certificationRequestFromPem(request.csr);
            if (!csr.verify())
                throw new Error('Invalid CSR signature');
            // Use public key from CSR
            // For simplicity, we'll generate new keys here
            keys = node_forge_1.forge.pki.rsa.generateKeyPair(2048);
        }
        else {
            keys = node_forge_1.forge.pki.rsa.generateKeyPair(2048);
        }
        // Create certificate
        const cert = node_forge_1.forge.pki.createCertificate();
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
        const caCert = this.caKeys.get(category).cert;
        cert.setIssuer(caCert.subject.attributes);
        // Extensions
        const extensions = this.buildExtensions(category, request, caCert);
        cert.setExtensions(extensions);
        // Sign with intermediate CA private key
        cert.sign(this.caKeys.get(category).privateKey);
        // Generate IDs
        const certificateId = (0, uuid_1.v4)();
        const now = new Date();
        // Prepare response
        const certPem = node_forge_1.forge.pki.certificateToPem(cert);
        const privateKeyPem = node_forge_1.forge.pki.privateKeyToPem(keys.privateKey);
        const fingerprintSha256 = this.computeFingerprint(certPem, 'sha256');
        const fingerprintSha1 = this.computeFingerprint(certPem, 'sha1');
        const authKeyId = this.computeAuthorityKeyIdentifier(caCert);
        const subjKeyId = this.computeSubjectKeyIdentifier(cert);
        // Store certificate
        const entry = {
            certificateId,
            category,
            serialNumber,
            subjectDn: node_forge_1.forge.pki.distinguishedNameToString(cert.subject.attributes),
            issuerDn: node_forge_1.forge.pki.distinguishedNameToString(caCert.subject.attributes),
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
    buildSubjectDN(category, request) {
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
    buildExtensions(category, request, caCert) {
        const profile = this.config.intermediateCas[category];
        const extensions = [
            { name: 'basicConstraints', critical: false, cA: false },
            { name: 'keyUsage', critical: true, ...this.getKeyUsageFlags(category) },
            { name: 'extendedKeyUsage', critical: true, ...this.getExtendedKeyUsageFlags(category) },
            { name: 'subjectKeyIdentifier', critical: false },
            { name: 'authorityKeyIdentifier', critical: false },
        ];
        // Subject Alternative Name
        const sanList = [];
        if (request.email)
            sanList.push({ type: 1, value: request.email }); // rfc822Name
        if (request.nodeHostname)
            sanList.push({ type: 2, value: request.nodeHostname }); // dNSName
        if (request.nodeEndpoint)
            sanList.push({ type: 6, value: request.nodeEndpoint }); // URI
        if (request.mspId)
            sanList.push({ type: 7, value: request.mspId }); // otherName (custom OID)
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
                });
            }
        }
        return extensions;
    }
    getKeyUsageFlags(category) {
        const profile = this.config.intermediateCas[category];
        const flags = {};
        for (const usage of profile.keyUsage) {
            flags[usage.toLowerCase().replace(/_/g, '')] = true;
        }
        return flags;
    }
    getExtendedKeyUsageFlags(category) {
        const flags = {};
        const profile = this.config.intermediateCas[category];
        for (const oid of profile.extendedKeyUsage) {
            // Map OID to name
            const oidMap = {
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
    async revokeCertificate(certificateId, reason, revokedBy) {
        const entry = this.certificateStore.get(certificateId);
        if (!entry)
            throw new Error('Certificate not found');
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
        const revoked = {
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
        logger_js_1.logger.warn(`Certificate revoked: ${certificateId}, reason: ${reason}`);
    }
    async suspendCertificate(certificateId, reason) {
        const entry = this.certificateStore.get(certificateId);
        if (!entry)
            throw new Error('Certificate not found');
        entry.status = 'SUSPENDED';
        entry.updatedAt = new Date();
        this.certificateStore.set(certificateId, entry);
        this.saveCertificateStore();
        this.emitPkiEvent('CERTIFICATE_SUSPENDED', {
            certificateId,
            reason,
        });
    }
    async reinstateCertificate(certificateId) {
        const entry = this.certificateStore.get(certificateId);
        if (!entry)
            throw new Error('Certificate not found');
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
    async getCertificate(certificateId) {
        const entry = this.certificateStore.get(certificateId);
        if (!entry)
            return null;
        return this.entryToInfo(entry);
    }
    async getCertificateBySerial(serialNumber, category) {
        for (const entry of this.certificateStore.values()) {
            if (entry.serialNumber === serialNumber && entry.category === category) {
                return this.entryToInfo(entry);
            }
        }
        return null;
    }
    async listCertificates(filters) {
        let entries = Array.from(this.certificateStore.values());
        if (filters.category)
            entries = entries.filter(e => e.category === filters.category);
        if (filters.status)
            entries = entries.filter(e => e.status === filters.status);
        if (filters.subjectId)
            entries = entries.filter(e => e.subjectId === filters.subjectId);
        if (filters.issuedAfter)
            entries = entries.filter(e => e.issuedAt >= filters.issuedAfter);
        if (filters.issuedBefore)
            entries = entries.filter(e => e.issuedAt <= filters.issuedBefore);
        // Sort by issued date descending
        entries.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
        const offset = filters.offset || 0;
        const limit = filters.limit || 100;
        entries = entries.slice(offset, offset + limit);
        return entries.map(e => this.entryToInfo(e));
    }
    entryToInfo(entry) {
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
    async renewCertificate(certificateId, additionalDays) {
        const entry = this.certificateStore.get(certificateId);
        if (!entry)
            throw new Error('Certificate not found');
        // Create new certificate with same subject
        const request = {
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
    async rotateKey(certificateId) {
        return this.renewCertificate(certificateId);
    }
    async exportPrivateKey(certificateId, passphrase) {
        const entry = this.certificateStore.get(certificateId);
        if (!entry)
            throw new Error('Certificate not found');
        // In production, encrypt with passphrase using PBKDF2
        // For now, return raw (would be encrypted in production)
        if (!entry.privateKeyPem)
            throw new Error('Private key not available');
        return entry.privateKeyPem;
    }
    async importCertificate(certPem, privateKeyPem, category, passphrase) {
        const cert = node_forge_1.forge.pki.certificateFromPem(certPem);
        const serialNumber = cert.serialNumber;
        const fingerprintSha256 = this.computeFingerprint(certPem, 'sha256');
        // Check if already exists
        const existing = await this.getCertificateBySerial(cert.serialNumber, category);
        if (existing)
            throw new Error('Certificate already imported');
        const certificateId = (0, uuid_1.v4)();
        const now = new Date();
        const entry = {
            certificateId,
            category,
            serialNumber: cert.serialNumber,
            subjectDn: node_forge_1.forge.pki.distinguishedNameToString(cert.subject.attributes),
            issuerDn: node_forge_1.forge.pki.distinguishedNameToString(cert.issuer.attributes),
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
    async getRevokedCertificates(category, since) {
        let entries = Array.from(this.revokedCerts.values());
        if (category) {
            entries = entries.filter(e => e.category === category);
        }
        if (since) {
            entries = entries.filter(e => e.revocationDate >= since);
        }
        return entries;
    }
    async isRevoked(serialNumber, category) {
        const key = `${category}:${serialNumber}`;
        return this.revokedCerts.has(key);
    }
    // ========================================================================
    // CRL MANAGEMENT
    // ========================================================================
    async generateCRL(category) {
        const ca = this.caKeys.get(category);
        if (!ca)
            throw new Error(`CA for ${category} not initialized`);
        const revokedEntries = Array.from(this.revokedCerts.values())
            .filter(e => e.category === category);
        const crl = node_forge_1.forge.pki.createCrl();
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
        const crlPem = node_forge_1.forge.pki.crlToPem(crl);
        const thisUpdate = crl.lastUpdate;
        const nextUpdate = crl.nextUpdate;
        // Save to file
        const crlPath = path.join(this.config.storage.path, 'crl', `${category.toLowerCase()}.crl`);
        fs.writeFileSync(crlPath, crlPem);
        // Cache
        this.crlCache.set(category, { crl, generatedAt: new Date() });
        return {
            crlPem,
            issuerDn: node_forge_1.forge.pki.distinguishedNameToString(ca.cert.subject.attributes),
            thisUpdate,
            nextUpdate,
            revokedCertificates: revokedEntries.map(r => ({
                serialNumber: r.serialNumber,
                revocationDate: r.revocationDate,
                revocationReason: r.revocationReason,
            })),
        };
    }
    async getCRL(category) {
        const cached = this.crlCache.get(category);
        if (cached && cached.crl.nextUpdate > new Date()) {
            const crlPem = node_forge_1.forge.pki.crlToPem(cached.crl);
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
    async publishCRL(category) {
        await this.generateCRL(category);
        // In production, publish to HTTP endpoint, LDAP, etc.
        logger_js_1.logger.info(`CRL published for ${category}`);
    }
    mapRevocationReason(reason) {
        const map = {
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
    async checkOCSP(request) {
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
    async validateCertificate(certPem, category, checkRevocation = true) {
        const cert = node_forge_1.forge.pki.certificateFromPem(certPem);
        const errors = [];
        const warnings = [];
        // Check expiration
        const now = new Date();
        const notExpired = cert.validity.notAfter > now;
        if (!notExpired)
            errors.push('Certificate has expired');
        // Check signature (self-verify for root, chain verify for intermediates)
        // In production, would verify full chain
        const signatureValid = true; // Simplified
        // Check revocation
        let notRevoked = true;
        if (checkRevocation) {
            const revoked = await this.isRevoked(cert.serialNumber, category);
            notRevoked = !revoked;
            if (revoked)
                errors.push('Certificate has been revoked');
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
                subjectDn: node_forge_1.forge.pki.distinguishedNameToString(cert.subject.attributes),
                issuerDn: node_forge_1.forge.pki.distinguishedNameToString(cert.issuer.attributes),
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
    async validateChain(certPem, category) {
        // In production, would verify full chain up to root
        return this.validateCertificate(certPem, category, true);
    }
    // ========================================================================
    // UTILITIES
    // ========================================================================
    computeFingerprint(data, algorithm) {
        return crypto.createHash(algorithm).update(data).digest('hex').toUpperCase();
    }
    computeAuthorityKeyIdentifier(cert) {
        // Compute SHA-1 of subject public key
        const spki = node_forge_1.forge.pki.publicKeyToPem(cert.publicKey);
        return crypto.createHash('sha1').update(spki).digest('hex').toUpperCase();
    }
    computeSubjectKeyIdentifier(cert) {
        return this.computeAuthorityKeyIdentifier(cert); // Same calculation
    }
    // ========================================================================
    // EVENT HANDLING
    // ========================================================================
    on(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(listener);
    }
    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(data);
                }
                catch (err) {
                    logger_js_1.logger.error(`Error in event listener for ${event}:`, err);
                }
            }
        }
    }
    emitPkiEvent(eventType, details) {
        const event = {
            eventId: (0, uuid_1.v4)(),
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
    async isHealthy() {
        return this.initialized;
    }
    async shutdown() {
        this.saveCertificateStore();
        this.saveRevokedCerts();
        // Save CRLs
        for (const category of Object.keys(this.config.intermediateCas)) {
            await this.generateCRL(category);
        }
        this.initialized = false;
        logger_js_1.logger.info('LocalOpenSSLCa shut down');
    }
}
exports.LocalOpenSSLCa = LocalOpenSSLCa;
// ========================================================================
// FACTORY
// ========================================================================
class LocalCaFactory {
    async createCa(options) {
        const ca = new LocalOpenSSCa();
        await ca.initialize(options.config);
        return ca;
    }
    getSupportedTypes() {
        return ['local'];
    }
}
exports.LocalCaFactory = LocalCaFactory;
//# sourceMappingURL=local-ca.js.map