/**
 * ADALAT360 - Logger Utility
 * Winston-based structured logging with daily rotation
 */
import winston from 'winston';
export declare const logger: winston.Logger;
export declare function createChildLogger(meta: Record<string, any>): winston.Logger;
export declare function createRequestLogger(requestId: string, userId?: string, userRole?: string): winston.Logger;
export declare function logAudit(event: {
    eventType: string;
    userId?: string;
    userRole?: string;
    action: string;
    outcome: 'SUCCESS' | 'FAILURE' | 'DENIED' | 'ERROR';
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, any>;
}): void;
//# sourceMappingURL=logger.d.ts.map