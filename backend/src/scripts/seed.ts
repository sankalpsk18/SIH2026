#!/usr/bin/env tsx
/**
 * ADALAT360 - Database Seeder
 * Creates initial data for development/testing
 */

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { getPgPool, getMongoDb, closeDatabaseConnections, pgQuery, pgTransaction } from '../config/database.js';
import { DocumentType, DocumentStatus, EvidenceType, EvidenceStatus, CustodyAction, UserRole, PermissionLevel } from '../types/database.js';

async function seedDatabase(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           ADALAT360 Database Seeder                          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    if (config.isProduction) {
        console.error('✗ Seeding not allowed in production!');
        process.exit(1);
    }

    const pool = getPgPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Hash password for all test users
        const passwordHash = await bcrypt.hash('Test@123', 12);

        // ============================================================
        // SEED USERS
        // ============================================================
        console.log('Seeding users...');

        const users = [
            {
                id: uuidv4(),
                employee_id: 'ADM001',
                email: 'admin@adalat360.gov.in',
                phone: '9876543210',
                password_hash: passwordHash,
                full_name: 'System Administrator',
                role: 'CENTRAL_ADMIN',
                department: 'Central Administration',
                designation: 'Director',
                badge_number: 'ADM001',
                status: 'ACTIVE',
            },
            {
                id: uuidv4(),
                employee_id: 'AUD001',
                email: 'auditor@adalat360.gov.in',
                phone: '9876543211',
                password_hash: passwordHash,
                full_name: 'Chief Auditor',
                role: 'AUDITOR',
                department: 'Audit Department',
                designation: 'Chief Auditor',
                badge_number: 'AUD001',
                status: 'ACTIVE',
            },
            {
                id: uuidv4(),
                employee_id: 'IO001',
                email: 'officer.sharma@adalat360.gov.in',
                phone: '9876543212',
                password_hash: passwordHash,
                full_name: 'Inspector Rajesh Sharma',
                role: 'INVESTIGATING_OFFICER',
                department: 'Delhi Police',
                designation: 'Inspector',
                badge_number: 'DL-IO-001',
                status: 'ACTIVE',
            },
            {
                id: uuidv4(),
                employee_id: 'IO002',
                email: 'officer.patel@adalat360.gov.in',
                phone: '9876543213',
                password_hash: passwordHash,
                full_name: 'Sub-Inspector Priya Patel',
                role: 'INVESTIGATING_OFFICER',
                department: 'Mumbai Police',
                designation: 'Sub-Inspector',
                badge_number: 'MH-IO-002',
                status: 'ACTIVE',
            },
            {
                id: uuidv4(),
                employee_id: 'FL001',
                email: 'lab.director@adalat360.gov.in',
                phone: '9876543214',
                password_hash: passwordHash,
                full_name: 'Dr. Anjali Krishnan',
                role: 'FORENSIC_LAB',
                department: 'Central Forensic Science Laboratory',
                designation: 'Director',
                badge_number: 'CFSL-001',
                status: 'ACTIVE',
            },
            {
                id: uuidv4(),
                employee_id: 'FL002',
                email: 'analyst.rao@adalat360.gov.in',
                phone: '9876543215',
                password_hash: passwordHash,
                full_name: 'Dr. Vikram Rao',
                role: 'FORENSIC_LAB',
                department: 'State Forensic Lab',
                designation: 'Senior Analyst',
                badge_number: 'SFL-002',
                status: 'ACTIVE',
            },
            {
                id: uuidv4(),
                employee_id: 'PRO001',
                email: 'prosecutor.singh@adalat360.gov.in',
                phone: '9876543216',
                password_hash: passwordHash,
                full_name: 'Advocate Meera Singh',
                role: 'PROSECUTOR',
                department: 'Public Prosecutor Office',
                designation: 'Public Prosecutor',
                badge_number: 'PPO-001',
                status: 'ACTIVE',
            },
            {
                id: uuidv4(),
                employee_id: 'CRT001',
                email: 'judge.kumar@adalat360.gov.in',
                phone: '9876543217',
                password_hash: passwordHash,
                full_name: 'Hon. Justice Arun Kumar',
                role: 'COURT',
                department: 'Delhi High Court',
                designation: 'Judge',
                badge_number: 'DHC-001',
                status: 'ACTIVE',
            },
        ];

        for (const user of users) {
            await client.query(
                `INSERT INTO users (id, employee_id, email, phone, password_hash, full_name, role, department, designation, badge_number, status, created_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
                 ON CONFLICT (email) DO NOTHING`,
                [user.id, user.employee_id, user.email, user.phone, user.password_hash, user.full_name, user.role, user.department, user.designation, user.badge_number, user.status]
            );
        }

        // Get user IDs for references
        const adminResult = await client.query(`SELECT id FROM users WHERE email = 'admin@adalat360.gov.in'`);
        const adminId = adminResult.rows[0].id;

        const ioResult = await client.query(`SELECT id FROM users WHERE email = 'officer.sharma@adalat360.gov.in'`);
        const ioId = ioResult.rows[0].id;

        const io2Result = await client.query(`SELECT id FROM users WHERE email = 'officer.patel@adalat360.gov.in'`);
        const io2Id = io2Result.rows[0].id;

        const flResult = await client.query(`SELECT id FROM users WHERE email = 'lab.director@adalat360.gov.in'`);
        const flId = flResult.rows[0].id;

        const proResult = await client.query(`SELECT id FROM users WHERE email = 'prosecutor.singh@adalat360.gov.in'`);
        const proId = proResult.rows[0].id;

        const crtResult = await client.query(`SELECT id FROM users WHERE email = 'judge.kumar@adalat360.gov.in'`);
        const crtId = crtResult.rows[0].id;

        console.log('  ✓ Users seeded');

        // ============================================================
        // SEED BLOCKCHAIN NODES
        // ============================================================
        console.log('Seeding blockchain nodes...');

        const nodes = [
            {
                node_id: 'officer-node-1',
                node_type: 'OFFICER_NODE',
                organization_name: 'Police Department',
                organization_msp_id: 'OfficerMSP',
                peer_endpoint: 'localhost:7051',
                ca_endpoint: 'http://localhost:7054',
                tls_cert_pem: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUZhekNDQTFPZ0F3SUJBZ0lVYkV...',
                is_active: true,
            },
            {
                node_id: 'forensic-node-1',
                node_type: 'FORENSIC_LAB_NODE',
                organization_name: 'Forensic Laboratory',
                organization_msp_id: 'ForensicLabMSP',
                peer_endpoint: 'localhost:8051',
                ca_endpoint: 'http://localhost:8054',
                tls_cert_pem: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUZhekNDQTFPZ0F3SUJBZ0lVYkV...',
                is_active: true,
            },
            {
                node_id: 'court-node-1',
                node_type: 'COURT_NODE',
                organization_name: 'Judiciary',
                organization_msp_id: 'CourtMSP',
                peer_endpoint: 'localhost:9051',
                ca_endpoint: 'http://localhost:9054',
                tls_cert_pem: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUZhekNDQTFPZ0F3SUJBZ0lVYkV...',
                is_active: true,
            },
            {
                node_id: 'audit-node-1',
                node_type: 'CENTRAL_AUDIT_NODE',
                organization_name: 'Central Audit Authority',
                organization_msp_id: 'AuditMSP',
                peer_endpoint: 'localhost:10051',
                ca_endpoint: 'http://localhost:10054',
                tls_cert_pem: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUZhekNDQTFPZ0F3SUJBZ0lVYkV...',
                is_active: true,
            },
        ];

        for (const node of nodes) {
            await client.query(
                `INSERT INTO blockchain_nodes (node_id, node_type, organization_name, organization_msp_id, peer_endpoint, ca_endpoint, tls_cert_pem, is_active, created_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
                 ON CONFLICT (node_id) DO NOTHING`,
                [node.node_id, node.node_type, node.organization_name, node.organization_msp_id, node.peer_endpoint, node.ca_endpoint, node.tls_cert_pem, node.is_active]
            );
        }
        console.log('  ✓ Blockchain nodes seeded');

        // ============================================================
        // SEED CASES
        // ============================================================
        console.log('Seeding cases...');

        const caseId1 = uuidv4();
        const caseId2 = uuidv4();

        await client.query(
            `INSERT INTO cases (id, case_number, fir_number, title, description, status, priority, police_station, district, state, jurisdiction_court, ipc_sections, bns_sections, assigned_officer_id, supervising_officer_id, prosecutor_id, forensic_lab_id, court_id, incident_date, fir_registered_at, created_by, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW())
             ON CONFLICT (case_number) DO NOTHING`,
            [
                caseId1,
                'FIR/2024/DEL/001234',
                'FIR/2024/DEL/001234',
                'State vs. Unknown - Cyber Fraud Case',
                'Large scale cyber fraud involving phishing, identity theft, and financial fraud across multiple states. Investigation ongoing.',
                'UNDER_INVESTIGATION',
                'HIGH',
                'Cyber Crime Police Station',
                'New Delhi',
                'Delhi',
                'Delhi High Court',
                ['420', '467', '468', '471', '120B'],
                ['316', '318', '319', '336', '61'],
                ioId,
                ioId,
                proId,
                flId,
                crtId,
                '2024-01-15 10:30:00+05:30',
                '2024-01-15 11:00:00+05:30',
                adminId,
            ]
        );

        await client.query(
            `INSERT INTO cases (id, case_number, fir_number, title, description, status, priority, police_station, district, state, jurisdiction_court, ipc_sections, bns_sections, assigned_officer_id, supervising_officer_id, prosecutor_id, forensic_lab_id, court_id, incident_date, fir_registered_at, created_by, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW())
             ON CONFLICT (case_number) DO NOTHING`,
            [
                caseId2,
                'FIR/2024/MUM/005678',
                'FIR/2024/MUM/005678',
                'State vs. Rahul Mehra - Murder Investigation',
                'Murder investigation with multiple witnesses, forensic evidence, and digital trail. Charge sheet filed.',
                'CHARGE_SHEET_FILED',
                'CRITICAL',
                'Bandra Police Station',
                'Mumbai',
                'Maharashtra',
                'Bombay High Court',
                ['302', '201', '34', '120B'],
                ['103', '238', '3', '61'],
                io2Id,
                io2Id,
                proId,
                flId,
                crtId,
                '2024-02-20 14:00:00+05:30',
                '2024-02-20 15:30:00+05:30',
                adminId,
            ]
        );
        console.log('  ✓ Cases seeded');

        // ============================================================
        // SEED CASE ASSIGNMENTS
        // ============================================================
        console.log('Seeding case assignments...');

        // Get existing case IDs from database
        const casesResult = await client.query(`SELECT id, case_number FROM cases WHERE case_number IN ('FIR/2024/DEL/001234', 'FIR/2024/MUM/005678')`);
        const caseMap: Record<string, string> = {};
        for (const row of casesResult.rows) {
            caseMap[row.case_number] = row.id;
        }

        const case1Id = caseMap['FIR/2024/DEL/001234'];
        const case2Id = caseMap['FIR/2024/MUM/005678'];

        if (!case1Id || !case2Id) {
            console.warn('  ⚠ Cases not found, skipping assignments');
        } else {
            const assignments = [
                { case_id: case1Id, user_id: ioId, role_in_case: 'INVESTIGATING_OFFICER', permission_level: ['READ','WRITE','SIGN','EXPORT'], assigned_by: adminId },
                { case_id: case1Id, user_id: io2Id, role_in_case: 'ASSISTANT_IO', permission_level: ['READ','WRITE'], assigned_by: adminId },
                { case_id: case1Id, user_id: flId, role_in_case: 'FORENSIC_EXAMINER', permission_level: ['READ','WRITE','SIGN','VERIFY'], assigned_by: adminId },
                { case_id: case1Id, user_id: proId, role_in_case: 'PROSECUTOR', permission_level: ['READ','WRITE','SIGN','EXPORT','REDACT'], assigned_by: adminId },
                { case_id: case1Id, user_id: crtId, role_in_case: 'PRESIDING_JUDGE', permission_level: ['READ','VERIFY','SIGN'], assigned_by: adminId },
                { case_id: case2Id, user_id: io2Id, role_in_case: 'INVESTIGATING_OFFICER', permission_level: ['READ','WRITE','SIGN','EXPORT'], assigned_by: adminId },
                { case_id: case2Id, user_id: flId, role_in_case: 'FORENSIC_EXAMINER', permission_level: ['READ','WRITE','SIGN','VERIFY'], assigned_by: adminId },
                { case_id: case2Id, user_id: proId, role_in_case: 'PROSECUTOR', permission_level: ['READ','WRITE','SIGN','EXPORT','REDACT'], assigned_by: adminId },
                { case_id: case2Id, user_id: crtId, role_in_case: 'PRESIDING_JUDGE', permission_level: ['READ','VERIFY','SIGN'], assigned_by: adminId },
            ];

            for (const a of assignments) {
            await client.query(
                `INSERT INTO case_assignments (id, case_id, user_id, role_in_case, permission_level, assigned_by, assigned_at, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,NOW(),TRUE)
                 ON CONFLICT (case_id, user_id, role_in_case) DO NOTHING`,
                [uuidv4(), a.case_id, a.user_id, a.role_in_case, a.permission_level, a.assigned_by]
            );
        }
        console.log('  ✓ Case assignments seeded');
        }

        // ============================================================
        // SEED DOCUMENTS
        // ============================================================
        console.log('Seeding case documents...');

        const seededDocuments = [
            {
                caseId: case1Id,
                number: 'DOC/2024/DEL/001',
                title: 'Initial cyber fraud complaint and FIR',
                description: 'Digitized FIR and initial complaint submitted by the affected account holders.',
                type: 'FIR',
                filename: 'fir-cyber-fraud-001.pdf',
                size: 2483200,
                hash: crypto.createHash('sha256').update('adalat360-demo-fir-cyber-fraud-001').digest('hex'),
                tags: ['fir', 'cyber-fraud', 'priority-high'],
                uploadedBy: ioId,
            },
            {
                caseId: case1Id,
                number: 'DOC/2024/DEL/002',
                title: 'Bank transaction analysis report',
                description: 'Forensic review of beneficiary accounts, transaction timestamps, and linked wallet addresses.',
                type: 'FORENSIC_REPORT',
                filename: 'transaction-analysis-report.pdf',
                size: 5849120,
                hash: crypto.createHash('sha256').update('adalat360-demo-transaction-analysis-002').digest('hex'),
                tags: ['forensic', 'financial-records', 'analysis'],
                uploadedBy: flId,
            },
            {
                caseId: case2Id,
                number: 'DOC/2024/MUM/001',
                title: 'Post-mortem and scene examination report',
                description: 'Certified examination report associated with the incident scene and recovered material.',
                type: 'FORENSIC_REPORT',
                filename: 'scene-examination-report.pdf',
                size: 3921840,
                hash: crypto.createHash('sha256').update('adalat360-demo-scene-examination-001').digest('hex'),
                tags: ['forensic', 'scene', 'exhibit-a'],
                uploadedBy: flId,
            },
            {
                caseId: case2Id,
                number: 'DOC/2024/MUM/002',
                title: 'Witness statement - R. Mehta',
                description: 'Signed witness statement recorded during the investigation.',
                type: 'WITNESS_STATEMENT',
                filename: 'witness-statement-r-mehta.pdf',
                size: 1189040,
                hash: crypto.createHash('sha256').update('adalat360-demo-witness-statement-002').digest('hex'),
                tags: ['witness', 'statement', 'signed'],
                uploadedBy: io2Id,
            },
        ];

        for (const document of seededDocuments) {
            const documentId = uuidv4();
            await client.query(
                `INSERT INTO documents (
                    id, case_id, document_number, title, description, document_type, status,
                    version, is_latest_version, original_filename, stored_filename, mime_type,
                    file_size_bytes, file_hash_sha256, storage_path, storage_bucket,
                    ocr_text, ocr_language, ocr_confidence, ocr_processed_at, metadata,
                    extracted_entities, tags, uploaded_by, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,'VERIFIED',1,TRUE,$7,$7,'application/pdf',$8,$9,$10,'adalat360-demo',
                    $11,'eng',96.50,NOW(),'{}','{}',$12,$13,NOW(),NOW())
                ON CONFLICT (document_number) DO NOTHING`,
                [
                    documentId,
                    document.caseId,
                    document.number,
                    document.title,
                    document.description,
                    document.type,
                    document.filename,
                    document.size,
                    document.hash,
                    `demo/${document.caseId}/${document.filename}`,
                    `Demo OCR text for ${document.title}. This seeded record is available for search and BSA certificate testing.`,
                    document.tags,
                    document.uploadedBy,
                ]
            );
        }
        console.log('  ✓ Case documents seeded');

        // ============================================================
        // SEED SYSTEM CONFIG
        // ============================================================
        console.log('Seeding system config...');

        const configs = [
            { config_key: 'app.name', config_value: { value: 'ADALAT360' }, description: 'Application name', is_sensitive: false },
            { config_key: 'app.version', config_value: { value: '1.0.0' }, description: 'Application version', is_sensitive: false },
            { config_key: 'security.password_min_length', config_value: { value: 12 }, description: 'Minimum password length', is_sensitive: false },
            { config_key: 'security.password_require_uppercase', config_value: { value: true }, description: 'Require uppercase in password', is_sensitive: false },
            { config_key: 'security.password_require_lowercase', config_value: { value: true }, description: 'Require lowercase in password', is_sensitive: false },
            { config_key: 'security.password_require_numbers', config_value: { value: true }, description: 'Require numbers in password', is_sensitive: false },
            { config_key: 'security.password_require_special', config_value: { value: true }, description: 'Require special characters in password', is_sensitive: false },
            { config_key: 'security.max_login_attempts', config_value: { value: 5 }, description: 'Max failed login attempts before lockout', is_sensitive: false },
            { config_key: 'security.lockout_duration_minutes', config_value: { value: 30 }, description: 'Lockout duration in minutes', is_sensitive: false },
            { config_key: 'security.session_timeout_minutes', config_value: { value: 60 }, description: 'Session timeout in minutes', is_sensitive: false },
            { config_key: 'document.max_file_size_mb', config_value: { value: 100 }, description: 'Maximum file upload size in MB', is_sensitive: false },
            { config_key: 'document.allowed_extensions', config_value: { value: ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'bmp', 'doc', 'docx', 'txt', 'rtf'] }, description: 'Allowed file extensions', is_sensitive: false },
            { config_key: 'blockchain.endorsement_policy', config_value: { value: 'AND(\"OfficerMSP.peer\", \"ForensicLabMSP.peer\")' }, description: 'Default endorsement policy for custody ledger', is_sensitive: false },
            { config_key: 'bsa.certificate_validity_years', config_value: { value: 10 }, description: 'BSA certificate validity in years', is_sensitive: false },
            { config_key: 'rti.response_deadline_days', config_value: { value: 30 }, description: 'RTI response deadline in days', is_sensitive: false },
            { config_key: 'audit.log_retention_years', config_value: { value: 7 }, description: 'Audit log retention in years', is_sensitive: false },
        ];

        for (const c of configs) {
            await client.query(
                `INSERT INTO system_config (config_key, config_value, description, is_sensitive, updated_by, updated_at)
                 VALUES ($1,$2,$3,$4,$5,NOW())
                 ON CONFLICT (config_key) DO UPDATE SET config_value = $2, description = $3, is_sensitive = $4, updated_by = $5, updated_at = NOW()`,
                [c.config_key, JSON.stringify(c.config_value), c.description, c.is_sensitive, adminId]
            );
        }
        console.log('  ✓ System config seeded');

        await client.query('COMMIT');
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║           Database seeding completed successfully!           ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('Test credentials (all passwords: Test@123):');
        console.log('  Admin:       admin@adalat360.gov.in');
        console.log('  Auditor:     auditor@adalat360.gov.in');
        console.log('  IO (Delhi):  officer.sharma@adalat360.gov.in');
        console.log('  IO (Mumbai): officer.patel@adalat360.gov.in');
        console.log('  Forensic:    lab.director@adalat360.gov.in');
        console.log('  Prosecutor:  prosecutor.singh@adalat360.gov.in');
        console.log('  Court:       judge.kumar@adalat360.gov.in');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Seeding failed:', error);
        throw error;
    } finally {
        client.release();
        await closeDatabaseConnections();
    }
}

seedDatabase().catch(console.error);