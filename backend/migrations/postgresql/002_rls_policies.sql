-- ADALAT360 Database Schema - RLS Policies
-- PostgreSQL 15+ compatible
-- Run order: 002_rls_policies.sql (after 001_initial_schema.sql)

-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

-- Function to get current user ID from JWT claims (set by middleware)
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        NULLIF(current_setting('adalat360.current_user_id', TRUE), '')::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID
    );
EXCEPTION WHEN OTHERS THEN
    RETURN '00000000-0000-0000-0000-000000000000'::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user role from JWT claims
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN COALESCE(
        NULLIF(current_setting('adalat360.current_user_role', TRUE), '')::user_role,
        'INVESTIGATING_OFFICER'::user_role
    );
EXCEPTION WHEN OTHERS THEN
    RETURN 'INVESTIGATING_OFFICER'::user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user department
CREATE OR REPLACE FUNCTION current_user_department()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        NULLIF(current_setting('adalat360.current_user_department', TRUE), ''),
        ''
    );
EXCEPTION WHEN OTHERS THEN
    RETURN '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is admin/auditor
CREATE OR REPLACE FUNCTION is_admin_or_auditor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_user_role() IN ('CENTRAL_ADMIN', 'AUDITOR');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to a case
CREATE OR REPLACE FUNCTION user_has_case_access(case_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID := current_user_id();
    user_role user_role := current_user_role();
    has_access BOOLEAN := FALSE;
BEGIN
    -- Admins and auditors have access to all cases
    IF user_role IN ('CENTRAL_ADMIN', 'AUDITOR') THEN
        RETURN TRUE;
    END IF;

    -- Check direct assignment
    SELECT EXISTS (
        SELECT 1 FROM case_assignments ca
        WHERE ca.case_id = case_uuid
        AND ca.user_id = user_id
        AND ca.is_active = TRUE
        AND (ca.revoked_at IS NULL OR ca.revoked_at > NOW())
    ) INTO has_access;

    IF has_access THEN
        RETURN TRUE;
    END IF;

    -- Check if user is assigned officer, prosecutor, forensic lab, or court for the case
    SELECT EXISTS (
        SELECT 1 FROM cases c
        WHERE c.id = case_uuid
        AND (
            c.assigned_officer_id = user_id
            OR c.supervising_officer_id = user_id
            OR c.prosecutor_id = user_id
            OR c.forensic_lab_id = user_id
            OR c.court_id = user_id
        )
    ) INTO has_access;

    RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to a document
CREATE OR REPLACE FUNCTION user_has_document_access(doc_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID := current_user_id();
    user_role user_role := current_user_role();
    has_access BOOLEAN := FALSE;
    case_uuid UUID;
BEGIN
    -- Admins and auditors have access to all documents
    IF user_role IN ('CENTRAL_ADMIN', 'AUDITOR') THEN
        RETURN TRUE;
    END IF;

    -- Get case_id from document
    SELECT case_id INTO case_uuid FROM documents WHERE id = doc_uuid AND deleted_at IS NULL;

    IF case_uuid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check case access
    RETURN user_has_case_access(case_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to evidence
CREATE OR REPLACE FUNCTION user_has_evidence_access(evi_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID := current_user_id();
    user_role user_role := current_user_role();
    has_access BOOLEAN := FALSE;
    case_uuid UUID;
BEGIN
    -- Admins and auditors have access to all evidence
    IF user_role IN ('CENTRAL_ADMIN', 'AUDITOR') THEN
        RETURN TRUE;
    END IF;

    -- Get case_id from evidence
    SELECT case_id INTO case_uuid FROM evidence WHERE id = evi_uuid AND deleted_at IS NULL;

    IF case_uuid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check case access
    RETURN user_has_case_access(case_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can see their own record, admins/auditors see all
CREATE POLICY users_select_policy ON users
    FOR SELECT USING (
        id = current_user_id()
        OR is_admin_or_auditor()
        OR current_user_role() IN ('CENTRAL_ADMIN', 'AUDITOR')
    );

-- Only admins can insert users
CREATE POLICY users_insert_policy ON users
    FOR INSERT WITH CHECK (is_admin_or_auditor());

-- Users can update their own profile (limited fields), admins can update all
CREATE POLICY users_update_policy ON users
    FOR UPDATE USING (
        id = current_user_id()
        OR is_admin_or_auditor()
    ) WITH CHECK (
        id = current_user_id()
        OR is_admin_or_auditor()
    );

-- Only admins can delete (soft delete via deleted_at)
CREATE POLICY users_delete_policy ON users
    FOR DELETE USING (is_admin_or_auditor());

-- ============================================================================
-- CASES TABLE POLICIES
-- ============================================================================

CREATE POLICY cases_select_policy ON cases
    FOR SELECT USING (
        user_has_case_access(id)
        OR is_admin_or_auditor()
    );

CREATE POLICY cases_insert_policy ON cases
    FOR INSERT WITH CHECK (
        current_user_role() IN ('INVESTIGATING_OFFICER', 'CENTRAL_ADMIN')
        OR is_admin_or_auditor()
    );

CREATE POLICY cases_update_policy ON cases
    FOR UPDATE USING (
        user_has_case_access(id)
        AND (
            current_user_role() IN ('INVESTIGATING_OFFICER', 'CENTRAL_ADMIN')
            OR is_admin_or_auditor()
        )
    ) WITH CHECK (
        user_has_case_access(id)
        AND (
            current_user_role() IN ('INVESTIGATING_OFFICER', 'CENTRAL_ADMIN')
            OR is_admin_or_auditor()
        )
    );

CREATE POLICY cases_delete_policy ON cases
    FOR DELETE USING (is_admin_or_auditor());

-- ============================================================================
-- CASE ASSIGNMENTS POLICIES
-- ============================================================================

CREATE POLICY case_assignments_select_policy ON case_assignments
    FOR SELECT USING (
        user_has_case_access(case_id)
        OR user_id = current_user_id()
        OR is_admin_or_auditor()
    );

CREATE POLICY case_assignments_insert_policy ON case_assignments
    FOR INSERT WITH CHECK (
        user_has_case_access(case_id)
        AND (
            current_user_role() IN ('INVESTIGATING_OFFICER', 'CENTRAL_ADMIN')
            OR is_admin_or_auditor()
        )
    );

CREATE POLICY case_assignments_update_policy ON case_assignments
    FOR UPDATE USING (
        user_has_case_access(case_id)
        AND (
            current_user_role() IN ('INVESTIGATING_OFFICER', 'CENTRAL_ADMIN')
            OR is_admin_or_auditor()
        )
    ) WITH CHECK (
        user_has_case_access(case_id)
        AND (
            current_user_role() IN ('INVESTIGATING_OFFICER', 'CENTRAL_ADMIN')
            OR is_admin_or_auditor()
        )
    );

CREATE POLICY case_assignments_delete_policy ON case_assignments
    FOR DELETE USING (is_admin_or_auditor());

-- ============================================================================
-- DOCUMENTS TABLE POLICIES
-- ============================================================================

CREATE POLICY documents_select_policy ON documents
    FOR SELECT USING (
        user_has_document_access(id)
        OR is_admin_or_auditor()
    );

CREATE POLICY documents_insert_policy ON documents
    FOR INSERT WITH CHECK (
        user_has_case_access(case_id)
        AND current_user_role() IN ('INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'CENTRAL_ADMIN')
    );

CREATE POLICY documents_update_policy ON documents
    FOR UPDATE USING (
        user_has_document_access(id)
        AND current_user_role() IN ('INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'CENTRAL_ADMIN')
    ) WITH CHECK (
        user_has_document_access(id)
        AND current_user_role() IN ('INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'CENTRAL_ADMIN')
    );

CREATE POLICY documents_delete_policy ON documents
    FOR DELETE USING (is_admin_or_auditor());

-- ============================================================================
-- DOCUMENT VERSIONS POLICIES
-- ============================================================================

CREATE POLICY document_versions_select_policy ON document_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM documents d
            WHERE d.id = document_versions.document_id
            AND user_has_document_access(d.id)
        )
        OR is_admin_or_auditor()
    );

-- Versions are immutable - no insert/update/delete policies needed for regular users
CREATE POLICY document_versions_insert_policy ON document_versions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM documents d
            WHERE d.id = document_versions.document_id
            AND user_has_document_access(d.id)
            AND current_user_role() IN ('INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'CENTRAL_ADMIN')
        )
    );

-- ============================================================================
-- EVIDENCE TABLE POLICIES
-- ============================================================================

CREATE POLICY evidence_select_policy ON evidence
    FOR SELECT USING (
        user_has_evidence_access(id)
        OR is_admin_or_auditor()
    );

CREATE POLICY evidence_insert_policy ON evidence
    FOR INSERT WITH CHECK (
        user_has_case_access(case_id)
        AND current_user_role() IN ('INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'CENTRAL_ADMIN')
    );

CREATE POLICY evidence_update_policy ON evidence
    FOR UPDATE USING (
        user_has_evidence_access(id)
        AND current_user_role() IN ('INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'CENTRAL_ADMIN')
    ) WITH CHECK (
        user_has_evidence_access(id)
        AND current_user_role() IN ('INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'CENTRAL_ADMIN')
    );

CREATE POLICY evidence_delete_policy ON evidence
    FOR DELETE USING (is_admin_or_auditor());

-- ============================================================================
-- EVIDENCE CUSTODY CHAIN POLICIES
-- ============================================================================

CREATE POLICY evidence_custody_chain_select_policy ON evidence_custody_chain
    FOR SELECT USING (
        user_has_evidence_access(evidence_id)
        OR is_admin_or_auditor()
    );

CREATE POLICY evidence_custody_chain_insert_policy ON evidence_custody_chain
    FOR INSERT WITH CHECK (
        user_has_evidence_access(evidence_id)
        AND current_user_role() IN ('INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'CENTRAL_ADMIN')
    );

-- Custody chain is immutable - no update/delete

-- ============================================================================
-- CUSTODY LEDGER POLICIES
-- ============================================================================

CREATE POLICY custody_ledger_select_policy ON custody_ledger
    FOR SELECT USING (
        (case_id IS NOT NULL AND user_has_case_access(case_id))
        OR (document_id IS NOT NULL AND user_has_document_access(document_id))
        OR (evidence_id IS NOT NULL AND user_has_evidence_access(evidence_id))
        OR actor_user_id = current_user_id()
        OR is_admin_or_auditor()
    );

-- Ledger entries are inserted by the blockchain layer, not directly by users
CREATE POLICY custody_ledger_insert_policy ON custody_ledger
    FOR INSERT WITH CHECK (is_admin_or_auditor());

-- ============================================================================
-- BLOCKCHAIN BLOCKS POLICIES
-- ============================================================================

CREATE POLICY blockchain_blocks_select_policy ON blockchain_blocks
    FOR SELECT USING (is_admin_or_auditor());

CREATE POLICY blockchain_blocks_insert_policy ON blockchain_blocks
    FOR INSERT WITH CHECK (is_admin_or_auditor());

-- ============================================================================
-- BLOCKCHAIN NODES POLICIES
-- ============================================================================

CREATE POLICY blockchain_nodes_select_policy ON blockchain_nodes
    FOR SELECT USING (is_admin_or_auditor());

CREATE POLICY blockchain_nodes_insert_policy ON blockchain_nodes
    FOR INSERT WITH CHECK (is_admin_or_auditor());

CREATE POLICY blockchain_nodes_update_policy ON blockchain_nodes
    FOR UPDATE USING (is_admin_or_auditor()) WITH CHECK (is_admin_or_auditor());

-- ============================================================================
-- DIGITAL SIGNATURES POLICIES
-- ============================================================================

CREATE POLICY digital_signatures_select_policy ON digital_signatures
    FOR SELECT USING (
        signer_user_id = current_user_id()
        OR is_admin_or_auditor()
    );

CREATE POLICY digital_signatures_insert_policy ON digital_signatures
    FOR INSERT WITH CHECK (
        signer_user_id = current_user_id()
        OR is_admin_or_auditor()
    );

-- ============================================================================
-- ACCESS PERMISSIONS POLICIES
-- ============================================================================

CREATE POLICY access_permissions_select_policy ON access_permissions
    FOR SELECT USING (
        user_id = current_user_id()
        OR granted_by = current_user_id()
        OR is_admin_or_auditor()
    );

CREATE POLICY access_permissions_insert_policy ON access_permissions
    FOR INSERT WITH CHECK (
        (granted_by = current_user_id() AND user_has_case_access(resource_id))
        OR is_admin_or_auditor()
    );

CREATE POLICY access_permissions_update_policy ON access_permissions
    FOR UPDATE USING (
        granted_by = current_user_id()
        OR is_admin_or_auditor()
    ) WITH CHECK (
        granted_by = current_user_id()
        OR is_admin_or_auditor()
    );

CREATE POLICY access_permissions_delete_policy ON access_permissions
    FOR DELETE USING (
        granted_by = current_user_id()
        OR is_admin_or_auditor()
    );

-- ============================================================================
-- AUDIT LOGS POLICIES
-- ============================================================================

CREATE POLICY audit_logs_select_policy ON audit_logs
    FOR SELECT USING (
        user_id = current_user_id()
        OR is_admin_or_auditor()
        OR current_user_role() = 'AUDITOR'
    );

-- Audit logs are insert-only by system
CREATE POLICY audit_logs_insert_policy ON audit_logs
    FOR INSERT WITH CHECK (TRUE);

-- ============================================================================
-- BSA CERTIFICATES POLICIES
-- ============================================================================

CREATE POLICY bsa_certificates_select_policy ON bsa_certificates
    FOR SELECT USING (
        user_has_case_access(case_id)
        OR is_admin_or_auditor()
    );

CREATE POLICY bsa_certificates_insert_policy ON bsa_certificates
    FOR INSERT WITH CHECK (
        user_has_case_access(case_id)
        AND current_user_role() IN ('PROSECUTOR', 'COURT', 'CENTRAL_ADMIN')
    );

CREATE POLICY bsa_certificates_update_policy ON bsa_certificates
    FOR UPDATE USING (
        user_has_case_access(case_id)
        AND current_user_role() IN ('PROSECUTOR', 'COURT', 'CENTRAL_ADMIN')
    ) WITH CHECK (
        user_has_case_access(case_id)
        AND current_user_role() IN ('PROSECUTOR', 'COURT', 'CENTRAL_ADMIN')
    );

-- ============================================================================
-- SEARCH INDEX POLICIES
-- ============================================================================

CREATE POLICY search_index_select_policy ON search_index
    FOR SELECT USING (
        user_has_case_access(case_id)
        OR is_admin_or_auditor()
    );

CREATE POLICY search_index_insert_policy ON search_index
    FOR INSERT WITH CHECK (
        user_has_case_access(case_id)
        OR is_admin_or_auditor()
    );

-- ============================================================================
-- RTI REQUESTS POLICIES
-- ============================================================================

CREATE POLICY rti_requests_select_policy ON rti_requests
    FOR SELECT USING (
        assigned_to = current_user_id()
        OR is_admin_or_auditor()
    );

CREATE POLICY rti_requests_insert_policy ON rti_requests
    FOR INSERT WITH CHECK (TRUE); -- Public can file RTI

CREATE POLICY rti_requests_update_policy ON rti_requests
    FOR UPDATE USING (
        assigned_to = current_user_id()
        OR is_admin_or_auditor()
    ) WITH CHECK (
        assigned_to = current_user_id()
        OR is_admin_or_auditor()
    );

-- ============================================================================
-- SYSTEM CONFIG POLICIES
-- ============================================================================

CREATE POLICY system_config_select_policy ON system_config
    FOR SELECT USING (is_admin_or_auditor());

CREATE POLICY system_config_insert_policy ON system_config
    FOR INSERT WITH CHECK (is_admin_or_auditor());

CREATE POLICY system_config_update_policy ON system_config
    FOR UPDATE USING (is_admin_or_auditor()) WITH CHECK (is_admin_or_auditor());

-- ============================================================================
-- GRANT PERMISSIONS TO ROLES
-- ============================================================================

-- Create application roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'adalat360_app') THEN
        CREATE ROLE adalat360_app NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'adalat360_admin') THEN
        CREATE ROLE adalat360_admin NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'adalat360_auditor') THEN
        CREATE ROLE adalat360_auditor NOLOGIN;
    END IF;
END $$;

-- Grant table permissions to app role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO adalat360_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO adalat360_app;

-- Grant admin permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO adalat360_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO adalat360_admin;

-- Grant auditor permissions (read-only + audit logs write)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO adalat360_auditor;
GRANT INSERT ON audit_logs TO adalat360_auditor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO adalat360_auditor;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION current_user_id() TO adalat360_app, adalat360_admin, adalat360_auditor;
GRANT EXECUTE ON FUNCTION current_user_role() TO adalat360_app, adalat360_admin, adalat360_auditor;
GRANT EXECUTE ON FUNCTION current_user_department() TO adalat360_app, adalat360_admin, adalat360_auditor;
GRANT EXECUTE ON FUNCTION is_admin_or_auditor() TO adalat360_app, adalat360_admin, adalat360_auditor;
GRANT EXECUTE ON FUNCTION user_has_case_access(UUID) TO adalat360_app, adalat360_admin, adalat360_auditor;
GRANT EXECUTE ON FUNCTION user_has_document_access(UUID) TO adalat360_app, adalat360_admin, adalat360_auditor;
GRANT EXECUTE ON FUNCTION user_has_evidence_access(UUID) TO adalat360_app, adalat360_admin, adalat360_auditor;