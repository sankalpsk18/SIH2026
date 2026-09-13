// ADALAT360 MongoDB Schema - Initial Migration
// MongoDB 6+ compatible
// Run order: 001_initial_collections.js

// ============================================================================
// DATABASE SETUP
// ============================================================================

db = db.getSiblingDB('adalat360');

// Create collections with validation
db.createCollection('document_metadata', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['document_id', 'case_id', 'original_filename', 'mime_type', 'file_size_bytes', 'file_hash_sha256', 'version', 'created_at'],
            properties: {
                document_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                parent_document_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                original_filename: { bsonType: 'string', maxLength: 500 },
                stored_filename: { bsonType: 'string', maxLength: 500 },
                mime_type: { bsonType: 'string', maxLength: 100 },
                file_size_bytes: { bsonType: 'long', minimum: 0 },
                file_hash_sha256: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                file_hash_algorithm: { bsonType: 'string', enum: ['SHA-256', 'SHA-512'] },
                version: { bsonType: 'int', minimum: 1 },
                is_latest_version: { bsonType: 'bool' },
                ocr_text: { bsonType: 'string' },
                ocr_language: { bsonType: 'string', maxLength: 10 },
                ocr_confidence: { bsonType: 'double', minimum: 0, maximum: 100 },
                ocr_processed_at: { bsonType: 'date' },
                ocr_pages: {
                    bsonType: 'array',
                    items: {
                        bsonType: 'object',
                        required: ['page_number', 'text', 'confidence'],
                        properties: {
                            page_number: { bsonType: 'int', minimum: 1 },
                            text: { bsonType: 'string' },
                            confidence: { bsonType: 'double', minimum: 0, maximum: 100 },
                            bbox: { bsonType: 'array', items: { bsonType: 'double' } }
                        }
                    }
                },
                extracted_entities: {
                    bsonType: 'object',
                    properties: {
                        persons: { bsonType: 'array', items: { bsonType: 'string' } },
                        organizations: { bsonType: 'array', items: { bsonType: 'string' } },
                        locations: { bsonType: 'array', items: { bsonType: 'string' } },
                        dates: { bsonType: 'array', items: { bsonType: 'string' } },
                        case_numbers: { bsonType: 'array', items: { bsonType: 'string' } },
                        ipc_sections: { bsonType: 'array', items: { bsonType: 'string' } },
                        bns_sections: { bsonType: 'array', items: { bsonType: 'string' } },
                        phone_numbers: { bsonType: 'array', items: { bsonType: 'string' } },
                        email_addresses: { bsonType: 'array', items: { bsonType: 'string' } },
                        vehicle_numbers: { bsonType: 'array', items: { bsonType: 'string' } },
                        aadhaar_numbers: { bsonType: 'array', items: { bsonType: 'string' } },
                        pan_numbers: { bsonType: 'array', items: { bsonType: 'string' } },
                        bank_accounts: { bsonType: 'array', items: { bsonType: 'string' } },
                        custom_entities: { bsonType: 'object' }
                    }
                },
                metadata: {
                    bsonType: 'object',
                    properties: {
                        author: { bsonType: 'string' },
                        creator_tool: { bsonType: 'string' },
                        creation_date: { bsonType: 'date' },
                        modification_date: { bsonType: 'date' },
                        page_count: { bsonType: 'int' },
                        word_count: { bsonType: 'int' },
                        character_count: { bsonType: 'int' },
                        language: { bsonType: 'string' },
                        device_info: { bsonType: 'object' },
                        location: { bsonType: 'object' },
                        camera_info: { bsonType: 'object' },
                        gps_coordinates: { bsonType: 'object' },
                        hash_verification: { bsonType: 'object' }
                    }
                },
                tags: { bsonType: 'array', items: { bsonType: 'string' } },
                uploaded_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                verified_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                verified_at: { bsonType: 'date' },
                approved_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                approved_at: { bsonType: 'date' },
                created_at: { bsonType: 'date' },
                updated_at: { bsonType: 'date' },
                deleted_at: { bsonType: 'date' }
            }
        }
    }
});

db.createCollection('evidence_metadata', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['evidence_id', 'case_id', 'evidence_number', 'name', 'evidence_type', 'status', 'seized_at', 'seized_by', 'created_at'],
            properties: {
                evidence_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                evidence_number: { bsonType: 'string', maxLength: 100 },
                qr_code_hash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                qr_code_data: { bsonType: 'object' },
                name: { bsonType: 'string', maxLength: 500 },
                description: { bsonType: 'string' },
                evidence_type: { bsonType: 'string', enum: ['DIGITAL', 'PHYSICAL', 'DOCUMENTARY', 'BIOLOGICAL', 'CHEMICAL', 'FIREARM', 'VEHICLE', 'ELECTRONIC_DEVICE', 'FINANCIAL_RECORD', 'OTHER'] },
                status: { bsonType: 'string', enum: ['SEIZED', 'IN_CUSTODY', 'SENT_FOR_ANALYSIS', 'UNDER_ANALYSIS', 'ANALYSIS_COMPLETE', 'PRESENTED_IN_COURT', 'RETURNED', 'DISPOSED', 'DESTROYED'] },
                category: { bsonType: 'string', maxLength: 100 },
                sub_category: { bsonType: 'string', maxLength: 100 },
                seized_at: { bsonType: 'date' },
                seized_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                seized_location: { bsonType: 'object' },
                seized_from: { bsonType: 'string', maxLength: 500 },
                panchnama_reference: { bsonType: 'string', maxLength: 200 },
                seizure_memo_number: { bsonType: 'string', maxLength: 100 },
                current_custodian_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                current_location: { bsonType: 'string', maxLength: 500 },
                storage_condition: { bsonType: 'string', maxLength: 200 },
                container_seal_number: { bsonType: 'string', maxLength: 100 },
                weight_grams: { bsonType: 'double' },
                dimensions_cm: { bsonType: 'object' },
                photographs: { bsonType: 'array', items: { bsonType: 'string' } },
                forensic_lab_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                sent_for_analysis_at: { bsonType: 'date' },
                analysis_completed_at: { bsonType: 'date' },
                analysis_report_document_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                analysis_results: { bsonType: 'object' },
                presented_in_court_at: { bsonType: 'date' },
                court_exhibit_number: { bsonType: 'string', maxLength: 100 },
                returned_to: { bsonType: 'string', maxLength: 500 },
                returned_at: { bsonType: 'date' },
                disposal_method: { bsonType: 'string', maxLength: 200 },
                disposed_at: { bsonType: 'date' },
                disposed_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                disposal_witness: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                metadata: { bsonType: 'object' },
                digital_fingerprint: {
                    bsonType: 'object',
                    properties: {
                        sha256: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                        sha512: { bsonType: 'string', pattern: '^[a-f0-9]{128}$' },
                        md5: { bsonType: 'string', pattern: '^[a-f0-9]{32}$' },
                        ssdeep: { bsonType: 'string' },
                        tlsh: { bsonType: 'string' }
                    }
                },
                created_at: { bsonType: 'date' },
                updated_at: { bsonType: 'date' },
                deleted_at: { bsonType: 'date' }
            }
        }
    }
});

db.createCollection('custody_events', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['event_id', 'case_id', 'tx_type', 'actor_user_id', 'actor_node_id', 'action_details', 'occurred_at'],
            properties: {
                event_id: { bsonType: 'string', maxLength: 255 },
                tx_id: { bsonType: 'string', maxLength: 255 },
                block_number: { bsonType: 'long' },
                block_hash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                document_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                evidence_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                tx_type: { bsonType: 'string', enum: ['UPLOAD', 'ACCESS', 'TRANSFER', 'REDACTION', 'EXPORT', 'VERSION_CREATE', 'METADATA_UPDATE', 'VERIFICATION', 'SIGNATURE_APPLY', 'SEIZURE', 'HANDOVER', 'RECEIVE', 'ANALYSIS_START', 'ANALYSIS_COMPLETE', 'COURT_SUBMISSION', 'COURT_RETURN', 'DISPOSAL'] },
                actor_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                actor_node_id: { bsonType: 'string', maxLength: 100 },
                actor_role: { bsonType: 'string' },
                action_details: { bsonType: 'object' },
                before_state: { bsonType: 'object' },
                after_state: { bsonType: 'object' },
                before_state_hash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                after_state_hash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                consensus_status: { bsonType: 'string', enum: ['PENDING', 'ENDORSED', 'COMMITTED', 'REJECTED', 'FAILED'] },
                endorsing_nodes: { bsonType: 'array', items: { bsonType: 'string' } },
                required_endorsements: { bsonType: 'int', minimum: 1 },
                received_endorsements: { bsonType: 'int', minimum: 0 },
                endorsement_policy: { bsonType: 'string' },
                digital_signature_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                payload_hash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                is_valid: { bsonType: 'bool' },
                validation_error: { bsonType: 'string' },
                occurred_at: { bsonType: 'date' },
                recorded_at: { bsonType: 'date' },
                created_at: { bsonType: 'date' }
            }
        }
    }
});

db.createCollection('audit_logs_detailed', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['event_id', 'event_type', 'event_category', 'action', 'outcome', 'occurred_at'],
            properties: {
                event_id: { bsonType: 'string', maxLength: 100 },
                event_type: { bsonType: 'string', maxLength: 100 },
                event_category: { bsonType: 'string', maxLength: 50 },
                severity: { bsonType: 'string', enum: ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'], default: 'INFO' },
                user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                user_role: { bsonType: 'string' },
                user_ip: { bsonType: 'string' },
                user_agent: { bsonType: 'string' },
                session_id: { bsonType: 'string', maxLength: 255 },
                request_id: { bsonType: 'string', maxLength: 100 },
                correlation_id: { bsonType: 'string', maxLength: 100 },
                resource_type: { bsonType: 'string', maxLength: 50 },
                resource_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                action: { bsonType: 'string', maxLength: 100 },
                outcome: { bsonType: 'string', enum: ['SUCCESS', 'FAILURE', 'PARTIAL', 'DENIED', 'ERROR'] },
                error_message: { bsonType: 'string' },
                error_code: { bsonType: 'string' },
                request_details: {
                    bsonType: 'object',
                    properties: {
                        method: { bsonType: 'string' },
                        url: { bsonType: 'string' },
                        headers: { bsonType: 'object' },
                        query_params: { bsonType: 'object' },
                        body_size: { bsonType: 'long' }
                    }
                },
                response_details: {
                    bsonType: 'object',
                    properties: {
                        status_code: { bsonType: 'int' },
                        response_size: { bsonType: 'long' },
                        duration_ms: { bsonType: 'long' }
                    }
                },
                before_state: { bsonType: 'object' },
                after_state: { bsonType: 'object' },
                metadata: { bsonType: 'object' },
                blockchain_tx_id: { bsonType: 'string', maxLength: 255 },
                geo_location: { bsonType: 'object' },
                device_fingerprint: { bsonType: 'string' },
                risk_score: { bsonType: 'double', minimum: 0, maximum: 100 },
                anomaly_flags: { bsonType: 'array', items: { bsonType: 'string' } },
                occurred_at: { bsonType: 'date' }
            }
        }
    }
});

db.createCollection('search_documents', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['resource_type', 'resource_id', 'case_id', 'title', 'content_text', 'indexed_at'],
            properties: {
                resource_type: { bsonType: 'string', enum: ['DOCUMENT', 'EVIDENCE', 'CASE', 'CUSTODY_EVENT'] },
                resource_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                title: { bsonType: 'string', maxLength: 500 },
                content_text: { bsonType: 'string' },
                content_vector_id: { bsonType: 'string' },
                document_type: { bsonType: 'string' },
                evidence_type: { bsonType: 'string' },
                tags: { bsonType: 'array', items: { bsonType: 'string' } },
                entities: { bsonType: 'object' },
                metadata: { bsonType: 'object' },
                access_roles: { bsonType: 'array', items: { bsonType: 'string' } },
                access_departments: { bsonType: 'array', items: { bsonType: 'string' } },
                indexed_at: { bsonType: 'date' },
                updated_at: { bsonType: 'date' }
            }
        }
    }
});

db.createCollection('bsa_certificates_metadata', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['certificate_id', 'case_id', 'document_id', 'certificate_number', 'issued_by', 'issued_at'],
            properties: {
                certificate_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                document_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                certificate_number: { bsonType: 'string', maxLength: 100 },
                section: { bsonType: 'string', maxLength: 20 },
                subsection: { bsonType: 'string', maxLength: 20 },
                certificate_type: { bsonType: 'string', maxLength: 50 },
                issued_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                issued_at: { bsonType: 'date' },
                valid_from: { bsonType: 'date' },
                valid_until: { bsonType: 'date' },
                status: { bsonType: 'string', enum: ['DRAFT', 'ISSUED', 'VERIFIED', 'REVOKED', 'EXPIRED'] },
                hash_algorithm: { bsonType: 'string', enum: ['SHA-256', 'SHA-512'] },
                file_hash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                file_size_bytes: { bsonType: 'long' },
                metadata_hash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                custody_ledger_tx_ids: { bsonType: 'array', items: { bsonType: 'string' } },
                chain_of_custody_hash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                certificate_content: { bsonType: 'object' },
                digital_signature_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                qr_code_hash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
                qr_code_image_path: { bsonType: 'string' },
                verified_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                verified_at: { bsonType: 'date' },
                revoked_at: { bsonType: 'date' },
                revoked_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                revocation_reason: { bsonType: 'string' },
                created_at: { bsonType: 'date' },
                updated_at: { bsonType: 'date' }
            }
        }
    }
});

db.createCollection('rti_requests_detailed', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['request_number', 'applicant_name', 'subject', 'information_sought', 'received_at'],
            properties: {
                request_number: { bsonType: 'string', maxLength: 100 },
                applicant_name: { bsonType: 'string', maxLength: 255 },
                applicant_address: { bsonType: 'string' },
                applicant_email: { bsonType: 'string' },
                applicant_phone: { bsonType: 'string', maxLength: 20 },
                subject: { bsonType: 'string' },
                description: { bsonType: 'string' },
                information_sought: { bsonType: 'string' },
                case_ids: { bsonType: 'array', items: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' } },
                document_ids: { bsonType: 'array', items: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' } },
                evidence_ids: { bsonType: 'array', items: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' } },
                status: { bsonType: 'string', enum: ['RECEIVED', 'UNDER_PROCESS', 'INFORMATION_GATHERED', 'RESPONDED', 'DENIED', 'APPEALED', 'CLOSED'], default: 'RECEIVED' },
                fee_paid: { bsonType: 'double', minimum: 0 },
                fee_receipt_number: { bsonType: 'string', maxLength: 100 },
                assigned_to: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                responded_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                response_text: { bsonType: 'string' },
                response_documents: { bsonType: 'array', items: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' } },
                denied_reasons: { bsonType: 'array', items: { bsonType: 'string' } },
                exemption_sections: { bsonType: 'array', items: { bsonType: 'string' } },
                first_appeal_filed: { bsonType: 'bool', default: false },
                first_appeal_date: { bsonType: 'date' },
                first_appeal_details: { bsonType: 'object' },
                second_appeal_filed: { bsonType: 'bool', default: false },
                second_appeal_date: { bsonType: 'date' },
                second_appeal_details: { bsonType: 'object' },
                received_at: { bsonType: 'date' },
                due_date: { bsonType: 'date' },
                responded_at: { bsonType: 'date' },
                created_at: { bsonType: 'date' },
                updated_at: { bsonType: 'date' }
            }
        }
    }
});

db.createCollection('system_config_mongo', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['config_key', 'config_value'],
            properties: {
                config_key: { bsonType: 'string', maxLength: 100 },
                config_value: { bsonType: 'object' },
                description: { bsonType: 'string' },
                is_sensitive: { bsonType: 'bool', default: false },
                updated_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                updated_at: { bsonType: 'date' }
            }
        }
    }
});

db.createCollection('anomaly_events', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['event_id', 'event_type', 'severity', 'user_id', 'detected_at'],
            properties: {
                event_id: { bsonType: 'string', maxLength: 100 },
                event_type: { bsonType: 'string', enum: ['BULK_DOWNLOAD', 'OFF_HOURS_ACCESS', 'REPEATED_FAILED_AUTH', 'UNUSUAL_LOCATION', 'PRIVILEGE_ESCALATION', 'DATA_EXFILTRATION', 'SUSPICIOUS_QUERY', 'CONCURRENT_SESSIONS', 'RAPID_REQUESTS', 'GEO_ANOMALY'] },
                severity: { bsonType: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                user_role: { bsonType: 'string' },
                case_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                resource_type: { bsonType: 'string' },
                resource_ids: { bsonType: 'array', items: { bsonType: 'string' } },
                description: { bsonType: 'string' },
                details: { bsonType: 'object' },
                baseline_metrics: { bsonType: 'object' },
                current_metrics: { bsonType: 'object' },
                risk_score: { bsonType: 'double', minimum: 0, maximum: 100 },
                status: { bsonType: 'string', enum: ['OPEN', 'INVESTIGATING', 'FALSE_POSITIVE', 'CONFIRMED', 'RESOLVED'], default: 'OPEN' },
                assigned_to: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                investigated_by: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                investigated_at: { bsonType: 'date' },
                resolution_notes: { bsonType: 'string' },
                detected_at: { bsonType: 'date' },
                created_at: { bsonType: 'date' }
            }
        }
    }
});

db.createCollection('notification_logs', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['notification_id', 'recipient_user_id', 'type', 'title', 'message', 'created_at'],
            properties: {
                notification_id: { bsonType: 'string', maxLength: 100 },
                recipient_user_id: { bsonType: 'string', pattern: '^[0-9a-f-]{36}$' },
                recipient_role: { bsonType: 'string' },
                type: { bsonType: 'string', enum: ['CASE_ASSIGNED', 'DOCUMENT_UPLOADED', 'EVIDENCE_SEIZED', 'CUSTODY_TRANSFER', 'SIGNATURE_REQUIRED', 'BSA_CERTIFICATE_ISSUED', 'RTI_RECEIVED', 'ANOMALY_DETECTED', 'SYSTEM_ALERT', 'DEADLINE_REMINDER'] },
                priority: { bsonType: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' },
                title: { bsonType: 'string', maxLength: 200 },
                message: { bsonType: 'string' },
                action_url: { bsonType: 'string' },
                action_label: { bsonType: 'string' },
                metadata: { bsonType: 'object' },
                is_read: { bsonType: 'bool', default: false },
                read_at: { bsonType: 'date' },
                sent_via: { bsonType: 'array', items: { bsonType: 'string', enum: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'] } },
                delivery_status: { bsonType: 'object' },
                created_at: { bsonType: 'date' }
            }
        }
    }
});

// ============================================================================
// INDEXES
// ============================================================================

// document_metadata indexes
db.document_metadata.createIndex({ document_id: 1 }, { unique: true, name: 'idx_doc_meta_doc_id' });
db.document_metadata.createIndex({ case_id: 1, name: 'idx_doc_meta_case_id' });
db.document_metadata.createIndex({ parent_document_id: 1, name: 'idx_doc_meta_parent' });
db.document_metadata.createIndex({ file_hash_sha256: 1, name: 'idx_doc_meta_hash' });
db.document_metadata.createIndex({ uploaded_by: 1, name: 'idx_doc_meta_uploader' });
db.document_metadata.createIndex({ created_at: -1, name: 'idx_doc_meta_created' });
db.document_metadata.createIndex({ 'extracted_entities.persons': 1, name: 'idx_doc_meta_entities_persons' });
db.document_metadata.createIndex({ 'extracted_entities.case_numbers': 1, name: 'idx_doc_meta_entities_cases' });
db.document_metadata.createIndex({ tags: 1, name: 'idx_doc_meta_tags' });
db.document_metadata.createIndex({ is_latest_version: 1, name: 'idx_doc_meta_latest' });
db.document_metadata.createIndex({ deleted_at: 1 }, { partialFilterExpression: { deleted_at: { $exists: true } }, name: 'idx_doc_meta_deleted' });

// evidence_metadata indexes
db.evidence_metadata.createIndex({ evidence_id: 1 }, { unique: true, name: 'idx_evi_meta_evidence_id' });
db.evidence_metadata.createIndex({ case_id: 1, name: 'idx_evi_meta_case_id' });
db.evidence_metadata.createIndex({ qr_code_hash: 1 }, { unique: true, name: 'idx_evi_meta_qr_hash' });
db.evidence_metadata.createIndex({ evidence_number: 1 }, { unique: true, name: 'idx_evi_meta_number' });
db.evidence_metadata.createIndex({ evidence_type: 1, name: 'idx_evi_meta_type' });
db.evidence_metadata.createIndex({ status: 1, name: 'idx_evi_meta_status' });
db.evidence_metadata.createIndex({ current_custodian_id: 1, name: 'idx_evi_meta_custodian' });
db.evidence_metadata.createIndex({ forensic_lab_id: 1, name: 'idx_evi_meta_lab' });
db.evidence_metadata.createIndex({ seized_at: -1, name: 'idx_evi_meta_seized' });
db.evidence_metadata.createIndex({ deleted_at: 1 }, { partialFilterExpression: { deleted_at: { $exists: true } }, name: 'idx_evi_meta_deleted' });

// custody_events indexes
db.custody_events.createIndex({ event_id: 1 }, { unique: true, name: 'idx_custody_event_id' });
db.custody_events.createIndex({ tx_id: 1 }, { unique: true, sparse: true, name: 'idx_custody_tx_id' });
db.custody_events.createIndex({ block_number: 1, name: 'idx_custody_block' });
db.custody_events.createIndex({ case_id: 1, name: 'idx_custody_case' });
db.custody_events.createIndex({ document_id: 1, name: 'idx_custody_document' });
db.custody_events.createIndex({ evidence_id: 1, name: 'idx_custody_evidence' });
db.custody_events.createIndex({ actor_user_id: 1, name: 'idx_custody_actor' });
db.custody_events.createIndex({ actor_node_id: 1, name: 'idx_custody_actor_node' });
db.custody_events.createIndex({ tx_type: 1, name: 'idx_custody_tx_type' });
db.custody_events.createIndex({ consensus_status: 1, name: 'idx_custody_consensus' });
db.custody_events.createIndex({ occurred_at: -1, name: 'idx_custody_occurred' });
db.custody_events.createIndex({ payload_hash: 1, name: 'idx_custody_payload_hash' });

// audit_logs_detailed indexes
db.audit_logs_detailed.createIndex({ event_id: 1 }, { unique: true, name: 'idx_audit_event_id' });
db.audit_logs_detailed.createIndex({ user_id: 1, name: 'idx_audit_user' });
db.audit_logs_detailed.createIndex({ resource_type: 1, resource_id: 1, name: 'idx_audit_resource' });
db.audit_logs_detailed.createIndex({ action: 1, name: 'idx_audit_action' });
db.audit_logs_detailed.createIndex({ outcome: 1, name: 'idx_audit_outcome' });
db.audit_logs_detailed.createIndex({ occurred_at: -1, name: 'idx_audit_occurred' });
db.audit_logs_detailed.createIndex({ correlation_id: 1, name: 'idx_audit_correlation' });
db.audit_logs_detailed.createIndex({ event_type: 1, name: 'idx_audit_event_type' });
db.audit_logs_detailed.createIndex({ severity: 1, name: 'idx_audit_severity' });
db.audit_logs_detailed.createIndex({ request_id: 1, name: 'idx_audit_request' });
db.audit_logs_detailed.createIndex({ anomaly_flags: 1, name: 'idx_audit_anomaly' });
db.audit_logs_detailed.createIndex({ risk_score: -1, name: 'idx_audit_risk' });

// search_documents indexes
db.search_documents.createIndex({ resource_type: 1, resource_id: 1 }, { unique: true, name: 'idx_search_resource' });
db.search_documents.createIndex({ case_id: 1, name: 'idx_search_case' });
db.search_documents.createIndex({ document_type: 1, name: 'idx_search_doc_type' });
db.search_documents.createIndex({ evidence_type: 1, name: 'idx_search_evi_type' });
db.search_documents.createIndex({ tags: 1, name: 'idx_search_tags' });
db.search_documents.createIndex({ 'entities.persons': 1, name: 'idx_search_entities_persons' });
db.search_documents.createIndex({ 'entities.case_numbers': 1, name: 'idx_search_entities_cases' });
db.search_documents.createIndex({ indexed_at: -1, name: 'idx_search_indexed' });
db.search_documents.createIndex({ access_roles: 1, name: 'idx_search_access_roles' });
db.search_documents.createIndex({ access_departments: 1, name: 'idx_search_access_depts' });

// bsa_certificates_metadata indexes
db.bsa_certificates_metadata.createIndex({ certificate_id: 1 }, { unique: true, name: 'idx_bsa_cert_id' });
db.bsa_certificates_metadata.createIndex({ certificate_number: 1 }, { unique: true, name: 'idx_bsa_cert_number' });
db.bsa_certificates_metadata.createIndex({ case_id: 1, name: 'idx_bsa_case' });
db.bsa_certificates_metadata.createIndex({ document_id: 1, name: 'idx_bsa_document' });
db.bsa_certificates_metadata.createIndex({ status: 1, name: 'idx_bsa_status' });
db.bsa_certificates_metadata.createIndex({ issued_by: 1, name: 'idx_bsa_issued_by' });
db.bsa_certificates_metadata.createIndex({ issued_at: -1, name: 'idx_bsa_issued' });

// rti_requests_detailed indexes
db.rti_requests_detailed.createIndex({ request_number: 1 }, { unique: true, name: 'idx_rti_number' });
db.rti_requests_detailed.createIndex({ status: 1, name: 'idx_rti_status' });
db.rti_requests_detailed.createIndex({ assigned_to: 1, name: 'idx_rti_assigned' });
db.rti_requests_detailed.createIndex({ due_date: 1, name: 'idx_rti_due' });
db.rti_requests_detailed.createIndex({ received_at: -1, name: 'idx_rti_received' });

// system_config_mongo indexes
db.system_config_mongo.createIndex({ config_key: 1 }, { unique: true, name: 'idx_config_key' });

// anomaly_events indexes
db.anomaly_events.createIndex({ event_id: 1 }, { unique: true, name: 'idx_anomaly_event_id' });
db.anomaly_events.createIndex({ event_type: 1, name: 'idx_anomaly_type' });
db.anomaly_events.createIndex({ severity: 1, name: 'idx_anomaly_severity' });
db.anomaly_events.createIndex({ user_id: 1, name: 'idx_anomaly_user' });
db.anomaly_events.createIndex({ case_id: 1, name: 'idx_anomaly_case' });
db.anomaly_events.createIndex({ status: 1, name: 'idx_anomaly_status' });
db.anomaly_events.createIndex({ detected_at: -1, name: 'idx_anomaly_detected' });
db.anomaly_events.createIndex({ risk_score: -1, name: 'idx_anomaly_risk' });

// notification_logs indexes
db.notification_logs.createIndex({ notification_id: 1 }, { unique: true, name: 'idx_notif_id' });
db.notification_logs.createIndex({ recipient_user_id: 1, is_read: 1, name: 'idx_notif_recipient_read' });
db.notification_logs.createIndex({ type: 1, name: 'idx_notif_type' });
db.notification_logs.createIndex({ priority: 1, name: 'idx_notif_priority' });
db.notification_logs.createIndex({ created_at: -1, name: 'idx_notif_created' });

// ============================================================================
// TTL INDEXES (for automatic cleanup)
// ============================================================================

// Audit logs detailed - keep for 7 years (2555 days)
db.audit_logs_detailed.createIndex({ occurred_at: 1 }, { expireAfterSeconds: 2555 * 24 * 60 * 60, name: 'ttl_audit_logs' });

// Notification logs - keep for 1 year
db.notification_logs.createIndex({ created_at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60, name: 'ttl_notifications' });

// Anomaly events - keep for 3 years
db.anomaly_events.createIndex({ detected_at: 1 }, { expireAfterSeconds: 3 * 365 * 24 * 60 * 60, name: 'ttl_anomalies' });

// ============================================================================
// TEXT SEARCH INDEXES
// ============================================================================

db.document_metadata.createIndex(
    {
        original_filename: 'text',
        ocr_text: 'text',
        'extracted_entities.persons': 'text',
        'extracted_entities.organizations': 'text',
        'extracted_entities.locations': 'text',
        tags: 'text'
    },
    {
        name: 'text_search_documents',
        default_language: 'english',
        weights: {
            original_filename: 10,
            ocr_text: 5,
            'extracted_entities.persons': 8,
            'extracted_entities.organizations': 8,
            'extracted_entities.locations': 6,
            tags: 4
        }
    }
);

db.evidence_metadata.createIndex(
    {
        name: 'text',
        description: 'text',
        evidence_number: 'text',
        tags: 'text'
    },
    {
        name: 'text_search_evidence',
        default_language: 'english',
        weights: {
            name: 10,
            evidence_number: 8,
            description: 5
        }
    }
);

db.search_documents.createIndex(
    {
        title: 'text',
        content_text: 'text',
        tags: 'text'
    },
    {
        name: 'text_search_unified',
        default_language: 'english',
        weights: {
            title: 10,
            content_text: 5,
            tags: 3
        }
    }
);

print('MongoDB collections and indexes created successfully');