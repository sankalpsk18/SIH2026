/**
 * ADALAT360 - Password Utilities
 * Secure password hashing, validation, and policy enforcement
 */

import * as bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { PasswordPolicy, DEFAULT_PASSWORD_POLICY, PasswordValidationResult } from '../models/auth.js';

// ============================================================================
// PASSWORD HASHING
// ============================================================================

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export async function needsRehash(hash: string): Promise<boolean> {
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

export function getPasswordPolicy(): PasswordPolicy {
    // In production, fetch from system_config table
    return DEFAULT_PASSWORD_POLICY;
}

export function validatePassword(password: string, policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length < policy.min_length) {
        errors.push(`Password must be at least ${policy.min_length} characters long`);
    } else {
        score += 20;
        // Bonus for longer passwords
        if (password.length >= 16) score += 10;
        if (password.length >= 20) score += 10;
    }

    // Uppercase
    if (policy.require_uppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
        score += 15;
    }

    // Lowercase
    if (policy.require_lowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
        score += 15;
    }

    // Numbers
    if (policy.require_numbers && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    } else if (/[0-9]/.test(password)) {
        score += 15;
    }

    // Special characters
    if (policy.require_special && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?)');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
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

export function getPasswordStrengthLabel(score: number): string {
    if (score >= 80) return 'Very Strong';
    if (score >= 60) return 'Strong';
    if (score >= 40) return 'Moderate';
    if (score >= 20) return 'Weak';
    return 'Very Weak';
}

// ============================================================================
// PASSWORD HISTORY
// ============================================================================

export async function checkPasswordHistory(
    password: string,
    previousHashes: string[]
): Promise<{ reused: boolean; index?: number }> {
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

export function generateSecurePassword(length: number = 16): string {
    if (length < 12) length = 12;

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

export function generateBackupCodes(count: number = 10, length: number = 8): string[] {
    const codes: string[] = [];
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

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map(code => hashPassword(code.replace('-', ''))));
}

export async function verifyBackupCode(inputCode: string, hashedCodes: string[]): Promise<{ valid: boolean; index?: number }> {
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

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export function generatePasswordResetToken(): { token: string; hash: string; expiry: Date } {
    const token = uuidv4();
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return { token, hash, expiry };
}

export function verifyPasswordResetToken(token: string, storedHash: string, expiry: Date): boolean {
    if (new Date() > expiry) return false;
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return hash === storedHash;
}

// ============================================================================
// PASSWORD EXPIRY
// ============================================================================

export function isPasswordExpired(passwordChangedAt: Date, maxAgeDays: number = 90): boolean {
    const expiryDate = new Date(passwordChangedAt);
    expiryDate.setDate(expiryDate.getDate() + maxAgeDays);
    return new Date() > expiryDate;
}

export function getPasswordExpiryDate(passwordChangedAt: Date, maxAgeDays: number = 90): Date {
    const expiryDate = new Date(passwordChangedAt);
    expiryDate.setDate(expiryDate.getDate() + maxAgeDays);
    return expiryDate;
}

export function getDaysUntilExpiry(passwordChangedAt: Date, maxAgeDays: number = 90): number {
    const expiryDate = getPasswordExpiryDate(passwordChangedAt, maxAgeDays);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}