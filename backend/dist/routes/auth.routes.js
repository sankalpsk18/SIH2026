"use strict";
/**
 * ADALAT360 - Authentication Routes
 * REST API endpoints for authentication and authorization
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_service_js_1 = require("../services/auth.service.js");
const auth_middleware_js_1 = require("../middleware/auth/auth.middleware.js");
const validate_middleware_js_1 = require("../middleware/validate.middleware.js");
const auth_validators_js_1 = require("../validators/auth.validators.js");
const audit_service_js_1 = require("../services/audit.service.js");
const router = (0, express_1.Router)();
// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================
// Login
router.post('/login', (0, auth_middleware_js_1.userRateLimit)(5, 15 * 60 * 1000, 'login'), (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.login), async (req, res, next) => {
    try {
        const ipAddress = req.ip;
        const userAgent = req.get('user-agent');
        const result = await auth_service_js_1.authService.login(req.body, ipAddress, userAgent);
        // If MFA required, return special response
        if (result.requires_mfa) {
            res.status(200).json({
                requires_mfa: true,
                mfa_method: result.mfa_method,
                message: 'Multi-factor authentication required',
                user: result.user,
            });
            return;
        }
        // Set refresh token as HttpOnly cookie
        res.cookie('refresh_token', result.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        res.json({
            access_token: result.access_token,
            token_type: result.token_type,
            expires_in: result.expires_in,
            user: result.user,
        });
    }
    catch (error) {
        next(error);
    }
});
// MFA Verification (after login)
router.post('/mfa/verify', (0, auth_middleware_js_1.userRateLimit)(10, 5 * 60 * 1000, 'mfa_verify'), (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.mfaVerify), async (req, res, next) => {
    try {
        const mfaToken = req.headers['x-mfa-token'];
        if (!mfaToken) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'MFA token required in x-mfa-token header' });
            return;
        }
        const ipAddress = req.ip;
        const userAgent = req.get('user-agent');
        const result = await auth_service_js_1.authService.verifyMfa(mfaToken, req.body, ipAddress, userAgent);
        res.cookie('refresh_token', result.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.json({
            access_token: result.access_token,
            token_type: result.token_type,
            expires_in: result.expires_in,
            user: result.user,
        });
    }
    catch (error) {
        next(error);
    }
});
// Refresh Token
router.post('/refresh', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.refreshToken), async (req, res, next) => {
    try {
        const result = await auth_service_js_1.authService.refreshToken(req.body);
        res.cookie('refresh_token', result.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.json({
            access_token: result.access_token,
            token_type: result.token_type,
            expires_in: result.expires_in,
        });
    }
    catch (error) {
        next(error);
    }
});
// Forgot Password
router.post('/forgot-password', (0, auth_middleware_js_1.userRateLimit)(3, 60 * 60 * 1000, 'forgot_password'), (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.forgotPassword), async (req, res, next) => {
    try {
        await auth_service_js_1.authService.requestPasswordReset(req.body);
        res.json({ message: 'If the email exists, a password reset link has been sent' });
    }
    catch (error) {
        next(error);
    }
});
// Reset Password
router.post('/reset-password', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.resetPassword), async (req, res, next) => {
    try {
        await auth_service_js_1.authService.resetPassword(req.body);
        res.json({ message: 'Password has been reset successfully' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// PROTECTED ROUTES (authentication required)
// ============================================================================
// All routes below require authentication
router.use(auth_middleware_js_1.authenticate);
// Logout
router.post('/logout', async (req, res, next) => {
    try {
        const accessToken = req.headers.authorization?.replace('Bearer ', '');
        const refreshToken = req.cookies?.refresh_token;
        await auth_service_js_1.authService.logout(accessToken || '', refreshToken);
        res.clearCookie('refresh_token');
        res.json({ message: 'Logged out successfully' });
    }
    catch (error) {
        next(error);
    }
});
// Logout all devices
router.post('/logout-all', async (req, res, next) => {
    try {
        const currentSessionId = req.sessionId;
        const count = await auth_service_js_1.authService.logoutAllDevices(req.auth.sub, currentSessionId);
        res.clearCookie('refresh_token');
        res.json({ message: `Logged out from ${count} other device(s)` });
    }
    catch (error) {
        next(error);
    }
});
// Get current user profile
router.get('/me', async (req, res, next) => {
    try {
        const profile = await auth_service_js_1.authService.getProfile(req.auth.sub);
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
});
// Update profile
router.patch('/me', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.updateProfile), async (req, res, next) => {
    try {
        const profile = await auth_service_js_1.authService.updateProfile(req.auth.sub, req.body);
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
});
// Change password
router.post('/change-password', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.changePassword), async (req, res, next) => {
    try {
        await auth_service_js_1.authService.changePassword(req.auth.sub, req.body);
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        next(error);
    }
});
// Get current sessions
router.get('/sessions', async (req, res, next) => {
    try {
        const sessions = await auth_service_js_1.authService.getCurrentSessions(req.auth.sub);
        const currentSessionId = req.sessionId;
        res.json(sessions.map(s => ({
            ...s,
            current: s.session_id === currentSessionId,
        })));
    }
    catch (error) {
        next(error);
    }
});
// Revoke specific session
router.delete('/sessions/:sessionId', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.sessionIdParam), async (req, res, next) => {
    try {
        await auth_service_js_1.authService.revokeSession(req.auth.sub, req.params.sessionId);
        res.json({ message: 'Session revoked' });
    }
    catch (error) {
        next(error);
    }
});
// Revoke all other sessions
router.delete('/sessions', async (req, res, next) => {
    try {
        const currentSessionId = req.sessionId;
        const count = await auth_service_js_1.authService.revokeAllSessions(req.auth.sub, currentSessionId);
        res.json({ message: `Revoked ${count} session(s)` });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// MFA MANAGEMENT
// ============================================================================
// Setup MFA (initiate)
router.post('/mfa/setup', (0, auth_middleware_js_1.requirePermission)('ADMIN'), // Or any authenticated user? Let's allow any authenticated user
async (req, res, next) => {
    try {
        const setup = await auth_service_js_1.authService.setupMfaForUser(req.auth.sub);
        res.json({
            secret: setup.secret,
            qr_code_url: setup.qr_code_url,
            manual_entry_key: setup.manual_entry_key,
            // Don't return backup codes until enabled
        });
    }
    catch (error) {
        next(error);
    }
});
// Enable MFA (verify and activate)
router.post('/mfa/enable', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.setupMfa), async (req, res, next) => {
    try {
        const result = await auth_service_js_1.authService.enableMfa(req.auth.sub, req.body.verification_code);
        res.json({
            message: 'MFA enabled successfully',
            backup_codes: result.backup_codes,
        });
    }
    catch (error) {
        next(error);
    }
});
// Disable MFA
router.post('/mfa/disable', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.disableMfa), async (req, res, next) => {
    try {
        await auth_service_js_1.authService.disableMfa(req.auth.sub, req.body.password);
        res.json({ message: 'MFA disabled successfully' });
    }
    catch (error) {
        next(error);
    }
});
// Regenerate backup codes
router.post('/mfa/backup-codes', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.regenerateBackupCodes), async (req, res, next) => {
    try {
        const codes = await auth_service_js_1.authService.regenerateBackupCodes(req.auth.sub, req.body.password);
        res.json({ backup_codes: codes });
    }
    catch (error) {
        next(error);
    }
});
// Trust current device
router.post('/device/trust', async (req, res, next) => {
    try {
        const deviceName = req.body.device_name || 'Current Device';
        await auth_service_js_1.authService.trustCurrentDevice(req.auth.sub, deviceName, req.get('user-agent'));
        res.json({ message: 'Device trusted for 30 days' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// ADMIN ROUTES (require CENTRAL_ADMIN or AUDITOR role)
// ============================================================================
const adminRouter = (0, express_1.Router)();
adminRouter.use((0, auth_middleware_js_1.requireRole)('CENTRAL_ADMIN', 'AUDITOR'));
// Register new user (admin only)
adminRouter.post('/users', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.registerUser), async (req, res, next) => {
    try {
        const user = await auth_service_js_1.authService.registerUser(req.body, req.auth.sub);
        res.status(201).json(user);
    }
    catch (error) {
        next(error);
    }
});
// List users
adminRouter.get('/users', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.userQuery), async (req, res, next) => {
    try {
        // Implementation would query users with pagination
        res.json({ message: 'User listing - implement with pagination' });
    }
    catch (error) {
        next(error);
    }
});
// Get user by ID
adminRouter.get('/users/:userId', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.userIdParam), async (req, res, next) => {
    try {
        // Implementation
        res.json({ message: 'Get user by ID - implement' });
    }
    catch (error) {
        next(error);
    }
});
// Get audit logs
adminRouter.get('/audit', (0, validate_middleware_js_1.validate)(auth_validators_js_1.authValidators.auditQuery), async (req, res, next) => {
    try {
        const { events, total } = await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'AUDIT_QUERY',
            event_category: 'AUDIT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            action: 'query_audit_logs',
            outcome: 'SUCCESS',
            request_id: req.headers['x-request-id'],
        });
        // Actually query audit logs
        // const result = await queryAuditLogs(req.query);
        res.json({ events: [], total: 0, message: 'Implement audit query' });
    }
    catch (error) {
        next(error);
    }
});
// Generate compliance report
adminRouter.post('/compliance-report', async (req, res, next) => {
    try {
        const { start_date, end_date, format = 'json' } = req.body;
        // Implementation
        res.json({ message: 'Compliance report generation - implement' });
    }
    catch (error) {
        next(error);
    }
});
// Export audit logs
adminRouter.get('/audit/export', async (req, res, next) => {
    try {
        // Implementation
        res.json({ message: 'Audit export - implement' });
    }
    catch (error) {
        next(error);
    }
});
router.use('/admin', adminRouter);
// ============================================================================
// HEALTH CHECK (public)
// ============================================================================
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'auth',
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map