"use strict";
/**
 * ADALAT360 - Authentication Models
 * TypeScript interfaces for auth-related data structures
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PASSWORD_POLICY = void 0;
exports.DEFAULT_PASSWORD_POLICY = {
    min_length: 12,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special: true,
    max_age_days: 90,
    history_count: 5,
    lockout_threshold: 5,
    lockout_duration_minutes: 30,
};
//# sourceMappingURL=auth.js.map