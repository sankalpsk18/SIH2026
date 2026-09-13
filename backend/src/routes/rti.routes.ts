/**
 * ADALAT360 - RTI Routes
 * REST API for Right to Information request management
 */

import { Router } from 'express';
import { z } from 'zod';
import { pgQuery, pgTransaction } from '../config/database.js';
import { authenticate, requireRole, requireCaseAccess, userRateLimit } from '../middleware/auth/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { logAuditEvent } from '../services/audit.service.js';
import { UserRole } from '../types/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const rtiIdParamSchema = z.object({
    params: z.object({
        rtiId: z.string().uuid(),
    }),
});

const createRtiSchema = z.object({
    body: z.object({
        applicant_name: z.string().min(1).max(255),
        applicant_address: z.string().optional(),
        applicant_email: z.string().email().optional(),
        applicant_phone: z.string().max(20).optional(),
        subject: z.string().min(1).max(500),
        description: z.string().optional(),
        information_sought: z.string().min(1),
        case_ids: z.array(z.string().uuid()).optional(),
        document_ids: z.array(z.string().uuid()).optional(),
        evidence_ids: z.array(z.string().uuid()).optional(),
    }),
});

const updateRtiSchema = z.object({
    body: z.object({
        status: z.enum(['RECEIVED', 'UNDER_PROCESS', 'INFORMATION_GATHERED', 'RESPONDED', 'DENIED', 'APPEALED', 'CLOSED']).optional(),
        assigned_to: z.string().uuid().optional(),
        response_text: z.string().optional(),
        response_documents: z.array(z.string().uuid()).optional(),
        denied_reasons: z.array(z.string()).optional(),
        exemption_sections: z.array(z.string()).optional(),
    }),
});

const respondRtiSchema = z.object({
    body: z.object({
        response_text: z.string().min(1),
        response_documents: z.array(z.string().uuid()).optional(),
    }),
});

const denyRtiSchema = z.object({
    body: z.object({
        denied_reasons: z.array(z.string()).min(1),
        exemption_sections: z.array(z.string()).optional(),
    }),
});

const appealRtiSchema = z.object({
    body: z.object({
        appeal_level: z.enum(['FIRST', 'SECOND']),
        appeal_details: z.record(z.any()).optional(),
    }),
});

const rtiQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        status: z.enum(['RECEIVED', 'UNDER_PROCESS', 'INFORMATION_GATHERED', 'RESPONDED', 'DENIED', 'APPEALED', 'CLOSED']).optional(),
        assigned_to: z.string().uuid().optional(),
        search: z.string().optional(),
    }),
});

const rtiNumberParamSchema = z.object({
    params: z.object({
        requestNumber: z.string().min(1),
    }),
});

// ============================================================================
// CREATE RTI REQUEST (Public can file)
// ============================================================================

router.post('/',
    userRateLimit(10, 3600000, 'rti_create'), // 10 per hour
    validate(createRtiSchema),
    async (req, res, next) => {
        try {
            const rtiId = uuidv4();
            const now = new Date();
            const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

            // Generate request number
            const countResult = await pgQuery(`SELECT COUNT(*) as count FROM rti_requests`);
            const count = parseInt(countResult.rows[0].count, 10) + 1;
            const requestNumber = `RTI/${now.getFullYear()}/${count.toString().padStart(6, '0')}`;

            await pgTransaction(async (client) => {
                await client.query(
                    `INSERT INTO rti_requests (
                        id, request_number, applicant_name, applicant_address, applicant_email, applicant_phone,
                        subject, description, information_sought, case_ids, document_ids, evidence_ids,
                        status, received_at, due_date, created_at, updated_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())`,
                    [
                        rtiId,
                        requestNumber,
                        req.body.applicant_name,
                        req.body.applicant_address || null,
                        req.body.applicant_email || null,
                        req.body.applicant_phone || null,
                        req.body.subject,
                        req.body.description || null,
                        req.body.information_sought,
                        req.body.case_ids || [],
                        req.body.document_ids || [],
                        req.body.evidence_ids || [],
                        'RECEIVED',
                        now,
                        dueDate,
                    ]
                );
            });

            await logAuditEvent({
                event_type: 'RTI_REQUEST_RECEIVED',
                event_category: 'RTI',
                user_ip: req.ip,
                action: 'file_rti',
                outcome: 'SUCCESS',
                resource_type: 'RTI_REQUEST',
                resource_id: rtiId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { request_number: requestNumber },
            });

            const created = await pgQuery(`SELECT * FROM rti_requests WHERE id = $1`, [rtiId]);
            res.status(201).json(created.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// LIST RTI REQUESTS (Admin/Officers)
// ============================================================================

router.get('/',
    requireRole(UserRole.INVESTIGATING_OFFICER, UserRole.FORENSIC_LAB, UserRole.PROSECUTOR, UserRole.COURT, UserRole.CENTRAL_ADMIN, UserRole.AUDITOR),
    validate(rtiQuerySchema),
    async (req, res, next) => {
        try {
            const { page, limit, status, assigned_to, search } = req.query as any;
            const offset = (page - 1) * limit;

            const conditions: string[] = ['1=1'];
            const params: any[] = [];
            let paramIndex = 1;

            // Non-admins see only assigned or relevant RTIs
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                conditions.push(`(assigned_to = $${paramIndex} OR $${paramIndex + 1} = ANY(case_ids))`);
                params.push(req.auth!.sub, req.auth!.sub);
                paramIndex += 2;
            }

            if (status) {
                conditions.push(`status = $${paramIndex++}`);
                params.push(status);
            }
            if (assigned_to) {
                conditions.push(`assigned_to = $${paramIndex++}`);
                params.push(assigned_to);
            }
            if (search) {
                conditions.push(`(
                    request_number ILIKE $${paramIndex} OR
                    applicant_name ILIKE $${paramIndex} OR
                    subject ILIKE $${paramIndex}
                )`);
                params.push(`%${search}%`);
                paramIndex++;
            }

            const whereClause = conditions.join(' AND ');
            params.push(limit, offset);

            const countParams = params.slice(0, -2);
            const rtiResult = await pgQuery(
                `SELECT r.*, u.full_name as assigned_to_name
                 FROM rti_requests r
                 LEFT JOIN users u ON u.id = r.assigned_to
                 WHERE ${whereClause}
                 ORDER BY r.received_at DESC
                 LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
                params
            );
            const countResult = await pgQuery(`SELECT COUNT(*) as total FROM rti_requests WHERE ${whereClause}`, countParams);

            res.json({
                requests: rtiResult.rows,
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
// GET RTI BY ID
// ============================================================================

router.get('/:rtiId',
    validate(rtiIdParamSchema),
    async (req, res, next) => {
        try {
            const result = await pgQuery(
                `SELECT r.*, u.full_name as assigned_to_name, u2.full_name as responded_by_name
                 FROM rti_requests r
                 LEFT JOIN users u ON u.id = r.assigned_to
                 LEFT JOIN users u2 ON u2.id = r.responded_by
                 WHERE r.id = $1`,
                [req.params.rtiId]
            );

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'RTI request not found' });
                return;
            }

            const rti = result.rows[0];

            // Check access
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                const hasAccess = rti.assigned_to === req.auth!.sub ||
                    (rti.case_ids && rti.case_ids.some((c: string) => req.auth!.case_ids.includes(c)));
                if (!hasAccess) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                    return;
                }
            }

            res.json(rti);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// GET RTI BY REQUEST NUMBER (Public lookup)
// ============================================================================

router.get('/number/:requestNumber',
    validate(rtiNumberParamSchema),
    async (req, res, next) => {
        try {
            const result = await pgQuery(
                `SELECT r.request_number, r.subject, r.status, r.received_at, r.due_date, r.responded_at
                 FROM rti_requests r
                 WHERE r.request_number = $1`,
                [req.params.requestNumber]
            );

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'RTI request not found' });
                return;
            }

            res.json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// UPDATE RTI (Admin/Assigned officer)
// ============================================================================

router.patch('/:rtiId',
    validate(rtiIdParamSchema),
    validate(updateRtiSchema),
    async (req, res, next) => {
        try {
            const { rtiId } = req.params;
            const updates = req.body;

            const rtiResult = await pgQuery(`SELECT * FROM rti_requests WHERE id = $1`, [rtiId]);
            if (rtiResult.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'RTI request not found' });
                return;
            }

            const rti = rtiResult.rows[0];

            // Check permission
            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (rti.assigned_to !== req.auth!.sub) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Not assigned to this RTI' });
                    return;
                }
            }

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
            values.push(rtiId);

            const result = await pgQuery(
                `UPDATE rti_requests SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
                values
            );

            await logAuditEvent({
                event_type: 'RTI_UPDATED',
                event_category: 'RTI',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'update_rti',
                outcome: 'SUCCESS',
                resource_type: 'RTI_REQUEST',
                resource_id: rtiId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// RESPOND TO RTI
// ============================================================================

router.post('/:rtiId/respond',
    validate(rtiIdParamSchema),
    validate(respondRtiSchema),
    async (req, res, next) => {
        try {
            const { rtiId } = req.params;
            const { response_text, response_documents } = req.body;

            const rtiResult = await pgQuery(`SELECT * FROM rti_requests WHERE id = $1`, [rtiId]);
            if (rtiResult.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'RTI request not found' });
                return;
            }

            const rti = rtiResult.rows[0];

            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (rti.assigned_to !== req.auth!.sub) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Not assigned to this RTI' });
                    return;
                }
            }

            await pgTransaction(async (client) => {
                await client.query(
                    `UPDATE rti_requests SET
                        status = 'RESPONDED',
                        response_text = $1,
                        response_documents = $2,
                        responded_by = $3,
                        responded_at = NOW(),
                        updated_at = NOW()
                     WHERE id = $4`,
                    [response_text, response_documents || [], req.auth!.sub, rtiId]
                );
            });

            await logAuditEvent({
                event_type: 'RTI_RESPONDED',
                event_category: 'RTI',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'respond_rti',
                outcome: 'SUCCESS',
                resource_type: 'RTI_REQUEST',
                resource_id: rtiId,
                request_id: req.headers['x-request-id'] as string,
            });

            res.json({ message: 'RTI response submitted' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// DENY RTI
// ============================================================================

router.post('/:rtiId/deny',
    validate(rtiIdParamSchema),
    validate(denyRtiSchema),
    async (req, res, next) => {
        try {
            const { rtiId } = req.params;
            const { denied_reasons, exemption_sections } = req.body;

            const rtiResult = await pgQuery(`SELECT * FROM rti_requests WHERE id = $1`, [rtiId]);
            if (rtiResult.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'RTI request not found' });
                return;
            }

            const rti = rtiResult.rows[0];

            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                if (rti.assigned_to !== req.auth!.sub) {
                    res.status(403).json({ error: 'FORBIDDEN', message: 'Not assigned to this RTI' });
                    return;
                }
            }

            await pgQuery(
                `UPDATE rti_requests SET
                    status = 'DENIED',
                    denied_reasons = $1,
                    exemption_sections = $2,
                    responded_by = $3,
                    responded_at = NOW(),
                    updated_at = NOW()
                 WHERE id = $4`,
                [denied_reasons, exemption_sections || [], req.auth!.sub, rtiId]
            );

            await logAuditEvent({
                event_type: 'RTI_DENIED',
                event_category: 'RTI',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'deny_rti',
                outcome: 'SUCCESS',
                resource_type: 'RTI_REQUEST',
                resource_id: rtiId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { denied_reasons, exemption_sections },
            });

            res.json({ message: 'RTI denied' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// FILE APPEAL
// ============================================================================

router.post('/:rtiId/appeal',
    validate(rtiIdParamSchema),
    validate(appealRtiSchema),
    async (req, res, next) => {
        try {
            const { rtiId } = req.params;
            const { appeal_level, appeal_details } = req.body;

            const rtiResult = await pgQuery(`SELECT * FROM rti_requests WHERE id = $1`, [rtiId]);
            if (rtiResult.rows.length === 0) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'RTI request not found' });
                return;
            }

            const rti = rtiResult.rows[0];

            if (appeal_level === 'FIRST') {
                if (rti.first_appeal_filed) {
                    res.status(400).json({ error: 'BAD_REQUEST', message: 'First appeal already filed' });
                    return;
                }
                await pgQuery(
                    `UPDATE rti_requests SET first_appeal_filed = TRUE, first_appeal_date = NOW(), first_appeal_details = $1, status = 'APPEALED', updated_at = NOW() WHERE id = $2`,
                    [JSON.stringify(appeal_details || {}), rtiId]
                );
            } else if (appeal_level === 'SECOND') {
                if (!rti.first_appeal_filed) {
                    res.status(400).json({ error: 'BAD_REQUEST', message: 'First appeal must be filed before second appeal' });
                    return;
                }
                if (rti.second_appeal_filed) {
                    res.status(400).json({ error: 'BAD_REQUEST', message: 'Second appeal already filed' });
                    return;
                }
                await pgQuery(
                    `UPDATE rti_requests SET second_appeal_filed = TRUE, second_appeal_date = NOW(), second_appeal_details = $1, updated_at = NOW() WHERE id = $2`,
                    [JSON.stringify(appeal_details || {}), rtiId]
                );
            }

            await logAuditEvent({
                event_type: 'RTI_APPEAL_FILED',
                event_category: 'RTI',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'file_appeal',
                outcome: 'SUCCESS',
                resource_type: 'RTI_REQUEST',
                resource_id: rtiId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { appeal_level, appeal_details },
            });

            res.json({ message: `${appeal_level} appeal filed successfully` });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// ASSIGN RTI
// ============================================================================

router.post('/:rtiId/assign',
    validate(rtiIdParamSchema),
    validate(z.object({ body: z.object({ assigned_to: z.string().uuid() }) })),
    async (req, res, next) => {
        try {
            const { rtiId } = req.params;
            const { assigned_to } = req.body;

            if (req.auth!.role !== 'CENTRAL_ADMIN' && req.auth!.role !== 'AUDITOR') {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
                return;
            }

            await pgQuery(
                `UPDATE rti_requests SET assigned_to = $1, status = 'UNDER_PROCESS', updated_at = NOW() WHERE id = $2`,
                [assigned_to, rtiId]
            );

            await logAuditEvent({
                event_type: 'RTI_ASSIGNED',
                event_category: 'RTI',
                user_id: req.auth!.sub,
                user_role: req.auth!.role,
                user_ip: req.ip,
                action: 'assign_rti',
                outcome: 'SUCCESS',
                resource_type: 'RTI_REQUEST',
                resource_id: rtiId,
                request_id: req.headers['x-request-id'] as string,
                metadata: { assigned_to },
            });

            res.json({ message: 'RTI assigned successfully' });
        } catch (error) {
            next(error);
        }
    }
);

export default router;