const express = require('express');
const router = express.Router();
const db = require('../database/db');

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
