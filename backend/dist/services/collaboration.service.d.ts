/**
 * ADALAT360 - Collaboration Service
 * Activity feed, handoff/assign actions, real-time notifications
 */
import { ActivityFeedEntry, ActivityFeedQuery, ActivityFeedResponse, Handoff, HandoffCreateRequest, HandoffActionRequest, HandoffQuery, HandoffResponse, Comment, CommentCreateRequest, Notification, NotificationCreateRequest, HandoffPermissions, ActivityFeedPermissions } from '../models/collaboration.js';
export declare class CollaborationService {
    createActivityEntry(entry: Omit<ActivityFeedEntry, 'id' | 'created_at' | 'updated_at'>): Promise<ActivityFeedEntry>;
    logCustodyEventAsActivity(params: {
        case_id: string;
        custody_event: {
            tx_id: string;
            block_number: number;
            tx_type: string;
            actor_user_id: string;
            action_details: Record<string, any>;
            timestamp: Date;
        };
        resource_type?: 'DOCUMENT' | 'EVIDENCE';
        resource_id?: string;
        resource_number?: string;
    }): Promise<void>;
    private getActivityTitle;
    private getActivityDescription;
    queryActivityFeed(query: ActivityFeedQuery, userId: string, userRole: string, userCaseIds: string[]): Promise<ActivityFeedResponse>;
    getActivityEntry(activityId: string): Promise<ActivityFeedEntry | null>;
    createHandoff(request: HandoffCreateRequest, fromUserId: string): Promise<Handoff>;
    private validateResourceAccess;
    private getResourceIdentifier;
    actOnHandoff(handoffId: string, userId: string, action: HandoffActionRequest): Promise<Handoff>;
    cancelHandoff(handoffId: string, userId: string): Promise<Handoff>;
    queryHandoffs(query: HandoffQuery, userId: string, userRole: string, userCaseIds: string[]): Promise<HandoffResponse>;
    getHandoff(handoffId: string, userId: string, userRole: string, userCaseIds: string[]): Promise<Handoff | null>;
    private sendHandoffNotifications;
    private sendHandoffResponseNotifications;
    sendHandoffExpiryNotifications(): Promise<void>;
    createNotification(notification: NotificationCreateRequest): Promise<Notification>;
    getUserNotifications(userId: string, page?: number, limit?: number): Promise<{
        notifications: Notification[];
        total: number;
    }>;
    markNotificationRead(notificationId: string, userId: string): Promise<void>;
    addComment(comment: CommentCreateRequest, authorId: string): Promise<Comment>;
    getCommentsForActivity(activityId: string): Promise<Comment[]>;
    private emitRealtimeEvent;
    getHandoffPermissions(userId: string, caseId: string, userRole: string): Promise<HandoffPermissions>;
    getActivityFeedPermissions(userId: string, caseId: string, userRole: string): Promise<ActivityFeedPermissions>;
}
export declare function getCollaborationService(): CollaborationService;
//# sourceMappingURL=collaboration.service.d.ts.map