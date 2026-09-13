/**
 * ADALAT360 - Authentication Service
 * Core authentication logic: login, registration, MFA, password management
 */
import { UserPublic, LoginRequest, LoginResponse, RefreshTokenRequest, RefreshTokenResponse, MfaSetupResponse, MfaVerifyRequest, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest, RegisterUserRequest, UpdateProfileRequest } from '../models/auth.js';
import { assessMfaRisk } from '../utils/mfa.js';
export declare function login(request: LoginRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse>;
export declare function verifyMfa(mfaToken: string, request: MfaVerifyRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse>;
export declare function refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse>;
export declare function logout(accessToken: string, refreshToken?: string): Promise<void>;
export declare function logoutAllDevices(userId: string, currentSessionId?: string): Promise<number>;
export declare function setupMfaForUser(userId: string): Promise<MfaSetupResponse>;
export declare function enableMfa(userId: string, verificationCode: string): Promise<{
    backup_codes: string[];
}>;
export declare function disableMfa(userId: string, password: string): Promise<void>;
export declare function regenerateBackupCodes(userId: string, password: string): Promise<string[]>;
export declare function changePassword(userId: string, request: ChangePasswordRequest): Promise<void>;
export declare function requestPasswordReset(request: ForgotPasswordRequest): Promise<void>;
export declare function resetPassword(request: ResetPasswordRequest): Promise<void>;
export declare function registerUser(request: RegisterUserRequest, createdBy: string): Promise<UserPublic>;
export declare function updateProfile(userId: string, request: UpdateProfileRequest): Promise<UserPublic>;
export declare function getProfile(userId: string): Promise<UserPublic>;
export declare function getCurrentSessions(userId: string): Promise<ConcurrentSessionInfo[]>;
export declare function revokeSession(userId: string, sessionId: string): Promise<void>;
export declare function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number>;
export declare function trustCurrentDevice(userId: string, deviceName: string, userAgent?: string): Promise<void>;
export declare function checkDeviceTrust(userId: string, deviceId: string, userAgent?: string): Promise<boolean>;
export declare function assessLoginRisk(userId: string, ipAddress?: string, userAgent?: string): Promise<ReturnType<typeof assessMfaRisk>>;
//# sourceMappingURL=auth.service.d.ts.map