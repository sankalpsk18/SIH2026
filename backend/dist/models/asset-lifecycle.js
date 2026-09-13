"use strict";
/**
 * ADALAT360 - Police Asset Lifecycle Models
 * State machine for physical seized assets with explicit transitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_TRANSITION_LABELS = exports.ASSET_STATE_TRANSITIONS = void 0;
// ============================================================================
// TRANSITION VALIDATION TABLE
// ============================================================================
/**
 * Valid state transitions for assets
 * Key: from_state, Value: array of valid to_states
 */
exports.ASSET_STATE_TRANSITIONS = {
    SEIZED: ['STORED'],
    STORED: ['TRANSFERRED', 'DISPOSED', 'REPORTED_LOST', 'REPORTED_DAMAGED'],
    TRANSFERRED: ['STORED', 'DISPOSED', 'REPORTED_LOST', 'REPORTED_DAMAGED'],
    DISPOSED: [], // Terminal state
    REPORTED_LOST: ['STORED', 'DISPOSED'], // Recovery or legal disposal
    REPORTED_DAMAGED: ['STORED', 'DISPOSED'], // Repair or legal disposal
};
exports.ASSET_TRANSITION_LABELS = {
    SEIZED_TO_STORED: 'Seized to Stored',
    STORED_TO_TRANSFERRED: 'Stored to Transferred',
    STORED_TO_DISPOSED: 'Stored to Disposed',
    STORED_TO_REPORTED_LOST: 'Stored to Reported Lost',
    STORED_TO_REPORTED_DAMAGED: 'Stored to Reported Damaged',
    TRANSFERRED_TO_STORED: 'Transferred to Stored',
    TRANSFERRED_TO_DISPOSED: 'Transferred to Disposed',
    TRANSFERRED_TO_REPORTED_LOST: 'Transferred to Reported Lost',
    TRANSFERRED_TO_REPORTED_DAMAGED: 'Transferred to Reported Damaged',
    REPORTED_LOST_TO_STORED: 'Lost Asset Recovered',
    REPORTED_DAMAGED_TO_STORED: 'Damaged Asset Repaired',
    REPORTED_LOST_TO_DISPOSED: 'Lost Asset Disposed',
    REPORTED_DAMAGED_TO_DISPOSED: 'Damaged Asset Disposed',
};
//# sourceMappingURL=asset-lifecycle.js.map