/**
 * ADALAT360 - Validation Middleware
 * Zod-based request validation for body, query, params
 */
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';
export interface ValidationSchemas {
    body?: AnyZodObject;
    query?: AnyZodObject;
    params?: AnyZodObject;
}
export declare function validate(schemas: ValidationSchemas): (req: Request, res: Response, next: NextFunction) => Promise<void>;
import { z } from 'zod';
export declare const validateBody: (schema: AnyZodObject) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const validateQuery: (schema: AnyZodObject) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const validateParams: (schema: AnyZodObject) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const uuidParam: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
export declare const paginationQuery: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        sort_by: z.ZodOptional<z.ZodString>;
        sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        sort_order: "asc" | "desc";
        sort_by?: string | undefined;
    }, {
        limit?: number | undefined;
        page?: number | undefined;
        sort_by?: string | undefined;
        sort_order?: "asc" | "desc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        sort_order: "asc" | "desc";
        sort_by?: string | undefined;
    };
}, {
    query: {
        limit?: number | undefined;
        page?: number | undefined;
        sort_by?: string | undefined;
        sort_order?: "asc" | "desc" | undefined;
    };
}>;
export declare const dateRangeQuery: z.ZodObject<{
    query: z.ZodObject<{
        start_date: z.ZodOptional<z.ZodDate>;
        end_date: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        start_date?: Date | undefined;
        end_date?: Date | undefined;
    }, {
        start_date?: Date | undefined;
        end_date?: Date | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        start_date?: Date | undefined;
        end_date?: Date | undefined;
    };
}, {
    query: {
        start_date?: Date | undefined;
        end_date?: Date | undefined;
    };
}>;
//# sourceMappingURL=validate.middleware.d.ts.map