/**
 * ADALAT360 - Database Configuration
 * PostgreSQL + MongoDB connection management
 */

import { Pool, PoolConfig, QueryResult } from 'pg';
import { MongoClient, Db, Collection, MongoClientOptions } from 'mongodb';
import { config } from './index';

// ============================================================================
// POSTGRESQL CONFIGURATION
// ============================================================================

const pgConfig: PoolConfig = {
    host: config.database.postgres.host,
    port: config.database.postgres.port,
    database: config.database.postgres.database,
    user: config.database.postgres.user,
    password: config.database.postgres.password,
    max: config.database.postgres.poolMax || 20,
    min: config.database.postgres.poolMin || 2,
    idleTimeoutMillis: config.database.postgres.idleTimeout || 30000,
    connectionTimeoutMillis: config.database.postgres.connectionTimeout || 5000,
    ssl: config.database.postgres.ssl ? { rejectUnauthorized: false } : false,
    application_name: 'adalat360-backend',
};

let pgPool: Pool | null = null;

export function getPgPool(): Pool {
    if (!pgPool) {
        pgPool = new Pool(pgConfig);

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

export async function closePgPool(): Promise<void> {
    if (pgPool) {
        await pgPool.end();
        pgPool = null;
    }
}

export async function pgQuery<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const pool = getPgPool();
    const start = Date.now();
    try {
        const result = await pool.query<T>(text, params);
        const duration = Date.now() - start;
        if (config.env === 'development') {
            console.log(`[PG] ${duration}ms - ${text.substring(0, 100)}...`);
        }
        return result;
    } catch (error) {
        console.error('[PG] Query error:', error);
        throw error;
    }
}

export async function pgTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function pgHealthCheck(): Promise<boolean> {
    try {
        const result = await pgQuery('SELECT 1 as health');
        return result.rows[0]?.health === 1;
    } catch {
        return false;
    }
}

// ============================================================================
// MONGODB CONFIGURATION
// ============================================================================

const mongoOptions: MongoClientOptions = {
    maxPoolSize: config.database.mongo.poolMax || 20,
    minPoolSize: config.database.mongo.poolMin || 2,
    maxIdleTimeMS: config.database.mongo.idleTimeout || 30000,
    connectTimeoutMS: config.database.mongo.connectionTimeout || 5000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    retryReads: true,
    appName: 'adalat360-backend',
    ssl: config.database.mongo.ssl,
};

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

export async function getMongoClient(): Promise<MongoClient> {
    if (!mongoClient) {
        const uri = `mongodb://${config.database.mongo.host}:${config.database.mongo.port}`;
        mongoClient = new MongoClient(uri, mongoOptions);
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

export async function getMongoDb(): Promise<Db> {
    if (!mongoDb) {
        const client = await getMongoClient();
        mongoDb = client.db(config.database.mongo.database);
    }
    return mongoDb;
}

export function getMongoCollection<T = any>(collectionName: string): Collection<T> | null {
    if (!mongoDb) return null;
    return mongoDb.collection<T>(collectionName);
}

export async function closeMongoClient(): Promise<void> {
    if (mongoClient) {
        await mongoClient.close();
        mongoClient = null;
        mongoDb = null;
    }
}

export async function mongoHealthCheck(): Promise<boolean> {
    try {
        const client = await getMongoClient();
        await client.db('admin').command({ ping: 1 });
        return true;
    } catch {
        return false;
    }
}

// ============================================================================
// MIGRATION RUNNER
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

export interface Migration {
    name: string;
    filename: string;
    up: (pg: Pool, mongo: Db) => Promise<void>;
    down?: (pg: Pool, mongo: Db) => Promise<void>;
}

async function loadMigrations(migrationsDir: string): Promise<Migration[]> {
    const migrations: Migration[] = [];
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
                up: async (pg: Pool) => {
                    await pg.query(content);
                }
            });
        } else if (file.endsWith('.js')) {
            // For JS migrations, we'd need to evaluate them
            // This is a simplified version - in production use a proper migration tool
            migrations.push({
                name: file.replace('.js', ''),
                filename: file,
                up: async (pg: Pool, mongo: Db) => {
                    // Would need to execute the JS migration
                    console.log(`Executing MongoDB migration: ${file}`);
                }
            });
        }
    }

    return migrations;
}

export async function runMigrations(): Promise<void> {
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

export async function closeDatabaseConnections(): Promise<void> {
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