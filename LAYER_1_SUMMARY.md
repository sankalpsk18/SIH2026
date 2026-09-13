# ADALAT360 - Layer 1 Complete: Database Schema + Migrations

## Summary

Layer 1 (Database Schema + Migrations) has been successfully implemented with production-quality PostgreSQL and MongoDB schemas, migration runners, seeders, and connection management.

---

## Files Created

### PostgreSQL Migrations
| File | Description |
|------|-------------|
| `backend/migrations/postgresql/001_initial_schema.sql` | Complete schema with 20+ tables, enums, indexes, triggers |
| `backend/migrations/postgresql/002_rls_policies.sql` | Row Level Security policies with case-scoped access control |

### MongoDB Migrations
| File | Description |
|------|-------------|
| `backend/migrations/mongodb/001_initial_collections.js` | 10 collections with JSON schema validation, indexes, text search, TTL |

### Configuration & Connection Management
| File | Description |
|------|-------------|
| `backend/src/config/index.ts` | Central configuration with all env vars |
| `backend/src/config/database.ts` | PostgreSQL pool + MongoDB client with health checks |
| `backend/.env.example` | Complete environment template |

### Scripts
| File | Description |
|------|-------------|
| `backend/src/scripts/migrate.ts` | Migration runner for both databases |
| `backend/src/scripts/seed.ts` | Development seeder with test users, cases, nodes |
| `backend/src/scripts/db-check.ts` | Connection verification script |

### Project Setup
| File | Description |
|------|-------------|
| `backend/package.json` | Dependencies with all required packages |
| `backend/tsconfig.json` | TypeScript configuration with path aliases |

---

## PostgreSQL Schema Highlights

### Core Entities (15 tables)
- **users** - With MFA (TOTP), X.509 certs, RBAC roles
- **cases** - Full case lifecycle with IPC/BNS sections
- **case_assignments** - Many-to-many with permission arrays
- **documents** - Versioned, encrypted, OCR-ready
- **document_versions** - Immutable version history
- **evidence** - Physical + digital with QR codes
- **evidence_custody_chain** - Physical chain of custody

### Blockchain Custody Ledger (4 tables)
- **blockchain_nodes** - 4 org types: Officer, Forensic, Court, Audit
- **custody_ledger** - Mirrors Fabric ledger with consensus fields
- **blockchain_blocks** - Block headers for verification
- **digital_signatures** - DSC/Aadhaar eSign with PKI

### Security & Compliance (6 tables)
- **access_permissions** - Resource-level ACLs
- **audit_logs** - Immutable audit trail
- **bsa_certificates** - Section 63 certificates with QR
- **search_index** - Permission-filtered search metadata
- **rti_requests** - RTI workflow tracking
- **system_config** - Centralized configuration

### RLS Policies
- Case-scoped access: `user_has_case_access(case_id)` helper
- Role-based: Admin/Auditor see all; others see assigned only
- All policies enforce **case assignment + role** (never role alone)

---

## MongoDB Collections (10)

| Collection | Purpose |
|------------|---------|
| `document_metadata` | Rich OCR, entities, page-level data |
| `evidence_metadata` | Digital fingerprints (SHA256, SSDEEP, TLSH) |
| `custody_events` | Detailed blockchain event mirror |
| `audit_logs_detailed` | Full request/response, risk scoring, anomaly flags |
| `search_documents` | Vector-ready semantic search index |
| `bsa_certificates_metadata` | Certificate content + verification |
| `rti_requests_detailed` | Full RTI workflow with appeals |
| `system_config_mongo` | Runtime configuration |
| `anomaly_events` | SIEM-style anomaly detection |
| `notification_logs` | Multi-channel notifications |

### Indexes
- Compound indexes for query patterns
- Text search indexes with weighted fields
- TTL indexes for auto-cleanup (audit: 7yr, notifications: 1yr)

---

## Key Design Decisions

1. **Case-scoped RBAC at DB level** - RLS policies enforce case assignment
2. **Immutable versioning** - Documents never overwritten; new versions in `document_versions`
3. **Blockchain mirror** - PostgreSQL `custody_ledger` mirrors Fabric for fast queries
4. **Dual database strategy** - PostgreSQL for relational/ACID; MongoDB for flexible metadata/search
5. **PKI integration** - X.509 certs in users table, shared with Fabric identities
6. **BSA Section 63 ready** - Certificate table with hash chain + QR codes
7. **RTI compliant** - Full request/response workflow with appeals
8. **Anomaly detection built-in** - Dedicated table for SIEM integration

---

## To Run

```bash
cd backend
npm install
cp ../.env.example .env
# Edit .env with your values

# Check connections
npm run db:check

# Run migrations
npm run migrate

# Seed development data
npm run seed
```

---

## Next Layer

**Layer 2: Authentication & Access Control**
- JWT + Refresh tokens with rotation
- TOTP MFA (speakeasy)
- RBAC middleware with case-scope enforcement
- Session management with Redis
- Password policies, lockout, audit logging