/**
 * ADALAT360 - MFA Utilities
 * TOTP (RFC 6238) implementation with speakeasy
 */

import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { config } from '../config/index.js';
import { MfaSetupResponse } from '../models/auth.js';
import { generateBackupCodes, hashBackupCodes } from './password.js';

// ============================================================================
// TOTP SECRET GENERATION
// ============================================================================

export function generateTotpSecret(): { secret: string; otpauth_url: string } {
    const secret = speakeasy.generateSecret({
        name: `ADALAT360 (${config.mfa.issuer})`,
        length: 20,
        issuer: config.mfa.issuer,
    });

    return {
        secret: secret.base32,
        otpauth_url: secret.otpauth_url!,
    };
}

// ============================================================================
// TOTP VERIFICATION
// ============================================================================

export interface TotpVerifyOptions {
    token: string;
    secret: string;
    window?: number;
    algorithm?: 'sha1' | 'sha256' | 'sha512';
}

export function verifyTotp(options: TotpVerifyOptions): boolean {
    return speakeasy.totp.verify({
        token: options.token,
        secret: options.secret,
        encoding: 'base32',
        window: options.window ?? config.mfa.window,
        algorithm: options.algorithm ?? config.mfa.algorithm,
        digits: config.mfa.digits,
        step: config.mfa.period,
    });
}

export function verifyTotpDelta(options: TotpVerifyOptions): number | null {
    const verified = speakeasy.totp.verifyDelta({
        token: options.token,
        secret: options.secret,
        encoding: 'base32',
        window: options.window ?? config.mfa.window,
        algorithm: options.algorithm ?? config.mfa.algorithm,
        digits: config.mfa.digits,
        step: config.mfa.period,
    });

    return verified !== null ? verified.delta : null;
}

// ============================================================================
// TOTP GENERATION (for testing/display)
// ============================================================================

export function generateTotpToken(secret: string): string {
    return speakeasy.totp({
        secret,
        encoding: 'base32',
        algorithm: config.mfa.algorithm,
        digits: config.mfa.digits,
        step: config.mfa.period,
    });
}

export function getTotpTimeRemaining(): number {
    const now = Math.floor(Date.now() / 1000);
    const step = config.mfa.period;
    return step - (now % step);
}

// ============================================================================
// QR CODE GENERATION
// ============================================================================

export async function generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl, {
        width: 300,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
    });
}

export async function generateQrCodeSvg(otpauthUrl: string): Promise<string> {
    return QRCode.toString(otpauthUrl, {
        type: 'svg',
        width: 300,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
    });
}

// ============================================================================
// MFA SETUP FLOW
// ============================================================================

export async function setupMfa(userEmail: string): Promise<MfaSetupResponse> {
    const { secret, otpauth_url } = generateTotpSecret();

    // Create otpauth URL with user email
    const otpauthWithUser = otpauth_url.replace(
        `issuer=${encodeURIComponent(config.mfa.issuer)}`,
        `issuer=${encodeURIComponent(config.mfa.issuer)}&label=${encodeURIComponent(`${config.mfa.issuer}:${userEmail}`)}`
    );

    const qr_code_url = await generateQrCodeDataUrl(otpauthWithUser);
    const backup_codes = generateBackupCodes(10, 8);
    const hashed_backup_codes = await hashBackupCodes(backup_codes);

    // Format secret for manual entry (groups of 4)
    const manual_entry_key = secret.match(/.{1,4}/g)?.join(' ') || secret;

    return {
        secret,
        qr_code_url,
        backup_codes,
        manual_entry_key,
    };
}

// ============================================================================
// BACKUP CODE VERIFICATION
// ============================================================================

export async function verifyBackupCode(inputCode: string, hashedCodes: string[]): Promise<{ valid: boolean; index?: number }> {
    const normalized = inputCode.replace('-', '').toUpperCase();
    for (let i = 0; i < hashedCodes.length; i++) {
        // We need to verify against bcrypt hash
        // This is imported from password utils to avoid circular deps
        const bcrypt = await import('bcryptjs');
        const match = await bcrypt.compare(normalized, hashedCodes[i]);
        if (match) {
            return { valid: true, index: i };
        }
    }
    return { valid: false };
}

// ============================================================================
// MFA RECOVERY
// ============================================================================

export interface MfaRecoveryOptions {
    userId: string;
    email: string;
    verifiedBackupCode: boolean;
    adminOverride?: boolean;
    adminUserId?: string;
}

export function canRecoverMfa(options: MfaRecoveryOptions): boolean {
    // Allow recovery if:
    // 1. User has verified a backup code
    // 2. Admin override (with audit trail)
    return options.verifiedBackupCode || !!options.adminOverride;
}

// ============================================================================
// TOTP URI PARSING (for importing from other authenticator apps)
// ============================================================================

export interface ParsedOtpAuth {
    type: 'totp' | 'hotp';
    label: string;
    issuer?: string;
    secret: string;
    algorithm: string;
    digits: number;
    period: number;
}

export function parseOtpAuthUri(uri: string): ParsedOtpAuth | null {
    try {
        const url = new URL(uri);
        if (url.protocol !== 'otpauth:') return null;

        const type = url.hostname as 'totp' | 'hotp';
        if (type !== 'totp' && type !== 'hotp') return null;

        const label = decodeURIComponent(url.pathname.slice(1));
        const params = url.searchParams;

        return {
            type,
            label,
            issuer: params.get('issuer') || undefined,
            secret: params.get('secret') || '',
            algorithm: params.get('algorithm') || 'SHA1',
            digits: parseInt(params.get('digits') || '6', 10),
            period: parseInt(params.get('period') || '30', 10),
        };
    } catch {
        return null;
    }
}

// ============================================================================
// DEVICE TRUST (Remember device for MFA)
// ============================================================================

export interface TrustedDevice {
    device_id: string;
    user_id: string;
    name: string;
    fingerprint: string;
    created_at: Date;
    last_used_at: Date;
    expires_at: Date;
}

export const DEVICE_TRUST_DURATION_DAYS = 30;

export function generateDeviceId(): string {
    return crypto.randomBytes(16).toString('hex');
}

export function createDeviceFingerprint(userAgent: string, additionalEntropy?: string): string {
    const data = `${userAgent}|${additionalEntropy || ''}|${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

// ============================================================================
// RISK-BASED MFA
// ============================================================================

export interface MfaRiskAssessment {
    requireMfa: boolean;
    riskScore: number; // 0-100
    factors: string[];
    recommendedAction: 'allow' | 'require_mfa' | 'block' | 'admin_review';
}

export function assessMfaRisk(
    isNewDevice: boolean,
    isNewLocation: boolean,
    isNewIp: boolean,
    failedAttempts: number,
    timeSinceLastLogin: number, // hours
    userRole: string
): MfaRiskAssessment {
    let riskScore = 0;
    const factors: string[] = [];

    // Base risk by role
    const roleRisk: Record<string, number> = {
        CENTRAL_ADMIN: 30,
        AUDITOR: 25,
        PROSECUTOR: 20,
        COURT: 15,
        FORENSIC_LAB: 15,
        INVESTIGATING_OFFICER: 10,
    };
    riskScore += roleRisk[userRole] || 10;

    // Device/location factors
    if (isNewDevice) {
        riskScore += 25;
        factors.push('new_device');
    }
    if (isNewLocation) {
        riskScore += 15;
        factors.push('new_location');
    }
    if (isNewIp) {
        riskScore += 10;
        factors.push('new_ip');
    }

    // Failed attempts
    if (failedAttempts > 0) {
        riskScore += Math.min(failedAttempts * 5, 30);
        factors.push('recent_failed_attempts');
    }

    // Time since last login
    if (timeSinceLastLogin > 720) { // 30 days
        riskScore += 10;
        factors.push('long_inactivity');
    } else if (timeSinceLastLogin > 168) { // 7 days
        riskScore += 5;
        factors.push('week_inactivity');
    }

    // Determine action
    let recommendedAction: MfaRiskAssessment['recommendedAction'] = 'allow';
    if (riskScore >= 70) recommendedAction = 'block';
    else if (riskScore >= 40) recommendedAction = 'admin_review';
    else if (riskScore >= 20) recommendedAction = 'require_mfa';

    // Always require MFA for admins/auditors
    if (userRole === 'CENTRAL_ADMIN' || userRole === 'AUDITOR') {
        recommendedAction = 'require_mfa';
    }

    return {
        requireMfa: recommendedAction !== 'allow',
        riskScore: Math.min(riskScore, 100),
        factors,
        recommendedAction,
    };
}