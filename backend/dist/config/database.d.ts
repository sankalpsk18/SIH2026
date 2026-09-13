/**
 * ADALAT360 - Database Configuration
 * PostgreSQL + MongoDB connection management
 */
import { Pool, QueryResult } from 'pg';
import { MongoClient, Db, Collection } from 'mongodb';
export declare function getPgPool(): Pool;
export declare function closePgPool(): Promise<void>;
export declare function pgQuery<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
export declare function pgTransaction<T>(callback: (client: any) => Promise<T>): Promise<T>;
export declare function pgHealthCheck(): Promise<boolean>;
export declare function getMongoClient(): Promise<MongoClient>;
export declare function getMongoDb(): Promise<Db>;
export declare function getMongoCollection<T = any>(collectionName: string): Collection<T> | null;
export declare function closeMongoClient(): Promise<void>;
export declare function mongoHealthCheck(): Promise<boolean>;
export interface Migration {
    name: string;
    filename: string;
    up: (pg: Pool, mongo: Db) => Promise<void>;
    down?: (pg: Pool, mongo: Db) => Promise<void>;
}
export declare function runMigrations(): Promise<void>;
export declare function closeDatabaseConnections(): Promise<void>;
//# sourceMappingURL=database.d.ts.map