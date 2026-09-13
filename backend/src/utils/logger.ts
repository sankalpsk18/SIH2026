/**
 * ADALAT360 - Logger Utility
 * Winston-based structured logging with daily rotation
 */

import winston from 'winston';
import winstonDaily from 'winston-daily-rotate-file';
import * as path from 'path';
import { config } from '../config/index.js';

// ============================================================================
// LOG FORMATS
// ============================================================================

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, requestId, userId, userRole, method, path, ip, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]`;
        if (requestId) log += ` [req:${requestId}]`;
        if (userId) log += ` [user:${userId}]`;
        if (userRole) log += ` [role:${userRole}]`;
        if (method && path) log += ` ${method} ${path}`;
        if (ip) log += ` [ip:${ip}]`;
        log += `: ${message}`;
        if (Object.keys(meta).length > 0) log += ` ${JSON.stringify(meta)}`;
        if (stack) log += `\n${stack}`;
        return log;
    })
);

const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// ============================================================================
// TRANSPORTS
// ============================================================================

const transports: winston.transport[] = [];

// Console transport (development)
if (config.audit.enableConsole) {
    transports.push(new winston.transports.Console({
        format: config.isProduction ? jsonFormat : logFormat,
        level: config.audit.logLevel,
    }));
}

// File transport (production)
if (config.audit.enableFile) {
    const logDir = config.audit.logDir;

    // Application logs
    transports.push(new winstonDaily({
        dirname: logDir,
        filename: 'adalat360-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: config.audit.retentionDays.toString(),
        maxSize: '100m',
        format: jsonFormat,
        level: config.audit.logLevel,
    }));

    // Error logs
    transports.push(new winstonDaily({
        dirname: logDir,
        filename: 'adalat360-error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: config.audit.retentionDays.toString(),
        maxSize: '50m',
        format: jsonFormat,
        level: 'error',
    }));

    // Audit logs (separate file for compliance)
    transports.push(new winstonDaily({
        dirname: path.join(logDir, 'audit'),
        filename: 'audit-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: (config.audit.retentionDays * 2).toString(), // Keep longer
        maxSize: '50m',
        format: jsonFormat,
        level: 'info',
    }));
}

// ============================================================================
// LOGGER INSTANCE
// ============================================================================

export const logger = winston.createLogger({
    level: config.audit.logLevel,
    format: jsonFormat,
    defaultMeta: {
        service: 'adalat360-backend',
        environment: config.env,
        version: '1.0.0',
    },
    transports,
    exitOnError: false,
});

// ============================================================================
// CHILD LOGGERS
// ============================================================================

export function createChildLogger(meta: Record<string, any>): winston.Logger {
    return logger.child(meta);
}

export function createRequestLogger(requestId: string, userId?: string, userRole?: string): winston.Logger {
    return logger.child({ requestId, userId, userRole });
}

// ============================================================================
// AUDIT LOGGING HELPER
// ============================================================================

export function logAudit(event: {
    eventType: string;
    userId?: string;
    userRole?: string;
    action: string;
    outcome: 'SUCCESS' | 'FAILURE' | 'DENIED' | 'ERROR';
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, any>;
}): void {
    logger.info('AUDIT', {
        ...event,
        timestamp: new Date().toISOString(),
        audit: true,
    });
}