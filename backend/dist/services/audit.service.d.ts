/**
 * ADALAT360 - Audit Service
 * Comprehensive audit logging for security events
 */
import { AuthAuditEvent } from '../models/auth.js';
export declare function logAuthEvent(event: AuthAuditEvent): Promise<void>;
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
export declare function logAuditEvent(entry: AuditLogEntry): Promise<string>;
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
export declare function queryAuditLogs(options: AuditQueryOptions): Promise<{
    events: any[];
    total: number;
}>;
export declare function getAuditLogById(eventId: string): Promise<any | null>;
export declare function getUserAuditTrail(userId: string, limit?: number): Promise<any[]>;
export declare function getResourceAuditTrail(resourceType: string, resourceId: string, limit?: number): Promise<any[]>;
export interface ComplianceReportFilters {
    start_date: Date;
    end_date: Date;
    user_ids?: string[];
    event_categories?: string[];
    severities?: string[];
}
export declare function generateComplianceReport(filters: ComplianceReportFilters): Promise<{
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
}>;
export declare function getRtiAuditTrail(requestNumber: string): Promise<any[]>;
export declare function logBlockchainEvent(txId: string, action: string, userId: string, resourceType: string, resourceId: string, outcome: 'SUCCESS' | 'FAILURE', metadata?: Record<string, any>): Promise<void>;
export declare function logAnomalyDetected(anomalyType: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', userId: string, details: Record<string, any>): Promise<void>;
export declare function cleanupOldAuditLogs(retentionDays?: number): Promise<number>;
export interface AuditExportOptions {
    start_date: Date;
    end_date: Date;
    format: 'json' | 'csv';
    filters?: AuditQueryOptions;
}
export declare function exportAuditLogs(options: AuditExportOptions): Promise<string>;
//# sourceMappingURL=audit.service.d.ts.map