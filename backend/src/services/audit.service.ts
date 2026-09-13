/**
 * ADALAT360 - Audit Service
 * Comprehensive audit logging for security events
 */

import { pgQuery, pgTransaction } from '../config/database.js';
import { getMongoDb } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { AuthAuditEvent, AuthEventType } from '../models/auth.js';

// ============================================================================
// POSTGRESQL AUDIT LOGGING
// ============================================================================

export async function logAuthEvent(event: AuthAuditEvent): Promise<void> {
    const eventId = uuidv4();
    const correlationId = uuidv4();

    try {
        await pgQuery(
            `INSERT INTO audit_logs (
                event_id, event_type, event_category, severity, user_id, user_role,
                user_ip, user_agent, session_id, resource_type, resource_id,
                action, outcome, error_message, metadata, blockchain_tx_id, occurred_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())`,
            [
                eventId,
                event.event_type,
                'AUTHENTICATION',
                getSeverityForAuthEvent(event.event_type, event.success),
                event.user_id || null,
                event.user_id ? null : undefined, // Will be set by middleware
                event.ip_address || null,
                event.user_agent || null,
                event.session_id || null,
                'USER',
                event.user_id || null,
                event.event_type,
                event.success ? 'SUCCESS' : 'FAILURE',
                event.failure_reason || null,
                JSON.stringify(event.metadata || {}),
                event.metadata?.blockchain_tx_id || null,
            ]
        );
    } catch (error) {
        console.error('[Audit] Failed to log auth event:', error);
        // Don't throw - audit failures shouldn't break auth flow
    }
}

function getSeverityForAuthEvent(eventType: AuthEventType, success: boolean): string {
    if (!success) {
        const criticalEvents: AuthEventType[] = ['LOGIN_LOCKED', 'CONCURRENT_SESSION_LIMIT_EXCEEDED', 'SUSPICIOUS_ACTIVITY'];
        if (criticalEvents.includes(eventType)) return 'CRITICAL';
        return 'WARNING';
    }
    return 'INFO';
}

// ============================================================================
// GENERAL AUDIT LOGGING (for API actions)
// ============================================================================

export interface AuditLogEntry {
    event_type: string;
    event_category: string;
    severity?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    user_id?: string;
    user_role?: string;
    user_ip?: string;
    user_agent?: string;
    session_id?: string;
    request_id?: string;
    correlation_id?: string;
    resource_type?: string;
    resource_id?: string;
    action: string;
    outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'DENIED' | 'ERROR';
    error_message?: string;
    error_code?: string;
    request_details?: {
        method?: string;
        url?: string;
        query_params?: Record<string, any>;
        body_size?: number;
    };
    response_details?: {
        status_code?: number;
        response_size?: number;
        duration_ms?: number;
    };
    before_state?: Record<string, any>;
    after_state?: Record<string, any>;
    metadata?: Record<string, any>;
    blockchain_tx_id?: string;
    risk_score?: number;
    anomaly_flags?: string[];
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<string> {
    const eventId = uuidv4();

    try {
        await pgQuery(
            `INSERT INTO audit_logs (
                event_id, event_type, event_category, severity, user_id, user_role,
                user_ip, user_agent, session_id, resource_type, resource_id,
                action, outcome, error_message, request_id, correlation_id,
                before_state, after_state, metadata, blockchain_tx_id, occurred_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())
            RETURNING event_id`,
            [
                eventId,
                entry.event_type,
                entry.event_category,
                entry.severity || 'INFO',
                entry.user_id || null,
                entry.user_role || null,
                entry.user_ip || null,
                entry.user_agent || null,
                entry.session_id || null,
                entry.resource_type || null,
                entry.resource_id || null,
                entry.action,
                entry.outcome,
                entry.error_message || null,
                entry.request_id || null,
                entry.correlation_id || null,
                JSON.stringify(entry.before_state || {}),
                JSON.stringify(entry.after_state || {}),
                JSON.stringify(entry.metadata || {}),
                entry.blockchain_tx_id || null,
            ]
        );

        // Also log to MongoDB for detailed analytics
        await logToMongo(eventId, entry);

        return eventId;
    } catch (error) {
        console.error('[Audit] Failed to log audit event:', error);
        return eventId;
    }
}

async function logToMongo(eventId: string, entry: AuditLogEntry): Promise<void> {
    try {
        const db = await getMongoDb();
        await db.collection('audit_logs_detailed').insertOne({
            event_id: eventId,
            ...entry,
            occurred_at: new Date(),
            created_at: new Date(),
        });
    } catch (error) {
        // MongoDB logging is best-effort
        console.error('[Audit] MongoDB logging failed:', error);
    }
}

// ============================================================================
// AUDIT QUERY HELPERS
// ============================================================================

export interface AuditQueryOptions {
    user_id?: string;
    event_type?: string;
    event_category?: string;
    resource_type?: string;
    resource_id?: string;
    action?: string;
    outcome?: string;
    severity?: string;
    start_date?: Date;
    end_date?: Date;
    limit?: number;
    offset?: number;
    correlation_id?: string;
}

export async function queryAuditLogs(options: AuditQueryOptions): Promise<{ events: any[]; total: number }> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.user_id) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(options.user_id);
    }
    if (options.event_type) {
        conditions.push(`event_type = $${paramIndex++}`);
        params.push(options.event_type);
    }
    if (options.event_category) {
        conditions.push(`event_category = $${paramIndex++}`);
        params.push(options.event_category);
    }
    if (options.resource_type) {
        conditions.push(`resource_type = $${paramIndex++}`);
        params.push(options.resource_type);
    }
    if (options.resource_id) {
        conditions.push(`resource_id = $${paramIndex++}`);
        params.push(options.resource_id);
    }
    if (options.action) {
        conditions.push(`action = $${paramIndex++}`);
        params.push(options.action);
    }
    if (options.outcome) {
        conditions.push(`outcome = $${paramIndex++}`);
        params.push(options.outcome);
    }
    if (options.severity) {
        conditions.push(`severity = $${paramIndex++}`);
        params.push(options.severity);
    }
    if (options.start_date) {
        conditions.push(`occurred_at >= $${paramIndex++}`);
        params.push(options.start_date);
    }
    if (options.end_date) {
        conditions.push(`occurred_at <= $${paramIndex++}`);
        params.push(options.end_date);
    }
    if (options.correlation_id) {
        conditions.push(`correlation_id = $${paramIndex++}`);
        params.push(options.correlation_id);
    }

    const whereClause = conditions.join(' AND ');
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    params.push(limit, offset);

    const [eventsResult, countResult] = await Promise.all([
        pgQuery(
            `SELECT * FROM audit_logs WHERE ${whereClause} ORDER BY occurred_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            params
        ),
        pgQuery(
            `SELECT COUNT(*) as total FROM audit_logs WHERE ${whereClause}`,
            params.slice(0, -2)
        ),
    ]);

    return {
        events: eventsResult.rows,
        total: parseInt(countResult.rows[0].total, 10),
    };
}

export async function getAuditLogById(eventId: string): Promise<any | null> {
    const result = await pgQuery(
        `SELECT * FROM audit_logs WHERE event_id = $1`,
        [eventId]
    );
    return result.rows[0] || null;
}

export async function getUserAuditTrail(userId: string, limit: number = 50): Promise<any[]> {
    const result = await pgQuery(
        `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
        [userId, limit]
    );
    return result.rows;
}

export async function getResourceAuditTrail(resourceType: string, resourceId: string, limit: number = 50): Promise<any[]> {
    const result = await pgQuery(
        `SELECT * FROM audit_logs WHERE resource_type = $1 AND resource_id = $2 ORDER BY occurred_at DESC LIMIT $3`,
        [resourceType, resourceId, limit]
    );
    return result.rows;
}

// ============================================================================
// COMPLIANCE REPORTS
// ============================================================================

export interface ComplianceReportFilters {
    start_date: Date;
    end_date: Date;
    user_ids?: string[];
    event_categories?: string[];
    severities?: string[];
}

export async function generateComplianceReport(filters: ComplianceReportFilters): Promise<{
    summary: {
        total_events: number;
        by_category: Record<string, number>;
        by_severity: Record<string, number>;
        by_outcome: Record<string, number>;
        failed_logins: number;
        mfa_events: number;
        password_changes: number;
        permission_changes: number;
        data_exports: number;
    };
    events: any[];
}> {
    const conditions = [
        'occurred_at >= $1',
        'occurred_at <= $2',
    ];
    const params = [filters.start_date, filters.end_date];
    let paramIndex = 3;

    if (filters.user_ids && filters.user_ids.length > 0) {
        conditions.push(`user_id = ANY($${paramIndex++})`);
        params.push(filters.user_ids);
    }
    if (filters.event_categories && filters.event_categories.length > 0) {
        conditions.push(`event_category = ANY($${paramIndex++})`);
        params.push(filters.event_categories);
    }
    if (filters.severities && filters.severities.length > 0) {
        conditions.push(`severity = ANY($${paramIndex++})`);
        params.push(filters.severities);
    }

    const whereClause = conditions.join(' AND ');

    // Get summary stats
    const summaryQueries = await Promise.all([
        pgQuery(`SELECT COUNT(*) as total FROM audit_logs WHERE ${whereClause}`, params),
        pgQuery(`SELECT event_category, COUNT(*) as count FROM audit_logs WHERE ${whereClause} GROUP BY event_category`, params),
        pgQuery(`SELECT severity, COUNT(*) as count FROM audit_logs WHERE ${whereClause} GROUP BY severity`, params),
        pgQuery(`SELECT outcome, COUNT(*) as count FROM audit_logs WHERE ${whereClause} GROUP BY outcome`, params),
        pgQuery(`SELECT COUNT(*) as count FROM audit_logs WHERE ${whereClause} AND event_type = 'LOGIN_FAILED'`, params),
        pgQuery(`SELECT COUNT(*) as count FROM audit_logs WHERE ${whereClause} AND event_type LIKE 'MFA_%'`, params),
        pgQuery(`SELECT COUNT(*) as count FROM audit_logs WHERE ${whereClause} AND event_type = 'PASSWORD_CHANGED'`, params),
        pgQuery(`SELECT COUNT(*) as count FROM audit_logs WHERE ${whereClause} AND action ILIKE '%permission%'`, params),
        pgQuery(`SELECT COUNT(*) as count FROM audit_logs WHERE ${whereClause} AND action ILIKE '%export%'`, params),
    ]);

    // Get recent events
    params.push(1000);
    const eventsResult = await pgQuery(
        `SELECT * FROM audit_logs WHERE ${whereClause} ORDER BY occurred_at DESC LIMIT $${paramIndex}`,
        params
    );

    return {
        summary: {
            total_events: parseInt(summaryQueries[0].rows[0].total, 10),
            by_category: Object.fromEntries(summaryQueries[1].rows.map(r => [r.event_category, parseInt(r.count, 10)])),
            by_severity: Object.fromEntries(summaryQueries[2].rows.map(r => [r.severity, parseInt(r.count, 10)])),
            by_outcome: Object.fromEntries(summaryQueries[3].rows.map(r => [r.outcome, parseInt(r.count, 10)])),
            failed_logins: parseInt(summaryQueries[4].rows[0].count, 10),
            mfa_events: parseInt(summaryQueries[5].rows[0].count, 10),
            password_changes: parseInt(summaryQueries[6].rows[0].count, 10),
            permission_changes: parseInt(summaryQueries[7].rows[0].count, 10),
            data_exports: parseInt(summaryQueries[8].rows[0].count, 10),
        },
        events: eventsResult.rows,
    };
}

// ============================================================================
// RTI AUDIT TRAIL
// ============================================================================

export async function getRtiAuditTrail(requestNumber: string): Promise<any[]> {
    const result = await pgQuery(
        `SELECT * FROM audit_logs WHERE metadata->>'rti_request_number' = $1 ORDER BY occurred_at`,
        [requestNumber]
    );
    return result.rows;
}

// ============================================================================
// BLOCKCHAIN AUDIT INTEGRATION
// ============================================================================

export async function logBlockchainEvent(
    txId: string,
    action: string,
    userId: string,
    resourceType: string,
    resourceId: string,
    outcome: 'SUCCESS' | 'FAILURE',
    metadata?: Record<string, any>
): Promise<void> {
    await logAuditEvent({
        event_type: 'BLOCKCHAIN_TRANSACTION',
        event_category: 'BLOCKCHAIN',
        severity: outcome === 'SUCCESS' ? 'INFO' : 'ERROR',
        user_id: userId,
        action,
        outcome,
        resource_type: resourceType,
        resource_id: resourceId,
        blockchain_tx_id: txId,
        metadata: {
            ...metadata,
            blockchain_action: action,
        },
    });
}

// ============================================================================
// ANOMALY DETECTION INTEGRATION
// ============================================================================

export async function logAnomalyDetected(
    anomalyType: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    userId: string,
    details: Record<string, any>
): Promise<void> {
    const anomalyId = uuidv4();

    // Log to PostgreSQL
    await logAuditEvent({
        event_type: 'ANOMALY_DETECTED',
        event_category: 'SECURITY',
        severity,
        user_id: userId,
        action: anomalyType,
        outcome: 'SUCCESS',
        metadata: {
            anomaly_id: anomalyId,
            anomaly_type: anomalyType,
            ...details,
        },
    });

    // Log to MongoDB anomaly collection
    try {
        const db = await getMongoDb();
        await db.collection('anomaly_events').insertOne({
            event_id: anomalyId,
            event_type: anomalyType,
            severity,
            user_id: userId,
            description: `${anomalyType} detected for user ${userId}`,
            details,
            risk_score: calculateRiskScore(severity),
            status: 'OPEN',
            detected_at: new Date(),
            created_at: new Date(),
        });
    } catch (error) {
        console.error('[Audit] Failed to log anomaly to MongoDB:', error);
    }
}

function calculateRiskScore(severity: string): number {
    const scores: Record<string, number> = {
        LOW: 20,
        MEDIUM: 50,
        HIGH: 75,
        CRITICAL: 95,
    };
    return scores[severity] || 0;
}

// ============================================================================
// DATA RETENTION
// ============================================================================

export async function cleanupOldAuditLogs(retentionDays: number = 2555): Promise<number> {
    const result = await pgQuery(
        `DELETE FROM audit_logs WHERE occurred_at < NOW() - INTERVAL '${retentionDays} days'`
    );
    return result.rowCount || 0;
}

// ============================================================================
// EXPORT FOR EXTERNAL AUDITORS
// ============================================================================

export interface AuditExportOptions {
    start_date: Date;
    end_date: Date;
    format: 'json' | 'csv';
    filters?: AuditQueryOptions;
}

export async function exportAuditLogs(options: AuditExportOptions): Promise<string> {
    const { events } = await queryAuditLogs({
        ...options.filters,
        start_date: options.start_date,
        end_date: options.end_date,
        limit: 100000,
    });

    if (options.format === 'csv') {
        // Convert to CSV
        const headers = [
            'event_id', 'event_type', 'event_category', 'severity',
            'user_id', 'user_role', 'user_ip', 'action', 'outcome',
            'resource_type', 'resource_id', 'occurred_at'
        ];

        const rows = events.map(e => [
            e.event_id, e.event_type, e.event_category, e.severity,
            e.user_id || '', e.user_role || '', e.user_ip || '',
            e.action, e.outcome, e.resource_type || '', e.resource_id || '',
            e.occurred_at
        ]);

        return [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    }

    return JSON.stringify(events, null, 2);
}