<<<<<<< HEAD
/**
 * ⚠️ WARNING: THIS IS AN OBSOLETE CONFLICT BACKUP FILE ⚠️
 * 
 * DO NOT USE THIS FILE - IT CONTAINS OUTDATED TABLE REFERENCES
 * 
 * This file references obsolete table names:
 * - job_opportunities (should be: jobs)
 * - job_applications (should be: applications)
 * 
 * The correct, active implementation is in: src/routes/autoapply.js
 * 
 * See DATABASE_SCHEMA_UNIFICATION.md for details on the table naming changes.
 * 
 * ---
 * 
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
=======
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const UserProfile = require('../services/UserProfile');
const AutoApplySettings = require('../models/AutoApplySettings');
const Application = require('../models/Application');
const Job = require('../models/Job');
const { authenticateToken: auth } = require('../middleware/auth');

// Get complete user profile for autoapply
router.get('/profile', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const profile = await UserProfile.getCompleteProfile(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found. Please complete the setup wizard.'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user profile'
    });
  }
});

// Debug: Get detailed readiness information
router.get('/debug/readiness', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const profile = await UserProfile.getCompleteProfile(userId);
    const completeness = UserProfile.isProfileComplete(profile);
    const readiness = await UserProfile.getApplicationReadiness(userId);
    
    res.json({
      success: true,
      data: {
        userId: userId,
        profile: profile,
        completeness: completeness,
        readiness: readiness,
        debug: {
          hasProfile: !!profile,
          profileKeys: profile ? Object.keys(profile) : [],
          personalKeys: profile?.personal ? Object.keys(profile.personal) : [],
          eligibilityKeys: profile?.eligibility ? Object.keys(profile.eligibility) : [],
          preferencesKeys: profile?.preferences ? Object.keys(profile.preferences) : []
        }
      }
    });
  } catch (error) {
    console.error('Error getting readiness debug info:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving readiness information',
      error: error.message
    });
  }
});

// Setup/Update profile for autoapply
router.post('/setup-profile', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      // Personal Information
      firstName,
      lastName,
      phone,
      location,
      
      // Job Preferences  
      currentJobTitle,
      jobTitles,
      seniorityLevels,
      jobTypes,
      remotePreferences,
      
      // Eligibility & Salary
      currentSalary,
      expectedSalary,
      availability,
      visaSponsorship,
      eligibleCountries,
      
      // Additional Info
      yearsExperience,
      skills,
      linkedinUrl,
      
      // Optional fields
      timeZones,
      languages,
      hybridPreference,
      travelWillingness,
      relocationWillingness
    } = req.body;

    // Validate required fields
    const requiredFields = {
      firstName,
      lastName,
      currentJobTitle,
      jobTitles: Array.isArray(jobTitles) ? jobTitles : [],
      location
    };

    const missingFields = [];
    Object.entries(requiredFields).forEach(([key, value]) => {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        missingFields.push(key);
      }
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missingFields
      });
    }

    // Update user table with name and salary info
    const updateUserQuery = `
      UPDATE users 
      SET first_name = $1, last_name = $2, target_salary = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `;
    await db.query(updateUserQuery, [
      firstName.trim(),
      lastName.trim(),
      expectedSalary || currentSalary || 100000, // Default if not provided
      userId
    ]);

    // Create or update profile
    const upsertProfileQuery = `
      INSERT INTO profiles (
        user_id, current_role, current_salary, years_experience, location, linkedin_url, skills
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE SET
        current_role = EXCLUDED.current_role,
        current_salary = EXCLUDED.current_salary,
        years_experience = EXCLUDED.years_experience,
        location = EXCLUDED.location,
        linkedin_url = EXCLUDED.linkedin_url,
        skills = EXCLUDED.skills,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await db.query(upsertProfileQuery, [
      userId,
      currentJobTitle.trim(),
      currentSalary || null,
      yearsExperience || null,
      location.trim(),
      linkedinUrl || null,
      JSON.stringify(skills || [])
    ]);

    // Create default autoapply settings
    const defaultSettings = {
      enabled: false,
      maxApplicationsPerDay: 5,
      maxApplicationsPerCompany: 1,
      preferredLocations: location ? [location] : [],
      jobTypes: jobTypes || ['full-time'],
      salaryMin: currentSalary || null,
      salaryMax: expectedSalary || null,
      seniorityLevel: Array.isArray(seniorityLevels) && seniorityLevels.length > 0 ? seniorityLevels[0] : 'Mid-level',
      excludeCompanies: [],
      includeCompanies: [],
      keywords: jobTitles || [],
      excludeKeywords: [],
      autoGenerateCoverLetter: true,
      screeningAnswers: {
        availability: availability || 'Immediately',
        visaSponsorship: visaSponsorship ? 'Yes' : 'No',
        eligibleCountries: eligibleCountries || ['United States'],
        languages: languages || ['English'],
        hybridPreference: hybridPreference || 'hybrid',
        travelWillingness: travelWillingness || 'No',
        relocationWillingness: relocationWillingness || 'No',
        remoteWork: remotePreferences || 'hybrid'
      }
    };

    // Create or update autoapply settings
    await AutoApplySettings.create(userId, defaultSettings);

    // Get updated profile to verify completeness
    const updatedProfile = await UserProfile.getCompleteProfile(userId);
    const completeness = UserProfile.isProfileComplete(updatedProfile);

    res.json({
      success: true,
      message: 'Profile setup completed successfully',
      data: {
        profileComplete: completeness.complete,
        missingFields: completeness.missing || null,
        profile: updatedProfile,
        settings: defaultSettings
      }
    });

  } catch (error) {
    console.error('Error setting up profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting up profile',
      error: error.message
    });
  }
});

// Quick profile completion with minimal data
router.post('/complete-profile', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get current user data
    const userQuery = 'SELECT * FROM users WHERE id = $1';
    const userResult = await db.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    
    // Use existing data or reasonable defaults
    const defaultJobTitle = 'Software Engineer';
    const defaultLocation = 'Remote';
    const defaultSalary = user.target_salary || 100000;
    
    // Ensure user has first_name and last_name
    if (!user.first_name || !user.last_name) {
      const nameParts = (user.email.split('@')[0] || 'User').split('.');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts[1] || 'Name';
      
      const updateNameQuery = `
        UPDATE users 
        SET first_name = $1, last_name = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `;
      await db.query(updateNameQuery, [firstName, lastName, userId]);
    }
    
    // Create or update profile with defaults
    const upsertProfileQuery = `
      INSERT INTO profiles (
        user_id, current_role, current_salary, years_experience, location, skills
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        current_role = COALESCE(EXCLUDED.current_role, profiles.current_role, $2),
        current_salary = COALESCE(EXCLUDED.current_salary, profiles.current_salary, $3),
        years_experience = COALESCE(EXCLUDED.years_experience, profiles.years_experience, $4),
        location = COALESCE(EXCLUDED.location, profiles.location, $5),
        skills = COALESCE(EXCLUDED.skills, profiles.skills, $6),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await db.query(upsertProfileQuery, [
      userId,
      defaultJobTitle,
      defaultSalary,
      3, // Default 3 years experience
      defaultLocation,
      JSON.stringify(['JavaScript', 'Node.js', 'React']) // Default skills
    ]);
    
    // Create default autoapply settings
    try {
      await AutoApplySettings.create(userId, {
        enabled: false,
        maxApplicationsPerDay: 5,
        preferredLocations: [defaultLocation],
        jobTypes: ['full-time'],
        seniorityLevel: 'Mid-level'
      });
    } catch (error) {
      // Settings might already exist, that's OK
      console.log('AutoApply settings may already exist:', error.message);
    }
    
    // Verify profile is now complete
    const updatedProfile = await UserProfile.getCompleteProfile(userId);
    const completeness = UserProfile.isProfileComplete(updatedProfile);
    
    res.json({
      success: true,
      message: completeness.complete 
        ? 'Profile completed successfully! You can now use AutoApply.' 
        : 'Profile updated but still incomplete.',
      data: {
        profileComplete: completeness.complete,
        missingFields: completeness.missing || null,
        profile: updatedProfile
      }
    });
    
  } catch (error) {
    console.error('Error completing profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing profile',
      error: error.message
    });
  }
});

// Serve the frontend integration script
router.get('/integration.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(require('path').join(__dirname, '../../public/autoapply-integration.js'));
});

// Get application readiness status
router.get('/readiness', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const readiness = await UserProfile.getApplicationReadiness(userId);
    
    res.json({
      success: true,
      data: readiness
    });
  } catch (error) {
    console.error('Error checking application readiness:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking application readiness'
    });
  }
});

// Get autoapply settings
router.get('/settings', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = await AutoApplySettings.findByUser(userId);
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error getting autoapply settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving autoapply settings'
    });
  }
});

// Update autoapply settings
router.post('/settings', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settingsData = req.body;
    
    const settings = await AutoApplySettings.create(userId, settingsData);
    
    res.json({
      success: true,
      message: 'AutoApply settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating autoapply settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating autoapply settings'
    });
  }
});

// Enable autoapply
router.post('/enable', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Check if profile is complete
    const readiness = await UserProfile.getApplicationReadiness(userId);
    if (!readiness.profileComplete) {
      return res.status(400).json({
        success: false,
        message: 'Profile incomplete. Please complete the setup wizard first.',
        missingFields: readiness.missingFields
      });
    }
    
    const settings = await AutoApplySettings.enable(userId);
    
    res.json({
      success: true,
      message: 'AutoApply enabled successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error enabling autoapply:', error);
    res.status(500).json({
      success: false,
      message: 'Error enabling autoapply'
    });
  }
});

// Disable autoapply
router.post('/disable', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = await AutoApplySettings.disable(userId);
    
    res.json({
      success: true,
      message: 'AutoApply disabled successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error disabling autoapply:', error);
    res.status(500).json({
      success: false,
      message: 'Error disabling autoapply'
    });
  }
});

// Get user applications
router.get('/applications', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, limit = 50, offset = 0 } = req.query;
    
    const filters = { limit: parseInt(limit) };
    if (status) filters.status = status;
    
    const applications = await Application.findByUser(userId, filters);
    const stats = await Application.getUserStats(userId);
    
    res.json({
      success: true,
      data: {
        applications: applications,
        stats: stats,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (error) {
    console.error('Error getting user applications:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving applications'
    });
  }
});

// Get matching jobs for user
router.get('/matching-jobs', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20 } = req.query;
    
    const matchingJobs = await Job.getMatchingJobs(userId);
    
    // Filter jobs based on autoapply settings
    const settings = await AutoApplySettings.findByUser(userId);
    const filteredJobs = [];
    
    for (const job of matchingJobs.slice(0, limit)) {
      const shouldMatch = await AutoApplySettings.shouldJobMatch(userId, job);
      if (shouldMatch.matches) {
        filteredJobs.push({
          ...job,
          matchReason: 'Matches your preferences'
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        jobs: filteredJobs,
        total: filteredJobs.length,
        autoApplyEnabled: settings.is_enabled
      }
    });
  } catch (error) {
    console.error('Error getting matching jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving matching jobs'
    });
  }
});

// Get application limits status
router.get('/limits', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const canApply = await AutoApplySettings.canUserApplyToday(userId);
    const settings = await AutoApplySettings.findByUser(userId);
    
    res.json({
      success: true,
      data: {
        canApply: canApply.canApply,
        reason: canApply.reason,
        dailyRemaining: canApply.dailyRemaining,
        weeklyRemaining: canApply.weeklyRemaining,
        limits: {
          dailyLimit: settings.max_applications_per_day,
          weeklyLimit: settings.max_applications_per_week
        }
      }
    });
  } catch (error) {
    console.error('Error checking application limits:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking application limits'
    });
  }
});

// Test job application (without actually applying)
router.post('/test-application/:jobId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const jobId = req.params.jobId;
    
    // Get job data
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Create application package
    const applicationPackage = await UserProfile.createApplicationPackage(userId, job);
    
    res.json({
      success: true,
      message: 'Application package created successfully (test mode)',
      data: {
        job: job,
        userData: applicationPackage.userData,
        applicationData: {
          ...applicationPackage.applicationData,
          coverLetter: applicationPackage.applicationData.coverLetter.substring(0, 200) + '...' // Truncate for preview
        }
      }
    });
  } catch (error) {
    console.error('Error testing application:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating test application'
    });
  }
});

// Manual job application trigger
router.post('/apply/:jobId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const jobId = req.params.jobId;
    
    // Check if user can apply
    const canApply = await AutoApplySettings.canUserApplyToday(userId);
    if (!canApply.canApply) {
      return res.status(429).json({
        success: false,
        message: canApply.reason
      });
    }
    
    // Check if already applied
    const existingApplication = await Application.checkDuplicateApplication(userId, jobId);
    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: 'You have already applied to this job'
      });
    }
    
    // Get job data
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Create application record
    const application = await Application.create({
      user_id: userId,
      job_id: jobId,
      application_mode: 'manual'
    });
    
    res.json({
      success: true,
      message: 'Application initiated successfully',
      data: {
        applicationId: application.application_id,
        job: job,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error initiating job application:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating job application'
    });
  }
});

// Get application history with details
router.get('/application/:applicationId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const applicationId = req.params.applicationId;
    
    const application = await Application.findById(applicationId);
    if (!application || application.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    const statusHistory = await Application.getStatusHistory(applicationId);
    
    res.json({
      success: true,
      data: {
        application: application,
        statusHistory: statusHistory
      }
    });
  } catch (error) {
    console.error('Error getting application details:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving application details'
    });
  }
});

module.exports = router;
>>>>>>> origin/main
