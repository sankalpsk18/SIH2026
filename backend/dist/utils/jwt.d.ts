/**
 * ADALAT360 - JWT Utilities
 * Token generation, verification, and management
 */
import { AccessTokenPayload, RefreshTokenPayload, MfaTokenPayload, UserRole } from '../models/auth.js';
export declare function generateAccessToken(payload: Omit<AccessTokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud'>): string;
export declare function generateRefreshToken(payload: Omit<RefreshTokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud'>): string;
export declare function generateMfaPendingToken(payload: Omit<MfaTokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud' | 'pending_mfa'>): string;
export interface VerifiedToken<T> {
    valid: boolean;
    payload?: T;
    error?: string;
    expired?: boolean;
}
export declare function verifyAccessToken(token: string): VerifiedToken<AccessTokenPayload>;
export declare function verifyRefreshToken(token: string): VerifiedToken<RefreshTokenPayload>;
export declare function verifyMfaToken(token: string): VerifiedToken<MfaTokenPayload>;
export declare function decodeToken<T>(token: string): T | null;
export declare function extractTokenFromHeader(authHeader: string | undefined): string | null;
export declare function extractTokenFromCookie(cookies: string | undefined, cookieName: string): string | null;
export declare function getTokenExpiry(token: string): Date | null;
export declare function isTokenNearExpiry(token: string, thresholdMinutes?: number): boolean;
export interface TokenRevocationCheck {
    isRevoked: boolean;
    reason?: string;
}
export declare function checkTokenRevocation(_tokenId: string, _tokenType: 'access' | 'refresh'): Promise<TokenRevocationCheck>;
export declare function revokeToken(_tokenId: string, _tokenType: 'access' | 'refresh', _reason: string): Promise<void>;
export interface TokenPair {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: 'Bearer';
}
export declare function generateTokenPair(userId: string, email: string, role: UserRole, department: string, caseIds: string[], permissions: string[], sessionId: string): TokenPair;
//# sourceMappingURL=jwt.d.ts.map