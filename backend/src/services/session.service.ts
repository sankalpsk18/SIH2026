/**
 * ADALAT360 - Session Service
 * Redis-backed session management with token revocation
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { SessionData, ConcurrentSessionInfo, UserRole } from '../models/auth.js';
import { getTokenExpiry } from '../utils/jwt.js';

// ============================================================================
// REDIS CLIENT
// ============================================================================

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
            tls: config.redis.tls ? {} : undefined,
            keyPrefix: config.redis.keyPrefix,
            retryStrategy: (times) => {
                if (times > 3) return null; // Stop retrying
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

export async function closeRedisClient(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}

// ============================================================================
// KEY GENERATORS
// ============================================================================

const KEYS = {
    session: (sessionId: string) => `session:${sessionId}`,
    userSessions: (userId: string) => `user:sessions:${userId}`,
    revokedAccess: (tokenId: string) => `revoked:access:${tokenId}`,
    revokedRefresh: (tokenId: string) => `revoked:refresh:${tokenId}`,
    deviceTrust: (userId: string, deviceId: string) => `device:trust:${userId}:${deviceId}`,
    loginAttempts: (identifier: string) => `auth:attempts:${identifier}`,
    lockout: (identifier: string) => `auth:lockout:${identifier}`,
    mfaPending: (tokenId: string) => `mfa:pending:${tokenId}`,
    passwordReset: (tokenHash: string) => `auth:reset:${tokenHash}`,
};

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

const SESSION_TTL_SECONDS = 60 * 60; // 1 hour (matches JWT access token)
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (matches JWT refresh token)
const MAX_CONCURRENT_SESSIONS = 5;
const DEVICE_TRUST_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function createSession(
    userId: string,
    email: string,
    role: UserRole,
    department: string,
    caseIds: string[],
    permissions: string[],
    ipAddress?: string,
    userAgent?: string,
    deviceFingerprint?: string,
    mfaVerified: boolean = false
): Promise<SessionData> {
    const redis = getRedisClient();
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

    const session: SessionData = {
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
    await redis.setex(
        KEYS.session(sessionId),
        SESSION_TTL_SECONDS,
        JSON.stringify(session)
    );

    // Add to user's session set
    await redis.zadd(
        KEYS.userSessions(userId),
        now.getTime(),
        sessionId
    );

    // Enforce concurrent session limit
    await enforceConcurrentSessionLimit(userId);

    return session;
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
    const redis = getRedisClient();
    const data = await redis.get(KEYS.session(sessionId));
    if (!data) return null;

    const session = JSON.parse(data) as SessionData;

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
        await deleteSession(sessionId);
        return null;
    }

    return session;
}

export async function updateSessionActivity(sessionId: string): Promise<boolean> {
    const redis = getRedisClient();
    const data = await redis.get(KEYS.session(sessionId));
    if (!data) return false;

    const session = JSON.parse(data) as SessionData;
    session.last_activity_at = new Date();

    await redis.setex(
        KEYS.session(sessionId),
        SESSION_TTL_SECONDS,
        JSON.stringify(session)
    );

    return true;
}

export async function updateSessionMfaVerified(sessionId: string): Promise<boolean> {
    const redis = getRedisClient();
    const data = await redis.get(KEYS.session(sessionId));
    if (!data) return false;

    const session = JSON.parse(data) as SessionData;
    session.mfa_verified = true;

    await redis.setex(
        KEYS.session(sessionId),
        SESSION_TTL_SECONDS,
        JSON.stringify(session)
    );

    return true;
}

export async function deleteSession(sessionId: string): Promise<void> {
    const redis = getRedisClient();
    const data = await redis.get(KEYS.session(sessionId));
    if (data) {
        const session = JSON.parse(data) as SessionData;
        await redis.zrem(KEYS.userSessions(session.user_id), sessionId);
    }
    await redis.del(KEYS.session(sessionId));
}

export async function deleteAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
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

export async function getUserSessions(userId: string): Promise<ConcurrentSessionInfo[]> {
    const redis = getRedisClient();
    const sessionIds = await redis.zrange(KEYS.userSessions(userId), 0, -1);

    const sessions: ConcurrentSessionInfo[] = [];
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

async function enforceConcurrentSessionLimit(userId: string): Promise<void> {
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

export async function revokeAccessToken(tokenId: string, reason: string = 'revoked'): Promise<void> {
    const redis = getRedisClient();
    // Store revocation with TTL matching max token lifetime
    await redis.setex(KEYS.revokedAccess(tokenId), REFRESH_TTL_SECONDS, reason);
}

export async function revokeRefreshToken(tokenId: string, reason: string = 'revoked'): Promise<void> {
    const redis = getRedisClient();
    await redis.setex(KEYS.revokedRefresh(tokenId), REFRESH_TTL_SECONDS, reason);
}

export async function isAccessTokenRevoked(tokenId: string): Promise<boolean> {
    const redis = getRedisClient();
    return await redis.exists(KEYS.revokedAccess(tokenId)) === 1;
}

export async function isRefreshTokenRevoked(tokenId: string): Promise<boolean> {
    const redis = getRedisClient();
    return await redis.exists(KEYS.revokedRefresh(tokenId)) === 1;
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
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

export async function trustDevice(
    userId: string,
    deviceId: string,
    name: string,
    fingerprint: string
): Promise<void> {
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

    await redis.setex(
        KEYS.deviceTrust(userId, deviceId),
        DEVICE_TRUST_TTL_SECONDS,
        JSON.stringify(deviceData)
    );
}

export async function isDeviceTrusted(userId: string, deviceId: string, fingerprint: string): Promise<boolean> {
    const redis = getRedisClient();
    const data = await redis.get(KEYS.deviceTrust(userId, deviceId));
    if (!data) return false;

    const device = JSON.parse(data);
    if (device.fingerprint !== fingerprint) return false;
    if (new Date(device.expires_at) < new Date()) return false;

    // Update last used
    device.last_used_at = new Date().toISOString();
    await redis.setex(
        KEYS.deviceTrust(userId, deviceId),
        DEVICE_TRUST_TTL_SECONDS,
        JSON.stringify(device)
    );

    return true;
}

export async function revokeDeviceTrust(userId: string, deviceId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(KEYS.deviceTrust(userId, deviceId));
}

export async function getTrustedDevices(userId: string): Promise<any[]> {
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

export async function recordLoginAttempt(identifier: string, success: boolean): Promise<{ attempts: number; locked: boolean }> {
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

export async function isLockedOut(identifier: string): Promise<boolean> {
    const redis = getRedisClient();
    return await redis.exists(KEYS.lockout(identifier)) === 1;
}

export async function getLockoutRemaining(identifier: string): Promise<number> {
    const redis = getRedisClient();
    const ttl = await redis.ttl(KEYS.lockout(identifier));
    return Math.max(0, ttl);
}

export async function clearLockout(identifier: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(KEYS.lockout(identifier));
    await redis.del(KEYS.loginAttempts(identifier));
}

// ============================================================================
// MFA PENDING TOKENS
// ============================================================================

const MFA_PENDING_TTL_SECONDS = 5 * 60; // 5 minutes

export async function storeMfaPending(tokenId: string, userId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.setex(KEYS.mfaPending(tokenId), MFA_PENDING_TTL_SECONDS, userId);
}

export async function getMfaPendingUserId(tokenId: string): Promise<string | null> {
    const redis = getRedisClient();
    return await redis.get(KEYS.mfaPending(tokenId));
}

export async function consumeMfaPending(tokenId: string): Promise<string | null> {
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

export async function storePasswordResetToken(tokenHash: string, userId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.setex(KEYS.passwordReset(tokenHash), PASSWORD_RESET_TTL_SECONDS, userId);
}

export async function consumePasswordResetToken(tokenHash: string): Promise<string | null> {
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

export async function sessionHealthCheck(): Promise<boolean> {
    try {
        const redis = getRedisClient();
        await redis.ping();
        return true;
    } catch {
        return false;
    }
}