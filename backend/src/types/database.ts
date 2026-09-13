/**
 * ADALAT360 - Database Types
 * TypeScript enums matching PostgreSQL schema
 */

export enum UserRole {
    INVESTIGATING_OFFICER = 'INVESTIGATING_OFFICER',
    FORENSIC_LAB = 'FORENSIC_LAB',
    PROSECUTOR = 'PROSECUTOR',
    COURT = 'COURT',
    CENTRAL_ADMIN = 'CENTRAL_ADMIN',
    AUDITOR = 'AUDITOR',
}

export enum UserStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
    PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum CaseStatus {
    OPEN = 'OPEN',
    UNDER_INVESTIGATION = 'UNDER_INVESTIGATION',
    CHARGE_SHEET_FILED = 'CHARGE_SHEET_FILED',
    TRIAL_IN_PROGRESS = 'TRIAL_IN_PROGRESS',
    JUDGMENT_RESERVED = 'JUDGMENT_RESERVED',
    DISPOSED = 'DISPOSED',
    APPEALED = 'APPEALED',
    CLOSED = 'CLOSED',
}

export enum CasePriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

export enum DocumentType {
    FIR = 'FIR',
    INVESTIGATION_RECORD = 'INVESTIGATION_RECORD',
    WITNESS_STATEMENT = 'WITNESS_STATEMENT',
    CHARGE_SHEET = 'CHARGE_SHEET',
    COURT_FILING = 'COURT_FILING',
    EVIDENCE_RECORD = 'EVIDENCE_RECORD',
    FORENSIC_REPORT = 'FORENSIC_REPORT',
    LEGAL_NOTICE = 'LEGAL_NOTICE',
    JUDGMENT = 'JUDGMENT',
    ORDER = 'ORDER',
    SUMMONS = 'SUMMONS',
    WARRANT = 'WARRANT',
    BAIL_APPLICATION = 'BAIL_APPLICATION',
    AFFIDAVIT = 'AFFIDAVIT',
    EXHIBIT_LIST = 'EXHIBIT_LIST',
    SEIZURE_MEMO = 'SEIZURE_MEMO',
    PANCHNAMA = 'PANCHNAMA',
    CASE_DIARY = 'CASE_DIARY',
    OTHER = 'OTHER',
}

export enum DocumentStatus {
    DRAFT = 'DRAFT',
    SUBMITTED = 'SUBMITTED',
    VERIFIED = 'VERIFIED',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    ARCHIVED = 'ARCHIVED',
    REDACTED = 'REDACTED',
}

export enum EvidenceType {
    DIGITAL = 'DIGITAL',
    PHYSICAL = 'PHYSICAL',
    DOCUMENTARY = 'DOCUMENTARY',
    BIOLOGICAL = 'BIOLOGICAL',
    CHEMICAL = 'CHEMICAL',
    FIREARM = 'FIREARM',
    VEHICLE = 'VEHICLE',
    ELECTRONIC_DEVICE = 'ELECTRONIC_DEVICE',
    FINANCIAL_RECORD = 'FINANCIAL_RECORD',
    OTHER = 'OTHER',
}

export enum EvidenceStatus {
    SEIZED = 'SEIZED',
    IN_CUSTODY = 'IN_CUSTODY',
    SENT_FOR_ANALYSIS = 'SENT_FOR_ANALYSIS',
    UNDER_ANALYSIS = 'UNDER_ANALYSIS',
    ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
    PRESENTED_IN_COURT = 'PRESENTED_IN_COURT',
    RETURNED = 'RETURNED',
    DISPOSED = 'DISPOSED',
    DESTROYED = 'DESTROYED',
}

export enum CustodyAction {
    UPLOAD = 'UPLOAD',
    ACCESS = 'ACCESS',
    TRANSFER = 'TRANSFER',
    REDACTION = 'REDACTION',
    EXPORT = 'EXPORT',
    VERSION_CREATE = 'VERSION_CREATE',
    METADATA_UPDATE = 'METADATA_UPDATE',
    VERIFICATION = 'VERIFICATION',
    SIGNATURE_APPLY = 'SIGNATURE_APPLY',
    SEIZURE = 'SEIZURE',
    HANDOVER = 'HANDOVER',
    RECEIVE = 'RECEIVE',
    ANALYSIS_START = 'ANALYSIS_START',
    ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
    COURT_SUBMISSION = 'COURT_SUBMISSION',
    COURT_RETURN = 'COURT_RETURN',
    DISPOSAL = 'DISPOSAL',
    // New custody actions for collaboration and asset lifecycle
    HANDOFF_INITIATED = 'HANDOFF_INITIATED',
    HANDOFF_ACCEPTED = 'HANDOFF_ACCEPTED',
    HANDOFF_DECLINED = 'HANDOFF_DECLINED',
    HANDOFF_COMPLETED = 'HANDOFF_COMPLETED',
    ASSET_SEIZED = 'ASSET_SEIZED',
    ASSET_STATE_TRANSITION = 'ASSET_STATE_TRANSITION',
    DISPOSAL_APPROVAL_REQUESTED = 'DISPOSAL_APPROVAL_REQUESTED',
    DISPOSAL_APPROVED = 'DISPOSAL_APPROVED',
    DISPOSAL_REJECTED = 'DISPOSAL_REJECTED',
}

export enum ConsensusStatus {
    PENDING = 'PENDING',
    ENDORSED = 'ENDORSED',
    COMMITTED = 'COMMITTED',
    REJECTED = 'REJECTED',
    FAILED = 'FAILED',
}

export enum NodeType {
    OFFICER_NODE = 'OFFICER_NODE',
    FORENSIC_LAB_NODE = 'FORENSIC_LAB_NODE',
    COURT_NODE = 'COURT_NODE',
    CENTRAL_AUDIT_NODE = 'CENTRAL_AUDIT_NODE',
}

export enum SignatureType {
    DSC = 'DSC',
    AADHAAR_ESIGN = 'AADHAAR_ESIGN',
    DIGITAL_SIGNATURE = 'DIGITAL_SIGNATURE',
    BIOMETRIC = 'BIOMETRIC',
}

export enum PermissionLevel {
    READ = 'READ',
    WRITE = 'WRITE',
    DELETE = 'DELETE',
    ADMIN = 'ADMIN',
    SIGN = 'SIGN',
    VERIFY = 'VERIFY',
    EXPORT = 'EXPORT',
    REDACT = 'REDACT',
}

// ============================================================================
// COLLABORATION ENUMS
// ============================================================================

export enum ActivityType {
    CUSTODY_EVENT = 'CUSTODY_EVENT',
    COMMENT = 'COMMENT',
    STATUS_CHANGE = 'STATUS_CHANGE',
    HANDOFF_INITIATED = 'HANDOFF_INITIATED',
    HANDOFF_ACCEPTED = 'HANDOFF_ACCEPTED',
    HANDOFF_DECLINED = 'HANDOFF_DECLINED',
    HANDOFF_COMPLETED = 'HANDOFF_COMPLETED',
    DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
    DOCUMENT_VERSION = 'DOCUMENT_VERSION',
    DOCUMENT_REDACTED = 'DOCUMENT_REDACTED',
    EVIDENCE_SEIZED = 'EVIDENCE_SEIZED',
    EVIDENCE_TRANSFERRED = 'EVIDENCE_TRANSFERRED',
    EVIDENCE_LAB_SUBMITTED = 'EVIDENCE_LAB_SUBMITTED',
    EVIDENCE_LAB_RESULT = 'EVIDENCE_LAB_RESULT',
    EVIDENCE_COURT_SUBMITTED = 'EVIDENCE_COURT_SUBMITTED',
    EVIDENCE_DISPOSED = 'EVIDENCE_DISPOSED',
    CASE_ASSIGNED = 'CASE_ASSIGNED',
    CASE_UNASSIGNED = 'CASE_UNASSIGNED',
    BSA_CERTIFICATE_GENERATED = 'BSA_CERTIFICATE_GENERATED',
    RTI_REQUESTED = 'RTI_REQUESTED',
    RTI_RESPONDED = 'RTI_RESPONDED',
    RTI_DENIED = 'RTI_DENIED',
}

export enum ActivityVisibility {
    ALL_ASSIGNED = 'ALL_ASSIGNED',
    ROLE_SPECIFIC = 'ROLE_SPECIFIC',
    PRIVATE = 'PRIVATE',
}

export enum HandoffType {
    CASE_HANDOFF = 'CASE_HANDOFF',
    DOCUMENT_HANDOFF = 'DOCUMENT_HANDOFF',
    EVIDENCE_HANDOFF = 'EVIDENCE_HANDOFF',
    CASE_ASSIGNMENT = 'CASE_ASSIGNMENT',
    DOCUMENT_ASSIGNMENT = 'DOCUMENT_ASSIGNMENT',
    EVIDENCE_ASSIGNMENT = 'EVIDENCE_ASSIGNMENT',
}

export enum HandoffStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    DECLINED = 'DECLINED',
    EXPIRED = 'EXPIRED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export enum NotificationType {
    HANDOFF_REQUEST = 'HANDOFF_REQUEST',
    HANDOFF_ACCEPTED = 'HANDOFF_ACCEPTED',
    HANDOFF_DECLINED = 'HANDOFF_DECLINED',
    HANDOFF_EXPIRED = 'HANDOFF_EXPIRED',
    ACTIVITY_MENTION = 'ACTIVITY_MENTION',
    CASE_UPDATE = 'CASE_UPDATE',
    DEADLINE_REMINDER = 'DEADLINE_REMINDER',
    DISPOSAL_APPROVAL_REQUEST = 'DISPOSAL_APPROVAL_REQUEST',
    DISPOSAL_APPROVED = 'DISPOSAL_APPROVED',
    DISPOSAL_REJECTED = 'DISPOSAL_REJECTED',
}

// ============================================================================
// ASSET LIFECYCLE ENUMS
// ============================================================================

export enum AssetState {
    SEIZED = 'SEIZED',
    STORED = 'STORED',
    TRANSFERRED = 'TRANSFERRED',
    DISPOSED = 'DISPOSED',
    REPORTED_LOST = 'REPORTED_LOST',
    REPORTED_DAMAGED = 'REPORTED_DAMAGED',
}

export enum AssetCategory {
    DOCUMENTARY = 'DOCUMENTARY',
    BIOLOGICAL = 'BIOLOGICAL',
    CHEMICAL = 'CHEMICAL',
    FIREARM = 'FIREARM',
    VEHICLE = 'VEHICLE',
    ELECTRONIC_DEVICE = 'ELECTRONIC_DEVICE',
    FINANCIAL_RECORD = 'FINANCIAL_RECORD',
    DRUGS_NARCOTICS = 'DRUGS_NARCOTICS',
    CURRENCY = 'CURRENCY',
    JEWELRY_VALUABLES = 'JEWELRY_VALUABLES',
    DIGITAL_STORAGE = 'DIGITAL_STORAGE',
    CLOTHING_PERSONAL = 'CLOTHING_PERSONAL',
    WEAPON_NON_FIREARM = 'WEAPON_NON_FIREARM',
    TOOL_EQUIPMENT = 'TOOL_EQUIPMENT',
    OTHER = 'OTHER',
}

export enum AssetTransition {
    SEIZED_TO_STORED = 'SEIZED_TO_STORED',
    STORED_TO_TRANSFERRED = 'STORED_TO_TRANSFERRED',
    STORED_TO_DISPOSED = 'STORED_TO_DISPOSED',
    STORED_TO_REPORTED_LOST = 'STORED_TO_REPORTED_LOST',
    STORED_TO_REPORTED_DAMAGED = 'STORED_TO_REPORTED_DAMAGED',
    TRANSFERRED_TO_STORED = 'TRANSFERRED_TO_STORED',
    TRANSFERRED_TO_DISPOSED = 'TRANSFERRED_TO_DISPOSED',
    TRANSFERRED_TO_REPORTED_LOST = 'TRANSFERRED_TO_REPORTED_LOST',
    TRANSFERRED_TO_REPORTED_DAMAGED = 'TRANSFERRED_TO_REPORTED_DAMAGED',
    REPORTED_LOST_TO_STORED = 'REPORTED_LOST_TO_STORED',
    REPORTED_DAMAGED_TO_STORED = 'REPORTED_DAMAGED_TO_STORED',
    REPORTED_LOST_TO_DISPOSED = 'REPORTED_LOST_TO_DISPOSED',
    REPORTED_DAMAGED_TO_DISPOSED = 'REPORTED_DAMAGED_TO_DISPOSED',
}

export enum DisposalApprovalStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    EXPIRED = 'EXPIRED',
}

export enum HandoffType {
    CASE_HANDOFF = 'CASE_HANDOFF',
    DOCUMENT_HANDOFF = 'DOCUMENT_HANDOFF',
    EVIDENCE_HANDOFF = 'EVIDENCE_HANDOFF',
    CASE_ASSIGNMENT = 'CASE_ASSIGNMENT',
    DOCUMENT_ASSIGNMENT = 'DOCUMENT_ASSIGNMENT',
    EVIDENCE_ASSIGNMENT = 'EVIDENCE_ASSIGNMENT',
}

export enum HandoffStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    DECLINED = 'DECLINED',
    EXPIRED = 'EXPIRED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export enum NotificationType {
    HANDOFF_REQUEST = 'HANDOFF_REQUEST',
    HANDOFF_ACCEPTED = 'HANDOFF_ACCEPTED',
    HANDOFF_DECLINED = 'HANDOFF_DECLINED',
    HANDOFF_EXPIRED = 'HANDOFF_EXPIRED',
    ACTIVITY_MENTION = 'ACTIVITY_MENTION',
    CASE_UPDATE = 'CASE_UPDATE',
    DEADLINE_REMINDER = 'DEADLINE_REMINDER',
    DISPOSAL_APPROVAL_REQUEST = 'DISPOSAL_APPROVAL_REQUEST',
    DISPOSAL_APPROVED = 'DISPOSAL_APPROVED',
    DISPOSAL_REJECTED = 'DISPOSAL_REJECTED',
}

// ============================================================================
// TABLE ROW TYPES (matching PostgreSQL schema)
// ============================================================================

export interface UserRow {
    id: string;
    employee_id: string;
    email: string;
    phone: string | null;
    password_hash: string;
    totp_secret: string | null;
    totp_enabled: boolean;
    full_name: string;
    role: UserRole;
    department: string;
    designation: string | null;
    badge_number: string | null;
    status: UserStatus;
    x509_cert_pem: string | null;
    x509_cert_serial: string | null;
    x509_cert_issued_at: Date | null;
    x509_cert_expires_at: Date | null;
    last_login_at: Date | null;
    failed_login_attempts: number;
    locked_until: Date | null;
    password_changed_at: Date;
    mfa_backup_codes: string[] | null;
    created_at: Date;
    updated_at: Date;
    created_by: string | null;
    deleted_at: Date | null;
}

export interface CaseRow {
    id: string;
    case_number: string;
    fir_number: string | null;
    title: string;
    description: string | null;
    status: CaseStatus;
    priority: CasePriority;
    police_station: string | null;
    district: string | null;
    state: string | null;
    jurisdiction_court: string | null;
    ipc_sections: string[] | null;
    bns_sections: string[] | null;
    special_acts: string[] | null;
    assigned_officer_id: string | null;
    supervising_officer_id: string | null;
    prosecutor_id: string | null;
    forensic_lab_id: string | null;
    court_id: string | null;
    incident_date: Date | null;
    fir_registered_at: Date | null;
    charge_sheet_filed_at: Date | null;
    trial_started_at: Date | null;
    judgment_date: Date | null;
    disposal_date: Date | null;
    is_sensitive: boolean;
    sensitivity_level: number;
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
    created_by: string | null;
    deleted_at: Date | null;
}

export interface DocumentRow {
    id: string;
    case_id: string;
    document_number: string;
    title: string;
    description: string | null;
    document_type: DocumentType;
    status: DocumentStatus;
    version: number;
    is_latest_version: boolean;
    parent_document_id: string | null;
    original_filename: string;
    stored_filename: string;
    mime_type: string;
    file_size_bytes: number;
    file_hash_sha256: string;
    file_hash_algorithm: string;
    storage_path: string;
    storage_bucket: string;
    encryption_key_id: string | null;
    encryption_algorithm: string;
    ocr_text: string | null;
    ocr_language: string;
    ocr_confidence: number | null;
    ocr_processed_at: Date | null;
    metadata: Record<string, any>;
    extracted_entities: Record<string, any>;
    tags: string[] | null;
    uploaded_by: string;
    verified_by: string | null;
    verified_at: Date | null;
    approved_by: string | null;
    approved_at: Date | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

export interface EvidenceRow {
    id: string;
    case_id: string;
    evidence_number: string;
    qr_code_hash: string;
    qr_code_image_path: string | null;
    name: string;
    description: string | null;
    evidence_type: EvidenceType;
    status: EvidenceStatus;
    category: string | null;
    sub_category: string | null;
    seized_at: Date;
    seized_by: string;
    seized_location: Record<string, any> | null;
    seized_from: string | null;
    panchnama_reference: string | null;
    seizure_memo_number: string | null;
    current_custodian_id: string | null;
    current_location: string | null;
    storage_condition: string | null;
    container_seal_number: string | null;
    weight_grams: number | null;
    dimensions_cm: Record<string, any> | null;
    photographs: string[] | null;
    forensic_lab_id: string | null;
    sent_for_analysis_at: Date | null;
    analysis_completed_at: Date | null;
    analysis_report_document_id: string | null;
    presented_in_court_at: Date | null;
    court_exhibit_number: string | null;
    returned_to: string | null;
    returned_at: Date | null;
    disposal_method: string | null;
    disposed_at: Date | null;
    disposed_by: string | null;
    disposal_witness: string | null;
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

export interface CustodyLedgerRow {
    id: string;
    tx_id: string;
    block_number: number;
    block_hash: string;
    prev_block_hash: string;
    tx_timestamp: Date;
    tx_type: CustodyAction;
    case_id: string | null;
    document_id: string | null;
    evidence_id: string | null;
    actor_user_id: string;
    actor_node_id: string;
    action_details: Record<string, any>;
    before_state_hash: string | null;
    after_state_hash: string | null;
    consensus_status: ConsensusStatus;
    endorsing_nodes: string[];
    required_endorsements: number;
    received_endorsements: number;
    endorsement_policy: string | null;
    digital_signature_id: string | null;
    payload_hash: string;
    is_valid: boolean;
    validation_error: string | null;
    created_at: Date;
}

export interface AuditLogRow {
    id: string;
    event_id: string;
    event_type: string;
    event_category: string;
    severity: string;
    user_id: string | null;
    user_role: UserRole | null;
    user_ip: string | null;
    user_agent: string | null;
    session_id: string | null;
    resource_type: string | null;
    resource_id: string | null;
    action: string;
    outcome: string;
    error_message: string | null;
    request_id: string | null;
    correlation_id: string | null;
    before_state: Record<string, any> | null;
    after_state: Record<string, any> | null;
    metadata: Record<string, any>;
    blockchain_tx_id: string | null;
    occurred_at: Date;
}