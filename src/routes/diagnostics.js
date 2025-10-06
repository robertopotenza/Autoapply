const express = require('express');
const fs = require('fs');
const path = require('path');
const { Logger } = require('../utils/logger');

const router = express.Router();
const logger = new Logger('Diagnostics');

/**
 * GET /api/diagnostics
 * Returns diagnostic information about the application state
 */
router.get('/', async (req, res) => {
    try {
        const startTime = process.uptime();
        
        // Get environment mode
        const envMode = process.env.NODE_ENV || 'development';
        
        // Get schema version (latest migration filename)
        let schemaVersion = 'unknown';
        let activeMigrations = [];
        
        try {
            const migrationsDir = path.join(__dirname, '../../database/migrations');
            if (fs.existsSync(migrationsDir)) {
                const migrationFiles = fs.readdirSync(migrationsDir)
                    .filter(file => file.endsWith('.sql'))
                    .sort();
                
                activeMigrations = migrationFiles;
                schemaVersion = migrationFiles.length > 0 
                    ? migrationFiles[migrationFiles.length - 1] 
                    : 'no-migrations';
            }
        } catch (error) {
            logger.warn('Could not read migrations directory', { error: error.message });
        }
        
        // Database connection status
        let dbConnection = false;
        let schemaVerification = 'not-checked';
        
        const pool = req.app.locals.db;
        if (pool) {
            try {
                await pool.query('SELECT 1');
                dbConnection = true;
                
                // Check if users table exists as a basic schema verification
                const result = await pool.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'users'
                    ) as exists
                `);
                
                schemaVerification = result.rows[0].exists ? 'valid' : 'incomplete';
            } catch (error) {
                logger.warn('Database check failed', { error: error.message });
                dbConnection = false;
                schemaVerification = 'error';
            }
        }
        
        const diagnostics = {
            status: 'operational',
            uptime_seconds: Math.floor(startTime),
            schema_version: schemaVersion,
            envMode,
            activeMigrations,
            timestamp: new Date().toISOString(),
            dbConnection,
            schemaVerification
        };
        
        // Include traceId if available
        if (req.traceId) {
            diagnostics.traceId = req.traceId;
        }
        
        res.json(diagnostics);
    } catch (error) {
        logger.error('Diagnostics endpoint error', { error: error.message });
        res.status(500).json({
            status: 'error',
            message: 'Failed to gather diagnostics',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
