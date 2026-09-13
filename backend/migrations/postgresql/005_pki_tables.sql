-- ADALAT360 Database Schema - PKI Tables Migration
-- PostgreSQL 15+ compatible
-- Run order: 005_pki_tables.sql (after 004_asset_lifecycle_tables.sql)

-- ============================================================================
-- PKI ENUMS
-- ============================================================================

CREATE TYPE certificate_category AS ENUM (
    'USER_IDENTITY',
    'BLOCKCHAIN_NODE',
    'ASSET_CUSTODY_ACTOR'
);

CREATE TYPE certificate_status AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'REVOKED',
    'SUSPENDED'
);

CREATE TYPE revocation_reason AS ENUM (
    'KEY_COMPROMISE',
    'CA_COMPROMISE',
    'AFFILIATION_CHANGED',
    'SUPERSEDED',
    'CESSATION_OF_OPERATION',
    'PRIVILEGE_WITHDRAWN',
    'AA_COMPROMISE'
);

CREATE TYPE pki_event_type AS ENUM (
    'CERTIFICATE_ISSUED',
    'CERTIFICATE_RENEWED',
    'CERTIFICATE_REVOKED',
    'CERTIFICATE_EXPIRED',
    'CERTIFICATE_SUSPENDED',
    'CERTIFICATE_REINSTATED',
    'CRL_PUBLISHED',
    'OCSP_RESPONSE_GENERATED',
    'KEY_ROTATION_INITIATED',
    'KEY_ROTATION_COMPLETED',
    'CA_KEY_COMPROMISE',
    'PRIVATE_KEY_COMPROMISE'
);

-- ============================================================================
-- CERTIFICATES TABLE
-- ============================================================================

CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id VARCHAR(100) UNIQUE NOT NULL, -- Human-readable ID
    serial_number VARCHAR(100) NOT NULL,
    subject_dn VARCHAR(500) NOT NULL,
    issuer_dn VARCHAR(500) NOT NULL,
    category certificate_category NOT NULL,
    subject_id UUID NOT NULL, -- User ID, Node ID, or Actor ID
    subject_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department VARCHAR(100),
    organization VARCHAR(200),
    status certificate_status NOT NULL DEFAULT 'ACTIVE',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revocation_reason revocation_reason,
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    certificate_pem TEXT NOT NULL,
    private_key_pem TEXT, -- Encrypted in production
    private_key_encrypted BOOLEAN DEFAULT FALSE,
    fingerprint_sha256 VARCHAR(64) NOT NULL,
    fingerprint_sha1 VARCHAR(40) NOT NULL,
    authority_key_identifier VARCHAR(64),
    subject_key_identifier VARCHAR(64),
    ocsp_url VARCHAR(500),
    crl_url VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_certificates_serial ON certificates(serial_number);
CREATE INDEX idx_certificates_category ON certificates(category);
CREATE INDEX idx_certificates_subject ON certificates(subject_id);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE INDEX idx_certificates_expires ON certificates(expires_at);
CREATE INDEX idx_certificates_subject_id ON certificates(subject_id);
CREATE INDEX idx_certificates_category_status ON certificates(category, status);

-- ============================================================================
-- REVOKED CERTIFICATES TABLE
-- ============================================================================

CREATE TABLE revoked_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) NOT NULL,
    category certificate_category NOT NULL,
    subject_id UUID NOT NULL,
    revocation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revocation_reason revocation_reason NOT NULL,
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revoked_serial ON revoked_certificates(serial_number, category);
CREATE INDEX idx_revoked_cert ON revoked_certificates(certificate_id);
CREATE INDEX idx_revoked_subject ON revoked_certificates(subject_id);
CREATE INDEX idx_revoked_date ON revoked_certificates(revocation_date DESC);

-- ============================================================================
-- CRL TABLE
-- ============================================================================

CREATE TABLE crls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category certificate_category NOT NULL UNIQUE,
    crl_pem TEXT NOT NULL,
    issuer_dn VARCHAR(500) NOT NULL,
    this_update TIMESTAMPTZ NOT NULL,
    next_update TIMESTAMPTZ NOT NULL,
    revoked_count INTEGER DEFAULT 0,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- OCSP REQUESTS LOG
-- ============================================================================

CREATE TABLE ocsp_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number VARCHAR(100) NOT NULL,
    issuer_dn VARCHAR(500) NOT NULL,
    response_status VARCHAR(20) NOT NULL,
    response_time_ms INTEGER,
    client_ip INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ocsp_serial ON ocsp_requests(serial_number);
CREATE INDEX idx_ocsp_created ON ocsp_requests(created_at DESC);

-- ============================================================================
-- PKI EVENTS LOG
-- ============================================================================

CREATE TABLE pki_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    event_type pki_event_type NOT NULL,
    certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL,
    serial_number VARCHAR(100),
    category certificate_category,
    subject_id UUID,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL'))
);

CREATE INDEX idx_pki_events_type ON pki_events(event_type);
CREATE INDEX idx_pki_events_cert ON pki_events(certificate_id);
CREATE INDEX idx_pki_events_subject ON pki_events(subject_id);
CREATE INDEX idx_pki_events_timestamp ON pki_events(timestamp DESC);
CREATE INDEX idx_pki_events_actor ON pki_events(actor_user_id);

-- ============================================================================
-- CERTIFICATE REQUESTS LOG
-- ============================================================================

CREATE TABLE certificate_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    category certificate_category NOT NULL,
    subject_id UUID NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department VARCHAR(100),
    organization VARCHAR(200),
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FAILED')),
    certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL,
    csr_pem TEXT,
    rejection_reason TEXT,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cert_reqs_subject ON certificate_requests(subject_id);
CREATE INDEX idx_cert_reqs_status ON certificate_requests(status);
CREATE INDEX idx_cert_reqs_created ON certificate_requests(created_at DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_certificate_requests_updated_at BEFORE UPDATE ON certificate_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE revoked_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocsp_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pki_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_requests ENABLE ROW LEVEL SECURITY;

-- Certificates Policies
CREATE POLICY certificates_select_policy ON certificates
    FOR SELECT USING (
        subject_id = current_user_id()
        OR is_admin_or_auditor()
    );

CREATE POLICY certificates_insert_policy ON certificates
    FOR INSERT WITH CHECK (is_admin_or_auditor());

CREATE POLICY certificates_update_policy ON certificates
    FOR UPDATE USING (is_admin_or_auditor()) WITH CHECK (is_admin_or_auditor());

-- Revoked Certificates Policies
CREATE POLICY revoked_certificates_select_policy ON revoked_certificates
    FOR SELECT USING (is_admin_or_auditor());

CREATE POLICY revoked_certificates_insert_policy ON revoked_certificates
    FOR INSERT WITH CHECK (is_admin_or_auditor());

-- CRLs Policies
CREATE POLICY crls_select_policy ON crls
    FOR SELECT USING (is_admin_or_auditor());

CREATE POLICY crls_update_policy ON crls
    FOR UPDATE USING (is_admin_or_auditor()) WITH CHECK (is_admin_or_auditor());

-- OCSP Requests Policies
CREATE POLICY ocsp_requests_select_policy ON ocsp_requests
    FOR SELECT USING (is_admin_or_auditor());

CREATE POLICY ocsp_requests_insert_policy ON ocsp_requests
    FOR INSERT WITH CHECK (is_admin_or_auditor());

-- PKI Events Policies
CREATE POLICY pki_events_select_policy ON pki_events
    FOR SELECT USING (is_admin_or_auditor());

CREATE POLICY pki_events_insert_policy ON pki_events
    FOR INSERT WITH CHECK (is_admin_or_auditor());

-- Certificate Requests Policies
CREATE POLICY cert_requests_select_policy ON certificate_requests
    FOR SELECT USING (
        subject_id = current_user_id()
        OR is_admin_or_auditor()
    );

CREATE POLICY cert_requests_insert_policy ON certificate_requests
    FOR INSERT WITH CHECK (
        subject_id = current_user_id()
        OR is_admin_or_auditor()
    );

CREATE POLICY cert_requests_update_policy ON certificate_requests
    FOR UPDATE USING (is_admin_or_auditor()) WITH CHECK (is_admin_or_auditor());