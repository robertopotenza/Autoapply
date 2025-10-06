#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Comprehensive database setup script
 * Runs all migrations in order to set up the complete database schema
 */

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'migrations.log');

// Helper function to log both to console and file
function logMessage(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} ${message}\n`;
    console.log(message);
    fs.appendFileSync(logFilePath, logEntry, 'utf8');
}

async function runAllMigrations() {
    logMessage('🚀 Starting comprehensive database migration...\n');
    
    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
        logMessage('❌ No database configuration found.');
        logMessage('   Please set DATABASE_URL or PGHOST environment variables.');
        return false;
    }

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
        logMessage('🔌 Testing database connection...');
        await pool.query('SELECT NOW()');
        logMessage('✅ Database connection successful\n');

        // Create schema_migrations table if it doesn't exist
        logMessage('📋 Creating schema_migrations table if not exists...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename TEXT NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT NOW()
            )
        `);
        logMessage('✅ schema_migrations table ready\n');

        // Migrations to run in order
        const migrations = [
            { file: '../database/schema.sql', name: 'Base Schema (users, profile, preferences)' },
            { file: '../database/migrations/002_autoapply_tables.sql', name: 'Migration 002: Jobs & Applications tables' },
            { file: '../database/migrations/003_add_email_to_profile.sql', name: 'Migration 003: Add email to profile' },
            { file: '../database/migrations/003_add_password_reset.sql', name: 'Migration 003b: Password reset tokens' },
            { file: '../database/migrations/004_add_user_id_to_jobs.sql', name: 'Migration 004: Add user_id to jobs' },
            { file: '../database/migrations/005_enhanced_autoapply_tables.sql', name: 'Migration 005: Enhanced autoapply tables' }
        ];

        // Run each migration
        for (const migration of migrations) {
            const migrationPath = path.join(__dirname, migration.file);
            const filename = path.basename(migration.file);
            
            // Check if migration was already applied
            const appliedCheck = await pool.query(
                'SELECT filename FROM schema_migrations WHERE filename = $1',
                [filename]
            );
            
            if (appliedCheck.rows.length > 0) {
                logMessage(`⏭️  Skipping ${migration.name} - already applied`);
                continue;
            }
            
            // Check if file exists
            if (!fs.existsSync(migrationPath)) {
                logMessage(`⚠️  Skipping ${migration.name} - file not found`);
                continue;
            }

            const startTime = Date.now();
            logMessage(`🚀 Running migration ${filename}`);
            logMessage(`   ${migration.name}`);
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
            
            try {
                await pool.query(migrationSQL);
                const duration = Date.now() - startTime;
                const completedAt = new Date().toISOString();
                logMessage(`✅ Completed ${filename} at ${completedAt} (${duration}ms)\n`);
                
                // Record the migration
                await pool.query(
                    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
                    [filename]
                );
            } catch (error) {
                // Some migrations may fail if tables already exist, which is okay with IF NOT EXISTS
                if (error.message.includes('already exists')) {
                    logMessage(`ℹ️  ${migration.name} - tables already exist (skipped)\n`);
                    // Still record it as applied
                    await pool.query(
                        'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
                        [filename]
                    );
                } else {
                    logMessage(`❌ Migration failed: ${filename}`);
                    logMessage(`   Error: ${error.message}\n`);
                    // Don't exit immediately, but track that there was a failure
                    throw error;
                }
            }
        }

        // Verify critical tables exist
        logMessage('🔍 Verifying database structure...\n');
        const criticalTables = [
            'users',
            'job_preferences',
            'profile',
            'eligibility',
            'screening_answers',
            'jobs',
            'applications',
            'autoapply_sessions',
            'user_autoapply_status',
            'autoapply_config'
        ];

        logMessage('📋 Critical tables:');
        let allTablesExist = true;
        for (const table of criticalTables) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                )
            `, [table]);
            
            const exists = result.rows[0].exists;
            logMessage(`   ${exists ? '✅' : '❌'} ${table}`);
            if (!exists) allTablesExist = false;
        }

        // Verify views
        logMessage('\n📊 Database views:');
        const views = ['user_complete_profile', 'user_application_stats', 'user_autoapply_stats'];
        for (const view of views) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.views 
                    WHERE table_name = $1
                )
            `, [view]);
            
            const exists = result.rows[0].exists;
            logMessage(`   ${exists ? '✅' : '⚠️ '} ${view}`);
        }

        logMessage('\n' + (allTablesExist ? '✅' : '⚠️ ') + ' Database migration completed!\n');
        return allTablesExist;

    } catch (error) {
        logMessage('❌ Migration failed: ' + error.message);
        logMessage('Stack trace: ' + error.stack);
        return false;
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    runAllMigrations()
        .then(success => {
            if (success) {
                logMessage('✨ All migrations completed successfully!');
                process.exit(0);
            } else {
                logMessage('⚠️  Migration completed with warnings. Please review the output above.');
                process.exit(1);
            }
        })
        .catch(error => {
            logMessage('Fatal error: ' + error.message);
            process.exit(1);
        });
}

module.exports = { runAllMigrations };
