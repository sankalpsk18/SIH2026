"use strict";
/**
 * ADALAT360 - Authentication Service
 * Core authentication logic: login, registration, MFA, password management
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
exports.login = login;
exports.verifyMfa = verifyMfa;
exports.refreshToken = refreshToken;
exports.logout = logout;
exports.logoutAllDevices = logoutAllDevices;
exports.setupMfaForUser = setupMfaForUser;
exports.enableMfa = enableMfa;
exports.disableMfa = disableMfa;
exports.regenerateBackupCodes = regenerateBackupCodes;
exports.changePassword = changePassword;
exports.requestPasswordReset = requestPasswordReset;
exports.resetPassword = resetPassword;
exports.registerUser = registerUser;
exports.updateProfile = updateProfile;
exports.getProfile = getProfile;
exports.getCurrentSessions = getCurrentSessions;
exports.revokeSession = revokeSession;
exports.revokeAllSessions = revokeAllSessions;
exports.trustCurrentDevice = trustCurrentDevice;
exports.checkDeviceTrust = checkDeviceTrust;
exports.assessLoginRisk = assessLoginRisk;
const uuid_1 = require("uuid");
const crypto = __importStar(require("crypto"));
const database_js_1 = require("../config/database.js");
const jwt_js_1 = require("../utils/jwt.js");
const password_js_1 = require("../utils/password.js");
const mfa_js_1 = require("../utils/mfa.js");
const session_service_js_1 = require("./session.service.js");
const audit_service_js_1 = require("./audit.service.js");
// ============================================================================
// USER QUERIES
// ============================================================================
async function findUserByEmail(email) {
    const result = await (0, database_js_1.pgQuery)(`SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`, [email.toLowerCase()]);
    return result.rows[0] || null;
}
async function findUserById(id) {
    const result = await (0, database_js_1.pgQuery)(`SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]);
    return result.rows[0] || null;
}
async function findUserByEmployeeId(employeeId) {
    const result = await (0, database_js_1.pgQuery)(`SELECT * FROM users WHERE employee_id = $1 AND deleted_at IS NULL`, [employeeId]);
    return result.rows[0] || null;
}
async function updateUserLastLogin(userId) {
    await (0, database_js_1.pgQuery)(`UPDATE users SET last_login_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [userId]);
}
async function incrementFailedLogin(userId) {
    await (0, database_js_1.pgQuery)(`UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1`, [userId]);
}
async function lockUserAccount(userId, durationMinutes = 30) {
    const lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    await (0, database_js_1.pgQuery)(`UPDATE users SET locked_until = $1 WHERE id = $2`, [lockedUntil, userId]);
}
async function updateUserPassword(userId, passwordHash) {
    await (0, database_js_1.pgQuery)(`UPDATE users SET password_hash = $1, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $2`, [passwordHash, userId]);
}
async function updateUserTotp(userId, secret, enabled, backupCodes) {
    if (enabled && backupCodes) {
        await (0, database_js_1.pgQuery)(`UPDATE users SET totp_secret = $1, totp_enabled = $2, mfa_backup_codes = $3 WHERE id = $4`, [secret, enabled, backupCodes, userId]);
    }
    else {
        await (0, database_js_1.pgQuery)(`UPDATE users SET totp_secret = $1, totp_enabled = $2 WHERE id = $3`, [secret, enabled, userId]);
    }
}
async function updateUserProfile(userId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    if (updates.full_name !== undefined) {
        fields.push(`full_name = $${paramIndex++}`);
        values.push(updates.full_name);
    }
    if (updates.phone !== undefined) {
        fields.push(`phone = $${paramIndex++}`);
        values.push(updates.phone);
    }
    if (updates.designation !== undefined) {
        fields.push(`designation = $${paramIndex++}`);
        values.push(updates.designation);
    }
    if (fields.length === 0)
        return findUserById(userId);
    fields.push(`updated_at = NOW()`);
    values.push(userId);
    const result = await (0, database_js_1.pgQuery)(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`, values);
    return result.rows[0] || null;
}
async function getUserCaseAccess(userId, userRole) {
    // Admins and auditors have access to all cases
    if (userRole === 'CENTRAL_ADMIN' || userRole === 'AUDITOR') {
        const casesResult = await (0, database_js_1.pgQuery)(`SELECT id, case_number FROM cases WHERE deleted_at IS NULL`);
        return {
            user_id: userId,
            cases: casesResult.rows.map(r => ({
                case_id: r.id,
                case_number: r.case_number,
                role_in_case: 'ADMIN',
                permissions: ['READ', 'WRITE', 'DELETE', 'ADMIN', 'SIGN', 'VERIFY', 'EXPORT', 'REDACT'],
            })),
            all_cases_access: true,
        };
    }
    // Get case assignments
    const assignmentsResult = await (0, database_js_1.pgQuery)(`SELECT ca.case_id, c.case_number, ca.role_in_case, ca.permission_level
         FROM case_assignments ca
         JOIN cases c ON c.id = ca.case_id
         WHERE ca.user_id = $1 AND ca.is_active = TRUE AND c.deleted_at IS NULL
         AND (ca.revoked_at IS NULL OR ca.revoked_at > NOW())`, [userId]);
    const cases = assignmentsResult.rows.map(r => ({
        case_id: r.case_id,
        case_number: r.case_number,
        role_in_case: r.role_in_case,
        permissions: r.permission_level,
    }));
    return {
        user_id: userId,
        cases,
        all_cases_access: false,
    };
}
function toUserPublic(user) {
    return {
        id: user.id,
        employee_id: user.employee_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        designation: user.designation,
        badge_number: user.badge_number,
        status: user.status,
        totp_enabled: user.totp_enabled,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
    };
}
// ============================================================================
// LOGIN
// ============================================================================
async function login(request, ipAddress, userAgent) {
    const email = request.email.toLowerCase().trim();
    const deviceFingerprint = (0, mfa_js_1.createDeviceFingerprint)(userAgent || '');
    // Check lockout
    const locked = await (0, session_service_js_1.isLockedOut)(email);
    if (locked) {
        const remaining = await (0, session_service_js_1.getLockoutRemaining)(email);
        await (0, audit_service_js_1.logAuthEvent)({
            event_type: 'LOGIN_LOCKED',
            email,
            ip_address: ipAddress,
            user_agent: userAgent,
            success: false,
            failure_reason: 'Account temporarily locked',
            metadata: { lockout_remaining_seconds: remaining },
        });
        throw new Error(`Account temporarily locked. Try again in ${Math.ceil(remaining / 60)} minutes.`);
    }
    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
        await (0, session_service_js_1.recordLoginAttempt)(email, false);
        await (0, audit_service_js_1.logAuthEvent)({
            event_type: 'LOGIN_FAILED',
            email,
            ip_address: ipAddress,
            user_agent: userAgent,
            success: false,
            failure_reason: 'Invalid credentials',
        });
        throw new Error('Invalid credentials');
    }
    // Check status
    if (user.status !== 'ACTIVE') {
        await (0, audit_service_js_1.logAuthEvent)({
            event_type: 'LOGIN_FAILED',
            user_id: user.id,
            email,
            ip_address: ipAddress,
            user_agent: userAgent,
            success: false,
            failure_reason: `Account status: ${user.status}`,
        });
        throw new Error('Account is not active');
    }
    // Check password
    const passwordValid = await (0, password_js_1.verifyPassword)(request.password, user.password_hash);
    if (!passwordValid) {
        await incrementFailedLogin(user.id);
        await (0, session_service_js_1.recordLoginAttempt)(email, false);
        // Check if should lock in DB too
        if (user.failed_login_attempts + 1 >= 5) {
            await lockUserAccount(user.id);
        }
        await (0, audit_service_js_1.logAuthEvent)({
            event_type: 'LOGIN_FAILED',
            user_id: user.id,
            email,
            ip_address: ipAddress,
            user_agent: userAgent,
            success: false,
            failure_reason: 'Invalid password',
            metadata: { failed_attempts: user.failed_login_attempts + 1 },
        });
        throw new Error('Invalid credentials');
    }
    // Password correct - check MFA
    if (user.totp_enabled) {
        // If TOTP code provided, verify it
        if (request.totp_code) {
            const totpValid = (0, mfa_js_1.verifyTotp)({ token: request.totp_code, secret: user.totp_secret });
            if (!totpValid) {
                await (0, session_service_js_1.recordLoginAttempt)(email, false);
                await (0, audit_service_js_1.logAuthEvent)({
                    event_type: 'MFA_FAILED',
                    user_id: user.id,
                    email,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                    success: false,
                    failure_reason: 'Invalid TOTP code',
                });
                throw new Error('Invalid authentication code');
            }
        }
        // If backup code provided, verify it
        else if (request.backup_code && user.mfa_backup_codes) {
            const backupResult = await (0, mfa_js_1.verifyBackupCode)(request.backup_code, user.mfa_backup_codes);
            if (!backupResult.valid) {
                await (0, session_service_js_1.recordLoginAttempt)(email, false);
                await (0, audit_service_js_1.logAuthEvent)({
                    event_type: 'MFA_BACKUP_USED',
                    user_id: user.id,
                    email,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                    success: false,
                    failure_reason: 'Invalid backup code',
                });
                throw new Error('Invalid backup code');
            }
            // Remove used backup code
            const newBackupCodes = user.mfa_backup_codes.filter((_, i) => i !== backupResult.index);
            await (0, database_js_1.pgQuery)(`UPDATE users SET mfa_backup_codes = $1 WHERE id = $2`, [newBackupCodes, user.id]);
            await (0, audit_service_js_1.logAuthEvent)({
                event_type: 'MFA_BACKUP_USED',
                user_id: user.id,
                email,
                ip_address: ipAddress,
                user_agent: userAgent,
                success: true,
                metadata: { remaining_backup_codes: newBackupCodes.length },
            });
        }
        // No MFA code provided - return MFA required
        else {
            const mfaToken = (0, jwt_js_1.generateMfaPendingToken)({
                sub: user.id,
                email: user.email,
                role: user.role,
                department: user.department,
            });
            await (0, session_service_js_1.storeMfaPending)(mfaToken, user.id);
            await (0, audit_service_js_1.logAuthEvent)({
                event_type: 'LOGIN_SUCCESS',
                user_id: user.id,
                email,
                ip_address: ipAddress,
                user_agent: userAgent,
                success: true,
                metadata: { mfa_required: true },
            });
            return {
                access_token: '',
                refresh_token: '',
                token_type: 'Bearer',
                expires_in: 0,
                user: toUserPublic(user),
                requires_mfa: true,
                mfa_method: 'totp',
            };
        }
    }
    // MFA verified or not required - create session
    const caseAccess = await getUserCaseAccess(user.id, user.role);
    const sessionId = (0, uuid_1.v4)();
    const tokenPair = (0, jwt_js_1.generateTokenPair)(user.id, user.email, user.role, user.department, caseAccess.cases.map(c => c.case_id), caseAccess.cases.flatMap(c => c.permissions), sessionId);
    await (0, session_service_js_1.createSession)(user.id, user.email, user.role, user.department, caseAccess.cases.map(c => c.case_id), caseAccess.cases.flatMap(c => c.permissions), ipAddress, userAgent, deviceFingerprint, user.totp_enabled // MFA verified if TOTP enabled and we got here
    );
    await updateUserLastLogin(user.id);
    await (0, session_service_js_1.recordLoginAttempt)(email, true);
    // Check password expiry
    const passwordExpiryDays = (0, password_js_1.getDaysUntilExpiry)(user.password_changed_at);
    let passwordExpiryWarning;
    if (passwordExpiryDays <= 7) {
        passwordExpiryWarning = `Password expires in ${passwordExpiryDays} days`;
    }
    await (0, audit_service_js_1.logAuthEvent)({
        event_type: 'LOGIN_SUCCESS',
        user_id: user.id,
        email,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: true,
        metadata: { session_id: sessionId, password_expiry_days: passwordExpiryDays },
    });
    return {
        ...tokenPair,
        user: toUserPublic(user),
        requires_mfa: false,
    };
}
// ============================================================================
// MFA VERIFICATION (after initial login)
// ============================================================================
async function verifyMfa(mfaToken, request, ipAddress, userAgent) {
    // Verify MFA pending token
    const mfaResult = (0, jwt_js_1.verifyMfaToken)(mfaToken);
    if (!mfaResult.valid || !mfaResult.payload) {
        throw new Error('Invalid or expired MFA session');
    }
    const userId = mfaResult.payload.sub;
    const user = await findUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    // Consume MFA pending token
    await (0, session_service_js_1.consumeMfaPending)(mfaToken);
    // Verify the provided code
    let mfaVerified = false;
    if (request.type === 'totp') {
        mfaVerified = (0, mfa_js_1.verifyTotp)({ token: request.code, secret: user.totp_secret });
    }
    else if (request.type === 'backup' && user.mfa_backup_codes) {
        const backupResult = await (0, mfa_js_1.verifyBackupCode)(request.code, user.mfa_backup_codes);
        mfaVerified = backupResult.valid;
        if (backupResult.valid) {
            // Remove used backup code
            const newBackupCodes = user.mfa_backup_codes.filter((_, i) => i !== backupResult.index);
            await (0, database_js_1.pgQuery)(`UPDATE users SET mfa_backup_codes = $1 WHERE id = $2`, [newBackupCodes, user.id]);
        }
    }
    if (!mfaVerified) {
        await (0, audit_service_js_1.logAuthEvent)({
            event_type: 'MFA_FAILED',
            user_id: user.id,
            email: user.email,
            ip_address: ipAddress,
            user_agent: userAgent,
            success: false,
            failure_reason: `Invalid ${request.type} code`,
        });
        throw new Error('Invalid authentication code');
    }
    // Create full session
    const caseAccess = await getUserCaseAccess(user.id, user.role);
    const sessionId = (0, uuid_1.v4)();
    const tokenPair = (0, jwt_js_1.generateTokenPair)(user.id, user.email, user.role, user.department, caseAccess.cases.map(c => c.case_id), caseAccess.cases.flatMap(c => c.permissions), sessionId);
    await (0, session_service_js_1.createSession)(user.id, user.email, user.role, user.department, caseAccess.cases.map(c => c.case_id), caseAccess.cases.flatMap(c => c.permissions), ipAddress, userAgent, undefined, true);
    await updateUserLastLogin(user.id);
    await (0, audit_service_js_1.logAuthEvent)({
        event_type: 'MFA_VERIFIED',
        user_id: user.id,
        email: user.email,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: true,
        metadata: { session_id: sessionId },
    });
    return {
        ...tokenPair,
        user: toUserPublic(user),
        requires_mfa: false,
    };
}
// ============================================================================
// REFRESH TOKEN
// ============================================================================
async function refreshToken(request) {
    const refreshResult = (0, jwt_js_1.verifyRefreshToken)(request.refresh_token);
    if (!refreshResult.valid || !refreshResult.payload) {
        throw new Error('Invalid or expired refresh token');
    }
    const { sub: userId, session_id: sessionId } = refreshResult.payload;
    // Check if refresh token is revoked
    const decoded = (0, jwt_js_1.verifyRefreshToken)(request.refresh_token);
    if (decoded.payload) {
        const revoked = await isRefreshTokenRevoked(decoded.payload.sub + ':' + sessionId);
        if (revoked) {
            throw new Error('Token has been revoked');
        }
    }
    // Get session
    const session = await (0, session_service_js_1.getSession)(sessionId);
    if (!session || !session.is_active) {
        throw new Error('Session expired or revoked');
    }
    // Get fresh case access
    const caseAccess = await getUserCaseAccess(userId, session.role);
    // Generate new token pair
    const tokenPair = (0, jwt_js_1.generateTokenPair)(userId, session.email, session.role, session.department, caseAccess.cases.map(c => c.case_id), caseAccess.cases.flatMap(c => c.permissions), sessionId);
    // Revoke old refresh token
    await (0, session_service_js_1.revokeRefreshToken)(userId + ':' + sessionId);
    await (0, audit_service_js_1.logAuthEvent)({
        event_type: 'SESSION_CREATED',
        user_id: userId,
        email: session.email,
        session_id: sessionId,
        success: true,
        metadata: { refreshed: true },
    });
    return tokenPair;
}
// ============================================================================
// LOGOUT
// ============================================================================
async function logout(accessToken, refreshToken) {
    const accessResult = (0, jwt_js_1.verifyAccessToken)(accessToken);
    if (accessResult.valid && accessResult.payload) {
        const { sub: userId, session_id: sessionId } = accessResult.payload;
        // Delete session
        await (0, session_service_js_1.deleteSession)(sessionId);
        // Revoke tokens
        await (0, session_service_js_1.revokeAccessToken)(userId + ':' + sessionId);
        if (refreshToken) {
            await (0, session_service_js_1.revokeRefreshToken)(userId + ':' + sessionId);
        }
        await (0, audit_service_js_1.logAuthEvent)({
            event_type: 'LOGOUT',
            user_id: userId,
            session_id: sessionId,
            success: true,
        });
    }
}
async function logoutAllDevices(userId, currentSessionId) {
    const deleted = await (0, session_service_js_1.deleteAllUserSessions)(userId, currentSessionId);
    await (0, audit_service_js_1.logAuthEvent)({
        event_type: 'LOGOUT',
        user_id: userId,
        success: true,
        metadata: { sessions_terminated: deleted, all_devices: true },
    });
    return deleted;
}
// ============================================================================
// MFA MANAGEMENT
// ============================================================================
async function setupMfaForUser(userId) {
    const user = await findUserById(userId);
    if (!user)
        throw new Error('User not found');
    const setup = await (0, mfa_js_1.setupMfa)(user.email);
    // Store secret temporarily (not enabled yet)
    await (0, database_js_1.pgQuery)(`UPDATE users SET totp_secret = $1 WHERE id = $2`, [setup.secret, userId]);
    return setup;
}
async function enableMfa(userId, verificationCode) {
    const user = await findUserById(userId);
    if (!user || !user.totp_secret) {
        throw new Error('MFA setup not initiated');
    }
    // Verify the code
    const valid = (0, mfa_js_1.verifyTotp)({ token: verificationCode, secret: user.totp_secret });
    if (!valid) {
        throw new Error('Invalid verification code');
    }
    // Generate backup codes
    const backupCodes = await (0, mfa_js_1.setupMfa)(user.email);
    // Enable MFA
    await updateUserTotp(userId, user.totp_secret, true, backupCodes.backup_codes);
    await (0, audit_service_js_1.logAuthEvent)({
        event_type: 'MFA_ENABLED',
        user_id: userId,
        email: user.email,
        success: true,
    });
    return { backup_codes: backupCodes.backup_codes };
}
async function disableMfa(userId, password) {
    const user = await findUserById(userId);
    if (!user)
        throw new Error('User not found');
    // Verify password
    const valid = await (0, password_js_1.verifyPassword)(password, user.password_hash);
    if (!valid) {
        throw new Error('Invalid password');
    }
    // Disable MFA
    await updateUserTotp(userId, '', false, []);
    await (0, audit_service_js_1.logAuthEvent)({
        event_type: 'MFA_DISABLED',
        user_id: userId,
        email: user.email,
        success: true,
    });
}
async function regenerateBackupCodes(userId, password) {
    const user = await findUserById(userId);
    if (!user)
        throw new Error('User not found');
    // Verify password
    const valid = await (0, password_js_1.verifyPassword)(password, user.password_hash);
    if (!valid) {
        throw new Error('Invalid password');
    }
    // Generate new backup codes
    const backupCodes = generateBackupCodes(10, 8);
    const hashedCodes = await hashBackupCodes(backupCodes);
    await (0, database_js_1.pgQuery)(`UPDATE users SET mfa_backup_codes = $1 WHERE id = $2`, [hashedCodes, userId]);
    await (0, audit_service_js_1.logAuthEvent)({
        event_type: 'MFA_ENABLED',
        user_id: userId,
        email: user.email,
        success: true,
        metadata: { action: 'backup_codes_regenerated' },
    });
    return backupCodes;
}
// ============================================================================
// PASSWORD MANAGEMENT
// ============================================================================
async function changePassword(userId, request) {
    const user = await findUserById(userId);
    if (!user)
        throw new Error('User not found');
    // Verify current password
    const valid = await (0, password_js_1.verifyPassword)(request.current_password, user.password_hash);
    if (!valid) {
        throw new Error('Current password is incorrect');
    }
    // Validate new password
    const policy = (0, password_js_1.getPasswordPolicy)();
    const validation = (0, password_js_1.validatePassword)(request.new_password, policy);
    if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
    }
    // Check password history
    // In production, fetch previous hashes from password_history table
    // For now, just check against current
    if (await (0, password_js_1.verifyPassword)(request.new_password, user.password_hash)) {
        throw new Error('New password must be different from current password');
    }
    // Hash and update
    const newHash = await (0, password_js_1.hashPassword)(request.new_password);
    await updateUserPassword(userId, newHash);
    await (0, audit_service_js_1.logAuthEvent)({
        event_type: 'PASSWORD_CHANGED',
        user_id: userId,
        email: user.email,
        success: true,
    });
}
async function requestPasswordReset(request) {
    const user = await findUserByEmail(request.email);
    // Always return success to prevent email enumeration
    if (!user)
        return;
    const { token, hash, expiry } = (0, password_js_1.generatePasswordResetToken)();
    await (0, session_service_js_1.storePasswordResetToken)(hash, user.id);
    // In production, send email with token
    // For now, log it (development only)
    console.log(`[DEV] Password reset token for ${user.email}: ${token}`);
    await (0, audit_service_js_1.logAuthEvent)({
        event_type: 'PASSWORD_RESET_REQUESTED',
        user_id: user.id,
        email: user.email,
        success: true,
    });
}
async function resetPassword(request) {
    const { token, hash, expiry } = (0, password_js_1.generatePasswordResetToken)();
    // We need to verify the provided token against stored hash
    // The request contains the token, we hash it and look up
    const tokenHash = crypto.createHash('sha256').update(request.token).digest('hex');
    const userId = await (0, session_service_js_1.consumePasswordResetToken)(tokenHash);
    if (!userId) {
        throw new Error('Invalid or expired reset token');
    }
    const user = await findUserById(userId);
    if (!user)
        throw new Error('User not found');
    // Validate new password
    const policy = (0, password_js_1.getPasswordPolicy)();
    const validation = (0, password_js_1.validatePassword)(request.new_password, policy);
    if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
    }
    // Hash and update
    const newHash = await (0, password_js_1.hashPassword)(request.new_password);
    await updateUserPassword(userId, newHash);
    // Revoke all sessions
    await (0, session_service_js_1.deleteAllUserSessions)(userId);
    await (0, audit_service_js_1.logAuthEvent)({
        event_type: 'PASSWORD_RESET_COMPLETED',
        user_id: userId,
        email: user.email,
        success: true,
    });
}
// ============================================================================
// USER REGISTRATION (Admin only)
// ============================================================================
async function registerUser(request, createdBy) {
    // Check if email or employee_id exists
    const existingEmail = await findUserByEmail(request.email);
    if (existingEmail) {
        throw new Error('Email already registered');
    }
    const existingEmployee = await findUserByEmployeeId(request.employee_id);
    if (existingEmployee) {
        throw new Error('Employee ID already registered');
    }
    // Validate password
    const policy = (0, password_js_1.getPasswordPolicy)();
    const validation = (0, password_js_1.validatePassword)(request.password, policy);
    if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
    }
    // Hash password
    const passwordHash = await (0, password_js_1.hashPassword)(request.password);
    // Create user
    const userId = (0, uuid_1.v4)();
    await (0, database_js_1.pgQuery)(`INSERT INTO users (id, employee_id, email, phone, password_hash, full_name, role, department, designation, badge_number, status, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING_VERIFICATION',$11,NOW(),NOW())
         RETURNING *`, [userId, request.employee_id, request.email.toLowerCase(), request.phone, passwordHash, request.full_name, request.role, request.department, request.designation, request.badge_number, createdBy]);
    const user = await findUserById(userId);
    if (!user)
        throw new Error('Failed to create user');
    await (0, audit_service_js_1.logAuthEvent)({
        event_type: 'LOGIN_SUCCESS',
        user_id: userId,
        email: user.email,
        success: true,
        metadata: { action: 'user_registered', created_by: createdBy },
    });
    return toUserPublic(user);
}
// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================
async function updateProfile(userId, request) {
    const user = await updateUserProfile(userId, request);
    if (!user)
        throw new Error('User not found');
    return toUserPublic(user);
}
async function getProfile(userId) {
    const user = await findUserById(userId);
    if (!user)
        throw new Error('User not found');
    return toUserPublic(user);
}
// ============================================================================
// SESSION MANAGEMENT
// ============================================================================
async function getCurrentSessions(userId) {
    return (0, session_service_js_1.getUserSessions)(userId);
}
async function revokeSession(userId, sessionId) {
    await (0, session_service_js_1.deleteSession)(sessionId);
}
async function revokeAllSessions(userId, exceptSessionId) {
    return (0, session_service_js_1.deleteAllUserSessions)(userId, exceptSessionId);
}
// ============================================================================
// DEVICE TRUST
// ============================================================================
async function trustCurrentDevice(userId, deviceName, userAgent) {
    const deviceId = (0, mfa_js_1.generateDeviceId)();
    const fingerprint = (0, mfa_js_1.createDeviceFingerprint)(userAgent || '');
    await (0, session_service_js_1.trustDevice)(userId, deviceId, deviceName, fingerprint);
}
async function checkDeviceTrust(userId, deviceId, userAgent) {
    const fingerprint = (0, mfa_js_1.createDeviceFingerprint)(userAgent || '');
    return (0, session_service_js_1.isDeviceTrusted)(userId, deviceId, fingerprint);
}
// ============================================================================
// RISK ASSESSMENT
// ============================================================================
async function assessLoginRisk(userId, ipAddress, userAgent) {
    const user = await findUserById(userId);
    if (!user) {
        return (0, mfa_js_1.assessMfaRisk)(true, true, true, 0, 0, 'INVESTIGATING_OFFICER');
    }
    // Check if device is known
    const deviceFingerprint = (0, mfa_js_1.createDeviceFingerprint)(userAgent || '');
    // In production, check against trusted devices
    // Check if IP is known
    // In production, check against recent login IPs
    // Get failed attempts
    // In production, fetch from Redis
    return (0, mfa_js_1.assessMfaRisk)(false, // isNewDevice
    false, // isNewLocation
    false, // isNewIp
    user.failed_login_attempts, user.last_login_at ? (Date.now() - user.last_login_at.getTime()) / (1000 * 60 * 60) : 0, user.role);
}
//# sourceMappingURL=auth.service.js.map