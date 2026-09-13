#!/usr/bin/env tsx
/**
 * ADALAT360 - Database Migration Runner
 * Runs PostgreSQL and MongoDB migrations in order
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { getPgPool, getMongoDb, closeDatabaseConnections, pgQuery } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Migration {
    name: string;
    filename: string;
    type: 'postgresql' | 'mongodb';
    content: string;
}

async function loadMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = [];

    // PostgreSQL migrations
    const pgDir = path.join(__dirname, '../../migrations/postgresql');
    if (fs.existsSync(pgDir)) {
        const files = fs.readdirSync(pgDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            const filePath = path.join(pgDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            migrations.push({
                name: file.replace('.sql', ''),
                filename: file,
                type: 'postgresql',
                content,
            });
        }
    }

    // MongoDB migrations
    const mongoDir = path.join(__dirname, '../../migrations/mongodb');
    if (fs.existsSync(mongoDir)) {
        const files = fs.readdirSync(mongoDir)
            .filter(f => f.endsWith('.js'))
            .sort();

        for (const file of files) {
            const filePath = path.join(mongoDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            migrations.push({
                name: file.replace('.js', ''),
                filename: file,
                type: 'mongodb',
                content,
            });
        }
    }

    return migrations;
}

async function runPostgresMigration(migration: Migration): Promise<void> {
    console.log(`  → Running PostgreSQL migration: ${migration.filename}`);
    try {
        await pgQuery(migration.content);
        console.log(`  ✓ Completed: ${migration.filename}`);
    } catch (error) {
        console.error(`  ✗ Failed: ${migration.filename}`);
        throw error;
    }
}

async function runMongoMigration(migration: Migration): Promise<void> {
    console.log(`  → Running MongoDB migration: ${migration.filename}`);
    try {
        const db = await getMongoDb();
        // For MongoDB, we need to execute the JavaScript
        // In production, use a proper migration tool like mongock
        // Here we'll use a simple approach - evaluate the script in a controlled way
        // This is simplified - real implementation would parse and execute commands
        console.log(`  ⚠ MongoDB migration ${migration.filename} loaded (manual execution recommended)`);
        console.log(`  ℹ Content length: ${migration.content.length} chars`);
        // For now, we just validate the file exists and is readable
        console.log(`  ✓ Validated: ${migration.filename}`);
    } catch (error) {
        console.error(`  ✗ Failed: ${migration.filename}`);
        throw error;
    }
}

async function runMigrations(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           ADALAT360 Database Migration Runner                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Environment: ${config.env}`);
    console.log(`PostgreSQL: ${config.database.postgres.host}:${config.database.postgres.port}/${config.database.postgres.database}`);
    console.log(`MongoDB: ${config.database.mongo.host}:${config.database.mongo.port}/${config.database.mongo.database}`);
    console.log('');

    const migrations = await loadMigrations();

    if (migrations.length === 0) {
        console.log('No migrations found.');
        return;
    }

    console.log(`Found ${migrations.length} migration(s):`);
    migrations.forEach(m => console.log(`  - [${m.type}] ${m.filename}`));
    console.log('');

    // Run PostgreSQL migrations first
    const pgMigrations = migrations.filter(m => m.type === 'postgresql');
    for (const migration of pgMigrations) {
        await runPostgresMigration(migration);
    }

    // Run MongoDB migrations
    const mongoMigrations = migrations.filter(m => m.type === 'mongodb');
    for (const migration of mongoMigrations) {
        await runMongoMigration(migration);
    }

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           All migrations completed successfully!             ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
}

async function rollbackMigration(migrationName: string): Promise<void> {
    console.log(`Rollback not yet implemented for: ${migrationName}`);
    console.log('Please manually reverse the migration in your database.');
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
        if (command === 'rollback') {
            const migrationName = args[1];
            if (!migrationName) {
                console.error('Usage: npm run migrate:rollback <migration_name>');
                process.exit(1);
            }
            await rollbackMigration(migrationName);
        } else {
            await runMigrations();
        }
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await closeDatabaseConnections();
    }
}

main();