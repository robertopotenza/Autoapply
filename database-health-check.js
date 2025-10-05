#!/usr/bin/env node

/**
 * Database Health Check Script
 * Tests database connectivity and reports configuration status
 */

require('dotenv').config();
const { Pool } = require('pg');

async function checkDatabaseHealth() {
    console.log('🔍 Database Health Check');
    console.log('========================');
    
    // Check environment variables
    console.log('\n📋 Environment Variables:');
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    
    if (!process.env.DATABASE_URL) {
        console.log('\n❌ DATABASE_URL is not configured');
        console.log('This is likely the cause of the database connection issues.');
        process.exit(1);
    }

    // Test database connection
    console.log('\n🔌 Testing Database Connection...');
    
    let pool = null;
    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Test basic connectivity
        const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
        console.log('✅ Database connection successful!');
        console.log(`   Time: ${result.rows[0].current_time}`);
        console.log(`   Version: ${result.rows[0].postgres_version.split(' ')[0]}`);

        // Test if required tables exist
        console.log('\n📊 Checking Database Schema...');
        const tables = ['users', 'jobs', 'applications', 'autoapply_settings'];
        
        for (const table of tables) {
            try {
                await pool.query(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
                console.log(`   ✅ ${table} table exists`);
            } catch (error) {
                console.log(`   ❌ ${table} table missing or inaccessible`);
            }
        }

    } catch (error) {
        console.log('❌ Database connection failed!');
        console.log(`   Error: ${error.message}`);
        console.log(`   Code: ${error.code || 'Unknown'}`);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('   Cause: Database server is not reachable');
        } else if (error.code === 'ENOTFOUND') {
            console.log('   Cause: Database host not found');
        } else if (error.message.includes('authentication')) {
            console.log('   Cause: Authentication failed - check credentials');
        }
        
        process.exit(1);
    } finally {
        if (pool) {
            await pool.end();
        }
    }

    console.log('\n✅ Database health check completed successfully!');
}

// Run the health check
checkDatabaseHealth().catch(error => {
    console.error('Health check failed:', error);
    process.exit(1);
});
