/**
 * ADALAT360 - Collaboration Service
 * Activity feed, handoff/assign actions, real-time notifications
 */

import { v4 as uuidv4 } from 'uuid';
import { pgQuery, pgTransaction } from '../config/database.js';
import { getMongoDb } from '../config/database.js';
import { getBlockchainService } from '../blockchain/blockchain.service.js';
import { CustodyAction, ConsensusStatus } from '../types/database.js';
import { logAuditEvent, logBlockchainEvent } from './audit.service.js';
import {
    ActivityType,
    ActivityVisibility,
    ActivityFeedEntry,
    ActivityFeedQuery,
    ActivityFeedResponse,
    Handoff,
    HandoffType,
    HandoffStatus,
    HandoffCreateRequest,
    HandoffActionRequest,
    HandoffQuery,
    HandoffResponse,
    Comment,
    CommentCreateRequest,
    Notification,
    NotificationCreateRequest,
    HandoffPermissions,
    ActivityFeedPermissions,
    RealtimeEvent,
} from '../models/collaboration.js';
import { logAnomalyDetected } from './audit.service.js';

// ============================================================================
// COLLABORATION SERVICE CLASS
// ============================================================================

export class CollaborationService {
    // ========================================================================
    // ACTIVITY FEED
    // ========================================================================

    async createActivityEntry(entry: Omit<ActivityFeedEntry, 'id' | 'created_at' | 'updated_at'>): Promise<ActivityFeedEntry> {
        const id = uuidv4();
        const now = new Date();

        const activityEntry: ActivityFeedEntry = {
            ...entry,
            id,
            created_at: now,
            updated_at: now,
        };

        // Store in MongoDB for flexible querying
        const mongoDb = await getMongoDb();
        await mongoDb.collection('activity_feed').insertOne(activityEntry);

        // Also store in PostgreSQL for relational queries
        await pgQuery(
            `INSERT INTO activity_feed (
                id, case_id, activity_type, title, description, actor_user_id,
                actor_name, actor_role, actor_department, document_id, document_number,
                evidence_id, evidence_number, custody_ledger_tx_id, handoff_id,
                handoff_from_user_id, handoff_to_user_id, handoff_from_role, handoff_to_role,
                old_status, new_status, visibility, visible_to_roles, metadata, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
            [
                id, entry.case_id, entry.activity_type, entry.title, entry.description,
                entry.actor_user_id, entry.actor_name, entry.actor_role, entry.actor_department,
                entry.document_id, entry.document_number, entry.evidence_id, entry.evidence_number,
                entry.custody_ledger_tx_id, entry.handoff_id, entry.handoff_from_user_id,
                entry.handoff_to_user_id, entry.handoff_from_role, entry.handoff_to_role,
                entry.old_status, entry.new_status, entry.visibility,
                JSON.stringify(entry.visible_to_roles || []),
                JSON.stringify(entry.metadata || {}),
                now, now,
            ]
        );

        // Emit real-time event
        await this.emitRealtimeEvent({
            type: 'ACTIVITY_FEED_UPDATE',
            payload: activityEntry,
            case_id: entry.case_id,
            timestamp: now,
        });

        return activityEntry;
    }

    async logCustodyEventAsActivity(params: {
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
    }): Promise<void> {
        const { case_id, custody_event, resource_type, resource_id, resource_number } = params;

        const activityTypeMap: Record<string, ActivityType> = {
            'UPLOAD': 'DOCUMENT_UPLOADED',
            'VERSION_CREATE': 'DOCUMENT_VERSION',
            'REDACTION': 'DOCUMENT_REDACTED',
            'SEIZURE': 'EVIDENCE_SEIZED',
            'TRANSFER': 'EVIDENCE_TRANSFERRED',
            'HANDOVER': 'EVIDENCE_TRANSFERRED',
            'RECEIVE': 'EVIDENCE_TRANSFERRED',
            'ANALYSIS_START': 'EVIDENCE_LAB_SUBMITTED',
            'ANALYSIS_COMPLETE': 'EVIDENCE_LAB_RESULT',
            'COURT_SUBMISSION': 'EVIDENCE_COURT_SUBMITTED',
            'COURT_RETURN': 'EVIDENCE_COURT_SUBMITTED',
            'DISPOSAL': 'EVIDENCE_DISPOSED',
            'SIGNATURE_APPLY': 'BSA_CERTIFICATE_GENERATED',
        };

        const activityType = activityTypeMap[custody_event.tx_type] || 'CUSTODY_EVENT';

        await this.createActivityEntry({
            case_id,
            activity_type: activityType,
            title: this.getActivityTitle(activityType, custody_event.action_details),
            description: this.getActivityDescription(activityType, custody_event.action_details),
            actor_user_id: custody_event.actor_user_id,
            actor_name: custody_event.action_details.actor_name || 'Unknown',
            actor_role: custody_event.action_details.actor_role || 'Unknown',
            actor_department: custody_event.action_details.actor_department || 'Unknown',
            document_id: resource_type === 'DOCUMENT' ? resource_id : undefined,
            document_number: resource_type === 'DOCUMENT' ? resource_number : undefined,
            evidence_id: resource_type === 'EVIDENCE' ? resource_id : undefined,
            evidence_number: resource_type === 'EVIDENCE' ? resource_number : undefined,
            custody_ledger_tx_id: custody_event.tx_id,
            visibility: 'ALL_ASSIGNED',
            metadata: {
                block_number: custody_event.block_number,
                tx_type: custody_event.tx_type,
                action_details: custody_event.action_details,
            },
        });
    }

    private getActivityTitle(type: ActivityType, details: Record<string, any>): string {
        const titles: Record<ActivityType, string> = {
            'CUSTODY_EVENT': `Custody Event: ${details.tx_type || 'Unknown'}`,
            'COMMENT': 'Comment Added',
            'STATUS_CHANGE': `Status Changed to ${details.new_status || 'Unknown'}`,
            'HANDOFF_INITIATED': `Handoff Initiated: ${details.title || 'Resource'}`,
            'HANDOFF_ACCEPTED': `Handoff Accepted: ${details.title || 'Resource'}`,
            'HANDOFF_DECLINED': `Handoff Declined: ${details.title || 'Resource'}`,
            'HANDOFF_COMPLETED': `Handoff Completed: ${details.title || 'Resource'}`,
            'DOCUMENT_UPLOADED': `Document Uploaded: ${details.original_filename || 'New Document'}`,
            'DOCUMENT_VERSION': `New Version Created: v${details.version || '?'}`,
            'DOCUMENT_REDACTED': `Document Redacted`,
            'EVIDENCE_SEIZED': `Evidence Seized: ${details.evidence_number || 'New Evidence'}`,
            'EVIDENCE_TRANSFERRED': `Evidence Transferred: ${details.evidence_number || 'Evidence'}`,
            'EVIDENCE_LAB_SUBMITTED': `Evidence Sent to Lab: ${details.evidence_number || 'Evidence'}`,
            'EVIDENCE_LAB_RESULT': `Lab Results Received: ${details.evidence_number || 'Evidence'}`,
            'EVIDENCE_COURT_SUBMITTED': `Evidence Submitted to Court: ${details.evidence_number || 'Evidence'}`,
            'EVIDENCE_DISPOSED': `Evidence Disposed: ${details.evidence_number || 'Evidence'}`,
            'CASE_ASSIGNED': `Case Assigned: ${details.case_number || 'Case'}`,
            'CASE_UNASSIGNED': `Case Unassigned: ${details.case_number || 'Case'}`,
            'BSA_CERTIFICATE_GENERATED': `BSA Certificate Generated: ${details.certificate_number || 'Certificate'}`,
            'RTI_REQUESTED': `RTI Request Received: ${details.request_number || 'Request'}`,
            'RTI_RESPONDED': `RTI Responded: ${details.request_number || 'Request'}`,
            'RTI_DENIED': `RTI Denied: ${details.request_number || 'Request'}`,
        };
        return titles[type] || 'Activity';
    }

    private getActivityDescription(type: ActivityType, details: Record<string, any>): string {
        switch (type) {
            case 'DOCUMENT_UPLOADED':
                return `Document "${details.original_filename}" (${details.document_type}) uploaded by ${details.actor_name}. Size: ${details.file_size_bytes} bytes.`;
            case 'DOCUMENT_VERSION':
                return `New version ${details.version} created for document ${details.document_number}. Changes: ${details.changes_summary || 'Not specified'}.`;
            case 'EVIDENCE_SEIZED':
                return `Evidence "${details.name}" (${details.evidence_number}) seized from ${details.seized_from} at ${details.seized_location?.address}.`;
            case 'EVIDENCE_TRANSFERRED':
                return `Evidence ${details.evidence_number} transferred from ${details.from_user_name} to ${details.to_user_name}.`;
            case 'EVIDENCE_LAB_SUBMITTED':
                return `Evidence ${details.evidence_number} sent to ${details.forensic_lab_name} for ${details.analysis_type} analysis.`;
            case 'EVIDENCE_LAB_RESULT':
                return `Lab analysis completed for evidence ${details.evidence_number}. Result: ${details.result_summary || 'Completed'}.`;
            case 'EVIDENCE_COURT_SUBMITTED':
                return `Evidence ${details.evidence_number} submitted to court as exhibit ${details.court_exhibit_number}.`;
            case 'EVIDENCE_DISPOSED':
                return `Evidence ${details.evidence_number} disposed via ${details.disposal_method}.`;
            case 'HANDOFF_INITIATED':
                return `Handoff initiated for ${details.resource_type} ${details.resource_identifier} from ${details.from_user_name} to ${details.to_user_name}.`;
            case 'HANDOFF_ACCEPTED':
                return `Handoff accepted by ${details.to_user_name} for ${details.resource_type} ${details.resource_identifier}.`;
            case 'HANDOFF_DECLINED':
                return `Handoff declined by ${details.to_user_name}. Reason: ${details.decline_reason || 'Not specified'}.`;
            case 'HANDOFF_COMPLETED':
                return `Handoff completed for ${details.resource_type} ${details.resource_identifier}.`;
            case 'STATUS_CHANGE':
                return `Status changed from ${details.old_status} to ${details.new_status} for ${details.resource_type} ${details.resource_identifier}.`;
            case 'BSA_CERTIFICATE_GENERATED':
                return `BSA Section 63 certificate ${details.certificate_number} generated for document ${details.document_number}.`;
            case 'RTI_REQUESTED':
                return `RTI request ${details.request_number} received from ${details.applicant_name}.`;
            default:
                return `Activity recorded: ${details.action || 'Unknown'}`;
        }
    }

    async queryActivityFeed(query: ActivityFeedQuery, userId: string, userRole: string, userCaseIds: string[]): Promise<ActivityFeedResponse> {
        const { case_id, activity_types, actor_user_ids, date_from, date_to, visibility, page, limit, sort_by, sort_order } = query;

        // Check case access
        if (!userCaseIds.includes(case_id) && userRole !== 'CENTRAL_ADMIN' && userRole !== 'AUDITOR') {
            throw new Error('Access denied to this case');
        }

        const conditions: string[] = ['case_id = $1'];
        const params: any[] = [case_id];
        let paramIndex = 2;

        if (activity_types && activity_types.length > 0) {
            conditions.push(`activity_type = ANY($${paramIndex++})`);
            params.push(activity_types);
        }
        if (actor_user_ids && actor_user_ids.length > 0) {
            conditions.push(`actor_user_id = ANY($${paramIndex++})`);
            params.push(actor_user_ids);
        }
        if (date_from) {
            conditions.push(`created_at >= $${paramIndex++}`);
            params.push(date_from);
        }
        if (date_to) {
            conditions.push(`created_at <= $${paramIndex++}`);
            params.push(date_to);
        }
        if (visibility) {
            conditions.push(`visibility = $${paramIndex++}`);
            params.push(visibility);
        } else {
            // Default: show ALL_ASSIGNED and ROLE_SPECIFIC where user's role matches
            conditions.push(`(
                visibility = 'ALL_ASSIGNED' OR
                (visibility = 'ROLE_SPECIFIC' AND $${paramIndex} = ANY(visible_to_roles)) OR
                visibility = 'PRIVATE' AND actor_user_id = $${paramIndex + 1}
            )`);
            params.push(userRole);
            params.push(userId);
            paramIndex += 2;
        }

        const whereClause = conditions.join(' AND ');
        const sortBy = sort_by || 'created_at';
        const sortOrder = sort_order || 'desc';
        const offset = (page - 1) * limit;

        params.push(limit, offset);

        const [entriesResult, countResult] = await Promise.all([
            pgQuery(
                `SELECT * FROM activity_feed WHERE ${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
                params
            ),
            pgQuery(
                `SELECT COUNT(*) as total FROM activity_feed WHERE ${whereClause}`,
                params.slice(0, -2)
            ),
        ]);

        return {
            entries: entriesResult.rows,
            total: parseInt(countResult.rows[0].total, 10),
            page,
            limit,
            total_pages: Math.ceil(parseInt(countResult.rows[0].total, 10) / limit),
        };
    }

    async getActivityEntry(activityId: string): Promise<ActivityFeedEntry | null> {
        const result = await pgQuery(
            `SELECT * FROM activity_feed WHERE id = $1`,
            [activityId]
        );
        return result.rows[0] || null;
    }

    // ========================================================================
    // HANDOFF MANAGEMENT
    // ========================================================================

    async createHandoff(request: HandoffCreateRequest, fromUserId: string): Promise<Handoff> {
        return pgTransaction(async (client) => {
            // Validate from_user has access to case and resource
            const caseCheck = await client.query(
                `SELECT 1 FROM cases WHERE id = $1 AND deleted_at IS NULL`,
                [request.case_id]
            );
            if (caseCheck.rows.length === 0) {
                throw new Error('Case not found');
            }

            // Verify from_user has permission to initiate handoff
            const permissionCheck = await client.query(
                `SELECT 1 FROM case_assignments
                 WHERE case_id = $1 AND user_id = $2 AND is_active = TRUE
                 AND 'WRITE' = ANY(permission_level)`,
                [request.case_id, fromUserId]
            );

            // Also check if user is assigned officer, prosecutor, etc.
            const caseRoleCheck = await client.query(
                `SELECT 1 FROM cases
                 WHERE id = $1 AND (
                     assigned_officer_id = $2 OR
                     supervising_officer_id = $2 OR
                     prosecutor_id = $2 OR
                     forensic_lab_id = $2 OR
                     court_id = $2
                 )`,
                [request.case_id, fromUserId]
            );

            if (permissionCheck.rows.length === 0 && caseRoleCheck.rows.length === 0) {
                throw new Error('You do not have permission to initiate handoff for this case');
            }

            // Validate resource exists and belongs to case
            await this.validateResourceAccess(client, request.resource_type, request.resource_id, request.case_id);

            // Get from_user details
            const fromUserResult = await client.query(
                `SELECT full_name, role, department FROM users WHERE id = $1`,
                [fromUserId]
            );
            if (fromUserResult.rows.length === 0) {
                throw new Error('From user not found');
            }
            const fromUser = fromUserResult.rows[0];

            // Get to_user details
            const toUserResult = await client.query(
                `SELECT id, full_name, role, department, email, phone FROM users WHERE id = $1 AND deleted_at IS NULL`,
                [request.to_user_id]
            );
            if (toUserResult.rows.length === 0) {
                throw new Error('Recipient user not found');
            }
            const toUser = toUserResult.rows[0];

            // Verify to_user has access to case (or will be granted via handoff)
            const toUserCaseAccess = await client.query(
                `SELECT 1 FROM case_assignments WHERE case_id = $1 AND user_id = $2 AND is_active = TRUE`,
                [request.case_id, request.to_user_id]
            );

            // If to_user doesn't have access, they'll be granted via handoff acceptance
            // But they must be a valid user in the system

            // Get resource identifier
            const resourceIdentifier = await this.getResourceIdentifier(client, request.resource_type, request.resource_id);

            const handoffId = uuidv4();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + (request.expires_in_hours || 24) * 60 * 60 * 1000);

            const handoff: Handoff = {
                id: handoffId,
                case_id: request.case_id,
                handoff_type: request.handoff_type,
                title: request.title,
                description: request.description,
                resource_type: request.resource_type,
                resource_id: request.resource_id,
                resource_identifier: resourceIdentifier,
                from_user_id: fromUserId,
                from_user_name: fromUser.full_name,
                from_user_role: fromUser.role,
                from_user_department: fromUser.department,
                to_user_id: request.to_user_id,
                to_user_name: toUser.full_name,
                to_user_role: toUser.role,
                to_user_department: toUser.department,
                status: 'PENDING',
                expires_at: expiresAt,
                notification_sent: false,
                email_sent: false,
                sms_sent: false,
                metadata: request.metadata || {},
                created_at: now,
                updated_at: now,
            };

            await client.query(
                `INSERT INTO handoffs (
                    id, case_id, handoff_type, title, description, resource_type,
                    resource_id, resource_identifier, from_user_id, from_user_name,
                    from_user_role, from_user_department, to_user_id, to_user_name,
                    to_user_role, to_user_department, status, expires_at,
                    notification_sent, email_sent, sms_sent, metadata, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
                [
                    handoff.id, handoff.case_id, handoff.handoff_type, handoff.title,
                    handoff.description, handoff.resource_type, handoff.resource_id,
                    handoff.resource_identifier, handoff.from_user_id, handoff.from_user_name,
                    handoff.from_user_role, handoff.from_user_department,
                    handoff.to_user_id, handoff.to_user_name, handoff.to_user_role,
                    handoff.to_user_department, handoff.status, handoff.expires_at,
                    handoff.notification_sent, handoff.email_sent, handoff.sms_sent,
                    JSON.stringify(handoff.metadata), handoff.created_at, handoff.updated_at,
                ]
            );

            // Create custody ledger transaction for handoff initiation
            const blockchainService = getBlockchainService();
            const custodyResult = await blockchainService.recordCustodyEvent({
                txType: 'TRANSFER',
                caseId: request.case_id,
                actorUserId: fromUserId,
                actorNodeId: 'OfficerMSP', // Would come from user context
                actionDetails: {
                    action: 'HANDOFF_INITIATED',
                    handoff_id: handoffId,
                    handoff_type: request.handoff_type,
                    resource_type: request.resource_type,
                    resource_id: request.resource_id,
                    resource_identifier: resourceIdentifier,
                    from_user_id: fromUserId,
                    to_user_id: request.to_user_id,
                },
            });

            // Update handoff with custody ledger TX ID
            await client.query(
                `UPDATE handoffs SET custody_ledger_tx_id = $1, updated_at = NOW() WHERE id = $2`,
                [custodyResult.tx_id, handoffId]
            );

            handoff.custody_ledger_tx_id = custodyResult.tx_id;

            // Create activity feed entry
            await this.createActivityEntry({
                case_id: request.case_id,
                activity_type: 'HANDOFF_INITIATED',
                title: `Handoff Initiated: ${resourceIdentifier}`,
                description: `Handoff initiated for ${request.resource_type} ${resourceIdentifier} from ${fromUser.full_name} to ${toUser.full_name}.`,
                actor_user_id: fromUserId,
                actor_name: fromUser.full_name,
                actor_role: fromUser.role,
                actor_department: fromUser.department,
                handoff_id: handoffId,
                handoff_from_user_id: fromUserId,
                handoff_to_user_id: request.to_user_id,
                handoff_from_role: fromUser.role,
                handoff_to_role: toUser.role,
                visibility: 'ALL_ASSIGNED',
                metadata: {
                    handoff_id: handoffId,
                    handoff_type: request.handoff_type,
                    resource_type: request.resource_type,
                    resource_id: request.resource_id,
                },
            });

            // Send notifications
            await this.sendHandoffNotifications(handoff, toUser, fromUser);

            return handoff;
        });
    }

    private async validateResourceAccess(client: any, resourceType: string, resourceId: string, caseId: string): Promise<void> {
        let table: string;
        switch (resourceType) {
            case 'CASE':
                table = 'cases';
                break;
            case 'DOCUMENT':
                table = 'documents';
                break;
            case 'EVIDENCE':
                table = 'evidence';
                break;
            default:
                throw new Error(`Invalid resource type: ${resourceType}`);
        }

        const result = await client.query(
            `SELECT 1 FROM ${table} WHERE id = $1 AND case_id = $2 AND deleted_at IS NULL`,
            [resourceId, caseId]
        );

        if (result.rows.length === 0) {
            throw new Error(`${resourceType} not found in this case`);
        }
    }

    private async getResourceIdentifier(client: any, resourceType: string, resourceId: string): Promise<string> {
        let query: string;
        let identifierColumn: string;
        switch (resourceType) {
            case 'CASE':
                query = 'SELECT case_number FROM cases WHERE id = $1';
                identifierColumn = 'case_number';
                break;
            case 'DOCUMENT':
                query = 'SELECT document_number FROM documents WHERE id = $1';
                identifierColumn = 'document_number';
                break;
            case 'EVIDENCE':
                query = 'SELECT evidence_number FROM evidence WHERE id = $1';
                identifierColumn = 'evidence_number';
                break;
            default:
                return resourceId;
        }

        const result = await client.query(query, [resourceId]);
        return result.rows[0]?.[identifierColumn] || resourceId;
    }

    async actOnHandoff(handoffId: string, userId: string, action: HandoffActionRequest): Promise<Handoff> {
        return pgTransaction(async (client) => {
            const handoffResult = await client.query(
                `SELECT * FROM handoffs WHERE id = $1`,
                [handoffId]
            );

            if (handoffResult.rows.length === 0) {
                throw new Error('Handoff not found');
            }

            const handoff = handoffResult.rows[0];

            // Verify user is the intended recipient
            if (handoff.to_user_id !== userId) {
                throw new Error('You are not the intended recipient of this handoff');
            }

            // Check if handoff is still pending
            if (handoff.status !== 'PENDING') {
                throw new Error(`Handoff is not in pending status (current: ${handoff.status})`);
            }

            // Check expiry
            if (new Date(handoff.expires_at) < new Date()) {
                // Auto-expire
                await client.query(
                    `UPDATE handoffs SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`,
                    [handoffId]
                );
                throw new Error('Handoff has expired');
            }

            const now = new Date();
            let newStatus: HandoffStatus;
            let custodyActionDetails: Record<string, any> = {};

            if (action.action === 'ACCEPT') {
                newStatus = 'ACCEPTED';
                custodyActionDetails = {
                    action: 'HANDOFF_ACCEPTED',
                    accepted_by: userId,
                };

                // Update case assignments - grant access to receiving user
                await client.query(
                    `INSERT INTO case_assignments (id, case_id, user_id, role_in_case, permission_level, assigned_by, assigned_at, is_active)
                     VALUES ($1,$2,$3,$4,$5,$6,NOW(),TRUE)
                     ON CONFLICT (case_id, user_id, role_in_case) DO UPDATE SET
                        is_active = TRUE,
                        permission_level = GREATEST(permission_level, EXCLUDED.permission_level)`,
                    [uuidv4(), handoff.case_id, handoff.to_user_id, 'HANDOFF_RECIPIENT', ['READ', 'WRITE'], handoff.from_user_id]
                );
            } else if (action.action === 'DECLINE') {
                if (!action.reason) {
                    throw new Error('Decline reason is required');
                }
                newStatus = 'DECLINED';
                custodyActionDetails = {
                    action: 'HANDOFF_DECLINED',
                    declined_by: userId,
                    decline_reason: action.reason,
                };
            } else {
                throw new Error('Invalid action');
            }

            // Update handoff
            await client.query(
                `UPDATE handoffs SET
                    status = $1,
                    ${action.action === 'ACCEPT' ? 'accepted_at = NOW(), accepted_by = $2' : 'declined_at = NOW(), declined_by = $2, decline_reason = $3'},
                    updated_at = NOW()
                 WHERE id = $4`,
                action.action === 'ACCEPT'
                    ? [newStatus, userId, handoffId]
                    : [newStatus, userId, action.reason!, handoffId]
            );

            // Record custody ledger transaction for acceptance/decline
            const blockchainService = getBlockchainService();
            await blockchainService.recordCustodyEvent({
                txType: 'TRANSFER',
                caseId: handoff.case_id,
                actorUserId: userId,
                actorNodeId: 'OfficerMSP',
                actionDetails: {
                    action: action.action === 'ACCEPT' ? 'HANDOFF_ACCEPTED' : 'HANDOFF_DECLINED',
                    handoff_id: handoffId,
                    resource_type: handoff.resource_type,
                    resource_id: handoff.resource_id,
                    resource_identifier: handoff.resource_identifier,
                },
            });

            // Create activity feed entry
            await this.createActivityEntry({
                case_id: handoff.case_id,
                activity_type: action.action === 'ACCEPT' ? 'HANDOFF_ACCEPTED' : 'HANDOFF_DECLINED',
                title: `${action.action === 'ACCEPT' ? 'Handoff Accepted' : 'Handoff Declined'}: ${handoff.resource_identifier}`,
                description: action.action === 'ACCEPT'
                    ? `Handoff accepted by ${handoff.to_user_name} for ${handoff.resource_type} ${handoff.resource_identifier}.`
                    : `Handoff declined by ${handoff.to_user_name}. Reason: ${action.reason}`,
                actor_user_id: userId,
                actor_name: (await client.query('SELECT full_name FROM users WHERE id = $1', [userId])).rows[0]?.full_name || 'Unknown',
                actor_role: (await client.query('SELECT role FROM users WHERE id = $1', [userId])).rows[0]?.role || 'Unknown',
                actor_department: (await client.query('SELECT department FROM users WHERE id = $1', [userId])).rows[0]?.department || 'Unknown',
                handoff_id: handoffId,
                handoff_from_user_id: handoff.from_user_id,
                handoff_to_user_id: userId,
                handoff_from_role: handoff.from_user_role,
                handoff_to_role: (await client.query('SELECT role FROM users WHERE id = $1', [userId])).rows[0]?.role || 'Unknown',
                visibility: 'ALL_ASSIGNED',
                metadata: {
                    handoff_id: handoffId,
                    action: action.action,
                    decline_reason: action.reason,
                },
            });

            // Notify initiator
            await this.sendHandoffResponseNotifications(handoff, action.action === 'ACCEPT', action.reason);

            // Return updated handoff
            const updatedResult = await client.query(`SELECT * FROM handoffs WHERE id = $1`, [handoffId]);
            return updatedResult.rows[0];
        });
    }

    async cancelHandoff(handoffId: string, userId: string): Promise<Handoff> {
        const handoffResult = await pgQuery(`SELECT * FROM handoffs WHERE id = $1`, [handoffId]);
        if (handoffResult.rows.length === 0) {
            throw new Error('Handoff not found');
        }

        const handoff = handoffResult.rows[0];

        // Only initiator can cancel
        if (handoff.from_user_id !== userId) {
            throw new Error('Only the initiator can cancel the handoff');
        }

        if (handoff.status !== 'PENDING') {
            throw new Error('Can only cancel pending handoffs');
        }

        await pgQuery(
            `UPDATE handoffs SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
            [handoffId]
        );

        await this.createActivityEntry({
            case_id: handoff.case_id,
            activity_type: 'HANDOFF_INITIATED', // Could add HANDOFF_CANCELLED type
            title: `Handoff Cancelled: ${handoff.resource_identifier}`,
            description: `Handoff cancelled by initiator ${handoff.from_user_name} for ${handoff.resource_type} ${handoff.resource_identifier}.`,
            actor_user_id: userId,
            actor_name: handoff.from_user_name,
            actor_role: handoff.from_user_role,
            actor_department: handoff.from_user_department,
            handoff_id: handoffId,
            handoff_from_user_id: handoff.from_user_id,
            handoff_to_user_id: handoff.to_user_id,
            visibility: 'ALL_ASSIGNED',
            metadata: { action: 'CANCELLED' },
        });

        const updatedResult = await pgQuery(`SELECT * FROM handoffs WHERE id = $1`, [handoffId]);
        return updatedResult.rows[0];
    }

    async queryHandoffs(query: HandoffQuery, userId: string, userRole: string, userCaseIds: string[]): Promise<HandoffResponse> {
        const { case_id, status, handoff_type, from_user_id, to_user_id, page, limit } = query;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        // Build visibility conditions
        if (userRole === 'CENTRAL_ADMIN' || userRole === 'AUDITOR') {
            // Admins can see all handoffs
        } else {
            // Users see handoffs they initiated, received, or are in their cases
            conditions.push(`(
                from_user_id = $${paramIndex} OR
                to_user_id = $${paramIndex} OR
                case_id = ANY($${paramIndex + 1})
            )`);
            params.push(userId, userCaseIds);
            paramIndex += 2;
        }

        if (case_id) {
            conditions.push(`case_id = $${paramIndex++}`);
            params.push(case_id);
        }
        if (status && status.length > 0) {
            conditions.push(`status = ANY($${paramIndex++})`);
            params.push(status);
        }
        if (handoff_type) {
            conditions.push(`handoff_type = $${paramIndex++}`);
            params.push(handoff_type);
        }
        if (from_user_id) {
            conditions.push(`from_user_id = $${paramIndex++}`);
            params.push(from_user_id);
        }
        if (to_user_id) {
            conditions.push(`to_user_id = $${paramIndex++}`);
            params.push(to_user_id);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(limit, 0); // offset = 0 for now

        const [handoffsResult, countResult] = await Promise.all([
            pgQuery(
                `SELECT * FROM handoffs ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            ),
            pgQuery(
                `SELECT COUNT(*) as total FROM handoffs ${whereClause}`,
                params.slice(0, -2)
            ),
        ]);

        return {
            handoffs: handoffsResult.rows,
            total: parseInt(countResult.rows[0].total, 10),
            page: 1,
            limit: limit,
            total_pages: Math.ceil(parseInt(countResult.rows[0].total, 10) / limit),
        };
    }

    async getHandoff(handoffId: string, userId: string, userRole: string, userCaseIds: string[]): Promise<Handoff | null> {
        const result = await pgQuery(`SELECT * FROM handoffs WHERE id = $1`, [handoffId]);
        if (result.rows.length === 0) return null;

        const handoff = result.rows[0];

        // Check access
        if (userRole !== 'CENTRAL_ADMIN' && userRole !== 'AUDITOR') {
            const hasAccess = handoff.from_user_id === userId ||
                handoff.to_user_id === userId ||
                userCaseIds.includes(handoff.case_id);
            if (!hasAccess) return null;
        }

        return handoff;
    }

    // ========================================================================
    // NOTIFICATIONS
    // ========================================================================

    private async sendHandoffNotifications(handoff: Handoff, toUser: any, fromUser: any): Promise<void> {
        // In-app notification
        await this.createNotification({
            user_id: handoff.to_user_id,
            type: 'HANDOFF_REQUEST',
            title: `Handoff Request: ${handoff.resource_identifier}`,
            message: `${handoff.from_user_name} has initiated a handoff for ${handoff.resource_type} ${handoff.resource_identifier} to you.`,
            priority: 'HIGH',
            case_id: handoff.case_id,
            handoff_id: handoff.id,
            channels: ['IN_APP', 'EMAIL'],
            metadata: {
                handoff_id: handoff.id,
                resource_type: handoff.resource_type,
                resource_identifier: handoff.resource_identifier,
            },
        });

        // Send email
        // await this.sendEmail(handoff.to_user_id, ...)

        // Send SMS
        // await this.sendSMS(handoff.to_user_id, ...)

        // Update handoff notification status
        await pgQuery(
            `UPDATE handoffs SET notification_sent = TRUE, notification_sent_at = NOW(), email_sent = TRUE WHERE id = $1`,
            [handoff.id]
        );
    }

    private async sendHandoffResponseNotifications(handoff: any, accepted: boolean, reason?: string): Promise<void> {
        const action = accepted ? 'accepted' : 'declined';
        await this.createNotification({
            user_id: handoff.from_user_id,
            type: accepted ? 'HANDOFF_ACCEPTED' : 'HANDOFF_DECLINED',
            title: `Handoff ${accepted ? 'Accepted' : 'Declined'}: ${handoff.resource_identifier}`,
            message: `Your handoff for ${handoff.resource_type} ${handoff.resource_identifier} was ${accepted ? 'accepted' : 'declined'} by ${handoff.to_user_name}.${reason ? ` Reason: ${reason}` : ''}`,
            priority: 'HIGH',
            case_id: handoff.case_id,
            handoff_id: handoff.id,
            channels: ['IN_APP', 'EMAIL'],
            metadata: { handoff_id: handoff.id, action: accepted ? 'ACCEPTED' : 'DECLINED' },
        });
    }

    async sendHandoffExpiryNotifications(): Promise<void> {
        // Find handoffs expiring in 1 hour
        const expiringResult = await pgQuery(
            `SELECT * FROM handoffs
             WHERE status = 'PENDING'
             AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
             AND notification_sent = FALSE`,
        );

        for (const handoff of expiringResult.rows) {
            await this.createNotification({
                user_id: handoff.to_user_id,
                type: 'HANDOFF_EXPIRED',
                title: `Handoff Expiring Soon: ${handoff.resource_identifier}`,
                message: `Your handoff for ${handoff.resource_type} ${handoff.resource_identifier} expires in 1 hour.`,
                priority: 'URGENT',
                case_id: handoff.case_id,
                handoff_id: handoff.id,
                channels: ['IN_APP', 'EMAIL', 'SMS'],
                metadata: { handoff_id: handoff.id },
            });
        }
    }

    async createNotification(notification: NotificationCreateRequest): Promise<Notification> {
        const id = uuidv4();
        const notificationEntry: Notification = {
            id,
            ...notification,
            read: false,
            channels: notification.channels || ['IN_APP'],
            metadata: notification.metadata || {},
            created_at: new Date(),
        };

        const mongoDb = await getMongoDb();
        await mongoDb.collection('notifications').insertOne(notificationEntry);

        // Also store in PostgreSQL
        await pgQuery(
            `INSERT INTO notifications (id, user_id, type, title, message, priority, case_id, handoff_id, activity_id, channels, read, metadata, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
                id, notificationEntry.user_id, notificationEntry.type,
                notificationEntry.title, notificationEntry.message,
                notificationEntry.priority, notificationEntry.case_id,
                notificationEntry.handoff_id, notificationEntry.activity_id,
                JSON.stringify(notificationEntry.channels),
                false, JSON.stringify(notificationEntry.metadata),
                notificationEntry.created_at,
            ]
        );

        // Emit real-time event
        await this.emitRealtimeEvent({
            type: 'NOTIFICATION',
            payload: notificationEntry,
            user_ids: [notificationEntry.user_id],
            timestamp: new Date(),
        });

        return notificationEntry;
    }

    async getUserNotifications(userId: string, page: number = 1, limit: number = 20): Promise<{ notifications: Notification[]; total: number }> {
        const offset = (page - 1) * limit;
        const [notifsResult, countResult] = await Promise.all([
            pgQuery(
                `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
                [userId, limit, offset]
            ),
            pgQuery(`SELECT COUNT(*) as total FROM notifications WHERE user_id = $1`, [userId]),
        ]);

        return {
            notifications: notifsResult.rows,
            total: parseInt(countResult.rows[0].total, 10),
        };
    }

    async markNotificationRead(notificationId: string, userId: string): Promise<void> {
        await pgQuery(
            `UPDATE notifications SET read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2`,
            [notificationId, userId]
        );
    }

    // ========================================================================
    // COMMENTS
    // ========================================================================

    async addComment(commentRequest: CommentCreateRequest, authorId: string): Promise<Comment> {
        const authorResult = await pgQuery(
            `SELECT full_name, role FROM users WHERE id = $1`,
            [authorId]
        );
        if (authorResult.rows.length === 0) {
            throw new Error('Author not found');
        }

        const author = authorResult.rows[0];
        const commentId = uuidv4();
        const now = new Date();

        const comment: Comment = {
            id: commentId,
            case_id: commentRequest.case_id,
            activity_id: commentRequest.activity_id,
            author_user_id: authorId,
            author_name: author.full_name,
            author_role: author.role,
            content: commentRequest.content,
            parent_comment_id: commentRequest.parent_comment_id,
            mentioned_user_ids: commentRequest.mentioned_user_ids || [],
            metadata: {},
            created_at: now,
            updated_at: now,
        };

        await pgQuery(
            `INSERT INTO comments (id, case_id, activity_id, author_user_id, author_name, author_role, content, parent_comment_id, mentioned_user_ids, metadata, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [commentId, commentRequest.case_id, commentRequest.activity_id, authorId, author.full_name, author.role, commentRequest.content, commentRequest.parent_comment_id, commentRequest.mentioned_user_ids || [], JSON.stringify({}), now, now]
        );

        // Notify mentioned users
        if (commentRequest.mentioned_user_ids && commentRequest.mentioned_user_ids.length > 0) {
            for (const userId of commentRequest.mentioned_user_ids) {
                await this.createNotification({
                    user_id: userId,
                    type: 'ACTIVITY_MENTION',
                    title: `You were mentioned in a comment`,
                    message: `${author.full_name} mentioned you in a comment on case activity.`,
                    priority: 'NORMAL',
                    activity_id: commentRequest.activity_id,
                    channels: ['IN_APP'],
                    metadata: { comment_id: commentId },
                });
            }
        }

        return {
            id: commentId,
            case_id: commentRequest.case_id,
            activity_id: commentRequest.activity_id,
            author_user_id: authorId,
            author_name: author.full_name,
            author_role: author.role,
            content: commentRequest.content,
            parent_comment_id: commentRequest.parent_comment_id,
            mentioned_user_ids: commentRequest.mentioned_user_ids || [],
            metadata: {},
            created_at: now,
            updated_at: now,
        };
    }

    async getCommentsForActivity(activityId: string): Promise<Comment[]> {
        const result = await pgQuery(
            `SELECT * FROM comments WHERE activity_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
            [activityId]
        );
        return result.rows;
    }

    // ========================================================================
    // REAL-TIME EVENTS
    // ========================================================================

    private async emitRealtimeEvent(event: RealtimeEvent): Promise<void> {
        // In production, this would publish to a message queue (Redis pub/sub, Kafka, etc.)
        // For now, we'll store in MongoDB for polling-based clients
        const mongoDb = await getMongoDb();
        await mongoDb.collection('realtime_events').insertOne({
            ...event,
            timestamp: event.timestamp || new Date(),
        });

        // Also could publish to Redis pub/sub for WebSocket servers
        // await redis.publish(`case:${event.case_id}`, JSON.stringify(event));
    }

    // ========================================================================
    // PERMISSIONS
    // ========================================================================

    async getHandoffPermissions(userId: string, caseId: string, userRole: string): Promise<HandoffPermissions> {
        // Admins can do everything
        if (userRole === 'CENTRAL_ADMIN' || userRole === 'AUDITOR') {
            return {
                can_initiate_handoff: true,
                can_accept_handoff: true,
                can_decline_handoff: true,
                can_cancel_handoff: true,
                can_view_handoff: true,
            };
        }

        // Check case assignment
        const assignmentResult = await pgQuery(
            `SELECT permission_level FROM case_assignments
             WHERE case_id = $1 AND user_id = $2 AND is_active = TRUE`,
            [caseId, userId]
        );

        const permissions = assignmentResult.rows[0]?.permission_level || [];
        const hasWrite = permissions.includes('WRITE') || permissions.includes('ADMIN');

        return {
            can_initiate_handoff: hasWrite,
            can_accept_handoff: true, // Any assigned user can accept handoffs to them
            can_decline_handoff: true, // Any assigned user can decline handoffs to them
            can_cancel_handoff: false, // Only initiator can cancel
            can_view_handoff: true, // Any assigned user can view handoffs in their cases
        };
    }

    async getActivityFeedPermissions(userId: string, caseId: string, userRole: string): Promise<ActivityFeedPermissions> {
        if (userRole === 'CENTRAL_ADMIN' || userRole === 'AUDITOR') {
            return {
                can_view: true,
                can_comment: true,
                can_create_activity: true,
            };
        }

        // Check case assignment
        const assignmentResult = await pgQuery(
            `SELECT 1 FROM case_assignments WHERE case_id = $1 AND user_id = $2 AND is_active = TRUE`,
            [caseId, userId]
        );

        const hasAccess = assignmentResult.rows.length > 0;

        return {
            can_view: hasAccess,
            can_comment: hasAccess,
            can_create_activity: hasAccess,
        };
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let collaborationServiceInstance: CollaborationService | null = null;

export function getCollaborationService(): CollaborationService {
    if (!collaborationServiceInstance) {
        collaborationServiceInstance = new CollaborationService();
    }
    return collaborationServiceInstance;
}