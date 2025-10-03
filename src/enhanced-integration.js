/**
 * Enhanced Server Integration for Apply Autonomously
 * This file shows how to integrate the new autoapply features with the existing server
 */

// Example integration with existing server.js
const express = require('express');
const { Pool } = require('pg');
const { Logger } = require('./utils/logger');
const { router: autoApplyRouter, initializeOrchestrator } = require('./routes/autoapply');

// Initialize logger
const logger = new Logger('Server');

// Database setup (using existing connection)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize the enhanced autoapply system
async function initializeEnhancedAutoApply(app) {
    try {
        logger.info('Initializing enhanced autoapply system...');
        
        // Run database migrations for enhanced features
        await runEnhancedMigrations(pool);
        
        // Initialize the autoapply orchestrator
        initializeOrchestrator(pool);
        
        // Create a simple authentication middleware for development
        const authenticateToken = (req, res, next) => {
            // For now, skip authentication in development
            // In production, this should validate JWT tokens
            req.user = { user_id: 'demo-user-id' };
            next();
        };
        
        // Mount the enhanced autoaply API routes with auth middleware
        app.use('/api/autoapply', authenticateToken, autoApplyRouter);
        
        logger.info('Enhanced autoapply system initialized successfully');
        
        return true;
    } catch (error) {
        logger.error('Failed to initialize enhanced autoapply system:', error.message);
        throw error;
    }
}

/**
 * Run database migrations for enhanced features
 */
async function runEnhancedMigrations(db) {
    try {
        logger.info('Running enhanced autoapply database migrations...');
        
        const fs = require('fs');
        const path = require('path');
        
        // Read the enhanced schema file
        const schemaPath = path.join(__dirname, 'database', 'enhanced_autoapply_schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute the schema
        await db.query(schemaSql);
        
        logger.info('Enhanced autoapply database migrations completed');
    } catch (error) {
        logger.error('Database migration failed:', error.message);
        throw error;
    }
}

/**
 * Health check endpoint that includes autoapply status
 */
function addEnhancedHealthCheck(app) {
    app.get('/api/health/enhanced', async (req, res) => {
        try {
            // Check database connectivity
            await pool.query('SELECT 1');
            
            // Check autoapply system status
            const activeUsersQuery = 'SELECT COUNT(*) as active_users FROM user_autoapply_status WHERE is_active = true';
            const activeUsersResult = await pool.query(activeUsersQuery);
            
            const totalJobsQuery = 'SELECT COUNT(*) as total_jobs FROM job_opportunities WHERE created_at > NOW() - INTERVAL \'24 hours\'';
            const totalJobsResult = await pool.query(totalJobsQuery);
            
            const totalApplicationsQuery = 'SELECT COUNT(*) as total_applications FROM job_applications WHERE created_at > NOW() - INTERVAL \'24 hours\'';
            const totalApplicationsResult = await pool.query(totalApplicationsQuery);
            
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                autoapply: {
                    active_users: parseInt(activeUsersResult.rows[0].active_users),
                    jobs_scanned_24h: parseInt(totalJobsResult.rows[0].total_jobs),
                    applications_submitted_24h: parseInt(totalApplicationsResult.rows[0].total_applications)
                },
                database: 'connected',
                version: '2.0.0'
            });
        } catch (error) {
            logger.error('Health check failed:', error.message);
            res.status(500).json({
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

/**
 * Enhanced dashboard endpoints
 */
function addEnhancedDashboardEndpoints(app) {
    // Get enhanced dashboard data
    app.get('/api/dashboard/enhanced', async (req, res) => {
        try {
            const userId = req.user?.user_id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            
            // Get comprehensive dashboard data
            const [
                autoApplyStatus,
                recentJobs,
                recentApplications,
                weeklyStats
            ] = await Promise.all([
                pool.query('SELECT * FROM user_autoapply_stats WHERE user_id = $1', [userId]),
                pool.query(`
                    SELECT * FROM job_opportunities 
                    WHERE user_id = $1 
                    ORDER BY scanned_at DESC 
                    LIMIT 10
                `, [userId]),
                pool.query(`
                    SELECT ja.*, jo.title, jo.company 
                    FROM job_applications ja
                    JOIN job_opportunities jo ON ja.job_id = jo.id
                    WHERE ja.user_id = $1 
                    ORDER BY ja.created_at DESC 
                    LIMIT 10
                `, [userId]),
                pool.query(`
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as applications
                    FROM job_applications
                    WHERE user_id = $1 
                    AND created_at > NOW() - INTERVAL '7 days'
                    GROUP BY DATE(created_at)
                    ORDER BY date
                `, [userId])
            ]);
            
            res.json({
                autoApplyStatus: autoApplyStatus.rows[0] || null,
                recentJobs: recentJobs.rows,
                recentApplications: recentApplications.rows,
                weeklyStats: weeklyStats.rows
            });
            
        } catch (error) {
            logger.error('Enhanced dashboard data fetch failed:', error.message);
            res.status(500).json({ error: 'Failed to fetch dashboard data' });
        }
    });
}

// Example of how to integrate with existing server.js
/*
const app = express();

// ... existing middleware and routes ...

// Initialize enhanced autoapply features
initializeEnhancedAutoApply(app).then(() => {
    logger.info('Enhanced autoapply features loaded');
}).catch(error => {
    logger.error('Failed to load enhanced autoapply features:', error.message);
    process.exit(1);
});

// Add enhanced health checks
addEnhancedHealthCheck(app);

// Add enhanced dashboard endpoints (with proper authentication middleware)
app.use('/api/dashboard', authenticateToken); // Your existing auth middleware
addEnhancedDashboardEndpoints(app);

// ... rest of server setup ...
*/

module.exports = {
    initializeEnhancedAutoApply,
    runEnhancedMigrations,
    addEnhancedHealthCheck,
    addEnhancedDashboardEndpoints
};