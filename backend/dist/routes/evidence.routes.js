"use strict";
/**
 * ADALAT360 - Evidence Routes
 * REST API for physical/digital evidence management with QR code tracking
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
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
const crypto = __importStar(require("crypto"));
const qrcode_1 = __importDefault(require("qrcode"));
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_js_1.authenticate);
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
const evidenceIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        evidenceId: zod_1.z.string().uuid(),
    }),
});
const caseIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
    }),
});
const createEvidenceSchema = zod_1.z.object({
    body: zod_1.z.object({
        caseId: zod_1.z.string().uuid(),
        name: zod_1.z.string().min(1).max(500),
        description: zod_1.z.string().optional(),
        evidenceType: zod_1.z.nativeEnum(database_js_2.EvidenceType),
        category: zod_1.z.string().max(100).optional(),
        sub_category: zod_1.z.string().max(100).optional(),
        seized_at: zod_1.z.coerce.date(),
        seized_by: zod_1.z.string().uuid(),
        seized_location: zod_1.z.record(zod_1.z.any()).optional(),
        seized_from: zod_1.z.string().max(500).optional(),
        panchnama_reference: zod_1.z.string().max(200).optional(),
        seizure_memo_number: zod_1.z.string().max(100).optional(),
        current_location: zod_1.z.string().max(500).optional(),
        storage_condition: zod_1.z.string().max(200).optional(),
        container_seal_number: zod_1.z.string().max(100).optional(),
        weight_grams: zod_1.z.number().optional(),
        dimensions_cm: zod_1.z.record(zod_1.z.any()).optional(),
        photographs: zod_1.z.array(zod_1.z.string()).optional(),
        metadata: zod_1.z.record(zod_1.z.any()).optional(),
    }),
});
const updateEvidenceSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().max(500).optional(),
        description: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(database_js_2.EvidenceStatus).optional(),
        category: zod_1.z.string().max(100).optional(),
        sub_category: zod_1.z.string().max(100).optional(),
        current_custodian_id: zod_1.z.string().uuid().optional(),
        current_location: zod_1.z.string().max(500).optional(),
        storage_condition: zod_1.z.string().max(200).optional(),
        container_seal_number: zod_1.z.string().max(100).optional(),
        forensic_lab_id: zod_1.z.string().uuid().optional(),
        metadata: zod_1.z.record(zod_1.z.any()).optional(),
    }),
});
const custodyTransferSchema = zod_1.z.object({
    body: zod_1.z.object({
        from_user_id: zod_1.z.string().uuid().optional(),
        to_user_id: zod_1.z.string().uuid(),
        from_location: zod_1.z.string().max(500).optional(),
        to_location: zod_1.z.string().max(500).optional(),
        action: zod_1.z.nativeEnum(database_js_2.CustodyAction).default(database_js_2.CustodyAction.HANDOVER),
        seal_number: zod_1.z.string().max(100).optional(),
        seal_intact: zod_1.z.boolean().optional(),
        condition_notes: zod_1.z.string().optional(),
        witness_user_id: zod_1.z.string().uuid().optional(),
        handover_document_id: zod_1.z.string().uuid().optional(),
    }),
});
const labSubmissionSchema = zod_1.z.object({
    body: zod_1.z.object({
        forensic_lab_id: zod_1.z.string().uuid(),
        analysis_type: zod_1.z.string().max(200).optional(),
    }),
});
const labResultSchema = zod_1.z.object({
    body: zod_1.z.object({
        analysis_completed_at: zod_1.z.coerce.date(),
        analysis_report_document_id: zod_1.z.string().uuid().optional(),
        analysis_results: zod_1.z.record(zod_1.z.any()).optional(),
    }),
});
const courtSubmissionSchema = zod_1.z.object({
    body: zod_1.z.object({
        court_exhibit_number: zod_1.z.string().max(100).optional(),
    }),
});
const disposalSchema = zod_1.z.object({
    body: zod_1.z.object({
        disposal_method: zod_1.z.string().max(200),
        disposed_by: zod_1.z.string().uuid(),
        disposal_witness: zod_1.z.string().uuid().optional(),
    }),
});
const evidenceQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
        evidence_type: zod_1.z.nativeEnum(database_js_2.EvidenceType).optional(),
        status: zod_1.z.nativeEnum(database_js_2.EvidenceStatus).optional(),
        current_custodian_id: zod_1.z.string().uuid().optional(),
        forensic_lab_id: zod_1.z.string().uuid().optional(),
        search: zod_1.z.string().optional(),
    }),
});
// ============================================================================
// LIST EVIDENCE (case-scoped)
// ============================================================================
router.get('/case/:caseId', (0, validate_middleware_js_1.validate)(caseIdParamSchema), (0, auth_middleware_js_1.requireCaseAccess)('caseId'), (0, validate_middleware_js_1.validate)(evidenceQuerySchema), async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { page, limit, evidence_type, status, current_custodian_id, forensic_lab_id, search } = req.query;
        const offset = (page - 1) * limit;
        const conditions = ['e.case_id = $1', 'e.deleted_at IS NULL'];
        const params = [caseId];
        let paramIndex = 2;
        if (evidence_type) {
            conditions.push(`e.evidence_type = $${paramIndex++}`);
            params.push(evidence_type);
        }
        if (status) {
            conditions.push(`e.status = $${paramIndex++}`);
            params.push(status);
        }
        if (current_custodian_id) {
            conditions.push(`e.current_custodian_id = $${paramIndex++}`);
            params.push(current_custodian_id);
        }
        if (forensic_lab_id) {
            conditions.push(`e.forensic_lab_id = $${paramIndex++}`);
            params.push(forensic_lab_id);
        }
        if (search) {
            conditions.push(`(
                    e.name ILIKE $${paramIndex} OR
                    e.description ILIKE $${paramIndex} OR
                    e.evidence_number ILIKE $${paramIndex} OR
                    e.category ILIKE $${paramIndex}
                )`);
            params.push(`%${search}%`);
            paramIndex++;
        }
        const whereClause = conditions.join(' AND ');
        params.push(limit, offset);
        const [eviResult, countResult] = await Promise.all([
            (0, database_js_1.pgQuery)(`SELECT e.*, u1.full_name as seized_by_name, u2.full_name as custodian_name, u3.full_name as lab_name
                     FROM evidence e
                     LEFT JOIN users u1 ON u1.id = e.seized_by
                     LEFT JOIN users u2 ON u2.id = e.current_custodian_id
                     LEFT JOIN users u3 ON u3.id = e.forensic_lab_id
                     WHERE ${whereClause}
                     ORDER BY e.seized_at DESC
                     LIMIT $${paramIndex++} OFFSET $${paramIndex}`, params),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as total FROM evidence e WHERE ${whereClause}`, params.slice(0, -2)),
        ]);
        res.json({
            evidence: eviResult.rows,
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
// GET EVIDENCE BY ID
// ============================================================================
router.get('/:evidenceId', (0, validate_middleware_js_1.validate)(evidenceIdParamSchema), async (req, res, next) => {
    try {
        const result = await (0, database_js_1.pgQuery)(`SELECT e.*, u1.full_name as seized_by_name, u2.full_name as custodian_name, u3.full_name as lab_name, u4.full_name as disposed_by_name
                 FROM evidence e
                 LEFT JOIN users u1 ON u1.id = e.seized_by
                 LEFT JOIN users u2 ON u2.id = e.current_custodian_id
                 LEFT JOIN users u3 ON u3.id = e.forensic_lab_id
                 LEFT JOIN users u4 ON u4.id = e.disposed_by
                 WHERE e.id = $1 AND e.deleted_at IS NULL`, [req.params.evidenceId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
            return;
        }
        const evidence = result.rows[0];
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(evidence.case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this evidence' });
                return;
            }
        }
        res.json(evidence);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CREATE EVIDENCE (Seizure)
// ============================================================================
router.post('/', (0, auth_middleware_js_1.userRateLimit)(20, 60000, 'evidence_create'), (0, validate_middleware_js_1.validate)(createEvidenceSchema), async (req, res, next) => {
    try {
        const evidenceId = (0, uuid_1.v4)();
        const now = new Date();
        // Generate evidence number
        const countResult = await (0, database_js_1.pgQuery)(`SELECT COUNT(*) as count FROM evidence WHERE case_id = $1`, [req.body.caseId]);
        const count = parseInt(countResult.rows[0].count, 10) + 1;
        const evidenceNumber = `EVD/${req.body.caseId.slice(0, 8)}/${count.toString().padStart(5, '0')}`;
        // Generate QR code
        const qrData = JSON.stringify({
            v: 1,
            type: 'EVIDENCE',
            id: evidenceId,
            num: evidenceNumber,
            case: req.body.caseId.slice(0, 8),
        });
        const qrCodeHash = crypto.createHash('sha256').update(qrData).digest('hex');
        const qrCodeImageUrl = await qrcode_1.default.toDataURL(qrData, { width: 300, margin: 2 });
        await (0, database_js_1.pgTransaction)(async (client) => {
            await client.query(`INSERT INTO evidence (
                        id, case_id, evidence_number, qr_code_hash, qr_code_image_path,
                        name, description, evidence_type, status, category, sub_category,
                        seized_at, seized_by, seized_location, seized_from,
                        panchnama_reference, seizure_memo_number,
                        current_custodian_id, current_location, storage_condition,
                        container_seal_number, weight_grams, dimensions_cm,
                        photographs, metadata, created_at, updated_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW(),NOW())`, [
                evidenceId,
                req.body.caseId,
                evidenceNumber,
                qrCodeHash,
                qrCodeImageUrl,
                req.body.name,
                req.body.description || null,
                req.body.evidenceType,
                database_js_2.EvidenceStatus.SEIZED,
                req.body.category || null,
                req.body.sub_category || null,
                req.body.seized_at,
                req.body.seized_by,
                JSON.stringify(req.body.seized_location || {}),
                req.body.seized_from || null,
                req.body.panchnama_reference || null,
                req.body.seizure_memo_number || null,
                req.body.seized_by, // Initial custodian
                req.body.current_location || null,
                req.body.storage_condition || null,
                req.body.container_seal_number || null,
                req.body.weight_grams || null,
                JSON.stringify(req.body.dimensions_cm || {}),
                req.body.photographs || [],
                JSON.stringify(req.body.metadata || {}),
            ]);
            // Record initial custody chain
            await client.query(`INSERT INTO evidence_custody_chain (
                        id, evidence_id, from_user_id, to_user_id, from_location, to_location,
                        action, seal_number, seal_intact, condition_notes, witness_user_id,
                        occurred_at, recorded_by, blockchain_tx_id, metadata
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [
                (0, uuid_1.v4)(),
                evidenceId,
                null,
                req.body.seized_by,
                null,
                req.body.current_location || req.body.seized_location?.address || 'Seizure location',
                database_js_2.CustodyAction.SEIZURE,
                req.body.container_seal_number || null,
                true,
                'Initial seizure',
                req.body.witness_user_id || null,
                req.body.seized_at,
                req.body.seized_by,
                null,
                JSON.stringify({ seizure_memo: req.body.seizure_memo_number }),
            ]);
        });
        // Record blockchain event
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: database_js_2.CustodyAction.SEIZURE,
            caseId: req.body.caseId,
            evidenceId,
            actorUserId: req.auth.sub,
            actorNodeId: req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
            actionDetails: {
                evidence_number: evidenceNumber,
                evidence_type: req.body.evidenceType,
                seized_from: req.body.seized_from,
                seized_location: req.body.seized_location,
            },
        });
        // Audit log
        await (0, audit_service_js_1.logAuditEvent)({
            event_type: 'EVIDENCE_SEIZED',
            event_category: 'EVIDENCE_MANAGEMENT',
            user_id: req.auth.sub,
            user_role: req.auth.role,
            user_ip: req.ip,
            action: 'create_evidence',
            outcome: 'SUCCESS',
            resource_type: 'EVIDENCE',
            resource_id: evidenceId,
            request_id: req.headers['x-request-id'],
        });
        const created = await (0, database_js_1.pgQuery)(`SELECT * FROM evidence WHERE id = $1`, [evidenceId]);
        res.status(201).json(created.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// UPDATE EVIDENCE
// ============================================================================
router.patch('/:evidenceId', (0, validate_middleware_js_1.validate)(evidenceIdParamSchema), (0, validate_middleware_js_1.validate)(updateEvidenceSchema), async (req, res, next) => {
    try {
        const { evidenceId } = req.params;
        const updates = req.body;
        const eviResult = await (0, database_js_1.pgQuery)(`SELECT case_id FROM evidence WHERE id = $1 AND deleted_at IS NULL`, [evidenceId]);
        if (eviResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
            return;
        }
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(eviResult.rows[0].case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
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
        values.push(evidenceId);
        const result = await (0, database_js_1.pgQuery)(`UPDATE evidence SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`, values);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CUSTODY TRANSFER (Handover)
// ============================================================================
router.post('/:evidenceId/transfer', (0, validate_middleware_js_1.validate)(evidenceIdParamSchema), (0, validate_middleware_js_1.validate)(custodyTransferSchema), async (req, res, next) => {
    try {
        const { evidenceId } = req.params;
        const { from_user_id, to_user_id, from_location, to_location, action, seal_number, seal_intact, condition_notes, witness_user_id, handover_document_id } = req.body;
        const eviResult = await (0, database_js_1.pgQuery)(`SELECT * FROM evidence WHERE id = $1 AND deleted_at IS NULL`, [evidenceId]);
        if (eviResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
            return;
        }
        const evidence = eviResult.rows[0];
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(evidence.case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        const transferFrom = from_user_id || evidence.current_custodian_id || req.auth.sub;
        const transferTo = to_user_id;
        const occurredAt = new Date();
        await (0, database_js_1.pgTransaction)(async (client) => {
            // Update evidence
            await client.query(`UPDATE evidence SET current_custodian_id = $1, current_location = $2, updated_at = NOW() WHERE id = $3`, [transferTo, to_location, evidenceId]);
            // Record custody chain
            await client.query(`INSERT INTO evidence_custody_chain (
                        id, evidence_id, from_user_id, to_user_id, from_location, to_location,
                        action, seal_number, seal_intact, condition_notes, witness_user_id,
                        handover_document_id, occurred_at, recorded_by, metadata
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [
                (0, uuid_1.v4)(),
                evidenceId,
                transferFrom,
                transferTo,
                from_location,
                to_location,
                action,
                seal_number || null,
                seal_intact ?? true,
                condition_notes || null,
                witness_user_id || null,
                handover_document_id || null,
                occurredAt,
                req.auth.sub,
                JSON.stringify({}),
            ]);
        });
        // Blockchain event
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: action,
            caseId: evidence.case_id,
            evidenceId,
            actorUserId: req.auth.sub,
            actorNodeId: req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
            actionDetails: {
                from_user_id: transferFrom,
                to_user_id: transferTo,
                from_location,
                to_location,
                seal_number,
                seal_intact,
                witness_user_id,
            },
        });
        res.json({ message: 'Custody transferred successfully' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET CUSTODY CHAIN
// ============================================================================
router.get('/:evidenceId/custody-chain', (0, validate_middleware_js_1.validate)(evidenceIdParamSchema), async (req, res, next) => {
    try {
        const { evidenceId } = req.params;
        const eviResult = await (0, database_js_1.pgQuery)(`SELECT case_id FROM evidence WHERE id = $1 AND deleted_at IS NULL`, [evidenceId]);
        if (eviResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
            return;
        }
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            if (!req.auth.case_ids.includes(eviResult.rows[0].case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        const result = await (0, database_js_1.pgQuery)(`SELECT ec.*, u1.full_name as from_name, u2.full_name as to_name, u3.full_name as witness_name
                 FROM evidence_custody_chain ec
                 LEFT JOIN users u1 ON u1.id = ec.from_user_id
                 LEFT JOIN users u2 ON u2.id = ec.to_user_id
                 LEFT JOIN users u3 ON u3.id = ec.witness_user_id
                 WHERE ec.evidence_id = $1
                 ORDER BY ec.occurred_at ASC`, [evidenceId]);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// SEND TO FORENSIC LAB
// ============================================================================
router.post('/:evidenceId/send-to-lab', (0, validate_middleware_js_1.validate)(evidenceIdParamSchema), (0, validate_middleware_js_1.validate)(labSubmissionSchema), async (req, res, next) => {
    try {
        const { evidenceId } = req.params;
        const { forensic_lab_id, analysis_type } = req.body;
        const eviResult = await (0, database_js_1.pgQuery)(`SELECT * FROM evidence WHERE id = $1 AND deleted_at IS NULL`, [evidenceId]);
        if (eviResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
            return;
        }
        await (0, database_js_1.pgTransaction)(async (client) => {
            await client.query(`UPDATE evidence SET
                        status = $1,
                        forensic_lab_id = $2,
                        sent_for_analysis_at = NOW(),
                        current_custodian_id = $3,
                        current_location = (SELECT current_location FROM users WHERE id = $3),
                        updated_at = NOW()
                     WHERE id = $4`, [database_js_2.EvidenceStatus.SENT_FOR_ANALYSIS, forensic_lab_id, forensic_lab_id, evidenceId]);
            // Custody chain
            await client.query(`INSERT INTO evidence_custody_chain (
                        id, evidence_id, from_user_id, to_user_id, action, occurred_at, recorded_by, metadata
                    ) VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7)`, [
                (0, uuid_1.v4)(),
                evidenceId,
                eviResult.rows[0].current_custodian_id,
                forensic_lab_id,
                database_js_2.CustodyAction.ANALYSIS_START,
                req.auth.sub,
                JSON.stringify({ analysis_type }),
            ]);
        });
        // Blockchain
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: database_js_2.CustodyAction.ANALYSIS_START,
            caseId: eviResult.rows[0].case_id,
            evidenceId,
            actorUserId: req.auth.sub,
            actorNodeId: 'OfficerMSP',
            actionDetails: { forensic_lab_id, analysis_type },
        });
        res.json({ message: 'Evidence sent to forensic lab' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// SUBMIT LAB RESULTS
// ============================================================================
router.post('/:evidenceId/lab-result', (0, validate_middleware_js_1.validate)(evidenceIdParamSchema), (0, validate_middleware_js_1.validate)(labResultSchema), async (req, res, next) => {
    try {
        const { evidenceId } = req.params;
        const { analysis_completed_at, analysis_report_document_id, analysis_results } = req.body;
        const eviResult = await (0, database_js_1.pgQuery)(`SELECT * FROM evidence WHERE id = $1 AND deleted_at IS NULL`, [evidenceId]);
        if (eviResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
            return;
        }
        // Only forensic lab that has the evidence can submit results
        const evidence = eviResult.rows[0];
        if (evidence.forensic_lab_id !== req.auth.sub && req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Only assigned forensic lab can submit results' });
            return;
        }
        await (0, database_js_1.pgTransaction)(async (client) => {
            await client.query(`UPDATE evidence SET
                        status = $1,
                        analysis_completed_at = $2,
                        analysis_report_document_id = $3,
                        metadata = jsonb_set(metadata, '{analysis_results}', $4::jsonb),
                        current_custodian_id = $5, -- Return to investigating officer
                        current_location = (SELECT current_location FROM users WHERE id = $5),
                        updated_at = NOW()
                     WHERE id = $6`, [database_js_2.EvidenceStatus.ANALYSIS_COMPLETE, analysis_completed_at, analysis_report_document_id, JSON.stringify(analysis_results || {}), evidence.assigned_officer_id, evidenceId]);
            // Custody chain
            await client.query(`INSERT INTO evidence_custody_chain (
                        id, evidence_id, from_user_id, to_user_id, action, occurred_at, recorded_by, metadata
                    ) VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7)`, [
                (0, uuid_1.v4)(),
                evidenceId,
                req.auth.sub,
                evidence.assigned_officer_id,
                database_js_2.CustodyAction.ANALYSIS_COMPLETE,
                req.auth.sub,
                JSON.stringify({ analysis_results }),
            ]);
        });
        res.json({ message: 'Lab results submitted' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// SUBMIT TO COURT
// ============================================================================
router.post('/:evidenceId/court-submission', (0, validate_middleware_js_1.validate)(evidenceIdParamSchema), (0, validate_middleware_js_1.validate)(courtSubmissionSchema), async (req, res, next) => {
    try {
        const { evidenceId } = req.params;
        const { court_exhibit_number } = req.body;
        const eviResult = await (0, database_js_1.pgQuery)(`SELECT * FROM evidence WHERE id = $1 AND deleted_at IS NULL`, [evidenceId]);
        if (eviResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
            return;
        }
        await (0, database_js_1.pgTransaction)(async (client) => {
            await client.query(`UPDATE evidence SET
                        status = $1,
                        presented_in_court_at = NOW(),
                        court_exhibit_number = $2,
                        updated_at = NOW()
                     WHERE id = $3`, [database_js_2.EvidenceStatus.PRESENTED_IN_COURT, court_exhibit_number, evidenceId]);
            await client.query(`INSERT INTO evidence_custody_chain (
                        id, evidence_id, from_user_id, to_user_id, action, occurred_at, recorded_by, metadata
                    ) VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7)`, [
                (0, uuid_1.v4)(),
                evidenceId,
                req.auth.sub,
                req.auth.role === 'COURT' ? req.auth.sub : 'court',
                database_js_2.CustodyAction.COURT_SUBMISSION,
                req.auth.sub,
                JSON.stringify({ court_exhibit_number }),
            ]);
        });
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: database_js_2.CustodyAction.COURT_SUBMISSION,
            caseId: eviResult.rows[0].case_id,
            evidenceId,
            actorUserId: req.auth.sub,
            actorNodeId: req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
            actionDetails: { court_exhibit_number },
        });
        res.json({ message: 'Evidence submitted to court' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// DISPOSE EVIDENCE
// ============================================================================
router.post('/:evidenceId/dispose', (0, validate_middleware_js_1.validate)(evidenceIdParamSchema), (0, validate_middleware_js_1.validate)(disposalSchema), async (req, res, next) => {
    try {
        const { evidenceId } = req.params;
        const { disposal_method, disposed_by, disposal_witness } = req.body;
        const eviResult = await (0, database_js_1.pgQuery)(`SELECT * FROM evidence WHERE id = $1 AND deleted_at IS NULL`, [evidenceId]);
        if (eviResult.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
            return;
        }
        await (0, database_js_1.pgTransaction)(async (client) => {
            await client.query(`UPDATE evidence SET
                        status = $1,
                        disposal_method = $2,
                        disposed_at = NOW(),
                        disposed_by = $3,
                        disposal_witness = $4,
                        updated_at = NOW()
                     WHERE id = $5`, [database_js_2.EvidenceStatus.DISPOSED, disposal_method, disposed_by, disposal_witness, evidenceId]);
            await client.query(`INSERT INTO evidence_custody_chain (
                        id, evidence_id, from_user_id, to_user_id, action, seal_number, condition_notes, witness_user_id, occurred_at, recorded_by, metadata
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10)`, [
                (0, uuid_1.v4)(),
                evidenceId,
                eviResult.rows[0].current_custodian_id,
                null,
                database_js_2.CustodyAction.DISPOSAL,
                null,
                `Disposed via: ${disposal_method}`,
                disposal_witness || null,
                disposed_by,
                JSON.stringify({ disposal_method }),
            ]);
        });
        const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
        await blockchainService.recordCustodyEvent({
            txType: database_js_2.CustodyAction.DISPOSAL,
            caseId: eviResult.rows[0].case_id,
            evidenceId,
            actorUserId: req.auth.sub,
            actorNodeId: req.auth.role === 'CENTRAL_ADMIN' ? 'AuditMSP' : 'OfficerMSP',
            actionDetails: { disposal_method, disposed_by, disposal_witness },
        });
        res.json({ message: 'Evidence disposed' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GET QR CODE
// ============================================================================
router.get('/:evidenceId/qr-code', (0, validate_middleware_js_1.validate)(evidenceIdParamSchema), async (req, res, next) => {
    try {
        const { evidenceId } = req.params;
        const result = await (0, database_js_1.pgQuery)(`SELECT qr_code_hash, qr_code_image_path, evidence_number, name FROM evidence WHERE id = $1 AND deleted_at IS NULL`, [evidenceId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
            return;
        }
        const evidence = result.rows[0];
        // Check case access
        if (req.auth.role !== 'CENTRAL_ADMIN' && req.auth.role !== 'AUDITOR') {
            const caseCheck = await (0, database_js_1.pgQuery)(`SELECT case_id FROM evidence WHERE id = $1`, [evidenceId]);
            if (!req.auth.case_ids.includes(caseCheck.rows[0].case_id)) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
                return;
            }
        }
        res.json({
            qr_code_hash: evidence.qr_code_hash,
            qr_code_image_url: evidence.qr_code_image_path,
            evidence_number: evidence.evidence_number,
            name: evidence.name,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=evidence.routes.js.map