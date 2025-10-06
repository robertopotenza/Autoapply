/**
 * Database Schema Verification Test
 * This test is designed to be run in CI/CD to ensure schema compatibility
 */

const { Pool } = require('pg');
const { verifySchema } = require('../src/utils/verifySchema');
require('dotenv').config();

async function runVerification() {
    console.log('🔍 Starting database schema verification test...\n');
    
    // Check if database is configured
    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
        console.log('⚠️  No database configuration found.');
        console.log('   Set DATABASE_URL or PGHOST environment variables to run this test.');
        console.log('   Skipping schema verification...\n');
        process.exit(0); // Exit successfully for environments without DB
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

        // Run schema verification
        console.log('🔍 Verifying database schema...');
        await verifySchema(pool);
        
        console.log('\n✅ Schema verification test passed!');
        console.log('   All required tables and columns are present.\n');
        
        await pool.end();
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Schema verification test failed!');
        console.error('   Error:', error.message);
        console.error('\n   Please run migrations or check your database schema:');
        console.error('   $ node scripts/run-all-migrations.js\n');
        
        await pool.end();
        process.exit(1);
    }
}

// Run verification if called directly
if (require.main === module) {
    runVerification();
}

module.exports = { runVerification };
