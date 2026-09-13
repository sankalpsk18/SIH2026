/**
 * ADALAT360 - JWT Utilities
 * Token generation, verification, and management
 */

import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import {
    AccessTokenPayload,
    RefreshTokenPayload,
    MfaTokenPayload,
    UserRole,
} from '../models/auth.js';

// ============================================================================
// TOKEN GENERATION
// ============================================================================

export function generateAccessToken(payload: Omit<AccessTokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud'>): string {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + parseDuration(config.jwt.accessTokenExpiry);

    const tokenPayload: AccessTokenPayload = {
        ...payload,
        type: 'access',
        iat: now,
        exp: expiry,
        iss: config.jwt.issuer,
        aud: config.jwt.audience,
    };

    return jwt.sign(tokenPayload, config.jwt.secret, {
        algorithm: 'HS256',
        jwtid: uuidv4(),
    });
}

export function generateRefreshToken(payload: Omit<RefreshTokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud'>): string {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + parseDuration(config.jwt.refreshTokenExpiry);

    const tokenPayload: RefreshTokenPayload = {
        ...payload,
        type: 'refresh',
        iat: now,
        exp: expiry,
        iss: config.jwt.issuer,
        aud: config.jwt.audience,
    };

    return jwt.sign(tokenPayload, config.jwt.refreshSecret, {
        algorithm: 'HS256',
        jwtid: uuidv4(),
    });
}

export function generateMfaPendingToken(payload: Omit<MfaTokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud' | 'pending_mfa'>): string {
    const now = Math.floor(Date.now() / 1000);
    // MFA tokens expire in 5 minutes
    const expiry = now + 300;

    const tokenPayload: MfaTokenPayload = {
        ...payload,
        pending_mfa: true,
        type: 'mfa_pending',
        iat: now,
        exp: expiry,
        iss: config.jwt.issuer,
        aud: config.jwt.audience,
    };

    return jwt.sign(tokenPayload, config.jwt.secret, {
        algorithm: 'HS256',
        jwtid: uuidv4(),
    });
}

// ============================================================================
// TOKEN VERIFICATION
// ============================================================================

export interface VerifiedToken<T> {
    valid: boolean;
    payload?: T;
    error?: string;
    expired?: boolean;
}

export function verifyAccessToken(token: string): VerifiedToken<AccessTokenPayload> {
    try {
        const payload = jwt.verify(token, config.jwt.secret, {
            algorithms: ['HS256'],
            issuer: config.jwt.issuer,
            audience: config.jwt.audience,
        }) as AccessTokenPayload;

        if (payload.type !== 'access') {
            return { valid: false, error: 'Invalid token type' };
        }

        return { valid: true, payload };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return { valid: false, error: 'Token expired', expired: true };
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return { valid: false, error: error.message };
        }
        return { valid: false, error: 'Token verification failed' };
    }
}

export function verifyRefreshToken(token: string): VerifiedToken<RefreshTokenPayload> {
    try {
        const payload = jwt.verify(token, config.jwt.refreshSecret, {
            algorithms: ['HS256'],
            issuer: config.jwt.issuer,
            audience: config.jwt.audience,
        }) as RefreshTokenPayload;

        if (payload.type !== 'refresh') {
            return { valid: false, error: 'Invalid token type' };
        }

        return { valid: true, payload };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return { valid: false, error: 'Token expired', expired: true };
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return { valid: false, error: error.message };
        }
        return { valid: false, error: 'Token verification failed' };
    }
}

export function verifyMfaToken(token: string): VerifiedToken<MfaTokenPayload> {
    try {
        const payload = jwt.verify(token, config.jwt.secret, {
            algorithms: ['HS256'],
            issuer: config.jwt.issuer,
            audience: config.jwt.audience,
        }) as MfaTokenPayload;

        if (payload.type !== 'mfa_pending' || !payload.pending_mfa) {
            return { valid: false, error: 'Invalid MFA token' };
        }

        return { valid: true, payload };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return { valid: false, error: 'MFA token expired', expired: true };
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return { valid: false, error: error.message };
        }
        return { valid: false, error: 'MFA token verification failed' };
    }
}

// ============================================================================
// TOKEN DECODING (without verification - for debugging/logging)
// ============================================================================

export function decodeToken<T>(token: string): T | null {
    try {
        return jwt.decode(token) as T;
    } catch {
        return null;
    }
}

// ============================================================================
// TOKEN EXTRACTION
// ============================================================================

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return null;
    }

    return parts[1];
}

export function extractTokenFromCookie(cookies: string | undefined, cookieName: string): string | null {
    if (!cookies) return null;

    const cookieArray = cookies.split(';');
    for (const cookie of cookieArray) {
        const [name, value] = cookie.trim().split('=');
        if (name === cookieName) {
            return value;
        }
    }
    return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
        // Default to 15 minutes
        return 15 * 60;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 60 * 60;
        case 'd': return value * 60 * 60 * 24;
        default: return 15 * 60;
    }
}

export function getTokenExpiry(token: string): Date | null {
    const decoded = decodeToken<{ exp: number }>(token);
    if (!decoded || !decoded.exp) return null;
    return new Date(decoded.exp * 1000);
}

export function isTokenNearExpiry(token: string, thresholdMinutes: number = 5): boolean {
    const expiry = getTokenExpiry(token);
    if (!expiry) return true;
    const now = new Date();
    const diffMinutes = (expiry.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes <= thresholdMinutes;
}

// ============================================================================
// TOKEN REVOCATION (using Redis - implemented in session service)
// ============================================================================

export interface TokenRevocationCheck {
    isRevoked: boolean;
    reason?: string;
}

// This will be implemented in the session service with Redis
export async function checkTokenRevocation(
    _tokenId: string,
    _tokenType: 'access' | 'refresh'
): Promise<TokenRevocationCheck> {
    // Implemented in session service
    return { isRevoked: false };
}

export async function revokeToken(
    _tokenId: string,
    _tokenType: 'access' | 'refresh',
    _reason: string
): Promise<void> {
    // Implemented in session service
}

// ============================================================================
// PAIRWISE TOKEN GENERATION (for login)
// ============================================================================

export interface TokenPair {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: 'Bearer';
}

export function generateTokenPair(
    userId: string,
    email: string,
    role: UserRole,
    department: string,
    caseIds: string[],
    permissions: string[],
    sessionId: string
): TokenPair {
    const accessToken = generateAccessToken({
        sub: userId,
        email,
        role,
        department,
        case_ids: caseIds,
        permissions,
        session_id: sessionId,
    });

    const refreshToken = generateRefreshToken({
        sub: userId,
        session_id: sessionId,
    });

    const expiry = parseDuration(config.jwt.accessTokenExpiry);

    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiry,
        token_type: 'Bearer',
    };
}