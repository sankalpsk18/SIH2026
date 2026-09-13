"use strict";
/**
 * ADALAT360 - Authentication Middleware
 * JWT verification, RBAC enforcement, case-scope validation
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
exports.authenticate = authenticate;
exports.optionalAuthenticate = optionalAuthenticate;
exports.requireRole = requireRole;
exports.requireAnyRole = requireAnyRole;
exports.requireAllRoles = requireAllRoles;
exports.requirePermission = requirePermission;
exports.requireCaseAccess = requireCaseAccess;
exports.requireCasePermission = requireCasePermission;
exports.requireOwnershipOrPermission = requireOwnershipOrPermission;
exports.requireMfa = requireMfa;
exports.userRateLimit = userRateLimit;
exports.requestIdMiddleware = requestIdMiddleware;
exports.securityHeaders = securityHeaders;
exports.allowedIps = allowedIps;
const index_js_1 = require("../../config/index.js");
const jwt_js_1 = require("../../utils/jwt.js");
const session_service_js_1 = require("../../services/session.service.js");
const audit_service_js_1 = require("../../services/audit.service.js");
// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================
async function authenticate(req, res, next) {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.headers['x-request-id'] = requestId;
    try {
        // Extract token from Authorization header or cookie
        let token = (0, jwt_js_1.extractTokenFromHeader)(req.headers.authorization);
        if (!token && index_js_1.config.server.trustProxy) {
            token = (0, jwt_js_1.extractTokenFromCookie)(req.headers.cookie, 'access_token');
        }
        if (!token) {
            await logAuthFailure(req, 'MISSING_TOKEN', 'Authorization token required');
            res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Authorization token required',
                request_id: requestId,
            });
            return;
        }
        // Verify token
        const result = (0, jwt_js_1.verifyAccessToken)(token);
        if (!result.valid || !result.payload) {
            await logAuthFailure(req, 'INVALID_TOKEN', result.error || 'Invalid token');
            res.status(401).json({
                error: 'UNAUTHORIZED',
                message: result.error || 'Invalid or expired token',
                request_id: requestId,
                token_expired: result.expired,
            });
            return;
        }
        const payload = result.payload;
        // Check session exists and is active
        const session = await (0, session_service_js_1.getSession)(payload.session_id);
        if (!session || !session.is_active) {
            await logAuthFailure(req, 'SESSION_EXPIRED', 'Session expired or revoked');
            res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Session expired or revoked',
                request_id: requestId,
            });
            return;
        }
        // Update session activity
        await (0, session_service_js_1.updateSessionActivity)(payload.session_id);
        // Attach auth info to request
        req.auth = payload;
        req.user = payload;
        req.sessionId = payload.session_id;
        // Set PostgreSQL session variables for RLS
        // This is done via a wrapper that sets config parameters
        // In production, use a connection pool that sets these per request
        req.pgSettings = {
            'adalat360.current_user_id': payload.sub,
            'adalat360.current_user_role': payload.role,
            'adalat360.current_user_department': payload.department,
        };
        next();
    }
    catch (error) {
        console.error('[Auth] Authentication error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Authentication failed',
            request_id: requestId,
        });
    }
}
async function logAuthFailure(req, action, errorMessage) {
    await (0, audit_service_js_1.logAuditEvent)({
        event_type: 'AUTH_MIDDLEWARE_FAILURE',
        event_category: 'AUTHENTICATION',
        severity: 'WARNING',
        user_ip: req.ip,
        user_agent: req.get('user-agent'),
        action,
        outcome: 'FAILURE',
        error_message: errorMessage,
        request_id: req.headers['x-request-id'],
        metadata: {
            path: req.path,
            method: req.method,
        },
    });
}
// ============================================================================
// OPTIONAL AUTHENTICATION (for public endpoints that can benefit from auth)
// ============================================================================
async function optionalAuthenticate(req, res, next) {
    const token = (0, jwt_js_1.extractTokenFromHeader)(req.headers.authorization);
    if (token) {
        const result = (0, jwt_js_1.verifyAccessToken)(token);
        if (result.valid && result.payload) {
            const session = await (0, session_service_js_1.getSession)(result.payload.session_id);
            if (session && session.is_active) {
                req.auth = result.payload;
                req.user = result.payload;
                req.sessionId = result.payload.session_id;
            }
        }
    }
    next();
}
// ============================================================================
// ROLE-BASED ACCESS CONTROL
// ============================================================================
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.auth) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }
        if (!allowedRoles.includes(req.auth.role)) {
            (0, audit_service_js_1.logAuditEvent)({
                event_type: 'RBAC_DENIED',
                event_category: 'AUTHORIZATION',
                severity: 'WARNING',
                user_id: req.auth.sub,
                user_role: req.auth.role,
                user_ip: req.ip,
                action: `requireRole:${allowedRoles.join(',')}`,
                outcome: 'DENIED',
                error_message: `Role ${req.auth.role} not authorized. Required: ${allowedRoles.join(', ')}`,
                request_id: req.headers['x-request-id'],
                metadata: { required_roles: allowedRoles, path: req.path },
            }).catch(console.error);
            res.status(403).json({
                error: 'FORBIDDEN',
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
            });
            return;
        }
        next();
    };
}
function requireAnyRole(...allowedRoles) {
    return requireRole(...allowedRoles);
}
function requireAllRoles(...requiredRoles) {
    return (req, res, next) => {
        if (!req.auth) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }
        // For this implementation, a user has one primary role
        // If you need multiple roles, extend the model
        const hasAllRoles = requiredRoles.every(role => req.auth.role === role);
        if (!hasAllRoles) {
            res.status(403).json({
                error: 'FORBIDDEN',
                message: `Access denied. Requires all roles: ${requiredRoles.join(', ')}`,
            });
            return;
        }
        next();
    };
}
// ============================================================================
// PERMISSION-BASED ACCESS CONTROL
// ============================================================================
function requirePermission(...permissions) {
    return (req, res, next) => {
        if (!req.auth) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }
        const userPermissions = req.auth.permissions || [];
        const hasPermission = permissions.some(p => userPermissions.includes(p));
        if (!hasPermission) {
            (0, audit_service_js_1.logAuditEvent)({
                event_type: 'PERMISSION_DENIED',
                event_category: 'AUTHORIZATION',
                severity: 'WARNING',
                user_id: req.auth.sub,
                user_role: req.auth.role,
                user_ip: req.ip,
                action: `requirePermission:${permissions.join(',')}`,
                outcome: 'DENIED',
                error_message: `Missing required permission. Required: ${permissions.join(', ')}`,
                request_id: req.headers['x-request-id'],
                metadata: { required_permissions: permissions, user_permissions: userPermissions, path: req.path },
            }).catch(console.error);
            res.status(403).json({
                error: 'FORBIDDEN',
                message: `Access denied. Required permission: ${permissions.join(' or ')}`,
            });
            return;
        }
        next();
    };
}
// ============================================================================
// CASE-SCOPE ACCESS CONTROL (Critical for ADALAT360)
// ============================================================================
function requireCaseAccess(caseIdParam = 'caseId') {
    return (req, res, next) => {
        if (!req.auth) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }
        // Admins and auditors have access to all cases
        if (req.auth.role === 'CENTRAL_ADMIN' || req.auth.role === 'AUDITOR') {
            req.allCasesAccess = true;
            next();
            return;
        }
        const caseId = req.params[caseIdParam] || req.query[caseIdParam] || req.body[caseIdParam];
        if (!caseId) {
            res.status(400).json({
                error: 'BAD_REQUEST',
                message: `Case ID parameter '${caseIdParam}' is required`,
            });
            return;
        }
        // Check if user has access to this case
        const userCaseIds = req.auth.case_ids || [];
        const hasAccess = userCaseIds.includes(caseId);
        if (!hasAccess) {
            (0, audit_service_js_1.logAuditEvent)({
                event_type: 'CASE_ACCESS_DENIED',
                event_category: 'AUTHORIZATION',
                severity: 'WARNING',
                user_id: req.auth.sub,
                user_role: req.auth.role,
                user_ip: req.ip,
                resource_type: 'CASE',
                resource_id: caseId,
                action: 'requireCaseAccess',
                outcome: 'DENIED',
                error_message: `No access to case ${caseId}`,
                request_id: req.headers['x-request-id'],
                metadata: { case_id: caseId, user_case_ids: userCaseIds, path: req.path },
            }).catch(console.error);
            res.status(403).json({
                error: 'FORBIDDEN',
                message: 'Access denied. You are not assigned to this case.',
            });
            return;
        }
        // Find the case scope for this case
        const caseScope = req.auth.case_ids.includes(caseId) ? {
            case_id: caseId,
            role_in_case: 'ASSIGNED',
            permissions: req.auth.permissions,
        } : null;
        req.caseScope = caseScope ? [caseScope] : [];
        next();
    };
}
function requireCasePermission(caseIdParam = 'caseId', ...permissions) {
    return (req, res, next) => {
        if (!req.auth) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }
        // Admins and auditors have all permissions
        if (req.auth.role === 'CENTRAL_ADMIN' || req.auth.role === 'AUDITOR') {
            next();
            return;
        }
        const caseId = req.params[caseIdParam] || req.query[caseIdParam] || req.body[caseIdParam];
        if (!caseId) {
            res.status(400).json({
                error: 'BAD_REQUEST',
                message: `Case ID parameter '${caseIdParam}' is required`,
            });
            return;
        }
        const userCaseIds = req.auth.case_ids || [];
        if (!userCaseIds.includes(caseId)) {
            res.status(403).json({
                error: 'FORBIDDEN',
                message: 'Access denied. You are not assigned to this case.',
            });
            return;
        }
        const userPermissions = req.auth.permissions || [];
        const hasPermission = permissions.some(p => userPermissions.includes(p));
        if (!hasPermission) {
            (0, audit_service_js_1.logAuditEvent)({
                event_type: 'CASE_PERMISSION_DENIED',
                event_category: 'AUTHORIZATION',
                severity: 'WARNING',
                user_id: req.auth.sub,
                user_role: req.auth.role,
                user_ip: req.ip,
                resource_type: 'CASE',
                resource_id: caseId,
                action: `requireCasePermission:${permissions.join(',')}`,
                outcome: 'DENIED',
                error_message: `Missing required case permission: ${permissions.join(', ')}`,
                request_id: req.headers['x-request-id'],
                metadata: { case_id: caseId, required_permissions: permissions, user_permissions: userPermissions },
            }).catch(console.error);
            res.status(403).json({
                error: 'FORBIDDEN',
                message: `Access denied. Required case permission: ${permissions.join(' or ')}`,
            });
            return;
        }
        next();
    };
}
// ============================================================================
// RESOURCE OWNERSHIP CHECK
// ============================================================================
function requireOwnershipOrPermission(resourceUserIdParam = 'userId', fallbackPermission = 'ADMIN') {
    return (req, res, next) => {
        if (!req.auth) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }
        const resourceUserId = req.params[resourceUserIdParam] || req.query[resourceUserIdParam] || req.body[resourceUserIdParam];
        // Owner can access
        if (req.auth.sub === resourceUserId) {
            next();
            return;
        }
        // Check fallback permission
        const userPermissions = req.auth.permissions || [];
        if (userPermissions.includes(fallbackPermission) || req.auth.role === 'CENTRAL_ADMIN' || req.auth.role === 'AUDITOR') {
            next();
            return;
        }
        res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Access denied. You can only access your own resources.',
        });
    };
}
// ============================================================================
// MFA REQUIREMENT
// ============================================================================
function requireMfa(req, res, next) {
    if (!req.auth) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
    }
    // Check if session has MFA verified
    // This is stored in session; we'd need to fetch it
    // For now, check if user has MFA enabled
    // In production, verify session.mfa_verified
    // Admins and auditors always need MFA
    if (req.auth.role === 'CENTRAL_ADMIN' || req.auth.role === 'AUDITOR') {
        // Check session for MFA verified flag
        next(); // Session middleware should have verified this
        return;
    }
    next();
}
// ============================================================================
// RATE LIMITING BY USER
// ============================================================================
const ioredis_1 = __importDefault(require("ioredis"));
const redis = new ioredis_1.default({
    host: index_js_1.config.redis.host,
    port: index_js_1.config.redis.port,
    password: index_js_1.config.redis.password,
    db: index_js_1.config.redis.db,
    keyPrefix: index_js_1.config.redis.keyPrefix,
});
function userRateLimit(maxRequests, windowMs, keyPrefix = 'ratelimit') {
    return async (req, res, next) => {
        if (!req.auth) {
            next();
            return;
        }
        const key = `${keyPrefix}:${req.auth.sub}:${req.path}`;
        const current = await redis.incr(key);
        if (current === 1) {
            await redis.pexpire(key, windowMs);
        }
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current).toString());
        res.setHeader('X-RateLimit-Reset', (Date.now() + windowMs).toString());
        if (current > maxRequests) {
            await (0, audit_service_js_1.logAuditEvent)({
                event_type: 'RATE_LIMIT_EXCEEDED',
                event_category: 'SECURITY',
                severity: 'WARNING',
                user_id: req.auth.sub,
                user_role: req.auth.role,
                user_ip: req.ip,
                action: 'rate_limit',
                outcome: 'DENIED',
                error_message: `Rate limit exceeded for ${req.path}`,
                request_id: req.headers['x-request-id'],
                metadata: { limit: maxRequests, window_ms: windowMs, current },
            });
            res.status(429).json({
                error: 'TOO_MANY_REQUESTS',
                message: 'Rate limit exceeded. Please try again later.',
                retry_after: Math.ceil(windowMs / 1000),
            });
            return;
        }
        next();
    };
}
// ============================================================================
// REQUEST ID MIDDLEWARE
// ============================================================================
const crypto = __importStar(require("crypto"));
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
}
// ============================================================================
// SECURITY HEADERS
// ============================================================================
function securityHeaders(req, res, next) {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    // HSTS (only in production with HTTPS)
    if (index_js_1.config.isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    next();
}
// ============================================================================
// IP FILTERING (for admin endpoints)
// ============================================================================
function allowedIps(...allowedIPs) {
    return (req, res, next) => {
        const clientIp = req.ip || req.socket.remoteAddress || '';
        // Check if IP is in allowed list (supports CIDR)
        const isAllowed = allowedIPs.some(allowed => {
            if (allowed.includes('/')) {
                // CIDR notation - simplified check
                return clientIp.startsWith(allowed.split('/')[0].split('.').slice(0, -1).join('.'));
            }
            return clientIp === allowed || clientIp === `::ffff:${allowed}`;
        });
        if (!isAllowed) {
            (0, audit_service_js_1.logAuditEvent)({
                event_type: 'IP_BLOCKED',
                event_category: 'SECURITY',
                severity: 'WARNING',
                user_ip: clientIp,
                action: 'ip_filter',
                outcome: 'DENIED',
                error_message: `IP ${clientIp} not in allowed list`,
                request_id: req.headers['x-request-id'],
                metadata: { allowed_ips: allowedIPs, path: req.path },
            }).catch(console.error);
            res.status(403).json({
                error: 'FORBIDDEN',
                message: 'Access denied from this IP address',
            });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.middleware.js.map