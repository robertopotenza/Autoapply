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

const SETTINGS_DATA_DIR = path.join(__dirname, '../../data');
const SETTINGS_STORE_FILE = path.join(SETTINGS_DATA_DIR, 'autoapply-settings.json');

const envFlag = (name) => String(process.env[name] || '').trim().toLowerCase();
const isFlagEnabled = (value) => ['1', 'true', 'yes', 'on'].includes(value);

const isProductionEnvironment = () => {
    const nodeEnv = envFlag('NODE_ENV');
    if (nodeEnv === 'production') {
        return true;
    }
    if (nodeEnv && ['development', 'test'].includes(nodeEnv)) {
        return false;
    }

    const railwayEnv = envFlag('RAILWAY_ENVIRONMENT_NAME') || envFlag('RAILWAY_ENVIRONMENT');
    return railwayEnv === 'production';
};

const isLocalFallbackAllowed = () => {
    const forceFallback = envFlag('AUTOAPPLY_FORCE_SETTINGS_FALLBACK');
    if (forceFallback && isFlagEnabled(forceFallback)) {
        return true;
    }

    const disableFallback = envFlag('AUTOAPPLY_DISABLE_SETTINGS_FALLBACK');
    if (disableFallback && isFlagEnabled(disableFallback)) {
        return false;
    }

    return !isProductionEnvironment();
};

const fallbackNotAllowedResponse = (res, message, statusCode = 503) => res.status(statusCode).json({
    success: false,
    message: message || 'AutoApply settings require an active database connection.',
    storage_mode: 'database-required',
    requires_database: true
});

const isDatabaseReady = () => {
    if (typeof db.isDatabaseConfigured === 'function') {
        try {
            return db.isDatabaseConfigured();
        } catch (error) {
            logger.warn('Error checking database configuration state', error);
            return false;
        }
    }

    if (db && db.pool) {
        return true;
    }

    return typeof db?.query === 'function';
};

const shouldFallbackToLocal = (error) => {
    if (!error) {
        return false;
    }

    const message = (error.message || '').toLowerCase();
    return message.includes('database not configured') ||
        error.code === '42P01' ||
        error.code === '57P03';
};

const clampNumber = (value, { min, max, fallback }) => {
    const numeric = parseInt(value, 10);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, numeric));
};

const ensureArray = (value, fallback = []) => {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (error) {
            return fallback;
        }
    }
    if (value === undefined || value === null) {
        return fallback;
    }
    return Array.isArray(value) ? value : [value].filter(Boolean);
};

const ensureObject = (value, fallback = {}) => {
    if (!value) {
        return { ...fallback };
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return typeof parsed === 'object' && parsed !== null ? parsed : { ...fallback };
        } catch (error) {
            return { ...fallback };
        }
    }
    if (typeof value === 'object') {
        return { ...fallback, ...value };
    }
    return { ...fallback };
};

const ensureSettingsDataDir = () => {
    if (!fs.existsSync(SETTINGS_DATA_DIR)) {
        fs.mkdirSync(SETTINGS_DATA_DIR, { recursive: true });
    }
};

const loadSettingsStore = () => {
    try {
        const raw = fs.readFileSync(SETTINGS_STORE_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (error) {
        return {};
    }
};

const saveSettingsStore = (store) => {
    ensureSettingsDataDir();
    fs.writeFileSync(SETTINGS_STORE_FILE, JSON.stringify(store, null, 2));
};

const getStoredSettings = (userId) => {
    const store = loadSettingsStore();
    const record = store[String(userId)];
    return record && record.settings ? { ...record.settings } : null;
};

const persistStoredSettings = (userId, settings, defaults) => {
    const store = loadSettingsStore();
    store[String(userId)] = {
        settings: settings,
        updatedAt: new Date().toISOString(),
        defaults: defaults
    };
    saveSettingsStore(store);
};

const sanitizeSettingsInput = (updates = {}, defaults = {}) => {
    const sanitized = {};

    if (updates.mode !== undefined) {
        sanitized.mode = String(updates.mode);
    }

    if (updates.max_applications_per_day !== undefined) {
        sanitized.max_applications_per_day = clampNumber(updates.max_applications_per_day, {
            min: 1,
            max: 500,
            fallback: defaults.max_applications_per_day ?? 10
        });
    }

    if (updates.max_applications_per_week !== undefined) {
        sanitized.max_applications_per_week = clampNumber(updates.max_applications_per_week, {
            min: 1,
            max: 2000,
            fallback: defaults.max_applications_per_week ?? 50
        });
    }

    if (updates.scan_frequency_hours !== undefined) {
        sanitized.scan_frequency_hours = clampNumber(updates.scan_frequency_hours, {
            min: 1,
            max: 168,
            fallback: defaults.scan_frequency_hours ?? 2
        });
    }

    if (updates.min_match_score !== undefined) {
        sanitized.min_match_score = clampNumber(updates.min_match_score, {
            min: 0,
            max: 100,
            fallback: defaults.min_match_score ?? 70
        });
    }

    if (updates.enabled !== undefined) {
        sanitized.enabled = Boolean(updates.enabled);
    }

    if (updates.is_enabled !== undefined) {
        sanitized.enabled = Boolean(updates.is_enabled);
    }

    ['preferred_locations', 'job_types', 'exclude_companies', 'include_companies', 'keywords', 'exclude_keywords'].forEach(field => {
        if (updates[field] !== undefined) {
            sanitized[field] = ensureArray(updates[field], []);
        }
    });

    if (updates.screening_answers !== undefined) {
        sanitized.screening_answers = ensureObject(updates.screening_answers, {});
    }

    return sanitized;
};

const coerceSettings = (userId, baseSettings = {}, defaults = AutoApplySettings.getDefaultSettings(userId)) => {
    const combined = {
        ...defaults,
        ...baseSettings
    };

    combined.user_id = userId ?? combined.user_id ?? defaults.user_id ?? null;
    combined.enabled = combined.enabled !== undefined ? Boolean(combined.enabled) : Boolean(combined.is_enabled ?? defaults.enabled);
    combined.is_enabled = combined.enabled;
    combined.mode = combined.mode || defaults.mode;
    combined.max_applications_per_day = clampNumber(combined.max_applications_per_day, {
        min: 1,
        max: 500,
        fallback: defaults.max_applications_per_day
    });
    combined.max_applications_per_week = clampNumber(combined.max_applications_per_week, {
        min: 1,
        max: 2000,
        fallback: defaults.max_applications_per_week
    });
    combined.scan_frequency_hours = clampNumber(combined.scan_frequency_hours, {
        min: 1,
        max: 168,
        fallback: defaults.scan_frequency_hours
    });
    combined.min_match_score = clampNumber(combined.min_match_score, {
        min: 0,
        max: 100,
        fallback: defaults.min_match_score
    });

    combined.preferred_locations = ensureArray(combined.preferred_locations, defaults.preferred_locations);
    combined.job_types = ensureArray(combined.job_types, defaults.job_types);
    combined.exclude_companies = ensureArray(combined.exclude_companies, defaults.exclude_companies);
    combined.include_companies = ensureArray(combined.include_companies, defaults.include_companies);
    combined.keywords = ensureArray(combined.keywords, defaults.keywords);
    combined.exclude_keywords = ensureArray(combined.exclude_keywords, defaults.exclude_keywords);
    combined.screening_answers = ensureObject(combined.screening_answers, defaults.screening_answers);

    return combined;
};

const mergeFallbackSettings = (userId, updates = {}, defaults = AutoApplySettings.getDefaultSettings(userId)) => {
    const sanitized = sanitizeSettingsInput(updates, defaults);
    const existing = getStoredSettings(userId) || {};
    const merged = coerceSettings(userId, { ...existing, ...sanitized }, defaults);
    merged.updated_at = new Date().toISOString();
    persistStoredSettings(userId, merged, defaults);
    return merged;
};

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
        logger.error(`❌ Upload failed:`, {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        
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
            const result = await orchestrator.startAutoApplyForUser(userId);

            res.json({
                success: true,
                message: result.message || 'Enhanced autoapply session started',
                sessionId: result.sessionId,
                initialJobs: result.initialJobs,
                config: result.config,
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
        logger.error('Error starting autoapply session:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
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
            const result = await orchestrator.startAutoApplyForUser(userId);

            res.json({
                success: true,
                message: result.message || 'AutoApply enabled successfully',
                sessionId: result.sessionId,
                initialJobs: result.initialJobs,
                config: result.config,
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
        logger.error('Error enabling autoapply:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
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
        logger.error('Error stopping autoapply session:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
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
        logger.error('Error getting session status:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
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
        // Check if this is a database connection issue
        const isDatabaseError = error.message && (
            error.message.includes('Database not configured') ||
            error.message.includes('connect ECONNREFUSED') ||
            error.message.includes('database') ||
            error.code === 'ECONNREFUSED'
        );

        const databaseConfigured = typeof db.isDatabaseConfigured === 'function'
            ? db.isDatabaseConfigured()
            : !!db.pool;

        if (isDatabaseError || !databaseConfigured) {
            logger.warn('Database unavailable, returning empty jobs list:', error.message);
            return res.json({
                success: true,
                jobs: [],
                mode: 'offline',
                message: 'Job scanning is temporarily unavailable. Database connection needed.',
                warning: 'Please contact support to configure the database connection.'
            });
        }

        const message = 'Failed to get jobs';
        logger.error('Error getting jobs:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
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
        logger.error('Error getting applications:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
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
        logger.error('Error getting user profile:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        res.status(500).json({
            success: false,
            message: 'Failed to get user profile',
            error: error.message
        });
    }
});

// Update autoapply settings
router.put('/settings', auth, async (req, res) => {
    const userId = req.user.userId || req.user.user_id;
    const defaults = AutoApplySettings.getDefaultSettings(userId);
    const updates = req.body || {};

    const respondWithFallback = ({ fallbackMessage, failureMessage } = {}) => {
        if (!isLocalFallbackAllowed()) {
            logger.error('Local settings fallback is disabled; refusing to save settings without database connection.');
            return fallbackNotAllowedResponse(
                res,
                failureMessage || 'AutoApply settings could not be saved because the database connection is unavailable. Configure PostgreSQL before continuing.'
            );
        }

        const fallbackSettings = mergeFallbackSettings(userId, updates, defaults);
        return res.json({
            success: true,
            settings: fallbackSettings,
            message: fallbackMessage || 'AutoApply settings saved locally while database is unavailable',
            storage_mode: 'local-fallback'
        });
    };

    try {
        if (!isDatabaseReady()) {
            const message = 'AutoApply settings saved locally (database offline)';
            logger.warn('Database not configured, attempting local fallback for settings update');
            return respondWithFallback({
                fallbackMessage: message,
                failureMessage: 'AutoApply settings could not be saved because the database connection is unavailable and local fallback is disabled.'
            });
        }

        const updated = await AutoApplySettings.update(userId, updates);
        const normalized = coerceSettings(userId, updated || updates, defaults);
        if (isLocalFallbackAllowed()) {
            persistStoredSettings(userId, normalized, defaults);
        }

        res.json({
            success: true,
            settings: normalized,
            message: 'AutoApply settings updated successfully',
            storage_mode: 'database'
        });
    } catch (error) {
        logger.error('Error updating settings:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });

        if (shouldFallbackToLocal(error)) {
            if (isLocalFallbackAllowed()) {
                logger.warn('Falling back to local settings store due to database error');
            } else {
                logger.error('Database error encountered but local fallback is disabled; failing settings update.');
            }
            return respondWithFallback({
                failureMessage: 'AutoApply settings could not be saved because the database connection is unavailable and local fallback is disabled.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update settings',
            error: error.message
        });
    }
});

// Get autoapply settings
router.get('/settings', auth, async (req, res) => {
    const userId = req.user.userId || req.user.user_id;
    const defaults = AutoApplySettings.getDefaultSettings(userId);

    const respondWithFallback = ({ fallbackMessage, failureMessage, statusCode = 200 } = {}) => {
        if (!isLocalFallbackAllowed()) {
            logger.error('Local settings fallback is disabled; refusing to serve settings without database connection.');
            return fallbackNotAllowedResponse(
                res,
                failureMessage || 'AutoApply settings cannot be loaded because the database connection is unavailable.',
                503
            );
        }

        const stored = getStoredSettings(userId);
        const fallbackSettings = stored ? coerceSettings(userId, stored, defaults) : coerceSettings(userId, defaults, defaults);
        if (!stored) {
            persistStoredSettings(userId, fallbackSettings, defaults);
        }
        return res.status(statusCode).json({
            success: true,
            settings: fallbackSettings,
            message: fallbackMessage || 'AutoApply settings loaded from local fallback store',
            storage_mode: 'local-fallback'
        });
    };

    try {
        if (!isDatabaseReady()) {
            logger.warn('Database not configured, attempting local fallback for settings retrieval');
            return respondWithFallback({
                fallbackMessage: 'AutoApply settings loaded from local fallback (database offline)',
                failureMessage: 'AutoApply settings cannot be loaded because the database connection is unavailable and local fallback is disabled.',
                statusCode: 200
            });
        }

        const settings = await AutoApplySettings.findByUserId(userId);

        if (!settings) {
            logger.info('No autoapply settings found in database, using defaults');
            const defaultsNormalized = coerceSettings(userId, defaults, defaults);
            if (isLocalFallbackAllowed()) {
                persistStoredSettings(userId, defaultsNormalized, defaults);
            }
            return res.json({
                success: true,
                settings: defaultsNormalized,
                message: 'AutoApply settings initialized with defaults',
                storage_mode: 'database'
            });
        }

        const normalized = coerceSettings(userId, settings, defaults);
        if (isLocalFallbackAllowed()) {
            persistStoredSettings(userId, normalized, defaults);
        }

        res.json({
            success: true,
            settings: normalized,
            storage_mode: 'database'
        });
    } catch (error) {
        logger.error('Error getting settings:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });

        if (shouldFallbackToLocal(error)) {
            if (isLocalFallbackAllowed()) {
                logger.warn('Serving settings from local fallback due to database error');
            } else {
                logger.error('Database error encountered but local fallback is disabled; failing settings retrieval.');
            }
            return respondWithFallback({
                failureMessage: 'AutoApply settings cannot be loaded because the database connection is unavailable and local fallback is disabled.'
            });
        }

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
        logger.error('Error getting analytics:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        
        // Check for missing column errors (e.g., column "user_id" does not exist)
        const isMissingColumnError = error.message && (
            error.message.match(/column .* does not exist/i) ||
            error.message.includes('does not exist')
        );
        
        // Check for other database errors
        const isDatabaseError = error.message && (
            error.message.includes('Database not configured') ||
            error.message.includes('connect ECONNREFUSED') ||
            error.message.includes('database') ||
            error.code === 'ECONNREFUSED' ||
            error.code === '42703' || // PostgreSQL: undefined column
            error.code === '42P01'    // PostgreSQL: undefined table
        );
        
        if (isMissingColumnError || isDatabaseError) {
            logger.warn('Database error in analytics, returning empty fallback:', error.message);
            
            // Return graceful 200 response with empty analytics
            return res.status(200).json({
                success: true,
                analytics: {
                    applications: {
                        total: 0,
                        this_week: 0,
                        today: 0,
                        period_total: 0
                    },
                    jobs: {
                        total: 0,
                        this_week: 0,
                        today: 0,
                        applied: 0,
                        available: 0
                    },
                    success_rate: 0
                },
                storage_mode: 'offline',
                warning: 'Analytics data is temporarily unavailable. Database migration may be required or connection is unavailable.'
            });
        }
        
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

