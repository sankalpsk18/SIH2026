/**
 * ADALAT360 - Cases Routes
 * REST API for case management
 */

import { Router } from 'express';
import { z } from 'zod';
import { pgQuery, pgTransaction } from '@config/database.js';
import { getBlockchainService } from '@blockchain/blockchain.service.js';
import { authenticate, requireRole, requireCaseAccess, requireCasePermission, userRateLimit } from '@middleware/auth/auth.middleware.js';
import { validate } from '@middleware/validate.middleware.js';
import { logAuditEvent } from '@services/audit.service.js';
import { CaseStatus, CasePriority, UserRole, PermissionLevel, CustodyAction } from '@types/database.js';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createCaseSchema = z.object({
    body: z.object({
        case_number: z.string().min(1).max(100),
        fir_number: z.string().max(100).optional(),
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        priority: z.nativeEnum(CasePriority).default(CasePriority.MEDIUM),
        police_station: z.string().max(200).optional(),
        district: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        jurisdiction_court: z.string().max(200).optional(),
        ipc_sections: z.array(z.string()).optional(),
        bns_sections: z.array(z.string()).optional(),
        special_acts: z.array(z.string()).optional(),
        incident_date: z.coerce.date().optional(),
        fir_registered_at: z.coerce.date().optional(),
        is_sensitive: z.boolean().default(false),
        sensitivity_level: z.number().int().min(1).max(5).default(1),
        metadata: z.record(z.any()).optional(),
    }),
});

const updateCaseSchema = z.object({
    body: z.object({
        title: z.string().max(500).optional(),
        description: z.string().optional(),
        status: z.nativeEnum(CaseStatus).optional(),
        priority: z.nativeEnum(CasePriority).optional(),
        police_station: z.string().max(200).optional(),
        district: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        jurisdiction_court: z.string().max(200).optional(),
        ipc_sections: z.array(z.string()).optional(),
        bns_sections: z.array(z.string()).optional(),
        special_acts: z.array(z.string()).optional(),
        charge_sheet_filed_at: z.coerce.date().optional(),
        trial_started_at: z.coerce.date().optional(),
        judgment_date: z.coerce.date().optional(),
        disposal_date: z.coerce.date().optional(),
        is_sensitive: z.boolean().optional(),
        sensitivity_level: z.number().int().min(1).max(5).optional(),
        metadata: z.record(z.any()).optional(),
    }),
});

const assignUserSchema = z.object({
    body: z.object({
        user_id: z.string().uuid(),
        role_in_case: z.string().min(1).max(100),
        permission_level: z.array(z.nativeEnum(PermissionLevel)).default([PermissionLevel.READ]),
    }),
});

const caseIdParamSchema = z.object({
    params: z.object({
        caseId: z.string().uuid(),
    }),
});

const paginationQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        status: z.nativeEnum(CaseStatus).optional(),
        priority: z.nativeEnum(CasePriority).optional(),
        assigned_officer_id: z.string().uuid().optional(),
        search: z.string().optional(),
    }),
});

// ============================================================================
// LIST CASES
// ============================================================================

router.get('/',
    userRateLimit(100, 60000, 'cases_list'),
    validate(paginationQuerySchema),
    async (req, res, next) => {
        try {
            // Explicitly convert to numbers as safety measure
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;
            const { status, priority, assigned_officer_id, search } = req.query as any;
            const offset = (page - 1) * limit;

            const conditions: string[] = ['c.deleted_at IS NULL'];
            const params: any[] = [];
            let paramIndex = 1;

            // Case access filter
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                conditions.push(`(
                    c.assigned_officer_id = $${paramIndex} OR
                    c.supervising_officer_id = $${paramIndex} OR
                    c.prosecutor_id = $${paramIndex} OR
                    c.forensic_lab_id = $${paramIndex} OR
                    c.court_id = $${paramIndex} OR
                    EXISTS (SELECT 1 FROM case_assignments ca WHERE ca.case_id = c.id AND ca.user_id = $${paramIndex} AND ca.is_active = TRUE)
                )`);
                params.push(req.auth!.sub);
                paramIndex++;
            }

            if (status) {
                conditions.push(`c.status = $${paramIndex++}`);
                params.push(status);
            }
            if (priority) {
                conditions.push(`c.priority = $${paramIndex++}`);
                params.push(priority);
            }
            if (assigned_officer_id) {
                conditions.push(`c.assigned_officer_id = $${paramIndex++}`);
                params.push(assigned_officer_id);
            }
            if (search) {
                conditions.push(`(
                    c.case_number ILIKE $${paramIndex} OR
                    c.fir_number ILIKE $${paramIndex} OR
                    c.title ILIKE $${paramIndex}
                )`);
                params.push(`%${search}%`);
                paramIndex++;
            }

            const whereClause = conditions.join(' AND ');
            params.push(limit, offset);

            const [casesResult, countResult] = await Promise.all([
                pgQuery(
                    `SELECT c.*, u1.full_name as assigned_officer_name, u2.full_name as prosecutor_name, u3.full_name as forensic_lab_name, u4.full_name as court_name
                     FROM cases c
                     LEFT JOIN users u1 ON u1.id = c.assigned_officer_id
                     LEFT JOIN users u2 ON u2.id = c.prosecutor_id
                     LEFT JOIN users u3 ON u3.id = c.forensic_lab_id
                     LEFT JOIN users u4 ON u4.id = c.court_id
                     WHERE ${whereClause}
                     ORDER BY c.created_at DESC
                     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
                    params
                ),
                pgQuery(
                    `SELECT COUNT(*) as total FROM cases c WHERE ${whereClause}`,
                    params.slice(0, -2)
                ),
            ]);

            res.json({
                cases: casesResult.rows,
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

// ============================================================================
// GET CASE BY ID
// ============================================================================

router.get('/:caseId',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    async (req, res, next) => {
        try {
            const result = await pgQuery(
                `SELECT c.*, u1.full_name as assigned_officer_name, u2.full_name as prosecutor_name, u3.full_name as forensic_lab_name, u4.full_name as court_name
                 FROM cases c
                 LEFT JOIN users u1 ON u1.id = c.assigned_officer_id
                 LEFT JOIN users u2 ON u2.id = c.prosecutor_id
                 LEFT JOIN users u3 ON u3.id = c.forensic_lab_id
                 LEFT JOIN users u4 ON u4.id = c.court_id
                 WHERE c.id = $1 AND c.deleted_at IS NULL`,
                [req.params.caseId]
            );

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Case not found' });
                return;
            }

            res.json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// CREATE CASE
// ============================================================================

router.post('/',
    requireRole(UserRole.INVESTIGATING_OFFICER, UserRole.CENTRAL_ADMIN),
    validate(createCaseSchema),
    async (req, res, next) => {
        try {
            const caseId = uuidv4();
            const now = new Date();

            await pgTransaction(async (client) => {
                await client.query(
                    `INSERT INTO cases (
                        id, case_number, fir_number, title, description, status, priority,
                        police_station, district, state, jurisdiction_court,
                        ipc_sections, bns_sections, special_acts,
                        assigned_officer_id, supervising_officer_id,
                        incident_date, fir_registered_at,
                        is_sensitive, sensitivity_level, metadata,
                        created_by, created_at, updated_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW())`,
                    [
                        caseId,
                        req.body.case_number,
                        req.body.fir_number || null,
                        req.body.title,
                        req.body.description || null,
                        CaseStatus.OPEN,
                        req.body.priority,
                        req.body.police_station || null,
                        req.body.district || null,
                        req.body.state || null,
                        req.body.jurisdiction_court || null,
                        req.body.ipc_sections || [],
                        req.body.bns_sections || [],
                        req.body.special_acts || [],
                        req.auth!.sub,
                        req.auth!.sub,
                        req.body.incident_date || null,
                        req.body.fir_registered_at || null,
                        req.body.is_sensitive,
                        req.body.sensitivity_level,
                        JSON.stringify(req.body.metadata || {}),
                        req.auth!.sub,
                    ]
                );

                // Auto-assign creator
                await client.query(
                    `INSERT INTO case_assignments (id, case_id, user_id, role_in_case, permission_level, assigned_by, assigned_at, is_active)
                     VALUES ($1,$2,$3,$4,$5,$6,NOW(),TRUE)`,
                    [uuidv4(), caseId, req.auth!.sub, 'INVESTIGATING_OFFICER', [PermissionLevel.READ, PermissionLevel.WRITE, PermissionLevel.SIGN, PermissionLevel.EXPORT], req.auth!.sub]
                );
            });

            // Record blockchain event
            const blockchainService = getBlockchainService();
            await blockchainService.recordCustodyEvent({
                txType: CustodyAction.UPLOAD,
                caseId,
                actorUserId: req.auth!.sub,
                actorNodeId: req.auth!.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
                actionDetails: {
                    action: 'CASE_CREATED',
                    case_number: req.body.case_number,
                    title: req.body.title,
                },
            });

            // Audit log
            await logAuditEvent({
                event_type: 'CASE_CREATED',
                event_category: 'CASE_MANAGEMENT',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'create_case',
                outcome: 'SUCCESS',
                resource_type: 'CASE',
                resource_id: caseId,
                request_id: req.headers['x-request-id'] as string,
            });

            const created = await pgQuery(
                `SELECT * FROM cases WHERE id = $1`,
                [caseId]
            );

            res.status(201).json(created.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// UPDATE CASE
// ============================================================================

router.patch('/:caseId',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    requireCasePermission('caseId', PermissionLevel.WRITE, PermissionLevel.ADMIN),
    validate(updateCaseSchema),
    async (req, res, next) => {
        try {
            const { caseId } = req.params;
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
            values.push(caseId);

            const result = await pgQuery(
                `UPDATE cases SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
                values
            );

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Case not found' });
                return;
            }

            // Audit log
            await logAuditEvent({
                event_type: 'CASE_UPDATED',
                event_category: 'CASE_MANAGEMENT',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'update_case',
                outcome: 'SUCCESS',
                resource_type: 'CASE',
                resource_id: caseId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// DELETE CASE (soft delete)
// ============================================================================

router.delete('/:caseId',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    requireCasePermission('caseId', PermissionLevel.DELETE, PermissionLevel.ADMIN),
    async (req, res, next) => {
        try {
            const { caseId } = req.params;

            await pgQuery(
                `UPDATE cases SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
                [caseId]
            );

            // Record blockchain event
            const blockchainService = getBlockchainService();
            await blockchainService.recordCustodyEvent({
                txType: CustodyAction.DISPOSAL,
                caseId,
                actorUserId: req.auth!.sub,
                actorNodeId: req.auth!.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
                actionDetails: { action: 'CASE_SOFT_DELETED' },
            });

            // Audit log
            await logAuditEvent({
                event_type: 'CASE_DELETED',
                event_category: 'CASE_MANAGEMENT',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'delete_case',
                outcome: 'SUCCESS',
                resource_type: 'CASE',
                resource_id: caseId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json({ message: 'Case deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// CASE ASSIGNMENTS
// ============================================================================

// List assignments
router.get('/:caseId/assignments',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    async (req, res, next) => {
        try {
            const result = await pgQuery(
                `SELECT ca.*, u.email, u.full_name, u.role, u.department, u.designation, u.badge_number
                 FROM case_assignments ca
                 JOIN users u ON u.id = ca.user_id
                 WHERE ca.case_id = $1 AND ca.is_active = TRUE
                 ORDER BY ca.assigned_at DESC`,
                [req.params.caseId]
            );
            res.json(result.rows);
        } catch (error) {
            next(error);
        }
    }
);

// Assign user to case
router.post('/:caseId/assignments',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    requireCasePermission('caseId', PermissionLevel.ADMIN),
    validate(assignUserSchema),
    async (req, res, next) => {
        try {
            const { caseId } = req.params;
            const { user_id, role_in_case, permission_level } = req.body;

            // Verify user exists
            const userResult = await pgQuery(
                `SELECT id, role, department FROM users WHERE id = $1 AND deleted_at IS NULL`,
                [user_id]
            );

            if (userResult.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
                return;
            }

            await pgTransaction(async (client) => {
                await client.query(
                    `INSERT INTO case_assignments (id, case_id, user_id, role_in_case, permission_level, assigned_by, assigned_at, is_active)
                     VALUES ($1,$2,$3,$4,$5,$6,NOW(),TRUE)
                     ON CONFLICT (case_id, user_id, role_in_case) DO UPDATE SET
                        permission_level = EXCLUDED.permission_level,
                        is_active = TRUE,
                        revoked_at = NULL,
                        revoked_by = NULL`,
                    [uuidv4(), caseId, user_id, role_in_case, permission_level, req.auth!.sub]
                );
            });

            // Record blockchain event
            const blockchainService = getBlockchainService();
            await blockchainService.recordCustodyEvent({
                txType: CustodyAction.TRANSFER,
                caseId,
                actorUserId: req.auth!.sub,
                actorNodeId: req.auth!.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
                actionDetails: {
                    action: 'CASE_ASSIGNMENT',
                    assigned_user_id: user_id,
                    role_in_case,
                    permission_level,
                },
            });

            res.status(201).json({ message: 'User assigned to case' });
        } catch (error) {
            next(error);
        }
    }
);

// Revoke assignment
router.delete('/:caseId/assignments/:userId/:role',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    requireCasePermission('caseId', PermissionLevel.ADMIN),
    async (req, res, next) => {
        try {
            const { caseId, userId, role } = req.params;

            await pgQuery(
                `UPDATE case_assignments SET
                    is_active = FALSE,
                    revoked_at = NOW(),
                    revoked_by = $1
                 WHERE case_id = $2 AND user_id = $3 AND role_in_case = $4`,
                [req.auth!.sub, caseId, userId, role]
            );

            res.json({ message: 'Assignment revoked' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// CASE STATISTICS
// ============================================================================

router.get('/:caseId/stats',
    validate(caseIdParamSchema),
    requireCaseAccess('caseId'),
    async (req, res, next) => {
        try {
            const { caseId } = req.params;

            const [
                docCount,
                eviCount,
                custodyCount,
                assignmentCount,
            ] = await Promise.all([
                pgQuery(`SELECT COUNT(*) as count FROM documents WHERE case_id = $1 AND deleted_at IS NULL`, [caseId]),
                pgQuery(`SELECT COUNT(*) as count FROM evidence WHERE case_id = $1 AND deleted_at IS NULL`, [caseId]),
                pgQuery(`SELECT COUNT(*) as count FROM custody_ledger WHERE case_id = $1 AND is_valid = TRUE`, [caseId]),
                pgQuery(`SELECT COUNT(*) as count FROM case_assignments WHERE case_id = $1 AND is_active = TRUE`, [caseId]),
            ]);

            res.json({
                documentCount: parseInt(docCount.rows[0].count, 10),
                evidenceCount: parseInt(eviCount.rows[0].count, 10),
                custodyEventsCount: parseInt(custodyCount.rows[0].count, 10),
                assignmentsCount: parseInt(assignmentCount.rows[0].count, 10),
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;