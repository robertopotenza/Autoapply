#!/usr/bin/env node

/**
 * Migration 004: Add user_id to jobs table
 * 
 * This migration adds optional user_id column to jobs table to support:
 * 1. User-specific jobs: Jobs created/saved by individual users (user_id set)
 * 2. Global jobs: Jobs discovered from job boards available to all users (user_id IS NULL)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv-flow').config();

async function runMigration004() {
    console.log('🚀 Running Migration 004: Add user_id to jobs table\n');
    
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

        // Check if jobs table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'jobs'
            )
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('❌ Jobs table does not exist. Please run base migrations first.');
            return false;
        }

        console.log('📋 Jobs table exists\n');

        // Check if user_id column already exists
        const columnCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'jobs' 
                AND column_name = 'user_id'
            )
        `);

        if (columnCheck.rows[0].exists) {
            console.log('ℹ️  Migration 004 already applied - user_id column exists');
            console.log('✅ No changes needed\n');
            return true;
        }

        // Read and execute migration
        console.log('📄 Reading migration file...');
        const migrationPath = path.join(__dirname, '../database/migrations/004_add_user_id_to_jobs.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('⚙️  Applying migration...');
        await pool.query(migrationSQL);
        console.log('✅ Migration 004 applied successfully\n');

        // Verify migration
        console.log('🔍 Verifying migration...');
        const verifyColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'jobs' 
            AND column_name IN ('user_id', 'source', 'external_id')
            ORDER BY column_name
        `);

        console.log('📊 New columns:');
        verifyColumns.rows.forEach(col => {
            console.log(`   ✅ ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        });

        // Verify indexes
        const verifyIndexes = await pool.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'jobs' 
            AND indexname IN ('idx_jobs_user_id', 'idx_jobs_source_external_id')
        `);

        console.log('\n📊 New indexes:');
        verifyIndexes.rows.forEach(idx => {
            console.log(`   ✅ ${idx.indexname}`);
        });

        console.log('\n✅ Migration 004 completed successfully!\n');
        console.log('📝 Summary:');
        console.log('   - Added user_id column (nullable, references users table)');
        console.log('   - Added source column for job board tracking');
        console.log('   - Added external_id column for deduplication');
        console.log('   - Created indexes for performance');
        console.log('   - Added column comments for documentation\n');

        return true;

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
    runMigration004()
        .then(success => {
            if (success) {
                console.log('✨ Migration 004 completed successfully!');
                process.exit(0);
            } else {
                console.log('⚠️  Migration 004 failed. Please review the output above.');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runMigration004 };
