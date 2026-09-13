// ADALAT360 MongoDB Schema - Collaboration & Asset Collections
// MongoDB 6+ compatible
// Run order: 002_collaboration_asset_collections.js (after 001_initial_collections.js)

db = db.getSiblingDB('adalat360');

// ============================================================================
// ACTIVITY FEED
// ============================================================================

db.createCollection('activity_feed', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['case_id', 'activity_type', 'title', 'actor_user_id', 'actor_name', 'actor_role', 'actor_department', 'visibility', 'created_at'],
            properties: {
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                activity_type: { bsonType: 'string', enum: ['CUSTODY_EVENT', 'COMMENT', 'STATUS_CHANGE', 'HANDOFF_INITIATED', 'HANDOFF_ACCEPTED', 'HANDOFF_DECLINED', 'HANDOFF_COMPLETED', 'DOCUMENT_UPLOADED', 'DOCUMENT_VERSION', 'DOCUMENT_REDACTED', 'EVIDENCE_SEIZED', 'EVIDENCE_TRANSFERRED', 'EVIDENCE_LAB_SUBMITTED', 'EVIDENCE_LAB_RESULT', 'EVIDENCE_COURT_SUBMITTED', 'EVIDENCE_DISPOSED', 'CASE_ASSIGNED', 'CASE_UNASSIGNED', 'BSA_CERTIFICATE_GENERATED', 'RTI_REQUESTED', 'RTI_RESPONDED', 'RTI_DENIED'] },
                title: { bsonType: 'string', maxLength: 500 },
                description: { bsonType: 'string' },
                actor_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                actor_name: { bsonType: 'string', maxLength: 255 },
                actor_role: { bsonType: 'string', maxLength: 50 },
                actor_department: { bsonType: 'string', maxLength: 100 },
                document_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                document_number: { bsonType: 'string', maxLength: 100 },
                evidence_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                evidence_number: { bsonType: 'string', maxLength: 100 },
                custody_ledger_tx_id: { bsonType: 'string', maxLength: 255 },
                handoff_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                handoff_from_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                handoff_to_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                handoff_from_role: { bsonType: 'string', maxLength: 50 },
                handoff_to_role: { bsonType: 'string', maxLength: 50 },
                old_status: { bsonType: 'string', maxLength: 100 },
                new_status: { bsonType: 'string', maxLength: 100 },
                visibility: { bsonType: 'string', enum: ['ALL_ASSIGNED', 'ROLE_SPECIFIC', 'PRIVATE'] },
                visible_to_roles: { bsonType: 'array', items: { bsonType: 'string' } },
                metadata: { bsonType: 'object' },
                created_at: { bsonType: 'date' },
                updated_at: { bsonType: 'date' }
            }
        }
    }
});

db.activity_feed.createIndex({ case_id: 1 });
db.activity_feed.createIndex({ activity_type: 1 });
db.activity_feed.createIndex({ actor_user_id: 1 });
db.activity_feed.createIndex({ created_at: -1 });
db.activity_feed.createIndex({ document_id: 1 });
db.activity_feed.createIndex({ evidence_id: 1 });
db.activity_feed.createIndex({ handoff_id: 1 });
db.activity_feed.createIndex({ custody_ledger_tx_id: 1 });
db.activity_feed.createIndex({ created_at: -1 });

// ============================================================================
// HANDOFFS
// ============================================================================

db.createCollection('handoffs', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['case_id', 'handoff_type', 'title', 'resource_type', 'resource_id', 'resource_identifier', 'from_user_id', 'from_user_name', 'from_user_role', 'from_user_department', 'to_user_id', 'to_user_name', 'to_user_role', 'to_user_department', 'status', 'expires_at'],
            properties: {
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                handoff_type: { bsonType: 'string', enum: ['CASE_HANDOFF', 'DOCUMENT_HANDOFF', 'EVIDENCE_HANDOFF', 'CASE_ASSIGNMENT', 'DOCUMENT_ASSIGNMENT', 'EVIDENCE_ASSIGNMENT'] },
                title: { bsonType: 'string', maxLength: 200 },
                description: { bsonType: 'string' },
                resource_type: { bsonType: 'string', enum: ['CASE', 'DOCUMENT', 'EVIDENCE'] },
                resource_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                resource_identifier: { bsonType: 'string', maxLength: 200 },
                from_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                from_user_name: { bsonType: 'string', maxLength: 255 },
                from_user_role: { bsonType: 'string', maxLength: 50 },
                from_user_department: { bsonType: 'string', maxLength: 100 },
                to_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                to_user_name: { bsonType: 'string', maxLength: 255 },
                to_user_role: { bsonType: 'string', maxLength: 50 },
                to_user_department: { bsonType: 'string', maxLength: 100 },
                status: { bsonType: 'string', enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'COMPLETED', 'CANCELLED'] },
                expires_at: { bsonType: 'date' },
                accepted_at: { bsonType: 'date' },
                accepted_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                declined_at: { bsonType: 'date' },
                declined_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                decline_reason: { bsonType: 'string' },
                cancelled_at: { bsonType: 'date' },
                cancelled_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                custody_ledger_tx_id: { bsonType: 'string', maxLength: 255 },
                custody_ledger_block_number: { bsonType: 'long' },
                notification_sent: { bsonType: 'bool' },
                notification_sent_at: { bsonType: 'date' },
                email_sent: { bsonType: 'bool' },
                sms_sent: { bsonType: 'bool' },
                metadata: { bsonType: 'object' },
                created_at: { bsonType: 'date' },
                updated_at: { bsonType: 'date' },
                completed_at: { bsonType: 'date' }
            }
        }
    }
});

db.handoffs.createIndex({ case_id: 1 });
db.handoffs.createIndex({ status: 1 });
db.handoffs.createIndex({ from_user_id: 1 });
db.handoffs.createIndex({ to_user_id: 1 });
db.handoffs.createIndex({ resource_type: 1, resource_id: 1 });
db.handoffs.createIndex({ expires_at: 1 }, { partialFilterExpression: { status: 'PENDING' } });
db.handoffs.createIndex({ custody_ledger_tx_id: 1 });
db.handoffs.createIndex({ created_at: -1 });

// ============================================================================
// COMMENTS
// ============================================================================

db.createCollection('comments', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['case_id', 'activity_id', 'author_user_id', 'author_name', 'author_role', 'content'],
            properties: {
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                activity_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                author_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                author_name: { bsonType: 'string', maxLength: 255 },
                author_role: { bsonType: 'string', maxLength: 50 },
                content: { bsonType: 'string' },
                parent_comment_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                mentioned_user_ids: { bsonType: 'array', items: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' } },
                metadata: { bsonType: 'object' },
                created_at: { bsonType: 'date' },
                updated_at: { bsonType: 'date' },
                deleted_at: { bsonType: 'date' }
            }
        }
    }
});

db.comments.createIndex({ activity_id: 1 });
db.comments.createIndex({ case_id: 1 });
db.comments.createIndex({ author_user_id: 1 });
db.comments.createIndex({ parent_comment_id: 1 });
db.comments.createIndex({ created_at: -1 });

// ============================================================================
// NOTIFICATIONS
// ============================================================================

db.createCollection('notifications', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['user_id', 'type', 'title', 'message', 'priority', 'channels'],
            properties: {
                user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                type: { bsonType: 'string', enum: ['HANDOFF_REQUEST', 'HANDOFF_ACCEPTED', 'HANDOFF_DECLINED', 'HANDOFF_EXPIRED', 'ACTIVITY_MENTION', 'CASE_UPDATE', 'DEADLINE_REMINDER', 'DISPOSAL_APPROVAL_REQUEST', 'DISPOSAL_APPROVED', 'DISPOSAL_REJECTED'] },
                title: { bsonType: 'string', maxLength: 200 },
                message: { bsonType: 'string' },
                priority: { bsonType: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                handoff_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                activity_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                channels: { bsonType: 'array', items: { bsonType: 'string', enum: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'] } },
                read: { bsonType: 'bool' },
                read_at: { bsonType: 'date' },
                metadata: { bsonType: 'object' },
                created_at: { bsonType: 'date' }
            }
        }
    }
});

db.notifications.createIndex({ user_id: 1, read: 1 });
db.notifications.createIndex({ case_id: 1 });
db.notifications.createIndex({ handoff_id: 1 });
db.notifications.createIndex({ created_at: -1 });
db.notifications.createIndex({ read: 1 });

// ============================================================================
// REALTIME EVENTS
// ============================================================================

db.createCollection('realtime_events', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['event_type', 'payload'],
            properties: {
                event_type: { bsonType: 'string', enum: ['ACTIVITY_FEED_UPDATE', 'HANDOFF_UPDATE', 'NOTIFICATION'] },
                payload: { bsonType: 'object' },
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                user_ids: { bsonType: 'array', items: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' } },
                timestamp: { bsonType: 'date' }
            }
        }
    }
});

db.realtime_events.createIndex({ case_id: 1 });
db.realtime_events.createIndex({ timestamp: -1 });
db.realtime_events.createIndex({ event_type: 1 });

// ============================================================================
// ASSETS
// ============================================================================

db.createCollection('assets', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['asset_id', 'qr_code_hash', 'qr_code_payload', 'case_id', 'case_number', 'name', 'category', 'current_state', 'seized_at', 'seized_by_user_id', 'seized_by_name', 'seized_by_role', 'seized_location'],
            properties: {
                asset_id: { bsonType: 'string', maxLength: 100 },
                qr_code_hash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                qr_code_image_url: { bsonType: 'string' },
                qr_code_payload: { bsonType: 'string' },
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                case_number: { bsonType: 'string', maxLength: 100 },
                name: { bsonType: 'string', maxLength: 500 },
                description: { bsonType: 'string' },
                category: { bsonType: 'string', enum: ['DOCUMENTARY', 'BIOLOGICAL', 'CHEMICAL', 'FIREARM', 'VEHICLE', 'ELECTRONIC_DEVICE', 'FINANCIAL_RECORD', 'DRUGS_NARCOTICS', 'CURRENCY', 'JEWELRY_VALUABLES', 'DIGITAL_STORAGE', 'CLOTHING_PERSONAL', 'WEAPON_NON_FIREARM', 'TOOL_EQUIPMENT', 'OTHER'] },
                sub_category: { bsonType: 'string', maxLength: 100 },
                current_state: { bsonType: 'string', enum: ['SEIZED', 'STORED', 'TRANSFERRED', 'DISPOSED', 'REPORTED_LOST', 'REPORTED_DAMAGED'] },
                previous_state: { bsonType: 'string', enum: ['SEIZED', 'STORED', 'TRANSFERRED', 'DISPOSED', 'REPORTED_LOST', 'REPORTED_DAMAGED'] },
                seized_at: { bsonType: 'date' },
                seized_by_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                seized_by_name: { bsonType: 'string', maxLength: 255 },
                seized_by_role: { bsonType: 'string', maxLength: 50 },
                seized_location: { bsonType: 'object' },
                seized_from: { bsonType: 'string', maxLength: 500 },
                panchnama_reference: { bsonType: 'string', maxLength: 200 },
                seizure_memo_number: { bsonType: 'string', maxLength: 100 },
                weight_grams: { bsonType: 'double' },
                dimensions_cm: { bsonType: 'object' },
                photographs: { bsonType: 'array', items: { bsonType: 'string' } },
                distinguishing_features: { bsonType: 'string' },
                serial_number: { bsonType: 'string', maxLength: 100 },
                manufacturer: { bsonType: 'string', maxLength: 100 },
                model: { bsonType: 'string', maxLength: 100 },
                current_holder_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                current_holder_name: { bsonType: 'string', maxLength: 255 },
                current_holder_role: { bsonType: 'string', maxLength: 50 },
                current_holder_department: { bsonType: 'string', maxLength: 100 },
                current_location: { bsonType: 'object' },
                container_seal_number: { bsonType: 'string', maxLength: 100 },
                seal_intact: { bsonType: 'bool' },
                storage_condition: { bsonType: 'string', maxLength: 200 },
                forensic_lab_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                sent_for_analysis_at: { bsonType: 'date' },
                analysis_completed_at: { bsonType: 'date' },
                analysis_report_document_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                court_exhibit_number: { bsonType: 'string', maxLength: 100 },
                presented_in_court_at: { bsonType: 'date' },
                disposal_method: { bsonType: 'string', maxLength: 200 },
                disposed_at: { bsonType: 'date' },
                disposed_by_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                disposal_witness_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                disposal_authorization: { bsonType: 'string' },
                disposal_initiated_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                disposal_initiated_at: { bsonType: 'date' },
                disposal_approved_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                disposal_approved_at: { bsonType: 'date' },
                custody_ledger_tx_ids: { bsonType: 'array', items: { bsonType: 'string' } },
                state_history: { bsonType: 'array' },
                metadata: { bsonType: 'object' },
                tags: { bsonType: 'array', items: { bsonType: 'string' } },
                created_at: { bsonType: 'date' },
                updated_at: { bsonType: 'date' },
                deleted_at: { bsonType: 'date' }
            }
        }
    }
});

db.assets.createIndex({ case_id: 1 });
db.assets.createIndex({ asset_id: 1 }, { unique: true });
db.assets.createIndex({ qr_code_hash: 1 });
db.assets.createIndex({ current_state: 1 });
db.assets.createIndex({ category: 1 });
db.assets.createIndex({ current_holder_user_id: 1 });
db.assets.createIndex({ seized_at: -1 });
db.assets.createIndex({ seized_by_user_id: 1 });
db.assets.createIndex({ qr_code_hash: 1 });
db.assets.createIndex({ deleted_at: 1 }, { partialFilterExpression: { deleted_at: { $exists: true } } });

// ============================================================================
// ASSET STATE HISTORY
// ============================================================================

db.createCollection('asset_state_history', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['asset_id', 'to_state', 'transition', 'actor_user_id', 'actor_name', 'actor_role', 'actor_department', 'timestamp'],
            properties: {
                asset_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                from_state: { bsonType: 'string', enum: ['SEIZED', 'STORED', 'TRANSFERRED', 'DISPOSED', 'REPORTED_LOST', 'REPORTED_DAMAGED'] },
                to_state: { bsonType: 'string', enum: ['SEIZED', 'STORED', 'TRANSFERRED', 'DISPOSED', 'REPORTED_LOST', 'REPORTED_DAMAGED'] },
                transition: { bsonType: 'string' },
                actor_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                actor_name: { bsonType: 'string', maxLength: 255 },
                actor_role: { bsonType: 'string', maxLength: 50 },
                actor_department: { bsonType: 'string', maxLength: 100 },
                location: { bsonType: 'object' },
                seal_number: { bsonType: 'string', maxLength: 100 },
                seal_intact: { bsonType: 'bool' },
                condition_notes: { bsonType: 'string' },
                witness_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                witness_name: { bsonType: 'string', maxLength: 255 },
                custody_ledger_tx_id: { bsonType: 'string', maxLength: 255 },
                custody_ledger_block_number: { bsonType: 'long' },
                metadata: { bsonType: 'object' },
                timestamp: { bsonType: 'date' }
            }
        }
    }
});

db.asset_state_history.createIndex({ asset_id: 1 });
db.asset_state_history.createIndex({ timestamp: -1 });
db.asset_state_history.createIndex({ actor_user_id: 1 });
db.asset_state_history.createIndex({ transition: 1 });

// ============================================================================
// DISPOSAL APPROVALS
// ============================================================================

db.createCollection('disposal_approvals', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['asset_id', 'initiated_by', 'initiated_by_name', 'disposal_method', 'disposal_authorization', 'approved_by', 'expires_at'],
            properties: {
                asset_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                initiated_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                initiated_by_name: { bsonType: 'string', maxLength: 255 },
                initiated_at: { bsonType: 'date' },
                approved_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                approved_by_name: { bsonType: 'string', maxLength: 255 },
                approved_at: { bsonType: 'date' },
                status: { bsonType: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] },
                disposal_method: { bsonType: 'string', maxLength: 200 },
                disposal_authorization: { bsonType: 'string' },
                rejection_reason: { bsonType: 'string' },
                expires_at: { bsonType: 'date' },
                metadata: { bsonType: 'object' },
                created_at: { bsonType: 'date' },
                updated_at: { bsonType: 'date' }
            }
        }
    }
});

db.disposal_approvals.createIndex({ asset_id: 1 });
db.disposal_approvals.createIndex({ status: 1 });
db.disposal_approvals.createIndex({ approved_by: 1 });
db.disposal_approvals.createIndex({ initiated_by: 1 });
db.disposal_approvals.createIndex({ expires_at: 1 }, { partialFilterExpression: { status: 'PENDING' } });

// ============================================================================
// REALTIME EVENTS
// ============================================================================

db.createCollection('realtime_events', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['event_type', 'payload'],
            properties: {
                event_type: { bsonType: 'string', enum: ['ACTIVITY_FEED_UPDATE', 'HANDOFF_UPDATE', 'NOTIFICATION'] },
                payload: { bsonType: 'object' },
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                user_ids: { bsonType: 'array', items: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' } },
                timestamp: { bsonType: 'date' }
            }
        }
    }
});

db.realtime_events.createIndex({ case_id: 1 });
db.realtime_events.createIndex({ timestamp: -1 });
db.realtime_events.createIndex({ event_type: 1 });

print('MongoDB collections for collaboration and asset lifecycle created successfully');