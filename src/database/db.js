const { Pool } = require('pg');
const logger = require('../utils/logger');

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

        // Split SQL statements and execute separately
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            if (statement) {
                await pool.query(statement);
            }
        }

        logger.info('Database tables initialized successfully');
    } catch (error) {
        logger.error('Error initializing database', error);
        throw error;
    }
}

module.exports = {
    query,
    transaction,
    pool,
    initializeDatabase,
    isDatabaseConfigured
};
