#!/usr/bin/env node

/**
 * Database Connection Verification Script
 *
 * This script verifies that the database connection is working correctly
 * in the current environment. It's useful for:
 * - Testing local development setup
 * - Verifying Railway/production connectivity
 * - Troubleshooting connection issues
 * - CI/CD health checks
 *
 * Usage:
 *   node scripts/check-db-connection.js
 *
 * On Railway:
 *   railway run node scripts/check-db-connection.js
 */

// Load the robust database pool
const { pool, testConnection, closePool, config } = require('../src/database/pool');

async function checkDatabaseConnection() {
    console.log('\n🔍 DATABASE CONNECTION CHECK\n');
    console.log(`Running in ${config.environment} environment\n`);

    try {
        // Test basic connectivity
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 1: Basic Connectivity');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const testResult = await testConnection();

        if (!testResult.success) {
            console.error('\n❌ Connection test failed. Exiting.\n');
            await closePool();
            process.exit(1);
        }

        // Test query execution
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 2: Query Execution');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const client = await pool.connect();
        console.log('✅ Client acquired from pool');

        const mathResult = await client.query('SELECT 2 + 2 as result');
        console.log(`✅ Query execution successful: 2 + 2 = ${mathResult.rows[0].result}`);

        client.release();
        console.log('✅ Client released back to pool\n');

        // Test schema access
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 3: Schema Access');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const tablesResult = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
            LIMIT 10
        `);

        if (tablesResult.rows.length === 0) {
            console.log('⚠️  No tables found in public schema');
            console.log('   This is normal for a fresh database.');
            console.log('   Run migrations to create tables.\n');
        } else {
            console.log(`✅ Found ${tablesResult.rows.length} table(s) in public schema:`);
            tablesResult.rows.forEach(row => {
                console.log(`   - ${row.table_name}`);
            });
            console.log('');
        }

        // Test critical tables (if they exist)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 4: Critical Tables Check');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const criticalTables = [
            'users',
            'jobs',
            'applications',
            'autoapply_sessions',
            'profile',
            'job_preferences'
        ];

        let missingTables = [];

        for (const tableName of criticalTables) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = $1
                )
            `, [tableName]);

            const exists = result.rows[0].exists;
            console.log(`${exists ? '✅' : '⚠️ '} ${tableName.padEnd(20)} ${exists ? 'EXISTS' : 'MISSING'}`);

            if (!exists) {
                missingTables.push(tableName);
            }
        }

        if (missingTables.length > 0) {
            console.log(`\n⚠️  ${missingTables.length} critical table(s) missing: ${missingTables.join(', ')}`);
            console.log('   Run migrations to create missing tables:');
            console.log('   → node scripts/run-all-migrations.js\n');
        } else {
            console.log('\n✅ All critical tables exist!\n');
        }

        // Test connection pool stats
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 5: Connection Pool Statistics');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        console.log(`Total connections:    ${pool.totalCount}`);
        console.log(`Idle connections:     ${pool.idleCount}`);
        console.log(`Waiting requests:     ${pool.waitingCount}\n`);

        // Summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Database connection is HEALTHY');
        console.log(`✅ Environment: ${config.environment}`);
        console.log(`✅ SSL: ${config.isProduction ? 'Enabled' : 'Disabled'}`);

        if (missingTables.length > 0) {
            console.log(`⚠️  Action needed: Run migrations to create ${missingTables.length} missing table(s)`);
        } else {
            console.log('✅ All critical tables present');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Exit successfully
        await closePool();
        process.exit(0);

    } catch (error) {
        console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ DATABASE CONNECTION CHECK FAILED');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error(`Error: ${error.message}`);
        console.error(`Code: ${error.code || 'Unknown'}`);

        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }

        console.error('\n🔍 TROUBLESHOOTING TIPS:\n');

        if (error.code === 'ENOTFOUND') {
            console.error('❌ Database host not found');
            console.error('   → Check DATABASE_URL or PGHOST is set correctly');
            console.error('   → In production: Use internal hostname (postgres.railway.internal)');
            console.error('   → In development: Use localhost or 127.0.0.1');
            console.error(`   → Current environment: ${config.environment}`);

        } else if (error.code === 'ECONNREFUSED') {
            console.error('❌ Connection refused');
            console.error('   → Ensure PostgreSQL is running');
            console.error('   → Check the port (default: 5432)');
            console.error('   → Verify firewall settings');

        } else if (error.code === 'ETIMEDOUT') {
            console.error('❌ Connection timeout');
            console.error('   → Check network connectivity');
            console.error('   → Verify the database is accessible from this environment');
            console.error('   → Consider increasing DB_CONNECTION_TIMEOUT');

        } else if (error.message.includes('password authentication failed')) {
            console.error('❌ Authentication failed');
            console.error('   → Check PGUSER and PGPASSWORD');
            console.error('   → Verify DATABASE_URL contains correct credentials');

        } else if (error.message.includes('database') && error.message.includes('does not exist')) {
            console.error('❌ Database does not exist');
            console.error('   → Check PGDATABASE name');
            console.error('   → Create the database if it doesn\'t exist');

        } else {
            console.error('❌ Unexpected error');
            console.error('   → Check your .env file is present and correct');
            console.error('   → Verify all database environment variables');
            console.error('   → Check database server logs for more details');
        }

        console.error('\n💡 Environment Variables Expected:');
        console.error('   - DATABASE_URL (connection string) OR');
        console.error('   - PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD');
        console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await closePool();
        process.exit(1);
    }
}

// Run the check
checkDatabaseConnection();
