/**
 * ADALAT360 - Timeline Service
 * Reconstructs chronological case timeline from custody ledger entries
 * Provides filtered, aggregated views for different roles
 */

import { pgQuery } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { CustodyAction } from '../../types/database.js';
import {
    TimelineEvent,
    TimelineFilter,
    TimelineResponse,
    CaseAnalytics,
} from '../../models/intelligence.js';

// ============================================================================
// TIMELINE SERVICE CLASS
// ============================================================================

export class TimelineService {
    // ========================================================================
    // MAIN TIMELINE METHOD
    // ========================================================================

    async getTimeline(filter: TimelineFilter, userId: string, userRole: string): Promise<TimelineResponse> {
        // Verify user has access to this case
        const hasAccess = await this.verifyCaseAccess(filter.caseId, userId, userRole);
        if (!hasAccess) {
            throw new Error('Access denied to this case');
        }

        const events = await this.fetchTimelineEvents(filter);
        const statistics = this.computeStatistics(events);
        const dateRange = this.computeDateRange(events);

        return {
            events,
            total: events.length,
            dateRange,
            statistics,
        };
    }

    // ========================================================================
    // FETCH TIMELINE EVENTS
    // ========================================================================

    private async fetchTimelineEvents(filter: TimelineFilter): Promise<TimelineEvent[]> {
        const conditions: string[] = [
            'cl.case_id = $1',
            'cl.is_valid = TRUE',
        ];
        const params: any[] = [filter.caseId];
        let paramIndex = 2;

        if (filter.startDate) {
            conditions.push(`cl.tx_timestamp >= $${paramIndex++}`);
            params.push(filter.startDate);
        }

        if (filter.endDate) {
            conditions.push(`cl.tx_timestamp <= $${paramIndex++}`);
            params.push(filter.endDate);
        }

        if (filter.eventTypes && filter.eventTypes.length > 0) {
            conditions.push(`cl.tx_type = ANY($${paramIndex++})`);
            params.push(filter.eventTypes);
        }

        if (filter.actorIds && filter.actorIds.length > 0) {
            conditions.push(`cl.actor_user_id = ANY($${paramIndex++})`);
            params.push(filter.actorIds);
        }

        if (filter.resourceIds && filter.resourceIds.length > 0) {
            conditions.push(`(
                cl.document_id = ANY($${paramIndex}) OR
                cl.evidence_id = ANY($${paramIndex})
            )`);
            params.push(filter.resourceIds);
            paramIndex++;
        }

        const whereClause = conditions.join(' AND ');

        const result = await pgQuery(
            `SELECT
                cl.*,
                u.full_name as actor_name,
                u.role as actor_role,
                u.department as actor_department,
                d.title as document_title,
                d.version as document_version,
                d.document_number,
                e.name as evidence_name,
                e.evidence_number
             FROM custody_ledger cl
             LEFT JOIN users u ON u.id = cl.actor_user_id
             LEFT JOIN documents d ON d.id = cl.document_id
             LEFT JOIN evidence e ON e.id = cl.evidence_id
             WHERE ${whereClause}
             ORDER BY cl.tx_timestamp ASC`,
            params
        );

        return result.rows.map(row => this.mapRowToTimelineEvent(row, filter.includeBlockchain));
    }

    private mapRowToTimelineEvent(row: any, includeBlockchain: boolean): TimelineEvent {
        const resources = {
            documents: [] as Array<{ id: string; title: string; version: number }>,
            evidence: [] as Array<{ id: string; name: string; evidenceNumber: string }>,
        };

        if (row.document_id) {
            resources.documents.push({
                id: row.document_id,
                title: row.document_title || 'Unknown Document',
                version: row.document_version || 1,
            });
        }

        if (row.evidence_id) {
            resources.evidence.push({
                id: row.evidence_id,
                name: row.evidence_name || 'Unknown Evidence',
                evidenceNumber: row.evidence_number || '',
            });
        }

        return {
            id: row.id,
            caseId: row.case_id,
            timestamp: row.tx_timestamp,
            eventType: row.tx_type,
            title: this.generateEventTitle(row.tx_type, row.action_details),
            description: this.generateEventDescription(row.tx_type, row.action_details, resources),
            actor: {
                userId: row.actor_user_id,
                name: row.actor_name || 'Unknown',
                role: row.actor_role || 'Unknown',
                department: row.actor_department || 'Unknown',
            },
            resources,
            blockchain: includeBlockchain ? {
                txId: row.tx_id,
                blockNumber: row.block_number,
                blockHash: row.block_hash,
                consensusStatus: row.consensus_status,
            } : {
                txId: '',
                blockNumber: 0,
                blockHash: '',
                consensusStatus: '',
            },
            metadata: row.action_details || {},
        };
    }

    private generateEventTitle(txType: CustodyAction, actionDetails: Record<string, any>): string {
        const titles: Record<CustodyAction, string> = {
            [CustodyAction.UPLOAD]: `Document Uploaded: ${actionDetails.document_number || actionDetails.original_filename || 'New Document'}`,
            [CustodyAction.ACCESS]: `Document Accessed: ${actionDetails.document_number || 'Document'}`,
            [CustodyAction.TRANSFER]: `Custody Transfer: ${actionDetails.from_user || 'Unknown'} → ${actionDetails.to_user || 'Unknown'}`,
            [CustodyAction.REDACTION]: `Document Redacted: ${actionDetails.document_number || 'Document'}`,
            [CustodyAction.EXPORT]: `Document Exported: ${actionDetails.export_format || 'PDF'}`,
            [CustodyAction.VERSION_CREATE]: `New Version Created: v${actionDetails.version || '?'} of ${actionDetails.document_number || 'Document'}`,
            [CustodyAction.METADATA_UPDATE]: `Metadata Updated: ${actionDetails.document_number || 'Document'}`,
            [CustodyAction.VERIFICATION]: `Document Verified: ${actionDetails.document_number || 'Document'}`,
            [CustodyAction.SIGNATURE_APPLY]: `Digital Signature Applied: ${actionDetails.document_number || 'Document'}`,
            [CustodyAction.SEIZURE]: `Evidence Seized: ${actionDetails.evidence_number || 'New Evidence'}`,
            [CustodyAction.HANDOVER]: `Evidence Handover: ${actionDetails.from_user || 'Unknown'} → ${actionDetails.to_user || 'Unknown'}`,
            [CustodyAction.RECEIVE]: `Evidence Received: ${actionDetails.evidence_number || 'Evidence'}`,
            [CustodyAction.ANALYSIS_START]: `Analysis Started: ${actionDetails.evidence_number || 'Evidence'}`,
            [CustodyAction.ANALYSIS_COMPLETE]: `Analysis Completed: ${actionDetails.evidence_number || 'Evidence'}`,
            [CustodyAction.COURT_SUBMISSION]: `Submitted to Court: ${actionDetails.document_number || actionDetails.evidence_number || 'Item'}`,
            [CustodyAction.COURT_RETURN]: `Returned from Court: ${actionDetails.document_number || actionDetails.evidence_number || 'Item'}`,
            [CustodyAction.DISPOSAL]: `Disposed: ${actionDetails.disposal_method || 'Evidence/Document'}`,
        };

        return titles[txType] || `${txType} Event`;
    }

    private generateEventDescription(txType: CustodyAction, actionDetails: Record<string, any>, resources: TimelineEvent['resources']): string {
        const parts: string[] = [];

        // Add resource info
        if (resources.documents.length > 0) {
            parts.push(`Document: ${resources.documents[0].title} (v${resources.documents[0].version})`);
        }
        if (resources.evidence.length > 0) {
            parts.push(`Evidence: ${resources.evidence[0].name} (${resources.evidence[0].evidenceNumber})`);
        }

        // Add action-specific details
        switch (txType) {
            case CustodyAction.UPLOAD:
                parts.push(`File: ${actionDetails.original_filename}, Size: ${this.formatBytes(actionDetails.file_size_bytes)}, Type: ${actionDetails.mime_type}`);
                break;
            case CustodyAction.TRANSFER:
            case CustodyAction.HANDOVER:
                parts.push(`From: ${actionDetails.from_user || 'Unknown'}, To: ${actionDetails.to_user || 'Unknown'}`);
                if (actionDetails.seal_number) parts.push(`Seal: ${actionDetails.seal_number}`);
                break;
            case CustodyAction.REDACTION:
                parts.push(`Redactions applied: ${actionDetails.redaction_count || 'multiple'} areas`);
                break;
            case CustodyAction.EXPORT:
                parts.push(`Format: ${actionDetails.export_format}, Watermarked: ${actionDetails.watermarked ? 'Yes' : 'No'}`);
                break;
            case CustodyAction.VERSION_CREATE:
                parts.push(`Changes: ${actionDetails.changes_summary || 'Not specified'}`);
                break;
            case CustodyAction.ANALYSIS_START:
                parts.push(`Lab: ${actionDetails.forensic_lab || 'Unknown'}, Type: ${actionDetails.analysis_type || 'Standard'}`);
                break;
            case CustodyAction.ANALYSIS_COMPLETE:
                parts.push(`Result: ${actionDetails.result_summary || 'Completed'}`);
                break;
            case CustodyAction.SEIZURE:
                parts.push(`Location: ${actionDetails.seized_location || 'Unknown'}, From: ${actionDetails.seized_from || 'Unknown'}`);
                break;
        }

        return parts.join(' | ');
    }

    private formatBytes(bytes: number): string {
        if (!bytes) return 'Unknown';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }

    // ========================================================================
    // CASE ACCESS VERIFICATION
    // ========================================================================

    private async verifyCaseAccess(caseId: string, userId: string, userRole: string): Promise<boolean> {
        if (userRole === 'CENTRAL_ADMIN' || userRole === 'AUDITOR') {
            return true;
        }

        const result = await pgQuery(
            `SELECT 1 FROM case_assignments WHERE case_id = $1 AND user_id = $2 AND is_active = TRUE`,
            [caseId, userId]
        );

        if (result.rows.length > 0) return true;

        // Check direct case assignments
        const caseResult = await pgQuery(
            `SELECT 1 FROM cases WHERE id = $1 AND (assigned_officer_id = $2 OR prosecutor_id = $2 OR forensic_lab_id = $2 OR court_id = $2)`,
            [caseId, userId]
        );

        return caseResult.rows.length > 0;
    }

    // ========================================================================
    // STATISTICS COMPUTATION
    // ========================================================================

    private computeStatistics(events: TimelineEvent[]): TimelineResponse['statistics'] {
        const byEventType: Record<string, number> = {};
        const byActor: Record<string, number> = {};
        const byMonth: Record<string, number> = {};

        for (const event of events) {
            // By event type
            byEventType[event.eventType] = (byEventType[event.eventType] || 0) + 1;

            // By actor
            const actorKey = `${event.actor.name} (${event.actor.role})`;
            byActor[actorKey] = (byActor[actorKey] || 0) + 1;

            // By month
            const monthKey = event.timestamp.toISOString().substring(0, 7); // YYYY-MM
            byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
        }

        return { byEventType, byActor, byMonth };
    }

    private computeDateRange(events: TimelineEvent[]): { start: Date; end: Date } {
        if (events.length === 0) {
            return { start: new Date(), end: new Date() };
        }

        const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        return { start: sorted[0].timestamp, end: sorted[sorted.length - 1].timestamp };
    }

    // ========================================================================
    // CASE ANALYTICS
    // ========================================================================

    async getCaseAnalytics(caseId: string, userId: string, userRole: string): Promise<CaseAnalytics> {
        const hasAccess = await this.verifyCaseAccess(caseId, userId, userRole);
        if (!hasAccess) {
            throw new Error('Access denied to this case');
        }

        // Fetch all required data in parallel
        const [
            docStats,
            eviStats,
            custodyStats,
            actorStats,
            timelineResult,
            docTypes,
            eviTypes,
            activityMonth,
            activityActor,
            entityStats,
            blockchainStats,
        ] = await Promise.all([
            pgQuery(`SELECT COUNT(*) as count FROM documents WHERE case_id = $1 AND deleted_at IS NULL`, [caseId]),
            pgQuery(`SELECT COUNT(*) as count FROM evidence WHERE case_id = $1 AND deleted_at IS NULL`, [caseId]),
            pgQuery(`SELECT COUNT(*) as count FROM custody_ledger WHERE case_id = $1 AND is_valid = TRUE`, [caseId]),
            pgQuery(`SELECT COUNT(DISTINCT actor_user_id) as count FROM custody_ledger WHERE case_id = $1`, [caseId]),
            pgQuery(
                `SELECT MIN(tx_timestamp) as start, MAX(tx_timestamp) as end FROM custody_ledger WHERE case_id = $1`,
                [caseId]
            ),
            pgQuery(`SELECT document_type, COUNT(*) as count FROM documents WHERE case_id = $1 AND deleted_at IS NULL GROUP BY document_type`, [caseId]),
            pgQuery(`SELECT evidence_type, COUNT(*) as count FROM evidence WHERE case_id = $1 AND deleted_at IS NULL GROUP BY evidence_type`, [caseId]),
            pgQuery(
                `SELECT DATE_TRUNC('month', tx_timestamp) as month, COUNT(*) as count
                 FROM custody_ledger WHERE case_id = $1 GROUP BY month ORDER BY month`,
                [caseId]
            ),
            pgQuery(
                `SELECT u.full_name, COUNT(*) as count
                 FROM custody_ledger cl JOIN users u ON u.id = cl.actor_user_id
                 WHERE cl.case_id = $1 GROUP BY u.full_name ORDER BY count DESC LIMIT 10`,
                [caseId]
            ),
            pgQuery(
                `SELECT extracted_entities FROM documents WHERE case_id = $1 AND deleted_at IS NULL`,
                [caseId]
            ),
            pgQuery(
                `SELECT COUNT(*) as total_blocks, COUNT(DISTINCT block_number) as unique_blocks
                 FROM blockchain_blocks WHERE EXISTS (
                     SELECT 1 FROM custody_ledger cl WHERE cl.block_number = blockchain_blocks.block_number AND cl.case_id = $1
                 )`,
                [caseId]
            ),
        ]);

        // Process entity stats
        const entities = { persons: new Map<string, number>(), organizations: new Map<string, number>(), locations: new Map<string, number>() };
        for (const row of entityStats.rows) {
            const e = row.extracted_entities;
            if (e?.persons) for (const p of e.persons) entities.persons.set(p, (entities.persons.get(p) || 0) + 1);
            if (e?.organizations) for (const o of e.organizations) entities.organizations.set(o, (entities.organizations.get(o) || 0) + 1);
            if (e?.locations) for (const l of e.locations) entities.locations.set(l, (entities.locations.get(l) || 0) + 1);
        }

        return {
            caseId,
            documentCount: parseInt(docStats.rows[0].count, 10),
            evidenceCount: parseInt(eviStats.rows[0].count, 10),
            custodyEventsCount: parseInt(custodyStats.rows[0].count, 10),
            uniqueActors: parseInt(actorStats.rows[0].count, 10),
            timelineSpan: {
                start: timelineResult.rows[0].start || new Date(),
                end: timelineResult.rows[0].end || new Date(),
            },
            documentTypes: Object.fromEntries(docTypes.rows.map(r => [r.document_type, parseInt(r.count, 10)])),
            evidenceTypes: Object.fromEntries(eviTypes.rows.map(r => [r.evidence_type, parseInt(r.count, 10)])),
            activityByMonth: Object.fromEntries(activityMonth.rows.map(r => [r.month.toISOString().substring(0, 7), parseInt(r.count, 10)])),
            activityByActor: Object.fromEntries(activityActor.rows.map(r => [r.full_name, parseInt(r.count, 10)])),
            topEntities: {
                persons: Array.from(entities.persons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
                organizations: Array.from(entities.organizations.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
                locations: Array.from(entities.locations.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
            },
            blockchainStats: {
                totalBlocks: parseInt(blockchainStats.rows[0].unique_blocks || '0', 10),
                totalTransactions: parseInt(custodyStats.rows[0].count, 10),
                avgBlockTime: 0, // Would need more complex query
                consensusRate: 1.0, // Would need consensus status query
            },
        };
    }

    // ========================================================================
    // EXPORT TIMELINE
    // ========================================================================

    async exportTimeline(filter: TimelineFilter, format: 'json' | 'csv' | 'pdf'): Promise<string> {
        const events = await this.fetchTimelineEvents(filter);

        if (format === 'csv') {
            const headers = ['Timestamp', 'Event Type', 'Title', 'Description', 'Actor', 'Role', 'Blockchain TX'];
            const rows = events.map(e => [
                e.timestamp.toISOString(),
                e.eventType,
                e.title,
                e.description,
                e.actor.name,
                e.actor.role,
                e.blockchain.txId,
            ]);
            return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        }

        if (format === 'json') {
            return JSON.stringify(events, null, 2);
        }

        // PDF would require a PDF library
        throw new Error('PDF export not yet implemented');
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let timelineServiceInstance: TimelineService | null = null;

export function getTimelineService(): TimelineService {
    if (!timelineServiceInstance) {
        timelineServiceInstance = new TimelineService();
    }
    return timelineServiceInstance;
}