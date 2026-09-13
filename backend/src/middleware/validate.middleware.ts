/**
 * ADALAT360 - Validation Middleware
 * Zod-based request validation for body, query, params
 */

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { logAuditEvent } from '../services/audit.service.js';

export interface ValidationSchemas {
    body?: AnyZodObject;
    query?: AnyZodObject;
    params?: AnyZodObject;
}

export function validate(schemas: ValidationSchemas) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        } catch (error) {
            if (error instanceof ZodError) {
                const issues = error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                    code: issue.code,
                }));

                await logAuditEvent({
                    event_type: 'VALIDATION_FAILED',
                    event_category: 'VALIDATION',
                    severity: 'WARNING',
                    user_id: (req as any).auth?.sub,
                    user_role: (req as any).auth?.role,
                    user_ip: req.ip,
                    action: 'request_validation',
                    outcome: 'FAILURE',
                    error_message: 'Request validation failed',
                    request_id: req.headers['x-request-id'] as string,
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

import { z } from 'zod';

export const validateBody = (schema: AnyZodObject) => validate({ body: schema });
export const validateQuery = (schema: AnyZodObject) => validate({ query: schema });
export const validateParams = (schema: AnyZodObject) => validate({ params: schema });

// Pre-built schemas for common patterns
export const uuidParam = z.object({
    params: z.object({
        id: z.string().uuid('Invalid UUID format'),
    }),
});

export const paginationQuery = z.object({
    query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        sort_by: z.string().optional(),
        sort_order: z.enum(['asc', 'desc']).default('desc'),
    }),
});

export const dateRangeQuery = z.object({
    query: z.object({
        start_date: z.coerce.date().optional(),
        end_date: z.coerce.date().optional(),
    }),
});