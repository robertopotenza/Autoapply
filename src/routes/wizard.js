const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../database/models/User');
const JobPreferences = require('../database/models/JobPreferences');
const Profile = require('../database/models/Profile');
const Eligibility = require('../database/models/Eligibility');
const ScreeningAnswers = require('../database/models/ScreeningAnswers');
const { Logger } = require('../utils/logger');
const logger = new Logger('Wizard');

/**
 * Wizard Routes
 * 
 * ARCHITECTURE OVERVIEW:
 * This module handles the multi-step wizard data flow. Each wizard step
 * writes to its own dedicated database table using the upsert pattern.
 * Complete profiles are read from the user_complete_profile VIEW which
 * aggregates all tables via LEFT JOINs.
 * 
 * DATA FLOW:
 *   WRITE: POST /step{1,2,3} or /screening → Model.upsert() → Individual TABLE
 *   READ:  GET /data → User.getCompleteProfile() → user_complete_profile VIEW
 * 
 * TABLES WRITTEN BY THIS MODULE:
 *   - job_preferences   (Step 1)
 *   - profile          (Step 2)
 *   - eligibility      (Step 3)
 *   - screening_answers (Screening)
 * 
 * VIEW READ BY THIS MODULE:
 *   - user_complete_profile (aggregates all wizard tables)
 * 
 * IMPORTANT: user_complete_profile is a VIEW, not a table. You cannot write to it.
 * 
 * @see SCHEMA_ARCHITECTURE.md for detailed architecture documentation
 * @see FAQ_SCREENING_DATA.md for common questions about data storage
 */

// All wizard routes require authentication
router.use(authenticateToken);

/**
 * GET /api/wizard/data
 * 
 * Retrieves complete wizard data for the authenticated user.
 * 
 * DATA SOURCE: user_complete_profile VIEW (not a table)
 * MODEL: User.getCompleteProfile(userId)
 * 
 * The VIEW aggregates data from:
 *   - job_preferences table
 *   - profile table
 *   - eligibility table
 *   - screening_answers table
 * 
 * The VIEW does not store data - it's just a convenient read interface
 * that performs LEFT JOINs on the underlying tables.
 * 
 * @returns {Object} Complete user profile with all wizard step data
 */
router.get('/data', async (req, res) => {
    try {
        const userId = req.user.userId;
        logger.info(`[GET /data] Loading existing user data for user ${userId}`);

        const completeProfile = await User.getCompleteProfile(userId);

        if (!completeProfile) {
            logger.warn(`[GET /data] No data found in user_complete_profile for user ${userId}`);
            return res.json({
                success: true,
                data: null,
                message: 'No data found'
            });
        }

        logger.info(`[GET /data] Successfully retrieved complete profile for user ${userId}`);
        res.json({
            success: true,
            data: completeProfile
        });

    } catch (error) {
        logger.error('Error fetching wizard data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching wizard data',
            error: error.message
        });
    }
});

/**
 * POST /api/wizard/step1
 * 
 * Saves wizard Step 1 (Job Preferences) data.
 * 
 * DATA DESTINATION: job_preferences TABLE
 * MODEL: JobPreferences.upsert(userId, data)
 * PATTERN: INSERT ... ON CONFLICT DO UPDATE (upsert)
 * 
 * This endpoint writes directly to the job_preferences table.
 * The data will be accessible via the user_complete_profile VIEW.
 * 
 * @param {Object} req.body.remoteJobs - Remote work preferences
 * @param {string} req.body.onsiteLocation - Onsite location
 * @param {Array} req.body.jobTypes - Job types
 * @param {Array} req.body.jobTitles - Job titles
 * @param {Array} req.body.seniorityLevels - Seniority levels
 * @param {Array} req.body.timeZones - Time zones
 * @returns {Object} Saved job preferences record
 */
router.post('/step1', async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // 🌍 DETAILED LOGGING: Log raw remoteJobs input
        logger.info(`🌍 [Step 1] Raw remoteJobs input for user ${userId}:`, {
            remoteJobsRaw: req.body.remoteJobs,
            remoteJobsType: typeof req.body.remoteJobs,
            remoteJobsIsArray: Array.isArray(req.body.remoteJobs),
            remoteJobsLength: Array.isArray(req.body.remoteJobs) ? req.body.remoteJobs.length : 'N/A'
        });
        
        const data = {
            remoteJobs: req.body.remoteJobs || [],
            onsiteLocation: req.body.onsiteLocation || '',
            jobTypes: req.body.jobTypes || [],
            jobTitles: req.body.jobTitles || [],
            seniorityLevels: req.body.seniorityLevels || [],
            timeZones: req.body.timeZones || []
        };

        // Debug logging for remoteJobs
        logger.info(`[STEP1] Received remoteJobs for user ${userId}:`, {
            value: data.remoteJobs,
            type: Array.isArray(data.remoteJobs) ? 'array' : typeof data.remoteJobs,
            length: Array.isArray(data.remoteJobs) ? data.remoteJobs.length : undefined
        });

        const result = await JobPreferences.upsert(userId, data);
    // 🌍 DETAILED LOGGING: Log stored result
    logger.info(`🌍 [Step 1] Stored result for user ${userId}:`, {
        remoteJobsStored: result.remote_jobs,
        remoteJobsStoredType: typeof result.remote_jobs,
        remoteJobsStoredIsArray: Array.isArray(result.remote_jobs),
        length: Array.isArray(result.remote_jobs) ? result.remote_jobs.length : undefined
    });

        logger.info(`Step 1 saved for user ${userId}`);

        res.json({
            success: true,
            message: 'Step 1 saved successfully',
            data: result
        });

    } catch (error) {
        logger.error('Error saving step 1:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving step 1',
            error: error.message
        });
    }
});

/**
 * POST /api/wizard/step2
 * 
 * Saves wizard Step 2 (Profile) data.
 * 
 * DATA DESTINATION: profile TABLE
 * MODEL: Profile.upsert(userId, data)
 * PATTERN: INSERT ... ON CONFLICT DO UPDATE (upsert)
 * 
 * This endpoint writes directly to the profile table.
 * The data will be accessible via the user_complete_profile VIEW.
 * 
 * @param {string} req.body.fullName - Full name
 * @param {string} req.body.email - Email address
 * @param {string} req.body.resumePath - Resume file path
 * @param {string} req.body.coverLetterOption - Cover letter preference
 * @param {string} req.body.coverLetterPath - Cover letter file path
 * @param {string} req.body.phone - Phone number
 * @param {string} req.body.country - Country
 * @param {string} req.body.city - City
 * @param {string} req.body.stateRegion - State/Region
 * @param {string} req.body.postalCode - Postal code
 * @returns {Object} Saved profile record
 */
router.post('/step2', async (req, res) => {
    try {
        const userId = req.user.userId;
        const data = {
            fullName: req.body.fullName || '',
            email: req.body.email || '',
            resumePath: req.body.resumePath || '',
            coverLetterOption: req.body.coverLetterOption || '',
            coverLetterPath: req.body.coverLetterPath || '',
            phone: req.body.phone || '',
            country: req.body.country || '',
            city: req.body.city || '',
            stateRegion: req.body.stateRegion || '',
            postalCode: req.body.postalCode || ''
        };

        // Log what data we're actually receiving (all fields for debugging)
        logger.info(`Step 2 data received for user ${userId}:`, {
            fullName: data.fullName,
            email: data.email,
            resumePath: data.resumePath,
            coverLetterOption: data.coverLetterOption,
            coverLetterPath: data.coverLetterPath,
            phone: data.phone,
            country: data.country,
            city: data.city,
            stateRegion: data.stateRegion,
            postalCode: data.postalCode
        });

        // 🔍 AUTO-DETECTION: Check for incomplete/empty critical fields
        const criticalFields = ['fullName', 'email', 'country'];
        const emptyFields = criticalFields.filter(field => !data[field] || data[field].trim() === '');
        
        if (emptyFields.length > 0) {
            logger.warn(`⚠️ INCOMPLETE STEP 2 SUBMISSION - User ${userId} submitted with empty critical fields:`, {
                emptyFields,
                allData: data,
                suggestion: 'Check frontend data capture: saveAllStepsData() → parseFormData() → API call'
            });
        }

        // 🔍 AUTO-DETECTION: Check if ALL fields are empty (likely a bug)
        const allFieldsEmpty = Object.values(data).every(value => !value || value.trim() === '');
        
        if (allFieldsEmpty) {
            logger.error(`❌ CRITICAL: All Step 2 fields are empty for user ${userId}!`, {
                receivedBody: req.body,
                suggestion: 'Frontend is sending empty payload. Check: 1) saveAllStepsData() execution, 2) parseFormData() logic, 3) API request body'
            });
        }

        const result = await Profile.upsert(userId, data);

        logger.info(`Step 2 saved for user ${userId}. Result:`, {
            fullName: result.full_name,
            email: result.email,
            resumePath: result.resume_path,
            phone: result.phone,
            country: result.country,
            city: result.city
        });

        res.json({
            success: true,
            message: 'Step 2 saved successfully',
            data: result
        });

    } catch (error) {
        logger.error('Error saving step 2:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving step 2',
            error: error.message
        });
    }
});

/**
 * POST /api/wizard/step3
 * 
 * Saves wizard Step 3 (Eligibility) data.
 * 
 * DATA DESTINATION: eligibility TABLE
 * MODEL: Eligibility.upsert(userId, data)
 * PATTERN: INSERT ... ON CONFLICT DO UPDATE (upsert)
 * 
 * This endpoint writes directly to the eligibility table.
 * The data will be accessible via the user_complete_profile VIEW.
 * 
 * @param {string} req.body.currentJobTitle - Current job title
 * @param {string} req.body.availability - Availability to start
 * @param {Array} req.body.eligibleCountries - Countries eligible to work in
 * @param {boolean} req.body.visaSponsorship - Visa sponsorship needs
 * @param {Array} req.body.nationality - Nationality/nationalities
 * @param {number} req.body.currentSalary - Current salary
 * @param {number} req.body.expectedSalary - Expected salary
 * @returns {Object} Saved eligibility record
 */
router.post('/step3', async (req, res) => {
    try {
        const userId = req.user.userId;
        const data = {
            currentJobTitle: req.body.currentJobTitle || '',
            availability: req.body.availability || '',
            eligibleCountries: req.body.eligibleCountries || [],
            visaSponsorship: req.body.visaSponsorship || false,
            nationality: req.body.nationality || [],
            currentSalary: req.body.currentSalary || null,
            expectedSalary: req.body.expectedSalary || null
        };

        // Log what data we're actually receiving
        logger.info(`Step 3 data received for user ${userId}:`, {
            currentJobTitle: data.currentJobTitle,
            availability: data.availability,
            eligibleCountries: data.eligibleCountries,
            visaSponsorship: data.visaSponsorship
        });

        const result = await Eligibility.upsert(userId, data);

        logger.info(`Step 3 saved for user ${userId}. Result:`, {
            currentJobTitle: result.current_job_title,
            availability: result.availability
        });

        res.json({
            success: true,
            message: 'Step 3 saved successfully',
            data: result
        });

    } catch (error) {
        logger.error('Error saving step 3:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving step 3',
            error: error.message
        });
    }
});

/**
 * POST /api/wizard/screening
 * 
 * Saves screening questions data.
 * 
 * DATA DESTINATION: screening_answers TABLE (NOT user_complete_profile)
 * MODEL: ScreeningAnswers.upsert(userId, data)
 * PATTERN: INSERT ... ON CONFLICT DO UPDATE (upsert)
 * 
 * IMPORTANT: This writes to the screening_answers table.
 * When you query user_complete_profile and see screening data (languages,
 * disability_status, etc.), that data is being read FROM screening_answers table.
 * The user_complete_profile VIEW does not store data - it just provides a
 * unified read interface via JOIN operations.
 * 
 * @param {string} req.body.experienceSummary - Experience summary
 * @param {string} req.body.hybridPreference - Hybrid work preference
 * @param {string} req.body.travel - Travel willingness
 * @param {string} req.body.relocation - Relocation willingness
 * @param {Array} req.body.languages - Languages spoken
 * @param {string} req.body.dateOfBirth - Date of birth
 * @param {number} req.body.gpa - GPA
 * @param {boolean} req.body.isAdult - Is 18+ years old
 * @param {string} req.body.genderIdentity - Gender identity
 * @param {string} req.body.disabilityStatus - Disability status
 * @param {string} req.body.militaryService - Military service status
 * @param {string} req.body.ethnicity - Ethnicity
 * @param {string} req.body.drivingLicense - Driving license status
 * @returns {Object} Saved screening answers record
 */
router.post('/screening', async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Log incoming request body for debugging
        logger.info(`[POST /screening] Received payload for user ${userId}:`, {
            languages: req.body.languages,
            disabilityStatus: req.body.disabilityStatus,
            fullPayload: req.body
        });
        
        const data = {
            experienceSummary: req.body.experienceSummary || '',
            hybridPreference: req.body.hybridPreference || '',
            travel: req.body.travel || '',
            relocation: req.body.relocation || '',
            languages: req.body.languages || [],
            dateOfBirth: req.body.dateOfBirth || null,
            gpa: req.body.gpa || null,
            isAdult: req.body.isAdult || null,
            genderIdentity: req.body.genderIdentity || '',
            disabilityStatus: req.body.disabilityStatus || '',
            militaryService: req.body.militaryService || '',
            ethnicity: req.body.ethnicity || '',
            drivingLicense: req.body.drivingLicense || ''
        };

        logger.info(`[POST /screening] Prepared data for upsert:`, {
            languages: data.languages,
            disabilityStatus: data.disabilityStatus
        });

        const result = await ScreeningAnswers.upsert(userId, data);

        logger.info(`[POST /screening] Result after upsert:`, {
            languages: result.languages,
            disability_status: result.disability_status
        });
        
        logger.info(`Screening answers saved for user ${userId}`);

        res.json({
            success: true,
            message: 'Screening answers saved successfully',
            data: result
        });

    } catch (error) {
        logger.error('Error saving screening answers:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving screening answers',
            error: error.message
        });
    }
});

// PUT /api/wizard/update - Update any section
router.put('/update', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { section, data } = req.body;

        let result;

        switch (section) {
            case 'jobPreferences':
                result = await JobPreferences.upsert(userId, data);
                break;
            case 'profile':
                result = await Profile.upsert(userId, data);
                break;
            case 'eligibility':
                result = await Eligibility.upsert(userId, data);
                break;
            case 'screening':
                result = await ScreeningAnswers.upsert(userId, data);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid section'
                });
        }

        logger.info(`Section ${section} updated for user ${userId}`);

        res.json({
            success: true,
            message: 'Data updated successfully',
            data: result
        });

    } catch (error) {
        logger.error('Error updating data:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating data',
            error: error.message
        });
    }
});

// GET /api/wizard/completion - Get completion percentage
router.get('/completion', async (req, res) => {
    try {
        const userId = req.user.userId;

        const jobPrefs = await JobPreferences.findByUserId(userId);
        const profile = await Profile.findByUserId(userId);
        const eligibility = await Eligibility.findByUserId(userId);
        const screening = await ScreeningAnswers.findByUserId(userId);

        const sections = {
            jobPreferences: !!jobPrefs,
            profile: !!profile,
            eligibility: !!eligibility,
            screening: !!screening
        };

        const completedSections = Object.values(sections).filter(Boolean).length;
        const totalSections = 4;
        const percentage = Math.round((completedSections / totalSections) * 100);

        res.json({
            success: true,
            data: {
                percentage,
                sections,
                completedSections,
                totalSections
            }
        });

    } catch (error) {
        logger.error('Error calculating completion:', error);
        res.status(500).json({
            success: false,
            message: 'Error calculating completion',
            error: error.message
        });
    }
});

module.exports = router;
