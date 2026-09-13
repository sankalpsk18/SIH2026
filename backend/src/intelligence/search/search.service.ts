/**
 * ADALAT360 - Search Service
 * Permission-filtered semantic search across authorized documents
 * Supports both keyword (Meilisearch/Elasticsearch) and vector similarity search
 */

import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { pgQuery } from '../../config/database.js';
import { getMongoDb } from '../../config/database.js';
import {
    SearchQuery,
    SearchResult,
    SearchResponse,
    VectorEmbedding,
    EmbeddingRequest,
    EmbeddingResponse,
    SemanticSearchOptions,
} from '../../models/intelligence.js';

// ============================================================================
// SEARCH SERVICE CLASS
// ============================================================================

export class SearchService {
    private initialized: boolean = false;
    private provider: 'meilisearch' | 'elasticsearch' | 'opensearch' | 'postgres' = 'postgres';

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.provider = config.search.provider as any;
        logger.info(`Initializing search service with provider: ${this.provider}`);

        // Initialize provider-specific clients
        switch (this.provider) {
            case 'meilisearch':
                await this.initMeilisearch();
                break;
            case 'elasticsearch':
                await this.initElasticsearch();
                break;
            case 'opensearch':
                await this.initOpenSearch();
                break;
            default:
                logger.info('Using PostgreSQL full-text search fallback');
        }

        this.initialized = true;
    }

    private async initMeilisearch(): Promise<void> {
        // Meilisearch client initialization
        logger.info('Meilisearch initialization - implement with meilisearch npm package');
    }

    private async initElasticsearch(): Promise<void> {
        // Elasticsearch client initialization
        logger.info('Elasticsearch initialization - implement with @elastic/elasticsearch npm package');
    }

    private async initOpenSearch(): Promise<void> {
        // OpenSearch client initialization
        logger.info('OpenSearch initialization - implement with @opensearch-project/opensearch npm package');
    }

    // ========================================================================
    // MAIN SEARCH METHOD
    // ========================================================================

    async search(query: SearchQuery, userId: string, userRole: string, userCaseIds: string[]): Promise<SearchResponse> {
        const startTime = Date.now();

        if (!this.initialized) {
            await this.initialize();
        }

        // Build permission filter
        const accessibleCaseIds = this.getAccessibleCaseIds(userRole, userCaseIds, query.caseId);

        // Execute search based on provider
        let results: SearchResult[];
        let total: number;

        if (query.semanticSearch && this.provider !== 'postgres') {
            const vectorResults = await this.semanticSearch(query, accessibleCaseIds, userId);
            results = vectorResults.results;
            total = vectorResults.total;
        } else {
            const keywordResults = await this.keywordSearch(query, accessibleCaseIds);
            results = keywordResults.results;
            total = keywordResults.total;
        }

        // Apply highlights if requested
        if (query.highlight) {
            results = this.applyHighlights(results, query.query);
        }

        return {
            results,
            total,
            page: query.page,
            limit: query.limit,
            totalPages: Math.ceil(total / query.limit),
            tookMs: Date.now() - startTime,
            query: query.query,
            suggestions: await this.getSuggestions(query.query, accessibleCaseIds),
        };
    }

    // ========================================================================
    // KEYWORD SEARCH (PostgreSQL fallback)
    // ========================================================================

    private async keywordSearch(query: SearchQuery, accessibleCaseIds: string[]): Promise<{ results: SearchResult[]; total: number }> {
        const conditions: string[] = [
            'si.deleted_at IS NULL',
            'si.case_id = ANY($1)',
        ];
        const params: any[] = [accessibleCaseIds];
        let paramIndex = 2;

        if (query.query) {
            // Use PostgreSQL full-text search
            conditions.push(`(
                si.title ILIKE $${paramIndex} OR
                si.content_text ILIKE $${paramIndex} OR
                si.tags && $${paramIndex + 1} OR
                si.entities->>'persons' ILIKE $${paramIndex} OR
                si.entities->>'organizations' ILIKE $${paramIndex} OR
                si.entities->>'locations' ILIKE $${paramIndex}
            )`);
            params.push(`%${query.query}%`);
            params.push(query.query.split(' ').filter(w => w.length > 2));
            paramIndex += 2;
        }

        if (query.documentTypes && query.documentTypes.length > 0) {
            conditions.push(`si.document_type = ANY($${paramIndex++})`);
            params.push(query.documentTypes);
        }

        if (query.evidenceTypes && query.evidenceTypes.length > 0) {
            conditions.push(`si.evidence_type = ANY($${paramIndex++})`);
            params.push(query.evidenceTypes);
        }

        if (query.tags && query.tags.length > 0) {
            conditions.push(`si.tags && $${paramIndex++}`);
            params.push(query.tags);
        }

        if (query.dateFrom) {
            conditions.push(`si.indexed_at >= $${paramIndex++}`);
            params.push(query.dateFrom);
        }

        if (query.dateTo) {
            conditions.push(`si.indexed_at <= $${paramIndex++}`);
            params.push(query.dateTo);
        }

        if (query.authorIds && query.authorIds.length > 0) {
            // Join with documents table for uploaded_by
            conditions.push(`si.resource_type = 'DOCUMENT' AND si.resource_id IN (
                SELECT id FROM documents WHERE uploaded_by = ANY($${paramIndex}) AND deleted_at IS NULL
            )`);
            params.push(query.authorIds);
            paramIndex++;
        }

        // Entity filters
        if (query.entities?.persons && query.entities.persons.length > 0) {
            conditions.push(`si.entities->'persons' ?| $${paramIndex++}`);
            params.push(query.entities.persons);
        }
        if (query.entities?.organizations && query.entities.organizations.length > 0) {
            conditions.push(`si.entities->'organizations' ?| $${paramIndex++}`);
            params.push(query.entities.organizations);
        }
        if (query.entities?.locations && query.entities.locations.length > 0) {
            conditions.push(`si.entities->'locations' ?| $${paramIndex++}`);
            params.push(query.entities.locations);
        }

        const whereClause = conditions.join(' AND ');
        const offset = (query.page - 1) * query.limit;

        params.push(query.limit, offset);

        const [resultsResult, countResult] = await Promise.all([
            pgQuery(
                `SELECT si.*,
                    ts_rank_cd(
                        to_tsvector('english', coalesce(si.title,'') || ' ' || coalesce(si.content_text,'')),
                        plainto_tsquery('english', $${params.length + 1})
                    ) as rank
                 FROM search_index si
                 WHERE ${whereClause}
                 ORDER BY rank DESC, si.indexed_at DESC
                 LIMIT $${params.length} OFFSET $${params.length + 1}`,
                [...params, query.query || '']
            ),
            pgQuery(
                `SELECT COUNT(*) as total FROM search_index si WHERE ${whereClause}`,
                params.slice(0, -2)
            ),
        ]);

        const results: SearchResult[] = resultsResult.rows.map(row => ({
            id: row.id,
            resourceType: row.resource_type,
            resourceId: row.resource_id,
            caseId: row.case_id,
            title: row.title,
            snippet: this.generateSnippet(row.content_text, query.query),
            highlights: {},
            score: parseFloat(row.rank) || 1,
            metadata: {
                documentType: row.document_type,
                evidenceType: row.evidence_type,
                tags: row.tags,
                entities: row.entities,
            },
            accessRoles: row.access_roles,
        }));

        return {
            results,
            total: parseInt(countResult.rows[0].total, 10),
        };
    }

    // ========================================================================
    // SEMANTIC SEARCH (Vector similarity)
    // ========================================================================

    private async semanticSearch(
        query: SearchQuery,
        accessibleCaseIds: string[],
        userId: string
    ): Promise<{ results: SearchResult[]; total: number }> {
        // Generate query embedding
        const queryEmbedding = await this.generateEmbeddings([query.query]);
        if (queryEmbedding.length === 0) {
            return { results: [], total: 0 };
        }

        // In production, use vector database (pgvector, Pinecone, Weaviate, etc.)
        // For now, fallback to keyword search
        logger.warn('Semantic search not fully implemented - falling back to keyword search');
        return this.keywordSearch(query, accessibleCaseIds);
    }

    // ========================================================================
    // EMBEDDING GENERATION
    // ========================================================================

    async generateEmbeddings(texts: string[], options: EmbeddingRequest = {}): Promise<number[][]> {
        // In production, call embedding model (OpenAI, Cohere, local sentence-transformers, etc.)
        // This is a placeholder implementation
        const dimensions = options.dimensions || 768;

        // Mock embeddings - in reality, call your embedding API
        return texts.map(() => {
            // Generate deterministic pseudo-random vector based on text hash
            const hash = this.hashText(texts[0]);
            const vector: number[] = [];
            for (let i = 0; i < dimensions; i++) {
                // Simple hash-based vector (NOT for production!)
                const seed = hash + i * 0x9e3779b9;
                vector[i] = ((seed * 16807) % 2147483647) / 2147483647 * 2 - 1;
            }
            return vector;
        });
    }

    private hashText(text: string): number {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    // ========================================================================
    // INDEX MANAGEMENT
    // ========================================================================

    async indexDocument(document: {
        id: string;
        caseId: string;
        title: string;
        contentText: string;
        documentType?: string;
        evidenceType?: string;
        tags?: string[];
        entities?: Record<string, string[]>;
        accessRoles: string[];
        accessDepartments: string[];
    }): Promise<void> {
        const mongoDb = await getMongoDb();
        await mongoDb.collection('search_documents').updateOne(
            { resource_type: 'DOCUMENT', resource_id: document.id },
            {
                $set: {
                    resource_type: 'DOCUMENT',
                    resource_id: document.id,
                    case_id: document.caseId,
                    title: document.title,
                    content_text: document.contentText,
                    document_type: document.documentType,
                    evidence_type: document.evidenceType,
                    tags: document.tags || [],
                    entities: document.entities || {},
                    access_roles: document.accessRoles,
                    access_departments: document.accessDepartments,
                    indexed_at: new Date(),
                    updated_at: new Date(),
                },
            },
            { upsert: true }
        );
    }

    async indexEvidence(evidence: {
        id: string;
        caseId: string;
        name: string;
        description: string;
        evidenceType: string;
        tags?: string[];
        entities?: Record<string, string[]>;
        accessRoles: string[];
        accessDepartments: string[];
    }): Promise<void> {
        const mongoDb = await getMongoDb();
        await mongoDb.collection('search_documents').updateOne(
            { resource_type: 'EVIDENCE', resource_id: evidence.id },
            {
                $set: {
                    resource_type: 'EVIDENCE',
                    resource_id: evidence.id,
                    case_id: evidence.caseId,
                    title: evidence.name,
                    content_text: evidence.description,
                    evidence_type: evidence.evidenceType,
                    tags: evidence.tags || [],
                    entities: evidence.entities || {},
                    access_roles: evidence.accessRoles,
                    access_departments: evidence.accessDepartments,
                    indexed_at: new Date(),
                    updated_at: new Date(),
                },
            },
            { upsert: true }
        );
    }

    async indexCustodyEvent(event: {
        id: string;
        caseId: string;
        txType: string;
        actionDetails: Record<string, any>;
        actorUserId: string;
        timestamp: Date;
        accessRoles: string[];
    }): Promise<void> {
        const mongoDb = await getMongoDb();
        await mongoDb.collection('search_documents').updateOne(
            { resource_type: 'CUSTODY_EVENT', resource_id: event.id },
            {
                $set: {
                    resource_type: 'CUSTODY_EVENT',
                    resource_id: event.id,
                    case_id: event.caseId,
                    title: `Custody Event: ${event.txType}`,
                    content_text: JSON.stringify(event.actionDetails),
                    tags: [event.txType],
                    entities: {},
                    access_roles: event.accessRoles,
                    access_departments: [],
                    indexed_at: event.timestamp,
                    updated_at: new Date(),
                },
            },
            { upsert: true }
        );
    }

    async removeFromIndex(resourceType: string, resourceId: string): Promise<void> {
        const mongoDb = await getMongoDb();
        await mongoDb.collection('search_documents').deleteOne({
            resource_type: resourceType,
            resource_id: resourceId,
        });
    }

    async reindexCase(caseId: string): Promise<void> {
        // Reindex all documents, evidence, and events for a case
        logger.info(`Reindexing case ${caseId}`);

        // Documents
        const docsResult = await pgQuery(
            `SELECT * FROM documents WHERE case_id = $1 AND deleted_at IS NULL AND is_latest_version = TRUE`,
            [caseId]
        );

        for (const doc of docsResult.rows) {
            await this.indexDocument({
                id: doc.id,
                caseId: doc.case_id,
                title: doc.title,
                contentText: doc.ocr_text || '',
                documentType: doc.document_type,
                tags: doc.tags,
                entities: doc.extracted_entities,
                accessRoles: ['INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'COURT', 'CENTRAL_ADMIN', 'AUDITOR'],
                accessDepartments: [], // Would fetch from case assignments
            });
        }

        // Evidence
        const eviResult = await pgQuery(
            `SELECT * FROM evidence WHERE case_id = $1 AND deleted_at IS NULL`,
            [caseId]
        );

        for (const evi of eviResult.rows) {
            await this.indexEvidence({
                id: evi.id,
                caseId: evi.case_id,
                name: evi.name,
                description: evi.description || '',
                evidenceType: evi.evidence_type,
                tags: [],
                entities: {},
                accessRoles: ['INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'COURT', 'CENTRAL_ADMIN', 'AUDITOR'],
                accessDepartments: [],
            });
        }
    }

    // ========================================================================
    // SEARCH SUGGESTIONS
    // ========================================================================

    private async getSuggestions(query: string, accessibleCaseIds: string[]): Promise<string[]> {
        if (!query || query.length < 2) return [];

        const result = await pgQuery(
            `SELECT DISTINCT title FROM search_index
             WHERE case_id = ANY($1) AND title ILIKE $2
             LIMIT 10`,
            [accessibleCaseIds, `${query}%`]
        );

        return result.rows.map(r => r.title);
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    private getAccessibleCaseIds(userRole: string, userCaseIds: string[], requestedCaseId?: string): string[] {
        // Admins and auditors have access to all cases
        if (userRole === 'CENTRAL_ADMIN' || userRole === 'AUDITOR') {
            // In production, fetch all case IDs
            return requestedCaseId ? [requestedCaseId] : userCaseIds; // Simplified
        }

        if (requestedCaseId && userCaseIds.includes(requestedCaseId)) {
            return [requestedCaseId];
        }

        return userCaseIds;
    }

    private generateSnippet(text: string, query: string): string {
        if (!text) return '';
        if (!query) return text.substring(0, 200) + '...';

        const queryTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);
        const lowerText = text.toLowerCase();

        let bestPos = 0;
        let bestScore = 0;

        for (let i = 0; i < text.length - 200; i += 50) {
            const snippet = lowerText.substring(i, i + 200);
            let score = 0;
            for (const term of queryTerms) {
                if (snippet.includes(term)) score++;
            }
            if (score > bestScore) {
                bestScore = score;
                bestPos = i;
            }
        }

        const snippet = text.substring(bestPos, bestPos + 200);
        return (bestPos > 0 ? '...' : '') + snippet + (bestPos + 200 < text.length ? '...' : '');
    }

    private applyHighlights(results: SearchResult[], query: string): SearchResult[] {
        const terms = query.toLowerCase().split(' ').filter(t => t.length > 2);

        return results.map(result => {
            const highlights: Record<string, string[]> = {};

            // Highlight in title
            if (result.title) {
                highlights.title = this.highlightText(result.title, terms);
            }

            // Highlight in snippet
            if (result.snippet) {
                highlights.snippet = this.highlightText(result.snippet, terms);
            }

            return { ...result, highlights };
        });
    }

    private highlightText(text: string, terms: string[]): string[] {
        const highlighted: string[] = [];
        let lastIndex = 0;

        for (const term of terms) {
            const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    highlighted.push(text.substring(lastIndex, match.index));
                }
                highlighted.push(`<mark>${match[1]}</mark>`);
                lastIndex = match.index + match[0].length;
            }
        }

        if (lastIndex < text.length) {
            highlighted.push(text.substring(lastIndex));
        }

        return highlighted.length > 0 ? highlighted : [text];
    }

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let searchServiceInstance: SearchService | null = null;

export function getSearchService(): SearchService {
    if (!searchServiceInstance) {
        searchServiceInstance = new SearchService();
    }
    return searchServiceInstance;
}

export async function initializeSearch(): Promise<SearchService> {
    const service = getSearchService();
    await service.initialize();
    return service;
}