#!/usr/bin/env node

/**
 * Database Schema Fix Script
 * 
 * This script fixes the database schema issues causing password reset failures.
 * It ensures all required tables and columns exist in the correct order.
 * 
 * Usage: node scripts/fix-database-schema.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv-flow').config();

const { Logger } = require('../src/utils/logger');
const logger = new Logger('DatabaseFix');

async function fixDatabaseSchema() {
    logger.info('🔧 Starting database schema fix...');

    // Database connection configuration
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || undefined,
        host: process.env.PGHOST,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE || 'railway',
        port: process.env.PGPORT || 5432,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // Test connection
        logger.info('📡 Testing database connection...');
        await pool.query('SELECT NOW()');
        logger.info('✅ Database connection successful');

        // Step 1: Create base schema (users table first)
        logger.info('🏗️  Step 1: Creating base users table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✅ Users table created/verified');

        // Step 2: Create authentication tables
        logger.info('🔐 Step 2: Creating authentication tables...');
        
        // Magic link tokens
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
        
        // Password reset tokens (the missing table causing the error)
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
        logger.info('✅ Authentication tables created/verified');

        // Step 3: Create user profile tables
        logger.info('👤 Step 3: Creating user profile tables...');
        
        // Job preferences
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

        // Profile table
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

        // Eligibility table
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

        // Screening answers table
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
        logger.info('✅ User profile tables created/verified');

        // Step 4: Create indexes for performance
        logger.info('📊 Step 4: Creating database indexes...');
        
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_magic_link_token ON magic_link_tokens(token)',
            'CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link_tokens(email)',
            'CREATE INDEX IF NOT EXISTS idx_magic_link_expires ON magic_link_tokens(expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token)',
            'CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_tokens(email)',
            'CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_job_preferences_user_id ON job_preferences(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_profile_user_id ON profile(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_profile_email ON profile(email)',
            'CREATE INDEX IF NOT EXISTS idx_eligibility_user_id ON eligibility(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_screening_answers_user_id ON screening_answers(user_id)'
        ];

        for (const indexQuery of indexes) {
            await pool.query(indexQuery);
        }
        logger.info('✅ Database indexes created/verified');

        // Step 5: Create the user complete profile view
        logger.info('🔍 Step 5: Creating user profile view...');
        await pool.query(`
            CREATE OR REPLACE VIEW user_complete_profile AS
            SELECT
                u.user_id,
                u.email,
                u.created_at,
                jp.remote_jobs,
                jp.onsite_location,
                jp.job_types,
                jp.job_titles,
                jp.seniority_levels,
                jp.time_zones,
                p.full_name,
                p.email as profile_email,
                p.resume_path,
                p.cover_letter_option,
                p.phone,
                p.country,
                p.city,
                p.state_region,
                p.postal_code,
                e.current_job_title,
                e.availability,
                e.eligible_countries,
                e.visa_sponsorship,
                e.nationality,
                e.current_salary,
                e.expected_salary,
                sa.experience_summary,
                sa.hybrid_preference,
                sa.travel,
                sa.relocation,
                sa.languages,
                sa.date_of_birth,
                sa.gpa,
                sa.is_adult,
                sa.gender_identity,
                sa.disability_status,
                sa.military_service,
                sa.ethnicity,
                sa.driving_license
            FROM users u
            LEFT JOIN job_preferences jp ON u.user_id = jp.user_id
            LEFT JOIN profile p ON u.user_id = p.user_id
            LEFT JOIN eligibility e ON u.user_id = e.user_id
            LEFT JOIN screening_answers sa ON u.user_id = sa.user_id;
        `);
        logger.info('✅ User profile view created/verified');

        // Step 6: Verify the fix by testing the password reset table
        logger.info('🧪 Step 6: Testing password reset functionality...');
        
        const testResult = await pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'password_reset_tokens' 
            ORDER BY ordinal_position;
        `);
        
        if (testResult.rows.length === 0) {
            throw new Error('Password reset tokens table was not created properly');
        }
        
        logger.info('✅ Password reset table structure verified:');
        testResult.rows.forEach(row => {
            logger.info(`   - ${row.column_name}: ${row.data_type}`);
        });

        // Step 7: Test inserting a dummy token (and immediately delete it)
        logger.info('🧪 Step 7: Testing password reset token insertion...');
        
        const testToken = 'test_token_' + Date.now();
        const testEmail = 'test@example.com';
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
        
        await pool.query(`
            INSERT INTO password_reset_tokens (email, token, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id, email, token, expires_at, created_at
        `, [testEmail, testToken, expiresAt]);
        
        // Clean up test data
        await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [testToken]);
        
        logger.info('✅ Password reset token insertion test successful');

        // Final verification
        logger.info('🎯 Final verification: Checking all critical tables...');
        const criticalTables = [
            'users',
            'password_reset_tokens',
            'magic_link_tokens',
            'job_preferences',
            'profile',
            'eligibility',
            'screening_answers'
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
            logger.info(`   ✅ ${tableName} table exists`);
        }

        logger.info('🎉 Database schema fix completed successfully!');
        logger.info('');
        logger.info('📋 Summary of changes:');
        logger.info('   ✅ Created/verified users table with email column');
        logger.info('   ✅ Created/verified password_reset_tokens table');
        logger.info('   ✅ Created/verified magic_link_tokens table');
        logger.info('   ✅ Created/verified all user profile tables');
        logger.info('   ✅ Created/verified all database indexes');
        logger.info('   ✅ Created/verified user_complete_profile view');
        logger.info('   ✅ Tested password reset token functionality');
        logger.info('');
        logger.info('🚀 Your password reset should now work correctly!');
        
    } catch (error) {
        logger.error('❌ Database schema fix failed:', error.message);
        logger.error('Stack trace:', error.stack);
        throw error;
    } finally {
        await pool.end();
        logger.info('📡 Database connection closed');
    }
}

// Run the fix if this script is executed directly
if (require.main === module) {
    fixDatabaseSchema()
        .then(() => {
            logger.info('✅ Database schema fix completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('❌ Fatal error during database schema fix:', error);
            process.exit(1);
        });
}

module.exports = { fixDatabaseSchema };
