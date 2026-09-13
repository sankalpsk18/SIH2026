/**
 * ADALAT360 - Collaboration Models
 * Activity feed, handoff/assign actions for case collaboration
 */
export type ActivityType = 'CUSTODY_EVENT' | 'COMMENT' | 'STATUS_CHANGE' | 'HANDOFF_INITIATED' | 'HANDOFF_ACCEPTED' | 'HANDOFF_DECLINED' | 'HANDOFF_COMPLETED' | 'DOCUMENT_UPLOADED' | 'DOCUMENT_VERSION' | 'DOCUMENT_REDACTED' | 'EVIDENCE_SEIZED' | 'EVIDENCE_TRANSFERRED' | 'EVIDENCE_LAB_SUBMITTED' | 'EVIDENCE_LAB_RESULT' | 'EVIDENCE_COURT_SUBMITTED' | 'EVIDENCE_DISPOSED' | 'CASE_ASSIGNED' | 'CASE_UNASSIGNED' | 'BSA_CERTIFICATE_GENERATED' | 'RTI_REQUESTED' | 'RTI_RESPONDED' | 'RTI_DENIED';
export type ActivityVisibility = 'ALL_ASSIGNED' | 'ROLE_SPECIFIC' | 'PRIVATE';
export interface ActivityFeedEntry {
    id: string;
    case_id: string;
    activity_type: ActivityType;
    title: string;
    description?: string;
    actor_user_id: string;
    actor_name: string;
    actor_role: string;
    actor_department: string;
    document_id?: string;
    document_number?: string;
    evidence_id?: string;
    evidence_number?: string;
    custody_ledger_tx_id?: string;
    handoff_id?: string;
    handoff_from_user_id?: string;
    handoff_to_user_id?: string;
    handoff_from_role?: string;
    handoff_to_role?: string;
    old_status?: string;
    new_status?: string;
    visibility: ActivityVisibility;
    visible_to_roles?: string[];
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}
export interface ActivityFeedQuery {
    case_id: string;
    activity_types?: ActivityType[];
    actor_user_ids?: string[];
    date_from?: Date;
    date_to?: Date;
    visibility?: ActivityVisibility;
    page: number;
    limit: number;
    sort_by?: 'created_at' | 'activity_type';
    sort_order?: 'asc' | 'desc';
}
export interface ActivityFeedResponse {
    entries: ActivityFeedEntry[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}
export type HandoffType = 'CASE_HANDOFF' | 'DOCUMENT_HANDOFF' | 'EVIDENCE_HANDOFF' | 'CASE_ASSIGNMENT' | 'DOCUMENT_ASSIGNMENT' | 'EVIDENCE_ASSIGNMENT';
export type HandoffStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
export interface Handoff {
    id: string;
    case_id: string;
    handoff_type: HandoffType;
    title: string;
    description?: string;
    resource_type: 'CASE' | 'DOCUMENT' | 'EVIDENCE';
    resource_id: string;
    resource_identifier: string;
    from_user_id: string;
    from_user_name: string;
    from_user_role: string;
    from_user_department: string;
    to_user_id: string;
    to_user_name: string;
    to_user_role: string;
    to_user_department: string;
    status: HandoffStatus;
    accepted_at?: Date;
    accepted_by?: string;
    declined_at?: Date;
    declined_by?: string;
    decline_reason?: string;
    expires_at: Date;
    custody_ledger_tx_id?: string;
    custody_ledger_block_number?: number;
    notification_sent: boolean;
    notification_sent_at?: Date;
    email_sent: boolean;
    sms_sent: boolean;
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
    completed_at?: Date;
}
export interface HandoffCreateRequest {
    case_id: string;
    handoff_type: HandoffType;
    title: string;
    description?: string;
    resource_type: 'CASE' | 'DOCUMENT' | 'EVIDENCE';
    resource_id: string;
    to_user_id: string;
    expires_in_hours?: number;
    metadata?: Record<string, any>;
}
export interface HandoffActionRequest {
    action: 'ACCEPT' | 'DECLINE';
    reason?: string;
}
export interface HandoffQuery {
    case_id?: string;
    status?: HandoffStatus[];
    handoff_type?: HandoffType[];
    from_user_id?: string;
    to_user_id?: string;
    page: number;
    limit: number;
}
export interface HandoffResponse {
    handoffs: Handoff[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}
export interface RealtimeEvent {
    type: 'ACTIVITY_FEED_UPDATE' | 'HANDOFF_UPDATE' | 'NOTIFICATION';
    payload: any;
    case_id?: string;
    user_ids?: string[];
    timestamp: Date;
}
export interface WebSocketMessage {
    event: string;
    data: any;
    timestamp: string;
}
export interface Notification {
    id: string;
    user_id: string;
    type: 'HANDOFF_REQUEST' | 'HANDOFF_ACCEPTED' | 'HANDOFF_DECLINED' | 'HANDOFF_EXPIRED' | 'ACTIVITY_MENTION' | 'CASE_UPDATE' | 'DEADLINE_REMINDER';
    title: string;
    message: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    case_id?: string;
    handoff_id?: string;
    activity_id?: string;
    channels: ('IN_APP' | 'EMAIL' | 'SMS' | 'PUSH')[];
    read: boolean;
    read_at?: Date;
    metadata: Record<string, any>;
    created_at: Date;
}
export interface NotificationCreateRequest {
    user_id: string;
    type: Notification['type'];
    title: string;
    message: string;
    priority?: Notification['priority'];
    case_id?: string;
    handoff_id?: string;
    activity_id?: string;
    channels?: Notification['channels'];
    metadata?: Record<string, any>;
}
export interface Comment {
    id: string;
    case_id: string;
    activity_id: string;
    author_user_id: string;
    author_name: string;
    author_role: string;
    content: string;
    parent_comment_id?: string;
    mentioned_user_ids?: string[];
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
    deleted_at?: Date;
}
export interface CommentCreateRequest {
    case_id: string;
    activity_id: string;
    content: string;
    parent_comment_id?: string;
    mentioned_user_ids?: string[];
}
export interface HandoffPermissions {
    can_initiate_handoff: boolean;
    can_accept_handoff: boolean;
    can_decline_handoff: boolean;
    can_cancel_handoff: boolean;
    can_view_handoff: boolean;
}
export interface ActivityFeedPermissions {
    can_view: boolean;
    can_comment: boolean;
    can_create_activity: boolean;
}
//# sourceMappingURL=collaboration.d.ts.map