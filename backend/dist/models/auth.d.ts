/**
 * ADALAT360 - Authentication Models
 * TypeScript interfaces for auth-related data structures
 */
import { UserRole, UserStatus } from '../types/database.js';
export interface User {
    id: string;
    employee_id: string;
    email: string;
    phone?: string;
    password_hash: string;
    totp_secret?: string;
    totp_enabled: boolean;
    full_name: string;
    role: UserRole;
    department: string;
    designation?: string;
    badge_number?: string;
    status: UserStatus;
    x509_cert_pem?: string;
    x509_cert_serial?: string;
    x509_cert_issued_at?: Date;
    x509_cert_expires_at?: Date;
    last_login_at?: Date;
    failed_login_attempts: number;
    locked_until?: Date;
    password_changed_at: Date;
    mfa_backup_codes?: string[];
    created_at: Date;
    updated_at: Date;
    created_by?: string;
    deleted_at?: Date;
}
export interface UserPublic {
    id: string;
    employee_id: string;
    email: string;
    full_name: string;
    role: UserRole;
    department: string;
    designation?: string;
    badge_number?: string;
    status: UserStatus;
    totp_enabled: boolean;
    last_login_at?: Date;
    created_at: Date;
}
export interface UserSession {
    user_id: string;
    email: string;
    role: UserRole;
    department: string;
    case_ids: string[];
    permissions: string[];
    session_id: string;
    issued_at: number;
    expires_at: number;
}
export interface LoginRequest {
    email: string;
    password: string;
    totp_code?: string;
    backup_code?: string;
    remember_me?: boolean;
}
export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
    expires_in: number;
    user: UserPublic;
    requires_mfa: boolean;
    mfa_method?: 'totp' | 'backup';
}
export interface RefreshTokenRequest {
    refresh_token: string;
}
export interface RefreshTokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
    expires_in: number;
}
export interface MfaSetupResponse {
    secret: string;
    qr_code_url: string;
    backup_codes: string[];
    manual_entry_key: string;
}
export interface MfaVerifyRequest {
    code: string;
    type: 'totp' | 'backup';
}
export interface ChangePasswordRequest {
    current_password: string;
    new_password: string;
    confirm_password: string;
}
export interface ForgotPasswordRequest {
    email: string;
}
export interface ResetPasswordRequest {
    token: string;
    new_password: string;
    confirm_password: string;
}
export interface RegisterUserRequest {
    employee_id: string;
    email: string;
    phone?: string;
    password: string;
    full_name: string;
    role: UserRole;
    department: string;
    designation?: string;
    badge_number?: string;
}
export interface UpdateProfileRequest {
    full_name?: string;
    phone?: string;
    designation?: string;
}
export interface AccessTokenPayload {
    sub: string;
    email: string;
    role: UserRole;
    department: string;
    case_ids: string[];
    permissions: string[];
    session_id: string;
    type: 'access';
    iat: number;
    exp: number;
    iss: string;
    aud: string;
}
export interface RefreshTokenPayload {
    sub: string;
    session_id: string;
    type: 'refresh';
    iat: number;
    exp: number;
    iss: string;
    aud: string;
}
export interface MfaTokenPayload {
    sub: string;
    email: string;
    role: UserRole;
    department: string;
    pending_mfa: true;
    type: 'mfa_pending';
    iat: number;
    exp: number;
    iss: string;
    aud: string;
}
export interface PasswordPolicy {
    min_length: number;
    require_uppercase: boolean;
    require_lowercase: boolean;
    require_numbers: boolean;
    require_special: boolean;
    max_age_days: number;
    history_count: number;
    lockout_threshold: number;
    lockout_duration_minutes: number;
}
export declare const DEFAULT_PASSWORD_POLICY: PasswordPolicy;
export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
    score: number;
}
export interface SessionData {
    session_id: string;
    user_id: string;
    email: string;
    role: UserRole;
    department: string;
    case_ids: string[];
    permissions: string[];
    ip_address?: string;
    user_agent?: string;
    device_fingerprint?: string;
    created_at: Date;
    last_activity_at: Date;
    expires_at: Date;
    is_active: boolean;
    mfa_verified: boolean;
}
export interface ConcurrentSessionInfo {
    session_id: string;
    ip_address?: string;
    user_agent?: string;
    device_fingerprint?: string;
    created_at: Date;
    last_activity_at: Date;
    current: boolean;
}
export type AuthEventType = 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGIN_LOCKED' | 'LOGOUT' | 'MFA_ENABLED' | 'MFA_DISABLED' | 'MFA_VERIFIED' | 'MFA_FAILED' | 'MFA_BACKUP_USED' | 'PASSWORD_CHANGED' | 'PASSWORD_RESET_REQUESTED' | 'PASSWORD_RESET_COMPLETED' | 'SESSION_CREATED' | 'SESSION_REVOKED' | 'SESSION_EXPIRED' | 'CONCURRENT_SESSION_LIMIT_EXCEEDED' | 'SUSPICIOUS_ACTIVITY';
export interface AuthAuditEvent {
    event_type: AuthEventType;
    user_id?: string;
    email?: string;
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
    success: boolean;
    failure_reason?: string;
    metadata?: Record<string, any>;
    risk_score?: number;
    anomaly_flags?: string[];
}
export interface CaseScope {
    case_id: string;
    case_number: string;
    role_in_case: string;
    permissions: string[];
}
export interface UserCaseAccess {
    user_id: string;
    cases: CaseScope[];
    all_cases_access: boolean;
}
export interface ApiKey {
    id: string;
    name: string;
    key_hash: string;
    key_prefix: string;
    permissions: string[];
    allowed_ips?: string[];
    rate_limit?: number;
    expires_at?: Date;
    last_used_at?: Date;
    created_by: string;
    created_at: Date;
    revoked_at?: Date;
}
export interface ApiKeyCreateRequest {
    name: string;
    permissions: string[];
    allowed_ips?: string[];
    rate_limit?: number;
    expires_in_days?: number;
}
export interface ApiKeyResponse {
    id: string;
    name: string;
    key: string;
    key_prefix: string;
    permissions: string[];
    allowed_ips?: string[];
    rate_limit?: number;
    expires_at?: Date;
    created_at: Date;
}
export interface DeviceFingerprint {
    fingerprint: string;
    user_id: string;
    user_agent: string;
    screen_resolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
    hardware_concurrency?: number;
    first_seen: Date;
    last_seen: Date;
    trusted: boolean;
    name?: string;
}
export interface SecurityQuestion {
    id: string;
    question: string;
    answer_hash: string;
}
export interface SecurityQuestionSetup {
    questions: Array<{
        question: string;
        answer: string;
    }>;
}
//# sourceMappingURL=auth.d.ts.map