.# ADALAT360 - Collaboration & Asset Lifecycle Additions Summary

## Summary

Two major additions have been implemented on top of the existing 8-layer architecture:

1. **Collaboration Features (Presentation Layer Extensions)** - Real-time case activity feed, handoff/assign actions with custody ledger integration
2. **Police Asset Lifecycle Management (New Layer 5.5)** - Explicit state machine for physical assets with maker-checker disposal, QR code lookup, and blockchain integration

---

## 1. Collaboration Features (Presentation Layer Extensions)

### 1.1 Case Activity Feed
- **Real-time feed** per case showing all custody-ledger events, comments, status changes
- **RBAC-filtered**: Only users assigned to the case can see the feed
- **Event types tracked**:
  - Custody events (upload, access, transfer, redaction, export, version create, etc.)
  - Comments and mentions
  - Status changes
  - Handoff events (initiated, accepted, declined, completed, cancelled)
  - Document/evidence lifecycle events
  - BSA certificate generation
  - RTI requests/responses
- **Queryable**: Filterable by type, actor, date range, visibility
- **Pagination**: Server-side pagination with sorting

### 1.2 Handoff / Assign-to-Stakeholder Actions
- **Any user with case-write permission** can hand off:
  - Entire case
  - Specific document
  - Specific evidence item
- **Workflow**:
  1. Initiator creates handoff → Creates **custody-ledger transaction** (TRANSFER)
  2. Receiving party must **explicitly accept** before responsibility transfers
  3. No silent reassignment - explicit acceptance required
  4. On acceptance: Auto-grants case assignment with WRITE permission
- **Expiry**: Configurable (default 24 hours), auto-expires if not acted upon
- **Notifications**: In-app + Email + SMS hooks on initiate, accept, decline, expiry
- **Audit trail**: All handoff events recorded in activity feed + blockchain

### 1.3 Comments & Threading
- Threaded comments on any activity feed entry
- @mentions with notifications
- Soft delete with audit trail

### 1.4 Notifications
- **Channels**: In-app, Email, SMS, Push
- **Types**: Handoff request/accepted/declined/expired, mentions, case updates, deadline reminders, disposal approvals
- **Priority levels**: LOW, NORMAL, HIGH, URGENT
- **Real-time**: Polling fallback via MongoDB, WebSocket-ready

### 1.5 Real-time Events
- MongoDB-backed event store for polling clients
- Event types: ACTIVITY_FEED_UPDATE, HANDOFF_UPDATE, NOTIFICATION
- WebSocket-ready architecture (Redis pub/sub ready)

---

## 2. Police Asset Lifecycle Management (Layer 5.5)

### 2.1 Explicit State Machine
```
SEIZED → STORED ↔ TRANSFERRED
                ↓
           DISPOSED (terminal)
                ↓
         REPORTED_LOST/DAMAGED
                ↓
           STORED (recovery/repair) or DISPOSED (legal)
```
**Valid transitions enforced server-side** - rejects invalid transitions

### 2.2 Asset States
- **SEIZED**: Initial seizure
- **STORED**: In secure storage
- **TRANSFERRED**: In transit/handover
- **DISPOSED**: Terminal state (legal disposal)
- **REPORTED_LOST**: Exception state (recoverable)
- **REPORTED_DAMAGED**: Exception state (repairable)

### 2.3 Asset Record
- **Asset ID**: Human-readable (AST/CASE/YYYY/NNNNN)
- **QR Code**: SHA-256 hash + verification URL
- **Core fields**: category, sub_category, weight, dimensions, photos, serial, manufacturer
- **Seizure details**: officer, location (GPS), panchnama, seizure memo
- **Custody chain**: current holder, location, seal status
- **Forensic/Court**: lab assignment, analysis, court exhibit
- **Disposal**: method, authorization, maker-checker
- **State history**: Full audit trail with blockchain TX IDs
- **Metadata & tags**: Flexible extensibility

### 2.4 Transition Validation
- **Server-side enforcement**: Rejects invalid transitions via PostgreSQL CHECK + application logic
- **Transition table**:
  - SEIZED → STORED
  - STORED → TRANSFERRED, DISPOSED, REPORTED_LOST, REPORTED_DAMAGED
  - TRANSFERRED → STORED, DISPOSED, REPORTED_LOST, REPORTED_DAMAGED
  - REPORTED_LOST → STORED (recovery), DISPOSED (legal)
  - REPORTED_DAMAGED → STORED (repair), DISPOSED (legal)
  - DISPOSED: Terminal (no transitions)

### 2.5 QR Code Lookup
- **QR payload**: Versioned JSON with asset_id, case_id, state, verify_url
- **Scan endpoint**: Returns full asset + state history + linked docs/evidence + custody ledger summary
- **Mobile-ready**: Responsive verification page

### 2.5 Disposal Maker-Checker (Two-Person Sign-Off)
1. **Initiator** creates disposal approval request with:
   - Disposal method
   - Authorization document reference
   - Designated approver (must be Admin/Auditor/Prosecutor/Court)
2. **Approver** receives notification → Approves/Rejects with reason
3. **Separation of duties**: Initiator ≠ Approver enforced
4. **Expiry**: 48-hour default, auto-expires
5. **Only after approval**: DISPOSED transition permitted

### 2.6 Blockchain Integration
- **Every state transition** = custody-ledger transaction (same ledger as documents)
- **Custody actions mapped**:
  - SEIZURE, TRANSFER, RECEIVE, DISPOSAL
- **Asset & document custody share same ledger** - unified audit trail
- **State history entries** include blockchain TX ID + block number

### 2.7 Asset Statistics
- **Per-case dashboard**: Total assets, by state, by category, by holder
- **Recent transitions** (24h)
- **Pending disposals** count
- **Overdue assets** (>90 days in STORED/TRANSFERRED)

---

## Database Changes

### PostgreSQL Migrations
| File | Tables Added |
|------|--------------|
| `003_collaboration_tables.sql` | activity_feed, handoffs, comments, notifications, realtime_events |
| `004_asset_lifecycle_tables.sql` | assets, asset_state_history, disposal_approvals |

**All tables with**:
- Row Level Security (RLS) policies
- Updated_at triggers
- Comprehensive indexes
- Foreign key constraints

### MongoDB Collections
| Collection | Purpose |
|------------|---------|
| activity_feed | Flexible activity queries |
| handoffs | Fast handoff lookups |
| comments | Threaded comments |
| notifications | User notifications |
| realtime_events | Polling fallback |
| assets | Flexible asset queries |
| asset_state_history | State history queries |
| disposal_approvals | Approval workflow |
| realtime_events | Real-time polling |

---

## API Endpoints Added

### Collaboration (`/api/v1/collaboration`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/activity-feed` | GET | Query activity feed with filters |
| `/activity-feed/:id` | GET | Get single activity |
| `/handoffs` | POST | Create handoff |
| `/handoffs` | GET | Query handoffs |
| `/handoffs/:id` | GET | Get handoff |
| `/handoffs/:id/action` | POST | Accept/Decline handoff |
| `/handoffs/:id/cancel` | POST | Cancel handoff |
| `/notifications` | GET | User notifications |
| `/notifications/:id/read` | POST | Mark read |
| `/comments` | POST | Add comment |
| `/activity-feed/:id/comments` | GET | Get comments |
| `/realtime/events` | GET | Poll for real-time events |
| `/handoffs/permissions/:caseId` | GET | Handoff permissions |
| `/activity-feed/permissions/:caseId` | GET | Activity feed permissions |

### Asset Lifecycle (`/api/v1/assets`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | POST | Create asset (seizure) |
| `/` | GET | List assets with filters |
| `/statistics` | GET | Asset statistics |
| `/:id` | GET | Get asset by UUID |
| `/by-asset-id/:id` | GET | Get asset by human-readable ID |
| `/qr/scan` | POST | Scan QR code |
| `/:id/qr-code` | GET | Get QR code |
| `/:id/transition` | POST | State transition |
| `/:id/history` | GET | State history |
| `/case/:caseId/statistics` | GET | Case asset stats |
| `/disposal-approvals` | POST | Request disposal approval |
| `/disposal-approvals/:id/action` | POST | Approve/Reject disposal |
| `/:id/state-history` | GET | Full state history |

---

## New Database Types Added

### PostgreSQL Enums
```sql
-- Collaboration
activity_type, activity_visibility, handoff_type, handoff_status, notification_type

-- Asset Lifecycle
asset_state, asset_category, asset_transition, disposal_approval_status
handoff_type, handoff_status, notification_type
```

### New Tables
| Table | Description |
|-------|-------------|
| `activity_feed` | Case activity feed with RBAC |
| `handoffs` | Handoff workflow with blockchain |
| `comments` | Threaded comments |
| `notifications` | Multi-channel notifications |
| `realtime_events` | Polling fallback |
| `assets` | Physical asset master |
| `asset_state_history` | Immutable state history |
| `disposal_approvals` | Maker-checker workflow |

---

## Frontend Components (Ready for Implementation)

### Collaboration Pages
- `CaseActivityFeed` - Real-time activity stream
- `HandoffManager` - Create/view/act on handoffs
- `NotificationCenter` - Unified notification inbox
- `CommentThread` - Threaded comments on activities

### Asset Lifecycle Pages
- `AssetList` - Filterable asset grid with QR badges
- `AssetDetail` - Full asset view with tabs (Details, History, QR, Custody)
- `AssetTransitionModal` - State transition with validation
- `DisposalApprovalWorkflow` - Maker-checker UI
- `QRScanner` - Mobile QR scan page
- `AssetStatisticsDashboard` - Visual analytics

---

## Key Architectural Decisions

1. **Single Custody Ledger**: Assets and documents share the same Hyperledger Fabric ledger
2. **Dual Database**: PostgreSQL for ACID/RLS, MongoDB for flexible queries
3. **RLS Everywhere**: Database-enforced case-scoped access
4. **Blockchain-First**: Every custody event = blockchain transaction
5. **Maker-Checker**: Enforced at database + application layer
6. **QR-First**: Every physical asset has verifiable QR code
7. **Event Sourcing**: Activity feed as event store for audit
6. **Maker-Checker**: Enforced at database + application layer
7. **QR-First**: Every physical asset has verifiable QR code
7. **Event Sourcing**: Activity feed as event store for audit

---

## To Run Migrations

```bash
cd backend
npm run migrate  # Runs all 4 PostgreSQL migrations + 2 MongoDB migrations
```

---

## Next Steps (Future Enhancements)

1. **WebSocket Server**: Replace polling with true WebSocket for real-time
2. **Mobile App**: React Native with QR scanner
3. **Advanced Analytics**: ML-based anomaly detection on asset movements
4. **Integration**: APIs for external forensic lab systems
5. **Bulk Operations**: CSV import/export for asset onboarding
6. **Digital Twin**: 3D visualization for high-value assets
7. **IoT Integration**: RFID/GPS tracking for real-time location