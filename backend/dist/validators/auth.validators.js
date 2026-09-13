"use strict";
/**
 * ADALAT360 - Auth Validators
 * Zod schemas for request validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authValidators = exports.sessionIdParamSchema = exports.caseIdParamSchema = exports.userIdParamSchema = exports.caseAccessQuerySchema = exports.sessionQuerySchema = exports.auditQuerySchema = exports.userQuerySchema = exports.regenerateBackupCodesSchema = exports.disableMfaSchema = exports.setupMfaSchema = exports.updateProfileSchema = exports.registerUserSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.changePasswordSchema = exports.mfaVerifySchema = exports.refreshTokenSchema = exports.loginSchema = exports.dateRangeSchema = exports.paginationSchema = exports.phoneSchema = exports.emailSchema = exports.uuidSchema = void 0;
const zod_1 = require("zod");
const database_js_1 = require("../types/database.js");
// ============================================================================
// COMMON SCHEMAS
// ============================================================================
exports.uuidSchema = zod_1.z.string().uuid('Invalid UUID format');
exports.emailSchema = zod_1.z.string().email('Invalid email format').toLowerCase().trim();
exports.phoneSchema = zod_1.z.string().regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, 'Invalid phone format').optional();
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    sort_by: zod_1.z.string().optional(),
    sort_order: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.dateRangeSchema = zod_1.z.object({
    start_date: zod_1.z.coerce.date().optional(),
    end_date: zod_1.z.coerce.date().optional(),
});
// ============================================================================
// AUTH REQUEST SCHEMAS
// ============================================================================
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: exports.emailSchema,
        password: zod_1.z.string().min(1, 'Password is required'),
        totp_code: zod_1.z.string().length(6, 'TOTP code must be 6 digits').optional(),
        backup_code: zod_1.z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Backup code format: XXXX-XXXX').optional(),
        remember_me: zod_1.z.boolean().default(false),
    }),
});
exports.refreshTokenSchema = zod_1.z.object({
    body: zod_1.z.object({
        refresh_token: zod_1.z.string().min(1, 'Refresh token is required'),
    }),
});
exports.mfaVerifySchema = zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(1, 'Code is required'),
        type: zod_1.z.enum(['totp', 'backup']),
    }),
});
exports.changePasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        current_password: zod_1.z.string().min(1, 'Current password is required'),
        new_password: zod_1.z.string().min(12, 'Password must be at least 12 characters'),
        confirm_password: zod_1.z.string().min(1, 'Confirm password is required'),
    }).refine(data => data.new_password === data.confirm_password, {
        message: 'Passwords do not match',
        path: ['confirm_password'],
    }),
});
exports.forgotPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: exports.emailSchema,
    }),
});
exports.resetPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().uuid('Invalid reset token'),
        new_password: zod_1.z.string().min(12, 'Password must be at least 12 characters'),
        confirm_password: zod_1.z.string().min(1, 'Confirm password is required'),
    }).refine(data => data.new_password === data.confirm_password, {
        message: 'Passwords do not match',
        path: ['confirm_password'],
    }),
});
exports.registerUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        employee_id: zod_1.z.string().min(3, 'Employee ID must be at least 3 characters').max(50),
        email: exports.emailSchema,
        phone: exports.phoneSchema,
        password: zod_1.z.string().min(12, 'Password must be at least 12 characters'),
        full_name: zod_1.z.string().min(2, 'Full name must be at least 2 characters').max(255),
        role: zod_1.z.nativeEnum(database_js_1.UserRole),
        department: zod_1.z.string().min(2, 'Department is required').max(100),
        designation: zod_1.z.string().max(100).optional(),
        badge_number: zod_1.z.string().max(50).optional(),
    }),
});
exports.updateProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        full_name: zod_1.z.string().min(2).max(255).optional(),
        phone: exports.phoneSchema,
        designation: zod_1.z.string().max(100).optional(),
    }).refine(data => Object.keys(data).length > 0, {
        message: 'At least one field must be provided',
    }),
});
exports.setupMfaSchema = zod_1.z.object({
    body: zod_1.z.object({
        verification_code: zod_1.z.string().length(6, 'Verification code must be 6 digits'),
    }),
});
exports.disableMfaSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string().min(1, 'Password is required'),
    }),
});
exports.regenerateBackupCodesSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string().min(1, 'Password is required'),
    }),
});
// ============================================================================
// QUERY PARAM SCHEMAS
// ============================================================================
exports.userQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        ...exports.paginationSchema.shape,
        role: zod_1.z.nativeEnum(database_js_1.UserRole).optional(),
        status: zod_1.z.nativeEnum(database_js_1.UserStatus).optional(),
        department: zod_1.z.string().optional(),
        search: zod_1.z.string().optional(),
    }),
});
exports.auditQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        ...exports.paginationSchema.shape,
        user_id: exports.uuidSchema.optional(),
        event_type: zod_1.z.string().optional(),
        event_category: zod_1.z.string().optional(),
        resource_type: zod_1.z.string().optional(),
        resource_id: exports.uuidSchema.optional(),
        action: zod_1.z.string().optional(),
        outcome: zod_1.z.enum(['SUCCESS', 'FAILURE', 'PARTIAL', 'DENIED', 'ERROR']).optional(),
        severity: zod_1.z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional(),
        start_date: zod_1.z.coerce.date().optional(),
        end_date: zod_1.z.coerce.date().optional(),
        correlation_id: zod_1.z.string().optional(),
    }),
});
exports.sessionQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        ...exports.paginationSchema.shape,
    }),
});
exports.caseAccessQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        ...exports.paginationSchema.shape,
        case_id: exports.uuidSchema.optional(),
    }),
});
// ============================================================================
// PARAMS SCHEMAS
// ============================================================================
exports.userIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: exports.uuidSchema,
    }),
});
exports.caseIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        caseId: exports.uuidSchema,
    }),
});
exports.sessionIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        sessionId: exports.uuidSchema,
    }),
});
// ============================================================================
// EXPORT ALL
// ============================================================================
exports.authValidators = {
    login: exports.loginSchema,
    refreshToken: exports.refreshTokenSchema,
    mfaVerify: exports.mfaVerifySchema,
    changePassword: exports.changePasswordSchema,
    forgotPassword: exports.forgotPasswordSchema,
    resetPassword: exports.resetPasswordSchema,
    registerUser: exports.registerUserSchema,
    updateProfile: exports.updateProfileSchema,
    setupMfa: exports.setupMfaSchema,
    disableMfa: exports.disableMfaSchema,
    regenerateBackupCodes: exports.regenerateBackupCodesSchema,
    userQuery: exports.userQuerySchema,
    auditQuery: exports.auditQuerySchema,
    sessionQuery: exports.sessionQuerySchema,
    caseAccessQuery: exports.caseAccessQuerySchema,
    userIdParam: exports.userIdParamSchema,
    caseIdParam: exports.caseIdParamSchema,
    sessionIdParam: exports.sessionIdParamSchema,
};
//# sourceMappingURL=auth.validators.js.map