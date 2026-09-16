/**
 * ADALAT360 - Backend Application Entry Point
 * Secure Digital Document Management System for Legal & Investigation Documents
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '@config/index.js';
import { requestIdMiddleware, securityHeaders } from '@middleware/auth/auth.middleware.js';
import { closeDatabaseConnections, pgHealthCheck, mongoHealthCheck } from '@config/database.js';
import { closeRedisClient, sessionHealthCheck } from '@services/session.service.js';
import apiRouter from '@routes/api.router.js';
import { errorHandler, notFoundHandler } from '@middleware/error.middleware.js';
import { logger } from '@utils/logger.js';

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();

// Trust proxy for correct IP detection behind load balancers
if (config.server.trustProxy) {
    app.set('trust proxy', 1);
}

// Security headers
app.use(securityHeaders);

// Request ID middleware (must be first)
app.use(requestIdMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
app.use(cors({
    origin: config.server.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-MFA-Token'],
}));

// Helmet for additional security headers
app.use(helmet({
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
const globalLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
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
        pgHealthCheck(),
        mongoHealthCheck(),
        sessionHealthCheck(),
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
    const pgHealthy = await pgHealthCheck();
    const mongoHealthy = await mongoHealthCheck();
    const redisHealthy = await sessionHealthCheck();

    if (pgHealthy && mongoHealthy && redisHealthy) {
        res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } else {
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

// apiRouter already includes config.server.apiPrefix on each route.
app.use('/', apiRouter);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

let server: ReturnType<typeof app.listen> | null = null;

async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    if (server) {
        server.close(async () => {
            logger.info('HTTP server closed');
            await closeDatabaseConnections();
            await closeRedisClient();
            logger.info('All connections closed');
            process.exit(0);
        });

        // Force close after 30 seconds
        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 30000);
    } else {
        await closeDatabaseConnections();
        await closeRedisClient();
        process.exit(0);
    }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
    shutdown('unhandledRejection');
});

// ============================================================================
// START SERVER
// ============================================================================

async function start(): Promise<void> {
    try {
        logger.info('Starting ADALAT360 Backend...');
        logger.info(`Environment: ${config.env}`);
        logger.info(`Node.js: ${process.version}`);

        // Verify database connections
        const pgHealthy = await pgHealthCheck();
        const mongoHealthy = await mongoHealthCheck();
        const redisHealthy = await sessionHealthCheck();

        if (!pgHealthy) {
            logger.warn('⚠️ PostgreSQL connection failed - some features will be unavailable');
        }
        if (!mongoHealthy) {
            logger.warn('⚠️ MongoDB connection failed - some features will be unavailable');
        }
        if (!redisHealthy) {
            logger.warn('⚠️ Redis connection failed - session management will be unavailable');
        }

        if (pgHealthy && mongoHealthy && redisHealthy) {
            logger.info('All database connections verified');
        } else {
            logger.warn('⚠️ Starting in degraded mode - not all databases are available');
        }

        server = app.listen(config.server.port, config.server.host, () => {
            logger.info(`🚀 ADALAT360 Backend running on http://${config.server.host}:${config.server.port}`);
            logger.info(`📚 API Base: ${config.server.apiPrefix}`);
            logger.info(`🔒 Environment: ${config.env}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Export for testing
export { app, start };

// Start the server outside test runs. The explicit test guard also works on Windows,
// where the executable path does not match the URL string format above.
if (process.env.NODE_ENV !== 'test') {
    start();
}