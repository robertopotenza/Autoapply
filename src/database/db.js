// Import the shared pool from pool.js
// This pool is environment-aware and handles SSL configuration automatically
const pool = require('./pool');
const { Logger } = require('../utils/logger');

// Create logger instance for database operations
const logger = new Logger('Database');

// Check if database credentials are configured
const isDatabaseConfigured = () => {
    return !!process.env.DATABASE_URL;
};

if (isDatabaseConfigured()) {
    logger.info('✅ Database pool initialized via pool.js');
} else {
    logger.warn('⚠️  DATABASE_URL not set - database features will be unavailable');
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
        
        // Use the new logSQL method for DEBUG_MODE
        logger.logSQL(text, params, duration);
        
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

// Helper function to run SQL file
async function runSqlFile(filePath, label) {
    const fs = require('fs');
    
    if (!fs.existsSync(filePath)) {
        logger.warn(`${label} not found at: ${filePath}`);
        return false;
    }
    
    try {
        const sql = fs.readFileSync(filePath, 'utf8');
        await pool.query(sql);
        logger.info(`✅ ${label} executed successfully`);
        return true;
    } catch (error) {
        // If tables already exist, that's OK
        if (error.code === '42P07' || error.message.includes('already exists')) {
            logger.info(`${label} - tables already exist (skipped)`);
            return true;
        }
        logger.error(`Error executing ${label}:`, error.message);
        throw error;
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

        // 1. Load base schema
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        await runSqlFile(schemaPath, 'Base schema');

        // 2. Run migrations to add AutoApply tables and features
        const migrations = [
            {
                path: path.join(__dirname, '../../database/migrations/002_autoapply_tables.sql'),
                label: 'Migration 002: AutoApply tables (jobs, applications, etc.)'
            },
            {
                path: path.join(__dirname, '../../database/migrations/003_add_email_to_profile.sql'),
                label: 'Migration 003: Add email to profile'
            },
            {
                path: path.join(__dirname, '../../database/migrations/003_add_password_reset.sql'),
                label: 'Migration 003b: Password reset tokens'
            },
            {
                path: path.join(__dirname, '../../database/migrations/004_add_user_id_to_jobs.sql'),
                label: 'Migration 004: Add user_id to jobs'
            },
            {
                path: path.join(__dirname, '../../database/migrations/005_enhanced_autoapply_tables.sql'),
                label: 'Migration 005: Enhanced autoapply tables'
            }
        ];

        for (const migration of migrations) {
            await runSqlFile(migration.path, migration.label);
        }

        logger.info('✅ Database initialization completed successfully');
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
