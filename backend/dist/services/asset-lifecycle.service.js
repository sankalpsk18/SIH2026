"use strict";
/**
 * ADALAT360 - Asset Lifecycle Service
 * Police Asset Lifecycle Management with state machine, QR codes, and blockchain integration
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
exports.AssetLifecycleService = void 0;
exports.getAssetLifecycleService = getAssetLifecycleService;
const uuid_1 = require("uuid");
const crypto = __importStar(require("crypto"));
const qrcode_1 = __importDefault(require("qrcode"));
const database_js_1 = require("../config/database.js");
const database_js_2 = require("../config/database.js");
const blockchain_service_js_1 = require("../blockchain/blockchain.service.js");
const database_js_3 = require("../types/database.js");
const audit_service_js_1 = require("./audit.service.js");
const asset_lifecycle_js_1 = require("../models/asset-lifecycle.js");
// ============================================================================
// ASSET LIFECYCLE SERVICE CLASS
// ============================================================================
class AssetLifecycleService {
    // ========================================================================
    // ASSET CREATION
    // ========================================================================
    async createAsset(request, actorUserId) {
        return (0, database_js_1.pgTransaction)(async (client) => {
            // Validate case exists and user has access
            const caseCheck = await client.query(`SELECT case_number FROM cases WHERE id = $1 AND deleted_at IS NULL`, [request.case_id]);
            if (caseCheck.rows.length === 0) {
                throw new Error('Case not found');
            }
            const caseNumber = caseCheck.rows[0].case_number;
            // Verify user has permission
            const permCheck = await client.query(`SELECT 1 FROM case_assignments
                 WHERE case_id = $1 AND user_id = $2 AND is_active = TRUE
                 AND ('WRITE' = ANY(permission_level) OR 'ADMIN' = ANY(permission_level))`, [request.case_id, actorUserId]);
            const caseRoleCheck = await client.query(`SELECT 1 FROM cases
                 WHERE id = $1 AND (assigned_officer_id = $2 OR supervising_officer_id = $2)`, [request.case_id, actorUserId]);
            if (permCheck.rows.length === 0 && caseRoleCheck.rows.length === 0) {
                throw new Error('You do not have permission to create assets in this case');
            }
            // Get actor details
            const actorResult = await client.query(`SELECT full_name, role, department FROM users WHERE id = $1`, [actorUserId]);
            if (actorResult.rows.length === 0) {
                throw new Error('Actor user not found');
            }
            const actor = actorResult.rows[0];
            // Generate asset ID
            const countResult = await client.query(`SELECT COUNT(*) as count FROM assets WHERE case_id = $1`, [request.case_id]);
            const count = parseInt(countResult.rows[0].count, 10) + 1;
            const assetId = `AST/${caseNumber}/${count.toString().padStart(5, '0')}`;
            // Generate QR code
            const qrPayload = {
                v: 1,
                type: 'ASSET',
                asset_id: assetId,
                case_id: request.case_id,
                state: 'SEIZED',
                verify_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/asset/${assetId}`,
            };
            const qrPayloadString = JSON.stringify(qrPayload);
            const qrCodeHash = crypto.createHash('sha256').update(qrPayloadString).digest('hex');
            const qrCodeImageUrl = await qrcode_1.default.toDataURL(qrPayloadString, {
                width: 300,
                margin: 2,
                errorCorrectionLevel: 'M',
            });
            // Create asset record
            const assetIdUuid = (0, uuid_1.v4)();
            const now = new Date();
            const initialHistoryEntry = {
                id: (0, uuid_1.v4)(),
                asset_id: assetIdUuid,
                from_state: undefined,
                to_state: 'SEIZED',
                transition: 'SEIZED_TO_STORED', // Initial pseudo-transition
                actor_user_id: actorUserId,
                actor_name: actor.full_name,
                actor_role: actor.role,
                actor_department: actor.department,
                location: request.seized_location,
                condition_notes: 'Initial seizure',
                metadata: {
                    seizure_memo: request.seizure_memo_number,
                    panchnama_reference: request.panchnama_reference,
                },
                timestamp: request.seized_at,
            };
            const asset = {
                id: assetIdUuid,
                asset_id: assetId,
                qr_code_hash: qrCodeHash,
                qr_code_image_url: qrCodeImageUrl,
                qr_code_payload: qrPayloadString,
                case_id: request.case_id,
                case_number: caseNumber,
                name: request.name,
                description: request.description,
                category: request.category,
                sub_category: request.sub_category,
                current_state: 'SEIZED',
                seized_at: request.seized_at,
                seized_by_user_id: request.seized_by_user_id,
                seized_by_name: (await client.query('SELECT full_name FROM users WHERE id = $1', [request.seized_by_user_id])).rows[0]?.full_name || 'Unknown',
                seized_by_role: (await client.query('SELECT role FROM users WHERE id = $1', [request.seized_by_user_id])).rows[0]?.role || 'Unknown',
                seized_location: request.seized_location,
                seized_from: request.seized_from,
                panchnama_reference: request.panchnama_reference,
                seizure_memo_number: request.seizure_memo_number,
                weight_grams: request.weight_grams,
                dimensions_cm: request.dimensions_cm,
                photographs: request.photographs || [],
                distinguishing_features: request.distinguishing_features,
                serial_number: request.serial_number,
                manufacturer: request.manufacturer,
                model: request.model,
                current_holder_user_id: request.seized_by_user_id,
                current_holder_name: (await client.query('SELECT full_name FROM users WHERE id = $1', [request.seized_by_user_id])).rows[0]?.full_name || 'Unknown',
                current_holder_role: (await client.query('SELECT role FROM users WHERE id = $1', [request.seized_by_user_id])).rows[0]?.role || 'Unknown',
                current_holder_department: (await client.query('SELECT department FROM users WHERE id = $1', [request.seized_by_user_id])).rows[0]?.department || 'Unknown',
                current_location: request.current_location,
                container_seal_number: request.container_seal_number,
                seal_intact: request.seal_intact ?? true,
                storage_condition: request.storage_condition,
                state_history: [initialHistoryEntry],
                custody_ledger_tx_ids: [],
                metadata: request.metadata || {},
                tags: request.tags || [],
                created_at: now,
                updated_at: now,
            };
            // Insert into PostgreSQL
            await client.query(`INSERT INTO assets (
                    id, asset_id, qr_code_hash, qr_code_image_url, qr_code_payload,
                    case_id, case_number, name, description, category, sub_category,
                    current_state, seized_at, seized_by_user_id, seized_by_name,
                    seized_by_role, seized_location, seized_from, panchnama_reference,
                    seizure_memo_number, weight_grams, dimensions_cm, photographs,
                    distinguishing_features, serial_number, manufacturer, model,
                    current_holder_user_id, current_holder_name, current_holder_role,
                    current_holder_department, current_location, container_seal_number,
                    seal_intact, storage_condition, state_history, custody_ledger_tx_ids,
                    metadata, tags, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40)`, [
                asset.id, asset.asset_id, asset.qr_code_hash, asset.qr_code_image_url, asset.qr_code_payload,
                asset.case_id, asset.case_number, asset.name, asset.description, asset.category, asset.sub_category,
                asset.current_state, asset.seized_at, asset.seized_by_user_id, asset.seized_by_name,
                asset.seized_by_role, JSON.stringify(asset.seized_location), asset.seized_from,
                asset.panchnama_reference, asset.seizure_memo_number,
                asset.weight_grams, JSON.stringify(asset.dimensions_cm), asset.photographs,
                asset.distinguishing_features, asset.serial_number, asset.manufacturer, asset.model,
                asset.current_holder_user_id, asset.current_holder_name, asset.current_holder_role,
                asset.current_holder_department, JSON.stringify(asset.current_location),
                asset.container_seal_number, asset.seal_intact, asset.storage_condition,
                JSON.stringify(asset.state_history), asset.custody_ledger_tx_ids,
                JSON.stringify(asset.metadata), asset.tags, asset.created_at, asset.updated_at,
            ]);
            // Also store in MongoDB for flexible queries
            const mongoDb = await (0, database_js_2.getMongoDb)();
            await mongoDb.collection('assets').insertOne({
                ...asset,
                _id: asset.id,
            });
            // Record blockchain event for initial seizure
            const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
            const custodyResult = await blockchainService.recordCustodyEvent({
                txType: database_js_3.CustodyAction.SEIZURE,
                caseId: request.case_id,
                actorUserId: actorUserId,
                actorNodeId: 'OfficerMSP',
                actionDetails: {
                    action: 'ASSET_SEIZED',
                    asset_id: assetId,
                    asset_category: request.category,
                    asset_name: request.name,
                    seized_location: request.seized_location,
                    sealed: true,
                },
            });
            // Update asset with custody ledger TX ID
            await client.query(`UPDATE assets SET custody_ledger_tx_ids = array_append(custody_ledger_tx_ids, $1), updated_at = NOW() WHERE id = $2`, [custodyResult.tx_id, assetIdUuid]);
            // Update MongoDB
            await mongoDb.collection('assets').updateOne({ _id: assetIdUuid }, { $push: { custody_ledger_tx_ids: custodyResult.tx_id } });
            // Log audit event
            await (0, audit_service_js_1.logAuditEvent)({
                event_type: 'ASSET_CREATED',
                event_category: 'ASSET_LIFECYCLE',
                user_id: actorUserId,
                user_role: actor.role,
                user_ip: 'system', // Would come from request context
                action: 'create_asset',
                outcome: 'SUCCESS',
                resource_type: 'ASSET',
                resource_id: assetIdUuid,
                metadata: {
                    asset_id: assetId,
                    asset_category: request.category,
                    asset_name: request.name,
                    custody_tx_id: custodyResult.tx_id,
                },
            });
            // Return asset with updated custody TX ID
            return {
                ...asset,
                custody_ledger_tx_ids: [custodyResult.tx_id],
            };
        });
    }
    // ========================================================================
    // STATE TRANSITION
    // ========================================================================
    async transitionAssetState(request, actorUserId) {
        return (0, database_js_1.pgTransaction)(async (client) => {
            // Get current asset
            const assetResult = await client.query(`SELECT * FROM assets WHERE id = $1 AND deleted_at IS NULL`, [request.asset_id]);
            if (assetResult.rows.length === 0) {
                throw new Error('Asset not found');
            }
            const asset = assetResult.rows[0];
            const fromState = asset.current_state;
            const toState = request.to_state;
            // Validate transition
            const validTransitions = asset_lifecycle_js_1.ASSET_STATE_TRANSITIONS[fromState] || [];
            if (!validTransitions.includes(toState)) {
                throw new Error(`Invalid state transition: ${fromState} -> ${toState}. Valid transitions from ${fromState}: ${validTransitions.join(', ')}`);
            }
            // Determine transition type
            const transition = this.getTransitionType(fromState, toState);
            if (!transition) {
                throw new Error(`Unknown transition: ${fromState} -> ${toState}`);
            }
            // Special validation for disposal (requires maker-checker)
            if (toState === 'DISPOSED') {
                if (!request.disposal_initiated_by || !request.disposal_approved_by || !request.disposal_authorization) {
                    throw new Error('Disposal requires maker-checker: initiated_by, approved_by, and authorization are required');
                }
                // Verify approval exists and is valid
                await this.verifyDisposalApproval(request.asset_id, request.disposal_initiated_by, request.disposal_approved_by, client);
            }
            // Verify actor has permission
            await this.verifyActorPermission(client, actorUserId, asset.case_id, 'WRITE');
            // Get actor details
            const actorResult = await client.query(`SELECT full_name, role, department FROM users WHERE id = $1`, [actorUserId]);
            const actor = actorResult.rows[0];
            // Determine new holder if transferring
            let newHolderId = asset.current_holder_user_id;
            let newHolderName = asset.current_holder_name;
            let newHolderRole = asset.current_holder_role;
            let newHolderDepartment = asset.current_holder_department;
            let newLocation = asset.current_location;
            if (toState === 'TRANSFERRED' || toState === 'STORED') {
                // For transfer, the actor becomes the new holder
                // In a real implementation, this would come from request
                newHolderId = actorUserId;
                newHolderName = (await client.query('SELECT full_name FROM users WHERE id = $1', [actorUserId])).rows[0]?.full_name || 'Unknown';
                newHolderRole = (await client.query('SELECT role FROM users WHERE id = $1', [actorUserId])).rows[0]?.role || 'Unknown';
                newHolderDepartment = (await client.query('SELECT department FROM users WHERE id = $1', [actorUserId])).rows[0]?.department || 'Unknown';
            }
            if (request.location) {
                newLocation = request.location;
            }
            // Create history entry
            const historyEntry = {
                id: (0, uuid_1.v4)(),
                asset_id: request.asset_id,
                from_state: fromState,
                to_state: toState,
                transition: this.getTransitionType(fromState, toState),
                actor_user_id: actorUserId,
                actor_name: (await client.query('SELECT full_name FROM users WHERE id = $1', [actorUserId])).rows[0]?.full_name || 'Unknown',
                actor_role: (await client.query('SELECT role FROM users WHERE id = $1', [actorUserId])).rows[0]?.role || 'Unknown',
                actor_department: (await client.query('SELECT department FROM users WHERE id = $1', [actorUserId])).rows[0]?.department || 'Unknown',
                location: request.location,
                seal_number: request.seal_number,
                seal_intact: request.seal_intact,
                condition_notes: request.condition_notes,
                witness_user_id: request.witness_user_id,
                metadata: request.metadata || {},
                timestamp: new Date(),
            };
            // Get transition label
            const transitionType = this.getTransitionType(fromState, toState);
            const transitionLabel = asset_lifecycle_js_1.ASSET_TRANSITION_LABELS[transitionType];
            // Update asset
            const now = new Date();
            const updatedHistory = [...asset.state_history, {
                    ...historyEntry,
                    id: (0, uuid_1.v4)(),
                    transition: this.getTransitionType(fromState, toState),
                    custody_ledger_tx_id: undefined, // Will be filled after blockchain
                }];
            await client.query(`UPDATE assets SET
                    current_state = $1,
                    previous_state = $2,
                    current_holder_user_id = $3,
                    current_holder_name = $4,
                    current_holder_role = $5,
                    current_holder_department = $6,
                    current_location = $7,
                    container_seal_number = COALESCE($8, container_seal_number),
                    seal_intact = COALESCE($9, seal_intact),
                    storage_condition = COALESCE($10, storage_condition),
                    state_history = $11,
                    updated_at = NOW()
                 WHERE id = $12`, [
                toState,
                fromState,
                asset.current_holder_user_id, // Will be updated below if transfer
                asset.current_holder_name,
                asset.current_holder_role,
                asset.current_holder_department,
                JSON.stringify(newLocation),
                historyEntry.seal_number || null,
                historyEntry.seal_intact ?? null,
                historyEntry.condition_notes || null,
                JSON.stringify(updatedHistory),
                request.asset_id,
            ]);
            // If transfer, update holder
            if (toState === 'TRANSFERRED') {
                await client.query(`UPDATE assets SET
                        current_holder_user_id = $1,
                        current_holder_name = $2,
                        current_holder_role = $3,
                        current_holder_department = $4,
                        current_location = $5,
                        updated_at = NOW()
                     WHERE id = $6`, [
                    actorUserId,
                    (await client.query('SELECT full_name FROM users WHERE id = $1', [actorUserId])).rows[0]?.full_name || 'Unknown',
                    (await client.query('SELECT role FROM users WHERE id = $1', [actorUserId])).rows[0]?.role || 'Unknown',
                    (await client.query('SELECT department FROM users WHERE id = $1', [actorUserId])).rows[0]?.department || 'Unknown',
                    JSON.stringify(request.location || {}),
                    historyEntry.asset_id,
                ]);
            }
            // For disposal, update disposal fields
            if (toState === 'DISPOSED') {
                await client.query(`UPDATE assets SET
                        disposal_method = $1,
                        disposed_at = NOW(),
                        disposed_by_user_id = $2,
                        disposal_witness_user_id = $3,
                        disposal_authorization = $4,
                        disposal_initiated_by = $5,
                        disposal_initiated_at = NOW(),
                        disposal_approved_by = $6,
                        disposal_approved_at = NOW(),
                        updated_at = NOW()
                     WHERE id = $7`, [
                    historyEntry.metadata?.disposal_method || 'UNKNOWN',
                    actorUserId,
                    historyEntry.witness_user_id || null,
                    historyEntry.metadata?.disposal_authorization || null,
                    historyEntry.metadata?.disposal_initiated_by || null,
                    historyEntry.metadata?.disposal_approved_by || null,
                    historyEntry.asset_id,
                ]);
            }
            // Record blockchain event
            const blockchainService = (0, blockchain_service_js_1.getBlockchainService)();
            const custodyAction = this.getCustodyActionForTransition(historyEntry.transition);
            const custodyResult = await blockchainService.recordCustodyEvent({
                txType: custodyAction,
                caseId: asset.case_id,
                actorUserId: actorUserId,
                actorNodeId: 'OfficerMSP',
                actionDetails: {
                    action: 'ASSET_STATE_TRANSITION',
                    asset_id: asset.asset_id,
                    from_state: fromState,
                    to_state: toState,
                    transition: historyEntry.transition,
                    seal_number: historyEntry.seal_number,
                    seal_intact: historyEntry.seal_intact,
                    condition_notes: historyEntry.condition_notes,
                    witness_user_id: historyEntry.witness_user_id,
                },
            });
            // Update asset with new custody TX ID
            await client.query(`UPDATE assets SET custody_ledger_tx_ids = array_append(custody_ledger_tx_ids, $1), updated_at = NOW() WHERE id = $2`, [custodyResult.tx_id, request.asset_id]);
            // Update history entry with custody TX ID
            await client.query(`UPDATE assets SET state_history = $1 WHERE id = $2`, [
                JSON.stringify(updatedHistory.map(entry => entry.id === updatedHistory[updatedHistory.length - 1].id
                    ? { ...entry, custody_ledger_tx_id: custodyResult.tx_id, custody_ledger_block_number: custodyResult.block_number }
                    : entry)),
                historyEntry.asset_id,
            ]);
            // Update MongoDB
            const mongoDb = await (0, database_js_2.getMongoDb)();
            await mongoDb.collection('assets').updateOne({ _id: request.asset_id }, {
                $set: {
                    current_state: toState,
                    previous_state: fromState,
                    current_holder_user_id: toState === 'TRANSFERRED' ? actorUserId : asset.current_holder_user_id,
                    current_location: newLocation,
                    container_seal_number: historyEntry.seal_number || null,
                    seal_intact: historyEntry.seal_intact,
                    storage_condition: historyEntry.condition_notes,
                    updated_at: new Date(),
                },
                $push: {
                    state_history: {
                        ...historyEntry,
                        custody_ledger_tx_id: custodyResult.tx_id,
                        custody_ledger_block_number: custodyResult.block_number,
                    },
                },
            });
            // Also store state history in MongoDB
            await mongoDb.collection('asset_state_history').insertOne({
                ...historyEntry,
                custody_ledger_tx_id: custodyResult.tx_id,
                custody_ledger_block_number: custodyResult.block_number,
            });
            // Log audit event
            const actorName = (await client.query('SELECT full_name FROM users WHERE id = $1', [actorUserId])).rows[0]?.full_name || 'Unknown';
            const actorRole = (await client.query('SELECT role FROM users WHERE id = $1', [actorUserId])).rows[0]?.role || 'Unknown';
            const assetIdResult = await client.query('SELECT asset_id FROM assets WHERE id = $1', [historyEntry.asset_id]);
            const assetId = assetIdResult.rows[0]?.asset_id;
            await (0, audit_service_js_1.logAuditEvent)({
                event_type: 'ASSET_STATE_TRANSITION',
                event_category: 'ASSET_LIFECYCLE',
                user_id: actorName,
                user_role: actorRole,
                action: 'asset_state_transition',
                outcome: 'SUCCESS',
                resource_type: 'ASSET',
                resource_id: historyEntry.asset_id,
                metadata: {
                    asset_id: assetId,
                    from_state: fromState,
                    to_state: toState,
                    transition: historyEntry.transition,
                    custody_tx_id: custodyResult.tx_id,
                },
            });
            // Return updated asset
            const updatedResult = await client.query(`SELECT * FROM assets WHERE id = $1`, [historyEntry.asset_id]);
            const updatedAsset = updatedResult.rows[0];
            updatedAsset.state_history = updatedHistory;
            return updatedAsset;
        });
    }
    // ========================================================================
    // DISPOSAL MAKER-CHECKER
    // ========================================================================
    async createDisposalApproval(request, actorUserId) {
        return (0, database_js_1.pgTransaction)(async (client) => {
            // Verify asset exists and is in valid state for disposal
            const assetResult = await client.query(`SELECT * FROM assets WHERE id = $1 AND deleted_at IS NULL`, [request.asset_id]);
            if (assetResult.rows.length === 0) {
                throw new Error('Asset not found');
            }
            const asset = assetResult.rows[0];
            if (!['STORED', 'TRANSFERRED', 'REPORTED_LOST', 'REPORTED_DAMAGED'].includes(asset.current_state)) {
                throw new Error(`Asset must be in STORED, TRANSFERRED, REPORTED_LOST, or REPORTED_DAMAGED state for disposal. Current state: ${asset.current_state}`);
            }
            // Verify actor has permission
            await this.verifyActorPermission(client, actorUserId, asset.case_id, 'ADMIN');
            // Verify approver exists and has appropriate role
            const approverResult = await client.query(`SELECT id, full_name, role FROM users WHERE id = $1 AND deleted_at IS NULL`, [request.approved_by]);
            if (approverResult.rows.length === 0) {
                throw new Error('Approver not found');
            }
            const approver = approverResult.rows[0];
            if (!['CENTRAL_ADMIN', 'AUDITOR', 'PROSECUTOR', 'COURT'].includes(approver.role)) {
                throw new Error('Approver must be Central Admin, Auditor, Prosecutor, or Court');
            }
            // Verify actor is not the same as approver (separation of duties)
            if (actorUserId === request.approved_by) {
                throw new Error('Initiator and approver must be different users (separation of duties)');
            }
            const approvalId = (0, uuid_1.v4)();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours default
            const approval = {
                id: approvalId,
                asset_id: request.asset_id,
                initiated_by: actorUserId,
                initiated_by_name: (await client.query('SELECT full_name FROM users WHERE id = $1', [actorUserId])).rows[0]?.full_name || 'Unknown',
                initiated_at: now,
                approved_by: request.approved_by,
                approved_by_name: approver.full_name,
                status: 'PENDING',
                disposal_method: request.disposal_method,
                disposal_authorization: request.disposal_authorization,
                expires_at: new Date(now.getTime() + (48 * 60 * 60 * 1000)), // 48 hours
                metadata: {},
                created_at: now,
                updated_at: now,
            };
            await client.query(`INSERT INTO disposal_approvals (
                    id, asset_id, initiated_by, initiated_by_name, initiated_at,
                    approved_by, approved_by_name, status, disposal_method,
                    disposal_authorization, expires_at, metadata, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [
                approval.id, approval.asset_id, approval.initiated_by, approval.initiated_by_name,
                approval.initiated_at, approval.approved_by, approval.approved_by_name,
                approval.status, approval.disposal_method, approval.disposal_authorization,
                approval.expires_at, JSON.stringify(approval.metadata), approval.created_at, approval.updated_at,
            ]);
            // Notify approver
            await this.createNotification({
                user_id: request.approved_by,
                type: 'DISPOSAL_APPROVAL_REQUEST',
                title: `Disposal Approval Required: ${await this.getAssetIdentifier(request.asset_id)}`,
                message: `Disposal approval requested for asset. Method: ${request.disposal_method}. Authorization: ${request.disposal_authorization}`,
                priority: 'URGENT',
                case_id: (await client.query('SELECT case_id FROM assets WHERE id = $1', [request.asset_id])).rows[0]?.case_id,
                channels: ['IN_APP', 'EMAIL', 'SMS'],
                metadata: { disposal_approval_id: approvalId },
            });
            return approval;
        });
    }
    async approveDisposal(approvalId, approverUserId) {
        const approvalResult = await (0, database_js_1.pgQuery)(`SELECT * FROM disposal_approvals WHERE id = $1`, [approvalId]);
        if (approvalResult.rows.length === 0) {
            throw new Error('Disposal approval not found');
        }
        const approval = approvalResult.rows[0];
        if (approval.status !== 'PENDING') {
            throw new Error(`Approval is not pending (current: ${approval.status})`);
        }
        if (approval.approved_by !== approverUserId) {
            throw new Error('You are not the designated approver');
        }
        if (new Date() > new Date(approval.expires_at)) {
            // Expire it
            await (0, database_js_1.pgQuery)(`UPDATE disposal_approvals SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`, [approvalId]);
            throw new Error('Approval request has expired');
        }
        // Approve
        await (0, database_js_1.pgQuery)(`UPDATE disposal_approvals SET status = 'APPROVED', approved_at = NOW(), updated_at = NOW() WHERE id = $1`, [approvalId]);
        // Notify initiator
        await this.createNotification({
            user_id: approval.initiated_by,
            type: 'DISPOSAL_APPROVED',
            title: `Disposal Approved`,
            message: `Your disposal request for asset has been approved by ${(await (0, database_js_1.pgQuery)('SELECT full_name FROM users WHERE id = $1', [approverUserId])).rows[0]?.full_name}.`,
            priority: 'HIGH',
            channels: ['IN_APP', 'EMAIL'],
            metadata: { disposal_approval_id: approvalId },
        });
        // Update approval record
        const updatedResult = await (0, database_js_1.pgQuery)(`SELECT * FROM disposal_approvals WHERE id = $1`, [approvalId]);
        return updatedResult.rows[0];
    }
    async rejectDisposal(approvalId, approverUserId, reason) {
        const approvalResult = await (0, database_js_1.pgQuery)(`SELECT * FROM disposal_approvals WHERE id = $1`, [approvalId]);
        if (approvalResult.rows.length === 0) {
            throw new Error('Disposal approval not found');
        }
        const approval = approvalResult.rows[0];
        if (approval.status !== 'PENDING') {
            throw new Error(`Approval is not pending (current: ${approval.status})`);
        }
        if (approval.approved_by !== approverUserId) {
            throw new Error('You are not the designated approver');
        }
        await (0, database_js_1.pgQuery)(`UPDATE disposal_approvals SET status = 'REJECTED', rejection_reason = $1, updated_at = NOW() WHERE id = $2`, [reason, approvalId]);
        // Notify initiator
        await this.createNotification({
            user_id: approval.initiated_by,
            type: 'DISPOSAL_REJECTED',
            title: `Disposal Request Rejected`,
            message: `Your disposal request was rejected. Reason: ${reason}`,
            priority: 'HIGH',
            channels: ['IN_APP', 'EMAIL'],
            metadata: { disposal_approval_id: approvalId, rejection_reason: reason },
        });
        const updatedResult = await (0, database_js_1.pgQuery)(`SELECT * FROM disposal_approvals WHERE id = $1`, [approvalId]);
        return updatedResult.rows[0];
    }
    async verifyDisposalApproval(assetId, initiatedBy, approvedBy, client) {
        const approvalResult = await client.query(`SELECT * FROM disposal_approvals
             WHERE asset_id = $1
             AND initiated_by = $2
             AND approved_by = $3
             AND status = 'APPROVED'
             AND expires_at > NOW()`, [assetId, initiatedBy, approvedBy]);
        if (approvalResult.rows.length === 0) {
            throw new Error('Valid disposal approval not found. Disposal requires approved maker-checker authorization.');
        }
    }
    // ========================================================================
    // QR CODE LOOKUP
    // ========================================================================
    async scanAssetQR(qrPayloadString) {
        let payload;
        try {
            payload = JSON.parse(qrPayloadString);
        }
        catch {
            throw new Error('Invalid QR code payload');
        }
        if (payload.type !== 'ASSET') {
            throw new Error('QR code is not for an asset');
        }
        const assetResult = await (0, database_js_1.pgQuery)(`SELECT * FROM assets WHERE asset_id = $1 AND deleted_at IS NULL`, [payload.asset_id]);
        if (assetResult.rows.length === 0) {
            throw new Error('Asset not found');
        }
        const asset = assetResult.rows[0];
        // Get state history
        const historyResult = await (0, database_js_1.pgQuery)(`SELECT * FROM asset_state_history WHERE asset_id = $1 ORDER BY timestamp ASC`, [asset.id]);
        // Get linked documents
        const docsResult = await (0, database_js_1.pgQuery)(`SELECT id, document_number, title, document_type
             FROM documents WHERE case_id = $1 AND deleted_at IS NULL
             AND (metadata->>'linked_asset_id') = $2`, [asset.case_id, asset.id]);
        // Get linked evidence
        const eviResult = await (0, database_js_1.pgQuery)(`SELECT id, evidence_number, name
             FROM evidence WHERE case_id = $1 AND deleted_at IS NULL
             AND (metadata->>'linked_asset_id') = $2`, [asset.case_id, asset.id]);
        // Get custody ledger summary
        const custodyResult = await (0, database_js_1.pgQuery)(`SELECT COUNT(*) as total_events,
                    MAX(tx_timestamp) as latest_timestamp,
                    MAX(tx_id) as latest_tx_id
             FROM custody_ledger
             WHERE (resource_type = 'ASSET' AND resource_id = $1)
                OR (action_details->>'asset_id') = $2`, [asset.id, asset.id]);
        return {
            asset: asset,
            state_history: historyResult.rows,
            linked_documents: docsResult.rows.map(d => ({
                id: d.id,
                document_number: d.document_number,
                title: d.title,
                document_type: d.document_type,
            })),
            linked_evidence: eviResult.rows.map(e => ({
                id: e.id,
                evidence_number: e.evidence_number,
                name: e.name,
            })),
            custody_ledger_summary: {
                total_events: parseInt(custodyResult.rows[0].total_events, 10),
                latest_event: custodyResult.rows[0].latest_tx_id ? {
                    tx_id: custodyResult.rows[0].latest_tx_id,
                    timestamp: custodyResult.rows[0].latest_timestamp,
                    action: 'STATE_TRANSITION', // Would need to fetch actual action
                    actor: 'Unknown',
                } : null,
            },
        };
    }
    // ========================================================================
    // ASSET QUERIES
    // ========================================================================
    async queryAssets(query) {
        const { case_id, current_state, category, seized_by_user_id, current_holder_user_id, date_from, date_to, search, page, limit } = query;
        const offset = (page - 1) * limit;
        const conditions = ['deleted_at IS NULL'];
        const params = [];
        let paramIndex = 1;
        if (case_id) {
            conditions.push(`case_id = $${paramIndex++}`);
            params.push(case_id);
        }
        if (current_state && current_state.length > 0) {
            conditions.push(`current_state = ANY($${paramIndex++})`);
            params.push(current_state);
        }
        if (category && category.length > 0) {
            conditions.push(`category = ANY($${paramIndex++})`);
            params.push(category);
        }
        if (seized_by_user_id) {
            conditions.push(`seized_by_user_id = $${paramIndex++}`);
            params.push(seized_by_user_id);
        }
        if (current_holder_user_id) {
            conditions.push(`current_holder_user_id = $${paramIndex++}`);
            params.push(current_holder_user_id);
        }
        if (date_from) {
            conditions.push(`seized_at >= $${paramIndex++}`);
            params.push(date_from);
        }
        if (date_to) {
            conditions.push(`seized_at <= $${paramIndex++}`);
            params.push(date_to);
        }
        if (search) {
            conditions.push(`(
                name ILIKE $${paramIndex} OR
                asset_id ILIKE $${paramIndex} OR
                description ILIKE $${paramIndex} OR
                serial_number ILIKE $${paramIndex}
            )`);
            params.push(`%${search}%`);
            paramIndex++;
        }
        const whereClause = conditions.join(' AND ');
        params.push(limit, offset);
        const [assetsResult, countResult] = await Promise.all([
            (0, database_js_1.pgQuery)(`SELECT * FROM assets WHERE ${whereClause} ORDER BY seized_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`, params),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as total FROM assets WHERE ${whereClause}`, countParams = params.slice(0, -2)),
        ]);
        return {
            assets: assetsResult.rows.map(r => ({ ...r, state_history: r.state_history || [] })),
            total: parseInt(countResult.rows[0].total, 10),
            page,
            limit,
            total_pages: Math.ceil(parseInt(countResult.rows[0].total, 10) / limit),
        };
    }
    async getAsset(assetId) {
        const result = await (0, database_js_1.pgQuery)(`SELECT * FROM assets WHERE id = $1 AND deleted_at IS NULL`, [assetId]);
        if (result.rows.length === 0)
            return null;
        const asset = result.rows[0];
        asset.state_history = asset.state_history || [];
        return asset;
    }
    async getAssetByAssetId(assetId) {
        const result = await (0, database_js_1.pgQuery)(`SELECT * FROM assets WHERE asset_id = $1 AND deleted_at IS NULL`, [assetId]);
        if (result.rows.length === 0)
            return null;
        const asset = result.rows[0];
        asset.state_history = asset.state_history || [];
        return asset;
    }
    async getAssetStateHistory(assetId) {
        const result = await (0, database_js_1.pgQuery)(`SELECT * FROM asset_state_history WHERE asset_id = $1 ORDER BY timestamp ASC`, [assetId]);
        return result.rows;
    }
    async getAssetStatistics(caseId) {
        const conditions = ['deleted_at IS NULL'];
        const params = [];
        let paramIndex = 1;
        if (caseId) {
            conditions.push(`case_id = $${paramIndex++}`);
            params.push(caseId);
        }
        const whereClause = conditions.join(' AND ');
        const [totalResult, stateResult, categoryResult, holderResult, transitionResult, pendingDisposalResult, overdueResult] = await Promise.all([
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as total FROM assets WHERE ${whereClause}`, params),
            (0, database_js_1.pgQuery)(`SELECT current_state, COUNT(*) as count FROM assets WHERE ${whereClause} GROUP BY current_state`, params),
            (0, database_js_1.pgQuery)(`SELECT category, COUNT(*) as count FROM assets WHERE ${whereClause} GROUP BY category`, params),
            (0, database_js_1.pgQuery)(`SELECT current_holder_user_id, COUNT(*) as count
                 FROM assets WHERE ${whereClause} AND current_holder_user_id IS NOT NULL
                 GROUP BY current_holder_user_id`, params),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as count FROM asset_state_history
                 WHERE timestamp >= NOW() - INTERVAL '24 hours'`, []),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as count FROM disposal_approvals WHERE status = 'PENDING'`, []),
            (0, database_js_1.pgQuery)(`SELECT COUNT(*) as count FROM assets
                 WHERE current_state IN ('STORED', 'TRANSFERRED')
                 AND seized_at < NOW() - INTERVAL '90 days'
                 AND ${whereClause}`, params),
        ]);
        // Get holder names
        const holderDetails = await Promise.all(holderResult.rows.map(async (h) => {
            const userResult = await (0, database_js_1.pgQuery)(`SELECT full_name FROM users WHERE id = $1`, [h.current_holder_user_id]);
            return {
                user_id: h.current_holder_user_id,
                name: userResult.rows[0]?.full_name || 'Unknown',
                count: parseInt(h.count, 10),
            };
        }));
        return {
            case_id: caseId,
            total_assets: parseInt(totalResult.rows[0].total, 10),
            by_state: Object.fromEntries(stateResult.rows.map((r) => [r.current_state, parseInt(r.count, 10)])),
            by_category: Object.fromEntries(categoryResult.rows.map((r) => [r.category, parseInt(r.count, 10)])),
            by_holder: holderDetails,
            recent_transitions: parseInt(transitionResult.rows[0].count, 10),
            pending_disposals: parseInt(pendingDisposalResult.rows[0].count, 10),
            overdue_assets: parseInt(overdueResult.rows[0].count, 10),
        };
    }
    // ========================================================================
    // HELPER METHODS
    // ========================================================================
    getTransitionType(fromState, toState) {
        const key = `${fromState}_TO_${toState}`;
        if (asset_lifecycle_js_1.ASSET_TRANSITION_LABELS[key]) {
            return key;
        }
        // Default fallback
        return `${fromState}_TO_${toState}`;
    }
    getCustodyActionForTransition(transition) {
        const actionMap = {
            'SEIZED_TO_STORED': 'SEIZURE',
            'STORED_TO_TRANSFERRED': 'TRANSFER',
            'STORED_TO_DISPOSED': 'DISPOSAL',
            'STORED_TO_REPORTED_LOST': 'TRANSFER',
            'STORED_TO_REPORTED_DAMAGED': 'TRANSFER',
            'TRANSFERRED_TO_STORED': 'RECEIVE',
            'TRANSFERRED_TO_DISPOSED': 'DISPOSAL',
            'TRANSFERRED_TO_REPORTED_LOST': 'TRANSFER',
            'TRANSFERRED_TO_REPORTED_DAMAGED': 'TRANSFER',
            'REPORTED_LOST_TO_STORED': 'RECEIVE',
            'REPORTED_DAMAGED_TO_STORED': 'RECEIVE',
            'REPORTED_LOST_TO_DISPOSED': 'DISPOSAL',
            'REPORTED_DAMAGED_TO_DISPOSED': 'DISPOSAL',
        };
        return actionMap[transition] || 'TRANSFER';
    }
    async verifyActorPermission(client, userId, caseId, requiredPermission) {
        // Check direct case role
        const caseRoleResult = await client.query(`SELECT 1 FROM cases WHERE id = $1 AND (assigned_officer_id = $2 OR supervising_officer_id = $2)`, [caseId, userId]);
        if (caseRoleResult.rows.length > 0)
            return;
        // Check assignment
        const assignmentResult = await client.query(`SELECT permission_level FROM case_assignments
             WHERE case_id = $1 AND user_id = $2 AND is_active = TRUE`, [caseId, userId]);
        if (assignmentResult.rows.length === 0) {
            throw new Error('User not assigned to this case');
        }
        const permissions = assignmentResult.rows[0].permission_level || [];
        const hasPermission = permissions.includes(requiredPermission) || permissions.includes('ADMIN');
        if (!hasPermission) {
            throw new Error(`Insufficient permissions. Required: ${requiredPermission}`);
        }
    }
    async getAssetIdentifier(assetId) {
        const result = await (0, database_js_1.pgQuery)(`SELECT asset_id FROM assets WHERE id = $1`, [assetId]);
        return result.rows[0]?.asset_id || assetId;
    }
    async getAssetCaseId(assetId) {
        const result = await (0, database_js_1.pgQuery)(`SELECT case_id FROM assets WHERE id = $1`, [assetId]);
        return result.rows[0]?.case_id || null;
    }
    // ========================================================================
    // NOTIFICATIONS (simplified - uses existing notification system)
    // ========================================================================
    async createNotification(notification) {
        // Simplified - in production would use notification service
        const mongoDb = await (0, database_js_2.getMongoDb)();
        await mongoDb.collection('notifications').insertOne({
            id: (0, uuid_1.v4)(),
            user_id: notification.user_id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            case_id: notification.case_id,
            channels: notification.channels,
            read: false,
            metadata: notification.metadata,
            created_at: new Date(),
        });
    }
    // ========================================================================
    // EXPIRY CHECK (for cron job)
    // ========================================================================
    async checkExpiredDisposalApprovals() {
        const result = await (0, database_js_1.pgQuery)(`UPDATE disposal_approvals
             SET status = 'EXPIRED', updated_at = NOW()
             WHERE status = 'PENDING' AND expires_at < NOW()
             RETURNING id`);
        return result.rowCount || 0;
    }
    async checkExpiredHandoffs() {
        // This would be in collaboration service
        return 0;
    }
}
exports.AssetLifecycleService = AssetLifecycleService;
// ============================================================================
// SINGLETON
// ============================================================================
let assetLifecycleServiceInstance = null;
function getAssetLifecycleService() {
    if (!assetLifecycleServiceInstance) {
        assetLifecycleServiceInstance = new AssetLifecycleService();
    }
    return assetLifecycleServiceInstance;
}
//# sourceMappingURL=asset-lifecycle.service.js.map