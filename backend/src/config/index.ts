/**
 * ADALAT360 - Central Configuration
 * All environment variables and application settings
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
    // Environment
    env: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',

    // Server
    server: {
        host: process.env.SERVER_HOST || '0.0.0.0',
        port: parseInt(process.env.SERVER_PORT || '3000', 10),
        apiPrefix: process.env.API_PREFIX || '/api/v1',
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        trustProxy: process.env.TRUST_PROXY === 'true',
    },

    // Database - PostgreSQL
    database: {
        postgres: {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
            database: process.env.POSTGRES_DB || 'adalat360',
            user: process.env.POSTGRES_USER || 'adalat360',
            password: process.env.POSTGRES_PASSWORD || 'change_me_securely',
            poolMax: parseInt(process.env.POSTGRES_POOL_MAX || '20', 10),
            poolMin: parseInt(process.env.POSTGRES_POOL_MIN || '2', 10),
            idleTimeout: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10),
            connectionTimeout: parseInt(process.env.POSTGRES_CONN_TIMEOUT || '5000', 10),
            ssl: process.env.POSTGRES_SSL === 'true',
        },
        mongo: {
            host: process.env.MONGO_HOST || 'localhost',
            port: parseInt(process.env.MONGO_PORT || '27017', 10),
            database: process.env.MONGO_DB || 'adalat360',
            username: process.env.MONGO_USERNAME || '',
            password: process.env.MONGO_PASSWORD || '',
            poolMax: parseInt(process.env.MONGO_POOL_MAX || '20', 10),
            poolMin: parseInt(process.env.MONGO_POOL_MIN || '2', 10),
            idleTimeout: parseInt(process.env.MONGO_IDLE_TIMEOUT || '30000', 10),
            connectionTimeout: parseInt(process.env.MONGO_CONN_TIMEOUT || '5000', 10),
            ssl: process.env.MONGO_SSL === 'true',
        },
    },

    // Redis
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        tls: process.env.REDIS_TLS === 'true',
        keyPrefix: 'adalat360:',
    },

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || 'change_me_to_a_very_long_secure_random_string_min_256_bits',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'change_me_refresh_secret_min_256_bits',
        accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
        issuer: 'adalat360',
        audience: 'adalat360-api',
    },

    // MFA / TOTP
    mfa: {
        issuer: 'ADALAT360',
        algorithm: 'SHA-1',
        digits: 6,
        period: 30,
        window: 1,
    },

    // Encryption
    encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16,
        tagLength: 16,
        saltLength: 32,
        pbkdf2Iterations: 100000,
    },

    // KMS / HSM
    kms: {
        provider: process.env.KMS_PROVIDER || 'local', // 'aws', 'azure', 'gcp', 'hashicorp', 'local'
        region: process.env.KMS_REGION || 'us-east-1',
        keyId: process.env.KMS_KEY_ID || '',
        endpoint: process.env.KMS_ENDPOINT || '',
        accessKeyId: process.env.KMS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.KMS_SECRET_ACCESS_KEY || '',
    },

    // Storage (S3/MinIO)
    storage: {
        provider: process.env.STORAGE_PROVIDER || 'minio', // 'aws', 'minio', 'azure', 'gcp'
        endpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
        region: process.env.STORAGE_REGION || 'us-east-1',
        bucket: process.env.STORAGE_BUCKET || 'adalat360-documents',
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || 'minioadmin',
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || 'minioadmin',
        forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
        publicUrl: process.env.STORAGE_PUBLIC_URL || '',
    },

    // Blockchain - Hyperledger Fabric
    blockchain: {
        enabled: process.env.BLOCKCHAIN_ENABLED === 'true',
        network: {
            name: process.env.FABRIC_NETWORK_NAME || 'adalat360-network',
            channel: process.env.FABRIC_CHANNEL || 'adalat360-channel',
            chaincode: process.env.FABRIC_CHAINCODE || 'custody-ledger',
            chaincodeVersion: process.env.FABRIC_CHAINCODE_VERSION || '1.0.0',
        },
        organizations: [
            {
                mspId: 'OfficerMSP',
                name: 'OfficerNode',
                peers: process.env.FABRIC_OFFICER_PEERS?.split(',') || ['localhost:7051'],
                caUrl: process.env.FABRIC_OFFICER_CA || 'http://localhost:7054',
                adminCert: process.env.FABRIC_OFFICER_ADMIN_CERT || '',
                adminKey: process.env.FABRIC_OFFICER_ADMIN_KEY || '',
            },
            {
                mspId: 'ForensicLabMSP',
                name: 'ForensicLabNode',
                peers: process.env.FABRIC_FORENSIC_PEERS?.split(',') || ['localhost:8051'],
                caUrl: process.env.FABRIC_FORENSIC_CA || 'http://localhost:8054',
                adminCert: process.env.FABRIC_FORENSIC_ADMIN_CERT || '',
                adminKey: process.env.FABRIC_FORENSIC_ADMIN_KEY || '',
            },
            {
                mspId: 'CourtMSP',
                name: 'CourtNode',
                peers: process.env.FABRIC_COURT_PEERS?.split(',') || ['localhost:9051'],
                caUrl: process.env.FABRIC_COURT_CA || 'http://localhost:9054',
                adminCert: process.env.FABRIC_COURT_ADMIN_CERT || '',
                adminKey: process.env.FABRIC_COURT_ADMIN_KEY || '',
            },
            {
                mspId: 'AuditMSP',
                name: 'CentralAuditNode',
                peers: process.env.FABRIC_AUDIT_PEERS?.split(',') || ['localhost:10051'],
                caUrl: process.env.FABRIC_AUDIT_CA || 'http://localhost:10054',
                adminCert: process.env.FABRIC_AUDIT_ADMIN_CERT || '',
                adminKey: process.env.FABRIC_AUDIT_ADMIN_KEY || '',
            },
        ],
        orderers: process.env.FABRIC_ORDERERS?.split(',') || ['localhost:7050'],
        tlsCertPath: process.env.FABRIC_TLS_CERT_PATH || './fabric-config/tls',
        walletPath: process.env.FABRIC_WALLET_PATH || './fabric-wallet',
    },

    // Document Ingestion
    ingestion: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
        allowedMimeTypes: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/tiff',
            'image/bmp',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'application/rtf',
        ],
        ocr: {
            enabled: process.env.OCR_ENABLED !== 'false',
            languages: process.env.OCR_LANGUAGES?.split(',') || ['eng', 'hin'],
            tesseractPath: process.env.TESSERACT_PATH || 'tesseract',
            dpi: parseInt(process.env.OCR_DPI || '300', 10),
        },
        entityExtraction: {
            enabled: process.env.ENTITY_EXTRACTION_ENABLED !== 'false',
            model: process.env.NLP_MODEL || 'en_core_web_sm',
        },
    },

    // Search
    search: {
        provider: process.env.SEARCH_PROVIDER || 'meilisearch', // 'meilisearch', 'elasticsearch', 'opensearch'
        meilisearch: {
            host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
            apiKey: process.env.MEILISEARCH_API_KEY || '',
        },
        elasticsearch: {
            node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
            username: process.env.ELASTICSEARCH_USERNAME || '',
            password: process.env.ELASTICSEARCH_PASSWORD || '',
        },
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        loginMaxRequests: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5', 10),
        loginWindowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '900000', 10),
    },

    // WAF
    waf: {
        enabled: process.env.WAF_ENABLED !== 'false',
        blockSqlInjection: true,
        blockXss: true,
        blockPathTraversal: true,
        blockCommandInjection: true,
        maxBodySize: parseInt(process.env.WAF_MAX_BODY_SIZE || '10485760', 10), // 10MB
    },

    // Audit & Logging
    audit: {
        logLevel: process.env.LOG_LEVEL || 'info',
        logFormat: process.env.LOG_FORMAT || 'json',
        enableConsole: process.env.ENABLE_CONSOLE_LOGS !== 'false',
        enableFile: process.env.ENABLE_FILE_LOGS === 'true',
        logDir: process.env.LOG_DIR || './logs',
        retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '2555', 10), // 7 years
        blockchainAudit: process.env.BLOCKCHAIN_AUDIT !== 'false',
    },

    // BSA Certificate
    bsa: {
        section: '63',
        defaultValidityDays: parseInt(process.env.BSA_VALIDITY_DAYS || '3650', 10), // 10 years
        qrCodeSize: parseInt(process.env.BSA_QR_SIZE || '300', 10),
    },

    // RTI
    rti: {
        responseDeadlineDays: parseInt(process.env.RTI_DEADLINE_DAYS || '30', 10),
        firstAppealDeadlineDays: parseInt(process.env.RTI_FIRST_APPEAL_DAYS || '30', 10),
        feeAmount: parseFloat(process.env.RTI_FEE_AMOUNT || '10'),
    },

    // Anomaly Detection
    anomaly: {
        enabled: process.env.ANOMALY_DETECTION_ENABLED !== 'false',
        bulkDownloadThreshold: parseInt(process.env.ANOMALY_BULK_THRESHOLD || '50', 10),
        bulkDownloadWindowMinutes: parseInt(process.env.ANOMALY_BULK_WINDOW || '60', 10),
        offHoursStart: parseInt(process.env.ANOMALY_OFF_HOURS_START || '22', 10),
        offHoursEnd: parseInt(process.env.ANOMALY_OFF_HOURS_END || '6', 10),
        failedAuthThreshold: parseInt(process.env.ANOMALY_FAILED_AUTH || '5', 10),
        failedAuthWindowMinutes: parseInt(process.env.ANOMALY_FAILED_AUTH_WINDOW || '15', 10),
        concurrentSessionLimit: parseInt(process.env.ANOMALY_CONCURRENT_SESSIONS || '3', 10),
    },

    // Email
    email: {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'noreply@adalat360.gov.in',
    },

    // Feature Flags
    features: {
        blockchainEnabled: process.env.FEATURE_BLOCKCHAIN === 'true',
        ocrEnabled: process.env.FEATURE_OCR !== 'false',
        entityExtractionEnabled: process.env.FEATURE_ENTITY_EXTRACTION !== 'false',
        semanticSearchEnabled: process.env.FEATURE_SEMANTIC_SEARCH !== 'false',
        bsaCertificatesEnabled: process.env.FEATURE_BSA !== 'false',
        rtiEnabled: process.env.FEATURE_RTI !== 'false',
        anomalyDetectionEnabled: process.env.FEATURE_ANOMALY !== 'false',
        qrCodeEnabled: process.env.FEATURE_QR !== 'false',
        digitalSignaturesEnabled: process.env.FEATURE_DS !== 'false',
    },
};

export default config;