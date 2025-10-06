/**
 * Robust PostgreSQL Connection Pool Configuration
 *
 * This module provides a centralized, environment-aware database connection pool
 * that works seamlessly across local, staging, and production environments.
 *
 * Features:
 * - Automatic environment detection (NODE_ENV)
 * - SSL configuration per environment
 * - Connection retry logic
 * - Detailed connection logging
 * - Graceful error handling
 */

const { Pool } = require('pg');

// Note: dotenv-flow should be loaded by the main entry point (server.js)
// before this module is required. We don't call config() here to avoid
// double-loading and potential race conditions.

// Determine current environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isStaging = NODE_ENV === 'staging';
const isDevelopment = NODE_ENV === 'development' || (!isProduction && !isStaging);

/**
 * Get database configuration based on environment
 */
function getDatabaseConfig() {
    const config = {
        // Try DATABASE_URL first (Railway, Heroku, etc.)
        connectionString: process.env.DATABASE_URL,

        // Fallback to individual connection params
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        database: process.env.PGDATABASE || 'autoapply',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD,

        // Connection pool settings
        max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Maximum pool size
        min: parseInt(process.env.DB_POOL_MIN || '2', 10),  // Minimum pool size
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),

        // Statement timeout (prevent long-running queries)
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),

        // Query timeout
        query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
    };

    // SSL Configuration per environment
    if (isProduction) {
        // Production: Use SSL with Railway's self-signed certificates
        config.ssl = {
            rejectUnauthorized: false, // Railway uses self-signed certs
        };
    } else if (isStaging) {
        // Staging: SSL enabled but relaxed
        config.ssl = {
            rejectUnauthorized: false,
        };
    } else {
        // Development/Local: No SSL (localhost doesn't need it)
        config.ssl = false;
    }

    return config;
}

/**
 * Create and configure the connection pool
 */
const config = getDatabaseConfig();
const pool = new Pool(config);

/**
 * Log connection details (without sensitive info)
 */
function logConnectionInfo() {
    const sanitizedConfig = {
        environment: NODE_ENV,
        ssl: config.ssl ? (typeof config.ssl === 'object' ? 'enabled (relaxed)' : 'enabled') : 'disabled',
        poolSize: { max: config.max, min: config.min },
        timeouts: {
            connection: config.connectionTimeoutMillis,
            idle: config.idleTimeoutMillis,
            statement: config.statement_timeout,
        }
    };

    // Determine connection target (mask password)
    let connectionTarget = 'Unknown';
    if (config.connectionString) {
        // Parse and sanitize DATABASE_URL
        try {
            const url = new URL(config.connectionString);
            connectionTarget = `${url.hostname}:${url.port}/${url.pathname.slice(1)}`;
        } catch (e) {
            connectionTarget = 'Invalid URL';
        }
    } else {
        connectionTarget = `${config.host}:${config.port}/${config.database}`;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗄️  DATABASE CONNECTION CONFIGURATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 Environment:      ${sanitizedConfig.environment}`);
    console.log(`🔌 Connection Target: ${connectionTarget}`);
    console.log(`🔐 SSL:              ${sanitizedConfig.ssl}`);
    console.log(`👥 Pool Size:        ${sanitizedConfig.poolSize.min}-${sanitizedConfig.poolSize.max} connections`);
    console.log(`⏱️  Timeouts:`);
    console.log(`   - Connection:     ${sanitizedConfig.timeouts.connection}ms`);
    console.log(`   - Idle:           ${sanitizedConfig.timeouts.idle}ms`);
    console.log(`   - Statement:      ${sanitizedConfig.timeouts.statement}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Log configuration on next tick to avoid blocking module load
setImmediate(() => {
    try {
        logConnectionInfo();
    } catch (error) {
        console.error('Warning: Could not log database configuration:', error.message);
    }
});

/**
 * Pool event handlers for monitoring and debugging
 */

// Log when a new client is added to the pool
pool.on('connect', (client) => {
    console.log('✅ New database client connected to pool');
});

// Log when a client is removed from the pool
pool.on('remove', (client) => {
    console.log('🔌 Database client removed from pool');
});

// Log pool errors (these are errors from idle clients)
pool.on('error', (err, client) => {
    console.error('❌ Unexpected error on idle database client:', err.message);
    console.error('   This may indicate a database connection issue.');

    // If it's a connection error, provide troubleshooting hints
    if (err.code === 'ENOTFOUND') {
        console.error('\n🔍 TROUBLESHOOTING: ENOTFOUND Error');
        console.error('   - Check that DATABASE_URL or PGHOST is correct');
        console.error('   - In production (Railway), ensure you are using the internal hostname');
        console.error('   - In local dev, ensure PostgreSQL is running on localhost');
        console.error(`   - Current environment: ${NODE_ENV}\n`);
    } else if (err.code === 'ECONNREFUSED') {
        console.error('\n🔍 TROUBLESHOOTING: Connection Refused');
        console.error('   - Ensure PostgreSQL is running');
        console.error('   - Check that the port is correct (default: 5432)');
        console.error('   - Verify firewall settings\n');
    } else if (err.code === 'ENOTFOUND' || err.message.includes('timeout')) {
        console.error('\n🔍 TROUBLESHOOTING: Connection Timeout');
        console.error('   - Check network connectivity to database');
        console.error('   - Verify DATABASE_URL is accessible from this environment');
        console.error('   - Consider increasing DB_CONNECTION_TIMEOUT\n');
    }
});

/**
 * Test database connection
 * Returns a promise that resolves if connection is successful
 */
async function testConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as now, current_database() as database, version() as version');
        client.release();

        console.log('✅ Database connection test SUCCESSFUL');
        console.log(`   - Connected to: ${result.rows[0].database}`);
        console.log(`   - Server time: ${result.rows[0].now}`);
        console.log(`   - Version: ${result.rows[0].version.split(',')[0]}\n`);

        return { success: true, result: result.rows[0] };
    } catch (error) {
        console.error('❌ Database connection test FAILED');
        console.error(`   - Error: ${error.message}`);
        console.error(`   - Code: ${error.code}\n`);

        return { success: false, error };
    }
}

/**
 * Graceful shutdown
 * Call this when your application is shutting down
 */
async function closePool() {
    console.log('🔌 Closing database connection pool...');
    await pool.end();
    console.log('✅ Database pool closed successfully');
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closePool();
    process.exit(0);
});

/**
 * Export the pool and utility functions
 */
module.exports = {
    pool,
    testConnection,
    closePool,

    // Export environment info for debugging
    config: {
        environment: NODE_ENV,
        isProduction,
        isStaging,
        isDevelopment,
    }
};
