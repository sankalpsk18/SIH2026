"use strict";
/**
 * ADALAT360 - Error Handling Middleware
 * Centralized error handling with proper logging and responses
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
exports.asyncHandler = asyncHandler;
const zod_1 = require("zod");
const logger_js_1 = require("../utils/logger.js");
const uuid_1 = require("uuid");
// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================
class AppError extends Error {
    statusCode;
    code;
    details;
    isOperational;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR', details);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'UNAUTHORIZED');
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, 'FORBIDDEN');
        Object.setPrototypeOf(this, AuthorizationError.prototype);
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT');
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends AppError {
    constructor(message = 'Too many requests', retryAfter) {
        super(message, 429, 'TOO_MANY_REQUESTS', { retryAfter });
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}
exports.RateLimitError = RateLimitError;
// ============================================================================
// ERROR HANDLER
// ============================================================================
async function errorHandler(err, req, res, next) {
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    const timestamp = new Date().toISOString();
    // Log error
    logger_js_1.logger.error({
        message: err.message,
        stack: err.stack,
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.auth?.sub,
        userRole: req.auth?.role,
    });
    // Handle known error types
    if (err instanceof AppError) {
        const response = {
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
    if (err instanceof zod_1.ZodError) {
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
        }
        else if (err.code === 'LIMIT_FILE_COUNT') {
            message = 'Too many files';
        }
        else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
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
function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
        request_id: req.headers['x-request-id'] || (0, uuid_1.v4)(),
        timestamp: new Date().toISOString(),
    });
}
// ============================================================================
// ASYNC WRAPPER (for route handlers)
// ============================================================================
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
//# sourceMappingURL=error.middleware.js.map