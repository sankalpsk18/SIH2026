/**
 * ADALAT360 - Police Asset Lifecycle Models
 * State machine for physical seized assets with explicit transitions
 */

import { CustodyAction } from '../types/database.js';

// ============================================================================
// ASSET STATE MACHINE
// ============================================================================

export type AssetState =
  | 'SEIZED'
  | 'STORED'
  | 'TRANSFERRED'
  | 'DISPOSED'
  | 'REPORTED_LOST'
  | 'REPORTED_DAMAGED';

export type AssetExceptionState =
  | 'REPORTED_LOST'
  | 'REPORTED_DAMAGED';

export type AssetTransition =
  | 'SEIZED_TO_STORED'
  | 'STORED_TO_TRANSFERRED'
  | 'STORED_TO_DISPOSED'
  | 'STORED_TO_REPORTED_LOST'
  | 'STORED_TO_REPORTED_DAMAGED'
  | 'TRANSFERRED_TO_STORED'
  | 'TRANSFERRED_TO_DISPOSED'
  | 'TRANSFERRED_TO_REPORTED_LOST'
  | 'TRANSFERRED_TO_REPORTED_DAMAGED'
  | 'REPORTED_LOST_TO_STORED'      // Recovery
  | 'REPORTED_DAMAGED_TO_STORED'   // Repair
  | 'REPORTED_LOST_TO_DISPOSED'    // Legal disposal after loss
  | 'REPORTED_DAMAGED_TO_DISPOSED'; // Legal disposal after damage

export type AssetCategory =
  | 'DOCUMENTARY'
  | 'BIOLOGICAL'
  | 'CHEMICAL'
  | 'FIREARM'
  | 'VEHICLE'
  | 'ELECTRONIC_DEVICE'
  | 'FINANCIAL_RECORD'
  | 'DRUGS_NARCOTICS'
  | 'CURRENCY'
  | 'JEWELRY_VALUABLES'
  | 'DIGITAL_STORAGE'
  | 'CLOTHING_PERSONAL'
  | 'WEAPON_NON_FIREARM'
  | 'TOOL_EQUIPMENT'
  | 'OTHER';

// ============================================================================
// TRANSITION VALIDATION TABLE
// ============================================================================

/**
 * Valid state transitions for assets
 * Key: from_state, Value: array of valid to_states
 */
export const ASSET_STATE_TRANSITIONS: Record<AssetState, AssetState[]> = {
  SEIZED: ['STORED'],
  STORED: ['TRANSFERRED', 'DISPOSED', 'REPORTED_LOST', 'REPORTED_DAMAGED'],
  TRANSFERRED: ['STORED', 'DISPOSED', 'REPORTED_LOST', 'REPORTED_DAMAGED'],
  DISPOSED: [], // Terminal state
  REPORTED_LOST: ['STORED', 'DISPOSED'], // Recovery or legal disposal
  REPORTED_DAMAGED: ['STORED', 'DISPOSED'], // Repair or legal disposal
};

export const ASSET_TRANSITION_LABELS: Record<AssetTransition, string> = {
  SEIZED_TO_STORED: 'Seized to Stored',
  STORED_TO_TRANSFERRED: 'Stored to Transferred',
  STORED_TO_DISPOSED: 'Stored to Disposed',
  STORED_TO_REPORTED_LOST: 'Stored to Reported Lost',
  STORED_TO_REPORTED_DAMAGED: 'Stored to Reported Damaged',
  TRANSFERRED_TO_STORED: 'Transferred to Stored',
  TRANSFERRED_TO_DISPOSED: 'Transferred to Disposed',
  TRANSFERRED_TO_REPORTED_LOST: 'Transferred to Reported Lost',
  TRANSFERRED_TO_REPORTED_DAMAGED: 'Transferred to Reported Damaged',
  REPORTED_LOST_TO_STORED: 'Lost Asset Recovered',
  REPORTED_DAMAGED_TO_STORED: 'Damaged Asset Repaired',
  REPORTED_LOST_TO_DISPOSED: 'Lost Asset Disposed',
  REPORTED_DAMAGED_TO_DISPOSED: 'Damaged Asset Disposed',
};

// ============================================================================
// ASSET CORE TYPES
// ============================================================================

export interface Asset {
  id: string;
  asset_id: string; // Human-readable ID: AST/CASE/YYYY/NNNNN
  qr_code_hash: string;
  qr_code_image_url?: string;
  qr_code_payload: string; // JSON string for QR code
  case_id: string;
  case_number: string;
  name: string;
  description?: string;
  category: AssetCategory;
  sub_category?: string;
  // State machine
  current_state: AssetState;
  previous_state?: AssetState;
  // Seizure info
  seized_at: Date;
  seized_by_user_id: string;
  seized_by_name: string;
  seized_by_role: string;
  seized_location: {
    address: string;
    latitude?: number;
    longitude?: number;
    landmark?: string;
  };
  seized_from?: string; // Person/place seized from
  panchnama_reference?: string;
  seizure_memo_number?: string;
  // Physical properties
  weight_grams?: number;
  dimensions_cm?: { length: number; width: number; height: number };
  photographs: string[]; // URLs
  distinguishing_features?: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  // Current custody
  current_holder_user_id?: string;
  current_holder_name?: string;
  current_holder_role?: string;
  current_holder_department?: string;
  current_location?: {
    facility: string;
    room?: string;
    shelf?: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  container_seal_number?: string;
  seal_intact?: boolean;
  storage_condition?: string;
  // Forensic
  forensic_lab_id?: string;
  sent_for_analysis_at?: Date;
  analysis_completed_at?: Date;
  analysis_report_document_id?: string;
  // Court
  court_exhibit_number?: string;
  presented_in_court_at?: Date;
  // Disposal
  disposal_method?: string;
  disposed_at?: Date;
  disposed_by_user_id?: string;
  disposal_witness_user_id?: string;
  disposal_authorization?: string; // Reference to authorization document
  // Maker-checker for disposal
  disposal_initiated_by?: string;
  disposal_initiated_at?: Date;
  disposal_approved_by?: string;
  disposal_approved_at?: Date;
  // State history
  state_history: AssetStateHistoryEntry[];
  // Blockchain integration
  custody_ledger_tx_ids: string[]; // All custody ledger TX IDs for this asset
  // Metadata
  metadata: Record<string, any>;
  tags: string[];
  // Timestamps
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface AssetStateHistoryEntry {
  id: string;
  asset_id: string;
  from_state?: AssetState;
  to_state: AssetState;
  transition: AssetTransition;
  actor_user_id: string;
  actor_name: string;
  actor_role: string;
  actor_department: string;
  location?: {
    facility: string;
    room?: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  seal_number?: string;
  seal_intact?: boolean;
  condition_notes?: string;
  witness_user_id?: string;
  witness_name?: string;
  // Blockchain
  custody_ledger_tx_id?: string;
  custody_ledger_block_number?: number;
  // Metadata
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface AssetCreateRequest {
  case_id: string;
  name: string;
  description?: string;
  category: AssetCategory;
  sub_category?: string;
  seized_at: Date;
  seized_by_user_id: string;
  seized_location: {
    address: string;
    latitude?: number;
    longitude?: number;
    landmark?: string;
  };
  seized_from?: string;
  panchnama_reference?: string;
  seizure_memo_number?: string;
  weight_grams?: number;
  dimensions_cm?: { length: number; width: number; height: number };
  photographs?: string[];
  distinguishing_features?: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  current_location?: {
    facility: string;
    room?: string;
    shelf?: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  container_seal_number?: string;
  seal_intact?: boolean;
  storage_condition?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface AssetStateTransitionRequest {
  asset_id: string;
  to_state: AssetState;
  actor_user_id: string;
  location?: {
    facility: string;
    room?: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  seal_number?: string;
  seal_intact?: boolean;
  condition_notes?: string;
  witness_user_id?: string;
  metadata?: Record<string, any>;
  // For disposal: maker-checker
  disposal_initiated_by?: string;
  disposal_approved_by?: string;
  disposal_authorization?: string;
}

export interface AssetQuery {
  case_id?: string;
  current_state?: AssetState[];
  category?: AssetCategory[];
  seized_by_user_id?: string;
  current_holder_user_id?: string;
  date_from?: Date;
  date_to?: Date;
  search?: string;
  page: number;
  limit: number;
}

export interface AssetResponse {
  assets: Asset[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ============================================================================
// QR CODE TYPES
// ============================================================================

export interface AssetQRPayload {
  v: number; // Version
  type: 'ASSET';
  asset_id: string;
  case_id: string;
  state: AssetState;
  verify_url: string; // URL to verify asset on ADALAT360
}

export interface AssetQRScanResult {
  asset: Asset;
  state_history: AssetStateHistoryEntry[];
  linked_documents: Array<{
    id: string;
    document_number: string;
    title: string;
    document_type: string;
  }>;
  linked_evidence: Array<{
    id: string;
    evidence_number: string;
    name: string;
  }>;
  custody_ledger_summary: {
    total_events: number;
    latest_event: {
      tx_id: string;
      timestamp: Date;
      action: string;
      actor: string;
    } | null;
  };
}

// ============================================================================
// DISPOSAL MAKER-CHECKER
// ============================================================================

export interface DisposalApproval {
  id: string;
  asset_id: string;
  initiated_by: string;
  initiated_by_name: string;
  initiated_at: Date;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  disposal_method: string;
  disposal_authorization: string; // Document reference
  rejection_reason?: string;
  expires_at: Date; // Approval request expiry
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface DisposalApprovalRequest {
  asset_id: string;
  disposal_method: string;
  disposal_authorization: string;
  approved_by: string; // User ID of approver
  expires_in_hours?: number; // Default 48 hours
}

// ============================================================================
// ASSET STATISTICS
// ============================================================================

export interface AssetStatistics {
  case_id?: string;
  total_assets: number;
  by_state: Record<AssetState, number>;
  by_category: Record<AssetCategory, number>;
  by_holder: Array<{
    user_id: string;
    name: string;
    count: number;
  }>;
  recent_transitions: number; // Last 24 hours
  pending_disposals: number;
  overdue_assets: number; // Assets in STORED/TRANSFERRED for > 90 days
}