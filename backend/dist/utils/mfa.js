"use strict";
/**
 * ADALAT360 - MFA Utilities
 * TOTP (RFC 6238) implementation with speakeasy
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVICE_TRUST_DURATION_DAYS = void 0;
exports.generateTotpSecret = generateTotpSecret;
exports.verifyTotp = verifyTotp;
exports.verifyTotpDelta = verifyTotpDelta;
exports.generateTotpToken = generateTotpToken;
exports.getTotpTimeRemaining = getTotpTimeRemaining;
exports.generateQrCodeDataUrl = generateQrCodeDataUrl;
exports.generateQrCodeSvg = generateQrCodeSvg;
exports.setupMfa = setupMfa;
exports.verifyBackupCode = verifyBackupCode;
exports.canRecoverMfa = canRecoverMfa;
exports.parseOtpAuthUri = parseOtpAuthUri;
exports.generateDeviceId = generateDeviceId;
exports.createDeviceFingerprint = createDeviceFingerprint;
exports.assessMfaRisk = assessMfaRisk;
const crypto = __importStar(require("crypto"));
const speakeasy = __importStar(require("speakeasy"));
const QRCode = __importStar(require("qrcode"));
const index_js_1 = require("../config/index.js");
const password_js_1 = require("./password.js");
// ============================================================================
// TOTP SECRET GENERATION
// ============================================================================
function generateTotpSecret() {
    const secret = speakeasy.generateSecret({
        name: `ADALAT360 (${index_js_1.config.mfa.issuer})`,
        length: 20,
        issuer: index_js_1.config.mfa.issuer,
    });
    return {
        secret: secret.base32,
        otpauth_url: secret.otpauth_url,
    };
}
function verifyTotp(options) {
    return speakeasy.totp.verify({
        token: options.token,
        secret: options.secret,
        encoding: 'base32',
        window: options.window ?? index_js_1.config.mfa.window,
        algorithm: options.algorithm ?? index_js_1.config.mfa.algorithm,
        digits: index_js_1.config.mfa.digits,
        step: index_js_1.config.mfa.period,
    });
}
function verifyTotpDelta(options) {
    const verified = speakeasy.totp.verifyDelta({
        token: options.token,
        secret: options.secret,
        encoding: 'base32',
        window: options.window ?? index_js_1.config.mfa.window,
        algorithm: options.algorithm ?? index_js_1.config.mfa.algorithm,
        digits: index_js_1.config.mfa.digits,
        step: index_js_1.config.mfa.period,
    });
    return verified !== null ? verified.delta : null;
}
// ============================================================================
// TOTP GENERATION (for testing/display)
// ============================================================================
function generateTotpToken(secret) {
    return speakeasy.totp({
        secret,
        encoding: 'base32',
        algorithm: index_js_1.config.mfa.algorithm,
        digits: index_js_1.config.mfa.digits,
        step: index_js_1.config.mfa.period,
    });
}
function getTotpTimeRemaining() {
    const now = Math.floor(Date.now() / 1000);
    const step = index_js_1.config.mfa.period;
    return step - (now % step);
}
// ============================================================================
// QR CODE GENERATION
// ============================================================================
async function generateQrCodeDataUrl(otpauthUrl) {
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
async function generateQrCodeSvg(otpauthUrl) {
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
async function setupMfa(userEmail) {
    const { secret, otpauth_url } = generateTotpSecret();
    // Create otpauth URL with user email
    const otpauthWithUser = otpauth_url.replace(`issuer=${encodeURIComponent(index_js_1.config.mfa.issuer)}`, `issuer=${encodeURIComponent(index_js_1.config.mfa.issuer)}&label=${encodeURIComponent(`${index_js_1.config.mfa.issuer}:${userEmail}`)}`);
    const qr_code_url = await generateQrCodeDataUrl(otpauthWithUser);
    const backup_codes = (0, password_js_1.generateBackupCodes)(10, 8);
    const hashed_backup_codes = await (0, password_js_1.hashBackupCodes)(backup_codes);
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
async function verifyBackupCode(inputCode, hashedCodes) {
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
function canRecoverMfa(options) {
    // Allow recovery if:
    // 1. User has verified a backup code
    // 2. Admin override (with audit trail)
    return options.verifiedBackupCode || !!options.adminOverride;
}
function parseOtpAuthUri(uri) {
    try {
        const url = new URL(uri);
        if (url.protocol !== 'otpauth:')
            return null;
        const type = url.hostname;
        if (type !== 'totp' && type !== 'hotp')
            return null;
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
    }
    catch {
        return null;
    }
}
exports.DEVICE_TRUST_DURATION_DAYS = 30;
function generateDeviceId() {
    return crypto.randomBytes(16).toString('hex');
}
function createDeviceFingerprint(userAgent, additionalEntropy) {
    const data = `${userAgent}|${additionalEntropy || ''}|${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}
function assessMfaRisk(isNewDevice, isNewLocation, isNewIp, failedAttempts, timeSinceLastLogin, // hours
userRole) {
    let riskScore = 0;
    const factors = [];
    // Base risk by role
    const roleRisk = {
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
    }
    else if (timeSinceLastLogin > 168) { // 7 days
        riskScore += 5;
        factors.push('week_inactivity');
    }
    // Determine action
    let recommendedAction = 'allow';
    if (riskScore >= 70)
        recommendedAction = 'block';
    else if (riskScore >= 40)
        recommendedAction = 'admin_review';
    else if (riskScore >= 20)
        recommendedAction = 'require_mfa';
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
//# sourceMappingURL=mfa.js.map