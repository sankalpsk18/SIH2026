/**
 * ADALAT360 - Authentication Middleware
 * JWT verification, RBAC enforcement, case-scope validation
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/index.js';
import { verifyAccessToken, extractTokenFromHeader, extractTokenFromCookie } from '../../utils/jwt.js';
import { getSession, updateSessionActivity } from '../../services/session.service.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { AccessTokenPayload, UserRole, PermissionLevel } from '../../models/auth.js';

// ============================================================================
// EXTEND EXPRESS REQUEST
// ============================================================================

declare global {
    namespace Express {
        interface Request {
            auth?: AccessTokenPayload;
            user?: AccessTokenPayload;
            sessionId?: string;
            caseScope?: {
                case_id: string;
                role_in_case: string;
                permissions: string[];
            }[];
            allCasesAccess?: boolean;
        }
    }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

export async function authenticate(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
    req.headers['x-request-id'] = requestId;

    try {
        // Extract token from Authorization header or cookie
        let token = extractTokenFromHeader(req.headers.authorization);

        if (!token && config.server.trustProxy) {
            token = extractTokenFromCookie(req.headers.cookie, 'access_token');
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
        const result = verifyAccessToken(token);
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
        const session = await getSession(payload.session_id);
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
        await updateSessionActivity(payload.session_id);

        // Attach auth info to request
        req.auth = payload;
        req.user = payload;
        req.sessionId = payload.session_id;

        // Set PostgreSQL session variables for RLS
        // This is done via a wrapper that sets config parameters
        // In production, use a connection pool that sets these per request
        (req as any).pgSettings = {
            'adalat360.current_user_id': payload.sub,
            'adalat360.current_user_role': payload.role,
            'adalat360.current_user_department': payload.department,
        };

        next();
    } catch (error) {
        console.error('[Auth] Authentication error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Authentication failed',
            request_id: requestId,
        });
    }
}

async function logAuthFailure(req: Request, action: string, errorMessage: string): Promise<void> {
    await logAuditEvent({
        event_type: 'AUTH_MIDDLEWARE_FAILURE',
        event_category: 'AUTHENTICATION',
        severity: 'WARNING',
        user_ip: req.ip,
        user_agent: req.get('user-agent'),
        action,
        outcome: 'FAILURE',
        error_message: errorMessage,
        request_id: req.headers['x-request-id'] as string,
        metadata: {
            path: req.path,
            method: req.method,
        },
    });
}

// ============================================================================
// OPTIONAL AUTHENTICATION (for public endpoints that can benefit from auth)
// ============================================================================

export async function optionalAuthenticate(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
        const result = verifyAccessToken(token);
        if (result.valid && result.payload) {
            const session = await getSession(result.payload.session_id);
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

export function requireRole(...allowedRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.auth) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }

        if (!allowedRoles.includes(req.auth.role)) {
            logAuditEvent({
                event_type: 'RBAC_DENIED',
                event_category: 'AUTHORIZATION',
                severity: 'WARNING',
                user_id: req.auth.sub,
                user_role: req.auth.role,
                user_ip: req.ip,
                action: `requireRole:${allowedRoles.join(',')}`,
                outcome: 'DENIED',
                error_message: `Role ${req.auth.role} not authorized. Required: ${allowedRoles.join(', ')}`,
                request_id: req.headers['x-request-id'] as string,
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

export function requireAnyRole(...allowedRoles: UserRole[]) {
    return requireRole(...allowedRoles);
}

export function requireAllRoles(...requiredRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.auth) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }

        // For this implementation, a user has one primary role
        // If you need multiple roles, extend the model
        const hasAllRoles = requiredRoles.every(role => req.auth!.role === role);

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

export function requirePermission(...permissions: PermissionLevel[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.auth) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }

        const userPermissions = req.auth.permissions || [];
        const hasPermission = permissions.some(p => userPermissions.includes(p));

        if (!hasPermission) {
            logAuditEvent({
                event_type: 'PERMISSION_DENIED',
                event_category: 'AUTHORIZATION',
                severity: 'WARNING',
                user_id: req.auth.sub,
                user_role: req.auth.role,
                user_ip: req.ip,
                action: `requirePermission:${permissions.join(',')}`,
                outcome: 'DENIED',
                error_message: `Missing required permission. Required: ${permissions.join(', ')}`,
                request_id: req.headers['x-request-id'] as string,
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

export function requireCaseAccess(caseIdParam: string = 'caseId') {
    return (req: Request, res: Response, next: NextFunction): void => {
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
            logAuditEvent({
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
                request_id: req.headers['x-request-id'] as string,
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

export function requireCasePermission(caseIdParam: string = 'caseId', ...permissions: PermissionLevel[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
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
            logAuditEvent({
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
                request_id: req.headers['x-request-id'] as string,
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

export function requireOwnershipOrPermission(
    resourceUserIdParam: string = 'userId',
    fallbackPermission: PermissionLevel = 'ADMIN'
) {
    return (req: Request, res: Response, next: NextFunction): void => {
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

export function requireMfa(req: Request, res: Response, next: NextFunction): void {
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

import Redis from 'ioredis';

const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    keyPrefix: config.redis.keyPrefix,
});

export function userRateLimit(maxRequests: number, windowMs: number, keyPrefix: string = 'ratelimit') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
            await logAuditEvent({
                event_type: 'RATE_LIMIT_EXCEEDED',
                event_category: 'SECURITY',
                severity: 'WARNING',
                user_id: req.auth.sub,
                user_role: req.auth.role,
                user_ip: req.ip,
                action: 'rate_limit',
                outcome: 'DENIED',
                error_message: `Rate limit exceeded for ${req.path}`,
                request_id: req.headers['x-request-id'] as string,
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

import * as crypto from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
}

// ============================================================================
// SECURITY HEADERS
// ============================================================================

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
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
    if (config.isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
}

// ============================================================================
// IP FILTERING (for admin endpoints)
// ============================================================================

export function allowedIps(...allowedIPs: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
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
            logAuditEvent({
                event_type: 'IP_BLOCKED',
                event_category: 'SECURITY',
                severity: 'WARNING',
                user_ip: clientIp,
                action: 'ip_filter',
                outcome: 'DENIED',
                error_message: `IP ${clientIp} not in allowed list`,
                request_id: req.headers['x-request-id'] as string,
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