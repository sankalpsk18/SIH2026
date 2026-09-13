/**
 * ADALAT360 - MFA Utilities
 * TOTP (RFC 6238) implementation with speakeasy
 */
import { MfaSetupResponse } from '../models/auth.js';
export declare function generateTotpSecret(): {
    secret: string;
    otpauth_url: string;
};
export interface TotpVerifyOptions {
    token: string;
    secret: string;
    window?: number;
    algorithm?: 'sha1' | 'sha256' | 'sha512';
}
export declare function verifyTotp(options: TotpVerifyOptions): boolean;
export declare function verifyTotpDelta(options: TotpVerifyOptions): number | null;
export declare function generateTotpToken(secret: string): string;
export declare function getTotpTimeRemaining(): number;
export declare function generateQrCodeDataUrl(otpauthUrl: string): Promise<string>;
export declare function generateQrCodeSvg(otpauthUrl: string): Promise<string>;
export declare function setupMfa(userEmail: string): Promise<MfaSetupResponse>;
export declare function verifyBackupCode(inputCode: string, hashedCodes: string[]): Promise<{
    valid: boolean;
    index?: number;
}>;
export interface MfaRecoveryOptions {
    userId: string;
    email: string;
    verifiedBackupCode: boolean;
    adminOverride?: boolean;
    adminUserId?: string;
}
export declare function canRecoverMfa(options: MfaRecoveryOptions): boolean;
export interface ParsedOtpAuth {
    type: 'totp' | 'hotp';
    label: string;
    issuer?: string;
    secret: string;
    algorithm: string;
    digits: number;
    period: number;
}
export declare function parseOtpAuthUri(uri: string): ParsedOtpAuth | null;
export interface TrustedDevice {
    device_id: string;
    user_id: string;
    name: string;
    fingerprint: string;
    created_at: Date;
    last_used_at: Date;
    expires_at: Date;
}
export declare const DEVICE_TRUST_DURATION_DAYS = 30;
export declare function generateDeviceId(): string;
export declare function createDeviceFingerprint(userAgent: string, additionalEntropy?: string): string;
export interface MfaRiskAssessment {
    requireMfa: boolean;
    riskScore: number;
    factors: string[];
    recommendedAction: 'allow' | 'require_mfa' | 'block' | 'admin_review';
}
export declare function assessMfaRisk(isNewDevice: boolean, isNewLocation: boolean, isNewIp: boolean, failedAttempts: number, timeSinceLastLogin: number, // hours
userRole: string): MfaRiskAssessment;
//# sourceMappingURL=mfa.d.ts.map