#!/usr/bin/env node

/**
 * Railway Database Setup Script
 * 
 * This script is designed to run on Railway to set up the database schema
 * during deployment or as a one-time setup command.
 * 
 * Usage: 
 *   - Locally: node scripts/railway-db-setup.js
 *   - On Railway: Add as a build/deploy command
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv-flow').config();

console.log('🚀 Railway Database Setup Starting...');
console.log('📅 Timestamp:', new Date().toISOString());

// Simple logger for Railway environment
const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    warn: (msg) => console.warn(`⚠️  ${msg}`)
};

const splitSqlStatements = (sql) =>
    sql
        // Remove line comments
        .replace(/--.*$/gm, '')
        // Remove block comments
        .replace(/\/\*[\s\S]*?\*\//gm, '')
        .split(/;\s*(?:\r?\n|$)/)
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0);

async function runSqlFile(pool, relativePath, label) {
    const filePath = path.join(__dirname, relativePath);

    if (!fs.existsSync(filePath)) {
        log.warn(`Migration file not found (${label}) at ${filePath}. Skipping.`);
        return;
    }

    log.info(`Applying migration ${label}...`);

    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = splitSqlStatements(sql);

    for (const statement of statements) {
        try {
            await pool.query(statement);
        } catch (error) {
            log.error(`Migration ${label} failed on statement:\n${statement}`);
            throw error;
        }
    }

    log.success(`Migration ${label} executed successfully (${statements.length} statements).`);
}

async function setupRailwayDatabase() {
    log.info('Checking environment variables...');
    
    // Check for required environment variables
    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
        log.error('No database configuration found!');
        log.error('Required: DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE');
        process.exit(1);
    }

    // Database connection with Railway-specific settings
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || undefined,
        host: process.env.PGHOST,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE || 'railway',
        port: process.env.PGPORT || 5432,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        // Railway-specific connection settings
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10
    });

    try {
        // Test connection with retry logic
        log.info('Testing database connection...');
        let connected = false;
        let attempts = 0;
        const maxAttempts = 5;

        while (!connected && attempts < maxAttempts) {
            try {
                await pool.query('SELECT NOW()');
                connected = true;
                log.success('Database connection successful');
            } catch (error) {
                attempts++;
                log.warn(`Connection attempt ${attempts}/${maxAttempts} failed: ${error.message}`);
                if (attempts < maxAttempts) {
                    log.info('Retrying in 2 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    throw error;
                }
            }
        }

        // Execute schema setup in transaction
        log.info('Starting database schema setup...');
        await pool.query('BEGIN');

        try {
            // 1. Users table (base table)
            log.info('Creating users table...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    user_id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);

            // 2. Authentication tables
            log.info('Creating authentication tables...');
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS magic_link_tokens (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) NOT NULL,
                    token VARCHAR(255) UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    used BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) NOT NULL,
                    token VARCHAR(64) UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    used_at TIMESTAMP DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);

            // 3. User profile tables
            log.info('Creating user profile tables...');
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS job_preferences (
                    id SERIAL PRIMARY KEY,
                    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
                    remote_jobs JSONB DEFAULT '[]',
                    onsite_location VARCHAR(255),
                    job_types JSONB DEFAULT '[]',
                    job_titles JSONB DEFAULT '[]',
                    seniority_levels JSONB DEFAULT '[]',
                    time_zones JSONB DEFAULT '[]',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(user_id)
                );
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS profile (
                    id SERIAL PRIMARY KEY,
                    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
                    full_name VARCHAR(255),
                    email VARCHAR(255),
                    resume_path TEXT,
                    cover_letter_option VARCHAR(50),
                    cover_letter_path TEXT,
                    phone VARCHAR(20),
                    country VARCHAR(100),
                    city VARCHAR(100),
                    state_region VARCHAR(100),
                    postal_code VARCHAR(20),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(user_id)
                );
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS eligibility (
                    id SERIAL PRIMARY KEY,
                    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
                    current_job_title VARCHAR(255),
                    availability VARCHAR(50),
                    eligible_countries JSONB DEFAULT '[]',
                    visa_sponsorship BOOLEAN,
                    nationality JSONB DEFAULT '[]',
                    current_salary NUMERIC(12, 2),
                    expected_salary NUMERIC(12, 2),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(user_id)
                );
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS screening_answers (
                    id SERIAL PRIMARY KEY,
                    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
                    experience_summary TEXT,
                    hybrid_preference VARCHAR(50),
                    travel VARCHAR(50),
                    relocation VARCHAR(50),
                    languages JSONB DEFAULT '[]',
                    date_of_birth DATE,
                    gpa NUMERIC(3, 2),
                    is_adult BOOLEAN,
                    gender_identity VARCHAR(50),
                    disability_status VARCHAR(50),
                    military_service VARCHAR(50),
                    ethnicity VARCHAR(100),
                    driving_license TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(user_id)
                );
            `);

            // 4. Create indexes
            log.info('Creating database indexes...');
            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
                'CREATE INDEX IF NOT EXISTS idx_magic_link_token ON magic_link_tokens(token)',
                'CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link_tokens(email)',
                'CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token)',
                'CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_tokens(email)',
                'CREATE INDEX IF NOT EXISTS idx_profile_user_id ON profile(user_id)',
                'CREATE INDEX IF NOT EXISTS idx_profile_email ON profile(email)'
            ];

            for (const indexQuery of indexes) {
                await pool.query(indexQuery);
            }

            // 5. Create views (skip for now to avoid column reference issues)
            log.info('Skipping database views creation to avoid column reference issues...');

            // Commit transaction
            await pool.query('COMMIT');
            log.success('Database schema setup completed successfully!');

            // Apply additional migrations (auto-apply, profile enhancements, etc.)
            const migrations = [
                {
                    path: '../database/migrations/002_autoapply_tables.sql',
                    label: '002_autoapply_tables.sql (Auto-Apply tables)'
                },
                {
                    path: '../database/migrations/003_add_email_to_profile.sql',
                    label: '003_add_email_to_profile.sql'
                },
                {
                    path: '../database/migrations/003_add_password_reset.sql',
                    label: '003_add_password_reset.sql'
                }
            ];

            for (const migration of migrations) {
                await runSqlFile(pool, migration.path, migration.label);
            }

            // Verify critical tables
            log.info('Verifying database setup...');
            const criticalTables = [
                'users',
                'password_reset_tokens',
                'magic_link_tokens',
                'autoapply_settings',
                'jobs',
                'applications',
                'job_queue'
            ];
            
            for (const tableName of criticalTables) {
                const result = await pool.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = $1
                    )
                `, [tableName]);
                
                if (!result.rows[0].exists) {
                    throw new Error(`Critical table ${tableName} is missing`);
                }
                log.success(`${tableName} table verified`);
            }

            log.success('🎉 Railway database setup completed successfully!');
            log.info('Password reset functionality should now work correctly.');

        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        log.error('Database setup failed:', error.message);
        
        // Provide helpful debugging information
        if (error.code) {
            log.error(`PostgreSQL Error Code: ${error.code}`);
        }
        
        if (error.message.includes('connect')) {
            log.error('Connection issue detected. Check your DATABASE_URL or database credentials.');
        }
        
        if (error.message.includes('permission')) {
            log.error('Permission issue detected. Check database user permissions.');
        }

        throw error;
    } finally {
        await pool.end();
        log.info('Database connection closed');
    }
}

// Execute if run directly
if (require.main === module) {
    setupRailwayDatabase()
        .then(() => {
            log.success('✅ Railway database setup completed');
            process.exit(0);
        })
        .catch((error) => {
            log.error('❌ Railway database setup failed:', error.message);
            process.exit(1);
        });
}

module.exports = { setupRailwayDatabase };
