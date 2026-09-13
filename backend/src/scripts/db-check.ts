#!/usr/bin/env tsx
/**
 * ADALAT360 - Database Connection Check
 * Verifies connectivity to PostgreSQL and MongoDB
 */

import { config } from '../config/index.js';
import { pgHealthCheck, mongoHealthCheck, closeDatabaseConnections } from '../config/database.js';

async function checkConnections(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           ADALAT360 Database Connection Check                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Environment: ${config.env}`);
    console.log('');

    // Check PostgreSQL
    console.log('Checking PostgreSQL...');
    console.log(`  Host: ${config.database.postgres.host}:${config.database.postgres.port}`);
    console.log(`  Database: ${config.database.postgres.database}`);
    console.log(`  User: ${config.database.postgres.user}`);

    const pgHealthy = await pgHealthCheck();
    if (pgHealthy) {
        console.log('  ✓ PostgreSQL connection successful');
    } else {
        console.log('  ✗ PostgreSQL connection FAILED');
    }
    console.log('');

    // Check MongoDB
    console.log('Checking MongoDB...');
    console.log(`  Host: ${config.database.mongo.host}:${config.database.mongo.port}`);
    console.log(`  Database: ${config.database.mongo.database}`);

    const mongoHealthy = await mongoHealthCheck();
    if (mongoHealthy) {
        console.log('  ✓ MongoDB connection successful');
    } else {
        console.log('  ✗ MongoDB connection FAILED');
    }
    console.log('');

    // Summary
    console.log('╔══════════════════════════════════════════════════════════════╗');
    if (pgHealthy && mongoHealthy) {
        console.log('║           All database connections OK!                       ║');
    } else {
        console.log('║           Some database connections FAILED!                  ║');
    }
    console.log('╚══════════════════════════════════════════════════════════════╝');

    await closeDatabaseConnections();

    if (!pgHealthy || !mongoHealthy) {
        process.exit(1);
    }
}

checkConnections().catch(console.error);