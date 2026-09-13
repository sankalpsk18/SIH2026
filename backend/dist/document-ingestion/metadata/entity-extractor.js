"use strict";
/**
 * ADALAT360 - Entity Extraction Service
 * NLP-based entity recognition for legal documents
 * Uses compromise.js for lightweight NLP + custom patterns for Indian legal entities
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityExtractor = void 0;
exports.getEntityExtractor = getEntityExtractor;
exports.initializeEntityExtractor = initializeEntityExtractor;
const nlp = __importStar(require("compromise"));
const logger_js_1 = require("../../utils/logger.js");
// ============================================================================
// REGEX PATTERNS FOR INDIAN LEGAL ENTITIES
// ============================================================================
const PATTERNS = {
    // Indian phone numbers
    phone: /(?:\+91[\-\s]?)?(?:[6-9]\d{9}|[0-9]{2,4}[\-\s]?[0-9]{6,8})/g,
    // Email addresses
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    // Indian vehicle numbers (various formats)
    vehicle: /(?:[A-Z]{2}[\-\s]?[0-9]{1,2}[\-\s]?[A-Z]{1,2}[\-\s]?[0-9]{1,4})|(?:[A-Z]{2}[\-\s]?[0-9]{2}[\-\s]?[A-Z]{2}[\-\s]?[0-9]{4})/g,
    // Aadhaar numbers (12 digits, optionally spaced)
    aadhaar: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
    // PAN numbers (10 chars: 5 letters, 4 digits, 1 letter)
    pan: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    // Bank account numbers (9-18 digits)
    bankAccount: /\b\d{9,18}\b/g,
    // IFSC codes (11 chars: 4 letters, 0, 6 alphanumeric)
    ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    // Indian passport (1 letter + 7 digits)
    passport: /\b[A-Z]\d{7}\b/g,
    // Driving license (varies by state, typically 2 letters + 13 digits)
    drivingLicense: /\b[A-Z]{2}\d{13}\b/g,
    // Case numbers (common patterns)
    caseNumber: /\b(?:FIR|CR|CC|WP|CRL|CA|SA|RA|MA|BA|IA|TA|PA|FA|MA|EX|OB|GD|UD|PRC|GR|SC|ST|HC|MC|RC|CC|VC|AC|BC|DC|EC|FC|GC|HC|IC|JC|KC|LC|NC|PC|QC|RC|SC|TC|UC|VC|WC|XC|YC|ZC)[\/\-\s]?\d{1,6}[\/\-\s]?\d{2,4}\b/gi,
    // IPC sections
    ipcSection: /\b(?:Section|Sec\.?|s\.?)\s*(\d+[A-Z]?)\b/gi,
    // BNS sections (new Bharatiya Nyaya Sanhita)
    bnsSection: /\b(?:BNS|Section|Sec\.?)\s*(\d+[A-Z]?)\b/gi,
    // Dates (various formats)
    date: /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\.]\d{1,2}[\s\-\.]\d{2,4})\b/gi,
    // Money amounts (Indian format)
    money: /(?:Rs\.?|INR|₹)\s*\d+(?:,\d{3})*(?:\.\d{2})?/gi,
    // Court names
    court: /\b(?:Supreme Court|High Court|District Court|Sessions Court|Magistrate Court|Family Court|Consumer Court|Tribunal|Commission|Forum)\b/gi,
    // Police stations
    policeStation: /\b(?:Police Station|PS|Thana|Chowki)\s+[A-Za-z\s]+\b/gi,
    // FIR numbers
    firNumber: /\bFIR\s*(?:No\.?|Number)?[\s:\-]*\d{1,6}[\/\-\s]?\d{2,4}\b/gi,
    // Legal document references
    legalRef: /\b(?:Order|Judgment|Decree|Warrant|Summons|Notice|Affidavit|Petition|Application|Appeal|Revision|Review)\s+(?:No\.?|dated?)\s+\d+/gi,
};
const CUSTOM_ENTITIES = [
    { type: 'phone', pattern: PATTERNS.phone },
    { type: 'email', pattern: PATTERNS.email },
    { type: 'vehicle', pattern: PATTERNS.vehicle },
    { type: 'aadhaar', pattern: PATTERNS.aadhaar },
    { type: 'pan', pattern: PATTERNS.pan },
    { type: 'bankAccount', pattern: PATTERNS.bankAccount },
    { type: 'ifsc', pattern: PATTERNS.ifsc },
    { type: 'passport', pattern: PATTERNS.passport },
    { type: 'drivingLicense', pattern: PATTERNS.drivingLicense },
    { type: 'caseNumber', pattern: PATTERNS.caseNumber },
    { type: 'ipcSection', pattern: PATTERNS.ipcSection },
    { type: 'bnsSection', pattern: PATTERNS.bnsSection },
    { type: 'date', pattern: PATTERNS.date },
    { type: 'money', pattern: PATTERNS.money },
    { type: 'court', pattern: PATTERNS.court },
    { type: 'policeStation', pattern: PATTERNS.policeStation },
    { type: 'firNumber', pattern: PATTERNS.firNumber },
    { type: 'legalRef', pattern: PATTERNS.legalRef },
];
// ============================================================================
// ENTITY EXTRACTION SERVICE
// ============================================================================
class EntityExtractor {
    initialized = false;
    customPatterns = [];
    async initialize(options = {}) {
        if (this.initialized)
            return;
        try {
            // Add custom patterns
            this.customPatterns = [...CUSTOM_ENTITIES];
            if (options.custom_patterns) {
                for (const [type, pattern] of Object.entries(options.custom_patterns)) {
                    this.customPatterns.push({ type, pattern });
                }
            }
            // Load compromise with any custom plugins
            // compromise loads automatically
            this.initialized = true;
            logger_js_1.logger.info('Entity extractor initialized');
        }
        catch (error) {
            logger_js_1.logger.error('Failed to initialize entity extractor:', error);
            throw error;
        }
    }
    // ========================================================================
    // MAIN EXTRACTION METHOD
    // ========================================================================
    async extract(text, options = {}) {
        if (!this.initialized) {
            await this.initialize(options);
        }
        try {
            // Use compromise for NLP entities
            const doc = nlp(text);
            // Extract standard entities
            const persons = this.extractPersons(doc);
            const organizations = this.extractOrganizations(doc);
            const locations = this.extractLocations(doc);
            // Extract custom legal entities using regex
            const customEntities = this.extractCustomEntities(text);
            // Extract dates (combine NLP and regex)
            const dates = this.extractDates(doc, text);
            // Extract case numbers, sections, etc.
            const caseNumbers = this.extractCaseNumbers(text);
            const ipcSections = this.extractIpcSections(text);
            const bnsSections = this.extractBnsSections(text);
            // Build result
            const result = {
                persons: this.deduplicate(persons),
                organizations: this.deduplicate(organizations),
                locations: this.deduplicate(locations),
                dates: this.deduplicate(dates),
                case_numbers: this.deduplicate(caseNumbers),
                ipc_sections: this.deduplicate(ipcSections),
                bns_sections: this.deduplicate(bnsSections),
                phone_numbers: this.deduplicate(customEntities.phone || []),
                email_addresses: this.deduplicate(customEntities.email || []),
                vehicle_numbers: this.deduplicate(customEntities.vehicle || []),
                aadhaar_numbers: this.deduplicate(customEntities.aadhaar || []),
                pan_numbers: this.deduplicate(customEntities.pan || []),
                bank_accounts: this.deduplicate(customEntities.bankAccount || []),
                custom_entities: {},
            };
            // Add any additional custom entities
            for (const [key, value] of Object.entries(customEntities)) {
                if (!['phone', 'email', 'vehicle', 'aadhaar', 'pan', 'bankAccount', 'ifsc', 'passport', 'drivingLicense', 'caseNumber', 'ipcSection', 'bnsSection', 'date', 'money', 'court', 'policeStation', 'firNumber', 'legalRef'].includes(key)) {
                    result.custom_entities[key] = this.deduplicate(value);
                }
            }
            return result;
        }
        catch (error) {
            logger_js_1.logger.error('Entity extraction failed:', error);
            // Return empty result on failure
            return this.emptyEntities();
        }
    }
    // ========================================================================
    // PERSON EXTRACTION
    // ========================================================================
    extractPersons(doc) {
        const persons = [];
        // Get people from compromise
        const people = doc.people().out('array');
        for (const person of people) {
            // Clean up the name
            const clean = person.text.trim();
            if (clean.length > 1 && clean.length < 100) {
                persons.push(clean);
            }
        }
        // Also look for titles + names (Mr., Mrs., Dr., etc.)
        const titleMatches = doc.match('(#Title #FirstName+ #LastName+)').out('array');
        for (const match of titleMatches) {
            persons.push(match.text.trim());
        }
        return persons;
    }
    // ========================================================================
    // ORGANIZATION EXTRACTION
    // ========================================================================
    extractOrganizations(doc) {
        const orgs = [];
        // Get organizations from compromise
        const organizations = doc.organizations().out('array');
        for (const org of organizations) {
            const clean = org.text.trim();
            if (clean.length > 1 && clean.length < 150) {
                orgs.push(clean);
            }
        }
        // Look for government bodies
        const govMatches = doc.match('(Government|Ministry|Department|Police|Court|Tribunal|Commission|Board|Authority|Corporation|Institute|University|Hospital|Bank|Company|Limited|Pvt|Ltd|LLP)').out('array');
        for (const match of govMatches) {
            orgs.push(match.text.trim());
        }
        return orgs;
    }
    // ========================================================================
    // LOCATION EXTRACTION
    // ========================================================================
    extractLocations(doc) {
        const locations = [];
        // Get places from compromise
        const places = doc.places().out('array');
        for (const place of places) {
            const clean = place.text.trim();
            if (clean.length > 1 && clean.length < 100) {
                locations.push(clean);
            }
        }
        // Indian states and major cities (common ones)
        const indianPlaces = [
            'Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
            'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur',
            'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri',
            'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik',
            'Faridabad', 'Meerut', 'Rajkot', 'Kalyan', 'Vasai', 'Varanasi',
            'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Navi Mumbai',
            'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior',
            'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati',
            'Chandigarh', 'Solapur', 'Hubli', 'Mysore', 'Tiruchirappalli',
            'Bareilly', 'Aligarh', 'Tiruppur', 'Moradabad', 'Jalandhar',
            'Bhubaneswar', 'Salem', 'Warangal', 'Guntur', 'Bhiwandi', 'Saharanpur',
            'Gorakhpur', 'Bikaner', 'Amravati', 'Noida', 'Jamshedpur', 'Bhilai',
            'Cuttack', 'Firozabad', 'Kochi', 'Nellore', 'Bhavnagar', 'Dehradun',
            'Durgapur', 'Asansol', 'Rourkela', 'Nanded', 'Kolhapur', 'Ajmer',
            'Akola', 'Gulbarga', 'Jamnagar', 'Ujjain', 'Loni', 'Siliguri',
            'Jhansi', 'Ulhasnagar', 'Jammu', 'Sangli', 'Mangalore', 'Erode',
            'Belgaum', 'Ambattur', 'Tirunelveli', 'Malegaon', 'Gaya', 'Jalgaon',
            'Udaipur', 'Maheshtala', 'Davanagere', 'Kozhikode', 'Kurnool',
            'Rajpur Sonarpur', 'Bokaro', 'South Dumdum', 'Bellary', 'Patiala',
            'Gopalpur', 'Agartala', 'Bhagalpur', 'Muzaffarnagar', 'Rohtak',
            'Hospet', 'Hajipur', 'Bhuj', 'Baharampur', 'Kakinada', 'Nizamabad',
            'Karnal', 'Bharuch', 'Mujzaffarpur', 'Gandhinagar', 'Junagadh',
            'Mira Bhayandar', 'Mathura', 'Kadapa', 'Kolkata', 'Puducherry',
            'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
            'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
            'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
            'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
            'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        ];
        const lowerText = text.toLowerCase();
        for (const place of indianPlaces) {
            if (lowerText.includes(place.toLowerCase())) {
                locations.push(place);
            }
        }
        return locations;
    }
    // ========================================================================
    // CUSTOM ENTITY EXTRACTION (REGEX)
    // ========================================================================
    extractCustomEntities(text) {
        const result = {};
        for (const entity of this.customPatterns) {
            const matches = text.match(entity.pattern);
            if (matches) {
                const normalized = entity.normalize
                    ? matches.map(m => entity.normalize(m))
                    : matches;
                result[entity.type] = this.deduplicate(normalized);
            }
        }
        return result;
    }
    // ========================================================================
    // DATE EXTRACTION
    // ========================================================================
    extractDates(doc, text) {
        const dates = [];
        // NLP dates
        const nlpDates = doc.dates().out('array');
        for (const date of nlpDates) {
            dates.push(date.text.trim());
        }
        // Regex dates (more comprehensive)
        const regexDates = text.match(PATTERNS.date) || [];
        dates.push(...regexDates);
        return this.deduplicate(dates);
    }
    // ========================================================================
    // LEGAL-SPECIFIC EXTRACTION
    // ========================================================================
    extractCaseNumbers(text) {
        const matches = text.match(PATTERNS.caseNumber) || [];
        return this.deduplicate(matches.map(m => m.trim()));
    }
    extractIpcSections(text) {
        const matches = text.match(PATTERNS.ipcSection) || [];
        return this.deduplicate(matches.map(m => {
            const num = m.match(/\d+[A-Z]?/);
            return num ? `IPC ${num[0]}` : m;
        }));
    }
    extractBnsSections(text) {
        const matches = text.match(PATTERNS.bnsSection) || [];
        return this.deduplicate(matches.map(m => {
            const num = m.match(/\d+[A-Z]?/);
            return num ? `BNS ${num[0]}` : m;
        }));
    }
    // ========================================================================
    // UTILITY METHODS
    // ========================================================================
    deduplicate(arr) {
        // Case-insensitive deduplication while preserving original case
        const seen = new Set();
        return arr.filter(item => {
            const lower = item.toLowerCase();
            if (seen.has(lower))
                return false;
            seen.add(lower);
            return true;
        });
    }
    emptyEntities() {
        return {
            persons: [],
            organizations: [],
            locations: [],
            dates: [],
            case_numbers: [],
            ipc_sections: [],
            bns_sections: [],
            phone_numbers: [],
            email_addresses: [],
            vehicle_numbers: [],
            aadhaar_numbers: [],
            pan_numbers: [],
            bank_accounts: [],
            custom_entities: {},
        };
    }
    // ========================================================================
    // RELATIONSHIP EXTRACTION (bonus)
    // ========================================================================
    async extractRelationships(text) {
        const doc = nlp(text);
        const relationships = [];
        // Simple SVO (Subject-Verb-Object) extraction
        const sentences = doc.sentences().out('array');
        for (const sentence of sentences) {
            const sentDoc = nlp(sentence.text);
            const verbs = sentDoc.verbs().out('array');
            const subjects = sentDoc.nouns().out('array');
            const objects = sentDoc.nouns().out('array');
            // This is simplified - real implementation would use dependency parsing
            if (verbs.length > 0 && subjects.length > 0 && objects.length > 1) {
                relationships.push({
                    subject: subjects[0].text,
                    predicate: verbs[0].text,
                    object: objects[1].text,
                    confidence: 0.6,
                });
            }
        }
        return relationships;
    }
}
exports.EntityExtractor = EntityExtractor;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let entityExtractorInstance = null;
function getEntityExtractor() {
    if (!entityExtractorInstance) {
        entityExtractorInstance = new EntityExtractor();
    }
    return entityExtractorInstance;
}
async function initializeEntityExtractor(options) {
    const extractor = getEntityExtractor();
    await extractor.initialize(options);
    return extractor;
}
//# sourceMappingURL=entity-extractor.js.map