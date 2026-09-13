// ============================================================================
// ADALAT360 - Frontend Types
// Shared TypeScript interfaces matching backend API
// ============================================================================

// User & Auth
export type UserRole =
  | 'INVESTIGATING_OFFICER'
  | 'FORENSIC_LAB'
  | 'PROSECUTOR'
  | 'COURT'
  | 'CENTRAL_ADMIN'
  | 'AUDITOR';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface User {
  id: string;
  employee_id: string;
  email: string;
  phone?: string;
  full_name: string;
  role: UserRole;
  department: string;
  designation?: string;
  badge_number?: string;
  status: UserStatus;
  totp_enabled: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaRequired: boolean;
  mfaToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  totp_code?: string;
  backup_code?: string;
  remember_me?: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: User;
  requires_mfa?: boolean;
  mfa_method?: 'totp' | 'backup';
}

export interface MfaSetupResponse {
  secret: string;
  qr_code_url: string;
  backup_codes: string[];
  manual_entry_key: string;
}

// Cases
export type CaseStatus =
  | 'OPEN'
  | 'UNDER_INVESTIGATION'
  | 'CHARGE_SHEET_FILED'
  | 'TRIAL_IN_PROGRESS'
  | 'JUDGMENT_RESERVED'
  | 'DISPOSED'
  | 'APPEALED'
  | 'CLOSED';

export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Case {
  id: string;
  case_number: string;
  fir_number?: string;
  title: string;
  description?: string;
  status: CaseStatus;
  priority: CasePriority;
  police_station?: string;
  district?: string;
  state?: string;
  jurisdiction_court?: string;
  ipc_sections?: string[];
  bns_sections?: string[];
  special_acts?: string[];
  assigned_officer_id?: string;
  supervising_officer_id?: string;
  prosecutor_id?: string;
  forensic_lab_id?: string;
  court_id?: string;
  incident_date?: string;
  fir_registered_at?: string;
  charge_sheet_filed_at?: string;
  trial_started_at?: string;
  judgment_date?: string;
  disposal_date?: string;
  is_sensitive: boolean;
  sensitivity_level: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CaseAssignment {
  id: string;
  case_id: string;
  user_id: string;
  role_in_case: string;
  permission_level: string[];
  assigned_at: string;
  assigned_by: string;
  is_active: boolean;
}

export interface CaseStats {
  documentCount: number;
  evidenceCount: number;
  custodyEventsCount: number;
  assignmentsCount: number;
}

// Documents
export type DocumentType =
  | 'FIR'
  | 'INVESTIGATION_RECORD'
  | 'WITNESS_STATEMENT'
  | 'CHARGE_SHEET'
  | 'COURT_FILING'
  | 'EVIDENCE_RECORD'
  | 'FORENSIC_REPORT'
  | 'LEGAL_NOTICE'
  | 'JUDGMENT'
  | 'ORDER'
  | 'SUMMONS'
  | 'WARRANT'
  | 'BAIL_APPLICATION'
  | 'AFFIDAVIT'
  | 'EXHIBIT_LIST'
  | 'SEIZURE_MEMO'
  | 'PANCHNAMA'
  | 'CASE_DIARY'
  | 'OTHER';

export type DocumentStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED'
  | 'REDACTED';

export interface Document {
  id: string;
  case_id: string;
  document_number: string;
  title: string;
  description?: string;
  document_type: DocumentType;
  status: DocumentStatus;
  version: number;
  is_latest_version: boolean;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  file_hash_sha256: string;
  ocr_text?: string;
  ocr_confidence?: number;
  tags: string[];
  uploaded_by: string;
  uploaded_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  file_hash_sha256: string;
  storage_path: string;
  file_size_bytes: number;
  changes_summary?: string;
  ocr_text?: string;
  metadata: Record<string, any>;
  created_by: string;
  created_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Evidence
export type EvidenceType =
  | 'DIGITAL'
  | 'PHYSICAL'
  | 'DOCUMENTARY'
  | 'BIOLOGICAL'
  | 'CHEMICAL'
  | 'FIREARM'
  | 'VEHICLE'
  | 'ELECTRONIC_DEVICE'
  | 'FINANCIAL_RECORD'
  | 'OTHER';

export type EvidenceStatus =
  | 'SEIZED'
  | 'IN_CUSTODY'
  | 'SENT_FOR_ANALYSIS'
  | 'UNDER_ANALYSIS'
  | 'ANALYSIS_COMPLETE'
  | 'PRESENTED_IN_COURT'
  | 'RETURNED'
  | 'DISPOSED'
  | 'DESTROYED';

export interface Evidence {
  id: string;
  case_id: string;
  evidence_number: string;
  qr_code_hash: string;
  qr_code_image_path?: string;
  name: string;
  description?: string;
  evidence_type: EvidenceType;
  status: EvidenceStatus;
  category?: string;
  sub_category?: string;
  seized_at: string;
  seized_by: string;
  seized_by_name?: string;
  current_custodian_id?: string;
  current_custodian_name?: string;
  current_location?: string;
  forensic_lab_id?: string;
  sent_for_analysis_at?: string;
  analysis_completed_at?: string;
  court_exhibit_number?: string;
  created_at: string;
  updated_at: string;
}

export interface CustodyChainEvent {
  id: string;
  evidence_id: string;
  from_user_id?: string;
  to_user_id?: string;
  from_location?: string;
  to_location?: string;
  action: CustodyAction;
  seal_number?: string;
  seal_intact?: boolean;
  condition_notes?: string;
  occurred_at: string;
  recorded_by: string;
  recorded_by_name?: string;
  blockchain_tx_id?: string;
}

export type CustodyAction =
  | 'UPLOAD' | 'ACCESS' | 'TRANSFER' | 'REDACTION' | 'EXPORT'
  | 'VERSION_CREATE' | 'METADATA_UPDATE' | 'VERIFICATION' | 'SIGNATURE_APPLY'
  | 'SEIZURE' | 'HANDOVER' | 'RECEIVE' | 'ANALYSIS_START' | 'ANALYSIS_COMPLETE'
  | 'COURT_SUBMISSION' | 'COURT_RETURN' | 'DISPOSAL';

// Search
export interface SearchQuery {
  query: string;
  caseId?: string;
  documentTypes?: DocumentType[];
  evidenceTypes?: EvidenceType[];
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  authorIds?: string[];
  entities?: {
    persons?: string[];
    organizations?: string[];
    locations?: string[];
  };
  page: number;
  limit: number;
  semanticSearch?: boolean;
  highlight?: boolean;
}

export interface SearchResult {
  id: string;
  resourceType: 'DOCUMENT' | 'EVIDENCE' | 'CASE' | 'CUSTODY_EVENT';
  resourceId: string;
  caseId: string;
  title: string;
  snippet: string;
  highlights: Record<string, string[]>;
  score: number;
  metadata: {
    documentType?: DocumentType;
    evidenceType?: EvidenceType;
    version?: number;
    uploadedBy?: string;
    createdAt: string;
    tags: string[];
    entities: Record<string, string[]>;
  };
  accessRoles: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  tookMs: number;
  query: string;
}

// Blockchain
export interface CustodyEvent {
  id: string;
  tx_id: string;
  block_number: number;
  block_hash: string;
  tx_timestamp: string;
  tx_type: CustodyAction;
  case_id?: string;
  document_id?: string;
  evidence_id?: string;
  actor_user_id: string;
  actor_node_id: string;
  action_details: Record<string, any>;
  consensus_status: string;
  endorsing_nodes: string[];
  required_endorsements: number;
  received_endorsements: number;
}

export interface Block {
  block_number: number;
  block_hash: string;
  prev_block_hash: string;
  tx_count: number;
  tx_ids: string[];
  merkle_root: string;
  proposer_node_id: string;
  committed_at: string;
}

// BSA Certificate
export interface BSA63Certificate {
  id: string;
  certificate_number: string;
  case_id: string;
  document_id: string;
  section: string;
  certificate_type: string;
  issued_by: string;
  issued_at: string;
  valid_from: string;
  valid_until?: string;
  status: string;
  hash_algorithm: string;
  file_hash: string;
  file_size_bytes: number;
  metadata_hash: string;
  custody_ledger_tx_ids: string[];
  chain_of_custody_hash: string;
  certificate_content: BSA63CertificateContent;
  digital_signature_id?: string;
  qr_code_hash: string;
  qr_code_image_url?: string;
}

export interface BSA63CertificateContent {
  computerOutput: {
    description: string;
    producedBy: string;
    productionDate: string;
    productionProcess: string;
    responsiblePerson: string;
    responsiblePersonRole: string;
  };
  conditions: {
    regularUse: boolean;
    properOperation: boolean;
    accurateReproduction: boolean;
    informationSupplied: boolean;
  };
  certificateDetails: {
    identifier: string;
    descriptionOfOutput: string;
    particularsOfDevice: string;
    particularsOfProcedure: string;
    signatureOfPerson: string;
    designationOfPerson: string;
  };
  evidence: {
    hashVerification: {
      algorithm: string;
      originalHash: string;
      verifiedHash: string;
      verifiedAt: string;
      verifiedBy: string;
    };
    chainOfCustody: Array<{
      txId: string;
      timestamp: string;
      action: string;
      actor: string;
      hash: string;
    }>;
    digitalSignatures: Array<{
      signatureId: string;
      signer: string;
      timestamp: string;
      certificateSerial: string;
    }>;
  };
}

// Timeline
export interface TimelineEvent {
  id: string;
  caseId: string;
  timestamp: string;
  eventType: CustodyAction;
  title: string;
  description: string;
  actor: {
    userId: string;
    name: string;
    role: string;
    department: string;
  };
  resources: {
    documents: Array<{ id: string; title: string; version: number }>;
    evidence: Array<{ id: string; name: string; evidenceNumber: string }>;
  };
  blockchain: {
    txId: string;
    blockNumber: number;
    blockHash: string;
    consensusStatus: string;
  };
  metadata: Record<string, any>;
}

export interface TimelineResponse {
  events: TimelineEvent[];
  total: number;
  dateRange: { start: string; end: string };
  statistics: {
    byEventType: Record<string, number>;
    byActor: Record<string, number>;
    byMonth: Record<string, number>;
  };
}

// Entity Graph
export type EntityNodeType = 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'DATE' | 'LEGAL_REFERENCE' | 'DOCUMENT' | 'EVIDENCE';

export interface EntityNode {
  id: string;
  label: string;
  type: EntityNodeType;
  properties: Record<string, any>;
  caseId: string;
}

export interface EntityEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  weight: number;
  evidence: string[];
  caseId: string;
}

export interface EntityGraph {
  nodes: EntityNode[];
  edges: EntityEdge[];
  caseId: string;
  generatedAt: string;
  statistics: {
    nodeCount: number;
    edgeCount: number;
    byType: Record<string, number>;
  };
}

// Audit
export interface AuditEvent {
  id: string;
  event_id: string;
  event_type: string;
  event_category: string;
  severity: string;
  user_id?: string;
  user_role?: string;
  user_ip?: string;
  action: string;
  outcome: string;
  resource_type?: string;
  resource_id?: string;
  occurred_at: string;
}

// RTI
export type RTIStatus =
  | 'RECEIVED'
  | 'UNDER_PROCESS'
  | 'INFORMATION_GATHERED'
  | 'RESPONDED'
  | 'DENIED'
  | 'APPEALED'
  | 'CLOSED';

export interface RTIRequest {
  id: string;
  request_number: string;
  applicant_name: string;
  applicant_email?: string;
  subject: string;
  information_sought: string;
  status: RTIStatus;
  assigned_to?: string;
  assigned_to_name?: string;
  response_text?: string;
  denied_reasons?: string[];
  exemption_sections?: string[];
  received_at: string;
  due_date?: string;
  responded_at?: string;
}

// API
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: any;
  request_id: string;
  timestamp: string;
}

// Role permissions
export interface RolePermissions {
  canViewCases: boolean;
  canCreateCases: boolean;
  canEditCases: boolean;
  canDeleteCases: boolean;
  canManageAssignments: boolean;
  canUploadDocuments: boolean;
  canRedactDocuments: boolean;
  canExportDocuments: boolean;
  canManageEvidence: boolean;
  canTransferCustody: boolean;
  canSendToLab: boolean;
  canSubmitLabResults: boolean;
  canSubmitToCourt: boolean;
  canGenerateBSA: boolean;
  canVerifyBSA: boolean;
  canViewAuditLogs: boolean;
  canGenerateReports: boolean;
  canManageUsers: boolean;
  canManageConfig: boolean;
  canManageBlockchain: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  INVESTIGATING_OFFICER: {
    canViewCases: true,
    canCreateCases: true,
    canEditCases: true,
    canDeleteCases: false,
    canManageAssignments: true,
    canUploadDocuments: true,
    canRedactDocuments: true,
    canExportDocuments: true,
    canManageEvidence: true,
    canTransferCustody: true,
    canSendToLab: true,
    canSubmitLabResults: false,
    canSubmitToCourt: true,
    canGenerateBSA: false,
    canVerifyBSA: true,
    canViewAuditLogs: false,
    canGenerateReports: true,
    canManageUsers: false,
    canManageConfig: false,
    canManageBlockchain: false,
  },
  FORENSIC_LAB: {
    canViewCases: true,
    canCreateCases: false,
    canEditCases: false,
    canDeleteCases: false,
    canManageAssignments: false,
    canUploadDocuments: true,
    canRedactDocuments: false,
    canExportDocuments: true,
    canManageEvidence: true,
    canTransferCustody: true,
    canSendToLab: false,
    canSubmitLabResults: true,
    canSubmitToCourt: false,
    canGenerateBSA: false,
    canVerifyBSA: true,
    canViewAuditLogs: false,
    canGenerateReports: true,
    canManageUsers: false,
    canManageConfig: false,
    canManageBlockchain: false,
  },
  PROSECUTOR: {
    canViewCases: true,
    canCreateCases: false,
    canEditCases: true,
    canDeleteCases: false,
    canManageAssignments: false,
    canUploadDocuments: true,
    canRedactDocuments: true,
    canExportDocuments: true,
    canManageEvidence: true,
    canTransferCustody: false,
    canSendToLab: false,
    canSubmitLabResults: false,
    canSubmitToCourt: true,
    canGenerateBSA: true,
    canVerifyBSA: true,
    canViewAuditLogs: false,
    canGenerateReports: true,
    canManageUsers: false,
    canManageConfig: false,
    canManageBlockchain: false,
  },
  COURT: {
    canViewCases: true,
    canCreateCases: false,
    canEditCases: false,
    canDeleteCases: false,
    canManageAssignments: false,
    canUploadDocuments: false,
    canRedactDocuments: false,
    canExportDocuments: true,
    canManageEvidence: false,
    canTransferCustody: false,
    canSendToLab: false,
    canSubmitLabResults: false,
    canSubmitToCourt: false,
    canGenerateBSA: true,
    canVerifyBSA: true,
    canViewAuditLogs: false,
    canGenerateReports: true,
    canManageUsers: false,
    canManageConfig: false,
    canManageBlockchain: false,
  },
  CENTRAL_ADMIN: {
    canViewCases: true,
    canCreateCases: true,
    canEditCases: true,
    canDeleteCases: true,
    canManageAssignments: true,
    canUploadDocuments: true,
    canRedactDocuments: true,
    canExportDocuments: true,
    canManageEvidence: true,
    canTransferCustody: true,
    canSendToLab: true,
    canSubmitLabResults: true,
    canSubmitToCourt: true,
    canGenerateBSA: true,
    canVerifyBSA: true,
    canViewAuditLogs: true,
    canGenerateReports: true,
    canManageUsers: true,
    canManageConfig: true,
    canManageBlockchain: true,
  },
  AUDITOR: {
    canViewCases: true,
    canCreateCases: false,
    canEditCases: false,
    canDeleteCases: false,
    canManageAssignments: false,
    canUploadDocuments: false,
    canRedactDocuments: false,
    canExportDocuments: true,
    canManageEvidence: false,
    canTransferCustody: false,
    canSendToLab: false,
    canSubmitLabResults: false,
    canSubmitToCourt: false,
    canGenerateBSA: false,
    canVerifyBSA: true,
    canViewAuditLogs: true,
    canGenerateReports: true,
    canManageUsers: false,
    canManageConfig: false,
    canManageBlockchain: false,
  },
};