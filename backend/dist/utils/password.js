"use strict";
/**
 * ADALAT360 - Password Utilities
 * Secure password hashing, validation, and policy enforcement
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
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.needsRehash = needsRehash;
exports.getPasswordPolicy = getPasswordPolicy;
exports.validatePassword = validatePassword;
exports.getPasswordStrengthLabel = getPasswordStrengthLabel;
exports.checkPasswordHistory = checkPasswordHistory;
exports.generateSecurePassword = generateSecurePassword;
exports.generateBackupCodes = generateBackupCodes;
exports.hashBackupCodes = hashBackupCodes;
exports.verifyBackupCode = verifyBackupCode;
exports.generatePasswordResetToken = generatePasswordResetToken;
exports.verifyPasswordResetToken = verifyPasswordResetToken;
exports.isPasswordExpired = isPasswordExpired;
exports.getPasswordExpiryDate = getPasswordExpiryDate;
exports.getDaysUntilExpiry = getDaysUntilExpiry;
const bcrypt = __importStar(require("bcryptjs"));
const auth_js_1 = require("../models/auth.js");
// ============================================================================
// PASSWORD HASHING
// ============================================================================
const BCRYPT_ROUNDS = 12;
async function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
async function needsRehash(hash) {
    // Check if hash was created with current rounds
    // bcrypt hash format: $2a$12$...
    const roundsMatch = hash.match(/^\$2[aby]\$(\d{2})\$/);
    if (roundsMatch) {
        const rounds = parseInt(roundsMatch[1], 10);
        return rounds < BCRYPT_ROUNDS;
    }
    return true; // Unknown format, rehash
}
// ============================================================================
// PASSWORD POLICY
// ============================================================================
function getPasswordPolicy() {
    // In production, fetch from system_config table
    return auth_js_1.DEFAULT_PASSWORD_POLICY;
}
function validatePassword(password, policy = auth_js_1.DEFAULT_PASSWORD_POLICY) {
    const errors = [];
    let score = 0;
    // Length check
    if (password.length < policy.min_length) {
        errors.push(`Password must be at least ${policy.min_length} characters long`);
    }
    else {
        score += 20;
        // Bonus for longer passwords
        if (password.length >= 16)
            score += 10;
        if (password.length >= 20)
            score += 10;
    }
    // Uppercase
    if (policy.require_uppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    else if (/[A-Z]/.test(password)) {
        score += 15;
    }
    // Lowercase
    if (policy.require_lowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    else if (/[a-z]/.test(password)) {
        score += 15;
    }
    // Numbers
    if (policy.require_numbers && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    else if (/[0-9]/.test(password)) {
        score += 15;
    }
    // Special characters
    if (policy.require_special && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?)');
    }
    else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        score += 15;
    }
    // Common patterns (reduce score)
    if (/(.)\1{2,}/.test(password)) { // Repeated characters
        score -= 10;
    }
    if (/123|abc|qwe|asd|zxc/i.test(password)) { // Sequential
        score -= 10;
    }
    if (password.toLowerCase().includes('password')) {
        score -= 20;
    }
    if (password.toLowerCase().includes('admin')) {
        score -= 10;
    }
    // Clamp score
    score = Math.max(0, Math.min(100, score));
    return {
        valid: errors.length === 0,
        errors,
        score,
    };
}
function getPasswordStrengthLabel(score) {
    if (score >= 80)
        return 'Very Strong';
    if (score >= 60)
        return 'Strong';
    if (score >= 40)
        return 'Moderate';
    if (score >= 20)
        return 'Weak';
    return 'Very Weak';
}
// ============================================================================
// PASSWORD HISTORY
// ============================================================================
async function checkPasswordHistory(password, previousHashes) {
    for (let i = 0; i < previousHashes.length; i++) {
        const match = await verifyPassword(password, previousHashes[i]);
        if (match) {
            return { reused: true, index: i };
        }
    }
    return { reused: false };
}
// ============================================================================
// SECURE PASSWORD GENERATION
// ============================================================================
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';
function generateSecurePassword(length = 16) {
    if (length < 12)
        length = 12;
    let password = '';
    // Ensure at least one of each required type
    password += UPPERCASE[Math.floor(Math.random() * UPPERCASE.length)];
    password += LOWERCASE[Math.floor(Math.random() * LOWERCASE.length)];
    password += NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
    password += SPECIAL[Math.floor(Math.random() * SPECIAL.length)];
    const allChars = UPPERCASE + LOWERCASE + NUMBERS + SPECIAL;
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    // Shuffle
    return password.split('').sort(() => Math.random() - 0.5).join('');
}
// ============================================================================
// BACKUP CODES GENERATION
// ============================================================================
function generateBackupCodes(count = 10, length = 8) {
    const codes = [];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
    for (let i = 0; i < count; i++) {
        let code = '';
        for (let j = 0; j < length; j++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        // Format as XXXX-XXXX
        if (length === 8) {
            code = `${code.slice(0, 4)}-${code.slice(4)}`;
        }
        codes.push(code);
    }
    return codes;
}
async function hashBackupCodes(codes) {
    return Promise.all(codes.map(code => hashPassword(code.replace('-', ''))));
}
async function verifyBackupCode(inputCode, hashedCodes) {
    const normalized = inputCode.replace('-', '').toUpperCase();
    for (let i = 0; i < hashedCodes.length; i++) {
        const match = await verifyPassword(normalized, hashedCodes[i]);
        if (match) {
            return { valid: true, index: i };
        }
    }
    return { valid: false };
}
// ============================================================================
// PASSWORD RESET TOKENS
// ============================================================================
const uuid_1 = require("uuid");
const crypto = __importStar(require("crypto"));
function generatePasswordResetToken() {
    const token = (0, uuid_1.v4)();
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return { token, hash, expiry };
}
function verifyPasswordResetToken(token, storedHash, expiry) {
    if (new Date() > expiry)
        return false;
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return hash === storedHash;
}
// ============================================================================
// PASSWORD EXPIRY
// ============================================================================
function isPasswordExpired(passwordChangedAt, maxAgeDays = 90) {
    const expiryDate = new Date(passwordChangedAt);
    expiryDate.setDate(expiryDate.getDate() + maxAgeDays);
    return new Date() > expiryDate;
}
function getPasswordExpiryDate(passwordChangedAt, maxAgeDays = 90) {
    const expiryDate = new Date(passwordChangedAt);
    expiryDate.setDate(expiryDate.getDate() + maxAgeDays);
    return expiryDate;
}
function getDaysUntilExpiry(passwordChangedAt, maxAgeDays = 90) {
    const expiryDate = getPasswordExpiryDate(passwordChangedAt, maxAgeDays);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}
//# sourceMappingURL=password.js.map