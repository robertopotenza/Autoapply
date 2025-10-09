const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database/db');
const { Logger } = require('../utils/logger');

const logger = new Logger('Debug');

/**
 * Access control middleware for debug endpoints
 * Only allows access when:
 * - NODE_ENV is not 'production', OR
 * - Valid X-Admin-Token header matches ADMIN_TOKEN env var
 */
function debugAccessControl(req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
        // Allow in non-production environments
        return next();
    }
    
    // In production, require admin token
    const adminToken = req.headers['x-admin-token'];
    const expectedToken = process.env.ADMIN_TOKEN;
    
    if (!expectedToken) {
        logger.warn('ADMIN_TOKEN not configured in production', {
            path: req.path,
            ip: req.ip
        });
        return res.status(403).json({
            error: 'Debug endpoints are disabled in production',
            message: 'ADMIN_TOKEN not configured'
        });
    }
    
    if (adminToken !== expectedToken) {
        logger.warn('Invalid admin token attempt', {
            path: req.path,
            ip: req.ip,
            hasToken: !!adminToken
        });
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid or missing X-Admin-Token header'
        });
    }
    
    // Valid token - allow access
    next();
}

/**
 * GET /api/debug/profile/:userId
 * 
 * Hidden diagnostic endpoint for viewing user profile completion status.
 * Returns structured JSON with profile data and completion metrics.
 * 
 * Access Control:
 * - Allowed in non-production environments
 * - In production, requires X-Admin-Token header matching ADMIN_TOKEN env var
 * 
 * Response Format:
 * {
 *   user_id: number,
 *   completion: {
 *     percentage: number,
 *     sections: {
 *       jobPreferences: boolean,
 *       profile: boolean,
 *       eligibility: boolean,
 *       screening: boolean
 *     }
 *   },
 *   calculatedAt: string (ISO 8601),
 *   correlationId: string (UUID)
 * }
 * 
 * Example Usage:
 * ```bash
 * # Development
 * curl http://localhost:3000/api/debug/profile/123
 * 
 * # Production
 * curl -H "X-Admin-Token: your-secret-token" \
 *   https://api.example.com/api/debug/profile/123
 * ```
 * 
 * @see docs/DEVELOPER_ONBOARDING.md for usage examples
 */
router.get('/profile/:userId', debugAccessControl, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const correlationId = req.traceId || req.correlationId || crypto.randomUUID();
        
        if (isNaN(userId)) {
            return res.status(400).json({
                error: 'Invalid userId',
                message: 'userId must be a valid integer',
                correlationId
            });
        }
        
        logger.info('Debug profile request', {
            userId,
            correlationId,
            ip: req.ip
        });
        
        // Check if user exists
        const userResult = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                userId,
                correlationId
            });
        }
        
        // Check each section
        const sections = {};
        
        // Job Preferences
        const jobPrefsResult = await db.query(
            'SELECT COUNT(*) as count FROM job_preferences WHERE user_id = $1',
            [userId]
        );
        sections.jobPreferences = parseInt(jobPrefsResult.rows[0].count) > 0;
        
        // Profile
        const profileResult = await db.query(
            'SELECT COUNT(*) as count FROM profile WHERE user_id = $1',
            [userId]
        );
        sections.profile = parseInt(profileResult.rows[0].count) > 0;
        
        // Eligibility
        const eligibilityResult = await db.query(
            'SELECT COUNT(*) as count FROM eligibility WHERE user_id = $1',
            [userId]
        );
        sections.eligibility = parseInt(eligibilityResult.rows[0].count) > 0;
        
        // Screening (optional section)
        const screeningResult = await db.query(
            'SELECT COUNT(*) as count FROM screening_answers WHERE user_id = $1',
            [userId]
        );
        sections.screening = parseInt(screeningResult.rows[0].count) > 0;
        
        // Calculate completion percentage
        // Core sections: jobPreferences, profile, eligibility (3 required)
        // Screening is optional, so not counted toward percentage
        const coreComplete = [
            sections.jobPreferences,
            sections.profile,
            sections.eligibility
        ].filter(Boolean).length;
        
        const percentage = Math.round((coreComplete / 3) * 100);
        
        const response = {
            user_id: userId,
            completion: {
                percentage,
                sections
            },
            calculatedAt: new Date().toISOString(),
            correlationId
        };
        
        logger.info('Debug profile response', {
            userId,
            percentage,
            correlationId
        });
        
        res.json(response);
        
    } catch (error) {
        logger.error('Debug profile error', {
            error: error.message,
            stack: error.stack,
            userId: req.params.userId
        });
        
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            correlationId: req.traceId || req.correlationId
        });
    }
});

/**
 * DEBUG ENDPOINT: Investigate all users in the database
 * This endpoint will help identify why only one user appears visible
 * REMOVE THIS ENDPOINT AFTER INVESTIGATION
 */
router.get('/users', async (req, res) => {
    try {
        console.log('🔍 DEBUG: Investigating all users in database...');
        
        // Get total user count
        const countResult = await db.query('SELECT COUNT(*) as total_users FROM users');
        const totalUsers = countResult.rows[0].total_users;
        
        // Get all users with basic info
        const usersResult = await db.query(`
            SELECT 
                id,
                email,
                created_at,
                updated_at,
                is_verified,
                last_login
            FROM users 
            ORDER BY created_at DESC
        `);
        
        // Get profile completion for each user
        const usersWithProfiles = [];
        
        for (const user of usersResult.rows) {
            // Check profile data
            const profileResult = await db.query('SELECT COUNT(*) as count FROM profile WHERE user_id = $1', [user.id]);
            const jobPrefsResult = await db.query('SELECT COUNT(*) as count FROM job_preferences WHERE user_id = $1', [user.id]);
            const eligibilityResult = await db.query('SELECT COUNT(*) as count FROM eligibility WHERE user_id = $1', [user.id]);
            const screeningResult = await db.query('SELECT COUNT(*) as count FROM screening_answers WHERE user_id = $1', [user.id]);
            
            usersWithProfiles.push({
                ...user,
                profile_records: {
                    profile: parseInt(profileResult.rows[0].count),
                    job_preferences: parseInt(jobPrefsResult.rows[0].count),
                    eligibility: parseInt(eligibilityResult.rows[0].count),
                    screening_answers: parseInt(screeningResult.rows[0].count)
                }
            });
        }
        
        // Check database tables
        const tablesResult = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        
        const response = {
            investigation_timestamp: new Date().toISOString(),
            database_info: {
                total_users: parseInt(totalUsers),
                available_tables: tablesResult.rows.map(row => row.table_name)
            },
            users: usersWithProfiles,
            summary: {
                users_found: usersResult.rows.length,
                emails: usersResult.rows.map(user => user.email),
                conclusion: usersResult.rows.length > 1 
                    ? 'Multiple users exist in database - visibility issue confirmed'
                    : usersResult.rows.length === 1 
                    ? 'Only one user found - other users may have been deleted'
                    : 'No users found - serious database issue'
            }
        };
        
        console.log('✅ DEBUG: User investigation complete');
        console.log(`📊 Found ${usersResult.rows.length} users in database`);
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ DEBUG: User investigation error:', error);
        res.status(500).json({
            error: 'Investigation failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * DEBUG ENDPOINT: Get detailed user information
 */
router.get('/user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        console.log(`🔍 DEBUG: Getting detailed info for user: ${email}`);
        
        // Get user basic info
        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                email: email,
                timestamp: new Date().toISOString()
            });
        }
        
        const user = userResult.rows[0];
        
        // Get all related data
        const profileResult = await db.query('SELECT * FROM profile WHERE user_id = $1', [user.id]);
        const jobPrefsResult = await db.query('SELECT * FROM job_preferences WHERE user_id = $1', [user.id]);
        const eligibilityResult = await db.query('SELECT * FROM eligibility WHERE user_id = $1', [user.id]);
        const screeningResult = await db.query('SELECT * FROM screening_answers WHERE user_id = $1', [user.id]);
        
        const response = {
            user: user,
            profile_data: {
                profile: profileResult.rows,
                job_preferences: jobPrefsResult.rows,
                eligibility: eligibilityResult.rows,
                screening_answers: screeningResult.rows
            },
            summary: {
                has_profile: profileResult.rows.length > 0,
                has_job_preferences: jobPrefsResult.rows.length > 0,
                has_eligibility: eligibilityResult.rows.length > 0,
                has_screening: screeningResult.rows.length > 0
            },
            timestamp: new Date().toISOString()
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ DEBUG: User detail error:', error);
        res.status(500).json({
            error: 'User detail lookup failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
