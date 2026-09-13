"use strict";
/**
 * ADALAT360 - Backend Application Entry Point
 * Secure Digital Document Management System for Legal & Investigation Documents
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.start = start;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const index_js_1 = require("./config/index.js");
const auth_middleware_js_1 = require("./middleware/auth/auth.middleware.js");
const database_js_1 = require("./config/database.js");
const session_service_js_1 = require("./services/session.service.js");
const api_router_js_1 = __importDefault(require("./routes/api.router.js"));
const error_middleware_js_1 = require("./middleware/error.middleware.js");
const logger_js_1 = require("./utils/logger.js");
// ============================================================================
// EXPRESS APP SETUP
// ============================================================================
const app = (0, express_1.default)();
exports.app = app;
// Trust proxy for correct IP detection behind load balancers
if (index_js_1.config.server.trustProxy) {
    app.set('trust proxy', 1);
}
// Security headers
app.use(auth_middleware_js_1.securityHeaders);
// Request ID middleware (must be first)
app.use(auth_middleware_js_1.requestIdMiddleware);
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// CORS
app.use((0, cors_1.default)({
    origin: index_js_1.config.server.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-MFA-Token'],
}));
// Helmet for additional security headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));
// Global rate limiting
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: index_js_1.config.rateLimit.windowMs,
    max: index_js_1.config.rateLimit.maxRequests,
    message: {
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || 'unknown',
    skip: (req) => req.path === '/api/v1/auth/health',
});
app.use(globalLimiter);
// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================
app.get('/health', async (req, res) => {
    const checks = await Promise.allSettled([
        (0, database_js_1.pgHealthCheck)(),
        (0, database_js_1.mongoHealthCheck)(),
        (0, session_service_js_1.sessionHealthCheck)(),
    ]);
    const results = {
        postgres: checks[0].status === 'fulfilled' && checks[0].value ? 'healthy' : 'unhealthy',
        mongodb: checks[1].status === 'fulfilled' && checks[1].value ? 'healthy' : 'unhealthy',
        redis: checks[2].status === 'fulfilled' && checks[2].value ? 'healthy' : 'unhealthy',
    };
    const allHealthy = Object.values(results).every(v => v === 'healthy');
    res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        service: 'adalat360-backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        checks: results,
    });
});
app.get('/health/live', (req, res) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
});
app.get('/health/ready', async (req, res) => {
    const pgHealthy = await (0, database_js_1.pgHealthCheck)();
    const mongoHealthy = await (0, database_js_1.mongoHealthCheck)();
    const redisHealthy = await (0, session_service_js_1.sessionHealthCheck)();
    if (pgHealthy && mongoHealthy && redisHealthy) {
        res.json({ status: 'ready', timestamp: new Date().toISOString() });
    }
    else {
        res.status(503).json({
            status: 'not ready',
            timestamp: new Date().toISOString(),
            checks: { postgres: pgHealthy, mongodb: mongoHealthy, redis: redisHealthy },
        });
    }
});
// ============================================================================
// API ROUTES
// ============================================================================
app.use(index_js_1.config.server.apiPrefix, api_router_js_1.default);
// ============================================================================
// ERROR HANDLING
// ============================================================================
app.use(error_middleware_js_1.notFoundHandler);
app.use(error_middleware_js_1.errorHandler);
// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
let server = null;
async function shutdown(signal) {
    logger_js_1.logger.info(`Received ${signal}, starting graceful shutdown...`);
    if (server) {
        server.close(async () => {
            logger_js_1.logger.info('HTTP server closed');
            await (0, database_js_1.closeDatabaseConnections)();
            await (0, session_service_js_1.closeRedisClient)();
            logger_js_1.logger.info('All connections closed');
            process.exit(0);
        });
        // Force close after 30 seconds
        setTimeout(() => {
            logger_js_1.logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 30000);
    }
    else {
        await (0, database_js_1.closeDatabaseConnections)();
        await (0, session_service_js_1.closeRedisClient)();
        process.exit(0);
    }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_js_1.logger.error('Uncaught exception:', error);
    shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
    logger_js_1.logger.error('Unhandled rejection:', reason);
    shutdown('unhandledRejection');
});
// ============================================================================
// START SERVER
// ============================================================================
async function start() {
    try {
        logger_js_1.logger.info('Starting ADALAT360 Backend...');
        logger_js_1.logger.info(`Environment: ${index_js_1.config.env}`);
        logger_js_1.logger.info(`Node.js: ${process.version}`);
        // Verify database connections
        const pgHealthy = await (0, database_js_1.pgHealthCheck)();
        const mongoHealthy = await (0, database_js_1.mongoHealthCheck)();
        const redisHealthy = await (0, session_service_js_1.sessionHealthCheck)();
        if (!pgHealthy) {
            logger_js_1.logger.warn('⚠️ PostgreSQL connection failed - some features will be unavailable');
        }
        if (!mongoHealthy) {
            logger_js_1.logger.warn('⚠️ MongoDB connection failed - some features will be unavailable');
        }
        if (!redisHealthy) {
            logger_js_1.logger.warn('⚠️ Redis connection failed - session management will be unavailable');
        }
        if (pgHealthy && mongoHealthy && redisHealthy) {
            logger_js_1.logger.info('All database connections verified');
        }
        else {
            logger_js_1.logger.warn('⚠️ Starting in degraded mode - not all databases are available');
        }
        server = app.listen(index_js_1.config.server.port, index_js_1.config.server.host, () => {
            logger_js_1.logger.info(`🚀 ADALAT360 Backend running on http://${index_js_1.config.server.host}:${index_js_1.config.server.port}`);
            logger_js_1.logger.info(`📚 API Base: ${index_js_1.config.server.apiPrefix}`);
            logger_js_1.logger.info(`🔒 Environment: ${index_js_1.config.env}`);
        });
    }
    catch (error) {
        logger_js_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Start if not in test mode
if (import.meta.url === `file://${process.argv[1]}`) {
    start();
}
//# sourceMappingURL=index.js.map