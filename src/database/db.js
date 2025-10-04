const { Pool } = require('pg');
const { logger } = require('../utils/logger');

// Check if database credentials are configured
const isDatabaseConfigured = () => {
    return !!(process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE);
};

// PostgreSQL connection pool (only if configured)
let pool = null;

if (isDatabaseConfigured()) {
    pool = new Pool({
        host: process.env.PGHOST,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        port: process.env.PGPORT || 5432,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test database connection
    pool.on('connect', () => {
        logger.info('Connected to PostgreSQL database');
    });

    pool.on('error', (err) => {
        logger.error('Unexpected error on idle PostgreSQL client', err);
    });
} else {
    logger.warn('PostgreSQL database not configured. Set PGHOST, PGUSER, PGPASSWORD, and PGDATABASE environment variables.');
}

// Query helper function
async function query(text, params) {
    if (!pool) {
        throw new Error('Database not configured');
    }
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        logger.error('Database query error', { text, error: error.message });
        throw error;
    }
}

// Get a client from the pool for manual transaction management
async function getClient() {
    if (!pool) {
        throw new Error('Database not configured');
    }
    return await pool.connect();
}

// Transaction helper
async function transaction(callback) {
    if (!pool) {
        throw new Error('Database not configured');
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Initialize database tables
async function initializeDatabase() {
    if (!pool) {
        logger.warn('Skipping database initialization - database not configured');
        return;
    }

    const fs = require('fs');
    const path = require('path');

    try {
        // Test connection first
        await pool.query('SELECT NOW()');
        logger.info('Database connection successful');

        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Execute the entire schema at once
        // PostgreSQL can handle multiple statements in a single query
        await pool.query(schema);

        logger.info('Database tables initialized successfully');
    } catch (error) {
        logger.error('Error initializing database', error);

        // If error is about existing tables, that's OK
        if (error.code === '42P07') {
            logger.info('Tables already exist, skipping initialization');
            return;
        }

        throw error;
    }
}

module.exports = {
    query,
    getClient,
    transaction,
    pool,
    initializeDatabase,
    isDatabaseConfigured
};
