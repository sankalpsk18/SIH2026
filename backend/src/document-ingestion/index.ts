/**
 * ADALAT360 - Document Ingestion Module Index
 * Exports all document ingestion services and utilities
 */

export * from './ingestion.service.js';
export * from './ocr/ocr-service.js';
export * from './hashing/file-hasher.js';
export * from './metadata/entity-extractor.js';
export * from './versioning/version-manager.js';

// Re-export models
export * from '../../models/document.js';

// Re-export middleware
export { uploadMiddleware } from './ingestion.service.js';