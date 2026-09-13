/**
 * ADALAT360 - Search Service
 * Permission-filtered semantic search across authorized documents
 * Supports both keyword (Meilisearch/Elasticsearch) and vector similarity search
 */
import { SearchQuery, SearchResponse, EmbeddingRequest } from '../../models/intelligence.js';
export declare class SearchService {
    private initialized;
    private provider;
    initialize(): Promise<void>;
    private initMeilisearch;
    private initElasticsearch;
    private initOpenSearch;
    search(query: SearchQuery, userId: string, userRole: string, userCaseIds: string[]): Promise<SearchResponse>;
    private keywordSearch;
    private semanticSearch;
    generateEmbeddings(texts: string[], options?: EmbeddingRequest): Promise<number[][]>;
    private hashText;
    indexDocument(document: {
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
    }): Promise<void>;
    indexEvidence(evidence: {
        id: string;
        caseId: string;
        name: string;
        description: string;
        evidenceType: string;
        tags?: string[];
        entities?: Record<string, string[]>;
        accessRoles: string[];
        accessDepartments: string[];
    }): Promise<void>;
    indexCustodyEvent(event: {
        id: string;
        caseId: string;
        txType: string;
        actionDetails: Record<string, any>;
        actorUserId: string;
        timestamp: Date;
        accessRoles: string[];
    }): Promise<void>;
    removeFromIndex(resourceType: string, resourceId: string): Promise<void>;
    reindexCase(caseId: string): Promise<void>;
    private getSuggestions;
    private getAccessibleCaseIds;
    private generateSnippet;
    private applyHighlights;
    private highlightText;
    private escapeRegex;
}
export declare function getSearchService(): SearchService;
export declare function initializeSearch(): Promise<SearchService>;
//# sourceMappingURL=search.service.d.ts.map