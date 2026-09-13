"use strict";
/**
 * ADALAT360 - Admin Routes
 * REST API for system administration, user management, configuration
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
const express_1 = require("express");
const zod_1 = require("zod");
const database_js_1 = require("../config/database.js");
const auth_middleware_js_1 = require("../middleware/auth/auth.middleware.js");
const validate_middleware_js_1 = require("../middleware/validate.middleware.js");
const audit_service_js_1 = require("../services/audit.service.js");
const database_js_2 = require("../types/database.js");
const uuid_1 = require("uuid");
const bcrypt = __importStar(require("bcryptjs"));
const router = (0, express_1.Router)();
// All routes require authentication + admin/auditor role
router.use(auth_middleware_js_1.authenticate);
router.use((0, auth_middleware_js_1.requireRole)(database_js_2.UserRole.CENTRAL_ADMIN, database_js_2.UserRole.AUDITOR));
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
const userIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: zod_1.z.string().uuid(),
    }),
});
const createUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        employee_id: zod_1.z.string().min(3).max(50),
        email: zod_1.z.string().email().toLowerCase(),
        phone: zod_1.z.string().max(20).optional(),
        password: zod_1.z.string().min(12).max(128),
        full_name: zod_1.z.string().min(2).max(255),
        role: zod_1.z.nativeEnum(database_js_2.UserRole),
        department: zod_1.z.string().min(2).max(100),
        designation: zod_1.z.string().max(100).optional(),
        badge_number: zod_1.z.string().max(50).optional(),
    }),
});
const updateUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        full_name: zod_1.z.string().max(255).optional(),
        phone: zod_1.z.string().max(20).optional(),
        designation: zod_1.z.string().max(100).optional(),
        badge_number: zod_1.z.string().max(50).optional(),
        status: zod_1.z.nativeEnum(database_js_2.UserStatus).optional(),
        department: zod_1.z.string().max(100).optional(),
    }),
});
const updateUserRoleSchema = zod_1.z.object({
    body: zod_1.z.object({
        role: zod_1.z.nativeEnum(database_js_2.UserRole),
    }),
});
const resetUserPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        new_password: zod_1.z.string().min(12).max(128),
    }),
});
const configSchema = zod_1.z.object({
    body: zod_1.z.object({
        config_key: zod_1.z.string().min(1).max(100),
        config_value: zod_1.z.any(),
        description: zod_1.z.string().optional(),
        is_sensitive: zod_1.z.boolean().default(false),
    }),
});
const configKeyParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        configKey: zod_1.z.string().min(1).max(100),
    }),
});
const userQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
        role: zod_1.z.nativeEnum(database_js_2.UserRole).optional(),
        status: zod_1.z.nativeEnum(database_js_2.UserStatus).optional(),
        department: zod_1.z.string().optional(),
        search: zod_1.z.string().optional(),
    }),
});
// ============================================================================
// USER MANAGEMENT
// ============================================================================
// List users
router.get('/users', (0, auth_middleware_js_1.userRateLimit)(30, 60000, 'admin_users_list'), (0, validate_middleware_js_1.validate)(userQuerySchema), async (req, res, next) => {
    try {
        const { page, limit, role, status, department, search } = req.query;
        const offset = (page - 1) * limit;
        const conditions = ['deleted_at IS NULL'];
        const params = [];
        let paramIndex = 1;
        if (role) {
            conditions.push(`role = $${paramIndex++}`);
            params.push(role);
        }
        if (status) {
            conditions.push(`status = $${paramIndex++}`);
            params.push(status);
        }
        if (department) {
            conditions.push(`department = $${paramIndex++}`);
            params.push(department);
        }
        if (search) {
            conditions.push(`(
                    email ILIKE $${paramIndex} OR
                    full_name ILIKE $${paramIndex} OR
                    employee_id ILIKE $${paramIndex} OR
                    badge_number ILIKE $${paramIndex}
                )`);
            params.push(`%${search}%`);
            paramIndex++;
        }
        const whereClause = conditions.join(' AND ');
        params.push(limit, offset);
        const [usersResult, countResult] = await Promise.all([
            (0, database_js_1.pgQuery)(`SELECT id, employee_id, email, phone, full_name, role, department, designation, badge_number, status, totp_enabled, last_login_at, created_at
                     FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`, params),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as total FROM users WHERE ${whereClause}`, params.slice(0, -2)),
        ]);
        res.json({
            users: usersResult.rows,
            total: parseInt(countResult.rows[0].total, 10),
            page,
            limit,
            totalPages: Math.ceil(parseInt(countResult.rows[0].total, 10) / limit),
        });
    }
    catch (error) {
        next(error);
    }
});
// Get user by ID
router.get('/users/:userId', (0, validate_middleware_js_1.validate)(userIdParamSchema), async (req, res, next) => {
    try {
        const result = await (0, database_js_1.pgQuery)(`SELECT id, employee_id, email, phone, full_name, role, department, designation, badge_number, status, totp_enabled, last_login_at, failed_login_attempts, locked_until, password_changed_at, created_at, updated_at
                 FROM users WHERE id = $1 AND deleted_at IS NULL`, [req.params.userId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// Create user
router.post('/users', (0, validate_middleware_js_1.validate)(createUserSchema), async (req, res, next) => {
    try {
        // Check duplicates
        const existingEmail = await (0, database_js_1.pgQuery)(`SELECT id FROM users WHERE email = $1`, [req.body.email.toLowerCase()]);
        if (existingEmail.rows.length > 0) {
            res.status(409).json({ error: 'CONFLICT', message: 'Email already registered' });
            return;
        }
        const existingEmp = await (0, database_js_1.pgQuery)(`SELECT id FROM users WHERE employee_id = $1`, [req.body.employee_id]);
        if (existingEmp.rows.length > 0) {
            res.status(409).json({ error: 'CONFLICT', message: 'Employee ID already registered' });
            return;
        }
        const passwordHash = await bcrypt.hash(req.body.password, 12);
        const userId = (0, uuid_1.v4)();
        await (0, database_js_1.pgTransaction)(async (client) => {
            await client.query(`INSERT INTO users (id, employee_id, email, phone, password_hash, full_name, role, department, designation, badge_number, status, created_by, created_at, updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING_VERIFICATION',$11,NOW(),NOW())
                     RETURNING id, employee_id, email, full_name, role, department, designation, badge_number, status, created_at`, [userId, req.body.employee_id, req.body.email.toLowerCase(), req.body.phone, passwordHash, req.body.full_name, req.body.role, req.body.department, req.body.designation, req.body.badge_number, req.auth.sub]);
        });
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'USER_CREATED',
            event_category: 'USER_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'create_user',
            outcome: 'SUCCESS',
            resource_type: 'USER',
            resource_id: userId,
            request_id: req.headers['x-request-id'],
        });
        const created = await (0, database_js_1.pgQuery)(`SELECT id, employee_id, email, full_name, role, department, designation, badge_number, status, created_at FROM users WHERE id = $1`, [userId]);
        res.status(201).json(created.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// Update user
router.patch('/users/:userId', (0, validate_middleware_js_1.validate)(userIdParamSchema), (0, validate_middleware_js_1.validate)(updateUserSchema), async (req, res, next) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        const fields = [];
        const values = [];
        let paramIndex = 1;
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                fields.push(`${key} = $${paramIndex++}`);
                values.push(value);
            }
        }
        if (fields.length === 0) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'No fields to update' });
            return;
        }
        fields.push(`updated_at = NOW()`);
        values.push(userId);
        const result = await (0, database_js_1.pgQuery)(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING id, employee_id, email, full_name, role, department, designation, badge_number, status, updated_at`, values);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
            return;
        }
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'USER_UPDATED',
            event_category: 'USER_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'update_user',
            outcome: 'SUCCESS',
            resource_type: 'USER',
            resource_id: userId,
            request_id: req.headers['x-request-id'],
        });
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// Update user role
router.patch('/users/:userId/role', (0, validate_middleware_js_1.validate)(userIdParamSchema), (0, validate_middleware_js_1.validate)(updateUserRoleSchema), async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        const result = await (0, database_js_1.pgQuery)(`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING id, employee_id, email, full_name, role, department, status`, [role, userId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
            return;
        }
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'USER_ROLE_CHANGED',
            event_category: 'USER_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'change_user_role',
            outcome: 'SUCCESS',
            resource_type: 'USER',
            resource_id: userId,
            request_id: req.headers['x-request-id'],
            metadata: { new_role: role },
        });
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// Reset user password (admin)
router.post('/users/:userId/reset-password', (0, validate_middleware_js_1.validate)(userIdParamSchema), (0, validate_middleware_js_1.validate)(resetUserPasswordSchema), async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { new_password } = req.body;
        const passwordHash = await bcrypt.hash(new_password, 12);
        await (0, database_js_1.pgQuery)(`UPDATE users SET password_hash = $1, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $2`, [passwordHash, userId]);
        // Revoke all sessions
        // In production, call session service
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'ADMIN_PASSWORD_RESET',
            event_category: 'USER_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'admin_reset_password',
            outcome: 'SUCCESS',
            resource_type: 'USER',
            resource_id: userId,
            request_id: req.headers['x-request-id'],
        });
        res.json({ message: 'Password reset successfully' });
    }
    catch (error) {
        next(error);
    }
});
// Delete user (soft delete)
router.delete('/users/:userId', (0, validate_middleware_js_1.validate)(userIdParamSchema), async (req, res, next) => {
    try {
        const { userId } = req.params;
        if (userId === req.auth.sub) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot delete yourself' });
            return;
        }
        await (0, database_js_1.pgQuery)(`UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [userId]);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'USER_DELETED',
            event_category: 'USER_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'delete_user',
            outcome: 'SUCCESS',
            resource_type: 'USER',
            resource_id: userId,
            request_id: req.headers['x-request-id'],
        });
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// SYSTEM CONFIGURATION
// ============================================================================
// List config
router.get('/config', async (req, res, next) => {
    try {
        const result = await (0, database_js_1.pgQuery)(`SELECT config_key, config_value, description, is_sensitive, updated_at FROM system_config ORDER BY config_key`);
        // Mask sensitive values
        const configs = result.rows.map(row => ({
            ...row,
            config_value: row.is_sensitive ? '[REDACTED]' : row.config_value,
        }));
        res.json(configs);
    }
    catch (error) {
        next(error);
    }
});
// Get config by key
router.get('/config/:configKey', (0, validate_middleware_js_1.validate)(configKeyParamSchema), async (req, res, next) => {
    try {
        const result = await (0, database_js_1.pgQuery)(`SELECT config_key, config_value, description, is_sensitive, updated_at FROM system_config WHERE config_key = $1`, [req.params.configKey]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Config not found' });
            return;
        }
        const config = result.rows[0];
        if (config.is_sensitive) {
            config.config_value = '[REDACTED]';
        }
        res.json(config);
    }
    catch (error) {
        next(error);
    }
});
// Set config
router.post('/config', (0, validate_middleware_js_1.validate)(configSchema), async (req, res, next) => {
    try {
        const { config_key, config_value, description, is_sensitive } = req.body;
        await (0, database_js_1.pgQuery)(`INSERT INTO system_config (config_key, config_value, description, is_sensitive, updated_by, updated_at)
                 VALUES ($1,$2,$3,$4,$5,NOW())
                 ON CONFLICT (config_key) DO UPDATE SET
                    config_value = EXCLUDED.config_value,
                    description = EXCLUDED.description,
                    is_sensitive = EXCLUDED.is_sensitive,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = NOW()`, [config_key, JSON.stringify(config_value), description, is_sensitive, req.auth.sub]);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'CONFIG_UPDATED',
            event_category: 'SYSTEM_CONFIG',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'set_config',
            outcome: 'SUCCESS',
            resource_type: 'CONFIG',
            resource_id: config_key,
            request_id: req.headers['x-request-id'],
        });
        res.json({ message: 'Config updated successfully' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// BLOCKCHAIN NODE MANAGEMENT
// ============================================================================
router.get('/blockchain/nodes', async (req, res, next) => {
    try {
        const result = await (0, database_js_1.pgQuery)(`SELECT * FROM blockchain_nodes ORDER BY node_type, created_at`);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
});
router.post('/blockchain/nodes', (0, validate_middleware_js_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        node_id: zod_1.z.string().min(1).max(100),
        node_type: zod_1.z.enum(['OFFICER_NODE', 'FORENSIC_LAB_NODE', 'COURT_NODE', 'CENTRAL_AUDIT_NODE']),
        organization_name: zod_1.z.string().min(1).max(200),
        organization_msp_id: zod_1.z.string().min(1).max(100),
        peer_endpoint: zod_1.z.string().min(1).max(500),
        ca_endpoint: zod_1.z.string().max(500).optional(),
        tls_cert_pem: zod_1.z.string().min(1),
        is_orderer: zod_1.z.boolean().default(false),
        orderer_endpoint: zod_1.z.string().max(500).optional(),
    }),
})), async (req, res, next) => {
    try {
        const nodeId = (0, uuid_1.v4)();
        await (0, database_js_1.pgQuery)(`INSERT INTO blockchain_nodes (id, node_id, node_type, organization_name, organization_msp_id, peer_endpoint, ca_endpoint, tls_cert_pem, is_orderer, orderer_endpoint, created_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`, [nodeId, req.body.node_id, req.body.node_type, req.body.organization_name, req.body.organization_msp_id, req.body.peer_endpoint, req.body.ca_endpoint, req.body.tls_cert_pem, req.body.is_orderer, req.body.orderer_endpoint]);
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'BLOCKCHAIN_NODE_ADDED',
            event_category: 'BLOCKCHAIN',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'add_blockchain_node',
            outcome: 'SUCCESS',
            resource_type: 'BLOCKCHAIN_NODE',
            resource_id: nodeId,
            request_id: req.headers['x-request-id'],
        });
        res.status(201).json({ id: nodeId, message: 'Blockchain node added' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// SYSTEM HEALTH & STATS
// ============================================================================
router.get('/stats', async (req, res, next) => {
    try {
        const [userStats, caseStats, docStats, eviStats, blockStats,] = await Promise.all([
            (0, database_js_1.pgQuery)(`SELECT role, status, COUNT(*) as count FROM users WHERE deleted_at IS NULL GROUP BY role, status`),
            (0, database_js_1.pgQuery)(`SELECT status, COUNT(*) as count FROM cases WHERE deleted_at IS NULL GROUP BY status`),
            (0, database_js_1.pgQuery)(`SELECT document_type, status, COUNT(*) as count FROM documents WHERE deleted_at IS NULL GROUP BY document_type, status`),
            (0, database_js_1.pgQuery)(`SELECT evidence_type, status, COUNT(*) as count FROM evidence WHERE deleted_at IS NULL GROUP BY evidence_type, status`),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as total_blocks, MAX(block_number) as latest_block FROM blockchain_blocks`),
        ]);
        res.json({
            users: userStats.rows,
            cases: caseStats.rows,
            documents: docStats.rows,
            evidence: eviStats.rows,
            blockchain: blockStats.rows[0],
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=admin.routes.js.map