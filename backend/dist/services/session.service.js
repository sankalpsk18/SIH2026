"use strict";
/**
 * ADALAT360 - Session Service
 * Redis-backed session management with token revocation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
exports.closeRedisClient = closeRedisClient;
exports.createSession = createSession;
exports.getSession = getSession;
exports.updateSessionActivity = updateSessionActivity;
exports.updateSessionMfaVerified = updateSessionMfaVerified;
exports.deleteSession = deleteSession;
exports.deleteAllUserSessions = deleteAllUserSessions;
exports.getUserSessions = getUserSessions;
exports.revokeAccessToken = revokeAccessToken;
exports.revokeRefreshToken = revokeRefreshToken;
exports.isAccessTokenRevoked = isAccessTokenRevoked;
exports.isRefreshTokenRevoked = isRefreshTokenRevoked;
exports.revokeAllUserTokens = revokeAllUserTokens;
exports.trustDevice = trustDevice;
exports.isDeviceTrusted = isDeviceTrusted;
exports.revokeDeviceTrust = revokeDeviceTrust;
exports.getTrustedDevices = getTrustedDevices;
exports.recordLoginAttempt = recordLoginAttempt;
exports.isLockedOut = isLockedOut;
exports.getLockoutRemaining = getLockoutRemaining;
exports.clearLockout = clearLockout;
exports.storeMfaPending = storeMfaPending;
exports.getMfaPendingUserId = getMfaPendingUserId;
exports.consumeMfaPending = consumeMfaPending;
exports.storePasswordResetToken = storePasswordResetToken;
exports.consumePasswordResetToken = consumePasswordResetToken;
exports.sessionHealthCheck = sessionHealthCheck;
const ioredis_1 = __importDefault(require("ioredis"));
const uuid_1 = require("uuid");
const index_js_1 = require("../config/index.js");
// ============================================================================
// REDIS CLIENT
// ============================================================================
let redisClient = null;
function getRedisClient() {
    if (!redisClient) {
        redisClient = new ioredis_1.default({
            host: index_js_1.config.redis.host,
            port: index_js_1.config.redis.port,
            password: index_js_1.config.redis.password,
            db: index_js_1.config.redis.db,
            tls: index_js_1.config.redis.tls ? {} : undefined,
            keyPrefix: index_js_1.config.redis.keyPrefix,
            retryStrategy: (times) => {
                if (times > 3)
                    return null; // Stop retrying
                return Math.min(times * 200, 2000);
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true,
        });
        redisClient.on('error', (err) => {
            console.error('[Session] Redis error:', err);
        });
        redisClient.on('connect', () => {
            console.log('[Session] Redis connected');
        });
    }
    return redisClient;
}
async function closeRedisClient() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}
// ============================================================================
// KEY GENERATORS
// ============================================================================
const KEYS = {
    session: (sessionId) => `session:${sessionId}`,
    userSessions: (userId) => `user:sessions:${userId}`,
    revokedAccess: (tokenId) => `revoked:access:${tokenId}`,
    revokedRefresh: (tokenId) => `revoked:refresh:${tokenId}`,
    deviceTrust: (userId, deviceId) => `device:trust:${userId}:${deviceId}`,
    loginAttempts: (identifier) => `auth:attempts:${identifier}`,
    lockout: (identifier) => `auth:lockout:${identifier}`,
    mfaPending: (tokenId) => `mfa:pending:${tokenId}`,
    passwordReset: (tokenHash) => `auth:reset:${tokenHash}`,
};
// ============================================================================
// SESSION MANAGEMENT
// ============================================================================
const SESSION_TTL_SECONDS = 60 * 60; // 1 hour (matches JWT access token)
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (matches JWT refresh token)
const MAX_CONCURRENT_SESSIONS = 5;
const DEVICE_TRUST_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
async function createSession(userId, email, role, department, caseIds, permissions, ipAddress, userAgent, deviceFingerprint, mfaVerified = false) {
    const redis = getRedisClient();
    const sessionId = (0, uuid_1.v4)();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    const session = {
        session_id: sessionId,
        user_id: userId,
        email,
        role,
        department,
        case_ids: caseIds,
        permissions,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_fingerprint: deviceFingerprint,
        created_at: now,
        last_activity_at: now,
        expires_at: expiresAt,
        is_active: true,
        mfa_verified: mfaVerified,
    };
    // Store session
    await redis.setex(KEYS.session(sessionId), SESSION_TTL_SECONDS, JSON.stringify(session));
    // Add to user's session set
    await redis.zadd(KEYS.userSessions(userId), now.getTime(), sessionId);
    // Enforce concurrent session limit
    await enforceConcurrentSessionLimit(userId);
    return session;
}
async function getSession(sessionId) {
    const redis = getRedisClient();
    const data = await redis.get(KEYS.session(sessionId));
    if (!data)
        return null;
    const session = JSON.parse(data);
    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
        await deleteSession(sessionId);
        return null;
    }
    return session;
}
async function updateSessionActivity(sessionId) {
    const redis = getRedisClient();
    const data = await redis.get(KEYS.session(sessionId));
    if (!data)
        return false;
    const session = JSON.parse(data);
    session.last_activity_at = new Date();
    await redis.setex(KEYS.session(sessionId), SESSION_TTL_SECONDS, JSON.stringify(session));
    return true;
}
async function updateSessionMfaVerified(sessionId) {
    const redis = getRedisClient();
    const data = await redis.get(KEYS.session(sessionId));
    if (!data)
        return false;
    const session = JSON.parse(data);
    session.mfa_verified = true;
    await redis.setex(KEYS.session(sessionId), SESSION_TTL_SECONDS, JSON.stringify(session));
    return true;
}
async function deleteSession(sessionId) {
    const redis = getRedisClient();
    const data = await redis.get(KEYS.session(sessionId));
    if (data) {
        const session = JSON.parse(data);
        await redis.zrem(KEYS.userSessions(session.user_id), sessionId);
    }
    await redis.del(KEYS.session(sessionId));
}
async function deleteAllUserSessions(userId, exceptSessionId) {
    const redis = getRedisClient();
    const sessionIds = await redis.zrange(KEYS.userSessions(userId), 0, -1);
    let deleted = 0;
    for (const sessionId of sessionIds) {
        if (sessionId !== exceptSessionId) {
            await deleteSession(sessionId);
            deleted++;
        }
    }
    return deleted;
}
async function getUserSessions(userId) {
    const redis = getRedisClient();
    const sessionIds = await redis.zrange(KEYS.userSessions(userId), 0, -1);
    const sessions = [];
    for (const sessionId of sessionIds) {
        const session = await getSession(sessionId);
        if (session) {
            sessions.push({
                session_id: session.session_id,
                ip_address: session.ip_address,
                user_agent: session.user_agent,
                device_fingerprint: session.device_fingerprint,
                created_at: session.created_at,
                last_activity_at: session.last_activity_at,
                current: false, // Will be set by caller
            });
        }
    }
    return sessions;
}
async function enforceConcurrentSessionLimit(userId) {
    const redis = getRedisClient();
    const sessionIds = await redis.zrange(KEYS.userSessions(userId), 0, -1);
    if (sessionIds.length > MAX_CONCURRENT_SESSIONS) {
        // Remove oldest sessions (excluding the newest)
        const toRemove = sessionIds.slice(0, sessionIds.length - MAX_CONCURRENT_SESSIONS);
        for (const sessionId of toRemove) {
            await deleteSession(sessionId);
        }
    }
}
// ============================================================================
// TOKEN REVOCATION
// ============================================================================
async function revokeAccessToken(tokenId, reason = 'revoked') {
    const redis = getRedisClient();
    // Store revocation with TTL matching max token lifetime
    await redis.setex(KEYS.revokedAccess(tokenId), REFRESH_TTL_SECONDS, reason);
}
async function revokeRefreshToken(tokenId, reason = 'revoked') {
    const redis = getRedisClient();
    await redis.setex(KEYS.revokedRefresh(tokenId), REFRESH_TTL_SECONDS, reason);
}
async function isAccessTokenRevoked(tokenId) {
    const redis = getRedisClient();
    return await redis.exists(KEYS.revokedAccess(tokenId)) === 1;
}
async function isRefreshTokenRevoked(tokenId) {
    const redis = getRedisClient();
    return await redis.exists(KEYS.revokedRefresh(tokenId)) === 1;
}
async function revokeAllUserTokens(userId) {
    const redis = getRedisClient();
    const sessionIds = await redis.zrange(KEYS.userSessions(userId), 0, -1);
    for (const sessionId of sessionIds) {
        const session = await getSession(sessionId);
        if (session) {
            // Note: We can't easily get JWT IDs from session
            // In practice, we'd store token IDs in session or use a different approach
        }
    }
    // Delete all sessions
    await deleteAllUserSessions(userId);
}
// ============================================================================
// DEVICE TRUST
// ============================================================================
async function trustDevice(userId, deviceId, name, fingerprint) {
    const redis = getRedisClient();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEVICE_TRUST_TTL_SECONDS * 1000);
    const deviceData = {
        device_id: deviceId,
        user_id: userId,
        name,
        fingerprint,
        created_at: now.toISOString(),
        last_used_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
    };
    await redis.setex(KEYS.deviceTrust(userId, deviceId), DEVICE_TRUST_TTL_SECONDS, JSON.stringify(deviceData));
}
async function isDeviceTrusted(userId, deviceId, fingerprint) {
    const redis = getRedisClient();
    const data = await redis.get(KEYS.deviceTrust(userId, deviceId));
    if (!data)
        return false;
    const device = JSON.parse(data);
    if (device.fingerprint !== fingerprint)
        return false;
    if (new Date(device.expires_at) < new Date())
        return false;
    // Update last used
    device.last_used_at = new Date().toISOString();
    await redis.setex(KEYS.deviceTrust(userId, deviceId), DEVICE_TRUST_TTL_SECONDS, JSON.stringify(device));
    return true;
}
async function revokeDeviceTrust(userId, deviceId) {
    const redis = getRedisClient();
    await redis.del(KEYS.deviceTrust(userId, deviceId));
}
async function getTrustedDevices(userId) {
    const redis = getRedisClient();
    // This requires SCAN - simplified for now
    // In production, maintain a set of device IDs per user
    return [];
}
// ============================================================================
// LOGIN ATTEMPTS & LOCKOUT
// ============================================================================
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 30 * 60; // 30 minutes
const ATTEMPT_WINDOW_SECONDS = 15 * 60; // 15 minutes
async function recordLoginAttempt(identifier, success) {
    const redis = getRedisClient();
    if (success) {
        // Clear attempts on success
        await redis.del(KEYS.loginAttempts(identifier));
        await redis.del(KEYS.lockout(identifier));
        return { attempts: 0, locked: false };
    }
    // Increment failed attempts
    const key = KEYS.loginAttempts(identifier);
    const attempts = await redis.incr(key);
    if (attempts === 1) {
        await redis.expire(key, ATTEMPT_WINDOW_SECONDS);
    }
    // Check if should lock
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
        await redis.setex(KEYS.lockout(identifier), LOCKOUT_DURATION_SECONDS, '1');
        return { attempts, locked: true };
    }
    return { attempts, locked: false };
}
async function isLockedOut(identifier) {
    const redis = getRedisClient();
    return await redis.exists(KEYS.lockout(identifier)) === 1;
}
async function getLockoutRemaining(identifier) {
    const redis = getRedisClient();
    const ttl = await redis.ttl(KEYS.lockout(identifier));
    return Math.max(0, ttl);
}
async function clearLockout(identifier) {
    const redis = getRedisClient();
    await redis.del(KEYS.lockout(identifier));
    await redis.del(KEYS.loginAttempts(identifier));
}
// ============================================================================
// MFA PENDING TOKENS
// ============================================================================
const MFA_PENDING_TTL_SECONDS = 5 * 60; // 5 minutes
async function storeMfaPending(tokenId, userId) {
    const redis = getRedisClient();
    await redis.setex(KEYS.mfaPending(tokenId), MFA_PENDING_TTL_SECONDS, userId);
}
async function getMfaPendingUserId(tokenId) {
    const redis = getRedisClient();
    return await redis.get(KEYS.mfaPending(tokenId));
}
async function consumeMfaPending(tokenId) {
    const redis = getRedisClient();
    const userId = await redis.get(KEYS.mfaPending(tokenId));
    if (userId) {
        await redis.del(KEYS.mfaPending(tokenId));
    }
    return userId;
}
// ============================================================================
// PASSWORD RESET TOKENS
// ============================================================================
const PASSWORD_RESET_TTL_SECONDS = 60 * 60; // 1 hour
async function storePasswordResetToken(tokenHash, userId) {
    const redis = getRedisClient();
    await redis.setex(KEYS.passwordReset(tokenHash), PASSWORD_RESET_TTL_SECONDS, userId);
}
async function consumePasswordResetToken(tokenHash) {
    const redis = getRedisClient();
    const userId = await redis.get(KEYS.passwordReset(tokenHash));
    if (userId) {
        await redis.del(KEYS.passwordReset(tokenHash));
    }
    return userId;
}
// ============================================================================
// HEALTH CHECK
// ============================================================================
async function sessionHealthCheck() {
    try {
        const redis = getRedisClient();
        await redis.ping();
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=session.service.js.map