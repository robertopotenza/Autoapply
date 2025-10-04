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

// All wizard routes require authentication
router.use(authenticateToken);

// GET /api/wizard/data - Get all saved wizard data for user
router.get('/data', async (req, res) => {
    try {
        const userId = req.user.userId;

        const completeProfile = await User.getCompleteProfile(userId);

        if (!completeProfile) {
            return res.json({
                success: true,
                data: null,
                message: 'No data found'
            });
        }

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

// POST /api/wizard/step1 - Save Step 1 (Job Preferences)
router.post('/step1', async (req, res) => {
    try {
        const userId = req.user.userId;
        const data = {
            remoteJobs: req.body.remoteJobs || [],
            onsiteLocation: req.body.onsiteLocation || '',
            jobTypes: req.body.jobTypes || [],
            jobTitles: req.body.jobTitles || [],
            seniorityLevels: req.body.seniorityLevels || [],
            timeZones: req.body.timeZones || []
        };

        const result = await JobPreferences.upsert(userId, data);

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

// POST /api/wizard/step2 - Save Step 2 (Profile)
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

        const result = await Profile.upsert(userId, data);

        logger.info(`Step 2 saved for user ${userId}`);

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

// POST /api/wizard/step3 - Save Step 3 (Eligibility)
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

        const result = await Eligibility.upsert(userId, data);

        logger.info(`Step 3 saved for user ${userId}`);

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

// POST /api/wizard/screening - Save Screening Answers
router.post('/screening', async (req, res) => {
    try {
        const userId = req.user.userId;
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

        const result = await ScreeningAnswers.upsert(userId, data);

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
