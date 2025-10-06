#!/usr/bin/env node

/**
 * Database Diagnostic and Fix Script
 * Run this on Railway to diagnose and fix missing tables
 */

// Load environment variables using dotenv-flow for environment detection
require('dotenv-flow').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function diagnoseAndFix() {
    console.log('🔍 Starting Database Diagnostic...\n');

    // Check environment
    console.log('📋 Environment Check:');
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
    console.log(`   PGHOST: ${process.env.PGHOST || 'Not set'}`);
    console.log(`   PGDATABASE: ${process.env.PGDATABASE || 'Not set'}`);
    console.log('');

    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
        console.log('❌ No database configuration found!');
        console.log('   Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE');
        process.exit(1);
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
        // 1. Test connection
        console.log('🔌 Testing database connection...');
        const timeResult = await pool.query('SELECT NOW()');
        console.log(`✅ Connected to database at ${timeResult.rows[0].now}\n`);

        // 2. List all tables
        console.log('📊 Existing tables:');
        const tablesResult = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        if (tablesResult.rows.length === 0) {
            console.log('   ⚠️  No tables found!\n');
        } else {
            tablesResult.rows.forEach(row => {
                console.log(`   - ${row.table_name}`);
            });
            console.log('');
        }

        // 3. Check critical tables
        console.log('🔍 Checking critical tables:');
        const criticalTables = ['users', 'jobs', 'applications', 'autoapply_sessions'];
        const missingTables = [];

        for (const table of criticalTables) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = $1
                )
            `, [table]);

            const exists = result.rows[0].exists;
            console.log(`   ${exists ? '✅' : '❌'} ${table}`);
            if (!exists) missingTables.push(table);
        }
        console.log('');

        // 4. Test the failing query
        if (missingTables.includes('jobs') || missingTables.includes('applications')) {
            console.log('⚠️  Missing jobs/applications tables - cannot test analytics query\n');
        } else {
            console.log('🧪 Testing analytics query...');
            try {
                const analyticsResult = await pool.query(`
                    SELECT
                        COUNT(*) as total,
                        COUNT(CASE WHEN j.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as this_week,
                        COUNT(CASE WHEN j.created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as today,
                        COUNT(CASE WHEN a.application_id IS NOT NULL THEN 1 END) as applied,
                        COUNT(CASE WHEN a.application_id IS NULL THEN 1 END) as available
                    FROM jobs j
                    LEFT JOIN applications a ON j.job_id = a.job_id AND a.user_id = 1
                    WHERE (j.user_id = 1 OR j.user_id IS NULL)
                    AND j.created_at >= NOW() - make_interval(days => 30)
                `);
                console.log('✅ Analytics query succeeded!');
                console.log(`   Results: ${JSON.stringify(analyticsResult.rows[0])}\n`);
            } catch (error) {
                console.log(`❌ Analytics query failed: ${error.message}\n`);
            }
        }

        // 5. Offer to fix if tables are missing
        if (missingTables.length > 0) {
            console.log('🔧 Attempting to fix missing tables...\n');

            // Run migrations
            const migrations = [
                { file: '../database/schema.sql', name: 'Base Schema' },
                { file: '../database/migrations/002_autoapply_tables.sql', name: 'Jobs & Applications' },
                { file: '../database/migrations/003_add_email_to_profile.sql', name: 'Email to Profile' },
                { file: '../database/migrations/003_add_password_reset.sql', name: 'Password Reset' },
                { file: '../database/migrations/004_add_user_id_to_jobs.sql', name: 'User ID to Jobs' },
                { file: '../database/migrations/005_enhanced_autoapply_tables.sql', name: 'Enhanced Tables' }
            ];

            for (const migration of migrations) {
                const migrationPath = path.join(__dirname, migration.file);

                if (!fs.existsSync(migrationPath)) {
                    console.log(`   ⏭️  Skipping ${migration.name} - file not found`);
                    continue;
                }

                console.log(`   🚀 Running ${migration.name}...`);
                const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

                try {
                    await pool.query(migrationSQL);
                    console.log(`   ✅ ${migration.name} completed`);
                } catch (error) {
                    if (error.message.includes('already exists')) {
                        console.log(`   ℹ️  ${migration.name} - already exists (skipped)`);
                    } else {
                        console.log(`   ❌ ${migration.name} failed: ${error.message}`);
                    }
                }
            }

            console.log('\n🔍 Re-checking tables after fix...');
            for (const table of criticalTables) {
                const result = await pool.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = $1
                    )
                `, [table]);

                const exists = result.rows[0].exists;
                console.log(`   ${exists ? '✅' : '❌'} ${table}`);
            }
            console.log('');
        }

        console.log('✅ Diagnostic complete!\n');

    } catch (error) {
        console.log('❌ Diagnostic failed:', error.message);
        console.log('Stack:', error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

diagnoseAndFix().catch(console.error);
