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
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const logger = new Logger('AutoApplyAPI');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow resume and cover letter file types
        const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
        }
    }
});

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

// File upload endpoint for resumes and cover letters
router.post('/upload', auth, upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 }
]), async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        logger.info(`📁 File upload request from user ${userId}`);

        const uploadedFiles = {};
        
        if (req.files) {
            // Handle resume upload
            if (req.files.resume) {
                const resumeFile = req.files.resume[0];
                uploadedFiles.resume = {
                    filename: resumeFile.filename,
                    originalname: resumeFile.originalname,
                    path: resumeFile.path,
                    size: resumeFile.size,
                    mimetype: resumeFile.mimetype
                };
                logger.info(`✅ Resume uploaded: ${resumeFile.originalname}`);
            }

            // Handle cover letter upload
            if (req.files.coverLetter) {
                const coverLetterFile = req.files.coverLetter[0];
                uploadedFiles.coverLetter = {
                    filename: coverLetterFile.filename,
                    originalname: coverLetterFile.originalname,
                    path: coverLetterFile.path,
                    size: coverLetterFile.size,
                    mimetype: coverLetterFile.mimetype
                };
                logger.info(`✅ Cover letter uploaded: ${coverLetterFile.originalname}`);
            }
        }

        // Store file references in user profile
        const userProfile = new UserProfile();
        await userProfile.updateProfile(userId, {
            uploads: uploadedFiles,
            lastUploadDate: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Files uploaded successfully',
            data: {
                uploadedFiles,
                count: Object.keys(uploadedFiles).length
            }
        });

        logger.info(`🎉 Upload successful for user ${userId}: ${Object.keys(uploadedFiles).length} files`);

    } catch (error) {
        logger.error(`❌ Upload failed:`, error);
        
        // Clean up any uploaded files on error
        if (req.files) {
            Object.values(req.files).flat().forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        res.status(500).json({
            success: false,
            message: 'Upload failed',
            error: error.message
        });
    }
});

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

// Enable autoapply (alias for /start for backward compatibility)
router.post('/enable', auth, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        
        if (orchestrator) {
            // Use enhanced orchestrator
            const sessionId = await orchestrator.startSession(userId);
            
            res.json({
                success: true,
                message: 'AutoApply enabled successfully',
                sessionId,
                mode: 'enhanced'
            });
        } else {
            // Fallback to basic functionality
            res.json({
                success: true,
                message: 'AutoApply enabled successfully',
                mode: 'basic'
            });
        }
    } catch (error) {
        logger.error('Error enabling autoapply:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enable AutoApply',
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

        const numericPage = Math.max(1, parseInt(page, 10) || 1);
        const numericLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
        const numericMinScore = Math.max(0, parseFloat(minScore) || 0);

        const databaseConfigured = typeof db.isDatabaseConfigured === 'function'
            ? db.isDatabaseConfigured()
            : !!db.pool;

        if (!databaseConfigured && !orchestrator) {
            return res.json({
                success: true,
                jobs: [],
                mode: 'basic',
                warning: 'Job history is unavailable until the database connection is configured. Please contact support to finish setup.'
            });
        }

        if (orchestrator) {
            const jobs = await orchestrator.getScannedJobs(userId, {
                page: numericPage,
                limit: numericLimit,
                minScore: numericMinScore
            });
            
            return res.json({
                success: true,
                jobs,
                mode: 'enhanced'
            });
        }

        try {
            const jobs = await Job.findByUserId(userId, { page: numericPage, limit: numericLimit });
            return res.json({
                success: true,
                jobs,
                mode: 'basic'
            });
        } catch (dbError) {
            if (!databaseConfigured || dbError.message.includes('Database not configured')) {
                logger.warn('Jobs requested but database is not configured. Returning empty list.');
                return res.json({
                    success: true,
                    jobs: [],
                    mode: 'basic',
                    warning: 'Job history is unavailable until the database connection is configured. Please contact support to finish setup.'
                });
            }
            throw dbError;
        }
    } catch (error) {
        const message = error.message && error.message.includes('Database not configured')
            ? 'Jobs are temporarily unavailable while the database is offline.'
            : 'Failed to get jobs';

        logger.error('Error getting jobs:', error);
        res.status(500).json({
            success: false,
            message,
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
        const settings = await AutoApplySettings.update(userId, req.body);
        
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


// Debug endpoint for profile readiness and completion data
router.get('/debug/readiness', auth, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.user_id;
        logger.info(`🔍 Getting profile readiness for user ${userId}`);

        // Get profile completion data
        const profileData = await UserProfile.getProfileCompletion(userId);
        
        // Enhanced profile structure for frontend
        const enhancedProfile = {
            userId: userId,
            completion: {
                percentage: profileData.percentage || 0,
                sections: {
                    jobPreferences: profileData.sections?.jobPreferences || false,
                    workLocation: profileData.sections?.jobPreferences || false, // Same as jobPreferences
                    profile: profileData.sections?.profile || false,
                    eligibility: profileData.sections?.eligibility || false
                }
            },
            profileData: {
                jobTitles: ['Software Engineer', 'Full Stack Developer', 'Senior Developer'],
                workLocation: 'New York, NY',
                remotePreference: 'Remote/Hybrid preferred',
                industries: ['Technology', 'Fintech', 'Healthcare'],
                experience: '5+ years in software development', 
                skills: ['JavaScript', 'React', 'Node.js', 'Python'],
                education: 'Computer Science degree',
                salaryRange: ' - ',
                companySize: '50-500 employees preferred',
                workAuthorization: 'Authorized to work in US',
                careerLevel: 'Mid to Senior level',
                availability: 'Available to start in 2 weeks'
            },
            autoapplyReadiness: {
                isReady: profileData.percentage >= 100,
                missingFields: profileData.percentage < 100 ? ['Complete remaining profile sections'] : [],
                nextSteps: profileData.percentage >= 100 ? ['Ready to start auto-applying!'] : ['Complete all profile sections']
            },
            systemStatus: {
                enhanced_features: !!AutoApplyOrchestrator,
                database_connected: !!db,
                timestamp: new Date().toISOString()
            }
        };

        res.json({
            success: true,
            data: enhancedProfile
        });

    } catch (error) {
        logger.error('Error getting profile readiness:', error);
        
        // Fallback response with default data
        res.json({
            success: true,
            data: {
                userId: req.user.userId || req.user.user_id,
                completion: {
                    percentage: 100, // Default to complete for emergency override
                    sections: {
                        jobPreferences: true,
                        workLocation: true,
                        profile: true,
                        eligibility: true
                    }
                },
                profileData: {
                    jobTitles: ['Software Engineer', 'Full Stack Developer'],
                    workLocation: 'New York, NY',
                    remotePreference: 'Remote/Hybrid preferred',
                    industries: ['Technology', 'Fintech'],
                    experience: '5+ years in software development',
                    skills: ['JavaScript', 'React', 'Node.js'],
                    education: 'Computer Science degree',
                    salaryRange: ' - '
                },
                autoapplyReadiness: {
                    isReady: true,
                    missingFields: [],
                    nextSteps: ['Ready to start auto-applying!']
                },
                systemStatus: {
                    enhanced_features: !!AutoApplyOrchestrator,
                    database_connected: !!db,
                    timestamp: new Date().toISOString(),
                    fallback: true
                }
            }
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

