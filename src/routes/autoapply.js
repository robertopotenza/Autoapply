/**
 * Comprehensive AutoApply API Routes
 * Combines enhanced job scanning/automation with user profile management
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const UserProfile = require('../services/UserProfile');
const AutoApplySettings = require('../models/AutoApplySettings');
const Application = require('../models/Application');
const Job = require('../models/Job');

// Import enhanced autoapply services if available
let AutoApplyOrchestrator = null;
try {
    AutoApplyOrchestrator = require('../services/autoapply/AutoApplyOrchestrator');
} catch (error) {
    console.log('Enhanced AutoApply services not found, using basic functionality');
}

const { authenticateToken: auth } = require('../middleware/auth');
const { Logger } = require('../utils/logger');

const logger = new Logger('AutoApplyAPI');

// Initialize orchestrator (will be passed from main app)
let orchestrator = null;

function initializeOrchestrator(database) {
    if (AutoApplyOrchestrator) {
        orchestrator = new AutoApplyOrchestrator(database);
        logger.info('Enhanced AutoApply Orchestrator initialized');
    } else {
        logger.info('Using basic autoapply functionality');
    }
}

// Enhanced AutoApply Endpoints (if orchestrator available)

// Start enhanced autoapply session
router.post('/start', auth, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        
        if (orchestrator) {
            // Use enhanced orchestrator
            const sessionId = await orchestrator.startSession(userId);
            
            res.json({
                success: true,
                message: 'Enhanced autoapply session started',
                sessionId,
                mode: 'enhanced'
            });
        } else {
            // Fallback to basic functionality
            res.json({
                success: true,
                message: 'Basic autoapply session started',
                mode: 'basic'
            });
        }
    } catch (error) {
        logger.error('Error starting autoapply session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start autoapply session',
            error: error.message
        });
    }
});

// Stop autoapply session
router.post('/stop', auth, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        
        if (orchestrator) {
            await orchestrator.stopSession(userId);
        }
        
        res.json({
            success: true,
            message: 'Autoapply session stopped'
        });
    } catch (error) {
        logger.error('Error stopping autoapply session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop autoapply session',
            error: error.message
        });
    }
});

// Get session status
router.get('/status', auth, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        
        if (orchestrator) {
            const status = await orchestrator.getSessionStatus(userId);
            res.json({
                success: true,
                status,
                mode: 'enhanced'
            });
        } else {
            res.json({
                success: true,
                status: { active: false, mode: 'basic' },
                mode: 'basic'
            });
        }
    } catch (error) {
        logger.error('Error getting session status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get session status',
            error: error.message
        });
    }
});

// Get scanned jobs
router.get('/jobs', auth, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { page = 1, limit = 10, minScore = 0 } = req.query;
        
        if (orchestrator) {
            const jobs = await orchestrator.getScannedJobs(userId, {
                page: parseInt(page),
                limit: parseInt(limit),
                minScore: parseFloat(minScore)
            });
            
            res.json({
                success: true,
                jobs,
                mode: 'enhanced'
            });
        } else {
            // Fallback to database query
            const jobs = await Job.findByUserId(userId, { page, limit });
            res.json({
                success: true,
                jobs,
                mode: 'basic'
            });
        }
    } catch (error) {
        logger.error('Error getting jobs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get jobs',
            error: error.message
        });
    }
});

// Get applications
router.get('/applications', auth, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { page = 1, limit = 10, status } = req.query;
        
        const applications = await Application.findByUserId(userId, {
            page: parseInt(page),
            limit: parseInt(limit),
            status
        });
        
        res.json({
            success: true,
            applications
        });
    } catch (error) {
        logger.error('Error getting applications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get applications',
            error: error.message
        });
    }
});

// User Profile Management Endpoints

// Get complete user profile for autoapply
router.get('/profile', auth, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const profile = await UserProfile.getCompleteProfile(userId);

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found. Please complete the setup wizard.'
            });
        }

        res.json({
            success: true,
            profile,
            completeness: UserProfile.calculateCompleteness(profile)
        });
    } catch (error) {
        logger.error('Error getting user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user profile',
            error: error.message
        });
    }
});

// Update autoapply settings
router.put('/settings', auth, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const settings = await AutoApplySettings.updateByUserId(userId, req.body);
        
        res.json({
            success: true,
            settings,
            message: 'AutoApply settings updated successfully'
        });
    } catch (error) {
        logger.error('Error updating settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings',
            error: error.message
        });
    }
});

// Get autoapply settings
router.get('/settings', auth, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const settings = await AutoApplySettings.findByUserId(userId);
        
        res.json({
            success: true,
            settings: settings || AutoApplySettings.getDefaultSettings()
        });
    } catch (error) {
        logger.error('Error getting settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get settings',
            error: error.message
        });
    }
});

// Analytics endpoints
router.get('/analytics', auth, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        const { period = '30' } = req.query;
        
        const analytics = {
            applications: await Application.getAnalytics(userId, period),
            jobs: await Job.getAnalytics(userId, period),
            success_rate: await Application.getSuccessRate(userId, period)
        };
        
        res.json({
            success: true,
            analytics
        });
    } catch (error) {
        logger.error('Error getting analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get analytics',
            error: error.message
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'operational',
        enhanced_features: !!AutoApplyOrchestrator,
        timestamp: new Date().toISOString()
    });
});

// Export initialization function and router
module.exports = {
    router,
    initializeOrchestrator
};
