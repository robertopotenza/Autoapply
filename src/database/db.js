const { Pool } = require('pg');
const logger = require('../utils/logger');

// PostgreSQL connection pool
const pool = new Pool({
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

// Query helper function
async function query(text, params) {
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
    const fs = require('fs');
    const path = require('path');

    try {
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        await query(schema);
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
    initializeDatabase
};
