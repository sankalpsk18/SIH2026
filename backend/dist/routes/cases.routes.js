"use strict";
/**
 * ADALAT360 - Cases Routes
 * REST API for case management
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_js_1 = require("../config/database.js");
const blockchain_service_js_1 = require("../blockchain/blockchain.service.js");
const auth_middleware_js_1 = require("../middleware/auth/auth.middleware.js");
const validate_middleware_js_1 = require("../middleware/validate.middleware.js");
const audit_service_js_1 = require("../services/audit.service.js");
const database_js_2 = require("../types/database.js");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_js_1.authenticate);
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
const createCaseSchema = zod_1.z.object({
    body: zod_1.z.object({
        case_number: zod_1.z.string().min(1).max(100),
        fir_number: zod_1.z.string().max(100).optional(),
        title: zod_1.z.string().min(1).max(500),
        description: zod_1.z.string().optional(),
        priority: zod_1.z.nativeEnum(database_js_2.CasePriority).default(database_js_2.CasePriority.MEDIUM),
        police_station: zod_1.z.string().max(200).optional(),
        district: zod_1.z.string().max(100).optional(),
        state: zod_1.z.string().max(100).optional(),
        jurisdiction_court: zod_1.z.string().max(200).optional(),
        ipc_sections: zod_1.z.array(zod_1.z.string()).optional(),
        bns_sections: zod_1.z.array(zod_1.z.string()).optional(),
        special_acts: zod_1.z.array(zod_1.z.string()).optional(),
        incident_date: zod_1.z.coerce.date().optional(),
        fir_registered_at: zod_1.z.coerce.date().optional(),
        is_sensitive: zod_1.z.boolean().default(false),
        sensitivity_level: zod_1.z.number().int().min(1).max(5).default(1),
        metadata: zod_1.z.record(zod_1.z.any()).optional(),
    }),
});
const updateCaseSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().max(500).optional(),
        description: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(database_js_2.CaseStatus).optional(),
        priority: zod_1.z.nativeEnum(database_js_2.CasePriority).optional(),
        police_station: zod_1.z.string().max(200).optional(),
        district: zod_1.z.string().max(100).optional(),
        state: zod_1.z.string().max(100).optional(),
        jurisdiction_court: zod_1.z.string().max(200).optional(),
        ipc_sections: zod_1.z.array(zod_1.z.string()).optional(),
        bns_sections: zod_1.z.array(zod_1.z.string()).optional(),
        special_acts: zod_1.z.array(zod_1.z.string()).optional(),
        charge_sheet_filed_at: zod_1.z.coerce.date().optional(),
        trial_started_at: zod_1.z.coerce.date().optional(),
        judgment_date: zod_1.z.coerce.date().optional(),
        disposal_date: zod_1.z.coerce.date().optional(),
        is_sensitive: zod_1.z.boolean().optional(),
        sensitivity_level: zod_1.z.number().int().min(1).max(5).optional(),
        metadata: zod_1.z.record(zod_1.z.any()).optional(),
    }),
});
const assignUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        user_id: zod_1.z.string().uuid(),
        role_in_case: zod_1.z.string().min(1).max(100),
        permission_level: zod_1.z.array(zod_1.z.nativeEnum(database_js_2.PermissionLevel)).default([database_js_2.PermissionLevel.READ]),
    }),
});
const caseIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
    }),
});
const paginationQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
        status: zod_1.z.nativeEnum(database_js_2.CaseStatus).optional(),
        priority: zod_1.z.nativeEnum(database_js_2.CasePriority).optional(),
        assigned_officer_id: zod_1.z.string().uuid().optional(),
        search: zod_1.z.string().optional(),
    }),
});
// ============================================================================
// LIST CASES
// ============================================================================
router.get('/', (0, auth_middleware_js_1.userRateLimit)(100, 60000, 'cases_list'), (0, validate_middleware_js_1.validate)(paginationQuerySchema), async (req, res, next) => {
    try {
        const { page, limit, status, priority, assigned_officer_id, search } = req.query;
        const offset = (page - 1) * limit;
        const conditions = ['c.deleted_at IS NULL'];
        const params = [];
        let paramIndex = 1;
        // Case access filter
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            conditions.push(`(
                    c.assigned_officer_id = $${paramIndex} OR
                    c.supervising_officer_id = $${paramIndex} OR
                    c.prosecutor_id = $${paramIndex} OR
                    c.forensic_lab_id = $${paramIndex} OR
                    c.court_id = $${paramIndex} OR
                    EXISTS (SELECT 1 FROM case_assignments ca WHERE ca.case_id = c.id AND ca.user_id = $${paramIndex} AND ca.is_active = TRUE)
                )`);
            params.push(req.auth.sub);
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
            (0, database_js_1.pgQuery)(`SELECT c.*, u1.full_name as assigned_officer_name, u2.full_name as prosecutor_name, u3.full_name as forensic_lab_name, u4.full_name as court_name
                     FROM cases c
                     LEFT JOIN users u1 ON u1.id = c.assigned_officer_id
                     LEFT JOIN users u2 ON u2.id = c.prosecutor_id
                     LEFT JOIN users u3 ON u3.id = c.forensic_lab_id
                     LEFT JOIN users u4 ON u4.id = c.court_id
                     WHERE ${whereClause}
                     ORDER BY c.created_at DESC
                     LIMIT $${paramIndex++} OFFSET $${paramIndex}`, params),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as total FROM cases c WHERE ${whereClause}`, params.slice(0, -2)),
        ]);
        res.json({
            cases: casesResult.rows,
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
// ============================================================================
// GET CASE BY ID
// ============================================================================
router.get('/:caseId', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), async (req, res, next) => {
    try {
        const result = await (0, database_js_1.pgQuery)(`SELECT c.*, u1.full_name as assigned_officer_name, u2.full_name as prosecutor_name, u3.full_name as forensic_lab_name, u4.full_name as court_name
                 FROM cases c
                 LEFT JOIN users u1 ON u1.id = c.assigned_officer_id
                 LEFT JOIN users u2 ON u2.id = c.prosecutor_id
                 LEFT JOIN users u3 ON u3.id = c.forensic_lab_id
                 LEFT JOIN users u4 ON u4.id = c.court_id
                 WHERE c.id = $1 AND c.deleted_at IS NULL`, [req.params.caseId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Case not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CREATE CASE
// ============================================================================
router.post('/', (0, auth_middleware_js_1.requireRole)(database_js_2.UserRole.INVESTIGATING_OFFICER, database_js_2.UserRole.CENTRAL_ADMIN), (0, validate_middleware_js_1.validate)(createCaseSchema), async (req, res, next) => {
    try {
        const caseId = (0, uuid_1.v4)();
        const now = new Date();
        await (0, database_js_1.pgTransaction)(async (client) => {
            await client.query(`INSERT INTO cases (
                        id, case_number, fir_number, title, description, status, priority,
                        police_station, district, state, jurisdiction_court,
                        ipc_sections, bns_sections, special_acts,
                        assigned_officer_id, supervising_officer_id,
                        incident_date, fir_registered_at,
                        is_sensitive, sensitivity_level, metadata,
                        created_by, created_at, updated_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW())`, [
                caseId,
                req.body.case_number,
                req.body.fir_number || null,
                req.body.title,
                req.body.description || null,
                database_js_2.CaseStatus.OPEN,
                req.body.priority,
                req.body.police_station || null,
                req.body.district || null,
                req.body.state || null,
                req.body.jurisdiction_court || null,
                req.body.ipc_sections || [],
                req.body.bns_sections || [],
                req.body.special_acts || [],
                req.auth.sub,
                req.auth.sub,
                req.body.incident_date || null,
                req.body.fir_registered_at || null,
                req.body.is_sensitive,
                req.body.sensitivity_level,
                JSON.stringify(req.body.metadata || {}),
                req.auth.sub,
            ]);
            // Auto-assign creator
            await client.query(`INSERT INTO case_assignments (id, case_id, user_id, role_in_case, permission_level, assigned_by, assigned_at, is_active)
                     VALUES ($1,$2,$3,$4,$5,$6,NOW(),TRUE)`, [(0, uuid_1.v4)(), caseId, req.auth.sub, 'INVESTIGATING_OFFICER', [database_js_2.PermissionLevel.READ, database_js_2.PermissionLevel.WRITE, database_js_2.PermissionLevel.SIGN, database_js_2.PermissionLevel.EXPORT], req.auth.sub]);
        });
        // Record blockchain event
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: database_js_2.CustodyAction.UPLOAD,
            caseId,
            actorUserId: req.auth.sub,
            actorNodeId: req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
            actionDetails: {
                action: 'CASE_CREATED',
                case_number: req.body.case_number,
                title: req.body.title,
            },
        });
        // Audit log
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'CASE_CREATED',
            event_category: 'CASE_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'create_case',
            outcome: 'SUCCESS',
            resource_type: 'CASE',
            resource_id: caseId,
            request_id: req.headers['x-request-id'],
        });
        const created = await (0, database_js_1.pgQuery)(`SELECT * FROM cases WHERE id = $1`, [caseId]);
        res.status(201).json(created.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// UPDATE CASE
// ============================================================================
router.patch('/:caseId', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, auth_middleware_js_1.requireCasePermission)('caseId', database_js_2.PermissionLevel.WRITE, database_js_2.PermissionLevel.ADMIN), (0, validate_middleware_js_1.validate)(updateCaseSchema), async (req, res, next) => {
    try {
        const { caseId } = req.params;
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
        values.push(caseId);
        const result = await (0, database_js_1.pgQuery)(`UPDATE cases SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`, values);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Case not found' });
            return;
        }
        // Audit log
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'CASE_UPDATED',
            event_category: 'CASE_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'update_case',
            outcome: 'SUCCESS',
            resource_type: 'CASE',
            resource_id: caseId,
            request_id: req.headers['x-request-id'],
        });
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// DELETE CASE (soft delete)
// ============================================================================
router.delete('/:caseId', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, auth_middleware_js_1.requireCasePermission)('caseId', database_js_2.PermissionLevel.DELETE, database_js_2.PermissionLevel.ADMIN), async (req, res, next) => {
    try {
        const { caseId } = req.params;
        await (0, database_js_1.pgQuery)(`UPDATE cases SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [caseId]);
        // Record blockchain event
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: database_js_2.CustodyAction.DISPOSAL,
            caseId,
            actorUserId: req.auth.sub,
            actorNodeId: req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
            actionDetails: { action: 'CASE_SOFT_DELETED' },
        });
        // Audit log
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'CASE_DELETED',
            event_category: 'CASE_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'delete_case',
            outcome: 'SUCCESS',
            resource_type: 'CASE',
            resource_id: caseId,
            request_id: req.headers['x-request-id'],
        });
        res.json({ message: 'Case deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CASE ASSIGNMENTS
// ============================================================================
// List assignments
router.get('/:caseId/assignments', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), async (req, res, next) => {
    try {
        const result = await (0, database_js_1.pgQuery)(`SELECT ca.*, u.email, u.full_name, u.role, u.department, u.designation, u.badge_number
                 FROM case_assignments ca
                 JOIN users u ON u.id = ca.user_id
                 WHERE ca.case_id = $1 AND ca.is_active = TRUE
                 ORDER BY ca.assigned_at DESC`, [req.params.caseId]);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
});
// Assign user to case
router.post('/:caseId/assignments', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, auth_middleware_js_1.requireCasePermission)('caseId', database_js_2.PermissionLevel.ADMIN), (0, validate_middleware_js_1.validate)(assignUserSchema), async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { user_id, role_in_case, permission_level } = req.body;
        // Verify user exists
        const userResult = await (0, database_js_1.pgQuery)(`SELECT id, role, department FROM users WHERE id = $1 AND deleted_at IS NULL`, [user_id]);
        if (userResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
            return;
        }
        await (0, database_js_1.pgTransaction)(async (client) => {
            await client.query(`INSERT INTO case_assignments (id, case_id, user_id, role_in_case, permission_level, assigned_by, assigned_at, is_active)
                     VALUES ($1,$2,$3,$4,$5,$6,NOW(),TRUE)
                     ON CONFLICT (case_id, user_id, role_in_case) DO UPDATE SET
                        permission_level = EXCLUDED.permission_level,
                        is_active = TRUE,
                        revoked_at = NULL,
                        revoked_by = NULL`, [(0, uuid_1.v4)(), caseId, user_id, role_in_case, permission_level, req.auth.sub]);
        });
        // Record blockchain event
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: database_js_2.CustodyAction.TRANSFER,
            caseId,
            actorUserId: req.auth.sub,
            actorNodeId: req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
            actionDetails: {
                action: 'CASE_ASSIGNMENT',
                assigned_user_id: user_id,
                role_in_case,
                permission_level,
            },
        });
        res.status(201).json({ message: 'User assigned to case' });
    }
    catch (error) {
        next(error);
    }
});
// Revoke assignment
router.delete('/:caseId/assignments/:userId/:role', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, auth_middleware_js_1.requireCasePermission)('caseId', database_js_2.PermissionLevel.ADMIN), async (req, res, next) => {
    try {
        const { caseId, userId, role } = req.params;
        await (0, database_js_1.pgQuery)(`UPDATE case_assignments SET
                    is_active = FALSE,
                    revoked_at = NOW(),
                    revoked_by = $1
                 WHERE case_id = $2 AND user_id = $3 AND role_in_case = $4`, [req.auth.sub, caseId, userId, role]);
        res.json({ message: 'Assignment revoked' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CASE STATISTICS
// ============================================================================
router.get('/:caseId/stats', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const [docCount, eviCount, custodyCount, assignmentCount,] = await Promise.all([
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as count FROM documents WHERE case_id = $1 AND deleted_at IS NULL`, [caseId]),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as count FROM evidence WHERE case_id = $1 AND deleted_at IS NULL`, [caseId]),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as count FROM custody_ledger WHERE case_id = $1 AND is_valid = TRUE`, [caseId]),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as count FROM case_assignments WHERE case_id = $1 AND is_active = TRUE`, [caseId]),
        ]);
        res.json({
            documentCount: parseInt(docCount.rows[0].count, 10),
            evidenceCount: parseInt(eviCount.rows[0].count, 10),
            custodyEventsCount: parseInt(custodyCount.rows[0].count, 10),
            assignmentsCount: parseInt(assignmentCount.rows[0].count, 10),
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=cases.routes.js.map