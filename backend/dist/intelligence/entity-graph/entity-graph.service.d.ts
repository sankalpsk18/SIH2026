/**
 * ADALAT360 - Entity Graph Service
 * Builds relationship graphs from extracted entities across documents and evidence
 * Uses NetworkX-style graph algorithms for link analysis
 */
import { EntityNode, EntityGraph, EntityGraphOptions } from '../../models/intelligence.js';
export declare class EntityGraphService {
    buildGraph(options: EntityGraphOptions): Promise<EntityGraph>;
    private fetchDocumentEntities;
    private fetchEvidenceEntities;
    private processDocumentEntities;
    private processEvidenceEntities;
    private createCoOccurrenceEdges;
    private normalizeEntity;
    private computeStatistics;
    findShortestPath(caseId: string, sourceEntity: string, targetEntity: string): Promise<EntityNode[] | null>;
    getCentralEntities(caseId: string, topN?: number): Promise<Array<{
        entity: EntityNode;
        centrality: number;
    }>>;
    getCommunities(caseId: string): Promise<Array<EntityNode[]>>;
}
export declare function getEntityGraphService(): EntityGraphService;
//# sourceMappingURL=entity-graph.service.d.ts.map