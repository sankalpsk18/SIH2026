"use strict";
/**
 * ADALAT360 - Database Types
 * TypeScript enums matching PostgreSQL schema
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisposalApprovalStatus = exports.AssetTransition = exports.AssetCategory = exports.AssetState = exports.NotificationType = exports.HandoffStatus = exports.HandoffType = exports.ActivityVisibility = exports.ActivityType = exports.PermissionLevel = exports.SignatureType = exports.NodeType = exports.ConsensusStatus = exports.CustodyAction = exports.EvidenceStatus = exports.EvidenceType = exports.DocumentStatus = exports.DocumentType = exports.CasePriority = exports.CaseStatus = exports.UserStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["INVESTIGATING_OFFICER"] = "INVESTIGATING_OFFICER";
    UserRole["FORENSIC_LAB"] = "FORENSIC_LAB";
    UserRole["PROSECUTOR"] = "PROSECUTOR";
    UserRole["COURT"] = "COURT";
    UserRole["CENTRAL_ADMIN"] = "CENTRAL_ADMIN";
    UserRole["AUDITOR"] = "AUDITOR";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "ACTIVE";
    UserStatus["INACTIVE"] = "INACTIVE";
    UserStatus["SUSPENDED"] = "SUSPENDED";
    UserStatus["PENDING_VERIFICATION"] = "PENDING_VERIFICATION";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var CaseStatus;
(function (CaseStatus) {
    CaseStatus["OPEN"] = "OPEN";
    CaseStatus["UNDER_INVESTIGATION"] = "UNDER_INVESTIGATION";
    CaseStatus["CHARGE_SHEET_FILED"] = "CHARGE_SHEET_FILED";
    CaseStatus["TRIAL_IN_PROGRESS"] = "TRIAL_IN_PROGRESS";
    CaseStatus["JUDGMENT_RESERVED"] = "JUDGMENT_RESERVED";
    CaseStatus["DISPOSED"] = "DISPOSED";
    CaseStatus["APPEALED"] = "APPEALED";
    CaseStatus["CLOSED"] = "CLOSED";
})(CaseStatus || (exports.CaseStatus = CaseStatus = {}));
var CasePriority;
(function (CasePriority) {
    CasePriority["LOW"] = "LOW";
    CasePriority["MEDIUM"] = "MEDIUM";
    CasePriority["HIGH"] = "HIGH";
    CasePriority["CRITICAL"] = "CRITICAL";
})(CasePriority || (exports.CasePriority = CasePriority = {}));
var DocumentType;
(function (DocumentType) {
    DocumentType["FIR"] = "FIR";
    DocumentType["INVESTIGATION_RECORD"] = "INVESTIGATION_RECORD";
    DocumentType["WITNESS_STATEMENT"] = "WITNESS_STATEMENT";
    DocumentType["CHARGE_SHEET"] = "CHARGE_SHEET";
    DocumentType["COURT_FILING"] = "COURT_FILING";
    DocumentType["EVIDENCE_RECORD"] = "EVIDENCE_RECORD";
    DocumentType["FORENSIC_REPORT"] = "FORENSIC_REPORT";
    DocumentType["LEGAL_NOTICE"] = "LEGAL_NOTICE";
    DocumentType["JUDGMENT"] = "JUDGMENT";
    DocumentType["ORDER"] = "ORDER";
    DocumentType["SUMMONS"] = "SUMMONS";
    DocumentType["WARRANT"] = "WARRANT";
    DocumentType["BAIL_APPLICATION"] = "BAIL_APPLICATION";
    DocumentType["AFFIDAVIT"] = "AFFIDAVIT";
    DocumentType["EXHIBIT_LIST"] = "EXHIBIT_LIST";
    DocumentType["SEIZURE_MEMO"] = "SEIZURE_MEMO";
    DocumentType["PANCHNAMA"] = "PANCHNAMA";
    DocumentType["CASE_DIARY"] = "CASE_DIARY";
    DocumentType["OTHER"] = "OTHER";
})(DocumentType || (exports.DocumentType = DocumentType = {}));
var DocumentStatus;
(function (DocumentStatus) {
    DocumentStatus["DRAFT"] = "DRAFT";
    DocumentStatus["SUBMITTED"] = "SUBMITTED";
    DocumentStatus["VERIFIED"] = "VERIFIED";
    DocumentStatus["APPROVED"] = "APPROVED";
    DocumentStatus["REJECTED"] = "REJECTED";
    DocumentStatus["ARCHIVED"] = "ARCHIVED";
    DocumentStatus["REDACTED"] = "REDACTED";
})(DocumentStatus || (exports.DocumentStatus = DocumentStatus = {}));
var EvidenceType;
(function (EvidenceType) {
    EvidenceType["DIGITAL"] = "DIGITAL";
    EvidenceType["PHYSICAL"] = "PHYSICAL";
    EvidenceType["DOCUMENTARY"] = "DOCUMENTARY";
    EvidenceType["BIOLOGICAL"] = "BIOLOGICAL";
    EvidenceType["CHEMICAL"] = "CHEMICAL";
    EvidenceType["FIREARM"] = "FIREARM";
    EvidenceType["VEHICLE"] = "VEHICLE";
    EvidenceType["ELECTRONIC_DEVICE"] = "ELECTRONIC_DEVICE";
    EvidenceType["FINANCIAL_RECORD"] = "FINANCIAL_RECORD";
    EvidenceType["OTHER"] = "OTHER";
})(EvidenceType || (exports.EvidenceType = EvidenceType = {}));
var EvidenceStatus;
(function (EvidenceStatus) {
    EvidenceStatus["SEIZED"] = "SEIZED";
    EvidenceStatus["IN_CUSTODY"] = "IN_CUSTODY";
    EvidenceStatus["SENT_FOR_ANALYSIS"] = "SENT_FOR_ANALYSIS";
    EvidenceStatus["UNDER_ANALYSIS"] = "UNDER_ANALYSIS";
    EvidenceStatus["ANALYSIS_COMPLETE"] = "ANALYSIS_COMPLETE";
    EvidenceStatus["PRESENTED_IN_COURT"] = "PRESENTED_IN_COURT";
    EvidenceStatus["RETURNED"] = "RETURNED";
    EvidenceStatus["DISPOSED"] = "DISPOSED";
    EvidenceStatus["DESTROYED"] = "DESTROYED";
})(EvidenceStatus || (exports.EvidenceStatus = EvidenceStatus = {}));
var CustodyAction;
(function (CustodyAction) {
    CustodyAction["UPLOAD"] = "UPLOAD";
    CustodyAction["ACCESS"] = "ACCESS";
    CustodyAction["TRANSFER"] = "TRANSFER";
    CustodyAction["REDACTION"] = "REDACTION";
    CustodyAction["EXPORT"] = "EXPORT";
    CustodyAction["VERSION_CREATE"] = "VERSION_CREATE";
    CustodyAction["METADATA_UPDATE"] = "METADATA_UPDATE";
    CustodyAction["VERIFICATION"] = "VERIFICATION";
    CustodyAction["SIGNATURE_APPLY"] = "SIGNATURE_APPLY";
    CustodyAction["SEIZURE"] = "SEIZURE";
    CustodyAction["HANDOVER"] = "HANDOVER";
    CustodyAction["RECEIVE"] = "RECEIVE";
    CustodyAction["ANALYSIS_START"] = "ANALYSIS_START";
    CustodyAction["ANALYSIS_COMPLETE"] = "ANALYSIS_COMPLETE";
    CustodyAction["COURT_SUBMISSION"] = "COURT_SUBMISSION";
    CustodyAction["COURT_RETURN"] = "COURT_RETURN";
    CustodyAction["DISPOSAL"] = "DISPOSAL";
    // New custody actions for collaboration and asset lifecycle
    CustodyAction["HANDOFF_INITIATED"] = "HANDOFF_INITIATED";
    CustodyAction["HANDOFF_ACCEPTED"] = "HANDOFF_ACCEPTED";
    CustodyAction["HANDOFF_DECLINED"] = "HANDOFF_DECLINED";
    CustodyAction["HANDOFF_COMPLETED"] = "HANDOFF_COMPLETED";
    CustodyAction["ASSET_SEIZED"] = "ASSET_SEIZED";
    CustodyAction["ASSET_STATE_TRANSITION"] = "ASSET_STATE_TRANSITION";
    CustodyAction["DISPOSAL_APPROVAL_REQUESTED"] = "DISPOSAL_APPROVAL_REQUESTED";
    CustodyAction["DISPOSAL_APPROVED"] = "DISPOSAL_APPROVED";
    CustodyAction["DISPOSAL_REJECTED"] = "DISPOSAL_REJECTED";
})(CustodyAction || (exports.CustodyAction = CustodyAction = {}));
var ConsensusStatus;
(function (ConsensusStatus) {
    ConsensusStatus["PENDING"] = "PENDING";
    ConsensusStatus["ENDORSED"] = "ENDORSED";
    ConsensusStatus["COMMITTED"] = "COMMITTED";
    ConsensusStatus["REJECTED"] = "REJECTED";
    ConsensusStatus["FAILED"] = "FAILED";
})(ConsensusStatus || (exports.ConsensusStatus = ConsensusStatus = {}));
var NodeType;
(function (NodeType) {
    NodeType["OFFICER_NODE"] = "OFFICER_NODE";
    NodeType["FORENSIC_LAB_NODE"] = "FORENSIC_LAB_NODE";
    NodeType["COURT_NODE"] = "COURT_NODE";
    NodeType["CENTRAL_AUDIT_NODE"] = "CENTRAL_AUDIT_NODE";
})(NodeType || (exports.NodeType = NodeType = {}));
var SignatureType;
(function (SignatureType) {
    SignatureType["DSC"] = "DSC";
    SignatureType["AADHAAR_ESIGN"] = "AADHAAR_ESIGN";
    SignatureType["DIGITAL_SIGNATURE"] = "DIGITAL_SIGNATURE";
    SignatureType["BIOMETRIC"] = "BIOMETRIC";
})(SignatureType || (exports.SignatureType = SignatureType = {}));
var PermissionLevel;
(function (PermissionLevel) {
    PermissionLevel["READ"] = "READ";
    PermissionLevel["WRITE"] = "WRITE";
    PermissionLevel["DELETE"] = "DELETE";
    PermissionLevel["ADMIN"] = "ADMIN";
    PermissionLevel["SIGN"] = "SIGN";
    PermissionLevel["VERIFY"] = "VERIFY";
    PermissionLevel["EXPORT"] = "EXPORT";
    PermissionLevel["REDACT"] = "REDACT";
})(PermissionLevel || (exports.PermissionLevel = PermissionLevel = {}));
// ============================================================================
// COLLABORATION ENUMS
// ============================================================================
var ActivityType;
(function (ActivityType) {
    ActivityType["CUSTODY_EVENT"] = "CUSTODY_EVENT";
    ActivityType["COMMENT"] = "COMMENT";
    ActivityType["STATUS_CHANGE"] = "STATUS_CHANGE";
    ActivityType["HANDOFF_INITIATED"] = "HANDOFF_INITIATED";
    ActivityType["HANDOFF_ACCEPTED"] = "HANDOFF_ACCEPTED";
    ActivityType["HANDOFF_DECLINED"] = "HANDOFF_DECLINED";
    ActivityType["HANDOFF_COMPLETED"] = "HANDOFF_COMPLETED";
    ActivityType["DOCUMENT_UPLOADED"] = "DOCUMENT_UPLOADED";
    ActivityType["DOCUMENT_VERSION"] = "DOCUMENT_VERSION";
    ActivityType["DOCUMENT_REDACTED"] = "DOCUMENT_REDACTED";
    ActivityType["EVIDENCE_SEIZED"] = "EVIDENCE_SEIZED";
    ActivityType["EVIDENCE_TRANSFERRED"] = "EVIDENCE_TRANSFERRED";
    ActivityType["EVIDENCE_LAB_SUBMITTED"] = "EVIDENCE_LAB_SUBMITTED";
    ActivityType["EVIDENCE_LAB_RESULT"] = "EVIDENCE_LAB_RESULT";
    ActivityType["EVIDENCE_COURT_SUBMITTED"] = "EVIDENCE_COURT_SUBMITTED";
    ActivityType["EVIDENCE_DISPOSED"] = "EVIDENCE_DISPOSED";
    ActivityType["CASE_ASSIGNED"] = "CASE_ASSIGNED";
    ActivityType["CASE_UNASSIGNED"] = "CASE_UNASSIGNED";
    ActivityType["BSA_CERTIFICATE_GENERATED"] = "BSA_CERTIFICATE_GENERATED";
    ActivityType["RTI_REQUESTED"] = "RTI_REQUESTED";
    ActivityType["RTI_RESPONDED"] = "RTI_RESPONDED";
    ActivityType["RTI_DENIED"] = "RTI_DENIED";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
var ActivityVisibility;
(function (ActivityVisibility) {
    ActivityVisibility["ALL_ASSIGNED"] = "ALL_ASSIGNED";
    ActivityVisibility["ROLE_SPECIFIC"] = "ROLE_SPECIFIC";
    ActivityVisibility["PRIVATE"] = "PRIVATE";
})(ActivityVisibility || (exports.ActivityVisibility = ActivityVisibility = {}));
var HandoffType;
(function (HandoffType) {
    HandoffType["CASE_HANDOFF"] = "CASE_HANDOFF";
    HandoffType["DOCUMENT_HANDOFF"] = "DOCUMENT_HANDOFF";
    HandoffType["EVIDENCE_HANDOFF"] = "EVIDENCE_HANDOFF";
    HandoffType["CASE_ASSIGNMENT"] = "CASE_ASSIGNMENT";
    HandoffType["DOCUMENT_ASSIGNMENT"] = "DOCUMENT_ASSIGNMENT";
    HandoffType["EVIDENCE_ASSIGNMENT"] = "EVIDENCE_ASSIGNMENT";
})(HandoffType || (exports.HandoffType = HandoffType = {}));
var HandoffStatus;
(function (HandoffStatus) {
    HandoffStatus["PENDING"] = "PENDING";
    HandoffStatus["ACCEPTED"] = "ACCEPTED";
    HandoffStatus["DECLINED"] = "DECLINED";
    HandoffStatus["EXPIRED"] = "EXPIRED";
    HandoffStatus["COMPLETED"] = "COMPLETED";
    HandoffStatus["CANCELLED"] = "CANCELLED";
})(HandoffStatus || (exports.HandoffStatus = HandoffStatus = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["HANDOFF_REQUEST"] = "HANDOFF_REQUEST";
    NotificationType["HANDOFF_ACCEPTED"] = "HANDOFF_ACCEPTED";
    NotificationType["HANDOFF_DECLINED"] = "HANDOFF_DECLINED";
    NotificationType["HANDOFF_EXPIRED"] = "HANDOFF_EXPIRED";
    NotificationType["ACTIVITY_MENTION"] = "ACTIVITY_MENTION";
    NotificationType["CASE_UPDATE"] = "CASE_UPDATE";
    NotificationType["DEADLINE_REMINDER"] = "DEADLINE_REMINDER";
    NotificationType["DISPOSAL_APPROVAL_REQUEST"] = "DISPOSAL_APPROVAL_REQUEST";
    NotificationType["DISPOSAL_APPROVED"] = "DISPOSAL_APPROVED";
    NotificationType["DISPOSAL_REJECTED"] = "DISPOSAL_REJECTED";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
// ============================================================================
// ASSET LIFECYCLE ENUMS
// ============================================================================
var AssetState;
(function (AssetState) {
    AssetState["SEIZED"] = "SEIZED";
    AssetState["STORED"] = "STORED";
    AssetState["TRANSFERRED"] = "TRANSFERRED";
    AssetState["DISPOSED"] = "DISPOSED";
    AssetState["REPORTED_LOST"] = "REPORTED_LOST";
    AssetState["REPORTED_DAMAGED"] = "REPORTED_DAMAGED";
})(AssetState || (exports.AssetState = AssetState = {}));
var AssetCategory;
(function (AssetCategory) {
    AssetCategory["DOCUMENTARY"] = "DOCUMENTARY";
    AssetCategory["BIOLOGICAL"] = "BIOLOGICAL";
    AssetCategory["CHEMICAL"] = "CHEMICAL";
    AssetCategory["FIREARM"] = "FIREARM";
    AssetCategory["VEHICLE"] = "VEHICLE";
    AssetCategory["ELECTRONIC_DEVICE"] = "ELECTRONIC_DEVICE";
    AssetCategory["FINANCIAL_RECORD"] = "FINANCIAL_RECORD";
    AssetCategory["DRUGS_NARCOTICS"] = "DRUGS_NARCOTICS";
    AssetCategory["CURRENCY"] = "CURRENCY";
    AssetCategory["JEWELRY_VALUABLES"] = "JEWELRY_VALUABLES";
    AssetCategory["DIGITAL_STORAGE"] = "DIGITAL_STORAGE";
    AssetCategory["CLOTHING_PERSONAL"] = "CLOTHING_PERSONAL";
    AssetCategory["WEAPON_NON_FIREARM"] = "WEAPON_NON_FIREARM";
    AssetCategory["TOOL_EQUIPMENT"] = "TOOL_EQUIPMENT";
    AssetCategory["OTHER"] = "OTHER";
})(AssetCategory || (exports.AssetCategory = AssetCategory = {}));
var AssetTransition;
(function (AssetTransition) {
    AssetTransition["SEIZED_TO_STORED"] = "SEIZED_TO_STORED";
    AssetTransition["STORED_TO_TRANSFERRED"] = "STORED_TO_TRANSFERRED";
    AssetTransition["STORED_TO_DISPOSED"] = "STORED_TO_DISPOSED";
    AssetTransition["STORED_TO_REPORTED_LOST"] = "STORED_TO_REPORTED_LOST";
    AssetTransition["STORED_TO_REPORTED_DAMAGED"] = "STORED_TO_REPORTED_DAMAGED";
    AssetTransition["TRANSFERRED_TO_STORED"] = "TRANSFERRED_TO_STORED";
    AssetTransition["TRANSFERRED_TO_DISPOSED"] = "TRANSFERRED_TO_DISPOSED";
    AssetTransition["TRANSFERRED_TO_REPORTED_LOST"] = "TRANSFERRED_TO_REPORTED_LOST";
    AssetTransition["TRANSFERRED_TO_REPORTED_DAMAGED"] = "TRANSFERRED_TO_REPORTED_DAMAGED";
    AssetTransition["REPORTED_LOST_TO_STORED"] = "REPORTED_LOST_TO_STORED";
    AssetTransition["REPORTED_DAMAGED_TO_STORED"] = "REPORTED_DAMAGED_TO_STORED";
    AssetTransition["REPORTED_LOST_TO_DISPOSED"] = "REPORTED_LOST_TO_DISPOSED";
    AssetTransition["REPORTED_DAMAGED_TO_DISPOSED"] = "REPORTED_DAMAGED_TO_DISPOSED";
})(AssetTransition || (exports.AssetTransition = AssetTransition = {}));
var DisposalApprovalStatus;
(function (DisposalApprovalStatus) {
    DisposalApprovalStatus["PENDING"] = "PENDING";
    DisposalApprovalStatus["APPROVED"] = "APPROVED";
    DisposalApprovalStatus["REJECTED"] = "REJECTED";
    DisposalApprovalStatus["EXPIRED"] = "EXPIRED";
})(DisposalApprovalStatus || (exports.DisposalApprovalStatus = DisposalApprovalStatus = {}));
(function (HandoffType) {
    HandoffType["CASE_HANDOFF"] = "CASE_HANDOFF";
    HandoffType["DOCUMENT_HANDOFF"] = "DOCUMENT_HANDOFF";
    HandoffType["EVIDENCE_HANDOFF"] = "EVIDENCE_HANDOFF";
    HandoffType["CASE_ASSIGNMENT"] = "CASE_ASSIGNMENT";
    HandoffType["DOCUMENT_ASSIGNMENT"] = "DOCUMENT_ASSIGNMENT";
    HandoffType["EVIDENCE_ASSIGNMENT"] = "EVIDENCE_ASSIGNMENT";
})(HandoffType || (exports.HandoffType = HandoffType = {}));
(function (HandoffStatus) {
    HandoffStatus["PENDING"] = "PENDING";
    HandoffStatus["ACCEPTED"] = "ACCEPTED";
    HandoffStatus["DECLINED"] = "DECLINED";
    HandoffStatus["EXPIRED"] = "EXPIRED";
    HandoffStatus["COMPLETED"] = "COMPLETED";
    HandoffStatus["CANCELLED"] = "CANCELLED";
})(HandoffStatus || (exports.HandoffStatus = HandoffStatus = {}));
(function (NotificationType) {
    NotificationType["HANDOFF_REQUEST"] = "HANDOFF_REQUEST";
    NotificationType["HANDOFF_ACCEPTED"] = "HANDOFF_ACCEPTED";
    NotificationType["HANDOFF_DECLINED"] = "HANDOFF_DECLINED";
    NotificationType["HANDOFF_EXPIRED"] = "HANDOFF_EXPIRED";
    NotificationType["ACTIVITY_MENTION"] = "ACTIVITY_MENTION";
    NotificationType["CASE_UPDATE"] = "CASE_UPDATE";
    NotificationType["DEADLINE_REMINDER"] = "DEADLINE_REMINDER";
    NotificationType["DISPOSAL_APPROVAL_REQUEST"] = "DISPOSAL_APPROVAL_REQUEST";
    NotificationType["DISPOSAL_APPROVED"] = "DISPOSAL_APPROVED";
    NotificationType["DISPOSAL_REJECTED"] = "DISPOSAL_REJECTED";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
//# sourceMappingURL=database.js.map