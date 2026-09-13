"use strict";
/**
 * ADALAT360 - Validation Middleware
 * Zod-based request validation for body, query, params
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dateRangeQuery = exports.paginationQuery = exports.uuidParam = exports.validateParams = exports.validateQuery = exports.validateBody = void 0;
exports.validate = validate;
const zod_1 = require("zod");
const audit_service_js_1 = require("../services/audit.service.js");
function validate(schemas) {
    return async (req, res, next) => {
        try {
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }
            if (schemas.query) {
                req.query = await schemas.query.parseAsync(req.query);
            }
            if (schemas.params) {
                req.params = await schemas.params.parseAsync(req.params);
            }
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const issues = error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                    code: issue.code,
                }));
                await (0, audit_service_js_1.logAuditEvent)({
                    event_type: 'VALIDATION_FAILED',
                    event_category: 'VALIDATION',
                    severity: 'WARNING',
                    user_id: req.auth?.sub,
                    user_role: req.auth?.role,
                    user_ip: req.ip,
                    action: 'request_validation',
                    outcome: 'FAILURE',
                    error_message: 'Request validation failed',
                    request_id: req.headers['x-request-id'],
                    metadata: {
                        path: req.path,
                        method: req.method,
                        validation_errors: issues,
                    },
                }).catch(console.error);
                res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: 'Request validation failed',
                    issues,
                });
                return;
            }
            next(error);
        }
    };
}
// ============================================================================
// COMMON VALIDATION HELPERS
// ============================================================================
const zod_2 = require("zod");
const validateBody = (schema) => validate({ body: schema });
exports.validateBody = validateBody;
const validateQuery = (schema) => validate({ query: schema });
exports.validateQuery = validateQuery;
const validateParams = (schema) => validate({ params: schema });
exports.validateParams = validateParams;
// Pre-built schemas for common patterns
exports.uuidParam = zod_2.z.object({
    params: zod_2.z.object({
        id: zod_2.z.string().uuid('Invalid UUID format'),
    }),
});
exports.paginationQuery = zod_2.z.object({
    query: zod_2.z.object({
        page: zod_2.z.coerce.number().int().positive().default(1),
        limit: zod_2.z.coerce.number().int().positive().max(100).default(20),
        sort_by: zod_2.z.string().optional(),
        sort_order: zod_2.z.enum(['asc', 'desc']).default('desc'),
    }),
});
exports.dateRangeQuery = zod_2.z.object({
    query: zod_2.z.object({
        start_date: zod_2.z.coerce.date().optional(),
        end_date: zod_2.z.coerce.date().optional(),
    }),
});
//# sourceMappingURL=validate.middleware.js.map