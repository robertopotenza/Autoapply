/**
 * Enhanced AutoApply API Routes
 * Provides endpoints for job scanning, application automation, and status tracking
 */

const express = require('express');
const router = express.Router();
const AutoApplyOrchestrator = require('../services/autoapply/AutoApplyOrchestrator');
const { authenticateToken } = require('../middleware/auth');
const { Logger } = require('../utils/logger');

const logger = new Logger('AutoApplyAPI');

// Initialize orchestrator (will be passed from main app)
let orchestrator = null;

function initializeOrchestrator(database) {
    orchestrator = new AutoApplyOrchestrator(database);
    // Start continuous autoapply process
    orchestrator.runContinuousAutoApply();
}

/**
 * POST /api/autoapply/start
 * Start autoapply for authenticated user
 */
router.post('/start', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        logger.info(`Starting autoapply for user: ${userId}`);

        const result = await orchestrator.startAutoApplyForUser(userId);
        
        res.json({
            success: true,
            message: 'Autoapply started successfully',
            data: result
        });

    } catch (error) {
        logger.error('Failed to start autoapply:', error.message);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/autoapply/stop
 * Stop autoapply for authenticated user
 */
router.post('/stop', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        logger.info(`Stopping autoapply for user: ${userId}`);

        const result = await orchestrator.stopAutoApplyForUser(userId);
        
        res.json({
            success: true,
            message: 'Autoapply stopped successfully',
            data: result
        });

    } catch (error) {
        logger.error('Failed to stop autoapply:', error.message);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/autoapply/status
 * Get autoapply status for authenticated user
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const status = await orchestrator.getAutoApplyStatus(userId);
        
        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        logger.error('Failed to get autoapply status:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get autoapply status'
        });
    }
});

/**
 * POST /api/autoapply/scan
 * Manually trigger job scan for authenticated user
 */
router.post('/scan', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        logger.info(`Manual job scan requested for user: ${userId}`);

        const result = await orchestrator.performJobScan(userId);
        
        res.json({
            success: true,
            message: `Found ${result.qualifiedCount} qualified jobs`,
            data: result
        });

    } catch (error) {
        logger.error('Manual job scan failed:', error.message);
        res.status(500).json({
            success: false,
            message: 'Job scan failed'
        });
    }
});

/**
 * GET /api/autoapply/jobs
 * Get scanned jobs for authenticated user
 */
router.get('/jobs', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 20, minScore = 60 } = req.query;
        
        const offset = (page - 1) * limit;
        
        const query = `
            SELECT 
                jo.*,
                ja.status as application_status,
                ja.created_at as applied_at
            FROM job_opportunities jo
            LEFT JOIN job_applications ja ON jo.id = ja.job_id AND ja.user_id = $1
            WHERE jo.user_id = $1 
            AND jo.match_score >= $2
            ORDER BY jo.match_score DESC, jo.scanned_at DESC
            LIMIT $3 OFFSET $4
        `;
        
        const result = await req.db.query(query, [userId, minScore, limit, offset]);
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM job_opportunities jo
            WHERE jo.user_id = $1 AND jo.match_score >= $2
        `;
        const countResult = await req.db.query(countQuery, [userId, minScore]);
        
        res.json({
            success: true,
            data: {
                jobs: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(countResult.rows[0].total),
                    pages: Math.ceil(countResult.rows[0].total / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Failed to get jobs:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get jobs'
        });
    }
});

/**
 * POST /api/autoapply/apply
 * Apply to specific jobs
 */
router.post('/apply', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { jobIds } = req.body;
        
        if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'jobIds array is required'
            });
        }
        
        logger.info(`Manual application requested for ${jobIds.length} jobs by user: ${userId}`);

        const result = await orchestrator.processApplications(userId, jobIds);
        
        res.json({
            success: true,
            message: `Processed ${result.processed} applications`,
            data: result
        });

    } catch (error) {
        logger.error('Manual application failed:', error.message);
        res.status(500).json({
            success: false,
            message: 'Application processing failed'
        });
    }
});

/**
 * GET /api/autoapply/applications
 * Get application history for authenticated user
 */
router.get('/applications', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 20, status } = req.query;
        
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                ja.*,
                jo.title,
                jo.company,
                jo.url as job_url,
                jo.match_score
            FROM job_applications ja
            JOIN job_opportunities jo ON ja.job_id = jo.id
            WHERE ja.user_id = $1
        `;
        
        const params = [userId];
        
        if (status) {
            query += ` AND ja.status = $${params.length + 1}`;
            params.push(status);
        }
        
        query += ` ORDER BY ja.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await req.db.query(query, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM job_applications WHERE user_id = $1';
        const countParams = [userId];
        
        if (status) {
            countQuery += ' AND status = $2';
            countParams.push(status);
        }
        
        const countResult = await req.db.query(countQuery, countParams);
        
        res.json({
            success: true,
            data: {
                applications: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(countResult.rows[0].total),
                    pages: Math.ceil(countResult.rows[0].total / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Failed to get applications:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get applications'
        });
    }
});

/**
 * GET /api/autoapply/stats
 * Get autoapply statistics for authenticated user
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        // Get various statistics
        const [
            totalJobsScanned,
            totalApplications,
            todaysApplications,
            successfulApplications,
            pendingApplications,
            avgMatchScore
        ] = await Promise.all([
            req.db.query('SELECT COUNT(*) as count FROM job_opportunities WHERE user_id = $1', [userId]),
            req.db.query('SELECT COUNT(*) as count FROM job_applications WHERE user_id = $1', [userId]),
            req.db.query('SELECT COUNT(*) as count FROM job_applications WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE', [userId]),
            req.db.query('SELECT COUNT(*) as count FROM job_applications WHERE user_id = $1 AND status IN (\'submitted\', \'ready_to_submit\')', [userId]),
            req.db.query('SELECT COUNT(*) as count FROM job_applications WHERE user_id = $1 AND status = \'pending\'', [userId]),
            req.db.query('SELECT AVG(match_score) as avg FROM job_opportunities WHERE user_id = $1', [userId])
        ]);
        
        // Get application status breakdown
        const statusBreakdown = await req.db.query(`
            SELECT status, COUNT(*) as count 
            FROM job_applications 
            WHERE user_id = $1 
            GROUP BY status
        `, [userId]);
        
        // Get applications over time (last 30 days)
        const applicationsOverTime = await req.db.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as applications
            FROM job_applications
            WHERE user_id = $1 
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [userId]);

        res.json({
            success: true,
            data: {
                summary: {
                    totalJobsScanned: parseInt(totalJobsScanned.rows[0].count),
                    totalApplications: parseInt(totalApplications.rows[0].count),
                    todaysApplications: parseInt(todaysApplications.rows[0].count),
                    successfulApplications: parseInt(successfulApplications.rows[0].count),
                    pendingApplications: parseInt(pendingApplications.rows[0].count),
                    averageMatchScore: Math.round(parseFloat(avgMatchScore.rows[0].avg) || 0)
                },
                statusBreakdown: statusBreakdown.rows.reduce((acc, row) => {
                    acc[row.status] = parseInt(row.count);
                    return acc;
                }, {}),
                applicationsOverTime: applicationsOverTime.rows
            }
        });

    } catch (error) {
        logger.error('Failed to get stats:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get statistics'
        });
    }
});

/**
 * POST /api/autoapply/config
 * Update autoapply configuration for user
 */
router.post('/config', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { maxDailyApplications, minMatchScore, automationMode } = req.body;
        
        const updateData = {};
        if (maxDailyApplications !== undefined) updateData.max_daily_applications = maxDailyApplications;
        if (minMatchScore !== undefined) updateData.min_match_score = minMatchScore;
        if (automationMode !== undefined) updateData.automation_mode = automationMode;
        
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No configuration updates provided'
            });
        }
        
        // Update user configuration
        const setClause = Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ');
        const query = `
            INSERT INTO autoapply_config (user_id, ${Object.keys(updateData).join(', ')}, updated_at)
            VALUES ($1, ${Object.keys(updateData).map((_, i) => `$${i + 2}`).join(', ')}, NOW())
            ON CONFLICT (user_id) DO UPDATE SET ${setClause}, updated_at = NOW()
        `;
        
        await req.db.query(query, [userId, ...Object.values(updateData)]);
        
        res.json({
            success: true,
            message: 'Configuration updated successfully',
            data: updateData
        });

    } catch (error) {
        logger.error('Failed to update config:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to update configuration'
        });
    }
});

/**
 * GET /api/autoapply/config
 * Get autoapply configuration for user
 */
router.get('/config', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const query = 'SELECT * FROM autoapply_config WHERE user_id = $1';
        const result = await req.db.query(query, [userId]);
        
        const config = result.rows[0] || {
            max_daily_applications: 20,
            min_match_score: 70,
            automation_mode: 'review'
        };
        
        res.json({
            success: true,
            data: config
        });

    } catch (error) {
        logger.error('Failed to get config:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get configuration'
        });
    }
});

module.exports = { router, initializeOrchestrator };