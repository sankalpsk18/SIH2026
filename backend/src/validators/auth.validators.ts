/**
 * ADALAT360 - Auth Validators
 * Zod schemas for request validation
 */

import { z } from 'zod';
import { UserRole, UserStatus } from '../types/database.js';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const emailSchema = z.string().email('Invalid email format').toLowerCase().trim();

export const phoneSchema = z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, 'Invalid phone format').optional();

export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sort_by: z.string().optional(),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
    start_date: z.coerce.date().optional(),
    end_date: z.coerce.date().optional(),
});

// ============================================================================
// AUTH REQUEST SCHEMAS
// ============================================================================

export const loginSchema = z.object({
    body: z.object({
        email: emailSchema,
        password: z.string().min(1, 'Password is required'),
        totp_code: z.string().length(6, 'TOTP code must be 6 digits').optional(),
        backup_code: z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Backup code format: XXXX-XXXX').optional(),
        remember_me: z.boolean().default(false),
    }),
});

export const refreshTokenSchema = z.object({
    body: z.object({
        refresh_token: z.string().min(1, 'Refresh token is required'),
    }),
});

export const mfaVerifySchema = z.object({
    body: z.object({
        code: z.string().min(1, 'Code is required'),
        type: z.enum(['totp', 'backup']),
    }),
});

export const changePasswordSchema = z.object({
    body: z.object({
        current_password: z.string().min(1, 'Current password is required'),
        new_password: z.string().min(12, 'Password must be at least 12 characters'),
        confirm_password: z.string().min(1, 'Confirm password is required'),
    }).refine(data => data.new_password === data.confirm_password, {
        message: 'Passwords do not match',
        path: ['confirm_password'],
    }),
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: emailSchema,
    }),
});

export const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().uuid('Invalid reset token'),
        new_password: z.string().min(12, 'Password must be at least 12 characters'),
        confirm_password: z.string().min(1, 'Confirm password is required'),
    }).refine(data => data.new_password === data.confirm_password, {
        message: 'Passwords do not match',
        path: ['confirm_password'],
    }),
});

export const registerUserSchema = z.object({
    body: z.object({
        employee_id: z.string().min(3, 'Employee ID must be at least 3 characters').max(50),
        email: emailSchema,
        phone: phoneSchema,
        password: z.string().min(12, 'Password must be at least 12 characters'),
        full_name: z.string().min(2, 'Full name must be at least 2 characters').max(255),
        role: z.nativeEnum(UserRole),
        department: z.string().min(2, 'Department is required').max(100),
        designation: z.string().max(100).optional(),
        badge_number: z.string().max(50).optional(),
    }),
});

export const updateProfileSchema = z.object({
    body: z.object({
        full_name: z.string().min(2).max(255).optional(),
        phone: phoneSchema,
        designation: z.string().max(100).optional(),
    }).refine(data => Object.keys(data).length > 0, {
        message: 'At least one field must be provided',
    }),
});

export const setupMfaSchema = z.object({
    body: z.object({
        verification_code: z.string().length(6, 'Verification code must be 6 digits'),
    }),
});

export const disableMfaSchema = z.object({
    body: z.object({
        password: z.string().min(1, 'Password is required'),
    }),
});

export const regenerateBackupCodesSchema = z.object({
    body: z.object({
        password: z.string().min(1, 'Password is required'),
    }),
});

// ============================================================================
// QUERY PARAM SCHEMAS
// ============================================================================

export const userQuerySchema = z.object({
    query: z.object({
        ...paginationSchema.shape,
        role: z.nativeEnum(UserRole).optional(),
        status: z.nativeEnum(UserStatus).optional(),
        department: z.string().optional(),
        search: z.string().optional(),
    }),
});

export const auditQuerySchema = z.object({
    query: z.object({
        ...paginationSchema.shape,
        user_id: uuidSchema.optional(),
        event_type: z.string().optional(),
        event_category: z.string().optional(),
        resource_type: z.string().optional(),
        resource_id: uuidSchema.optional(),
        action: z.string().optional(),
        outcome: z.enum(['SUCCESS', 'FAILURE', 'PARTIAL', 'DENIED', 'ERROR']).optional(),
        severity: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional(),
        start_date: z.coerce.date().optional(),
        end_date: z.coerce.date().optional(),
        correlation_id: z.string().optional(),
    }),
});

export const sessionQuerySchema = z.object({
    query: z.object({
        ...paginationSchema.shape,
    }),
});

export const caseAccessQuerySchema = z.object({
    query: z.object({
        ...paginationSchema.shape,
        case_id: uuidSchema.optional(),
    }),
});

// ============================================================================
// PARAMS SCHEMAS
// ============================================================================

export const userIdParamSchema = z.object({
    params: z.object({
        userId: uuidSchema,
    }),
});

export const caseIdParamSchema = z.object({
    params: z.object({
        caseId: uuidSchema,
    }),
});

export const sessionIdParamSchema = z.object({
    params: z.object({
        sessionId: uuidSchema,
    }),
});

// ============================================================================
// EXPORT ALL
// ============================================================================

export const authValidators = {
    login: loginSchema,
    refreshToken: refreshTokenSchema,
    mfaVerify: mfaVerifySchema,
    changePassword: changePasswordSchema,
    forgotPassword: forgotPasswordSchema,
    resetPassword: resetPasswordSchema,
    registerUser: registerUserSchema,
    updateProfile: updateProfileSchema,
    setupMfa: setupMfaSchema,
    disableMfa: disableMfaSchema,
    regenerateBackupCodes: regenerateBackupCodesSchema,
    userQuery: userQuerySchema,
    auditQuery: auditQuerySchema,
    sessionQuery: sessionQuerySchema,
    caseAccessQuery: caseAccessQuerySchema,
    userIdParam: userIdParamSchema,
    caseIdParam: caseIdParamSchema,
    sessionIdParam: sessionIdParamSchema,
};