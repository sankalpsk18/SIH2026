/**
 * ADALAT360 - Intelligence Models
 * TypeScript interfaces for search, timeline, and BSA certificates
 */
import { DocumentType, EvidenceType, CustodyAction } from '../types/database.js';
export interface SearchQuery {
    query: string;
    caseId?: string;
    documentTypes?: DocumentType[];
    evidenceTypes?: EvidenceType[];
    tags?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    authorIds?: string[];
    entities?: {
        persons?: string[];
        organizations?: string[];
        locations?: string[];
    };
    page: number;
    limit: number;
    semanticSearch?: boolean;
    highlight?: boolean;
}
export interface SearchResult {
    id: string;
    resourceType: 'DOCUMENT' | 'EVIDENCE' | 'CASE' | 'CUSTODY_EVENT';
    resourceId: string;
    caseId: string;
    title: string;
    snippet: string;
    highlights: Record<string, string[]>;
    score: number;
    metadata: {
        documentType?: DocumentType;
        evidenceType?: EvidenceType;
        version?: number;
        uploadedBy?: string;
        createdAt: Date;
        tags: string[];
        entities: Record<string, string[]>;
    };
    accessRoles: string[];
}
export interface SearchResponse {
    results: SearchResult[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    tookMs: number;
    query: string;
    suggestions?: string[];
}
export interface SemanticSearchOptions {
    model?: string;
    dimensions?: number;
    similarityThreshold?: number;
    maxResults?: number;
}
export interface VectorEmbedding {
    id: string;
    resourceType: string;
    resourceId: string;
    caseId: string;
    vector: number[];
    model: string;
    dimensions: number;
    textHash: string;
    createdAt: Date;
}
export interface EmbeddingRequest {
    texts: string[];
    model?: string;
    batchSize?: number;
}
export interface EmbeddingResponse {
    embeddings: number[][];
    model: string;
    dimensions: number;
    usage: {
        promptTokens: number;
        totalTokens: number;
    };
}
export interface TimelineEvent {
    id: string;
    caseId: string;
    timestamp: Date;
    eventType: CustodyAction;
    title: string;
    description: string;
    actor: {
        userId: string;
        name: string;
        role: string;
        department: string;
    };
    resources: {
        documents: Array<{
            id: string;
            title: string;
            version: number;
        }>;
        evidence: Array<{
            id: string;
            name: string;
            evidenceNumber: string;
        }>;
    };
    blockchain: {
        txId: string;
        blockNumber: number;
        blockHash: string;
        consensusStatus: string;
    };
    metadata: Record<string, any>;
}
export interface TimelineFilter {
    caseId: string;
    startDate?: Date;
    endDate?: Date;
    eventTypes?: CustodyAction[];
    actorIds?: string[];
    resourceIds?: string[];
    includeBlockchain: boolean;
}
export interface TimelineResponse {
    events: TimelineEvent[];
    total: number;
    dateRange: {
        start: Date;
        end: Date;
    };
    statistics: {
        byEventType: Record<string, number>;
        byActor: Record<string, number>;
        byMonth: Record<string, number>;
    };
}
export interface BSA63Certificate {
    id: string;
    certificateNumber: string;
    caseId: string;
    documentId: string;
    section: string;
    subsection?: string;
    certificateType: 'ELECTRONIC_RECORD' | 'DIGITAL_SIGNATURE' | 'COMPUTER_OUTPUT';
    issuedBy: string;
    issuedAt: Date;
    validFrom: Date;
    validUntil?: Date;
    status: 'DRAFT' | 'ISSUED' | 'VERIFIED' | 'REVOKED' | 'EXPIRED';
    hashAlgorithm: string;
    fileHash: string;
    fileSizeBytes: number;
    metadataHash: string;
    custodyLedgerTxIds: string[];
    chainOfCustodyHash: string;
    certificateContent: BSA63CertificateContent;
    digitalSignatureId?: string;
    qrCodeHash: string;
    qrCodeImageUrl?: string;
}
export interface BSA63CertificateContent {
    computerOutput: {
        description: string;
        producedBy: string;
        productionDate: Date;
        productionProcess: string;
        responsiblePerson: string;
        responsiblePersonRole: string;
    };
    conditions: {
        regularUse: boolean;
        properOperation: boolean;
        accurateReproduction: boolean;
        informationSupplied: boolean;
    };
    certificateDetails: {
        identifier: string;
        descriptionOfOutput: string;
        particularsOfDevice: string;
        particularsOfProcedure: string;
        signatureOfPerson: string;
        designationOfPerson: string;
    };
    evidence: {
        hashVerification: {
            algorithm: string;
            originalHash: string;
            verifiedHash: string;
            verifiedAt: Date;
            verifiedBy: string;
        };
        chainOfCustody: Array<{
            txId: string;
            timestamp: Date;
            action: string;
            actor: string;
            hash: string;
        }>;
        digitalSignatures: Array<{
            signatureId: string;
            signer: string;
            timestamp: Date;
            certificateSerial: string;
        }>;
    };
}
export interface BSA63CertificateRequest {
    caseId: string;
    documentId: string;
    section?: string;
    subsection?: string;
    certificateType?: string;
    issuedBy: string;
    validUntil?: Date;
    customContent?: Partial<BSA63CertificateContent>;
}
export interface BSA63CertificateResponse {
    certificate: BSA63Certificate;
    pdfUrl?: string;
    verificationUrl: string;
}
export interface EntityNode {
    id: string;
    label: string;
    type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'CASE' | 'DOCUMENT' | 'EVIDENCE' | 'DATE' | 'LEGAL_REFERENCE';
    properties: Record<string, any>;
    caseId: string;
}
export interface EntityEdge {
    id: string;
    source: string;
    target: string;
    relationship: string;
    weight: number;
    evidence: string[];
    caseId: string;
}
export interface EntityGraph {
    nodes: EntityNode[];
    edges: EntityEdge[];
    caseId: string;
    generatedAt: Date;
    statistics: {
        nodeCount: number;
        edgeCount: number;
        byType: Record<string, number>;
    };
}
export interface EntityGraphOptions {
    caseId: string;
    entityTypes?: EntityNode['type'][];
    minWeight?: number;
    maxDepth?: number;
    includeDocuments?: boolean;
    includeEvidence?: boolean;
}
export interface CaseAnalytics {
    caseId: string;
    documentCount: number;
    evidenceCount: number;
    custodyEventsCount: number;
    uniqueActors: number;
    timelineSpan: {
        start: Date;
        end: Date;
    };
    documentTypes: Record<string, number>;
    evidenceTypes: Record<string, number>;
    activityByMonth: Record<string, number>;
    activityByActor: Record<string, number>;
    topEntities: {
        persons: Array<{
            name: string;
            count: number;
        }>;
        organizations: Array<{
            name: string;
            count: number;
        }>;
        locations: Array<{
            name: string;
            count: number;
        }>;
    };
    blockchainStats: {
        totalBlocks: number;
        totalTransactions: number;
        avgBlockTime: number;
        consensusRate: number;
    };
}
export interface UserActivityReport {
    userId: string;
    period: {
        start: Date;
        end: Date;
    };
    actions: Array<{
        date: Date;
        action: string;
        resourceType: string;
        resourceId: string;
        caseId: string;
    }>;
    statistics: {
        totalActions: number;
        documentsAccessed: number;
        documentsUploaded: number;
        evidenceHandled: number;
        searchesPerformed: number;
    };
}
export interface AnomalyEvent {
    id: string;
    eventType: 'BULK_DOWNLOAD' | 'OFF_HOURS_ACCESS' | 'REPEATED_FAILED_AUTH' | 'UNUSUAL_LOCATION' | 'PRIVILEGE_ESCALATION' | 'DATA_EXFILTRATION' | 'SUSPICIOUS_QUERY' | 'CONCURRENT_SESSIONS' | 'RAPID_REQUESTS' | 'GEO_ANOMALY';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    userId: string;
    caseId?: string;
    description: string;
    details: Record<string, any>;
    baselineMetrics: Record<string, number>;
    currentMetrics: Record<string, number>;
    riskScore: number;
    status: 'OPEN' | 'INVESTIGATING' | 'FALSE_POSITIVE' | 'CONFIRMED' | 'RESOLVED';
    detectedAt: Date;
    assignedTo?: string;
    investigatedAt?: Date;
    resolutionNotes?: string;
}
export interface AnomalyRule {
    id: string;
    name: string;
    eventType: AnomalyEvent['eventType'];
    condition: string;
    threshold: number;
    windowMinutes: number;
    severity: AnomalyEvent['severity'];
    enabled: boolean;
    description: string;
}
//# sourceMappingURL=intelligence.d.ts.map