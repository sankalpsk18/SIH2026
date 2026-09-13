/**
 * ADALAT360 - Authentication Service
 * Core authentication logic: login, registration, MFA, password management
 */

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { pgQuery, pgTransaction, getPgPool } from '../config/database.js';
import { getRedisClient } from './session.service.js';
import {
    User,
    UserPublic,
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    MfaSetupResponse,
    MfaVerifyRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    RegisterUserRequest,
    UpdateProfileRequest,
    UserRole,
    UserStatus,
    CaseScope,
    UserCaseAccess,
    AuthAuditEvent,
    AuthEventType,
    PasswordPolicy,
} from '../models/auth.js';
import {
    generateTokenPair,
    verifyAccessToken,
    verifyRefreshToken,
    verifyMfaToken,
    generateMfaPendingToken,
    extractTokenFromHeader,
} from '../utils/jwt.js';
import {
    hashPassword,
    verifyPassword,
    validatePassword,
    getPasswordPolicy,
    checkPasswordHistory,
    generatePasswordResetToken,
    verifyPasswordResetToken,
    isPasswordExpired,
    getDaysUntilExpiry,
} from '../utils/password.js';
import {
    setupMfa,
    verifyTotp,
    verifyBackupCode,
    canRecoverMfa,
    assessMfaRisk,
    generateDeviceId,
    createDeviceFingerprint,
} from '../utils/mfa.js';
import {
    createSession,
    getSession,
    updateSessionMfaVerified,
    deleteSession,
    deleteAllUserSessions,
    getUserSessions,
    recordLoginAttempt,
    isLockedOut,
    getLockoutRemaining,
    storeMfaPending,
    consumeMfaPending,
    storePasswordResetToken,
    consumePasswordResetToken,
    revokeAccessToken,
    revokeRefreshToken,
    trustDevice,
    isDeviceTrusted,
} from './session.service.js';
import { logAuthEvent } from './audit.service.js';

// ============================================================================
// USER QUERIES
// ============================================================================

async function findUserByEmail(email: string): Promise<User | null> {
    const result = await pgQuery<User>(
        `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
        [email.toLowerCase()]
    );
    return result.rows[0] || null;
}

async function findUserById(id: string): Promise<User | null> {
    const result = await pgQuery<User>(
        `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [id]
    );
    return result.rows[0] || null;
}

async function findUserByEmployeeId(employeeId: string): Promise<User | null> {
    const result = await pgQuery<User>(
        `SELECT * FROM users WHERE employee_id = $1 AND deleted_at IS NULL`,
        [employeeId]
    );
    return result.rows[0] || null;
}

async function updateUserLastLogin(userId: string): Promise<void> {
    await pgQuery(
        `UPDATE users SET last_login_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
        [userId]
    );
}

async function incrementFailedLogin(userId: string): Promise<void> {
    await pgQuery(
        `UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1`,
        [userId]
    );
}

async function lockUserAccount(userId: string, durationMinutes: number = 30): Promise<void> {
    const lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    await pgQuery(
        `UPDATE users SET locked_until = $1 WHERE id = $2`,
        [lockedUntil, userId]
    );
}

async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await pgQuery(
        `UPDATE users SET password_hash = $1, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $2`,
        [passwordHash, userId]
    );
}

async function updateUserTotp(userId: string, secret: string, enabled: boolean, backupCodes?: string[]): Promise<void> {
    if (enabled && backupCodes) {
        await pgQuery(
            `UPDATE users SET totp_secret = $1, totp_enabled = $2, mfa_backup_codes = $3 WHERE id = $4`,
            [secret, enabled, backupCodes, userId]
        );
    } else {
        await pgQuery(
            `UPDATE users SET totp_secret = $1, totp_enabled = $2 WHERE id = $3`,
            [secret, enabled, userId]
        );
    }
}

async function updateUserProfile(userId: string, updates: Partial<UpdateProfileRequest>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
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

    if (fields.length === 0) return findUserById(userId);

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await pgQuery<User>(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
        values
    );
    return result.rows[0] || null;
}

async function getUserCaseAccess(userId: string, userRole: UserRole): Promise<UserCaseAccess> {
    // Admins and auditors have access to all cases
    if (userRole === 'CENTRAL_ADMIN' || userRole === 'AUDITOR') {
        const casesResult = await pgQuery(
            `SELECT id, case_number FROM cases WHERE deleted_at IS NULL`
        );
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
    const assignmentsResult = await pgQuery(
        `SELECT ca.case_id, c.case_number, ca.role_in_case, ca.permission_level
         FROM case_assignments ca
         JOIN cases c ON c.id = ca.case_id
         WHERE ca.user_id = $1 AND ca.is_active = TRUE AND c.deleted_at IS NULL
         AND (ca.revoked_at IS NULL OR ca.revoked_at > NOW())`,
        [userId]
    );

    const cases: CaseScope[] = assignmentsResult.rows.map(r => ({
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

function toUserPublic(user: User): UserPublic {
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

export async function login(request: LoginRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const email = request.email.toLowerCase().trim();
    const deviceFingerprint = createDeviceFingerprint(userAgent || '');

    // Check lockout
    const locked = await isLockedOut(email);
    if (locked) {
        const remaining = await getLockoutRemaining(email);
        await logAuthEvent({
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
        await recordLoginAttempt(email, false);
        await logAuthEvent({
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
        await logAuthEvent({
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
    const passwordValid = await verifyPassword(request.password, user.password_hash);
    if (!passwordValid) {
        await incrementFailedLogin(user.id);
        await recordLoginAttempt(email, false);

        // Check if should lock in DB too
        if (user.failed_login_attempts + 1 >= 5) {
            await lockUserAccount(user.id);
        }

        await logAuthEvent({
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
            const totpValid = verifyTotp({ token: request.totp_code, secret: user.totp_secret! });
            if (!totpValid) {
                await recordLoginAttempt(email, false);
                await logAuthEvent({
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
            const backupResult = await verifyBackupCode(request.backup_code, user.mfa_backup_codes);
            if (!backupResult.valid) {
                await recordLoginAttempt(email, false);
                await logAuthEvent({
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
            await pgQuery(
                `UPDATE users SET mfa_backup_codes = $1 WHERE id = $2`,
                [newBackupCodes, user.id]
            );
            await logAuthEvent({
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
            const mfaToken = generateMfaPendingToken({
                sub: user.id,
                email: user.email,
                role: user.role,
                department: user.department,
            });

            await storeMfaPending(mfaToken, user.id);

            await logAuthEvent({
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
    const sessionId = uuidv4();

    const tokenPair = generateTokenPair(
        user.id,
        user.email,
        user.role,
        user.department,
        caseAccess.cases.map(c => c.case_id),
        caseAccess.cases.flatMap(c => c.permissions),
        sessionId
    );

    await createSession(
        user.id,
        user.email,
        user.role,
        user.department,
        caseAccess.cases.map(c => c.case_id),
        caseAccess.cases.flatMap(c => c.permissions),
        ipAddress,
        userAgent,
        deviceFingerprint,
        user.totp_enabled // MFA verified if TOTP enabled and we got here
    );

    await updateUserLastLogin(user.id);
    await recordLoginAttempt(email, true);

    // Check password expiry
    const passwordExpiryDays = getDaysUntilExpiry(user.password_changed_at);
    let passwordExpiryWarning: string | undefined;
    if (passwordExpiryDays <= 7) {
        passwordExpiryWarning = `Password expires in ${passwordExpiryDays} days`;
    }

    await logAuthEvent({
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

export async function verifyMfa(
    mfaToken: string,
    request: MfaVerifyRequest,
    ipAddress?: string,
    userAgent?: string
): Promise<LoginResponse> {
    // Verify MFA pending token
    const mfaResult = verifyMfaToken(mfaToken);
    if (!mfaResult.valid || !mfaResult.payload) {
        throw new Error('Invalid or expired MFA session');
    }

    const userId = mfaResult.payload.sub;
    const user = await findUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    // Consume MFA pending token
    await consumeMfaPending(mfaToken);

    // Verify the provided code
    let mfaVerified = false;
    if (request.type === 'totp') {
        mfaVerified = verifyTotp({ token: request.code, secret: user.totp_secret! });
    } else if (request.type === 'backup' && user.mfa_backup_codes) {
        const backupResult = await verifyBackupCode(request.code, user.mfa_backup_codes);
        mfaVerified = backupResult.valid;
        if (backupResult.valid) {
            // Remove used backup code
            const newBackupCodes = user.mfa_backup_codes.filter((_, i) => i !== backupResult.index);
            await pgQuery(
                `UPDATE users SET mfa_backup_codes = $1 WHERE id = $2`,
                [newBackupCodes, user.id]
            );
        }
    }

    if (!mfaVerified) {
        await logAuthEvent({
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
    const sessionId = uuidv4();

    const tokenPair = generateTokenPair(
        user.id,
        user.email,
        user.role,
        user.department,
        caseAccess.cases.map(c => c.case_id),
        caseAccess.cases.flatMap(c => c.permissions),
        sessionId
    );

    await createSession(
        user.id,
        user.email,
        user.role,
        user.department,
        caseAccess.cases.map(c => c.case_id),
        caseAccess.cases.flatMap(c => c.permissions),
        ipAddress,
        userAgent,
        undefined,
        true
    );

    await updateUserLastLogin(user.id);

    await logAuthEvent({
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

export async function refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const refreshResult = verifyRefreshToken(request.refresh_token);
    if (!refreshResult.valid || !refreshResult.payload) {
        throw new Error('Invalid or expired refresh token');
    }

    const { sub: userId, session_id: sessionId } = refreshResult.payload;

    // Check if refresh token is revoked
    const decoded = verifyRefreshToken(request.refresh_token);
    if (decoded.payload) {
        const revoked = await isRefreshTokenRevoked(decoded.payload.sub + ':' + sessionId);
        if (revoked) {
            throw new Error('Token has been revoked');
        }
    }

    // Get session
    const session = await getSession(sessionId);
    if (!session || !session.is_active) {
        throw new Error('Session expired or revoked');
    }

    // Get fresh case access
    const caseAccess = await getUserCaseAccess(userId, session.role);

    // Generate new token pair
    const tokenPair = generateTokenPair(
        userId,
        session.email,
        session.role,
        session.department,
        caseAccess.cases.map(c => c.case_id),
        caseAccess.cases.flatMap(c => c.permissions),
        sessionId
    );

    // Revoke old refresh token
    await revokeRefreshToken(userId + ':' + sessionId);

    await logAuthEvent({
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

export async function logout(accessToken: string, refreshToken?: string): Promise<void> {
    const accessResult = verifyAccessToken(accessToken);
    if (accessResult.valid && accessResult.payload) {
        const { sub: userId, session_id: sessionId } = accessResult.payload;

        // Delete session
        await deleteSession(sessionId);

        // Revoke tokens
        await revokeAccessToken(userId + ':' + sessionId);
        if (refreshToken) {
            await revokeRefreshToken(userId + ':' + sessionId);
        }

        await logAuthEvent({
            event_type: 'LOGOUT',
            user_id: userId,
            session_id: sessionId,
            success: true,
        });
    }
}

export async function logoutAllDevices(userId: string, currentSessionId?: string): Promise<number> {
    const deleted = await deleteAllUserSessions(userId, currentSessionId);

    await logAuthEvent({
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

export async function setupMfaForUser(userId: string): Promise<MfaSetupResponse> {
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    const setup = await setupMfa(user.email);

    // Store secret temporarily (not enabled yet)
    await pgQuery(
        `UPDATE users SET totp_secret = $1 WHERE id = $2`,
        [setup.secret, userId]
    );

    return setup;
}

export async function enableMfa(userId: string, verificationCode: string): Promise<{ backup_codes: string[] }> {
    const user = await findUserById(userId);
    if (!user || !user.totp_secret) {
        throw new Error('MFA setup not initiated');
    }

    // Verify the code
    const valid = verifyTotp({ token: verificationCode, secret: user.totp_secret });
    if (!valid) {
        throw new Error('Invalid verification code');
    }

    // Generate backup codes
    const backupCodes = await setupMfa(user.email);

    // Enable MFA
    await updateUserTotp(userId, user.totp_secret, true, backupCodes.backup_codes);

    await logAuthEvent({
        event_type: 'MFA_ENABLED',
        user_id: userId,
        email: user.email,
        success: true,
    });

    return { backup_codes: backupCodes.backup_codes };
}

export async function disableMfa(userId: string, password: string): Promise<void> {
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
        throw new Error('Invalid password');
    }

    // Disable MFA
    await updateUserTotp(userId, '', false, []);

    await logAuthEvent({
        event_type: 'MFA_DISABLED',
        user_id: userId,
        email: user.email,
        success: true,
    });
}

export async function regenerateBackupCodes(userId: string, password: string): Promise<string[]> {
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
        throw new Error('Invalid password');
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes(10, 8);
    const hashedCodes = await hashBackupCodes(backupCodes);

    await pgQuery(
        `UPDATE users SET mfa_backup_codes = $1 WHERE id = $2`,
        [hashedCodes, userId]
    );

    await logAuthEvent({
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

export async function changePassword(userId: string, request: ChangePasswordRequest): Promise<void> {
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    // Verify current password
    const valid = await verifyPassword(request.current_password, user.password_hash);
    if (!valid) {
        throw new Error('Current password is incorrect');
    }

    // Validate new password
    const policy = getPasswordPolicy();
    const validation = validatePassword(request.new_password, policy);
    if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
    }

    // Check password history
    // In production, fetch previous hashes from password_history table
    // For now, just check against current
    if (await verifyPassword(request.new_password, user.password_hash)) {
        throw new Error('New password must be different from current password');
    }

    // Hash and update
    const newHash = await hashPassword(request.new_password);
    await updateUserPassword(userId, newHash);

    await logAuthEvent({
        event_type: 'PASSWORD_CHANGED',
        user_id: userId,
        email: user.email,
        success: true,
    });
}

export async function requestPasswordReset(request: ForgotPasswordRequest): Promise<void> {
    const user = await findUserByEmail(request.email);
    // Always return success to prevent email enumeration
    if (!user) return;

    const { token, hash, expiry } = generatePasswordResetToken();
    await storePasswordResetToken(hash, user.id);

    // In production, send email with token
    // For now, log it (development only)
    console.log(`[DEV] Password reset token for ${user.email}: ${token}`);

    await logAuthEvent({
        event_type: 'PASSWORD_RESET_REQUESTED',
        user_id: user.id,
        email: user.email,
        success: true,
    });
}

export async function resetPassword(request: ResetPasswordRequest): Promise<void> {
    const { token, hash, expiry } = generatePasswordResetToken();
    // We need to verify the provided token against stored hash
    // The request contains the token, we hash it and look up

    const tokenHash = crypto.createHash('sha256').update(request.token).digest('hex');
    const userId = await consumePasswordResetToken(tokenHash);

    if (!userId) {
        throw new Error('Invalid or expired reset token');
    }

    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');

    // Validate new password
    const policy = getPasswordPolicy();
    const validation = validatePassword(request.new_password, policy);
    if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
    }

    // Hash and update
    const newHash = await hashPassword(request.new_password);
    await updateUserPassword(userId, newHash);

    // Revoke all sessions
    await deleteAllUserSessions(userId);

    await logAuthEvent({
        event_type: 'PASSWORD_RESET_COMPLETED',
        user_id: userId,
        email: user.email,
        success: true,
    });
}

// ============================================================================
// USER REGISTRATION (Admin only)
// ============================================================================

export async function registerUser(
    request: RegisterUserRequest,
    createdBy: string
): Promise<UserPublic> {
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
    const policy = getPasswordPolicy();
    const validation = validatePassword(request.password, policy);
    if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
    }

    // Hash password
    const passwordHash = await hashPassword(request.password);

    // Create user
    const userId = uuidv4();
    await pgQuery(
        `INSERT INTO users (id, employee_id, email, phone, password_hash, full_name, role, department, designation, badge_number, status, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING_VERIFICATION',$11,NOW(),NOW())
         RETURNING *`,
        [userId, request.employee_id, request.email.toLowerCase(), request.phone, passwordHash, request.full_name, request.role, request.department, request.designation, request.badge_number, createdBy]
    );

    const user = await findUserById(userId);
    if (!user) throw new Error('Failed to create user');

    await logAuthEvent({
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

export async function updateProfile(userId: string, request: UpdateProfileRequest): Promise<UserPublic> {
    const user = await updateUserProfile(userId, request);
    if (!user) throw new Error('User not found');
    return toUserPublic(user);
}

export async function getProfile(userId: string): Promise<UserPublic> {
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');
    return toUserPublic(user);
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export async function getCurrentSessions(userId: string): Promise<ConcurrentSessionInfo[]> {
    return getUserSessions(userId);
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
    await deleteSession(sessionId);
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    return deleteAllUserSessions(userId, exceptSessionId);
}

// ============================================================================
// DEVICE TRUST
// ============================================================================

export async function trustCurrentDevice(
    userId: string,
    deviceName: string,
    userAgent?: string
): Promise<void> {
    const deviceId = generateDeviceId();
    const fingerprint = createDeviceFingerprint(userAgent || '');
    await trustDevice(userId, deviceId, deviceName, fingerprint);
}

export async function checkDeviceTrust(userId: string, deviceId: string, userAgent?: string): Promise<boolean> {
    const fingerprint = createDeviceFingerprint(userAgent || '');
    return isDeviceTrusted(userId, deviceId, fingerprint);
}

// ============================================================================
// RISK ASSESSMENT
// ============================================================================

export async function assessLoginRisk(
    userId: string,
    ipAddress?: string,
    userAgent?: string
): Promise<ReturnType<typeof assessMfaRisk>> {
    const user = await findUserById(userId);
    if (!user) {
        return assessMfaRisk(true, true, true, 0, 0, 'INVESTIGATING_OFFICER');
    }

    // Check if device is known
    const deviceFingerprint = createDeviceFingerprint(userAgent || '');
    // In production, check against trusted devices

    // Check if IP is known
    // In production, check against recent login IPs

    // Get failed attempts
    // In production, fetch from Redis

    return assessMfaRisk(
        false, // isNewDevice
        false, // isNewLocation
        false, // isNewIp
        user.failed_login_attempts,
        user.last_login_at ? (Date.now() - user.last_login_at.getTime()) / (1000 * 60 * 60) : 0,
        user.role
    );
}