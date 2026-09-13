-- ADALAT360 Database Schema - Collaboration Tables Migration
-- PostgreSQL 15+ compatible
-- Run order: 003_collaboration_tables.sql (after 001_initial_schema.sql and 002_rls_policies.sql)

-- ============================================================================
-- COLLABORATION TABLES
-- ============================================================================

-- Activity Feed Table
CREATE TABLE activity_feed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    actor_department VARCHAR(100) NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    document_number VARCHAR(100),
    evidence_id UUID REFERENCES evidence(id) ON DELETE SET NULL,
    evidence_number VARCHAR(100),
    custody_ledger_tx_id VARCHAR(255),
    handoff_id UUID,
    handoff_from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    handoff_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    handoff_from_role VARCHAR(50),
    handoff_to_role VARCHAR(50),
    old_status VARCHAR(100),
    new_status VARCHAR(100),
    visibility VARCHAR(50) NOT NULL DEFAULT 'ALL_ASSIGNED',
    visible_to_roles VARCHAR(50)[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_feed_case ON activity_feed(case_id);
CREATE INDEX idx_activity_feed_type ON activity_feed(activity_type);
CREATE INDEX idx_activity_feed_actor ON activity_feed(actor_user_id);
CREATE INDEX idx_activity_feed_created ON activity_feed(created_at DESC);
CREATE INDEX idx_activity_feed_document ON activity_feed(document_id);
CREATE INDEX idx_activity_feed_evidence ON activity_feed(evidence_id);
CREATE INDEX idx_activity_feed_handoff ON activity_feed(handoff_id);
CREATE INDEX idx_activity_feed_custody_tx ON activity_feed(custody_ledger_tx_id);

-- Handoffs Table
CREATE TABLE handoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    handoff_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('CASE', 'DOCUMENT', 'EVIDENCE')),
    resource_id UUID NOT NULL,
    resource_identifier VARCHAR(200) NOT NULL,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    from_user_name VARCHAR(255) NOT NULL,
    from_user_role VARCHAR(50) NOT NULL,
    from_user_department VARCHAR(100) NOT NULL,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    to_user_name VARCHAR(255) NOT NULL,
    to_user_role VARCHAR(50) NOT NULL,
    to_user_department VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'COMPLETED', 'CANCELLED')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    declined_at TIMESTAMPTZ,
    declined_by UUID REFERENCES users(id) ON DELETE SET NULL,
    decline_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    custody_ledger_tx_id VARCHAR(255),
    custody_ledger_block_number BIGINT,
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMPTZ,
    email_sent BOOLEAN DEFAULT FALSE,
    sms_sent BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_handoffs_case ON handoffs(case_id);
CREATE INDEX idx_handoffs_status ON handoffs(status);
CREATE INDEX idx_handoffs_from_user ON handoffs(from_user_id);
CREATE INDEX idx_handoffs_to_user ON handoffs(to_user_id);
CREATE INDEX idx_handoffs_resource ON handoffs(resource_type, resource_id);
CREATE INDEX idx_handoffs_expires ON handoffs(expires_at) WHERE status = 'PENDING';
CREATE INDEX idx_handoffs_custody_tx ON handoffs(custody_ledger_tx_id);

-- Comments Table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    mentioned_user_ids UUID[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_comments_activity ON comments(activity_id);
CREATE INDEX idx_comments_case ON comments(case_id);
CREATE INDEX idx_comments_author ON comments(author_user_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);

-- Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    handoff_id UUID,
    activity_id UUID,
    channels VARCHAR(20)[] NOT NULL DEFAULT ARRAY['IN_APP'],
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read);
CREATE INDEX idx_notifications_case ON notifications(case_id);
CREATE INDEX idx_notifications_handoff ON notifications(handoff_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Real-time Events Table (for polling fallback)
CREATE TABLE realtime_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    case_id UUID,
    user_ids UUID[],
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_realtime_events_case ON realtime_events(case_id);
CREATE INDEX idx_realtime_events_timestamp ON realtime_events(timestamp DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_activity_feed_updated_at BEFORE UPDATE ON activity_feed FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_handoffs_updated_at BEFORE UPDATE ON handoffs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Activity Feed Policies
CREATE POLICY activity_feed_select_policy ON activity_feed
    FOR SELECT USING (
        case_id IN (
            SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
        )
        OR is_admin_or_auditor()
    );

CREATE POLICY activity_feed_insert_policy ON activity_feed
    FOR INSERT WITH CHECK (
        actor_user_id = current_user_id()
        AND (
            case_id IN (
                SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
            )
            OR is_admin_or_auditor()
        )
    );

-- Handoffs Policies
CREATE POLICY handoffs_select_policy ON handoffs
    FOR SELECT USING (
        from_user_id = current_user_id()
        OR to_user_id = current_user_id()
        OR case_id IN (
            SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
        )
        OR is_admin_or_auditor()
    );

CREATE POLICY handoffs_insert_policy ON handoffs
    FOR INSERT WITH CHECK (
        from_user_id = current_user_id()
        AND case_id IN (
            SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
        )
    );

CREATE POLICY handoffs_update_policy ON handoffs
    FOR UPDATE USING (
        from_user_id = current_user_id()  -- Only initiator can cancel
        OR to_user_id = current_user_id()  -- Recipient can accept/decline
        OR is_admin_or_auditor()
    ) WITH CHECK (
        from_user_id = current_user_id()
        OR to_user_id = current_user_id()
        OR is_admin_or_auditor()
    );

-- Comments Policies
CREATE POLICY comments_select_policy ON comments
    FOR SELECT USING (
        case_id IN (
            SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
        )
        OR is_admin_or_auditor()
    );

CREATE POLICY comments_insert_policy ON comments
    FOR INSERT WITH CHECK (
        author_user_id = current_user_id()
        AND case_id IN (
            SELECT case_id FROM case_assignments WHERE user_id = current_user_id() AND is_active = TRUE
        )
    );

CREATE POLICY comments_update_policy ON comments
    FOR UPDATE USING (
        author_user_id = current_user_id()
    ) WITH CHECK (
        author_user_id = current_user_id()
    );

CREATE POLICY comments_delete_policy ON comments
    FOR DELETE USING (
        author_user_id = current_user_id()
        OR is_admin_or_auditor()
    );

-- Notifications Policies
CREATE POLICY notifications_select_policy ON notifications
    FOR SELECT USING (
        user_id = current_user_id()
        OR is_admin_or_auditor()
    );

CREATE POLICY notifications_update_policy ON notifications
    FOR UPDATE USING (
        user_id = current_user_id()
    ) WITH CHECK (
        user_id = current_user_id()
    );