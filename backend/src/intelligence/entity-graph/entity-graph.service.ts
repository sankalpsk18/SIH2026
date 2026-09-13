/**
 * ADALAT360 - Entity Graph Service
 * Builds relationship graphs from extracted entities across documents and evidence
 * Uses NetworkX-style graph algorithms for link analysis
 */

import { pgQuery } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import {
    EntityNode,
    EntityEdge,
    EntityGraph,
    EntityGraphOptions,
} from '../../models/intelligence.js';

// ============================================================================
// ENTITY GRAPH SERVICE CLASS
// ============================================================================

export class EntityGraphService {
    // ========================================================================
    // BUILD ENTITY GRAPH
    // ========================================================================

    async buildGraph(options: EntityGraphOptions): Promise<EntityGraph> {
        const { caseId, entityTypes, minWeight = 1, maxDepth = 3, includeDocuments = true, includeEvidence = true } = options;

        // Fetch all entities from documents
        const documentEntities = await this.fetchDocumentEntities(caseId, includeDocuments);
        const evidenceEntities = await this.fetchEvidenceEntities(caseId, includeEvidence);

        // Combine and deduplicate entities
        const entityMap = new Map<string, EntityNode>();
        const edgeMap = new Map<string, EntityEdge>();

        // Process document entities
        for (const doc of documentEntities) {
            this.processDocumentEntities(doc, entityMap, edgeMap, entityTypes);
        }

        // Process evidence entities
        for (const evi of evidenceEntities) {
            this.processEvidenceEntities(evi, entityMap, edgeMap, entityTypes);
        }

        // Filter by min weight
        const filteredEdges = Array.from(edgeMap.values()).filter(e => e.weight >= minWeight);

        // Build graph
        const nodes = Array.from(entityMap.values());
        const edges = filteredEdges;

        // Compute statistics
        const statistics = this.computeStatistics(nodes, edges);

        return {
            nodes,
            edges,
            caseId,
            generatedAt: new Date(),
            statistics,
        };
    }

    // ========================================================================
    // FETCH DOCUMENT ENTITIES
    // ========================================================================

    private async fetchDocumentEntities(caseId: string, include: boolean): Promise<Array<{
        id: string;
        title: string;
        documentNumber: string;
        entities: Record<string, string[]>;
    }>> {
        if (!include) return [];

        const result = await pgQuery(
            `SELECT id, title, document_number, extracted_entities
             FROM documents
             WHERE case_id = $1 AND deleted_at IS NULL AND is_latest_version = TRUE
             AND extracted_entities IS NOT NULL
             AND extracted_entities != '{}'`,
            [caseId]
        );

        return result.rows.map(row => ({
            id: row.id,
            title: row.title,
            documentNumber: row.document_number,
            entities: row.extracted_entities || {},
        }));
    }

    // ========================================================================
    // FETCH EVIDENCE ENTITIES
    // ========================================================================

    private async fetchEvidenceEntities(caseId: string, include: boolean): Promise<Array<{
        id: string;
        name: string;
        evidenceNumber: string;
        entities: Record<string, string[]>;
    }>> {
        if (!include) return [];

        const result = await pgQuery(
            `SELECT e.id, e.name, e.evidence_number, em.extracted_entities
             FROM evidence e
             LEFT JOIN evidence_metadata em ON em.evidence_id = e.id
             WHERE e.case_id = $1 AND e.deleted_at IS NULL
             AND em.extracted_entities IS NOT NULL`,
            [caseId]
        );

        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            evidenceNumber: row.evidence_number,
            entities: row.extracted_entities || {},
        }));
    }

    // ========================================================================
    // PROCESS DOCUMENT ENTITIES
    // ========================================================================

    private processDocumentEntities(
        doc: { id: string; title: string; documentNumber: string; entities: Record<string, string[]> },
        entityMap: Map<string, EntityNode>,
        edgeMap: Map<string, EntityEdge>,
        entityTypes?: EntityNode['type'][]
    ): void {
        const allowedTypes = entityTypes || ['PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'LEGAL_REFERENCE'];

        // Add document as a node
        const docNodeId = `doc:${doc.id}`;
        if (!entityMap.has(docNodeId)) {
            entityMap.set(docNodeId, {
                id: docNodeId,
                label: doc.title,
                type: 'DOCUMENT',
                properties: { documentNumber: doc.documentNumber, documentId: doc.id },
                caseId: '', // Will be set by caller
            });
        }

        // Process each entity type
        const typeMap: Record<string, EntityNode['type']> = {
            persons: 'PERSON',
            organizations: 'ORGANIZATION',
            locations: 'LOCATION',
            dates: 'DATE',
            case_numbers: 'LEGAL_REFERENCE',
            ipc_sections: 'LEGAL_REFERENCE',
            bns_sections: 'LEGAL_REFERENCE',
            phone_numbers: 'PERSON',
            email_addresses: 'PERSON',
            vehicle_numbers: 'EVIDENCE',
            aadhaar_numbers: 'PERSON',
            pan_numbers: 'PERSON',
            bank_accounts: 'ORGANIZATION',
        };

        for (const [entityKey, entityValues] of Object.entries(doc.entities)) {
            const nodeType = typeMap[entityKey];
            if (!nodeType || !allowedTypes.includes(nodeType)) continue;

            for (const value of entityValues) {
                if (!value || value.length < 2) continue;

                const entityId = `${nodeType.toLowerCase()}:${this.normalizeEntity(value)}`;

                // Add entity node
                if (!entityMap.has(entityId)) {
                    entityMap.set(entityId, {
                        id: entityId,
                        label: value,
                        type: nodeType,
                        properties: { originalValue: value },
                        caseId: '',
                    });
                }

                // Create edge: Document -> Entity (MENTIONED_IN)
                const edgeId = `${docNodeId}->${entityId}:MENTIONED_IN`;
                if (!edgeMap.has(edgeId)) {
                    edgeMap.set(edgeId, {
                        id: edgeId,
                        source: docNodeId,
                        target: entityId,
                        relationship: 'MENTIONED_IN',
                        weight: 1,
                        evidence: [doc.id],
                        caseId: '',
                    });
                } else {
                    // Increment weight
                    const edge = edgeMap.get(edgeId)!;
                    edge.weight++;
                    if (!edge.evidence.includes(doc.id)) {
                        edge.evidence.push(doc.id);
                    }
                }

                // Create co-occurrence edges between entities in same document
                this.createCoOccurrenceEdges(doc, doc.entities, entityKey, value, entityMap, edgeMap, nodeType);
            }
        }
    }

    // ========================================================================
    // PROCESS EVIDENCE ENTITIES
    // ========================================================================

    private processEvidenceEntities(
        evi: { id: string; name: string; evidenceNumber: string; entities: Record<string, string[]> },
        entityMap: Map<string, EntityNode>,
        edgeMap: Map<string, EntityEdge>,
        entityTypes?: EntityNode['type'][]
    ): void {
        const allowedTypes = entityTypes || ['PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'LEGAL_REFERENCE'];

        // Add evidence as a node
        const eviNodeId = `evi:${evi.id}`;
        if (!entityMap.has(eviNodeId)) {
            entityMap.set(eviNodeId, {
                id: eviNodeId,
                label: evi.name,
                type: 'EVIDENCE',
                properties: { evidenceNumber: evi.evidenceNumber, evidenceId: evi.id },
                caseId: '',
            });
        }

        // Similar processing as documents
        const typeMap: Record<string, EntityNode['type']> = {
            persons: 'PERSON',
            organizations: 'ORGANIZATION',
            locations: 'LOCATION',
            dates: 'DATE',
            case_numbers: 'LEGAL_REFERENCE',
            ipc_sections: 'LEGAL_REFERENCE',
            bns_sections: 'LEGAL_REFERENCE',
            phone_numbers: 'PERSON',
            email_addresses: 'PERSON',
            vehicle_numbers: 'EVIDENCE',
            aadhaar_numbers: 'PERSON',
            pan_numbers: 'PERSON',
            bank_accounts: 'ORGANIZATION',
        };

        for (const [entityKey, entityValues] of Object.entries(evi.entities)) {
            const nodeType = typeMap[entityKey];
            if (!nodeType || !allowedTypes.includes(nodeType)) continue;

            for (const value of entityValues) {
                if (!value || value.length < 2) continue;

                const entityId = `${nodeType.toLowerCase()}:${this.normalizeEntity(value)}`;

                if (!entityMap.has(entityId)) {
                    entityMap.set(entityId, {
                        id: entityId,
                        label: value,
                        type: nodeType,
                        properties: { originalValue: value },
                        caseId: '',
                    });
                }

                // Edge: Evidence -> Entity (ASSOCIATED_WITH)
                const edgeId = `${eviNodeId}->${entityId}:ASSOCIATED_WITH`;
                if (!edgeMap.has(edgeId)) {
                    edgeMap.set(edgeId, {
                        id: edgeId,
                        source: eviNodeId,
                        target: entityId,
                        relationship: 'ASSOCIATED_WITH',
                        weight: 1,
                        evidence: [evi.id],
                        caseId: '',
                    });
                } else {
                    const edge = edgeMap.get(edgeId)!;
                    edge.weight++;
                    if (!edge.evidence.includes(evi.id)) {
                        edge.evidence.push(evi.id);
                    }
                }

                this.createCoOccurrenceEdges(evi, evi.entities, entityKey, value, entityMap, edgeMap, nodeType);
            }
        }
    }

    // ========================================================================
    // CREATE CO-OCCURRENCE EDGES
    // ========================================================================

    private createCoOccurrenceEdges(
        resource: { id: string; entities: Record<string, string[]> },
        allEntities: Record<string, string[]>,
        currentEntityKey: string,
        currentValue: string,
        entityMap: Map<string, EntityNode>,
        edgeMap: Map<string, EntityEdge>,
        currentNodeType: EntityNode['type']
    ): void {
        const typeMap: Record<string, EntityNode['type']> = {
            persons: 'PERSON',
            organizations: 'ORGANIZATION',
            locations: 'LOCATION',
            dates: 'DATE',
            case_numbers: 'LEGAL_REFERENCE',
            ipc_sections: 'LEGAL_REFERENCE',
            bns_sections: 'LEGAL_REFERENCE',
            phone_numbers: 'PERSON',
            email_addresses: 'PERSON',
            vehicle_numbers: 'EVIDENCE',
            aadhaar_numbers: 'PERSON',
            pan_numbers: 'PERSON',
            bank_accounts: 'ORGANIZATION',
        };

        const currentEntityId = `${currentNodeType.toLowerCase()}:${this.normalizeEntity(currentValue)}`;

        // Connect to other entities in the same resource
        for (const [otherKey, otherValues] of Object.entries(allEntities)) {
            if (otherKey === currentEntityKey) continue;
            const otherType = typeMap[otherKey];
            if (!otherType) continue;

            for (const otherValue of otherValues) {
                if (!otherValue || otherValue.length < 2) continue;
                if (otherValue === currentValue) continue;

                const otherEntityId = `${otherType.toLowerCase()}:${this.normalizeEntity(otherValue)}`;

                // Create bidirectional co-occurrence edge
                const edgeId1 = `${currentEntityId}->${otherEntityId}:CO_OCCURS_WITH`;
                const edgeId2 = `${otherEntityId}->${currentEntityId}:CO_OCCURS_WITH`;

                for (const edgeId of [edgeId1, edgeId2]) {
                    if (!edgeMap.has(edgeId)) {
                        const [source, targetRel] = edgeId.split('->');
                        const [target, relationship] = targetRel.split(':');
                        edgeMap.set(edgeId, {
                            id: edgeId,
                            source,
                            target,
                            relationship,
                            weight: 1,
                            evidence: [resource.id],
                            caseId: '',
                        });
                    } else {
                        const edge = edgeMap.get(edgeId)!;
                        edge.weight++;
                        if (!edge.evidence.includes(resource.id)) {
                            edge.evidence.push(resource.id);
                        }
                    }
                }
            }
        }
    }

    // ========================================================================
    // NORMALIZE ENTITY
    // ========================================================================

    private normalizeEntity(value: string): string {
        return value
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 100);
    }

    // ========================================================================
    // COMPUTE STATISTICS
    // ========================================================================

    private computeStatistics(nodes: EntityNode[], edges: EntityEdge[]): EntityGraph['statistics'] {
        const byType: Record<string, number> = {};

        for (const node of nodes) {
            byType[node.type] = (byType[node.type] || 0) + 1;
        }

        return {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            byType,
        };
    }

    // ========================================================================
    // GRAPH ALGORITHMS
    // ========================================================================

    async findShortestPath(caseId: string, sourceEntity: string, targetEntity: string): Promise<EntityNode[] | null> {
        const graph = await this.buildGraph({ caseId, includeDocuments: true, includeEvidence: true });

        // Build adjacency list
        const adj = new Map<string, Set<string>>();
        for (const edge of graph.edges) {
            if (!adj.has(edge.source)) adj.set(edge.source, new Set());
            if (!adj.has(edge.target)) adj.set(edge.target, new Set());
            adj.get(edge.source)!.add(edge.target);
            adj.get(edge.target)!.add(edge.source); // Undirected for path finding
        }

        // BFS for shortest path
        const queue: Array<{ node: string; path: string[] }> = [{ node: sourceEntity, path: [sourceEntity] }];
        const visited = new Set<string>([sourceEntity]);

        while (queue.length > 0) {
            const { node, path } = queue.shift()!;

            if (node === targetEntity) {
                return path.map(id => graph.nodes.find(n => n.id === id)!).filter(Boolean);
            }

            for (const neighbor of adj.get(node) || []) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push({ node: neighbor, path: [...path, neighbor] });
                }
            }
        }

        return null;
    }

    async getCentralEntities(caseId: string, topN: number = 10): Promise<Array<{ entity: EntityNode; centrality: number }>> {
        const graph = await this.buildGraph({ caseId, includeDocuments: true, includeEvidence: true });

        // Degree centrality
        const degree = new Map<string, number>();
        for (const edge of graph.edges) {
            degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
            degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
        }

        const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
        return Array.from(degree.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([id, centrality]) => ({
                entity: nodeMap.get(id)!,
                centrality,
            }))
            .filter(x => x.entity);
    }

    async getCommunities(caseId: string): Promise<Array<EntityNode[]>> {
        const graph = await this.buildGraph({ caseId, includeDocuments: true, includeEvidence: true });

        // Simple label propagation community detection
        const labels = new Map<string, string>();
        for (const node of graph.nodes) {
            labels.set(node.id, node.id); // Initially each node is its own community
        }

        // Iterate label propagation
        for (let iter = 0; iter < 10; iter++) {
            for (const node of graph.nodes) {
                const neighbors = graph.edges
                    .filter(e => e.source === node.id || e.target === node.id)
                    .map(e => e.source === node.id ? e.target : e.source);

                const neighborLabels = neighbors.map(n => labels.get(n)!).filter(Boolean);
                if (neighborLabels.length > 0) {
                    // Most frequent label
                    const freq = new Map<string, number>();
                    for (const l of neighborLabels) {
                        freq.set(l, (freq.get(l) || 0) + 1);
                    }
                    const newLabel = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0][0];
                    labels.set(node.id, newLabel);
                }
            }
        }

        // Group by final labels
        const communities = new Map<string, EntityNode[]>();
        for (const node of graph.nodes) {
            const label = labels.get(node.id)!;
            if (!communities.has(label)) communities.set(label, []);
            communities.get(label)!.push(node);
        }

        return Array.from(communities.values()).filter(c => c.length > 1);
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let entityGraphServiceInstance: EntityGraphService | null = null;

export function getEntityGraphService(): EntityGraphService {
    if (!entityGraphServiceInstance) {
        entityGraphServiceInstance = new EntityGraphService();
    }
    return entityGraphServiceInstance;
}