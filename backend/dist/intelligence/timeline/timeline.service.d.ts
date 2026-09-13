/**
 * ADALAT360 - Timeline Service
 * Reconstructs chronological case timeline from custody ledger entries
 * Provides filtered, aggregated views for different roles
 */
import { TimelineFilter, TimelineResponse, CaseAnalytics } from '../../models/intelligence.js';
export declare class TimelineService {
    getTimeline(filter: TimelineFilter, userId: string, userRole: string): Promise<TimelineResponse>;
    private fetchTimelineEvents;
    private mapRowToTimelineEvent;
    private generateEventTitle;
    private generateEventDescription;
    private formatBytes;
    private verifyCaseAccess;
    private computeStatistics;
    private computeDateRange;
    getCaseAnalytics(caseId: string, userId: string, userRole: string): Promise<CaseAnalytics>;
    exportTimeline(filter: TimelineFilter, format: 'json' | 'csv' | 'pdf'): Promise<string>;
}
export declare function getTimelineService(): TimelineService;
//# sourceMappingURL=timeline.service.d.ts.map