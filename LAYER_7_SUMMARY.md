# ADALAT360 - Layer 7 Complete: REST API Routes

## Summary

Layer 7 (REST API Routes) has been successfully implemented with comprehensive REST endpoints connecting all previous layers. The API provides role-based access control, case-scoped permissions, and full CRUD operations for all entities.

---

## Files Created

### Route Modules
| File | Description | Endpoints |
|------|-------------|-----------|
| `backend/src/routes/auth.routes.ts` | Authentication & MFA | `/auth/login`, `/auth/mfa/*`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/sessions`, `/auth/password/*` |
| `backend/src/routes/cases.routes.ts` | Case Management | `/cases`, `/cases/:id`, `/cases/:id/assignments`, `/cases/:id/stats` |
| `backend/src/routes/documents.routes.ts` | Document Management | `/documents/case/:caseId`, `/documents/:id`, `/documents/:id/versions`, `/documents/:id/download`, `/documents/export` |
| `backend/src/routes/evidence.routes.ts` | Evidence & Custody | `/evidence/case/:caseId`, `/evidence/:id`, `/evidence/:id/transfer`, `/evidence/:id/custody-chain`, `/evidence/:id/send-to-lab`, `/evidence/:id/lab-result`, `/evidence/:id/court-submission`, `/evidence/:id/dispose`, `/evidence/:id/qr-code` |
| `backend/src/routes/search.routes.ts` | Search API | `/search`, `/search/suggestions`, `/search/reindex/:caseId` |
| `backend/src/routes/blockchain.routes.ts` | Custody Ledger | `/blockchain/events`, `/blockchain/events/:txId`, `/blockchain/blocks/:blockNumber`, `/blockchain/blocks/latest`, `/blockchain/verify-chain`, `/blockchain/verify-full-chain`, `/blockchain/organizations`, `/blockchain/init-ledger` |
| `backend/src/routes/bsa.routes.ts` | BSA Section 63 | `/bsa/generate`, `/bsa/verify/:certNumber`, `/bsa/:id`, `/bsa/case/:caseId`, `/bsa/document/:docId`, `/bsa/:id/revoke`, `/bsa/:id/pdf` |
| `backend/src/routes/audit.routes.ts` | Audit & Compliance | `/audit`, `/audit/events/:id`, `/audit/user/:userId`, `/audit/resource/:type/:id`, `/audit/compliance-report`, `/audit/export`, `/audit/rti/:requestNumber`, `/audit/cleanup` |
| `backend/src/routes/admin.routes.ts` | System Admin | `/admin/users`, `/admin/users/:id`, `/admin/users/:id/role`, `/admin/users/:id/reset-password`, `/admin/config`, `/admin/blockchain/nodes`, `/admin/stats` |
| `backend/src/routes/rti.routes.ts` | RTI Requests | `/rti`, `/rti/:id`, `/rti/number/:requestNumber`, `/rti/:id/respond`, `/rti/:id/deny`, `/rti/:id/appeal`, `/rti/:id/assign` |
| `backend/src/routes/timeline.routes.ts` | Case Timeline | `/timeline/case/:caseId`, `/timeline/case/:caseId/export`, `/timeline/case/:caseId/analytics` |
| `backend/src/routes/entity-graph.routes.ts` | Entity Graphs | `/entity-graph/case/:caseId`, `/entity-graph/case/:caseId/path`, `/entity-graph/case/:caseId/central`, `/entity-graph/case/:caseId/communities` |

### Infrastructure
| File | Description |
|------|-------------|
| `backend/src/routes/api.router.ts` | Main API router aggregating all modules |
| `backend/src/middleware/error.middleware.ts` | Error handling with custom error classes |
| `backend/src/utils/logger.ts` | Winston logger with daily rotation |

---

## API Structure

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All endpoints (except `/auth/login`, `/auth/refresh`, `/bsa/verify/*`, `/rti/number/*`) require:
```
Authorization: Bearer <access_token>
```

### Rate Limiting
| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Global | 100 req | 15 min |
| Auth Login | 5 req | 15 min |
| Auth MFA | 10 req | 5 min |
| Document Upload | 20 req | 1 min |
| Search | 30 req | 1 min |
| Blockchain | 50 req | 1 min |
| BSA Generate | 10 req | 1 hour |
| RTI Create | 10 req | 1 hour |

---

## Role-Based Access Matrix

| Endpoint | INVESTIGATING_OFFICER | FORENSIC_LAB | PROSECUTOR | COURT | CENTRAL_ADMIN | AUDITOR |
|----------|----------------------|--------------|------------|-------|---------------|---------|
| Cases (own) | ✅ CRUD | ✅ R | ✅ R | ✅ R | ✅ CRUD | ✅ R |
| Documents (own cases) | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ R | ✅ CRUD | ✅ R |
| Evidence (own cases) | ✅ CRUD | ✅ CRUD | ✅ R | ✅ R | ✅ CRUD | ✅ R |
| Search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Blockchain Read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Blockchain Write | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| BSA Generate | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| BSA Verify | Public | Public | Public | Public | Public | Public |
| Audit Logs | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Admin Users | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| RTI (assigned) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timeline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Entity Graph | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Key Features

### Case-Scoped Access Control
Every resource access verified against user's case assignments:
```typescript
// Middleware chain on protected routes
authenticate → requireCaseAccess('caseId') → requireCasePermission('caseId', 'READ'|'WRITE'|'ADMIN')
```

### Blockchain Integration
- All custody events recorded on-chain via middleware
- Automatic event recording for: upload, access, transfer, version_create, redaction, export, etc.
- Chain verification endpoints for compliance

### BSA Section 63 Compliance
- Certificate generation restricted to Prosecutor/Court/Admin
- Public verification endpoint (no auth required)
- QR code with verification URL
- 10-year default validity

### RTI Workflow
- Public can file RTI requests
- Officers assigned can respond/deny
- Appeal workflow (First → Second)
- 30-day deadline tracking

### Audit & Compliance
- Comprehensive audit logging on all mutations
- Compliance reports with date filters
- Export to JSON/CSV for external auditors
- RTI-specific audit trails

---

## Request/Response Examples

### Login
```bash
POST /api/v1/auth/login
{
  "email": "officer.sharma@adalat360.gov.in",
  "password": "Test@123"
}

# Response with MFA required:
{
  "requires_mfa": true,
  "mfa_method": "totp",
  "user": { ... }
}
```

### MFA Verification
```bash
POST /api/v1/auth/mfa/verify
Header: x-mfa-token: <mfa_pending_token>
{
  "code": "123456",
  "type": "totp"
}

# Response:
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": { ... }
}
```

### Upload Document
```bash
POST /api/v1/documents
Headers: Authorization, Content-Type: multipart/form-data
Form Data:
- file: <binary>
- caseId: "uuid"
- title: "FIR Report"
- documentType: "FIR"
- tags: ["urgent", "cybercrime"]

# Response:
{
  "document": { "id": "...", "title": "FIR Report", ... },
  "version": { "version": 1, "file_hash_sha256": "..." },
  "custodyEvent": { "txId": "tx_...", "blockNumber": 12345 }
}
```

### Search
```bash
POST /api/v1/search
{
  "query": "murder weapon knife",
  "caseId": "uuid",
  "documentTypes": ["FIR", "EVIDENCE_RECORD"],
  "semanticSearch": true,
  "highlight": true
}

# Response:
{
  "results": [{ "title": "...", "snippet": "...", "highlights": {...}, "score": 0.95 }],
  "total": 42,
  "tookMs": 123
}
```

### Verify BSA Certificate
```bash
GET /api/v1/bsa/verify/BSA63/2024/CASEID/0001

# Response:
{
  "valid": true,
  "certificate": { ... },
  "verificationDetails": {
    "hashVerified": true,
    "chainVerified": true,
    "signatureVerified": true,
    "notExpired": true,
    "notRevoked": true
  }
}
```

---

## Error Handling

All errors follow consistent format:
```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "details": [...],  // for validation errors
  "request_id": "uuid",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Common error codes:
- `VALIDATION_ERROR` (400) - Request validation failed
- `UNAUTHORIZED` (401) - Missing/invalid token
- `FORBIDDEN` (403) - Insufficient permissions/case access
- `NOT_FOUND` (404) - Resource not found
- `CONFLICT` (409) - Duplicate resource
- `TOO_MANY_REQUESTS` (429) - Rate limited
- `INTERNAL_ERROR` (500) - Server error

---

## Next Layer

**Layer 8: Presentation Layer (React Frontend)**
- Role-based dashboards (Officer, Forensic, Court, Admin)
- Document viewer with OCR text highlighting
- Evidence custody chain visualization
- BSA certificate generator/verifier
- Search interface with filters
- Timeline visualization
- Entity graph explorer
- Admin panels