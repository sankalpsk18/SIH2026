"use strict";
/**
 * ADALAT360 - Logger Utility
 * Winston-based structured logging with daily rotation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createChildLogger = createChildLogger;
exports.createRequestLogger = createRequestLogger;
exports.logAudit = logAudit;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path = __importStar(require("path"));
const index_js_1 = require("../config/index.js");
// ============================================================================
// LOG FORMATS
// ============================================================================
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf(({ timestamp, level, message, requestId, userId, userRole, method, path, ip, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]`;
    if (requestId)
        log += ` [req:${requestId}]`;
    if (userId)
        log += ` [user:${userId}]`;
    if (userRole)
        log += ` [role:${userRole}]`;
    if (method && path)
        log += ` ${method} ${path}`;
    if (ip)
        log += ` [ip:${ip}]`;
    log += `: ${message}`;
    if (Object.keys(meta).length > 0)
        log += ` ${JSON.stringify(meta)}`;
    if (stack)
        log += `\n${stack}`;
    return log;
}));
const jsonFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
// ============================================================================
// TRANSPORTS
// ============================================================================
const transports = [];
// Console transport (development)
if (index_js_1.config.audit.enableConsole) {
    transports.push(new winston_1.default.transports.Console({
        format: index_js_1.config.isProduction ? jsonFormat : logFormat,
        level: index_js_1.config.audit.logLevel,
    }));
}
// File transport (production)
if (index_js_1.config.audit.enableFile) {
    const logDir = index_js_1.config.audit.logDir;
    // Application logs
    transports.push(new winston_daily_rotate_file_1.default({
        dirname: logDir,
        filename: 'adalat360-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: index_js_1.config.audit.retentionDays.toString(),
        maxSize: '100m',
        format: jsonFormat,
        level: index_js_1.config.audit.logLevel,
    }));
    // Error logs
    transports.push(new winston_daily_rotate_file_1.default({
        dirname: logDir,
        filename: 'adalat360-error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: index_js_1.config.audit.retentionDays.toString(),
        maxSize: '50m',
        format: jsonFormat,
        level: 'error',
    }));
    // Audit logs (separate file for compliance)
    transports.push(new winston_daily_rotate_file_1.default({
        dirname: path.join(logDir, 'audit'),
        filename: 'audit-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: (index_js_1.config.audit.retentionDays * 2).toString(), // Keep longer
        maxSize: '50m',
        format: jsonFormat,
        level: 'info',
    }));
}
// ============================================================================
// LOGGER INSTANCE
// ============================================================================
exports.logger = winston_1.default.createLogger({
    level: index_js_1.config.audit.logLevel,
    format: jsonFormat,
    defaultMeta: {
        service: 'adalat360-backend',
        environment: index_js_1.config.env,
        version: '1.0.0',
    },
    transports,
    exitOnError: false,
});
// ============================================================================
// CHILD LOGGERS
// ============================================================================
function createChildLogger(meta) {
    return exports.logger.child(meta);
}
function createRequestLogger(requestId, userId, userRole) {
    return exports.logger.child({ requestId, userId, userRole });
}
// ============================================================================
// AUDIT LOGGING HELPER
// ============================================================================
function logAudit(event) {
    exports.logger.info('AUDIT', {
        ...event,
        timestamp: new Date().toISOString(),
        audit: true,
    });
}
//# sourceMappingURL=logger.js.map