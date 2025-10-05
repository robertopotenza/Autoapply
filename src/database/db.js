const { Pool } = require('pg');
const { logger } = require('../utils/logger');

// Check if database credentials are configured
const isDatabaseConfigured = () => {
    // Check if we have either individual PG vars or DATABASE_URL
    const hasIndividualVars = !!(process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE);
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    return hasIndividualVars || hasDatabaseUrl;
};

// PostgreSQL connection pool (only if configured)
let pool = null;

if (isDatabaseConfigured()) {
    // Prioritize DATABASE_URL if available (for Railway deployment)
    if (process.env.DATABASE_URL) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        logger.info('✅ Database configured using DATABASE_URL');
    } else {
        // Fall back to individual environment variables
        pool = new Pool({
            host: process.env.PGHOST,
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            database: process.env.PGDATABASE,
            port: process.env.PGPORT || 5432,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        logger.info('✅ Database configured using PG environment variables');
    }

    // Test database connection
    pool.on('connect', () => {
        logger.info('Connected to PostgreSQL database');
    });

    pool.on('error', (err) => {
        logger.error('Unexpected error on idle PostgreSQL client', err);
    });
} else {
    logger.warn('PostgreSQL database not configured. Set DATABASE_URL or (PGHOST, PGUSER, PGPASSWORD, PGDATABASE) environment variables.');
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
        
        if (!fs.existsSync(schemaPath)) {
            logger.warn('Schema file not found at:', schemaPath);
            return;
        }
        
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Execute the entire schema at once
        // PostgreSQL can handle multiple statements in a single query
        await pool.query(schema);

        logger.info('✅ Database tables initialized successfully');
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
    transaction,
    pool,
    initializeDatabase,
    isDatabaseConfigured
};
