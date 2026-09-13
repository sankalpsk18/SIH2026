-- ADALAT360 Database Schema - Asset Lifecycle Tables Migration
-- PostgreSQL 15+ compatible
-- Run order: 004_asset_lifecycle_tables.sql (after 003_collaboration_tables.sql)

-- ============================================================================
-- ASSET LIFECYCLE ENUMS
-- ============================================================================

CREATE TYPE asset_state AS ENUM (
    'SEIZED',
    'STORED',
    'TRANSFERRED',
    'DISPOSED',
    'REPORTED_LOST',
    'REPORTED_DAMAGED'
);

CREATE TYPE asset_category AS ENUM (
    'DOCUMENTARY',
    'BIOLOGICAL',
    'CHEMICAL',
    'FIREARM',
    'VEHICLE',
    'ELECTRONIC_DEVICE',
    'FINANCIAL_RECORD',
    'DRUGS_NARCOTICS',
    'CURRENCY',
    'JEWELRY_VALUABLES',
    'DIGITAL_STORAGE',
    'CLOTHING_PERSONAL',
    'WEAPON_NON_FIREARM',
    'TOOL_EQUIPMENT',
    'OTHER'
);

CREATE TYPE asset_transition AS ENUM (
    'SEIZED_TO_STORED',
    'STORED_TO_TRANSFERRED',
    'STORED_TO_DISPOSED',
    'STORED_TO_REPORTED_LOST',
    'STORED_TO_REPORTED_DAMAGED',
    'TRANSFERRED_TO_STORED',
    'TRANSFERRED_TO_DISPOSED',
    'TRANSFERRED_TO_REPORTED_LOST',
    'TRANSFERRED_TO_REPORTED_DAMAGED',
    'REPORTED_LOST_TO_STORED',
    'REPORTED_DAMAGED_TO_STORED',
    'REPORTED_LOST_TO_DISPOSED',
    'REPORTED_DAMAGED_TO_DISPOSED'
);

CREATE TYPE disposal_approval_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'EXPIRED'
);

-- ============================================================================
-- ASSETS TABLE
-- ============================================================================

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id VARCHAR(100) UNIQUE NOT NULL, -- Human-readable: AST/CASE/YYYY/NNNNN
    qr_code_hash VARCHAR(64) NOT NULL,
    qr_code_image_url TEXT,
    qr_code_payload TEXT NOT NULL,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
    case_number VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    category asset_category NOT NULL,
    sub_category VARCHAR(100),
    current_state asset_state NOT NULL DEFAULT 'SEIZED',
    previous_state asset_state,
    -- Seizure info
    seized_at TIMESTAMPTZ NOT NULL,
    seized_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seized_by_name VARCHAR(255) NOT NULL,
    seized_by_role VARCHAR(50) NOT NULL,
    seized_location JSONB NOT NULL,
    seized_from VARCHAR(500),
    panchnama_reference VARCHAR(200),
    seizure_memo_number VARCHAR(100),
    -- Physical properties
    weight_grams DECIMAL(10,2),
    dimensions_cm JSONB,
    photographs TEXT[],
    distinguishing_features TEXT,
    serial_number VARCHAR(100),
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    -- Current custody
    current_holder_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    current_holder_name VARCHAR(255),
    current_holder_role VARCHAR(50),
    current_holder_department VARCHAR(100),
    current_location JSONB,
    container_seal_number VARCHAR(100),
    seal_intact BOOLEAN DEFAULT TRUE,
    storage_condition VARCHAR(200),
    -- Forensic
    forensic_lab_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sent_for_analysis_at TIMESTAMPTZ,
    analysis_completed_at TIMESTAMPTZ,
    analysis_report_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    -- Court
    court_exhibit_number VARCHAR(100),
    presented_in_court_at TIMESTAMPTZ,
    -- Disposal
    disposal_method VARCHAR(200),
    disposed_at TIMESTAMPTZ,
    disposed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    disposal_witness_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    disposal_authorization TEXT,
    disposal_initiated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    disposal_initiated_at TIMESTAMPTZ,
    disposal_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    disposal_approved_at TIMESTAMPTZ,
    -- Blockchain
    custody_ledger_tx_ids VARCHAR(255)[] DEFAULT '{}',
    -- State history (JSONB for flexibility)
    state_history JSONB DEFAULT '[]',
    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_assets_case ON assets(case_id);
CREATE INDEX idx_assets_asset_id ON assets(asset_id);
CREATE INDEX idx_assets_state ON assets(current_state);
CREATE INDEX idx_assets_category ON assets(category);
CREATE INDEX idx_assets_holder ON assets(current_holder_user_id);
CREATE INDEX idx_assets_seized ON assets(seized_at DESC);
CREATE INDEX idx_assets_seized_by ON assets(seized_by_user_id);
CREATE INDEX idx_assets_qr_hash ON assets(qr_code_hash);

-- ============================================================================
-- ASSET STATE HISTORY TABLE
-- ============================================================================

CREATE TABLE asset_state_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    from_state asset_state,
    to_state asset_state NOT NULL,
    transition VARCHAR(50) NOT NULL,
    actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    actor_department VARCHAR(100) NOT NULL,
    location JSONB,
    seal_number VARCHAR(100),
    seal_intact BOOLEAN,
    condition_notes TEXT,
    witness_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    witness_name VARCHAR(255),
    custody_ledger_tx_id VARCHAR(255),
    custody_ledger_block_number BIGINT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asset_state_history_asset ON asset_state_history(asset_id);
CREATE INDEX idx_asset_state_history_timestamp ON asset_state_history(timestamp DESC);
CREATE INDEX idx_asset_state_history_actor ON asset_state_history(actor_user_id);
CREATE INDEX idx_asset_state_history_transition ON asset_state_history(transition);

-- ============================================================================
-- DISPOSAL APPROVALS TABLE (Maker-Checker)
-- ============================================================================

CREATE TABLE disposal_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    initiated_by_name VARCHAR(255) NOT NULL,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by_name VARCHAR(255),
    approved_at TIMESTAMPTZ,
    status disposal_approval_status NOT NULL DEFAULT 'PENDING',
    disposal_method VARCHAR(200) NOT NULL,
    disposal_authorization TEXT NOT NULL,
    rejection_reason TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disposal_approvals_asset ON disposal_approvals(asset_id);
CREATE INDEX idx_disposal_approvals_status ON disposal_approvals(status);
CREATE INDEX idx_disposal_approvals_approver ON disposal_approvals(approved_by);
CREATE INDEX idx_disposal_approvals_initiator ON disposal_approvals(initiated_by);
CREATE INDEX idx_disposal_approvals_expires ON disposal_approvals(expires_at) WHERE status = 'PENDING';

-- ============================================================================
-- ASSET STATE HISTORY TABLE (for MongoDB mirror - created in MongoDB migration)
-- ============================================================================

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_disposal_approvals_updated_at BEFORE UPDATE ON disposal_approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_state_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_approvals ENABLE ROW LEVEL SECURITY;

-- Assets Policies
CREATE POLICY assets_select_policy ON assets
    FOR SELECT USING (
        case_id IN (
            SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
        )
        OR is_admin_or_auditor()
    );

CREATE POLICY assets_insert_policy ON assets
    FOR INSERT WITH CHECK (
        seized_by_user_id = current_user_id()
        AND case_id IN (
            SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
        )
    );

CREATE POLICY assets_update_policy ON assets
    FOR UPDATE USING (
        current_holder_user_id = current_user_id()
        OR case_id IN (
            SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
        )
        OR is_admin_or_auditor()
    ) WITH CHECK (
        current_holder_user_id = current_user_id()
        OR case_id IN (
            SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
        )
        OR is_admin_or_auditor()
    );

-- Asset State History Policies
CREATE POLICY asset_state_history_select_policy ON asset_state_history
    FOR SELECT USING (
        asset_id IN (
            SELECT id FROM assets WHERE case_id IN (
                SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
            )
        )
        OR is_admin_or_auditor()
    );

CREATE POLICY asset_state_history_insert_policy ON asset_state_history
    FOR INSERT WITH CHECK (
        actor_user_id = current_user_id()
        AND asset_id IN (
            SELECT id FROM assets WHERE case_id IN (
                SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
            )
        )
    );

-- Disposal Approvals Policies
CREATE POLICY disposal_approvals_select_policy ON disposal_approvals
    FOR SELECT USING (
        asset_id IN (
            SELECT id FROM assets WHERE case_id IN (
                SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
            )
        )
        OR initiated_by = current_user_id()
        OR approved_by = current_user_id()
        OR is_admin_or_auditor()
    );

CREATE POLICY disposal_approvals_insert_policy ON disposal_approvals
    FOR INSERT WITH CHECK (
        initiated_by = current_user_id()
        AND asset_id IN (
            SELECT id FROM assets WHERE case_id IN (
                SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
            )
        )
    );

CREATE POLICY disposal_approvals_update_policy ON disposal_approvals
    FOR UPDATE USING (
        approved_by = current_user_id()  -- Only approver can approve/reject
        OR initiated_by = current_user_id()  -- Initiator can cancel?
        OR is_admin_or_auditor()
    ) WITH CHECK (
        approved_by = current_user_id()
        OR initiated_by = current_user_id()
        OR is_admin_or_auditor()
    );