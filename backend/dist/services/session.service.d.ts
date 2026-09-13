/**
 * ADALAT360 - Session Service
 * Redis-backed session management with token revocation
 */
import Redis from 'ioredis';
import { SessionData, ConcurrentSessionInfo, UserRole } from '../models/auth.js';
export declare function getRedisClient(): Redis;
export declare function closeRedisClient(): Promise<void>;
export declare function createSession(userId: string, email: string, role: UserRole, department: string, caseIds: string[], permissions: string[], ipAddress?: string, userAgent?: string, deviceFingerprint?: string, mfaVerified?: boolean): Promise<SessionData>;
export declare function getSession(sessionId: string): Promise<SessionData | null>;
export declare function updateSessionActivity(sessionId: string): Promise<boolean>;
export declare function updateSessionMfaVerified(sessionId: string): Promise<boolean>;
export declare function deleteSession(sessionId: string): Promise<void>;
export declare function deleteAllUserSessions(userId: string, exceptSessionId?: string): Promise<number>;
export declare function getUserSessions(userId: string): Promise<ConcurrentSessionInfo[]>;
export declare function revokeAccessToken(tokenId: string, reason?: string): Promise<void>;
export declare function revokeRefreshToken(tokenId: string, reason?: string): Promise<void>;
export declare function isAccessTokenRevoked(tokenId: string): Promise<boolean>;
export declare function isRefreshTokenRevoked(tokenId: string): Promise<boolean>;
export declare function revokeAllUserTokens(userId: string): Promise<void>;
export declare function trustDevice(userId: string, deviceId: string, name: string, fingerprint: string): Promise<void>;
export declare function isDeviceTrusted(userId: string, deviceId: string, fingerprint: string): Promise<boolean>;
export declare function revokeDeviceTrust(userId: string, deviceId: string): Promise<void>;
export declare function getTrustedDevices(userId: string): Promise<any[]>;
export declare function recordLoginAttempt(identifier: string, success: boolean): Promise<{
    attempts: number;
    locked: boolean;
}>;
export declare function isLockedOut(identifier: string): Promise<boolean>;
export declare function getLockoutRemaining(identifier: string): Promise<number>;
export declare function clearLockout(identifier: string): Promise<void>;
export declare function storeMfaPending(tokenId: string, userId: string): Promise<void>;
export declare function getMfaPendingUserId(tokenId: string): Promise<string | null>;
export declare function consumeMfaPending(tokenId: string): Promise<string | null>;
export declare function storePasswordResetToken(tokenHash: string, userId: string): Promise<void>;
export declare function consumePasswordResetToken(tokenHash: string): Promise<string | null>;
export declare function sessionHealthCheck(): Promise<boolean>;
//# sourceMappingURL=session.service.d.ts.map