/**
 * ADALAT360 - Police Asset Lifecycle Models
 * State machine for physical seized assets with explicit transitions
 */
export type AssetState = 'SEIZED' | 'STORED' | 'TRANSFERRED' | 'DISPOSED' | 'REPORTED_LOST' | 'REPORTED_DAMAGED';
export type AssetExceptionState = 'REPORTED_LOST' | 'REPORTED_DAMAGED';
export type AssetTransition = 'SEIZED_TO_STORED' | 'STORED_TO_TRANSFERRED' | 'STORED_TO_DISPOSED' | 'STORED_TO_REPORTED_LOST' | 'STORED_TO_REPORTED_DAMAGED' | 'TRANSFERRED_TO_STORED' | 'TRANSFERRED_TO_DISPOSED' | 'TRANSFERRED_TO_REPORTED_LOST' | 'TRANSFERRED_TO_REPORTED_DAMAGED' | 'REPORTED_LOST_TO_STORED' | 'REPORTED_DAMAGED_TO_STORED' | 'REPORTED_LOST_TO_DISPOSED' | 'REPORTED_DAMAGED_TO_DISPOSED';
export type AssetCategory = 'DOCUMENTARY' | 'BIOLOGICAL' | 'CHEMICAL' | 'FIREARM' | 'VEHICLE' | 'ELECTRONIC_DEVICE' | 'FINANCIAL_RECORD' | 'DRUGS_NARCOTICS' | 'CURRENCY' | 'JEWELRY_VALUABLES' | 'DIGITAL_STORAGE' | 'CLOTHING_PERSONAL' | 'WEAPON_NON_FIREARM' | 'TOOL_EQUIPMENT' | 'OTHER';
/**
 * Valid state transitions for assets
 * Key: from_state, Value: array of valid to_states
 */
export declare const ASSET_STATE_TRANSITIONS: Record<AssetState, AssetState[]>;
export declare const ASSET_TRANSITION_LABELS: Record<AssetTransition, string>;
export interface Asset {
    id: string;
    asset_id: string;
    qr_code_hash: string;
    qr_code_image_url?: string;
    qr_code_payload: string;
    case_id: string;
    case_number: string;
    name: string;
    description?: string;
    category: AssetCategory;
    sub_category?: string;
    current_state: AssetState;
    previous_state?: AssetState;
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
    seized_from?: string;
    panchnama_reference?: string;
    seizure_memo_number?: string;
    weight_grams?: number;
    dimensions_cm?: {
        length: number;
        width: number;
        height: number;
    };
    photographs: string[];
    distinguishing_features?: string;
    serial_number?: string;
    manufacturer?: string;
    model?: string;
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
    forensic_lab_id?: string;
    sent_for_analysis_at?: Date;
    analysis_completed_at?: Date;
    analysis_report_document_id?: string;
    court_exhibit_number?: string;
    presented_in_court_at?: Date;
    disposal_method?: string;
    disposed_at?: Date;
    disposed_by_user_id?: string;
    disposal_witness_user_id?: string;
    disposal_authorization?: string;
    disposal_initiated_by?: string;
    disposal_initiated_at?: Date;
    disposal_approved_by?: string;
    disposal_approved_at?: Date;
    state_history: AssetStateHistoryEntry[];
    custody_ledger_tx_ids: string[];
    metadata: Record<string, any>;
    tags: string[];
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
    custody_ledger_tx_id?: string;
    custody_ledger_block_number?: number;
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
    dimensions_cm?: {
        length: number;
        width: number;
        height: number;
    };
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
export interface AssetQRPayload {
    v: number;
    type: 'ASSET';
    asset_id: string;
    case_id: string;
    state: AssetState;
    verify_url: string;
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
    disposal_authorization: string;
    rejection_reason?: string;
    expires_at: Date;
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}
export interface DisposalApprovalRequest {
    asset_id: string;
    disposal_method: string;
    disposal_authorization: string;
    approved_by: string;
    expires_in_hours?: number;
}
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
    recent_transitions: number;
    pending_disposals: number;
    overdue_assets: number;
}
//# sourceMappingURL=asset-lifecycle.d.ts.map