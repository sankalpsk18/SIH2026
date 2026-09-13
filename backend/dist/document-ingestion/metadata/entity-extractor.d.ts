/**
 * ADALAT360 - Entity Extraction Service
 * NLP-based entity recognition for legal documents
 * Uses compromise.js for lightweight NLP + custom patterns for Indian legal entities
 */
import { ExtractedEntities, EntityExtractionOptions } from '../../models/document.js';
export declare class EntityExtractor {
    private initialized;
    private customPatterns;
    initialize(options?: EntityExtractionOptions): Promise<void>;
    extract(text: string, options?: EntityExtractionOptions): Promise<ExtractedEntities>;
    private extractPersons;
    private extractOrganizations;
    private extractLocations;
    private extractCustomEntities;
    private extractDates;
    private extractCaseNumbers;
    private extractIpcSections;
    private extractBnsSections;
    private deduplicate;
    private emptyEntities;
    extractRelationships(text: string): Promise<Array<{
        subject: string;
        predicate: string;
        object: string;
        confidence: number;
    }>>;
}
export declare function getEntityExtractor(): EntityExtractor;
export declare function initializeEntityExtractor(options?: EntityExtractionOptions): Promise<EntityExtractor>;
//# sourceMappingURL=entity-extractor.d.ts.map