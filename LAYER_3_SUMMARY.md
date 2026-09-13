# ADALAT360 - Layer 3 Complete: Blockchain Custody Ledger Module

## Summary

Layer 3 (Blockchain Custody Ledger) has been successfully implemented with a complete Hyperledger Fabric integration including network configuration, chaincode (smart contract), and Node.js SDK wrapper with endorsement policy enforcement.

---

## Files Created

### Fabric Network Configuration
| File | Description |
|------|-------------|
| `backend/src/blockchain/fabric-config/connection-profile.json` | Complete connection profile for 4-organization network |

### Chaincode (Smart Contract)
| File | Description |
|------|-------------|
| `backend/src/blockchain/chaincode/custody-ledger.ts` | TypeScript chaincode with full custody ledger logic |

### Fabric SDK Wrapper
| File | Description |
|------|-------------|
| `backend/src/blockchain/fabric-sdk/fabric-client.ts` | Node.js client for Fabric interaction |

### High-Level Service
| File | Description |
|------|-------------|
| `backend/src/blockchain/blockchain.service.ts` | Application service with PostgreSQL mirroring |
| `backend/src/blockchain/index.ts` | Module exports |

---

## Hyperledger Fabric Network Architecture

### 4 Organizations (MSPs)
| Organization | MSP ID | Node Type | Peer Port | CA Port |
|--------------|--------|-----------|-----------|---------|
| Police Department | OfficerMSP | OFFICER_NODE | 7051 | 7054 |
| Forensic Laboratory | ForensicLabMSP | FORENSIC_LAB_NODE | 8051 | 8054 |
| Judiciary/Courts | CourtMSP | COURT_NODE | 9051 | 9054 |
| Central Audit | AuditMSP | CENTRAL_AUDIT_NODE | 10051 | 10054 |

### Channel & Chaincode
- **Channel**: `adalat360-channel`
- **Chaincode**: `custody-ledger` v1.0.0
- **Orderer**: `orderer0.adalat360.gov.in:7050`

### Endorsement Policy
```
AND('OfficerMSP.peer', 'ForensicLabMSP.peer')
```
**Requires**: At least one Officer node AND one Forensic Lab node must endorse every transaction. No single organization can unilaterally write history.

---

## Chaincode Functions

### Custody Event Recording
| Function | Description | Access |
|----------|-------------|--------|
| `recordCustodyEvent` | Record immutable custody event with endorsement | All orgs (per policy) |
| `queryCustodyEvent` | Query single event by TX ID | All orgs |
| `queryCustodyEventsByCase` | Get all events for a case | All orgs |
| `queryCustodyEventsByDocument` | Get all events for a document | All orgs |
| `queryCustodyEventsByEvidence` | Get all events for evidence | All orgs |

### Block Operations
| Function | Description |
|----------|-------------|
| `queryBlock` | Get block by number |
| `queryLatestBlock` | Get latest block header |
| `queryBlockRange` | Get range of blocks |
| `verifyChainIntegrity` | Cryptographic verification of chain |

### Digital Signatures (DSC/Aadhaar eSign)
| Function | Description |
|----------|-------------|
| `registerDigitalSignature` | Register PKI-backed signature |
| `queryDigitalSignature` | Retrieve signature |
| `verifyDigitalSignature` | Mark signature as verified |

### BSA Section 63 Certificates
| Function | Description | Access |
|----------|-------------|--------|
| `issueBSACertificate` | Issue court-admissible certificate | Prosecutor, Court only |
| `queryBSACertificate` | Retrieve certificate | All orgs |
| `queryBSACertificatesByCase` | Get all certificates for case | All orgs |

### Organization Management
| Function | Description | Access |
|----------|-------------|--------|
| `registerOrganization` | Add new organization | AuditMSP only |
| `queryOrganization` | Get org details | All orgs |
| `queryAllOrganizations` | List all orgs | All orgs |

---

## Key Security Features

### 1. Multi-Organization Consensus
- **No single writer**: Every transaction requires endorsement from Officer + Forensic Lab nodes
- **Policy enforced at commit time**: Fabric runtime validates endorsement policy
- **Audit nodes observe**: Court and Audit nodes receive all blocks but don't endorse by default

### 2. Immutable Ledger
- **Append-only**: Events never modified or deleted
- **Cryptographic chaining**: Each block links to previous via hash
- **Merkle trees**: Transaction integrity within blocks

### 3. PKI Identity
- **X.509 certificates**: Every user/org has certificate from their CA
- **Shared trust root**: Same PKI used for user auth (Layer 2) and Fabric identities
- **DSC/Aadhaar integration**: Digital signatures stored on-chain with certificate chains

### 4. Anti-Tampering Enforcement
```typescript
// Chaincode rejects any attempt to:
// - Overwrite existing event (key collision)
// - Backdate transactions (timestamp validation)
// - Modify block hashes (integrity verification)
// - Skip endorsement policy (Fabric runtime enforces)
```

---

## PostgreSQL Mirror (Query Performance)

The blockchain service mirrors all events to PostgreSQL `custody_ledger` table for:
- Fast indexed queries (by case, document, evidence, actor)
- Dashboard analytics without Fabric latency
- Compliance reporting
- Backup audit trail

**Sync Strategy**: Every `recordCustodyEvent` call writes to both Fabric and PostgreSQL atomically.

---

## BSA Section 63 Compliance

The chaincode implements BSA 63 certificate issuance with:
- Hash of original document (SHA-256)
- Complete chain of custody hash
- All custody event TX IDs referenced
- Digital signature of issuing authority
- QR code for verification
- 10-year validity period

---

## Integration Points

### From Layer 2 (Auth)
- User X.509 certificates → Fabric identities
- JWT session → Actor identification in custody events
- RBAC roles → Endorsement eligibility

### To Layer 4 (Document Ingestion)
- `UPLOAD` event recorded on document ingestion
- `VERSION_CREATE` on document updates
- `ACCESS` on document reads
- `REDACTION` on redaction operations

### To Layer 5 (Encrypted Storage)
- File hash recorded before encryption
- Encryption key ID referenced in event
- Storage path linked in action details

### To Layer 7 (Intelligence)
- Custody events feed timeline reconstruction
- Block hashes provide tamper evidence for certificates

---

## To Run (Development)

```bash
# 1. Start Fabric network (using Docker Compose)
cd fabric-network
docker-compose up -d

# 2. Deploy chaincode
./deploy-chaincode.sh

# 3. Enroll identities
npm run fabric:enroll

# 4. Configure .env
FABRIC_OFFICER_PEERS=localhost:7051
FABRIC_OFFICER_CA=http://localhost:7054
# ... etc

# 5. Start backend
cd backend
npm run dev
```

---

## Next Layer

**Layer 4: Document Ingestion & OCR/Hashing Pipeline**
- File upload with validation
- Tesseract OCR integration
- SHA-256 hashing
- Immutable versioning
- Metadata extraction
- Entity recognition (NLP)