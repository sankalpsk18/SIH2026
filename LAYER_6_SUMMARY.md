# ADALAT360 - Layer 6 Complete: Intelligence Layer

## Summary

Layer 6 (Intelligence Layer) has been successfully implemented with semantic search, case timeline reconstruction, BSA Section 63 certificate generation, and entity relationship graphs.

---

## Files Created

### Models
| File | Description |
|------|-------------|
| `backend/src/models/intelligence.ts` | TypeScript interfaces for search, timeline, BSA certificates, entity graphs |

### Search Service
| File | Description |
|------|-------------|
| `backend/src/intelligence/search/search.service.ts` | Permission-filtered keyword + semantic search |

### Timeline Service
| File | Description |
|------|-------------|
| `backend/src/intelligence/timeline/timeline.service.ts` | Chronological case timeline from custody ledger |

### BSA Certificate Service
| File | Description |
|------|-------------|
| `backend/src/intelligence/bsa-certificate/bsa-certificate.service.ts` | Section 63 certificate generation & verification |

### Entity Graph Service
| File | Description |
|------|-------------|
| `backend/src/intelligence/entity-graph/entity-graph.service.ts` | Entity relationship graphs with graph algorithms |

### Module Index
| File | Description |
|------|-------------|
| `backend/src/intelligence/index.ts` | Module exports |

---

## Search Service Features

### Permission-Filtered Search
- **Case-scoped**: Users only search within assigned cases
- **Role-aware**: Admins/Auditors search all cases
- **Multi-index**: Documents, Evidence, Custody Events, Cases

### Search Capabilities
| Feature | Implementation |
|---------|----------------|
| **Keyword Search** | PostgreSQL full-text search (tsvector/tsquery) |
| **Semantic Search** | Vector embeddings (extensible for pgvector/Pinecone/Weaviate) |
| **Filters** | Document type, evidence type, tags, dates, authors, entities |
| **Highlights** | `<mark>` tags for matched terms |
| **Suggestions** | Autocomplete from indexed titles |
| **Ranking** | TF-IDF + recency + relevance |

### Search API
```typescript
// POST /api/v1/search
{
  "query": "murder weapon knife",
  "caseId": "uuid",
  "documentTypes": ["FIR", "EVIDENCE_RECORD"],
  "tags": ["weapon", "forensic"],
  "entities": {
    "persons": ["John Doe"],
    "locations": ["Mumbai"]
  },
  "page": 1,
  "limit": 20,
  "semanticSearch": true,
  "highlight": true
}
```

---

## Timeline Service Features

### Chronological Reconstruction
- **Source**: Custody ledger events (blockchain-anchored)
- **Ordering**: By `tx_timestamp` (immutable)
- **Enrichment**: Actor details, resource links, blockchain proof

### Event Types Mapped
| Custody Action | Timeline Title |
|----------------|----------------|
| `UPLOAD` | "Document Uploaded: DOC/.../00001" |
| `VERSION_CREATE` | "New Version Created: v2 of DOC/..." |
| `ACCESS` | "Document Accessed: DOC/..." |
| `TRANSFER` | "Custody Transfer: Officer A → Lab B" |
| `SEIZURE` | "Evidence Seized: EVD/.../00042" |
| `ANALYSIS_START` | "Analysis Started: EVD/.../00042" |
| `ANALYSIS_COMPLETE` | "Analysis Completed: EVD/.../00042" |
| `COURT_SUBMISSION` | "Submitted to Court: DOC/..." |
| `REDACTION` | "Document Redacted: DOC/..." |
| `EXPORT` | "Document Exported: PDF" |

### Analytics
- **Event distribution** by type
- **Actor activity** breakdown
- **Monthly activity** heatmap
- **Top entities** (persons, orgs, locations)

---

## BSA Section 63 Certificate Service

### Legal Compliance (Bharatiya Sakshya Adhiniyam 2023)
> **Section 63**: Electronic records admissible as evidence if certified under prescribed conditions

### Certificate Contents (per Section 63)
| Subsection | Certificate Field |
|------------|-------------------|
| 63(1) | Computer output description, production process, responsible person |
| 63(2) | Conditions: regular use, proper operation, accurate reproduction |
| 63(3) | Certificate details: identifier, device particulars, procedure, signature |
| 63(4) | Evidence: hash verification, chain of custody, digital signatures |

### Certificate Generation Flow
```
1. Verify authority (Prosecutor/Court only)
2. Fetch document + custody chain
3. Compute file hash + metadata hash
4. Build certificate content (Section 63 template)
5. Generate certificate number: BSA63/2024/CASEID/0001
6. Create QR code with verification URL
7. Store in PostgreSQL + mirror to blockchain
8. Return certificate + PDF generation endpoint
```

### Verification Process
```typescript
// GET /api/v1/bsa/verify/:certificateNumber
{
  "valid": true,
  "verificationDetails": {
    "hashVerified": true,
    "chainVerified": true,
    "signatureVerified": true,
    "notExpired": true,
    "notRevoked": true,
    "details": []
  }
}
```

---

## Entity Graph Service Features

### Graph Construction
- **Nodes**: Persons, Organizations, Locations, Dates, Legal References, Documents, Evidence
- **Edges**: MENTIONED_IN, ASSOCIATED_WITH, CO_OCCURS_WITH
- **Weights**: Co-occurrence frequency across documents/evidence
- **Evidence**: Document/evidence IDs supporting each edge

### Graph Algorithms
| Algorithm | Use Case |
|-----------|----------|
| **BFS Shortest Path** | Find connection between two entities |
| **Degree Centrality** | Identify key persons/orgs in case |
| **Label Propagation** | Detect communities/clusters |
| **Co-occurrence** | Find entities appearing together |

### Example Graph Query
```typescript
// POST /api/v1/intelligence/entity-graph
{
  "caseId": "uuid",
  "entityTypes": ["PERSON", "ORGANIZATION", "LOCATION"],
  "minWeight": 2,
  "maxDepth": 3,
  "includeDocuments": true,
  "includeEvidence": true
}
```

---

## Integration with Previous Layers

### Layer 1 (Database)
- `search_index` table for keyword search
- `custody_ledger` for timeline events
- `bsa_certificates` for certificates
- `documents.extracted_entities` for entity graphs

### Layer 2 (Auth)
- Case-scoped search permissions
- Role-based timeline access
- Certificate issuance authority (Prosecutor/Court)

### Layer 3 (Blockchain)
- Timeline events sourced from custody ledger
- Certificate issuance recorded on-chain
- Chain of custody hash verified on-chain

### Layer 4 (Document Ingestion)
- OCR text → search index
- Entities extracted → entity graph
- New versions → timeline events

### Layer 5 (Storage)
- Hash verification for certificates
- Encrypted document retrieval for PDF generation

---

## Configuration

### Search Provider
```bash
SEARCH_PROVIDER=postgres          # postgres, meilisearch, elasticsearch, opensearch
MEILISEARCH_HOST=http://localhost:7700
ELASTICSEARCH_NODE=http://localhost:9200
```

### BSA Certificates
```bash
BSA_VALIDITY_DAYS=3650            # 10 years default
BSA_QR_SIZE=300                   # QR code dimensions
```

### Entity Extraction
```bash
FEATURE_ENTITY_EXTRACTION=true
NLP_MODEL=en_core_web_sm
```

---

## Next Layer

**Layer 7: REST API Routes**
- Tie all layers together into cohesive REST API
- Authentication, validation, error handling
- Role-based route groups
- API documentation (OpenAPI/Swagger)