/**
 * Database Connection Pool
 * 
 * This module provides a robust, environment-aware PostgreSQL connection pool.
 * It automatically detects the environment and configures SSL accordingly.
 * 
 * Environment Detection:
 * - Local (development): Uses local DATABASE_URL without SSL
 * - Staging: Uses public Railway endpoint (.app host)
 * - Production: Uses internal Railway endpoint (.internal host) with SSL
 */

const { Pool } = require('pg');

// Ensure environment variables are loaded
// This should be called from the entry point before importing this module
if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not set - database connection may fail');
}

// Detect environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isDevelopment = NODE_ENV === 'development';

// Configure SSL based on environment
// Production (Railway internal): SSL with rejectUnauthorized: false
// Development (local): No SSL
const sslConfig = isProduction ? { rejectUnauthorized: false } : false;

// Create the connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10
});

// Log connection details on startup
pool.on('connect', () => {
    const dbUrl = process.env.DATABASE_URL || 'NOT_SET';
    const host = dbUrl.includes('@') ? dbUrl.split('@')[1].split('/')[0] : 'unknown';
    
    console.log('✅ Database connection established');
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   Host: ${host}`);
    console.log(`   SSL: ${isProduction ? 'enabled' : 'disabled'}`);
});

// Log connection errors
pool.on('error', (err) => {
    console.error('❌ Unexpected database error on idle client:', err.message);
    console.error('   This may indicate network issues or database unavailability');
});

// Test connection on module load (non-blocking)
(async () => {
    try {
        const result = await pool.query('SELECT NOW() as current_time');
        console.log(`✅ Database connection verified at ${result.rows[0].current_time}`);
    } catch (error) {
        console.error('❌ Database connection test failed:', error.message);
        console.error('   Please check DATABASE_URL and network connectivity');
    }
})();

// Export the pool instance
module.exports = pool;
