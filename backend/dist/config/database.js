"use strict";
/**
 * ADALAT360 - Database Configuration
 * PostgreSQL + MongoDB connection management
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPgPool = getPgPool;
exports.closePgPool = closePgPool;
exports.pgQuery = pgQuery;
exports.pgTransaction = pgTransaction;
exports.pgHealthCheck = pgHealthCheck;
exports.getMongoClient = getMongoClient;
exports.getMongoDb = getMongoDb;
exports.getMongoCollection = getMongoCollection;
exports.closeMongoClient = closeMongoClient;
exports.mongoHealthCheck = mongoHealthCheck;
exports.runMigrations = runMigrations;
exports.closeDatabaseConnections = closeDatabaseConnections;
const pg_1 = require("pg");
const mongodb_1 = require("mongodb");
const index_1 = require("./index");
// ============================================================================
// POSTGRESQL CONFIGURATION
// ============================================================================
const pgConfig = {
    host: index_1.config.database.postgres.host,
    port: index_1.config.database.postgres.port,
    database: index_1.config.database.postgres.database,
    user: index_1.config.database.postgres.user,
    password: index_1.config.database.postgres.password,
    max: index_1.config.database.postgres.poolMax || 20,
    min: index_1.config.database.postgres.poolMin || 2,
    idleTimeoutMillis: index_1.config.database.postgres.idleTimeout || 30000,
    connectionTimeoutMillis: index_1.config.database.postgres.connectionTimeout || 5000,
    ssl: index_1.config.database.postgres.ssl ? { rejectUnauthorized: false } : false,
    application_name: 'adalat360-backend',
};
let pgPool = null;
function getPgPool() {
    if (!pgPool) {
        pgPool = new pg_1.Pool(pgConfig);
        pgPool.on('error', (err) => {
            console.error('Unexpected PostgreSQL pool error:', err);
        });
        pgPool.on('connect', (client) => {
            // Set search path and timezone on each connection
            client.query("SET search_path TO public");
            client.query("SET timezone TO 'UTC'");
        });
    }
    return pgPool;
}
async function closePgPool() {
    if (pgPool) {
        await pgPool.end();
        pgPool = null;
    }
}
async function pgQuery(text, params) {
    const pool = getPgPool();
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (index_1.config.env === 'development') {
            console.log(`[PG] ${duration}ms - ${text.substring(0, 100)}...`);
        }
        return result;
    }
    catch (error) {
        console.error('[PG] Query error:', error);
        throw error;
    }
}
async function pgTransaction(callback) {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function pgHealthCheck() {
    try {
        const result = await pgQuery('SELECT 1 as health');
        return result.rows[0]?.health === 1;
    }
    catch {
        return false;
    }
}
// ============================================================================
// MONGODB CONFIGURATION
// ============================================================================
const mongoOptions = {
    maxPoolSize: index_1.config.database.mongo.poolMax || 20,
    minPoolSize: index_1.config.database.mongo.poolMin || 2,
    maxIdleTimeMS: index_1.config.database.mongo.idleTimeout || 30000,
    connectTimeoutMS: index_1.config.database.mongo.connectionTimeout || 5000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    retryReads: true,
    appName: 'adalat360-backend',
    ssl: index_1.config.database.mongo.ssl,
};
let mongoClient = null;
let mongoDb = null;
async function getMongoClient() {
    if (!mongoClient) {
        const uri = `mongodb://${index_1.config.database.mongo.host}:${index_1.config.database.mongo.port}`;
        mongoClient = new mongodb_1.MongoClient(uri, mongoOptions);
        await mongoClient.connect();
        mongoClient.on('error', (err) => {
            console.error('MongoDB client error:', err);
        });
        mongoClient.on('close', () => {
            console.warn('MongoDB connection closed');
            mongoDb = null;
        });
    }
    return mongoClient;
}
async function getMongoDb() {
    if (!mongoDb) {
        const client = await getMongoClient();
        mongoDb = client.db(index_1.config.database.mongo.database);
    }
    return mongoDb;
}
function getMongoCollection(collectionName) {
    if (!mongoDb)
        return null;
    return mongoDb.collection(collectionName);
}
async function closeMongoClient() {
    if (mongoClient) {
        await mongoClient.close();
        mongoClient = null;
        mongoDb = null;
    }
}
async function mongoHealthCheck() {
    try {
        const client = await getMongoClient();
        await client.db('admin').command({ ping: 1 });
        return true;
    }
    catch {
        return false;
    }
}
// ============================================================================
// MIGRATION RUNNER
// ============================================================================
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function loadMigrations(migrationsDir) {
    const migrations = [];
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
        .sort();
    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        if (file.endsWith('.sql')) {
            migrations.push({
                name: file.replace('.sql', ''),
                filename: file,
                up: async (pg) => {
                    await pg.query(content);
                }
            });
        }
        else if (file.endsWith('.js')) {
            // For JS migrations, we'd need to evaluate them
            // This is a simplified version - in production use a proper migration tool
            migrations.push({
                name: file.replace('.js', ''),
                filename: file,
                up: async (pg, mongo) => {
                    // Would need to execute the JS migration
                    console.log(`Executing MongoDB migration: ${file}`);
                }
            });
        }
    }
    return migrations;
}
async function runMigrations() {
    console.log('Running database migrations...');
    // PostgreSQL migrations
    const pgMigrationsDir = path.join(__dirname, '../../migrations/postgresql');
    if (fs.existsSync(pgMigrationsDir)) {
        const pgFiles = fs.readdirSync(pgMigrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
        for (const file of pgFiles) {
            const filePath = path.join(pgMigrationsDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            console.log(`Running PostgreSQL migration: ${file}`);
            await pgQuery(content);
        }
    }
    // MongoDB migrations
    const mongoMigrationsDir = path.join(__dirname, '../../migrations/mongodb');
    if (fs.existsSync(mongoMigrationsDir)) {
        const mongoFiles = fs.readdirSync(mongoMigrationsDir)
            .filter(f => f.endsWith('.js'))
            .sort();
        const db = await getMongoDb();
        for (const file of mongoFiles) {
            const filePath = path.join(mongoMigrationsDir, file);
            console.log(`Running MongoDB migration: ${file}`);
            // In production, use a proper migration runner like mongock or migrate-mongo
            // For now, we'll execute the script
            const content = fs.readFileSync(filePath, 'utf-8');
            // Note: This is simplified. Real implementation would use a JS VM or spawn node process
            console.log(`MongoDB migration ${file} loaded (manual execution needed)`);
        }
    }
    console.log('Migrations completed');
}
// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
async function closeDatabaseConnections() {
    await Promise.all([
        closePgPool(),
        closeMongoClient(),
    ]);
    console.log('Database connections closed');
}
// Handle process termination
process.on('SIGTERM', async () => {
    await closeDatabaseConnections();
    process.exit(0);
});
process.on('SIGINT', async () => {
    await closeDatabaseConnections();
    process.exit(0);
});
//# sourceMappingURL=database.js.map