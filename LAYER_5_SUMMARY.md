# ADALAT360 - Layer 5 Complete: Encrypted Storage Layer

## Summary

Layer 5 (Encrypted Storage Layer) has been successfully implemented with AES-256-GCM envelope encryption, KMS/HSM abstraction supporting multiple providers (Local, AWS KMS, Azure Key Vault, GCP KMS, HashiCorp Vault), and S3/MinIO integration.

---

## Files Created

### Models
| File | Description |
|------|-------------|
| `backend/src/models/storage.ts` | TypeScript interfaces for encryption, storage, KMS, envelope encryption |

### KMS (Key Management Service)
| File | Description |
|------|-------------|
| `backend/src/storage/kms/kms.service.ts` | KMS abstraction with 5 providers |

### Storage Service
| File | Description |
|------|-------------|
| `backend/src/storage/storage.service.ts` | S3/MinIO integration with envelope encryption |
| `backend/src/storage/index.ts` | Module exports |

---

## KMS Providers Implemented

| Provider | Status | Features |
|----------|--------|----------|
| **Local** | ✅ Complete | Development/testing, AES-256-GCM, key rotation, key lifecycle |
| **AWS KMS** | ✅ Complete | Full AWS SDK v3 integration, automatic rotation, key policies |
| **Azure Key Vault** | 🔄 Placeholder | Interface defined, ready for implementation |
| **GCP KMS** | 🔄 Placeholder | Interface defined, ready for implementation |
| **HashiCorp Vault** | 🔄 Placeholder | Interface defined, ready for implementation |

### Local KMS Features
- Master key derivation from config
- Data Encryption Key (DEK) generation with envelope encryption
- Key wrapping using master key
- Key rotation with versioning
- Key lifecycle: ACTIVE → DISABLED → PENDING_DELETION → DELETED
- Scheduled deletion with configurable window
- Deletion cancellation

### AWS KMS Features
- Native AWS KMS encryption/decryption
- GenerateDataKey for envelope encryption
- Automatic key rotation (annual)
- Key creation with tags
- Key state management
- Scheduled deletion (7-30 days)
- IAM integration for access control

---

## Envelope Encryption Architecture

```
┌─────────────────────────────────────────────────────────────────┐
                        ENVELOPE ENCRYPTION
└─────────────────────────────────────────────────────────────────┘

  Plaintext Document
        │
        ▼
  ┌─────────────┐     1. KMS generates random DEK (32 bytes)
  │   KMS       │◄──────────────────────────────────────┐
  │  (DEK Gen)  │                                     │
  └──────┬──────┘                                     │
         │ Plaintext DEK                              │
         ▼                                            │
  ┌─────────────┐     2. Encrypt document with DEK   │
  │  AES-256-   │     (AES-256-GCM, random 96-bit IV) │
  │   GCM       │◄────────────────────────────────────┘
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐     3. Wrap DEK with KMS master key
  │   KMS       │◄─────────────────────────────────────┐
  │ (Key Wrap)  │                                      │
  └──────┬──────┘                                      │
         │ Encrypted DEK                               │
         ▼                                             │
  ┌──────────────────────────────────────────────────┐ │
  │           STORED IN S3/MINIO                     │ │
  │  • Encrypted Document (ciphertext)               │ │
  │  • Encrypted DEK (wrapped key)                   │ │
  │  • IV (96-bit, base64 in metadata)               │ │
  │  • Auth Tag (128-bit, base64 in metadata)        │ │
  │  • Key ID reference                              │ │
  │  • Algorithm identifier                          │ │
  └──────────────────────────────────────────────────┘ │
                                                       │
                    KMS MASTER KEY ───────────────────┘
                    (Never leaves KMS)
```

### Encryption Metadata Stored in S3 Object Metadata
```javascript
{
  'x-amz-meta-encryption-algorithm': 'AES-256-GCM',
  'x-amz-meta-encryption-key-id': 'arn:aws:kms:...:key/...',
  'x-amz-meta-encryption-iv': 'base64_encoded_iv',
  'x-amz-meta-encryption-auth-tag': 'base64_encoded_auth_tag',
  'x-amz-meta-encrypted-data-key': 'base64_encrypted_dek'
}
```

---

## Storage Service Features

### Core Operations
| Operation | Description |
|-----------|-------------|
| `encryptAndStore()` | Encrypt with envelope encryption, store in S3/MinIO |
| `retrieveAndDecrypt()` | Retrieve, unwrap DEK, decrypt, verify hash |
| `retrieveStream()` | Streaming decryption for large files |
| `deleteObject()` | Delete from storage |
| `getObjectMetadata()` | Get metadata without downloading |
| `getPresignedUrl()` | Generate signed URLs for direct browser upload/download |

### Multipart Upload (Large Files)
| Operation | Description |
|-----------|-------------|
| `initiateMultipartUpload()` | Start multipart upload with encryption context |
| `uploadPart()` | Upload encrypted part |
| `completeMultipartUpload()` | Complete and finalize |
| `abortMultipartUpload()` | Clean up failed uploads |

### Additional Features
- **Object Tagging**: Custom tags for classification
- **Object Copy**: Server-side copy preserving encryption
- **Listing**: Prefix-based listing with metadata
- **Hash Verification**: Automatic SHA-256 verification on retrieval
- **Case-scoped Keys**: Different encryption keys per case (configurable)

---

## Security Properties

### Encryption
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **IV**: 96-bit random per object
- **Auth Tag**: 128-bit
- **Key Derivation**: KMS-generated DEKs (256-bit)
- **Key Wrapping**: KMS master key (never exported)

### Key Management
- **Separation of Duties**: Master key in KMS, DEKs per object
- **Rotation**: Automatic (AWS) or manual (Local) key rotation
- **Versioning**: Key versions tracked for decryption of old objects
- **Revocation**: Key disablement prevents new encryption
- **Audit**: All KMS operations logged

### Data Integrity
- **GCM Auth Tag**: Detects any ciphertext modification
- **SHA-256 Verification**: Optional hash verification on retrieval
- **Immutable Storage**: Originals never overwritten (versioning at Layer 4)

### Access Control
- **IAM Policies**: Bucket/object level permissions
- **Encryption Context**: Case ID bound to encryption (prevents cross-case access)
- **Presigned URLs**: Time-limited, operation-specific access

---

## Configuration

### Environment Variables
```bash
# Storage
STORAGE_PROVIDER=minio          # or 'aws', 'azure', 'gcp'
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_BUCKET=adalat360-documents
STORAGE_ACCESS_KEY_ID=minioadmin
STORAGE_SECRET_ACCESS_KEY=minioadmin
STORAGE_FORCE_PATH_STYLE=true

# KMS
KMS_PROVIDER=local              # or 'aws', 'azure', 'gcp', 'hashicorp'
KMS_REGION=us-east-1
KMS_KEY_ID=                     # For existing keys
ENCRYPTION_MASTER_KEY=          # 64 hex chars for local provider
```

### Local Development (MinIO + Local KMS)
```bash
# Start MinIO
docker run -d -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Create bucket
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/adalat360-documents
```

---

## Integration Points

### From Layer 4 (Document Ingestion)
```typescript
// Called during document upload
const result = await storageService.encryptAndStore(
    fileBuffer,
    storagePath,
    caseId,
    { contentType: file.mimetype, encryptionKeyId: caseKeyId }
);

// Returns: { keyId, algorithm, iv, authTag, etag }
```

### To Layer 4 (Document Retrieval)
```typescript
// Called for document download
const decrypted = await storageService.retrieveAndDecrypt(
    storagePath,
    expectedHash // From document record
);
```

### To Layer 3 (Blockchain)
- Encryption key ID recorded in custody events
- Hash verification results logged on-chain
- Key rotation events trigger re-encryption workflows

---

## Key Rotation Strategy

### Automatic (AWS KMS)
- Annual rotation enabled by default
- Old key versions retained for decryption
- New objects encrypted with latest version
- No application changes required

### Manual (Local KMS)
```typescript
// Rotate key
const newKey = await kms.rotateKey('case-123-key');

// Re-encrypt existing objects (background job)
for (const object of objectsWithOldKey) {
    const data = await storage.retrieveAndDecrypt(object.key);
    await storage.encryptAndStore(data, object.key, caseId, { encryptionKeyId: newKey.key_id });
}
```

---

## Compliance

### NIST SP 800-57
- Key strength: AES-256 (256-bit security)
- Key separation: Master key (KMS) ≠ Data keys
- Key lifecycle: Generation → Distribution → Use → Rotation → Destruction

### ISO 27001
- A.10.1: Cryptographic controls implemented
- A.10.2: Key management lifecycle
- A.8.2: Information classification (encryption context)

### BSA Section 63
- File hashes recorded before encryption
- Hash verification on retrieval
- Chain of custody includes encryption metadata

---

## Next Layer

**Layer 6: Intelligence Layer**
- Semantic search with vector embeddings
- Case timeline reconstruction from custody ledger
- BSA Section 63 certificate generation
- Entity relationship graphs