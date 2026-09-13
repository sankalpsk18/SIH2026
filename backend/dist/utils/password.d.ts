/**
 * ADALAT360 - Password Utilities
 * Secure password hashing, validation, and policy enforcement
 */
import { PasswordPolicy, PasswordValidationResult } from '../models/auth.js';
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
export declare function needsRehash(hash: string): Promise<boolean>;
export declare function getPasswordPolicy(): PasswordPolicy;
export declare function validatePassword(password: string, policy?: PasswordPolicy): PasswordValidationResult;
export declare function getPasswordStrengthLabel(score: number): string;
export declare function checkPasswordHistory(password: string, previousHashes: string[]): Promise<{
    reused: boolean;
    index?: number;
}>;
export declare function generateSecurePassword(length?: number): string;
export declare function generateBackupCodes(count?: number, length?: number): string[];
export declare function hashBackupCodes(codes: string[]): Promise<string[]>;
export declare function verifyBackupCode(inputCode: string, hashedCodes: string[]): Promise<{
    valid: boolean;
    index?: number;
}>;
export declare function generatePasswordResetToken(): {
    token: string;
    hash: string;
    expiry: Date;
};
export declare function verifyPasswordResetToken(token: string, storedHash: string, expiry: Date): boolean;
export declare function isPasswordExpired(passwordChangedAt: Date, maxAgeDays?: number): boolean;
export declare function getPasswordExpiryDate(passwordChangedAt: Date, maxAgeDays?: number): Date;
export declare function getDaysUntilExpiry(passwordChangedAt: Date, maxAgeDays?: number): number;
//# sourceMappingURL=password.d.ts.map