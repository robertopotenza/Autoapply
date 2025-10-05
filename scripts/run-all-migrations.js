#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Comprehensive database setup script
 * Runs all migrations in order to set up the complete database schema
 */

async function runAllMigrations() {
    console.log('🚀 Starting comprehensive database migration...\n');
    
    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
        console.log('❌ No database configuration found.');
        console.log('   Please set DATABASE_URL or PGHOST environment variables.');
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
        console.log('🔌 Testing database connection...');
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful\n');

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
            
            // Check if file exists
            if (!fs.existsSync(migrationPath)) {
                console.log(`⚠️  Skipping ${migration.name} - file not found`);
                continue;
            }

            console.log(`📄 Running: ${migration.name}`);
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
            
            try {
                await pool.query(migrationSQL);
                console.log(`✅ Completed: ${migration.name}\n`);
            } catch (error) {
                // Some migrations may fail if tables already exist, which is okay with IF NOT EXISTS
                if (error.message.includes('already exists')) {
                    console.log(`ℹ️  ${migration.name} - tables already exist (skipped)\n`);
                } else {
                    console.error(`❌ Failed: ${migration.name}`);
                    console.error(`   Error: ${error.message}\n`);
                }
            }
        }

        // Verify critical tables exist
        console.log('🔍 Verifying database structure...\n');
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

        console.log('📋 Critical tables:');
        let allTablesExist = true;
        for (const table of criticalTables) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                )
            `, [table]);
            
            const exists = result.rows[0].exists;
            console.log(`   ${exists ? '✅' : '❌'} ${table}`);
            if (!exists) allTablesExist = false;
        }

        // Verify views
        console.log('\n📊 Database views:');
        const views = ['user_complete_profile', 'user_application_stats', 'user_autoapply_stats'];
        for (const view of views) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.views 
                    WHERE table_name = $1
                )
            `, [view]);
            
            const exists = result.rows[0].exists;
            console.log(`   ${exists ? '✅' : '⚠️ '} ${view}`);
        }

        console.log('\n' + (allTablesExist ? '✅' : '⚠️ ') + ' Database migration completed!\n');
        return allTablesExist;

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Stack trace:', error.stack);
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
                console.log('✨ All migrations completed successfully!');
                process.exit(0);
            } else {
                console.log('⚠️  Migration completed with warnings. Please review the output above.');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runAllMigrations };
