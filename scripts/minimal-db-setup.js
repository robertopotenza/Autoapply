#!/usr/bin/env node

/**
 * Minimal Database Setup Script for Railway
 * 
 * This script creates only the essential tables needed for password reset functionality.
 * It avoids complex column references and focuses on the core issue.
 */

const { Pool } = require('pg');
require('dotenv').config();

console.log('🚀 Minimal Database Setup Starting...');
console.log('📅 Timestamp:', new Date().toISOString());

const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`)
};

async function setupMinimalDatabase() {
    log.info('Checking environment variables...');
    
    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
        log.error('No database configuration found!');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || undefined,
        host: process.env.PGHOST,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE || 'railway',
        port: process.env.PGPORT || 5432,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10
    });

    try {
        log.info('Testing database connection...');
        await pool.query('SELECT NOW()');
        log.success('Database connection successful');

        log.info('Starting minimal database schema setup...');
        await pool.query('BEGIN');

        try {
            // 1. Create users table (essential)
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

            // 2. Create password reset tokens table (THE MISSING TABLE)
            log.info('Creating password_reset_tokens table...');
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

            // 3. Create magic link tokens table
            log.info('Creating magic_link_tokens table...');
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

            // 4. Create essential indexes only
            log.info('Creating essential indexes...');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_tokens(email)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_magic_link_token ON magic_link_tokens(token)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link_tokens(email)');

            // Commit transaction
            await pool.query('COMMIT');
            log.success('Database schema setup completed successfully!');

            // Verify critical tables
            log.info('Verifying database setup...');
            const criticalTables = ['users', 'password_reset_tokens', 'magic_link_tokens'];
            
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

            log.success('🎉 Minimal database setup completed successfully!');
            log.info('Password reset functionality should now work correctly.');

        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        log.error('Database setup failed:', error.message);
        
        if (error.code) {
            log.error(`PostgreSQL Error Code: ${error.code}`);
        }
        
        throw error;
    } finally {
        await pool.end();
        log.info('Database connection closed');
    }
}

// Execute if run directly
if (require.main === module) {
    setupMinimalDatabase()
        .then(() => {
            log.success('✅ Minimal database setup completed');
            process.exit(0);
        })
        .catch((error) => {
            log.error('❌ Minimal database setup failed:', error.message);
            process.exit(1);
        });
}

module.exports = { setupMinimalDatabase };
