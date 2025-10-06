#!/usr/bin/env node

/**
 * Database Connection Verification Script
 * 
 * This script verifies database connectivity and displays connection details.
 * It uses the environment-aware pool configuration from src/database/pool.js
 * 
 * Usage:
 *   node scripts/check-db-connection.js
 *   
 * On Railway:
 *   railway shell
 *   node scripts/check-db-connection.js
 */

// Load environment variables first
require('dotenv-flow').config();

const { Pool } = require('pg');

// Color codes for terminal output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(color, symbol, message) {
    console.log(`${colors[color]}${symbol} ${message}${colors.reset}`);
}

function success(message) {
    log('green', '✅', message);
}

function error(message) {
    log('red', '❌', message);
}

function info(message) {
    log('blue', 'ℹ️ ', message);
}

function warn(message) {
    log('yellow', '⚠️ ', message);
}

async function checkConnection() {
    console.log('\n' + '='.repeat(60));
    console.log('  DATABASE CONNECTION VERIFICATION');
    console.log('='.repeat(60) + '\n');

    // Check environment variables
    info('Checking environment configuration...');
    const NODE_ENV = process.env.NODE_ENV || 'development';
    const DATABASE_URL = process.env.DATABASE_URL;

    console.log(`   NODE_ENV: ${NODE_ENV}`);
    
    if (!DATABASE_URL) {
        error('DATABASE_URL is not set!');
        console.log('\n' + 'Please set DATABASE_URL environment variable:');
        console.log('   Local: postgres://user:password@localhost:5432/autoapply');
        console.log('   Production: postgres://user:password@postgres.railway.internal:5432/railway');
        console.log('   Staging: postgres://user:password@postgres.proxy.rlwy.net:5432/railway');
        process.exit(1);
    }

    // Parse DATABASE_URL to show connection details (without password)
    const urlMatch = DATABASE_URL.match(/postgres:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
    if (urlMatch) {
        const [, user, , host, port, database] = urlMatch;
        console.log(`   User: ${user}`);
        console.log(`   Host: ${host}`);
        console.log(`   Port: ${port || '5432'}`);
        console.log(`   Database: ${database}`);
    } else {
        warn('Could not parse DATABASE_URL format');
        console.log(`   DATABASE_URL: ${DATABASE_URL.substring(0, 30)}...`);
    }

    // Determine SSL configuration
    const isProduction = NODE_ENV === 'production';
    const sslConfig = isProduction ? { rejectUnauthorized: false } : false;
    console.log(`   SSL: ${isProduction ? 'enabled' : 'disabled'}\n`);

    // Create pool with same configuration as pool.js
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: sslConfig,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10
    });

    try {
        info('Attempting to connect to database...');
        
        // Test basic connection
        const startTime = Date.now();
        const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
        const duration = Date.now() - startTime;
        
        success(`Connection successful! (${duration}ms)\n`);
        
        // Display database information
        console.log('📊 Database Information:');
        console.log(`   Current Time: ${result.rows[0].current_time}`);
        console.log(`   PostgreSQL Version: ${result.rows[0].pg_version.split(',')[0]}\n`);

        // Test write capability
        info('Testing write capability...');
        await pool.query('CREATE TEMP TABLE test_write (id INT)');
        await pool.query('INSERT INTO test_write VALUES (1)');
        const writeResult = await pool.query('SELECT * FROM test_write');
        await pool.query('DROP TABLE test_write');
        
        if (writeResult.rows.length === 1 && writeResult.rows[0].id === 1) {
            success('Write test successful!\n');
        } else {
            error('Write test failed - unexpected result\n');
        }

        // Check for common tables (if they exist)
        info('Checking for application tables...');
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        
        if (tableCheck.rows.length > 0) {
            console.log(`   Found ${tableCheck.rows.length} tables:`);
            tableCheck.rows.forEach(row => {
                console.log(`      - ${row.table_name}`);
            });
        } else {
            warn('No application tables found - database may need initialization');
        }

        console.log('\n' + '='.repeat(60));
        success('DATABASE CONNECTION VERIFICATION COMPLETE');
        console.log('='.repeat(60) + '\n');

        await pool.end();
        process.exit(0);

    } catch (err) {
        console.log('\n' + '='.repeat(60));
        error('DATABASE CONNECTION FAILED');
        console.log('='.repeat(60) + '\n');
        
        console.error('Error Details:');
        console.error(`   Message: ${err.message}`);
        console.error(`   Code: ${err.code || 'N/A'}`);
        
        if (err.message.includes('ENOTFOUND')) {
            console.log('\n💡 Troubleshooting Tips:');
            console.log('   - Check that DATABASE_URL host is correct');
            console.log('   - Ensure network connectivity to database server');
            console.log('   - For Railway: Use postgres.railway.internal in production');
            console.log('   - For local: Use localhost or 127.0.0.1');
        } else if (err.message.includes('authentication failed')) {
            console.log('\n💡 Troubleshooting Tips:');
            console.log('   - Verify DATABASE_URL username and password');
            console.log('   - Check database user permissions');
        } else if (err.message.includes('SSL')) {
            console.log('\n💡 Troubleshooting Tips:');
            console.log('   - For production: SSL should be enabled automatically');
            console.log('   - For local: SSL should be disabled (set NODE_ENV=development)');
        }
        
        console.log('\n');
        await pool.end();
        process.exit(1);
    }
}

// Run the check
checkConnection();
