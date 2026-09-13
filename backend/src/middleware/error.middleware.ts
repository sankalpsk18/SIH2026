/**
 * ADALAT360 - Error Handling Middleware
 * Centralized error handling with proper logging and responses
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { pgQuery } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details?: any;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;

        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: any) {
        super(message, 400, 'VALIDATION_ERROR', details);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(message, 401, 'UNAUTHORIZED');
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Access denied') {
        super(message, 403, 'FORBIDDEN');
        Object.setPrototypeOf(this, AuthorizationError.prototype);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT');
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}

export class RateLimitError extends AppError {
    constructor(message: string = 'Too many requests', retryAfter?: number) {
        super(message, 429, 'TOO_MANY_REQUESTS', { retryAfter });
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}

// ============================================================================
// ERROR HANDLER
// ============================================================================

export async function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    const timestamp = new Date().toISOString();

    // Log error
    logger.error({
        message: err.message,
        stack: err.stack,
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: (req as any).auth?.sub,
        userRole: (req as any).auth?.role,
    });

    // Handle known error types
    if (err instanceof AppError) {
        const response: any = {
            error: err.code,
            message: err.message,
            request_id: requestId,
            timestamp,
        };

        if (err.details) {
            response.details = err.details;
        }

        res.status(err.statusCode).json(response);
        return;
    }

    // Handle Zod validation errors
    if (err instanceof ZodError) {
        const issues = err.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
        }));

        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            issues,
            request_id: requestId,
            timestamp,
        });
        return;
    }

    // Handle PostgreSQL errors
    if (err.message.includes('duplicate key') || err.message.includes('unique constraint')) {
        res.status(409).json({
            error: 'CONFLICT',
            message: 'Resource already exists',
            request_id: requestId,
            timestamp,
        });
        return;
    }

    if (err.message.includes('foreign key constraint')) {
        res.status(400).json({
            error: 'BAD_REQUEST',
            message: 'Referenced resource does not exist',
            request_id: requestId,
            timestamp,
        });
        return;
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        res.status(401).json({
            error: 'UNAUTHORIZED',
            message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
            request_id: requestId,
            timestamp,
        });
        return;
    }

    // Handle Multer errors
    if (err.name === 'MulterError') {
        let message = 'File upload error';
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File size exceeds limit';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            message = 'Too many files';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Unexpected file field';
        }

        res.status(400).json({
            error: 'UPLOAD_ERROR',
            message,
            request_id: requestId,
            timestamp,
        });
        return;
    }

    // Unknown error - don't leak internal details in production
    const isProduction = process.env.NODE_ENV === 'production';

    res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: isProduction ? 'An internal server error occurred' : err.message,
        request_id: requestId,
        timestamp,
        ...(isProduction ? {} : { stack: err.stack }),
    });
}

// ============================================================================
// NOT FOUND HANDLER
// ============================================================================

export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
        request_id: req.headers['x-request-id'] as string || uuidv4(),
        timestamp: new Date().toISOString(),
    });
}

// ============================================================================
// ASYNC WRAPPER (for route handlers)
// ============================================================================

export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}