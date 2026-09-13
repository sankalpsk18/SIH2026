/**
 * ADALAT360 - Admin Routes
 * REST API for system administration, user management, configuration
 */

import { Router } from 'express';
import { z } from 'zod';
import { pgQuery, pgTransaction } from '../config/database.js';
import { getBlockchainService } from '../blockchain/blockchain.service.js';
import { authenticate, requireRole, userRateLimit } from '../middleware/auth/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { logAuditEvent } from '../services/audit.service.js';
import { UserRole, UserStatus, PermissionLevel } from '../types/database.js';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

const router = Router();

// All routes require authentication + admin/auditor role
router.use(authenticate);
router.use(requireRole(UserRole.CENTRAL_ADMIN, UserRole.AUDITOR));

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const userIdParamSchema = z.object({
    params: z.object({
        userId: z.string().uuid(),
    }),
});

const createUserSchema = z.object({
    body: z.object({
        employee_id: z.string().min(3).max(50),
        email: z.string().email().toLowerCase(),
        phone: z.string().max(20).optional(),
        password: z.string().min(12).max(128),
        full_name: z.string().min(2).max(255),
        role: z.nativeEnum(UserRole),
        department: z.string().min(2).max(100),
        designation: z.string().max(100).optional(),
        badge_number: z.string().max(50).optional(),
    }),
});

const updateUserSchema = z.object({
    body: z.object({
        full_name: z.string().max(255).optional(),
        phone: z.string().max(20).optional(),
        designation: z.string().max(100).optional(),
        badge_number: z.string().max(50).optional(),
        status: z.nativeEnum(UserStatus).optional(),
        department: z.string().max(100).optional(),
    }),
});

const updateUserRoleSchema = z.object({
    body: z.object({
        role: z.nativeEnum(UserRole),
    }),
});

const resetUserPasswordSchema = z.object({
    body: z.object({
        new_password: z.string().min(12).max(128),
    }),
});

const configSchema = z.object({
    body: z.object({
        config_key: z.string().min(1).max(100),
        config_value: z.any(),
        description: z.string().optional(),
        is_sensitive: z.boolean().default(false),
    }),
});

const configKeyParamSchema = z.object({
    params: z.object({
        configKey: z.string().min(1).max(100),
    }),
});

const userQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        role: z.nativeEnum(UserRole).optional(),
        status: z.nativeEnum(UserStatus).optional(),
        department: z.string().optional(),
        search: z.string().optional(),
    }),
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

// List users
router.get('/users',
    userRateLimit(30, 60000, 'admin_users_list'),
    validate(userQuerySchema),
    async (req, res, next) => {
        try {
            const { page, limit, role, status, department, search } = req.query as any;
            const offset = (page - 1) * limit;

            const conditions: string[] = ['deleted_at IS NULL'];
            const params: any[] = [];
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
                pgQuery(
                    `SELECT id, employee_id, email, phone, full_name, role, department, designation, badge_number, status, totp_enabled, last_login_at, created_at
                     FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
                    params
                ),
                pgQuery(`SELECT COUNT(*) as total FROM users WHERE ${whereClause}`, params.slice(0, -2)),
            ]);

            res.json({
                users: usersResult.rows,
                total: parseInt(countResult.rows[0].total, 10),
                page,
                limit,
                totalPages: Math.ceil(parseInt(countResult.rows[0].total, 10) / limit),
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get user by ID
router.get('/users/:userId',
    validate(userIdParamSchema),
    async (req, res, next) => {
        try {
            const result = await pgQuery(
                `SELECT id, employee_id, email, phone, full_name, role, department, designation, badge_number, status, totp_enabled, last_login_at, failed_login_attempts, locked_until, password_changed_at, created_at, updated_at
                 FROM users WHERE id = $1 AND deleted_at IS NULL`,
                [req.params.userId]
            );

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
                return;
            }

            res.json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// Create user
router.post('/users',
    validate(createUserSchema),
    async (req, res, next) => {
        try {
            // Check duplicates
            const existingEmail = await pgQuery(`SELECT id FROM users WHERE email = $1`, [req.body.email.toLowerCase()]);
            if (existingEmail.rows.length > 0) {
                res.status(409).json({ error: 'CONFLICT', message: 'Email already registered' });
                return;
            }

            const existingEmp = await pgQuery(`SELECT id FROM users WHERE employee_id = $1`, [req.body.employee_id]);
            if (existingEmp.rows.length > 0) {
                res.status(409).json({ error: 'CONFLICT', message: 'Employee ID already registered' });
                return;
            }

            const passwordHash = await bcrypt.hash(req.body.password, 12);
            const userId = uuidv4();

            await pgTransaction(async (client) => {
                await client.query(
                    `INSERT INTO users (id, employee_id, email, phone, password_hash, full_name, role, department, designation, badge_number, status, created_by, created_at, updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING_VERIFICATION',$11,NOW(),NOW())
                     RETURNING id, employee_id, email, full_name, role, department, designation, badge_number, status, created_at`,
                    [userId, req.body.employee_id, req.body.email.toLowerCase(), req.body.phone, passwordHash, req.body.full_name, req.body.role, req.body.department, req.body.designation, req.body.badge_number, req.auth!.sub]
                );
            });

            await logAuditEvent({
                event_type: 'USER_CREATED',
                event_category: 'USER_MANAGEMENT',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'create_user',
                outcome: 'SUCCESS',
                resource_type: 'USER',
                resource_id: userId,
                request_id: req.headers['x-request-id'] as string,
            });

            const created = await pgQuery(
                `SELECT id, employee_id, email, full_name, role, department, designation, badge_number, status, created_at FROM users WHERE id = $1`,
                [userId]
            );

            res.status(201).json(created.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// Update user
router.patch('/users/:userId',
    validate(userIdParamSchema),
    validate(updateUserSchema),
    async (req, res, next) => {
        try {
            const { userId } = req.params;
            const updates = req.body;

            const fields: string[] = [];
            const values: any[] = [];
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

            const result = await pgQuery(
                `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING id, employee_id, email, full_name, role, department, designation, badge_number, status, updated_at`,
                values
            );

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
                return;
            }

            await logAuditEvent({
                event_type: 'USER_UPDATED',
                event_category: 'USER_MANAGEMENT',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'update_user',
                outcome: 'SUCCESS',
                resource_type: 'USER',
                resource_id: userId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// Update user role
router.patch('/users/:userId/role',
    validate(userIdParamSchema),
    validate(updateUserRoleSchema),
    async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { role } = req.body;

            const result = await pgQuery(
                `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING id, employee_id, email, full_name, role, department, status`,
                [role, userId]
            );

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
                return;
            }

            await logAuditEvent({
                event_type: 'USER_ROLE_CHANGED',
                event_category: 'USER_MANAGEMENT',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'change_user_role',
                outcome: 'SUCCESS',
                resource_type: 'USER',
                resource_id: userId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { new_role: role },
            });

            res.json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// Reset user password (admin)
router.post('/users/:userId/reset-password',
    validate(userIdParamSchema),
    validate(resetUserPasswordSchema),
    async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { new_password } = req.body;

            const passwordHash = await bcrypt.hash(new_password, 12);

            await pgQuery(
                `UPDATE users SET password_hash = $1, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $2`,
                [passwordHash, userId]
            );

            // Revoke all sessions
            // In production, call session service

            await logAuditEvent({
                event_type: 'ADMIN_PASSWORD_RESET',
                event_category: 'USER_MANAGEMENT',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'admin_reset_password',
                outcome: 'SUCCESS',
                resource_type: 'USER',
                resource_id: userId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json({ message: 'Password reset successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// Delete user (soft delete)
router.delete('/users/:userId',
    validate(userIdParamSchema),
    async (req, res, next) => {
        try {
            const { userId } = req.params;

            if (userId === req.auth!.sub) {
                res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot delete yourself' });
                return;
            }

            await pgQuery(`UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [userId]);

            await logAuditEvent({
                event_type: 'USER_DELETED',
                event_category: 'USER_MANAGEMENT',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'delete_user',
                outcome: 'SUCCESS',
                resource_type: 'USER',
                resource_id: userId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// SYSTEM CONFIGURATION
// ============================================================================

// List config
router.get('/config',
    async (req, res, next) => {
        try {
            const result = await pgQuery(
                `SELECT config_key, config_value, description, is_sensitive, updated_at FROM system_config ORDER BY config_key`
            );

            // Mask sensitive values
            const configs = result.rows.map(row => ({
                ...row,
                config_value: row.is_sensitive ? '[REDACTED]' : row.config_value,
            }));

            res.json(configs);
        } catch (error) {
            next(error);
        }
    }
);

// Get config by key
router.get('/config/:configKey',
    validate(configKeyParamSchema),
    async (req, res, next) => {
        try {
            const result = await pgQuery(
                `SELECT config_key, config_value, description, is_sensitive, updated_at FROM system_config WHERE config_key = $1`,
                [req.params.configKey]
            );

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Config not found' });
                return;
            }

            const config = result.rows[0];
            if (config.is_sensitive) {
                config.config_value = '[REDACTED]';
            }

            res.json(config);
        } catch (error) {
            next(error);
        }
    }
);

// Set config
router.post('/config',
    validate(configSchema),
    async (req, res, next) => {
        try {
            const { config_key, config_value, description, is_sensitive } = req.body;

            await pgQuery(
                `INSERT INTO system_config (config_key, config_value, description, is_sensitive, updated_by, updated_at)
                 VALUES ($1,$2,$3,$4,$5,NOW())
                 ON CONFLICT (config_key) DO UPDATE SET
                    config_value = EXCLUDED.config_value,
                    description = EXCLUDED.description,
                    is_sensitive = EXCLUDED.is_sensitive,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = NOW()`,
                [config_key, JSON.stringify(config_value), description, is_sensitive, req.auth!.sub]
            );

            await logAuditEvent({
                event_type: 'CONFIG_UPDATED',
                event_category: 'SYSTEM_CONFIG',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'set_config',
                outcome: 'SUCCESS',
                resource_type: 'CONFIG',
                resource_id: config_key,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json({ message: 'Config updated successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// BLOCKCHAIN NODE MANAGEMENT
// ============================================================================

router.get('/blockchain/nodes',
    async (req, res, next) => {
        try {
            const result = await pgQuery(`SELECT * FROM blockchain_nodes ORDER BY node_type, created_at`);
            res.json(result.rows);
        } catch (error) {
            next(error);
        }
    }
);

router.post('/blockchain/nodes',
    validate(z.object({
        body: z.object({
            node_id: z.string().min(1).max(100),
            node_type: z.enum(['OFFICER_NODE', 'FORENSIC_LAB_NODE', 'COURT_NODE', 'CENTRAL_AUDIT_NODE']),
            organization_name: z.string().min(1).max(200),
            organization_msp_id: z.string().min(1).max(100),
            peer_endpoint: z.string().min(1).max(500),
            ca_endpoint: z.string().max(500).optional(),
            tls_cert_pem: z.string().min(1),
            is_orderer: z.boolean().default(false),
            orderer_endpoint: z.string().max(500).optional(),
        }),
    })),
    async (req, res, next) => {
        try {
            const nodeId = uuidv4();
            await pgQuery(
                `INSERT INTO blockchain_nodes (id, node_id, node_type, organization_name, organization_msp_id, peer_endpoint, ca_endpoint, tls_cert_pem, is_orderer, orderer_endpoint, created_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
                [nodeId, req.body.node_id, req.body.node_type, req.body.organization_name, req.body.organization_msp_id, req.body.peer_endpoint, req.body.ca_endpoint, req.body.tls_cert_pem, req.body.is_orderer, req.body.orderer_endpoint]
            );

            await logAuditEvent({
                event_type: 'BLOCKCHAIN_NODE_ADDED',
                event_category: 'BLOCKCHAIN',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'add_blockchain_node',
                outcome: 'SUCCESS',
                resource_type: 'BLOCKCHAIN_NODE',
                resource_id: nodeId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.status(201).json({ id: nodeId, message: 'Blockchain node added' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// SYSTEM HEALTH & STATS
// ============================================================================

router.get('/stats',
    async (req, res, next) => {
        try {
            const [
                userStats,
                caseStats,
                docStats,
                eviStats,
                blockStats,
            ] = await Promise.all([
                pgQuery(`SELECT role, status, COUNT(*) as count FROM users WHERE deleted_at IS NULL GROUP BY role, status`),
                pgQuery(`SELECT status, COUNT(*) as count FROM cases WHERE deleted_at IS NULL GROUP BY status`),
                pgQuery(`SELECT document_type, status, COUNT(*) as count FROM documents WHERE deleted_at IS NULL GROUP BY document_type, status`),
                pgQuery(`SELECT evidence_type, status, COUNT(*) as count FROM evidence WHERE deleted_at IS NULL GROUP BY evidence_type, status`),
                pgQuery(`SELECT COUNT(*) as total_blocks, MAX(block_number) as latest_block FROM blockchain_blocks`),
            ]);

            res.json({
                users: userStats.rows,
                cases: caseStats.rows,
                documents: docStats.rows,
                evidence: eviStats.rows,
                blockchain: blockStats.rows[0],
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;