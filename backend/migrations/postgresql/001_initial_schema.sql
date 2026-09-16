-- ADALAT360 Database Schema - Initial Migration
-- PostgreSQL 15+ compatible
-- Run order: 001_initial_schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM (
    'INVESTIGATING_OFFICER',
    'FORENSIC_LAB',
    'PROSECUTOR',
    'COURT',
    'CENTRAL_ADMIN',
    'AUDITOR'
);

CREATE TYPE user_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'PENDING_VERIFICATION'
);

CREATE TYPE case_status AS ENUM (
    'OPEN',
    'UNDER_INVESTIGATION',
    'CHARGE_SHEET_FILED',
    'TRIAL_IN_PROGRESS',
    'JUDGMENT_RESERVED',
    'DISPOSED',
    'APPEALED',
    'CLOSED'
);

CREATE TYPE case_priority AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE document_type AS ENUM (
    'FIR',
    'INVESTIGATION_RECORD',
    'WITNESS_STATEMENT',
    'CHARGE_SHEET',
    'COURT_FILING',
    'EVIDENCE_RECORD',
    'FORENSIC_REPORT',
    'LEGAL_NOTICE',
    'JUDGMENT',
    'ORDER',
    'SUMMONS',
    'WARRANT',
    'BAIL_APPLICATION',
    'AFFIDAVIT',
    'EXHIBIT_LIST',
    'SEIZURE_MEMO',
    'PANCHNAMA',
    'CASE_DIARY',
    'OTHER'
);

CREATE TYPE document_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'VERIFIED',
    'APPROVED',
    'REJECTED',
    'ARCHIVED',
    'REDACTED'
);

CREATE TYPE evidence_type AS ENUM (
    'DIGITAL',
    'PHYSICAL',
    'DOCUMENTARY',
    'BIOLOGICAL',
    'CHEMICAL',
    'FIREARM',
    'VEHICLE',
    'ELECTRONIC_DEVICE',
    'FINANCIAL_RECORD',
    'OTHER'
);

CREATE TYPE evidence_status AS ENUM (
    'SEIZED',
    'IN_CUSTODY',
    'SENT_FOR_ANALYSIS',
    'UNDER_ANALYSIS',
    'ANALYSIS_COMPLETE',
    'PRESENTED_IN_COURT',
    'RETURNED',
    'DISPOSED',
    'DESTROYED'
);

CREATE TYPE custody_action AS ENUM (
    'UPLOAD',
    'ACCESS',
    'TRANSFER',
    'REDACTION',
    'EXPORT',
    'VERSION_CREATE',
    'METADATA_UPDATE',
    'VERIFICATION',
    'SIGNATURE_APPLY',
    'SEIZURE',
    'HANDOVER',
    'RECEIVE',
    'ANALYSIS_START',
    'ANALYSIS_COMPLETE',
    'COURT_SUBMISSION',
    'COURT_RETURN',
    'DISPOSAL'
);

CREATE TYPE consensus_status AS ENUM (
    'PENDING',
    'ENDORSED',
    'COMMITTED',
    'REJECTED',
    'FAILED'
);

CREATE TYPE node_type AS ENUM (
    'OFFICER_NODE',
    'FORENSIC_LAB_NODE',
    'COURT_NODE',
    'CENTRAL_AUDIT_NODE'
);

CREATE TYPE signature_type AS ENUM (
    'DSC',
    'AADHAAR_ESIGN',
    'DIGITAL_SIGNATURE',
    'BIOMETRIC'
);

CREATE TYPE permission_level AS ENUM (
    'READ',
    'WRITE',
    'DELETE',
    'ADMIN',
    'SIGN',
    'VERIFY',
    'EXPORT',
    'REDACT'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT FALSE,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100),
    badge_number VARCHAR(50),
    status user_status DEFAULT 'PENDING_VERIFICATION',
    x509_cert_pem TEXT,
    x509_cert_serial VARCHAR(100),
    x509_cert_issued_at TIMESTAMPTZ,
    x509_cert_expires_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ DEFAULT NOW(),
    mfa_backup_codes TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_x509_serial ON users(x509_cert_serial);

-- Cases table
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number VARCHAR(100) UNIQUE NOT NULL,
    fir_number VARCHAR(100) UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status case_status DEFAULT 'OPEN',
    priority case_priority DEFAULT 'MEDIUM',
    police_station VARCHAR(200),
    district VARCHAR(100),
    state VARCHAR(100),
    jurisdiction_court VARCHAR(200),
    ipc_sections TEXT[],
    bns_sections TEXT[],
    special_acts TEXT[],
    assigned_officer_id UUID REFERENCES users(id),
    supervising_officer_id UUID REFERENCES users(id),
    prosecutor_id UUID REFERENCES users(id),
    forensic_lab_id UUID REFERENCES users(id),
    court_id UUID REFERENCES users(id),
    incident_date TIMESTAMPTZ,
    fir_registered_at TIMESTAMPTZ,
    charge_sheet_filed_at TIMESTAMPTZ,
    trial_started_at TIMESTAMPTZ,
    judgment_date TIMESTAMPTZ,
    disposal_date TIMESTAMPTZ,
    is_sensitive BOOLEAN DEFAULT FALSE,
    sensitivity_level INT DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_cases_case_number ON cases(case_number);
CREATE INDEX idx_cases_fir_number ON cases(fir_number);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_assigned_officer ON cases(assigned_officer_id);
CREATE INDEX idx_cases_prosecutor ON cases(prosecutor_id);
CREATE INDEX idx_cases_forensic_lab ON cases(forensic_lab_id);
CREATE INDEX idx_cases_court ON cases(court_id);
CREATE INDEX idx_cases_incident_date ON cases(incident_date);

-- Case assignments (many-to-many for cross-department collaboration)
CREATE TABLE case_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_case VARCHAR(100) NOT NULL,
    permission_level permission_level[] DEFAULT ARRAY['READ']::permission_level[],
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(case_id, user_id, role_in_case)
);

CREATE INDEX idx_case_assignments_case ON case_assignments(case_id);
CREATE INDEX idx_case_assignments_user ON case_assignments(user_id);
CREATE INDEX idx_case_assignments_active ON case_assignments(is_active) WHERE is_active = TRUE;

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
    document_number VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    document_type document_type NOT NULL,
    status document_status DEFAULT 'DRAFT',
    version INT DEFAULT 1,
    is_latest_version BOOLEAN DEFAULT TRUE,
    parent_document_id UUID REFERENCES documents(id),
    original_filename VARCHAR(500) NOT NULL,
    stored_filename VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_hash_sha256 VARCHAR(64) NOT NULL,
    file_hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
    storage_path VARCHAR(1000) NOT NULL,
    storage_bucket VARCHAR(100) NOT NULL,
    encryption_key_id VARCHAR(255),
    encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    ocr_text TEXT,
    ocr_language VARCHAR(10) DEFAULT 'eng',
    ocr_confidence DECIMAL(5,2),
    ocr_processed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    extracted_entities JSONB DEFAULT '{}',
    tags TEXT[],
    uploaded_by UUID NOT NULL REFERENCES users(id),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_documents_case ON documents(case_id);
CREATE INDEX idx_documents_document_number ON documents(document_number);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_parent ON documents(parent_document_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_is_latest ON documents(is_latest_version) WHERE is_latest_version = TRUE;
CREATE INDEX idx_documents_file_hash ON documents(file_hash_sha256);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- Document versions (immutable history)
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version INT NOT NULL,
    file_hash_sha256 VARCHAR(64) NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    changes_summary TEXT,
    ocr_text TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, version)
);

CREATE INDEX idx_document_versions_document ON document_versions(document_id);
CREATE INDEX idx_document_versions_version ON document_versions(version);

-- Evidence table (physical + digital exhibits)
CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
    evidence_number VARCHAR(100) UNIQUE NOT NULL,
    qr_code_hash VARCHAR(64) UNIQUE NOT NULL,
    qr_code_image_path VARCHAR(1000),
    name VARCHAR(500) NOT NULL,
    description TEXT,
    evidence_type evidence_type NOT NULL,
    status evidence_status DEFAULT 'SEIZED',
    category VARCHAR(100),
    sub_category VARCHAR(100),
    seized_at TIMESTAMPTZ NOT NULL,
    seized_by UUID NOT NULL REFERENCES users(id),
    seized_location JSONB,
    seized_from VARCHAR(500),
    panchnama_reference VARCHAR(200),
    seizure_memo_number VARCHAR(100),
    current_custodian_id UUID REFERENCES users(id),
    current_location VARCHAR(500),
    storage_condition VARCHAR(200),
    container_seal_number VARCHAR(100),
    weight_grams DECIMAL(10,2),
    dimensions_cm JSONB,
    photographs TEXT[],
    forensic_lab_id UUID REFERENCES users(id),
    sent_for_analysis_at TIMESTAMPTZ,
    analysis_completed_at TIMESTAMPTZ,
    analysis_report_document_id UUID REFERENCES documents(id),
    presented_in_court_at TIMESTAMPTZ,
    court_exhibit_number VARCHAR(100),
    returned_to VARCHAR(500),
    returned_at TIMESTAMPTZ,
    disposal_method VARCHAR(200),
    disposed_at TIMESTAMPTZ,
    disposed_by UUID REFERENCES users(id),
    disposal_witness UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_evidence_case ON evidence(case_id);
CREATE INDEX idx_evidence_number ON evidence(evidence_number);
CREATE INDEX idx_evidence_qr_hash ON evidence(qr_code_hash);
CREATE INDEX idx_evidence_type ON evidence(evidence_type);
CREATE INDEX idx_evidence_status ON evidence(status);
CREATE INDEX idx_evidence_custodian ON evidence(current_custodian_id);
CREATE INDEX idx_evidence_forensic_lab ON evidence(forensic_lab_id);
CREATE INDEX idx_evidence_seized_at ON evidence(seized_at);

-- Evidence custody chain (physical tracking)
CREATE TABLE evidence_custody_chain (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    from_user_id UUID REFERENCES users(id),
    to_user_id UUID REFERENCES users(id),
    from_location VARCHAR(500),
    to_location VARCHAR(500),
    action custody_action NOT NULL,
    seal_number VARCHAR(100),
    seal_intact BOOLEAN,
    condition_notes TEXT,
    witness_user_id UUID REFERENCES users(id),
    witness_signature_id UUID,
    handover_document_id UUID REFERENCES documents(id),
    custody_document_id UUID REFERENCES documents(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    recorded_by UUID NOT NULL REFERENCES users(id),
    blockchain_tx_id VARCHAR(255),
    blockchain_block_hash VARCHAR(64),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_evidence_custody_evidence ON evidence_custody_chain(evidence_id);
CREATE INDEX idx_evidence_custody_occurred_at ON evidence_custody_chain(occurred_at);
CREATE INDEX idx_evidence_custody_from_user ON evidence_custody_chain(from_user_id);
CREATE INDEX idx_evidence_custody_to_user ON evidence_custody_chain(to_user_id);

-- ============================================================================
-- BLOCKCHAIN CUSTODY LEDGER
-- ============================================================================

-- Blockchain nodes (organizations in Fabric network)
CREATE TABLE blockchain_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id VARCHAR(100) UNIQUE NOT NULL,
    node_type node_type NOT NULL,
    organization_name VARCHAR(200) NOT NULL,
    organization_msp_id VARCHAR(100) NOT NULL,
    peer_endpoint VARCHAR(500) NOT NULL,
    ca_endpoint VARCHAR(500),
    tls_cert_pem TEXT NOT NULL,
    admin_cert_pem TEXT,
    admin_key_pem TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_orderer BOOLEAN DEFAULT FALSE,
    orderer_endpoint VARCHAR(500),
    channel_name VARCHAR(100) DEFAULT 'adalat360-channel',
    chaincode_name VARCHAR(100) DEFAULT 'custody-ledger',
    chaincode_version VARCHAR(50) DEFAULT '1.0.0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blockchain_nodes_type ON blockchain_nodes(node_type);
CREATE INDEX idx_blockchain_nodes_active ON blockchain_nodes(is_active) WHERE is_active = TRUE;

-- Custody ledger entries (mirrors Fabric ledger for query performance)
CREATE TABLE custody_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_id VARCHAR(255) UNIQUE NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash VARCHAR(64) NOT NULL,
    prev_block_hash VARCHAR(64) NOT NULL,
    tx_timestamp TIMESTAMPTZ NOT NULL,
    tx_type custody_action NOT NULL,
    case_id UUID REFERENCES cases(id),
    document_id UUID REFERENCES documents(id),
    evidence_id UUID REFERENCES evidence(id),
    actor_user_id UUID NOT NULL REFERENCES users(id),
    actor_node_id VARCHAR(100) NOT NULL REFERENCES blockchain_nodes(node_id),
    action_details JSONB NOT NULL DEFAULT '{}',
    before_state_hash VARCHAR(64),
    after_state_hash VARCHAR(64),
    consensus_status consensus_status DEFAULT 'PENDING',
    endorsing_nodes VARCHAR(100)[] DEFAULT '{}',
    required_endorsements INT DEFAULT 2,
    received_endorsements INT DEFAULT 0,
    endorsement_policy VARCHAR(500),
    digital_signature_id UUID,
    payload_hash VARCHAR(64) NOT NULL,
    is_valid BOOLEAN DEFAULT TRUE,
    validation_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custody_ledger_tx_id ON custody_ledger(tx_id);
CREATE INDEX idx_custody_ledger_block ON custody_ledger(block_number);
CREATE INDEX idx_custody_ledger_case ON custody_ledger(case_id);
CREATE INDEX idx_custody_ledger_document ON custody_ledger(document_id);
CREATE INDEX idx_custody_ledger_evidence ON custody_ledger(evidence_id);
CREATE INDEX idx_custody_ledger_actor ON custody_ledger(actor_user_id);
CREATE INDEX idx_custody_ledger_actor_node ON custody_ledger(actor_node_id);
CREATE INDEX idx_custody_ledger_tx_type ON custody_ledger(tx_type);
CREATE INDEX idx_custody_ledger_consensus ON custody_ledger(consensus_status);
CREATE INDEX idx_custody_ledger_tx_timestamp ON custody_ledger(tx_timestamp);
CREATE INDEX idx_custody_ledger_payload_hash ON custody_ledger(payload_hash);

-- Blockchain blocks (for verification)
CREATE TABLE blockchain_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_number BIGINT UNIQUE NOT NULL,
    block_hash VARCHAR(64) UNIQUE NOT NULL,
    prev_block_hash VARCHAR(64) NOT NULL,
    tx_count INT NOT NULL,
    tx_ids VARCHAR(255)[] NOT NULL,
    merkle_root VARCHAR(64) NOT NULL,
    proposer_node_id VARCHAR(100) NOT NULL REFERENCES blockchain_nodes(node_id),
    committed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blockchain_blocks_number ON blockchain_blocks(block_number);
CREATE INDEX idx_blockchain_blocks_hash ON blockchain_blocks(block_hash);
CREATE INDEX idx_blockchain_blocks_committed ON blockchain_blocks(committed_at);

-- ============================================================================
-- DIGITAL SIGNATURES
-- ============================================================================

CREATE TABLE digital_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signature_id VARCHAR(100) UNIQUE NOT NULL,
    signer_user_id UUID NOT NULL REFERENCES users(id),
    signer_node_id VARCHAR(100) NOT NULL REFERENCES blockchain_nodes(node_id),
    signature_type signature_type NOT NULL,
    certificate_pem TEXT NOT NULL,
    certificate_serial VARCHAR(100) NOT NULL,
    certificate_issuer VARCHAR(200) NOT NULL,
    certificate_valid_from TIMESTAMPTZ NOT NULL,
    certificate_valid_to TIMESTAMPTZ NOT NULL,
    signed_data_hash VARCHAR(64) NOT NULL,
    signed_data_type VARCHAR(50) NOT NULL,
    signed_data_id UUID NOT NULL,
    signature_algorithm VARCHAR(50) DEFAULT 'RSA-SHA256',
    signature_value BYTEA NOT NULL,
    signature_timestamp TIMESTAMPTZ NOT NULL,
    ts_token BYTEA,
    ocsp_response BYTEA,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    revocation_reason VARCHAR(200),
    revoked_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_digital_signatures_signer ON digital_signatures(signer_user_id);
CREATE INDEX idx_digital_signatures_data ON digital_signatures(signed_data_type, signed_data_id);
CREATE INDEX idx_digital_signatures_cert_serial ON digital_signatures(certificate_serial);
CREATE INDEX idx_digital_signatures_timestamp ON digital_signatures(signature_timestamp);
CREATE INDEX idx_digital_signatures_verified ON digital_signatures(is_verified);

-- ============================================================================
-- ACCESS PERMISSIONS
-- ============================================================================

CREATE TABLE access_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES users(id),
    permission_level permission_level[] NOT NULL,
    conditions JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_access_permissions_resource ON access_permissions(resource_type, resource_id);
CREATE INDEX idx_access_permissions_user ON access_permissions(user_id);
CREATE INDEX idx_access_permissions_active ON access_permissions(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(100) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'INFO',
    user_id UUID REFERENCES users(id),
    user_role user_role,
    user_ip INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    resource_type VARCHAR(50),
    resource_id UUID,
    action VARCHAR(100) NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    error_message TEXT,
    request_id VARCHAR(100),
    correlation_id VARCHAR(100),
    before_state JSONB,
    after_state JSONB,
    metadata JSONB DEFAULT '{}',
    blockchain_tx_id VARCHAR(255),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_event_id ON audit_logs(event_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_outcome ON audit_logs(outcome);
CREATE INDEX idx_audit_logs_occurred_at ON audit_logs(occurred_at);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_correlation ON audit_logs(correlation_id);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);

-- ============================================================================
-- BSA CERTIFICATES
-- ============================================================================

CREATE TABLE bsa_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_number VARCHAR(100) UNIQUE NOT NULL,
    case_id UUID NOT NULL REFERENCES cases(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    section VARCHAR(20) DEFAULT '63',
    subsection VARCHAR(20),
    certificate_type VARCHAR(50) DEFAULT 'ELECTRONIC_RECORD',
    issued_by UUID NOT NULL REFERENCES users(id),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'DRAFT',
    hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
    file_hash VARCHAR(64) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    metadata_hash VARCHAR(64),
    custody_ledger_tx_ids VARCHAR(255)[],
    chain_of_custody_hash VARCHAR(64),
    certificate_content JSONB NOT NULL,
    digital_signature_id UUID REFERENCES digital_signatures(id),
    qr_code_hash VARCHAR(64),
    qr_code_image_path VARCHAR(1000),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    revocation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bsa_certificates_case ON bsa_certificates(case_id);
CREATE INDEX idx_bsa_certificates_document ON bsa_certificates(document_id);
CREATE INDEX idx_bsa_certificates_number ON bsa_certificates(certificate_number);
CREATE INDEX idx_bsa_certificates_status ON bsa_certificates(status);
CREATE INDEX idx_bsa_certificates_issued_by ON bsa_certificates(issued_by);

-- ============================================================================
-- SEARCH INDEX (for vector search - metadata only, vectors in separate system)
-- ============================================================================

CREATE TABLE search_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    case_id UUID NOT NULL REFERENCES cases(id),
    title VARCHAR(500),
    content_text TEXT,
    content_vector_id VARCHAR(255),
    document_type document_type,
    evidence_type evidence_type,
    tags TEXT[],
    entities JSONB DEFAULT '{}',
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_index_case ON search_index(case_id);
CREATE INDEX idx_search_index_resource ON search_index(resource_type, resource_id);
CREATE INDEX idx_search_index_type ON search_index(document_type);
CREATE INDEX idx_search_index_tags ON search_index USING GIN(tags);
CREATE INDEX idx_search_index_entities ON search_index USING GIN(entities);

-- ============================================================================
-- RTI REQUESTS
-- ============================================================================

CREATE TABLE rti_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_number VARCHAR(100) UNIQUE NOT NULL,
    applicant_name VARCHAR(255) NOT NULL,
    applicant_address TEXT,
    applicant_email CITEXT,
    applicant_phone VARCHAR(20),
    subject TEXT NOT NULL,
    description TEXT,
    information_sought TEXT NOT NULL,
    case_ids UUID[],
    document_ids UUID[],
    evidence_ids UUID[],
    status VARCHAR(50) DEFAULT 'RECEIVED',
    fee_paid DECIMAL(10,2) DEFAULT 0,
    fee_receipt_number VARCHAR(100),
    assigned_to UUID REFERENCES users(id),
    responded_by UUID REFERENCES users(id),
    response_text TEXT,
    response_documents UUID[],
    denied_reasons TEXT[],
    exemption_sections TEXT[],
    first_appeal_filed BOOLEAN DEFAULT FALSE,
    first_appeal_date TIMESTAMPTZ,
    second_appeal_filed BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rti_requests_number ON rti_requests(request_number);
CREATE INDEX idx_rti_requests_status ON rti_requests(status);
CREATE INDEX idx_rti_requests_assigned ON rti_requests(assigned_to);
CREATE INDEX idx_rti_requests_due_date ON rti_requests(due_date);

-- ============================================================================
-- SYSTEM CONFIGURATION
-- ============================================================================

CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_case_assignments_updated_at BEFORE UPDATE ON case_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_evidence_updated_at BEFORE UPDATE ON evidence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_access_permissions_updated_at BEFORE UPDATE ON access_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bsa_certificates_updated_at BEFORE UPDATE ON bsa_certificates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_search_index_updated_at BEFORE UPDATE ON search_index FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rti_requests_updated_at BEFORE UPDATE ON rti_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_blockchain_nodes_updated_at BEFORE UPDATE ON blockchain_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_custody_chain ENABLE ROW LEVEL SECURITY;
ALTER TABLE custody_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bsa_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE rti_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies will be created in migration 002_rls_policies.sql
-- to keep this migration focused on schema only