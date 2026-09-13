/**
 * ADALAT360 - Central Configuration
 * All environment variables and application settings
 */
export declare const config: {
    env: string;
    isProduction: boolean;
    isDevelopment: boolean;
    server: {
        host: string;
        port: number;
        apiPrefix: string;
        corsOrigin: string;
        trustProxy: boolean;
    };
    database: {
        postgres: {
            host: string;
            port: number;
            database: string;
            user: string;
            password: string;
            poolMax: number;
            poolMin: number;
            idleTimeout: number;
            connectionTimeout: number;
            ssl: boolean;
        };
        mongo: {
            host: string;
            port: number;
            database: string;
            username: string;
            password: string;
            poolMax: number;
            poolMin: number;
            idleTimeout: number;
            connectionTimeout: number;
            ssl: boolean;
        };
    };
    redis: {
        host: string;
        port: number;
        password: string | undefined;
        db: number;
        tls: boolean;
        keyPrefix: string;
    };
    jwt: {
        secret: string;
        refreshSecret: string;
        accessTokenExpiry: string;
        refreshTokenExpiry: string;
        issuer: string;
        audience: string;
    };
    mfa: {
        issuer: string;
        algorithm: string;
        digits: number;
        period: number;
        window: number;
    };
    encryption: {
        algorithm: string;
        keyLength: number;
        ivLength: number;
        tagLength: number;
        saltLength: number;
        pbkdf2Iterations: number;
    };
    kms: {
        provider: string;
        region: string;
        keyId: string;
        endpoint: string;
        accessKeyId: string;
        secretAccessKey: string;
    };
    storage: {
        provider: string;
        endpoint: string;
        region: string;
        bucket: string;
        accessKeyId: string;
        secretAccessKey: string;
        forcePathStyle: boolean;
        publicUrl: string;
    };
    blockchain: {
        enabled: boolean;
        network: {
            name: string;
            channel: string;
            chaincode: string;
            chaincodeVersion: string;
        };
        organizations: {
            mspId: string;
            name: string;
            peers: string[];
            caUrl: string;
            adminCert: string;
            adminKey: string;
        }[];
        orderers: string[];
        tlsCertPath: string;
        walletPath: string;
    };
    ingestion: {
        maxFileSize: number;
        allowedMimeTypes: string[];
        ocr: {
            enabled: boolean;
            languages: string[];
            tesseractPath: string;
            dpi: number;
        };
        entityExtraction: {
            enabled: boolean;
            model: string;
        };
    };
    search: {
        provider: string;
        meilisearch: {
            host: string;
            apiKey: string;
        };
        elasticsearch: {
            node: string;
            username: string;
            password: string;
        };
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
        loginMaxRequests: number;
        loginWindowMs: number;
    };
    waf: {
        enabled: boolean;
        blockSqlInjection: boolean;
        blockXss: boolean;
        blockPathTraversal: boolean;
        blockCommandInjection: boolean;
        maxBodySize: number;
    };
    audit: {
        logLevel: string;
        logFormat: string;
        enableConsole: boolean;
        enableFile: boolean;
        logDir: string;
        retentionDays: number;
        blockchainAudit: boolean;
    };
    bsa: {
        section: string;
        defaultValidityDays: number;
        qrCodeSize: number;
    };
    rti: {
        responseDeadlineDays: number;
        firstAppealDeadlineDays: number;
        feeAmount: number;
    };
    anomaly: {
        enabled: boolean;
        bulkDownloadThreshold: number;
        bulkDownloadWindowMinutes: number;
        offHoursStart: number;
        offHoursEnd: number;
        failedAuthThreshold: number;
        failedAuthWindowMinutes: number;
        concurrentSessionLimit: number;
    };
    email: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        pass: string;
        from: string;
    };
    features: {
        blockchainEnabled: boolean;
        ocrEnabled: boolean;
        entityExtractionEnabled: boolean;
        semanticSearchEnabled: boolean;
        bsaCertificatesEnabled: boolean;
        rtiEnabled: boolean;
        anomalyDetectionEnabled: boolean;
        qrCodeEnabled: boolean;
        digitalSignaturesEnabled: boolean;
    };
};
export default config;
//# sourceMappingURL=index.d.ts.map